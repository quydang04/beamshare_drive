const express = require('express');
const path = require('path');
const FileUtils = require('./file-utils');

function normalizeInputId(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const stringValue = String(value);
    try {
        return decodeURIComponent(stringValue);
    } catch (_error) {
        return stringValue;
    }
}

function buildRecycleItem(doc) {
    return {
        internalName: doc.internalName,
        displayName: doc.displayName,
        originalName: doc.originalName,
        size: doc.size,
        formattedSize: FileUtils.formatFileSize(doc.size || 0),
        deletedAt: doc.deletedAt,
        recycleExpiresAt: doc.recycleExpiresAt
    };
}

function getFilePath(uploadsRoot, metadata) {
    return path.join(uploadsRoot, metadata.storagePath);
}

function createRecycleApi({ fileMetadata, authMiddleware, uploadsRoot }) {
    if (!fileMetadata || !uploadsRoot) {
        throw new Error('createRecycleApi requires fileMetadata and uploadsRoot');
    }

    const router = express.Router();

    if (authMiddleware?.requireAuth) {
        router.use(authMiddleware.requireAuth);
    }

    async function restoreFileRecord(userId, internalName) {
        if (!internalName) {
            return {
                success: false,
                code: 'invalid_id',
                error: 'Invalid file identifier'
            };
        }

        const deletedMetadata = await fileMetadata.findDeletedFile(userId, internalName);
        if (!deletedMetadata) {
            return {
                success: false,
                code: 'not_found',
                error: 'File not found in recycle bin',
                internalName
            };
        }

        const filePath = getFilePath(uploadsRoot, deletedMetadata);
        if (!FileUtils.fileExists(filePath)) {
            await fileMetadata.removeFile(userId, internalName);
            return {
                success: false,
                code: 'missing_data',
                error: 'File data no longer exists',
                internalName,
                displayName: deletedMetadata.displayName
            };
        }

        const restored = await fileMetadata.restoreFromRecycleBin(userId, internalName);
        if (!restored) {
            return {
                success: false,
                code: 'restore_failed',
                error: 'Failed to restore file',
                internalName,
                displayName: deletedMetadata.displayName
            };
        }

        return {
            success: true,
            internalName: restored.internalName,
            displayName: restored.displayName
        };
    }

    async function deleteFileRecord(userId, internalName) {
        if (!internalName) {
            return {
                success: false,
                code: 'invalid_id',
                error: 'Invalid file identifier'
            };
        }

        const deletedMetadata = await fileMetadata.findDeletedFile(userId, internalName);
        if (!deletedMetadata) {
            return {
                success: false,
                code: 'not_found',
                error: 'File not found in recycle bin',
                internalName
            };
        }

        const filePath = getFilePath(uploadsRoot, deletedMetadata);
        if (FileUtils.fileExists(filePath)) {
            try {
                FileUtils.deleteFile(filePath);
            } catch (error) {
                console.error(`Failed to delete file "${internalName}" from storage:`, error);
                return {
                    success: false,
                    code: 'filesystem_error',
                    error: 'Unable to delete file data',
                    internalName,
                    displayName: deletedMetadata.displayName
                };
            }
        }

        await fileMetadata.removeFile(userId, internalName);

        return {
            success: true,
            internalName,
            displayName: deletedMetadata.displayName
        };
    }

    router.get('/', async (req, res) => {
        try {
            const userId = req.user.userId;
            const documents = await fileMetadata.listRecycleBin(userId);
            const files = documents.map(buildRecycleItem);
            res.json({ files });
        } catch (error) {
            console.error('Recycle bin list error:', error);
            res.status(500).json({ error: 'Failed to load recycle bin' });
        }
    });

    router.post('/bulk/restore', async (req, res) => {
        try {
            const { files } = req.body || {};
            if (!Array.isArray(files) || !files.length) {
                return res.status(400).json({ error: 'Danh sách tệp không hợp lệ' });
            }

            const uniqueIds = Array.from(new Set(files.map(normalizeInputId))).filter(Boolean);
            if (!uniqueIds.length) {
                return res.status(400).json({ error: 'Không có tệp hợp lệ để khôi phục' });
            }

            const results = [];
            let restored = 0;
            let failed = 0;

            for (const internalName of uniqueIds) {
                try {
                    const result = await restoreFileRecord(req.user.userId, internalName);
                    if (result.success) {
                        restored += 1;
                    } else {
                        failed += 1;
                    }

                    results.push({
                        fileId: internalName,
                        displayName: result.displayName || null,
                        success: result.success,
                        error: result.success ? null : (result.error || 'Failed to restore file'),
                        code: result.code || null
                    });
                } catch (error) {
                    console.error('Recycle bulk restore item error:', error);
                    failed += 1;
                    results.push({
                        fileId: internalName,
                        displayName: null,
                        success: false,
                        error: 'Unexpected error while restoring file',
                        code: 'unexpected_error'
                    });
                }
            }

            res.json({
                success: true,
                restored,
                failed,
                results
            });
        } catch (error) {
            console.error('Recycle bulk restore error:', error);
            res.status(500).json({ error: 'Failed to restore selected files' });
        }
    });

    router.post('/bulk/delete', async (req, res) => {
        try {
            const { files } = req.body || {};
            if (!Array.isArray(files) || !files.length) {
                return res.status(400).json({ error: 'Danh sách tệp không hợp lệ' });
            }

            const uniqueIds = Array.from(new Set(files.map(normalizeInputId))).filter(Boolean);
            if (!uniqueIds.length) {
                return res.status(400).json({ error: 'Không có tệp hợp lệ để xóa' });
            }

            const results = [];
            let deleted = 0;
            let failed = 0;

            for (const internalName of uniqueIds) {
                try {
                    const result = await deleteFileRecord(req.user.userId, internalName);
                    if (result.success) {
                        deleted += 1;
                    } else {
                        failed += 1;
                    }

                    results.push({
                        fileId: internalName,
                        displayName: result.displayName || null,
                        success: result.success,
                        error: result.success ? null : (result.error || 'Failed to delete file'),
                        code: result.code || null
                    });
                } catch (error) {
                    console.error('Recycle bulk delete item error:', error);
                    failed += 1;
                    results.push({
                        fileId: internalName,
                        displayName: null,
                        success: false,
                        error: 'Unexpected error while deleting file',
                        code: 'unexpected_error'
                    });
                }
            }

            res.json({
                success: true,
                deleted,
                failed,
                results
            });
        } catch (error) {
            console.error('Recycle bulk delete error:', error);
            res.status(500).json({ error: 'Failed to delete selected files' });
        }
    });

    router.post('/:filename/restore', async (req, res) => {
        try {
            const internalName = normalizeInputId(req.params.filename);
            const result = await restoreFileRecord(req.user.userId, internalName);

            if (!result.success) {
                const status = result.code === 'not_found' || result.code === 'missing_data' ? 404 : 500;
                return res.status(status).json({ error: result.error || 'Failed to restore file' });
            }

            res.json({
                success: true,
                message: 'File restored successfully',
                file: {
                    internalFilename: result.internalName,
                    displayName: result.displayName
                }
            });
        } catch (error) {
            console.error('Recycle restore error:', error);
            res.status(500).json({ error: 'Failed to restore file' });
        }
    });

    router.delete('/:filename', async (req, res) => {
        try {
            const internalName = normalizeInputId(req.params.filename);
            const result = await deleteFileRecord(req.user.userId, internalName);

            if (!result.success) {
                const status = result.code === 'not_found' ? 404 : 500;
                return res.status(status).json({ error: result.error || 'Failed to delete file permanently' });
            }

            res.json({
                success: true,
                message: 'File deleted permanently',
                file: {
                    internalFilename: result.internalName,
                    displayName: result.displayName
                }
            });
        } catch (error) {
            console.error('Recycle delete error:', error);
            res.status(500).json({ error: 'Failed to delete file permanently' });
        }
    });

    return router;
}

module.exports = createRecycleApi;
