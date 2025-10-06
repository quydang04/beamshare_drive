const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

class ConflictHandler {
    constructor(fileMetadata) {
        this.fileMetadata = fileMetadata;
    }

    // Enhanced conflict detection with comprehensive file analysis
    checkFileConflict(displayName, newFileSize = null, newFileType = null) {
        const exists = this.fileMetadata.displayNameExists(displayName);

        if (!exists) {
            return { hasConflict: false };
        }

        const existingInternalName = this.fileMetadata.getInternalFilename(displayName);
        const existingMetadata = this.fileMetadata.getFileMetadata(existingInternalName);
        const existingFilePath = path.join(__dirname, '..', 'uploads', existingInternalName);

        let existingStats = null;
        let existingMimeType = null;

        try {
            if (fs.existsSync(existingFilePath)) {
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
                internalFilename: existingInternalName,
                uploadDate: existingMetadata ? existingMetadata.uploadDate : (existingStats ? existingStats.birthtime.toISOString() : null),
                lastModified: existingMetadata ? existingMetadata.lastModified : (existingStats ? existingStats.mtime.toISOString() : null),
                size: existingStats ? existingStats.size : null,
                formattedSize: existingStats ? this.formatFileSize(existingStats.size) : 'Unknown',
                mimeType: existingMimeType,
                version: existingMetadata ? existingMetadata.version : 1,
                canBackup: existingStats !== null,
                isImage: existingMimeType ? existingMimeType.startsWith('image/') : false,
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
            recommendations: this.generateConflictRecommendations(displayName, existingStats, newFileSize, existingMimeType, newFileType)
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
    generateUniqueFilename(originalName) {
        const lastDotIndex = originalName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';

        // Handle filenames that already contain numbered parentheses
        const existingNumberMatch = nameWithoutExt.match(/^(.+?)\s*\((\d+)\)$/);
        let baseName = existingNumberMatch ? existingNumberMatch[1].trim() : nameWithoutExt;
        let startCounter = existingNumberMatch ? parseInt(existingNumberMatch[2]) + 1 : 1;

        let counter = startCounter;
        let newName = originalName;
        const maxAttempts = 10000; // Safety limit

        while (this.fileMetadata.displayNameExists(newName) && counter < maxAttempts) {
            newName = `${baseName} (${counter})${extension}`;
            counter++;
        }

        // Fallback to timestamp if we hit the safety limit
        if (counter >= maxAttempts) {
            const timestamp = Date.now();
            newName = `${baseName}_${timestamp}${extension}`;

            // Final check - if even timestamp version exists, add random suffix
            if (this.fileMetadata.displayNameExists(newName)) {
                const randomSuffix = Math.random().toString(36).substring(2, 8);
                newName = `${baseName}_${timestamp}_${randomSuffix}${extension}`;
            }
        }

        // Log the auto-rename action
        this.logConflictAction('auto_rename', {
            originalName: originalName,
            newName: newName,
            counter: counter - startCounter,
            timestamp: new Date().toISOString()
        });

        return newName;
    }

    // Generate filename suggestions
    generateFilenameSuggestions(originalName) {
        const suggestions = [];
        const lastDotIndex = originalName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';

        // Generate numbered suggestions
        for (let i = 1; i <= 5; i++) {
            const suggestion = `${nameWithoutExt} (${i})${extension}`;
            if (!this.fileMetadata.displayNameExists(suggestion)) {
                suggestions.push(suggestion);
            }
        }

        // Add timestamp-based suggestion
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        suggestions.push(`${nameWithoutExt}_${timestamp}${extension}`);

        // Add date-based suggestion
        const dateStr = new Date().toISOString().slice(0, 10);
        suggestions.push(`${nameWithoutExt}_${dateStr}${extension}`);

        return suggestions.slice(0, 5); // Return max 5 suggestions
    }

    // Enhanced backup system with detailed metadata
    createBackupFile(filePath, internalFilename, displayName = null) {
        try {
            const backupDir = path.join(__dirname, '..', 'uploads', '.backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const stats = fs.statSync(filePath);
            const metadata = this.fileMetadata.getFileMetadata(internalFilename);

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
                originalUploadDate: metadata ? metadata.uploadDate : stats.birthtime.toISOString(),
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
