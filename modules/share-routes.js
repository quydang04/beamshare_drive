const express = require('express');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const FileUtils = require('./file-utils');
const { resolvePlan } = require('./constants/plans');

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

            const user = req.user;
            const isOwner = Boolean(user && user.userId === metadata.userId);
            const token = req.query.token || req.headers['x-share-token'];
            const hasToken = typeof token === 'string' && token.length > 0;

            if (metadata.visibility === 'private') {
                if (!user) {
                    return res.status(401).json({ error: 'Bạn cần đăng nhập để truy cập file này' });
                }
                if (!isOwner) {
                    return res.status(403).json({ error: 'Bạn không có quyền truy cập file này' });
                }
            } else if (!isOwner && metadata.shareToken) {
                if (!hasToken || token !== metadata.shareToken) {
                    return res.status(403).json({ error: 'Liên kết chia sẻ không hợp lệ' });
                }
            }

            req.shareMetadata = metadata;
            req.shareIsOwner = isOwner;

            if (String(req.query.beamshare).toLowerCase() === '1') {
                if (!req.user) {
                    return res.status(401).json({ error: 'Bạn cần đăng nhập để sử dụng BeamShare.' });
                }

                const plan = resolvePlan(req.user.plan || 'basic');
                const rawFileLimit = Number(plan?.beamshare?.fileSizeLimitBytes);
                const fileSizeLimitBytes = Number.isFinite(rawFileLimit) && rawFileLimit > 0 ? rawFileLimit : null;

                if (fileSizeLimitBytes) {
                    const filePath = this.getFilePath(metadata);
                    const stats = FileUtils.getFileStats(filePath);
                    const fileSize = stats?.size ?? metadata.size ?? 0;
                    if (fileSize > fileSizeLimitBytes) {
                        const limitLabel = FileUtils.formatFileSize(fileSizeLimitBytes);
                        return res.status(413).json({
                            error: limitLabel
                                ? `File vượt quá giới hạn ${limitLabel} cho BeamShare trong gói của bạn.`
                                : 'File vượt quá giới hạn BeamShare cho gói của bạn.'
                        });
                    }
                    req.shareFileStats = stats;
                }
            }

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

            const stats = req.shareFileStats || FileUtils.getFileStats(filePath);
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

            const stats = req.shareFileStats || FileUtils.getFileStats(filePath);
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

module.exports = ShareRoutes;
