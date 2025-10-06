const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const crypto = require('crypto');
const FileUtils = require('./file-utils');

class ApiRoutes {
    constructor(fileMetadata, uploadHandler, conflictHandler) {
        this.router = express.Router();
        this.fileMetadata = fileMetadata;
        this.uploadHandler = uploadHandler;
        this.conflictHandler = conflictHandler;
        this.setupRoutes();
    }

    setupRoutes() {
        // Get all files
        this.router.get('/files', this.getFiles.bind(this));
        
        // Check if file exists
        this.router.post('/files/check-exists', this.checkFileExists.bind(this));
        
        // Check file conflict
        this.router.post('/files/check-conflict', this.checkFileConflict.bind(this));
        
        // Get file details
        this.router.post('/files/get-details', this.getFileDetails.bind(this));
        this.router.get('/files/:filename/details', this.getFileDetailsById.bind(this));
        
        // Batch conflict resolution
        this.router.post('/files/resolve-conflicts', this.resolveConflicts.bind(this));
        
        // Undo operations
        this.router.post('/files/undo', this.undoOperation.bind(this));
        this.router.get('/files/recent-actions', this.getRecentActions.bind(this));
        
        // Upload endpoints
        this.router.post('/upload', this.uploadHandler.array('files', 10), this.uploadMultiple.bind(this));
        this.router.post('/upload-single', this.uploadHandler.single('file'), this.uploadSingle.bind(this));
        
        // File operations
        this.router.get('/download/:filename', this.downloadFile.bind(this));
        this.router.get('/preview/:filename', this.previewFile.bind(this));
        this.router.delete('/files/:filename', this.deleteFile.bind(this));
        this.router.put('/files/:filename', this.renameFile.bind(this));
    }

    async getFiles(req, res) {
        try {
            const uploadsDir = path.join(__dirname, '..', 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                return res.json([]);
            }

            // Sync metadata with existing files and clean up orphaned entries
            this.fileMetadata.syncWithExistingFiles(uploadsDir);
            this.fileMetadata.cleanupOrphanedMetadata(uploadsDir);

            const files = fs.readdirSync(uploadsDir).map(internalFilename => {
                const filePath = path.join(uploadsDir, internalFilename);
                const stats = fs.statSync(filePath);
                const typeInfo = FileUtils.getFileTypeInfo(internalFilename);

                // Get display name from metadata, fallback to extracted name
                const metadata = this.fileMetadata.getFileMetadata(internalFilename);
                const displayName = metadata ? metadata.displayName : this.fileMetadata.extractOriginalName(internalFilename);

                return {
                    id: internalFilename,
                    name: internalFilename,
                    originalName: displayName,
                    displayName: displayName,
                    size: stats.size,
                    type: typeInfo.mimeType,
                    uploadDate: metadata ? new Date(metadata.uploadDate) : stats.birthtime,
                    modifiedDate: stats.mtime,
                    extension: typeInfo.extension,
                    isImage: typeInfo.isImage,
                    isVideo: typeInfo.isVideo,
                    isAudio: typeInfo.isAudio,
                    isDocument: typeInfo.isDocument,
                    path: `/uploads/${internalFilename}`,
                    metadata: metadata
                };
            });

            res.json(files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)));
        } catch (error) {
            console.error('Error getting files:', error);
            res.status(500).json({ error: 'Failed to get files' });
        }
    }

    async checkFileExists(req, res) {
        try {
            const { filename } = req.body;
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const exists = this.fileMetadata.displayNameExists(filename);

            if (exists) {
                const internalFilename = this.fileMetadata.getInternalFilename(filename);
                res.json({
                    exists: true,
                    internalFilename: internalFilename,
                    displayName: filename
                });
            } else {
                res.json({ exists: false });
            }
        } catch (error) {
            console.error('Error checking file existence:', error);
            res.status(500).json({ error: 'Failed to check file existence' });
        }
    }

    async checkFileConflict(req, res) {
        try {
            const { filename, fileSize, fileType } = req.body;
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const conflictInfo = this.conflictHandler.checkFileConflict(filename, fileSize, fileType);

            res.json({
                hasConflict: conflictInfo.hasConflict,
                conflictType: conflictInfo.type,
                existingFile: conflictInfo.existingFile,
                newFile: conflictInfo.newFile,
                recommendations: conflictInfo.recommendations,
                suggestions: conflictInfo.hasConflict ? this.conflictHandler.generateFilenameSuggestions(filename) : []
            });
        } catch (error) {
            console.error('Error checking file conflict:', error);
            res.status(500).json({ error: 'Failed to check file conflict' });
        }
    }

    async getFileDetails(req, res) {
        try {
            const { filename } = req.body;
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const internalFilename = this.fileMetadata.getInternalFilename(filename);
            if (!internalFilename) {
                return res.status(404).json({ error: 'File not found' });
            }

            const filePath = path.join(__dirname, '..', 'uploads', internalFilename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Physical file not found' });
            }

            const stats = fs.statSync(filePath);
            const metadata = this.fileMetadata.getFileMetadata(internalFilename);
            const typeInfo = FileUtils.getFileTypeInfo(filePath);

            // Generate thumbnail for images
            const thumbnailData = FileUtils.generateThumbnail(filePath, typeInfo.mimeType);

            const fileDetails = {
                displayName: filename,
                internalFilename: internalFilename,
                size: stats.size,
                formattedSize: FileUtils.formatFileSize(stats.size),
                mimeType: typeInfo.mimeType,
                uploadDate: metadata ? metadata.uploadDate : stats.birthtime.toISOString(),
                lastModified: metadata ? metadata.lastModified : stats.mtime.toISOString(),
                version: metadata ? metadata.version : 1,
                isImage: typeInfo.isImage,
                isVideo: typeInfo.isVideo,
                isAudio: typeInfo.isAudio,
                extension: typeInfo.extension,
                thumbnail: thumbnailData,
                canBackup: true
            };

            res.json(fileDetails);
        } catch (error) {
            console.error('Error getting file details:', error);
            res.status(500).json({ error: 'Failed to get file details' });
        }
    }

    async getFileDetailsById(req, res) {
        try {
            const filename = req.params.filename;
            const filePath = path.join(__dirname, '..', 'uploads', filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            const stats = fs.statSync(filePath);
            const typeInfo = FileUtils.getFileTypeInfo(filename);
            const originalName = this.uploadHandler.getOriginalName(filename);

            // Calculate SHA-256 hash
            const hash = FileUtils.calculateFileHash(filePath);

            const fileDetails = {
                id: filename,
                name: filename,
                originalName: originalName,
                size: stats.size,
                type: typeInfo.mimeType,
                uploadDate: stats.birthtime,
                modifiedDate: stats.mtime,
                extension: typeInfo.extension,
                hash: hash,
                owner: 'User',
                permissions: 'Riêng tư',
                version: '1.0',
                isImage: typeInfo.isImage,
                isVideo: typeInfo.isVideo,
                isAudio: typeInfo.isAudio,
                isDocument: typeInfo.isDocument,
                path: `/uploads/${filename}`
            };

            res.json(fileDetails);
        } catch (error) {
            console.error('Error getting file details:', error);
            res.status(500).json({ error: 'Failed to get file details' });
        }
    }

    async resolveConflicts(req, res) {
        try {
            const { conflicts, resolutions } = req.body;

            if (!conflicts || !resolutions || conflicts.length !== resolutions.length) {
                return res.status(400).json({ error: 'Invalid conflict resolution data' });
            }

            const results = [];
            const errors = [];

            for (let i = 0; i < conflicts.length; i++) {
                const conflict = conflicts[i];
                const resolution = resolutions[i];

                try {
                    let resolvedName = conflict.filename;

                    switch (resolution.action) {
                        case 'rename':
                            resolvedName = resolution.newName;
                            if (this.fileMetadata.displayNameExists(resolvedName)) {
                                errors.push({
                                    originalName: conflict.filename,
                                    error: 'New name also conflicts with existing file'
                                });
                                continue;
                            }
                            break;

                        case 'auto_rename':
                            resolvedName = this.conflictHandler.generateUniqueFilename(conflict.filename);
                            break;

                        case 'replace':
                            // Will be handled during actual upload
                            break;

                        case 'skip':
                            results.push({
                                originalName: conflict.filename,
                                action: 'skipped',
                                resolvedName: null
                            });
                            continue;

                        default:
                            errors.push({
                                originalName: conflict.filename,
                                error: 'Invalid resolution action'
                            });
                            continue;
                    }

                    results.push({
                        originalName: conflict.filename,
                        action: resolution.action,
                        resolvedName: resolvedName
                    });

                } catch (resolutionError) {
                    errors.push({
                        originalName: conflict.filename,
                        error: resolutionError.message
                    });
                }
            }

            res.json({
                success: true,
                results: results,
                errors: errors,
                totalResolved: results.length,
                totalErrors: errors.length
            });

        } catch (error) {
            console.error('Error resolving conflicts:', error);
            res.status(500).json({ error: 'Failed to resolve conflicts' });
        }
    }

    async undoOperation(req, res) {
        try {
            const { actionId, sessionId } = req.body;

            if (!global.recentActions) {
                return res.status(404).json({ error: 'No recent actions found' });
            }

            // Find the action to undo
            const actionToUndo = global.recentActions.find(action =>
                action.sessionId === sessionId &&
                (actionId ? action.timestamp === actionId : true)
            );

            if (!actionToUndo) {
                return res.status(404).json({ error: 'Action not found or cannot be undone' });
            }

            let undoResult = null;

            switch (actionToUndo.action) {
                case 'file_replaced':
                    undoResult = this.undoFileReplacement(actionToUndo);
                    break;
                case 'file_renamed':
                    undoResult = this.undoFileRename(actionToUndo);
                    break;
                case 'file_uploaded':
                    undoResult = this.undoFileUpload(actionToUndo);
                    break;
                default:
                    return res.status(400).json({ error: 'Action type cannot be undone' });
            }

            if (undoResult.success) {
                // Log the undo action
                this.conflictHandler.logConflictAction('undo_performed', {
                    originalAction: actionToUndo.action,
                    actionDetails: actionToUndo.details,
                    undoTimestamp: new Date().toISOString()
                });

                res.json({
                    success: true,
                    message: undoResult.message,
                    restoredFile: undoResult.restoredFile
                });
            } else {
                res.status(500).json({ error: undoResult.error });
            }

        } catch (error) {
            console.error('Error performing undo:', error);
            res.status(500).json({ error: 'Failed to undo action' });
        }
    }

    async getRecentActions(req, res) {
        try {
            const sessionId = req.query.sessionId;

            if (!global.recentActions) {
                return res.json([]);
            }

            const recentActions = global.recentActions
                .filter(action => !sessionId || action.sessionId === sessionId)
                .filter(action => ['file_replaced', 'file_renamed', 'file_uploaded'].includes(action.action))
                .slice(-10) // Last 10 actions
                .reverse(); // Most recent first

            res.json(recentActions);
        } catch (error) {
            console.error('Error getting recent actions:', error);
            res.status(500).json({ error: 'Failed to get recent actions' });
        }
    }

    async uploadMultiple(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No files uploaded' });
            }

            const uploadResults = [];
            const errors = [];
            const conflicts = [];

            // Process each file
            for (const file of req.files) {
                try {
                    const originalName = file.originalname;
                    const conflictAction = req.body.conflictAction;
                    const customName = req.body.customName;
                    const autoResolve = req.body.autoResolve === 'true';

                    // Validate file
                    const validation = this.uploadHandler.validateUploadedFile(file);
                    if (!validation.valid) {
                        errors.push({
                            filename: originalName,
                            error: validation.error
                        });
                        // Remove invalid file
                        FileUtils.deleteFile(file.path);
                        continue;
                    }

                    // Determine display name
                    let displayName = customName || originalName;

                    // Enhanced conflict detection
                    const conflictInfo = this.conflictHandler.checkFileConflict(displayName);

                    // Handle conflicts based on strategy
                    if (conflictInfo.hasConflict && !conflictAction) {
                        if (autoResolve) {
                            // Auto-resolve with smart naming
                            displayName = this.conflictHandler.generateUniqueFilename(displayName);
                        } else {
                            // Return conflict for user resolution
                            FileUtils.deleteFile(file.path);
                            conflicts.push({
                                filename: originalName,
                                conflictType: conflictInfo.type,
                                existingFile: conflictInfo.existingFile,
                                suggestions: this.conflictHandler.generateFilenameSuggestions(displayName)
                            });
                            continue;
                        }
                    }

                    // Process explicit conflict resolution
                    if (conflictAction === 'replace') {
                        const existingInternalName = this.fileMetadata.getInternalFilename(displayName);
                        if (existingInternalName) {
                            const existingPath = path.join(__dirname, '..', 'uploads', existingInternalName);
                            if (fs.existsSync(existingPath)) {
                                // Create backup before replacing
                                const backupName = this.conflictHandler.createBackupFile(existingPath, existingInternalName);
                                FileUtils.deleteFile(existingPath);
                            }
                            this.fileMetadata.removeFile(existingInternalName);
                        }
                    } else if (conflictAction === 'rename') {
                        displayName = customName;
                        if (this.fileMetadata.displayNameExists(displayName)) {
                            FileUtils.deleteFile(file.path);
                            errors.push({
                                filename: originalName,
                                error: 'The new filename also conflicts with an existing file'
                            });
                            continue;
                        }
                    } else if (conflictAction === 'skip') {
                        FileUtils.deleteFile(file.path);
                        continue;
                    }

                    // Add to metadata system
                    const internalFilename = this.fileMetadata.addFile(displayName, file.filename);

                    const uploadedFile = {
                        id: internalFilename,
                        name: internalFilename,
                        originalName: displayName,
                        displayName: displayName,
                        size: file.size,
                        type: file.mimetype,
                        path: `/uploads/${internalFilename}`,
                        uploadDate: new Date(),
                        wasRenamed: displayName !== originalName
                    };

                    uploadResults.push(uploadedFile);

                } catch (fileError) {
                    console.error('Error processing file:', file.originalname, fileError);
                    errors.push({
                        filename: file.originalname,
                        error: fileError.message
                    });
                    // Clean up file on error
                    try {
                        FileUtils.deleteFile(file.path);
                    } catch (unlinkError) {
                        console.error('Error cleaning up file:', unlinkError);
                    }
                }
            }

            // Return results
            const response = {
                success: uploadResults.length > 0 || conflicts.length > 0,
                message: `Processed ${req.files.length} file(s)`,
                files: uploadResults,
                conflicts: conflicts,
                errors: errors,
                totalUploaded: uploadResults.length,
                totalConflicts: conflicts.length,
                totalErrors: errors.length,
                totalFiles: req.files.length
            };

            if (conflicts.length > 0) {
                response.requiresResolution = true;
                response.message = `${conflicts.length} file(s) require conflict resolution`;
            } else if (uploadResults.length > 0) {
                response.message = `Uploaded ${uploadResults.length} file(s) successfully`;
            }

            if (errors.length > 0) {
                response.message += `, ${errors.length} file(s) failed`;
            }

            res.json(response);

        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: 'Upload failed' });
        }
    }

    async uploadSingle(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const originalName = req.file.originalname;
            const conflictAction = req.body.conflictAction;
            const customName = req.body.customName;

            // Validate file
            const validation = this.uploadHandler.validateUploadedFile(req.file);
            if (!validation.valid) {
                FileUtils.deleteFile(req.file.path);
                return res.status(400).json({ error: validation.error });
            }

            let displayName = customName || originalName;

            // Check for conflicts
            if (!conflictAction && this.fileMetadata.displayNameExists(displayName)) {
                FileUtils.deleteFile(req.file.path);
                return res.json({
                    success: false,
                    conflict: true,
                    message: 'File with this name already exists',
                    existingFile: {
                        displayName: displayName,
                        internalFilename: this.fileMetadata.getInternalFilename(displayName)
                    }
                });
            }

            // Handle conflict resolution
            if (conflictAction === 'replace') {
                const existingInternalName = this.fileMetadata.getInternalFilename(displayName);
                if (existingInternalName) {
                    const existingPath = path.join(__dirname, '..', 'uploads', existingInternalName);
                    if (fs.existsSync(existingPath)) {
                        FileUtils.deleteFile(existingPath);
                    }
                    this.fileMetadata.removeFile(existingInternalName);
                }
            } else if (conflictAction === 'rename') {
                displayName = customName;
                if (this.fileMetadata.displayNameExists(displayName)) {
                    FileUtils.deleteFile(req.file.path);
                    return res.status(400).json({
                        error: 'The new filename also conflicts with an existing file'
                    });
                }
            }

            const internalFilename = this.fileMetadata.addFile(displayName, req.file.filename);

            const uploadedFile = {
                id: internalFilename,
                name: internalFilename,
                originalName: displayName,
                displayName: displayName,
                size: req.file.size,
                type: req.file.mimetype,
                path: `/uploads/${internalFilename}`,
                uploadDate: new Date()
            };

            res.json({
                success: true,
                message: 'File uploaded successfully',
                file: uploadedFile
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: 'Upload failed' });
        }
    }

    async downloadFile(req, res) {
        try {
            const filename = req.params.filename;
            const filePath = path.join(__dirname, '..', 'uploads', filename);

            if (!FileUtils.fileExists(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            const stats = FileUtils.getFileStats(filePath);
            const originalName = this.uploadHandler.getOriginalName(filename);

            res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Content-Type', mime.lookup(filename) || 'application/octet-stream');

            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        } catch (error) {
            console.error('Download error:', error);
            res.status(500).json({ error: 'Download failed' });
        }
    }

    async previewFile(req, res) {
        try {
            const filename = req.params.filename;
            const filePath = path.join(__dirname, '..', 'uploads', filename);

            if (!FileUtils.fileExists(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            const mimeType = mime.lookup(filename) || 'application/octet-stream';

            // Add CORS headers for Vue Office
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=3600');

            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        } catch (error) {
            console.error('Preview error:', error);
            res.status(500).json({ error: 'Preview failed' });
        }
    }

    async deleteFile(req, res) {
        try {
            const internalFilename = req.params.filename;
            const filePath = path.join(__dirname, '..', 'uploads', internalFilename);

            if (!FileUtils.fileExists(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            // Get display name for response
            const metadata = this.fileMetadata.getFileMetadata(internalFilename);
            const displayName = metadata ? metadata.displayName : internalFilename;

            // Delete physical file
            FileUtils.deleteFile(filePath);

            // Remove from metadata
            this.fileMetadata.removeFile(internalFilename);

            res.json({
                success: true,
                message: 'File deleted successfully',
                deletedFile: {
                    internalFilename,
                    displayName
                }
            });
        } catch (error) {
            console.error('Delete error:', error);
            res.status(500).json({ error: 'Delete failed' });
        }
    }

    async renameFile(req, res) {
        try {
            const internalFilename = req.params.filename;
            const { newName } = req.body;

            if (!newName) {
                return res.status(400).json({ error: 'New name is required' });
            }

            const filePath = path.join(__dirname, '..', 'uploads', internalFilename);

            if (!FileUtils.fileExists(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            // Check if the file exists in metadata
            const metadata = this.fileMetadata.getFileMetadata(internalFilename);
            if (!metadata) {
                return res.status(404).json({ error: 'File metadata not found' });
            }

            // Extract extension from the new name or use the original extension
            const originalExt = path.extname(internalFilename);
            const newExt = path.extname(newName);
            const finalNewName = newExt ? newName : newName + originalExt;

            // Check if the new display name conflicts with existing files
            if (this.fileMetadata.displayNameExists(finalNewName)) {
                const existingInternalName = this.fileMetadata.getInternalFilename(finalNewName);
                if (existingInternalName !== internalFilename) {
                    return res.status(400).json({
                        error: 'A file with this name already exists'
                    });
                }
            }

            // Update the display name in metadata
            const success = this.fileMetadata.updateDisplayName(internalFilename, finalNewName);

            if (!success) {
                return res.status(500).json({ error: 'Failed to update filename' });
            }

            res.json({
                success: true,
                message: 'File renamed successfully',
                file: {
                    internalFilename,
                    oldName: metadata.displayName,
                    newName: finalNewName
                }
            });
        } catch (error) {
            console.error('Rename error:', error);
            res.status(500).json({ error: 'Rename failed' });
        }
    }

    // Undo helper methods
    undoFileReplacement(action) {
        try {
            const { originalFile, backupFile, newFile } = action.details;
            const backupDir = path.join(__dirname, '..', 'uploads', '.backups');
            const backupPath = path.join(backupDir, backupFile);
            const backupMetadataPath = path.join(backupDir, `${backupFile}.meta.json`);

            if (!FileUtils.fileExists(backupPath)) {
                return { success: false, error: 'Backup file not found' };
            }

            // Read backup metadata
            let backupMetadata = null;
            if (FileUtils.fileExists(backupMetadataPath)) {
                backupMetadata = JSON.parse(fs.readFileSync(backupMetadataPath, 'utf8'));
            }

            // Remove the new file
            const newInternalFilename = this.fileMetadata.getInternalFilename(originalFile);
            if (newInternalFilename) {
                const newFilePath = path.join(__dirname, '..', 'uploads', newInternalFilename);
                if (FileUtils.fileExists(newFilePath)) {
                    FileUtils.deleteFile(newFilePath);
                }
                this.fileMetadata.removeFile(newInternalFilename);
            }

            // Restore the backup
            const restoredInternalFilename = this.fileMetadata.generateInternalFilename(originalFile);
            const restoredPath = path.join(__dirname, '..', 'uploads', restoredInternalFilename);
            FileUtils.copyFile(backupPath, restoredPath);

            // Restore metadata
            if (backupMetadata) {
                this.fileMetadata.addFile(originalFile, restoredInternalFilename);
                const metadata = this.fileMetadata.getFileMetadata(restoredInternalFilename);
                if (metadata) {
                    metadata.uploadDate = backupMetadata.originalUploadDate;
                    metadata.lastModified = new Date().toISOString();
                    metadata.version = (backupMetadata.version || 1) + 1;
                }
            } else {
                this.fileMetadata.addFile(originalFile, restoredInternalFilename);
            }

            return {
                success: true,
                message: `Restored "${originalFile}" from backup`,
                restoredFile: {
                    displayName: originalFile,
                    internalFilename: restoredInternalFilename
                }
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    undoFileRename(action) {
        try {
            const { oldName, newName, internalFilename } = action.details;

            // Check if file still exists
            if (!this.fileMetadata.getFileMetadata(internalFilename)) {
                return { success: false, error: 'File no longer exists' };
            }

            // Check if old name is now available
            if (this.fileMetadata.displayNameExists(oldName)) {
                return { success: false, error: 'Original filename is now taken by another file' };
            }

            // Restore original name
            const success = this.fileMetadata.updateDisplayName(internalFilename, oldName);
            if (!success) {
                return { success: false, error: 'Failed to restore original filename' };
            }

            return {
                success: true,
                message: `Restored original filename "${oldName}"`,
                restoredFile: {
                    displayName: oldName,
                    internalFilename: internalFilename
                }
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    undoFileUpload(action) {
        try {
            const { filename, internalFilename } = action.details;

            // Remove the uploaded file
            const filePath = path.join(__dirname, '..', 'uploads', internalFilename);
            if (FileUtils.fileExists(filePath)) {
                FileUtils.deleteFile(filePath);
            }

            // Remove from metadata
            this.fileMetadata.removeFile(internalFilename);

            return {
                success: true,
                message: `Removed uploaded file "${filename}"`,
                restoredFile: null
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ApiRoutes;
