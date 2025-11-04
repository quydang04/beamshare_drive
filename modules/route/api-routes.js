const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const FileUtils = require('../file-utils');
const createRecycleApi = require('../recycle-api');
const fsp = fs.promises;
const FolderManager = require('../models/folder.js');

class ApiRoutes {
    constructor(fileMetadata, uploadHandler, conflictHandler, authMiddleware) {
        this.router = express.Router();
        this.fileMetadata = fileMetadata;
        this.uploadHandler = uploadHandler;
        this.conflictHandler = conflictHandler;
        this.authMiddleware = authMiddleware;
        this.uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
        this.recycleRetentionDays = 30;
        this.recycleRetentionMs = this.recycleRetentionDays * 24 * 60 * 60 * 1000;
        this.folderManager = new FolderManager();
        this.setupRoutes();
    }

    normalizeFolderId(raw) {
        if (raw === null || raw === undefined) {
            return null;
        }

        const stringValue = String(raw).trim();
        if (!stringValue || stringValue.toLowerCase() === 'null' || stringValue.toLowerCase() === 'undefined') {
            return null;
        }

        return stringValue;
    }

    setupRoutes() {
        this.router.use(this.authMiddleware.requireAuth);

        const recycleRouter = createRecycleApi({
            fileMetadata: this.fileMetadata,
            authMiddleware: this.authMiddleware,
            uploadsRoot: this.uploadsRoot
        });
        this.router.use('/recycle-bin', recycleRouter);

        this.router.get('/files', this.getFiles.bind(this));
        this.router.post('/files/check-exists', this.checkFileExists.bind(this));
        this.router.post('/files/check-conflict', this.checkFileConflict.bind(this));
        this.router.post('/files/get-details', this.getFileDetailsByName.bind(this));
        this.router.get('/files/:filename/details', this.getFileDetailsById.bind(this));
        this.router.post('/files/resolve-conflicts', this.resolveConflicts.bind(this));
        this.router.post('/files/transfer', this.transferFiles.bind(this));

        this.router.post('/upload', this.uploadHandler.array('files', 10), this.uploadMultiple.bind(this));
        this.router.post('/upload-single', this.uploadHandler.single('file'), this.uploadSingle.bind(this));

        this.router.get('/download/:filename', this.downloadFile.bind(this));
        this.router.get('/preview/:filename', this.previewFile.bind(this));
        this.router.delete('/files/:filename', this.deleteFile.bind(this));
        this.router.put('/files/:filename', this.renameFile.bind(this));
        this.router.patch('/files/:filename/share', this.updateShareState.bind(this));

        this.router.get('/folders', this.listFolders.bind(this));
        this.router.post('/folders', this.createFolder.bind(this));
        this.router.put('/folders/:folderId', this.renameFolder.bind(this));
        this.router.delete('/folders/:folderId', this.deleteFolder.bind(this));
    }

    async getFiles(req, res) {
        try {
            const userId = req.user.userId;
            const parentFolderId = this.normalizeFolderId(req.query.folderId);
            let parentFolder = null;
            if (parentFolderId) {
                parentFolder = await this.folderManager.getFolderById(userId, parentFolderId);
                if (!parentFolder) {
                    return res.status(404).json({ error: 'Folder not found' });
                }
            }
            const documents = await this.fileMetadata.listFilesForUser(userId, { parentFolderId });
            const folders = await this.folderManager.listFolders(userId, parentFolderId || null);
            const summaries = [];

            for (const doc of documents) {
                const summary = await this.toFileSummary(doc);
                if (summary) {
                    summaries.push(summary);
                }
            }

            summaries.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
            res.json({
                currentFolder: parentFolder ? {
                    id: parentFolder._id.toString(),
                    name: parentFolder.name,
                    parentId: parentFolder.parentId ? parentFolder.parentId.toString() : null,
                    path: parentFolder.path
                } : null,
                breadcrumbs: parentFolder ? await this.#buildFolderBreadcrumbs(userId, parentFolder) : [],
                files: summaries,
                folders: folders.map(folder => ({
                    id: folder._id.toString(),
                    name: folder.name,
                    parentId: folder.parentId ? folder.parentId.toString() : null,
                    path: folder.path
                }))
            });
        } catch (error) {
            console.error('Error getting files:', error);
            res.status(500).json({ error: 'Failed to get files' });
        }
    }

    async checkFileExists(req, res) {
        try {
            const { filename, folderId = null } = req.body || {};
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const normalizedFolderId = this.normalizeFolderId(folderId);

            const exists = await this.fileMetadata.displayNameExists(req.user.userId, filename, normalizedFolderId);
            if (!exists) {
                return res.json({ exists: false });
            }

            const internalName = await this.fileMetadata.getInternalFilename(
                req.user.userId,
                filename,
                normalizedFolderId
            );
            return res.json({ exists: true, internalFilename: internalName, displayName: filename });
        } catch (error) {
            console.error('Error checking file existence:', error);
            res.status(500).json({ error: 'Failed to check file existence' });
        }
    }

    async checkFileConflict(req, res) {
        try {
            const { filename, fileSize, fileType, folderId = null } = req.body || {};
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const normalizedFolderId = this.normalizeFolderId(folderId);

            const conflictInfo = await this.conflictHandler.checkFileConflict(
                req.user.userId,
                filename,
                normalizedFolderId,
                fileSize,
                fileType
            );

            if (!conflictInfo.hasConflict) {
                return res.json({ hasConflict: false });
            }

            const suggestions = await this.conflictHandler.generateFilenameSuggestions(
                req.user.userId,
                filename,
                normalizedFolderId
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
            const { filename, folderId = null } = req.body || {};
            if (!filename) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const normalizedFolderId = this.normalizeFolderId(folderId);

            const internalName = await this.fileMetadata.getInternalFilename(
                req.user.userId,
                filename,
                normalizedFolderId
            );
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

                const conflictFolderId = conflict?.folderId || null;

                if (resolution.action === 'auto_rename') {
                    resolvedName = await this.conflictHandler.generateUniqueFilename(
                        req.user.userId,
                        conflict.filename,
                        conflictFolderId
                    );
                } else if (resolution.action === 'rename') {
                    const targetName = resolution.newName.trim();
                    const exists = await this.fileMetadata.displayNameExists(
                        req.user.userId,
                        targetName,
                        conflictFolderId
                    );
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
                    resolvedName,
                    folderId: conflictFolderId
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

                    const folderField = Array.isArray(body.folderId)
                        ? body.folderId[files.indexOf(file)]
                        : (body.folderId || body.parentFolderId || body.targetFolderId);
                    const parentFolderId = this.normalizeFolderId(folderField);

                    const autoResolve = String(body.autoResolve).toLowerCase() === 'true';

                    let displayName = requestedName || file.originalname;

                    const conflictInfo = await this.conflictHandler.checkFileConflict(
                        userId,
                        displayName,
                        parentFolderId,
                        file.size,
                        file.mimetype
                    );

                    if (conflictInfo.hasConflict && !conflictAction) {
                        if (autoResolve) {
                            displayName = await this.conflictHandler.generateUniqueFilename(
                                userId,
                                displayName,
                                parentFolderId
                            );
                        } else {
                            FileUtils.deleteFile(file.path);
                            conflicts.push({
                                filename: file.originalname,
                                conflictType: conflictInfo.type,
                                existingFile: conflictInfo.existingFile,
                                folderId: parentFolderId,
                                suggestions: await this.conflictHandler.generateFilenameSuggestions(
                                    userId,
                                    displayName,
                                    parentFolderId
                                )
                            });
                            continue;
                        }
                    }

                    if (conflictAction === 'replace') {
                        const existingName = await this.fileMetadata.getInternalFilename(
                            userId,
                            displayName,
                            parentFolderId
                        );
                        if (existingName) {
                            const existingMetadata = await this.fileMetadata.getFileMetadataForUser(userId, existingName);
                            if (existingMetadata) {
                                await this.removePhysicalFile(existingMetadata);
                                await this.fileMetadata.removeFile(userId, existingName);
                            }
                        }
                    } else if (conflictAction === 'rename') {
                        const newName = requestedName || displayName;
                        const exists = await this.fileMetadata.displayNameExists(
                            userId,
                            newName,
                            parentFolderId
                        );
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
                        displayName = await this.conflictHandler.generateUniqueFilename(
                            userId,
                            displayName,
                            parentFolderId
                        );
                    } else if (conflictAction === 'skip') {
                        FileUtils.deleteFile(file.path);
                        continue;
                    }

                    let storageName;

                    try {
                        storageName = await this.prepareUploadedFileStorage(userId, file, displayName);
                    } catch (preparationError) {
                        console.error('Finalize filename error:', preparationError);
                        errors.push({ filename: file.originalname, error: 'Unable to finalize filename' });
                        FileUtils.deleteFile(file.path);
                        continue;
                    }

                    const metadata = await this.fileMetadata.addFile({
                        userId,
                        parentFolderId,
                        displayName,
                        originalName: file.originalname,
                        storageName,
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

            const stats = FileUtils.getFileStats(filePath);
            const fileSize = stats?.size || 0;
            const mimeType = metadata.mimeType || mime.lookup(metadata.originalName) || 'application/octet-stream';

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
            res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Content-Type', mimeType);

            const rangeHeader = req.headers.range;
            if (rangeHeader && fileSize > 0) {
                const rangePrefix = 'bytes=';
                if (rangeHeader.startsWith(rangePrefix)) {
                    const [rawStart, rawEnd] = rangeHeader.slice(rangePrefix.length).split('-');
                    let start;
                    let end;

                    if (rawStart === '') {
                        const suffixLength = Number.parseInt(rawEnd, 10);
                        if (Number.isFinite(suffixLength) && suffixLength > 0) {
                            start = Math.max(fileSize - suffixLength, 0);
                            end = fileSize - 1;
                        }
                    } else {
                        start = Number.parseInt(rawStart, 10);
                        if (Number.isNaN(start) || start < 0) {
                            start = 0;
                        }

                        if (rawEnd === '') {
                            end = fileSize - 1;
                        } else {
                            end = Number.parseInt(rawEnd, 10);
                            if (Number.isNaN(end) || end < start) {
                                end = fileSize - 1;
                            }
                        }
                    }

                    if (typeof start === 'number' && typeof end === 'number') {
                        start = Math.min(start, fileSize - 1);
                        end = Math.min(Math.max(end, start), fileSize - 1);
                        const chunkSize = end - start + 1;

                        res.status(206);
                        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
                        res.setHeader('Content-Length', chunkSize);

                        fs.createReadStream(filePath, { start, end }).pipe(res);
                        return;
                    }
                }
            }

            if (fileSize > 0) {
                res.setHeader('Content-Length', fileSize);
            }

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
            const exists = await this.fileMetadata.displayNameExists(
                req.user.userId,
                sanitized,
                metadata.parentFolderId || null
            );
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

    async transferFiles(req, res) {
        try {
            const { action, fileIds, targetFolderId = null } = req.body || {};
            const normalizedAction = String(action || '').toLowerCase();
            if (!['move', 'copy'].includes(normalizedAction)) {
                return res.status(400).json({ error: 'Unsupported transfer action' });
            }

            if (!Array.isArray(fileIds) || !fileIds.length) {
                return res.status(400).json({ error: 'No files specified' });
            }

            const userId = req.user.userId;
            const normalizedFolderId = this.normalizeFolderId(targetFolderId);
            let folderDetails = null;
            if (normalizedFolderId) {
                folderDetails = await this.folderManager.getFolderById(userId, normalizedFolderId);
                if (!folderDetails) {
                    return res.status(404).json({ error: 'Target folder not found' });
                }
            }

            const results = [];
            const errors = [];

            for (const fileId of fileIds) {
                const internalName = String(fileId || '').trim();
                if (!internalName) {
                    errors.push({ fileId, error: 'Invalid file identifier' });
                    continue;
                }

                const metadata = await this.fileMetadata.getFileMetadataForUser(userId, internalName);
                if (!metadata || metadata.isDeleted) {
                    errors.push({ fileId, error: 'File not found' });
                    continue;
                }

                try {
                    if (normalizedAction === 'move') {
                        const result = await this.#moveFileToFolder(metadata, normalizedFolderId);
                        results.push(result);
                    } else if (normalizedAction === 'copy') {
                        const result = await this.#copyFileToFolder(metadata, normalizedFolderId);
                        results.push(result);
                    }
                } catch (operationError) {
                    console.error(`Transfer error for ${internalName}:`, operationError);
                    errors.push({ fileId: internalName, error: operationError.message });
                }
            }

            res.json({
                success: errors.length === 0,
                results,
                errors
            });
        } catch (error) {
            console.error('Transfer error:', error);
            res.status(500).json({ error: 'Failed to transfer files' });
        }
    }

    async listFolders(req, res) {
        try {
            const userId = req.user.userId;
            const parentId = this.normalizeFolderId(req.query.parentId);
            if (parentId) {
                const exists = await this.folderManager.getFolderById(userId, parentId);
                if (!exists) {
                    return res.status(404).json({ error: 'Folder not found' });
                }
            }

            const folders = await this.folderManager.listFolders(userId, parentId || null);
            res.json(folders.map(folder => ({
                id: folder._id.toString(),
                name: folder.name,
                parentId: folder.parentId ? folder.parentId.toString() : null,
                path: folder.path
            })));
        } catch (error) {
            console.error('List folders error:', error);
            res.status(500).json({ error: 'Failed to list folders' });
        }
    }

    async createFolder(req, res) {
        try {
            const userId = req.user.userId;
            const { name, parentId = null } = req.body || {};
            const normalizedParentId = this.normalizeFolderId(parentId);

            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Folder name is required' });
            }

            if (normalizedParentId) {
                const parentFolder = await this.folderManager.getFolderById(userId, normalizedParentId);
                if (!parentFolder) {
                    return res.status(404).json({ error: 'Parent folder not found' });
                }
            }

            let created;
            try {
                created = await this.folderManager.createFolder({
                    userId,
                    name: name.trim(),
                    parentId: normalizedParentId
                });
            } catch (creationError) {
                if (creationError.code === 11000 || creationError.code === 'FOLDER_NAME_CONFLICT') {
                    return res.status(409).json({ error: 'Folder name already exists in this location' });
                }
                throw creationError;
            }

            res.status(201).json({
                success: true,
                folder: {
                    id: created._id.toString(),
                    name: created.name,
                    parentId: created.parentId ? created.parentId.toString() : null,
                    path: created.path
                }
            });
        } catch (error) {
            console.error('Create folder error:', error);
            res.status(500).json({ error: 'Failed to create folder' });
        }
    }

    async renameFolder(req, res) {
        try {
            const userId = req.user.userId;
            const folderId = req.params.folderId;
            const { name } = req.body || {};

            const normalizedFolderId = this.normalizeFolderId(folderId);
            if (!normalizedFolderId) {
                return res.status(400).json({ error: 'Invalid folder identifier' });
            }

            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Folder name is required' });
            }

            try {
                const renamed = await this.folderManager.renameFolder(userId, normalizedFolderId, name.trim());
                if (!renamed) {
                    return res.status(404).json({ error: 'Folder not found' });
                }

                res.json({
                    success: true,
                    folder: {
                        id: renamed._id.toString(),
                        name: renamed.name,
                        parentId: renamed.parentId ? renamed.parentId.toString() : null,
                        path: renamed.path
                    }
                });
            } catch (renameError) {
                if (renameError.code === 11000 || renameError.code === 'FOLDER_NAME_CONFLICT') {
                    return res.status(409).json({ error: 'Folder name already exists in this location' });
                }
                throw renameError;
            }
        } catch (error) {
            console.error('Rename folder error:', error);
            res.status(500).json({ error: 'Failed to rename folder' });
        }
    }

    async deleteFolder(req, res) {
        try {
            const userId = req.user.userId;
            const folderId = this.normalizeFolderId(req.params.folderId);
            if (!folderId) {
                return res.status(400).json({ error: 'Invalid folder identifier' });
            }

            const folder = await this.folderManager.getFolderById(userId, folderId);
            if (!folder) {
                return res.status(404).json({ error: 'Folder not found' });
            }

            const recycleResults = await this.#recycleFolderHierarchy(userId, folderId);
            await this.folderManager.markDeleted(userId, folderId);

            res.json({
                success: true,
                removedFolderId: folderId,
                recycledFiles: recycleResults.files,
                recycleErrors: recycleResults.errors
            });
        } catch (error) {
            console.error('Delete folder error:', error);
            res.status(500).json({ error: 'Failed to delete folder' });
        }
    }

    async #buildFolderBreadcrumbs(userId, folder) {
        const breadcrumbs = [];
        let current = folder;

        while (current) {
            breadcrumbs.push({
                id: current._id.toString(),
                name: current.name,
                parentId: current.parentId ? current.parentId.toString() : null,
                path: current.path
            });

            if (!current.parentId) {
                break;
            }

            current = await this.folderManager.getFolderById(userId, current.parentId.toString());
        }

        return breadcrumbs.reverse();
    }

    async #moveFileToFolder(metadata, targetFolderId) {
        const userId = metadata.userId;
        const currentFolderId = metadata.parentFolderId ? metadata.parentFolderId.toString() : null;
        const normalizedTarget = this.normalizeFolderId(targetFolderId);

        if (currentFolderId === normalizedTarget) {
            return {
                fileId: metadata.internalName,
                action: 'move',
                folderId: normalizedTarget,
                displayName: metadata.displayName,
                renamed: false,
                status: 'unchanged'
            };
        }

        let finalName = metadata.displayName;
        const nameConflict = await this.fileMetadata.displayNameExists(userId, finalName, normalizedTarget);
        let renamed = false;
        if (nameConflict) {
            finalName = await this.conflictHandler.generateUniqueFilename(userId, finalName, normalizedTarget);
            renamed = finalName !== metadata.displayName;
        }

        const updated = await this.fileMetadata.updateLocation(userId, metadata.internalName, {
            parentFolderId: normalizedTarget,
            displayName: renamed ? finalName : null
        });

        return {
            fileId: updated.internalName,
            action: 'move',
            folderId: normalizedTarget,
            displayName: updated.displayName,
            renamed,
            status: 'moved'
        };
    }

    async #copyFileToFolder(metadata, targetFolderId) {
        const userId = metadata.userId;
        const normalizedTarget = this.normalizeFolderId(targetFolderId);

        const sourcePath = this.getFilePath(metadata);
        if (!FileUtils.fileExists(sourcePath)) {
            throw new Error('Source file is missing');
        }

        let displayName = metadata.displayName;
        const nameConflict = await this.fileMetadata.displayNameExists(userId, displayName, normalizedTarget);
        let renamed = false;
        if (nameConflict) {
            displayName = await this.conflictHandler.generateUniqueFilename(userId, displayName, normalizedTarget);
            renamed = displayName !== metadata.displayName;
        }

        const storageName = await this.generateAvailableStorageName(userId, metadata.storageName, null);
        const destinationPath = path.join(this.uploadsRoot, userId, storageName);
        await fsp.copyFile(sourcePath, destinationPath);

        let size = metadata.size;
        try {
            const stats = await fsp.stat(destinationPath);
            size = stats.size;
        } catch (statError) {
            console.warn('Unable to resolve copied file size, falling back to metadata', statError);
        }

        const newMetadata = await this.fileMetadata.addFile({
            userId,
            parentFolderId: normalizedTarget,
            displayName,
            originalName: metadata.originalName,
            storageName,
            size,
            mimeType: metadata.mimeType,
            checksum: metadata.checksum,
            visibility: metadata.visibility
        });

        return {
            fileId: newMetadata.internalName,
            action: 'copy',
            folderId: normalizedTarget,
            displayName: newMetadata.displayName,
            renamed,
            sourceId: metadata.internalName,
            status: 'copied'
        };
    }

    async #recycleFolderHierarchy(userId, folderId) {
        const files = [];
        const errors = [];
        const stack = [folderId];
        const recycleExpiresAt = new Date(Date.now() + this.recycleRetentionMs);

        while (stack.length) {
            const currentId = stack.pop();
            const childFolders = await this.folderManager.listFolders(userId, currentId);
            for (const child of childFolders) {
                stack.push(child._id.toString());
            }

            const folderFiles = await this.fileMetadata.listFilesForUser(userId, { parentFolderId: currentId });
            for (const file of folderFiles) {
                try {
                    const updated = await this.fileMetadata.moveToRecycleBin(userId, file.internalName, recycleExpiresAt);
                    files.push({
                        internalName: file.internalName,
                        displayName: file.displayName,
                        folderId: currentId,
                        recycle: {
                            deletedAt: updated?.deletedAt || new Date(),
                            recycleExpiresAt: updated?.recycleExpiresAt || recycleExpiresAt
                        }
                    });
                } catch (fileError) {
                    console.error(`Unable to recycle file ${file.internalName}:`, fileError);
                    errors.push({ fileId: file.internalName, error: fileError.message });
                }
            }
        }

        return { files, errors };
    }

    resolveDesiredStorageName(file, displayName) {
        const candidates = [];

        if (displayName && typeof displayName === 'string') {
            candidates.push(displayName);
        }

        if (file?.originalname && typeof file.originalname === 'string') {
            candidates.push(file.originalname);
        }

        for (const candidate of candidates) {
            const sanitized = FileUtils.sanitizeFilename(candidate);
            if (sanitized && sanitized.trim()) {
                return sanitized;
            }
        }

        const fallbackExt = file?.originalname ? path.extname(file.originalname) : '';
        return `uploaded-file${fallbackExt}`;
    }

    async prepareUploadedFileStorage(userId, file, displayName) {
        if (!file || !file.path) {
            throw new Error('Uploaded file payload is invalid');
        }

        const desiredName = this.resolveDesiredStorageName(file, displayName);
        const finalName = await this.generateAvailableStorageName(userId, desiredName, file.filename);

        if (finalName !== file.filename) {
            const currentPath = file.path;
            const targetPath = path.join(this.uploadsRoot, userId, finalName);
            await fsp.rename(currentPath, targetPath);
            file.path = targetPath;
            file.filename = finalName;
        }

        return finalName;
    }

    async generateAvailableStorageName(userId, desiredName, currentFilename) {
        const uploadsDir = path.join(this.uploadsRoot, userId);
        const ext = path.extname(desiredName);
        const base = path.basename(desiredName, ext) || 'file';
        let candidate = desiredName || `${base}${ext}`;
        let counter = 1;
        const maxAttempts = 1000;

        while (await this.storageFileExists(uploadsDir, candidate, currentFilename)) {
            if (counter > maxAttempts) {
                const timestampCandidate = `${base}-${Date.now()}${ext}`;
                if (!(await this.storageFileExists(uploadsDir, timestampCandidate, currentFilename))) {
                    candidate = timestampCandidate;
                    break;
                }

                const randomFallback = `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
                candidate = randomFallback;
                break;
            }

            candidate = `${base} (${counter})${ext}`;
            counter += 1;
        }

        return candidate;
    }

    async storageFileExists(dirPath, filename, currentFilename) {
        if (!filename || filename === currentFilename) {
            return false;
        }

        try {
            await fsp.access(path.join(dirPath, filename));
            return true;
        } catch (_error) {
            return false;
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
