const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

class ConflictHandler {
    constructor(fileMetadata) {
        this.fileMetadata = fileMetadata;
        this.uploadsRoot = path.join(__dirname, '..', 'uploads');
    }

    async checkFileConflict(userId, displayName, newFileSize = null, newFileType = null) {
        const internalName = await this.fileMetadata.getInternalFilename(userId, displayName);

        if (!internalName) {
            return { hasConflict: false };
        }

        const existingMetadata = await this.fileMetadata.getFileMetadataForUser(userId, internalName);
        const existingFilePath = existingMetadata
            ? path.join(this.uploadsRoot, existingMetadata.storagePath)
            : null;

        let existingStats = null;
        let existingMimeType = null;

        try {
            if (existingFilePath && fs.existsSync(existingFilePath)) {
                existingStats = fs.statSync(existingFilePath);
                existingMimeType = mime.lookup(existingFilePath) || 'application/octet-stream';
            }
        } catch (error) {
            console.warn('Could not get existing file stats:', error);
        }

        const conflictInfo = {
            hasConflict: true,
            type: 'name_conflict',
            existingFile: {
                displayName: displayName,
                internalFilename: internalName,
                uploadDate: existingMetadata ? existingMetadata.uploadDate : (existingStats ? existingStats.birthtime.toISOString() : null),
                lastModified: existingMetadata ? existingMetadata.lastModified : (existingStats ? existingStats.mtime.toISOString() : null),
                size: existingStats ? existingStats.size : (existingMetadata ? existingMetadata.size : null),
                formattedSize: existingStats ? this.formatFileSize(existingStats.size) : (existingMetadata && existingMetadata.size ? this.formatFileSize(existingMetadata.size) : 'Unknown'),
                mimeType: existingMetadata ? existingMetadata.mimeType : existingMimeType,
                version: existingMetadata ? existingMetadata.version : 1,
                canBackup: Boolean(existingFilePath && existingStats),
                isImage: (existingMetadata && existingMetadata.mimeType) ? existingMetadata.mimeType.startsWith('image/') : (existingMimeType ? existingMimeType.startsWith('image/') : false),
                extension: path.extname(displayName).toLowerCase()
            },
            newFile: newFileSize !== null ? {
                size: newFileSize,
                formattedSize: this.formatFileSize(newFileSize),
                mimeType: newFileType,
                isImage: newFileType ? newFileType.startsWith('image/') : false,
                sizeDifference: existingStats ? newFileSize - existingStats.size : null,
                isLarger: existingStats ? newFileSize > existingStats.size : null
            } : null,
            recommendations: this.generateConflictRecommendations(displayName, existingStats, newFileSize, existingMimeType || (existingMetadata ? existingMetadata.mimeType : null), newFileType)
        };

        return conflictInfo;
    }

    // Generate intelligent recommendations for conflict resolution
    generateConflictRecommendations(displayName, existingStats, newFileSize, existingMimeType, newFileType) {
        const recommendations = [];

        // Size-based recommendations
        if (existingStats && newFileSize) {
            if (newFileSize > existingStats.size * 1.5) {
                recommendations.push({
                    action: 'replace',
                    reason: 'New file is significantly larger (better quality/more content)',
                    confidence: 'high'
                });
            } else if (newFileSize < existingStats.size * 0.5) {
                recommendations.push({
                    action: 'auto_rename',
                    reason: 'New file is much smaller (might be different version)',
                    confidence: 'medium'
                });
            }
        }

        // Type-based recommendations
        if (existingMimeType && newFileType && existingMimeType !== newFileType) {
            recommendations.push({
                action: 'auto_rename',
                reason: 'Different file types - likely different content',
                confidence: 'high'
            });
        }

        // Default recommendation
        if (recommendations.length === 0) {
            recommendations.push({
                action: 'auto_rename',
                reason: 'Safe option - keeps both files',
                confidence: 'medium'
            });
        }

        return recommendations;
    }

    // Enhanced unique filename generation with comprehensive edge case handling
    async generateUniqueFilename(userId, originalName) {
        const lastDotIndex = originalName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';

        const existingNumberMatch = nameWithoutExt.match(/^(.+?)\s*\((\d+)\)$/);
        const baseName = existingNumberMatch ? existingNumberMatch[1].trim() : nameWithoutExt;
        const startCounter = existingNumberMatch ? parseInt(existingNumberMatch[2], 10) + 1 : 1;

        let counter = startCounter;
        let newName = originalName;
        const maxAttempts = 10000;

        while (await this.fileMetadata.displayNameExists(userId, newName) && counter < maxAttempts) {
            newName = `${baseName} (${counter})${extension}`;
            counter++;
        }

        if (counter >= maxAttempts) {
            const timestamp = Date.now();
            newName = `${baseName}_${timestamp}${extension}`;

            if (await this.fileMetadata.displayNameExists(userId, newName)) {
                const randomSuffix = Math.random().toString(36).substring(2, 8);
                newName = `${baseName}_${timestamp}_${randomSuffix}${extension}`;
            }
        }

        this.logConflictAction('auto_rename', {
            userId,
            originalName,
            newName,
            counter: counter - startCounter,
            timestamp: new Date().toISOString()
        });

        return newName;
    }

    // Generate filename suggestions
    async generateFilenameSuggestions(userId, originalName) {
        const suggestions = [];
        const lastDotIndex = originalName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';

        for (let i = 1; i <= 5; i++) {
            const suggestion = `${nameWithoutExt} (${i})${extension}`;
            if (!(await this.fileMetadata.displayNameExists(userId, suggestion))) {
                suggestions.push(suggestion);
            }
        }

        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const timestampSuggestion = `${nameWithoutExt}_${timestamp}${extension}`;
        if (!(await this.fileMetadata.displayNameExists(userId, timestampSuggestion))) {
            suggestions.push(timestampSuggestion);
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        const dateSuggestion = `${nameWithoutExt}_${dateStr}${extension}`;
        if (!(await this.fileMetadata.displayNameExists(userId, dateSuggestion))) {
            suggestions.push(dateSuggestion);
        }

        return suggestions.slice(0, 5);
    }

    // Enhanced backup system with detailed metadata
    async createBackupFile(userId, internalFilename, displayName = null) {
        try {
            const backupDir = path.join(__dirname, '..', 'uploads', '.backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const metadata = await this.fileMetadata.getFileMetadataByInternal(internalFilename);
            const storagePath = metadata ? metadata.storagePath : path.join(userId, internalFilename);
            const filePath = path.join(__dirname, '..', 'uploads', storagePath);

            const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
            if (!stats) {
                throw new Error('Original file not found for backup');
            }

            // Create backup filename with original display name if available
            const originalDisplayName = displayName || (metadata ? metadata.displayName : internalFilename);
            const ext = path.extname(originalDisplayName);
            const nameWithoutExt = path.basename(originalDisplayName, ext);
            const backupName = `${nameWithoutExt}_backup_${timestamp}${ext}`;
            const backupPath = path.join(backupDir, backupName);

            // Copy file to backup location
            fs.copyFileSync(filePath, backupPath);

            // Create backup metadata
            const backupMetadata = {
                originalInternalName: internalFilename,
                originalDisplayName: originalDisplayName,
                backupDate: new Date().toISOString(),
                originalUploadDate: metadata && metadata.uploadDate ? metadata.uploadDate : stats.birthtime.toISOString(),
                originalSize: stats.size,
                backupReason: 'file_replacement',
                canRestore: true
            };

            // Save backup metadata
            const backupMetadataPath = path.join(backupDir, `${backupName}.meta.json`);
            fs.writeFileSync(backupMetadataPath, JSON.stringify(backupMetadata, null, 2));

            // Log backup action
            this.logConflictAction('backup_created', {
                originalFile: originalDisplayName,
                backupFile: backupName,
                timestamp: new Date().toISOString()
            });

            return {
                backupName,
                backupPath,
                metadata: backupMetadata
            };
        } catch (error) {
            console.error('Could not create backup:', error);
            this.logConflictAction('backup_failed', {
                originalFile: internalFilename,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return null;
        }
    }

    // Conflict action logging system
    logConflictAction(action, details) {
        try {
            const logDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const logFile = path.join(logDir, 'conflict-resolution.log');
            const logEntry = {
                timestamp: new Date().toISOString(),
                action: action,
                details: details,
                sessionId: this.generateSessionId()
            };

            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(logFile, logLine);

            // Also keep in-memory log for recent actions (for undo functionality)
            if (!global.recentActions) {
                global.recentActions = [];
            }
            global.recentActions.push(logEntry);

            // Keep only last 100 actions in memory
            if (global.recentActions.length > 100) {
                global.recentActions = global.recentActions.slice(-100);
            }

        } catch (error) {
            console.error('Failed to log conflict action:', error);
        }
    }

    // Generate session ID for tracking related actions
    generateSessionId() {
        if (!global.currentSessionId) {
            global.currentSessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        }
        return global.currentSessionId;
    }

    // Format file size helper
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = ConflictHandler;
