const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const FileUtils = require('./file-utils');

class BeamshareRoutes {
    constructor(fileMetadata, authMiddleware, usageService) {
        this.router = express.Router();
        this.fileMetadata = fileMetadata;
        this.authMiddleware = authMiddleware;
        this.usageService = usageService;
        this.uploadsRoot = path.join(__dirname, '..', 'uploads');
        this.setupRoutes();
    }

    setupRoutes() {
        this.router.use(this.authMiddleware.requireAuth);
        this.router.get('/files/:fileId/metadata', this.sendMetadata.bind(this));
        this.router.get('/files/:fileId/download', this.downloadFile.bind(this));
    }

    resolveClientIp(req) {
        const forwarded = (req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip'] || '')
            .split(',')
            .map((token) => token.trim())
            .find(Boolean);
        const raw = forwarded || req.ip || req.connection?.remoteAddress || '127.0.0.1';
        if (raw.startsWith('::ffff:')) {
            return raw.slice(7);
        }
        if (raw === '::1') {
            return '127.0.0.1';
        }
        return raw;
    }

    async resolveOwnedFile(req, res) {
        const fileId = decodeURIComponent(req.params.fileId || '');
        if (!fileId) {
            res.status(400).json({ error: 'Missing file identifier' });
            return null;
        }

        const metadata = await this.fileMetadata.getFileMetadataForUser(req.user.userId, fileId);
        if (!metadata) {
            res.status(404).json({ error: 'File not found' });
            return null;
        }

        const filePath = this.getFilePath(metadata);
        if (!FileUtils.fileExists(filePath)) {
            await this.fileMetadata.removeFile(req.user.userId, fileId);
            res.status(404).json({ error: 'File data missing' });
            return null;
        }

        if (this.usageService) {
            const usageResult = await this.usageService.assertAndConsume({
                plan: req.user?.plan || 'basic',
                userId: req.user?.userId,
                clientKey: this.resolveClientIp(req)
            });

            if (!usageResult.allowed) {
                res.status(429).json({
                    error: usageResult.message || 'Đã đạt giới hạn BeamShare cho gói của bạn.',
                    resetAt: usageResult.resetAt
                });
                return null;
            }

            req.beamshareUsage = usageResult;
        }

        return { metadata, filePath };
    }

    async sendMetadata(req, res) {
        try {
            const resolved = await this.resolveOwnedFile(req, res);
            if (!resolved) {
                return;
            }

            const { metadata, filePath } = resolved;
            const stats = FileUtils.getFileStats(filePath);
            const typeInfo = FileUtils.getFileTypeInfo(metadata.originalName);

            res.json({
                id: metadata.internalName,
                displayName: metadata.displayName,
                originalName: metadata.originalName,
                size: stats?.size ?? metadata.size,
                formattedSize: FileUtils.formatFileSize(stats?.size ?? metadata.size ?? 0),
                mimeType: metadata.mimeType || typeInfo.mimeType,
                uploadDate: metadata.uploadDate,
                lastModified: stats?.mtime ?? metadata.lastModified,
                visibility: metadata.visibility,
                isImage: typeInfo.isImage,
                isVideo: typeInfo.isVideo,
                isAudio: typeInfo.isAudio,
                extension: typeInfo.extension
            });
        } catch (error) {
            console.error('Beamshare metadata error:', error);
            res.status(500).json({ error: 'Unable to load BeamShare file metadata' });
        }
    }

    async downloadFile(req, res) {
        try {
            const resolved = await this.resolveOwnedFile(req, res);
            if (!resolved) {
                return;
            }

            const { metadata, filePath } = resolved;
            const stats = FileUtils.getFileStats(filePath);

            res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
            if (stats?.size) {
                res.setHeader('Content-Length', stats.size);
            }
            res.setHeader('Content-Type', metadata.mimeType || mime.lookup(metadata.originalName) || 'application/octet-stream');

            const stream = fs.createReadStream(filePath);
            stream.on('error', (streamError) => {
                console.error('Beamshare download stream error:', streamError);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Unable to download BeamShare file' });
                } else {
                    res.destroy(streamError);
                }
            });
            stream.pipe(res);
        } catch (error) {
            console.error('Beamshare download error:', error);
            res.status(500).json({ error: 'Unable to download BeamShare file' });
        }
    }

    getFilePath(metadata) {
        return path.join(this.uploadsRoot, metadata.storagePath);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = BeamshareRoutes;
