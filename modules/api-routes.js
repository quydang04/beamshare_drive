const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const FileUtils = require('./file-utils');

class ApiRoutes {
    constructor(fileMetadata, uploadHandler, conflictHandler, authMiddleware) {
        this.router = express.Router();
        this.fileMetadata = fileMetadata;
        this.uploadHandler = uploadHandler;
        this.conflictHandler = conflictHandler;
        this.authMiddleware = authMiddleware;
        this.uploadsRoot = path.join(__dirname, '..', 'uploads');
        this.recycleRetentionDays = 30;
        this.recycleRetentionMs = this.recycleRetentionDays * 24 * 60 * 60 * 1000;
        this.setupRoutes();
    }

    setupRoutes() {
        this.router.use(this.authMiddleware.requireAuth);

        this.router.get('/files', this.getFiles.bind(this));
        this.router.post('/files/check-exists', this.checkFileExists.bind(this));
        this.router.post('/files/check-conflict', this.checkFileConflict.bind(this));
        this.router.post('/files/get-details', this.getFileDetailsByName.bind(this));
        this.router.get('/files/:filename/details', this.getFileDetailsById.bind(this));
        this.router.post('/files/resolve-conflicts', this.resolveConflicts.bind(this));

        this.router.get('/recycle-bin', this.getRecycleBinFiles.bind(this));
        this.router.post('/recycle-bin/:filename/restore', this.restoreRecycleFile.bind(this));
        this.router.delete('/recycle-bin/:filename', this.deleteRecycleFile.bind(this));

        this.router.post('/upload', this.uploadHandler.array('files', 10), this.uploadMultiple.bind(this));
        this.router.post('/upload-single', this.uploadHandler.single('file'), this.uploadSingle.bind(this));

        this.router.get('/download/:filename', this.downloadFile.bind(this));
        this.router.get('/preview/:filename', this.previewFile.bind(this));
        this.router.delete('/files/:filename', this.deleteFile.bind(this));
        this.router.put('/files/:filename', this.renameFile.bind(this));
        this.router.patch('/files/:filename/share', this.updateShareState.bind(this));
    }

    async getFiles(req, res) {
        try {
            const userId = req.user.userId;
            const documents = await this.fileMetadata.listFilesForUser(userId);
            const summaries = [];

            for (const doc of documents) {
                const summary = await this.toFileSummary(doc);
                if (summary) {
                    summaries.push(summary);
                }
            }

            summaries.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
            res.json(summaries);
        } catch (error) {
            console.error('Error getting files:', error);
            res.status(500).json({ error: 'Failed to get files' });
        }
    }

    async checkFileExists(req, res) {
        try {
            const { filename } = req.body || {};
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const exists = await this.fileMetadata.displayNameExists(req.user.userId, filename);
            if (!exists) {
                return res.json({ exists: false });
            }

            const internalName = await this.fileMetadata.getInternalFilename(req.user.userId, filename);
            return res.json({ exists: true, internalFilename: internalName, displayName: filename });
        } catch (error) {
            console.error('Error checking file existence:', error);
            res.status(500).json({ error: 'Failed to check file existence' });
        }
    }

    async checkFileConflict(req, res) {
        try {
            const { filename, fileSize, fileType } = req.body || {};
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const conflictInfo = await this.conflictHandler.checkFileConflict(
                req.user.userId,
                filename,
                fileSize,
                fileType
            );

            if (!conflictInfo.hasConflict) {
                return res.json({ hasConflict: false });
            }

            const suggestions = await this.conflictHandler.generateFilenameSuggestions(
                req.user.userId,
                filename
            );

            res.json({
                hasConflict: true,
                conflictType: conflictInfo.type,
                existingFile: conflictInfo.existingFile,
                newFile: conflictInfo.newFile,
                recommendations: conflictInfo.recommendations,
                suggestions
            });
        } catch (error) {
            console.error('Error checking file conflict:', error);
            res.status(500).json({ error: 'Failed to check file conflict' });
        }
    }

    async getFileDetailsByName(req, res) {
        try {
            const { filename } = req.body || {};
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const internalName = await this.fileMetadata.getInternalFilename(req.user.userId, filename);
            if (!internalName) {
                return res.status(404).json({ error: 'File not found' });
            }

            const metadata = await this.fileMetadata.getFileMetadataForUser(req.user.userId, internalName);
            if (!metadata) {
                return res.status(404).json({ error: 'File metadata not found' });
            }

            const details = await this.toFileDetails(metadata);
            return res.json(details);
        } catch (error) {
            console.error('Error getting file details:', error);
            res.status(500).json({ error: 'Failed to get file details' });
        }
    }

    async getFileDetailsById(req, res) {
        try {
            const internalName = decodeURIComponent(req.params.filename);
            const metadata = await this.fileMetadata.getFileMetadataForUser(req.user.userId, internalName);
            if (!metadata) {
                return res.status(404).json({ error: 'File not found' });
            }

            const details = await this.toFileDetails(metadata);
            return res.json(details);
        } catch (error) {
            console.error('Error getting file details by id:', error);
            res.status(500).json({ error: 'Failed to get file details' });
        }
    }

    async resolveConflicts(req, res) {
        try {
            const { conflicts, resolutions } = req.body || {};

            if (!Array.isArray(conflicts) || !Array.isArray(resolutions) || conflicts.length !== resolutions.length) {
                return res.status(400).json({ error: 'Invalid conflict resolution payload' });
            }

            const results = [];
            const errors = [];

            for (let index = 0; index < conflicts.length; index++) {
                const conflict = conflicts[index];
                const resolution = resolutions[index];

                if (!conflict || !resolution) {
                    errors.push({
                        originalName: conflict?.filename || 'unknown',
                        error: 'Malformed conflict entry'
                    });
                    continue;
                }

                if (resolution.action === 'rename' && !resolution.newName) {
                    errors.push({
                        originalName: conflict.filename,
                        error: 'Missing new name for rename resolution'
                    });
                    continue;
                }

                let resolvedName = conflict.filename;

                if (resolution.action === 'auto_rename') {
                    resolvedName = await this.conflictHandler.generateUniqueFilename(
                        req.user.userId,
                        conflict.filename
                    );
                } else if (resolution.action === 'rename') {
                    const targetName = resolution.newName.trim();
                    const exists = await this.fileMetadata.displayNameExists(req.user.userId, targetName);
                    if (exists) {
                        errors.push({
                            originalName: conflict.filename,
                            error: 'The requested filename already exists'
                        });
                        continue;
                    }
                    resolvedName = targetName;
                } else if (!['replace', 'skip'].includes(resolution.action)) {
                    errors.push({
                        originalName: conflict.filename,
                        error: 'Unsupported resolution action'
                    });
                    continue;
                }

                results.push({
                    originalName: conflict.filename,
                    action: resolution.action,
                    resolvedName
                });
            }

            res.json({
                success: errors.length === 0,
                results,
                errors,
                totalResolved: results.length,
                totalErrors: errors.length
            });
        } catch (error) {
            console.error('Error resolving conflicts:', error);
            res.status(500).json({ error: 'Failed to resolve conflicts' });
        }
    }

    async uploadMultiple(req, res) {
        await this.handleUploadRequest(req, res);
    }

    async uploadSingle(req, res) {
        await this.handleUploadRequest(req, res);
    }

    async handleUploadRequest(req, res) {
        try {
            const files = req.files || (req.file ? [req.file] : []);
            if (!files.length) {
                return res.status(400).json({ error: 'No files uploaded' });
            }

            const userId = req.user.userId;
            const body = req.body || {};

            const uploadResults = [];
            const conflicts = [];
            const errors = [];

            for (const file of files) {
                try {
                    const validation = this.uploadHandler.validateUploadedFile(file);
                    if (!validation.valid) {
                        errors.push({ filename: file.originalname, error: validation.error });
                        FileUtils.deleteFile(file.path);
                        continue;
                    }

                    const conflictAction = Array.isArray(body.conflictAction)
                        ? body.conflictAction[files.indexOf(file)]
                        : body.conflictAction;

                    const requestedName = Array.isArray(body.customName)
                        ? body.customName[files.indexOf(file)]
                        : body.customName;

                    const autoResolve = String(body.autoResolve).toLowerCase() === 'true';

                    let displayName = requestedName || file.originalname;

                    const conflictInfo = await this.conflictHandler.checkFileConflict(userId, displayName, file.size, file.mimetype);

                    if (conflictInfo.hasConflict && !conflictAction) {
                        if (autoResolve) {
                            displayName = await this.conflictHandler.generateUniqueFilename(userId, displayName);
                        } else {
                            FileUtils.deleteFile(file.path);
                            conflicts.push({
                                filename: file.originalname,
                                conflictType: conflictInfo.type,
                                existingFile: conflictInfo.existingFile,
                                suggestions: await this.conflictHandler.generateFilenameSuggestions(userId, displayName)
                            });
                            continue;
                        }
                    }

                    if (conflictAction === 'replace') {
                        const existingName = await this.fileMetadata.getInternalFilename(userId, displayName);
                        if (existingName) {
                            const existingMetadata = await this.fileMetadata.getFileMetadataForUser(userId, existingName);
                            if (existingMetadata) {
                                await this.removePhysicalFile(existingMetadata);
                                await this.fileMetadata.removeFile(userId, existingName);
                            }
                        }
                    } else if (conflictAction === 'rename') {
                        const newName = requestedName || displayName;
                        const exists = await this.fileMetadata.displayNameExists(userId, newName);
                        if (exists) {
                            FileUtils.deleteFile(file.path);
                            errors.push({
                                filename: file.originalname,
                                error: 'The requested filename already exists'
                            });
                            continue;
                        }
                        displayName = newName;
                    } else if (conflictAction === 'auto_rename') {
                        displayName = await this.conflictHandler.generateUniqueFilename(userId, displayName);
                    } else if (conflictAction === 'skip') {
                        FileUtils.deleteFile(file.path);
                        continue;
                    }

                    const metadata = await this.fileMetadata.addFile({
                        userId,
                        displayName,
                        originalName: file.originalname,
                        storageName: file.filename,
                        size: file.size,
                        mimeType: file.mimetype
                    });

                    const summary = await this.toFileSummary(metadata);
                    uploadResults.push(summary);
                } catch (innerError) {
                    console.error('Upload processing error:', innerError);
                    errors.push({ filename: file.originalname, error: innerError.message });
                    FileUtils.deleteFile(file.path);
                }
            }

            const success = uploadResults.length > 0 && conflicts.length === 0;
            const messageParts = [];
            if (uploadResults.length) {
                messageParts.push(`Uploaded ${uploadResults.length} file(s) successfully`);
            }
            if (conflicts.length) {
                messageParts.push(`${conflicts.length} file(s) require conflict resolution`);
            }
            if (errors.length) {
                messageParts.push(`${errors.length} file(s) failed`);
            }

            res.json({
                success: success || conflicts.length > 0,
                message: messageParts.join(', ') || 'Upload processed',
                files: uploadResults,
                conflicts,
                errors,
                totalUploaded: uploadResults.length,
                totalConflicts: conflicts.length,
                totalErrors: errors.length,
                totalFiles: files.length,
                requiresResolution: conflicts.length > 0
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: 'Upload failed' });
        }
    }

    async downloadFile(req, res) {
        try {
            const internalName = decodeURIComponent(req.params.filename);
            const metadata = await this.fileMetadata.getFileMetadataForUser(req.user.userId, internalName);
            if (!metadata) {
                return res.status(404).json({ error: 'File not found' });
            }

            if (metadata.isDeleted) {
                return res.status(410).json({ error: 'File is currently in the recycle bin' });
            }

            const filePath = this.getFilePath(metadata);
            if (!FileUtils.fileExists(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            const stats = FileUtils.getFileStats(filePath);
            res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
            if (stats?.size) {
                res.setHeader('Content-Length', stats.size);
            }
            res.setHeader('Content-Type', metadata.mimeType || mime.lookup(metadata.originalName) || 'application/octet-stream');

            fs.createReadStream(filePath).pipe(res);
        } catch (error) {
            console.error('Download error:', error);
            res.status(500).json({ error: 'Download failed' });
        }
    }

    async previewFile(req, res) {
        try {
            const internalName = decodeURIComponent(req.params.filename);
            const metadata = await this.fileMetadata.getFileMetadataForUser(req.user.userId, internalName);
            if (!metadata) {
                return res.status(404).json({ error: 'File not found' });
            }

            if (metadata.isDeleted) {
                return res.status(410).json({ error: 'File is currently in the recycle bin' });
            }

            const filePath = this.getFilePath(metadata);
            if (!FileUtils.fileExists(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Content-Type', metadata.mimeType || mime.lookup(metadata.originalName) || 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=3600');

            fs.createReadStream(filePath).pipe(res);
        } catch (error) {
            console.error('Preview error:', error);
            res.status(500).json({ error: 'Preview failed' });
        }
    }

    async deleteFile(req, res) {
        try {
            const internalName = decodeURIComponent(req.params.filename);
            const metadata = await this.fileMetadata.getFileMetadataForUser(
                req.user.userId,
                internalName,
                { includeDeleted: true }
            );

            if (!metadata) {
                return res.status(404).json({ error: 'File not found' });
            }

            if (metadata.isDeleted) {
                return res.status(409).json({ error: 'File is already in the recycle bin' });
            }

            const filePath = this.getFilePath(metadata);
            if (!FileUtils.fileExists(filePath)) {
                await this.fileMetadata.removeFile(req.user.userId, internalName);
                return res.status(404).json({ error: 'File data not found' });
            }

            const expiresAt = new Date(Date.now() + this.recycleRetentionMs);
            const updated = await this.fileMetadata.moveToRecycleBin(req.user.userId, internalName, expiresAt);

            if (!updated) {
                return res.status(500).json({ error: 'Unable to move file to recycle bin' });
            }

            res.json({
                success: true,
                message: 'File moved to recycle bin',
                recycle: {
                    internalFilename: internalName,
                    displayName: metadata.displayName,
                    deletedAt: updated.deletedAt,
                    recycleExpiresAt: updated.recycleExpiresAt
                }
            });
        } catch (error) {
            console.error('Delete error:', error);
            res.status(500).json({ error: 'Delete failed' });
        }
    }

    async renameFile(req, res) {
        try {
            const internalName = decodeURIComponent(req.params.filename);
            const { newName } = req.body || {};

            if (!newName || !newName.trim()) {
                return res.status(400).json({ error: 'New name is required' });
            }

            const metadata = await this.fileMetadata.getFileMetadataForUser(req.user.userId, internalName);
            if (!metadata) {
                return res.status(404).json({ error: 'File not found' });
            }

            const sanitized = newName.trim();
            const exists = await this.fileMetadata.displayNameExists(req.user.userId, sanitized);
            if (exists && sanitized !== metadata.displayName) {
                return res.status(400).json({ error: 'A file with this name already exists' });
            }

            const success = await this.fileMetadata.updateDisplayName(req.user.userId, internalName, sanitized);
            if (!success) {
                return res.status(500).json({ error: 'Failed to update filename' });
            }

            res.json({
                success: true,
                message: 'File renamed successfully',
                file: {
                    internalFilename: internalName,
                    oldName: metadata.displayName,
                    newName: sanitized
                }
            });
        } catch (error) {
            console.error('Rename error:', error);
            res.status(500).json({ error: 'Rename failed' });
        }
    }

    async updateShareState(req, res) {
        try {
            const internalName = decodeURIComponent(req.params.filename);
            const { visibility, regenerateToken } = req.body || {};

            if (!['public', 'private'].includes(visibility)) {
                return res.status(400).json({ error: 'Invalid visibility option' });
            }

            let metadata = await this.fileMetadata.getFileMetadataForUser(req.user.userId, internalName);
            if (!metadata) {
                return res.status(404).json({ error: 'File not found' });
            }

            if (metadata.isDeleted) {
                return res.status(410).json({ error: 'File is currently in the recycle bin' });
            }

            metadata = await this.fileMetadata.updateShareState(req.user.userId, internalName, visibility);
            if (regenerateToken === true || regenerateToken === 'true') {
                metadata = await this.fileMetadata.refreshShareToken(req.user.userId, internalName);
            }

            const shareUrl = this.buildPublicShareUrl(req, metadata);

            res.json({
                success: true,
                visibility: metadata.visibility,
                shareToken: metadata.shareToken,
                shareUrl
            });
        } catch (error) {
            console.error('Share update error:', error);
            res.status(500).json({ error: 'Failed to update share state' });
        }
    }

    async getRecycleBinFiles(req, res) {
        try {
            const userId = req.user.userId;
            const documents = await this.fileMetadata.listRecycleBin(userId);
            const files = documents.map((doc) => ({
                internalName: doc.internalName,
                displayName: doc.displayName,
                originalName: doc.originalName,
                size: doc.size,
                formattedSize: FileUtils.formatFileSize(doc.size || 0),
                deletedAt: doc.deletedAt,
                recycleExpiresAt: doc.recycleExpiresAt
            }));

            res.json({ files });
        } catch (error) {
            console.error('Recycle bin list error:', error);
            res.status(500).json({ error: 'Failed to load recycle bin' });
        }
    }

    async restoreRecycleFile(req, res) {
        try {
            const internalName = decodeURIComponent(req.params.filename);
            const deletedMetadata = await this.fileMetadata.findDeletedFile(req.user.userId, internalName);

            if (!deletedMetadata) {
                return res.status(404).json({ error: 'File not found in recycle bin' });
            }

            const filePath = this.getFilePath(deletedMetadata);
            if (!FileUtils.fileExists(filePath)) {
                await this.fileMetadata.removeFile(req.user.userId, internalName);
                return res.status(404).json({ error: 'File data no longer exists' });
            }

            const restored = await this.fileMetadata.restoreFromRecycleBin(req.user.userId, internalName);

            if (!restored) {
                return res.status(500).json({ error: 'Failed to restore file' });
            }

            res.json({
                success: true,
                message: 'File restored successfully',
                file: {
                    internalFilename: restored.internalName,
                    displayName: restored.displayName
                }
            });
        } catch (error) {
            console.error('Recycle restore error:', error);
            res.status(500).json({ error: 'Failed to restore file' });
        }
    }

    async deleteRecycleFile(req, res) {
        try {
            const internalName = decodeURIComponent(req.params.filename);
            const deletedMetadata = await this.fileMetadata.findDeletedFile(req.user.userId, internalName);

            if (!deletedMetadata) {
                return res.status(404).json({ error: 'File not found in recycle bin' });
            }

            await this.removePhysicalFile(deletedMetadata);
            await this.fileMetadata.removeFile(req.user.userId, internalName);

            res.json({
                success: true,
                message: 'File deleted permanently',
                file: {
                    internalFilename: internalName,
                    displayName: deletedMetadata.displayName
                }
            });
        } catch (error) {
            console.error('Recycle delete error:', error);
            res.status(500).json({ error: 'Failed to delete file permanently' });
        }
    }

    async toFileSummary(metadata) {
        if (metadata.isDeleted) {
            return null;
        }

        const filePath = this.getFilePath(metadata);
        const exists = FileUtils.fileExists(filePath);

        if (!exists) {
            await this.fileMetadata.removeFile(metadata.userId, metadata.internalName);
            return null;
        }

        const stats = FileUtils.getFileStats(filePath);
        const typeInfo = FileUtils.getFileTypeInfo(metadata.originalName);

        return {
            id: metadata.internalName,
            name: metadata.internalName,
            originalName: metadata.originalName,
            displayName: metadata.displayName,
            size: stats?.size ?? metadata.size,
            type: metadata.mimeType || typeInfo.mimeType,
            uploadDate: metadata.uploadDate,
            modifiedDate: stats?.mtime ?? metadata.lastModified,
            extension: typeInfo.extension,
            isImage: typeInfo.isImage,
            isVideo: typeInfo.isVideo,
            isAudio: typeInfo.isAudio,
            isDocument: typeInfo.isDocument,
            metadata: {
                visibility: metadata.visibility,
                shareToken: metadata.shareToken,
                shareStatus: metadata.visibility,
                shareUpdatedAt: metadata.updatedAt
            }
        };
    }

    async toFileDetails(metadata) {
        if (metadata.isDeleted) {
            throw new Error('File is currently in the recycle bin');
        }

        const filePath = this.getFilePath(metadata);
        if (!FileUtils.fileExists(filePath)) {
            throw new Error('Physical file missing');
        }

        const stats = FileUtils.getFileStats(filePath);
        const typeInfo = FileUtils.getFileTypeInfo(metadata.originalName);
        const thumbnail = typeInfo.isImage ? FileUtils.generateThumbnail(filePath, metadata.mimeType || typeInfo.mimeType) : null;

        return {
            displayName: metadata.displayName,
            internalFilename: metadata.internalName,
            originalName: metadata.originalName,
            size: stats?.size ?? metadata.size,
            formattedSize: FileUtils.formatFileSize(stats?.size ?? metadata.size ?? 0),
            mimeType: metadata.mimeType || typeInfo.mimeType,
            uploadDate: metadata.uploadDate,
            lastModified: stats?.mtime ?? metadata.lastModified,
            version: metadata.version,
            isImage: typeInfo.isImage,
            isVideo: typeInfo.isVideo,
            isAudio: typeInfo.isAudio,
            extension: typeInfo.extension,
            thumbnail,
            canBackup: true,
            visibility: metadata.visibility,
            shareToken: metadata.shareToken
        };
    }

    getFilePath(metadata) {
        return path.join(this.uploadsRoot, metadata.storagePath);
    }

    async removePhysicalFile(metadata) {
        const filePath = this.getFilePath(metadata);
        if (FileUtils.fileExists(filePath)) {
            return FileUtils.deleteFile(filePath);
        }
        return false;
    }

    async purgeExpiredDeletedFiles(referenceDate = new Date()) {
        try {
            const expired = await this.fileMetadata.findExpiredDeletedFiles(referenceDate);

            for (const metadata of expired) {
                await this.removePhysicalFile(metadata);
                await this.fileMetadata.removeFile(metadata.userId, metadata.internalName);
            }

            if (expired.length > 0) {
                console.log(`Purged ${expired.length} expired recycle bin file(s).`);
            }
        } catch (error) {
            console.error('Failed to purge expired recycle bin files:', error);
        }
    }

    buildPublicShareUrl(req, metadata) {
        if (!metadata || metadata.visibility !== 'public') {
            return null;
        }

        const sharePath = `/files/d/${encodeURIComponent(metadata.internalName)}`;
        const hostHeader = req.get('host');

        if (!hostHeader) {
            if (metadata.shareToken) {
                return `${sharePath}?token=${encodeURIComponent(metadata.shareToken)}`;
            }
            return sharePath;
        }

        const baseUrl = `${req.protocol}://${hostHeader}${sharePath}`;
        if (metadata.shareToken) {
            return `${baseUrl}?token=${encodeURIComponent(metadata.shareToken)}`;
        }
        return baseUrl;
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ApiRoutes;
