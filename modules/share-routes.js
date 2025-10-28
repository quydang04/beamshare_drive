const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const FileUtils = require('./file-utils');

class ShareRoutes {
    constructor(fileMetadata, authMiddleware) {
        this.router = express.Router();
        this.fileMetadata = fileMetadata;
        this.authMiddleware = authMiddleware;
        this.uploadsRoot = path.join(__dirname, '..', 'uploads');
        this.setupRoutes();
    }

    setupRoutes() {
        this.router.get('/:fileId/metadata', this.authMiddleware.optionalAuth, this.ensureAccess.bind(this), this.sendMetadata.bind(this));
        this.router.get('/:fileId/preview', this.authMiddleware.optionalAuth, this.ensureAccess.bind(this), this.previewFile.bind(this));
        this.router.get('/:fileId/download', this.authMiddleware.optionalAuth, this.ensureAccess.bind(this), this.downloadFile.bind(this));
    }

    async ensureAccess(req, res, next) {
        try {
            const fileId = decodeURIComponent(req.params.fileId);
            const metadata = await this.fileMetadata.getFileMetadataByInternal(fileId);

            if (!metadata) {
                return res.status(404).json({ error: 'File not found' });
            }

            const isOwner = req.user && req.user.userId === metadata.userId;
            const token = req.query.token || req.headers['x-share-token'];

            if (metadata.visibility === 'private' && !isOwner) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (!isOwner && metadata.visibility === 'public') {
                if (metadata.shareToken && token && token !== metadata.shareToken) {
                    return res.status(403).json({ error: 'Invalid share token' });
                }
                if (metadata.shareToken && !token) {
                    // Token required for non-owner access when token exists
                    return res.status(403).json({ error: 'Share token required' });
                }
            }

            req.shareMetadata = metadata;
            req.shareIsOwner = isOwner;
            next();
        } catch (error) {
            console.error('Share access error:', error);
            res.status(500).json({ error: 'Unable to access shared file' });
        }
    }

    async sendMetadata(req, res) {
        try {
            const metadata = req.shareMetadata;
            const filePath = this.getFilePath(metadata);

            if (!FileUtils.fileExists(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            const stats = FileUtils.getFileStats(filePath);
            const typeInfo = FileUtils.getFileTypeInfo(metadata.originalName);
            const thumbnail = typeInfo.isImage ? FileUtils.generateThumbnail(filePath, metadata.mimeType || typeInfo.mimeType) : null;

            const payload = {
                id: metadata.internalName,
                displayName: metadata.displayName,
                originalName: metadata.originalName,
                size: stats?.size ?? metadata.size,
                formattedSize: FileUtils.formatFileSize(stats?.size ?? metadata.size ?? 0),
                mimeType: metadata.mimeType || typeInfo.mimeType,
                uploadDate: metadata.uploadDate,
                lastModified: metadata.lastModified,
                visibility: metadata.visibility,
                owner: metadata.userId,
                isOwner: req.shareIsOwner,
                isImage: typeInfo.isImage,
                isVideo: typeInfo.isVideo,
                isAudio: typeInfo.isAudio,
                extension: typeInfo.extension,
                thumbnail
            };

            if (req.shareIsOwner) {
                payload.shareToken = metadata.shareToken;
                payload.shareUrl = this.buildShareUrl(req, metadata);
            }

            res.json(payload);
        } catch (error) {
            console.error('Share metadata error:', error);
            res.status(500).json({ error: 'Unable to load file metadata' });
        }
    }

    async previewFile(req, res) {
        try {
            const metadata = req.shareMetadata;
            const filePath = this.getFilePath(metadata);

            if (!FileUtils.fileExists(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Content-Type', metadata.mimeType || mime.lookup(metadata.originalName) || 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=3600');

            return fs.createReadStream(filePath).pipe(res);
        } catch (error) {
            console.error('Share preview error:', error);
            res.status(500).json({ error: 'Unable to preview file' });
        }
    }

    async downloadFile(req, res) {
        try {
            const metadata = req.shareMetadata;
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

            return fs.createReadStream(filePath).pipe(res);
        } catch (error) {
            console.error('Share download error:', error);
            res.status(500).json({ error: 'Unable to download file' });
        }
    }

    getFilePath(metadata) {
        return path.join(this.uploadsRoot, metadata.storagePath);
    }

    buildShareUrl(req, metadata) {
        if (!metadata || metadata.visibility !== 'public' || !metadata.shareToken) {
            return null;
        }

        return `${req.protocol}://${req.get('host')}/file?driveFile=${encodeURIComponent(metadata.internalName)}&token=${encodeURIComponent(metadata.shareToken)}`;
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ShareRoutes;
