const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mime = require('mime-types');

class FileUtils {
    // Comprehensive filename validation with security checks
    static validateFilename(filename) {
        if (!filename || typeof filename !== 'string') {
            return { valid: false, error: 'Filename is required and must be a string' };
        }

        // Trim whitespace
        filename = filename.trim();

        // Check if empty after trimming
        if (filename.length === 0) {
            return { valid: false, error: 'Filename cannot be empty' };
        }

        // Check length limits
        if (filename.length > 255) {
            return { valid: false, error: 'Filename is too long (maximum 255 characters)' };
        }

        // Check for dangerous characters (Windows + Unix)
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
        if (dangerousChars.test(filename)) {
            return { valid: false, error: 'Filename contains invalid characters' };
        }

        // Check for reserved names (Windows)
        const reservedNames = [
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        ];

        const nameWithoutExt = path.basename(filename, path.extname(filename)).toUpperCase();
        if (reservedNames.includes(nameWithoutExt)) {
            return { valid: false, error: 'Filename uses a reserved system name' };
        }

        // Check for names that start or end with dots or spaces
        if (filename.startsWith('.') || filename.endsWith('.') ||
            filename.startsWith(' ') || filename.endsWith(' ')) {
            return { valid: false, error: 'Filename cannot start or end with dots or spaces' };
        }

        // Check for consecutive dots (security risk)
        if (filename.includes('..')) {
            return { valid: false, error: 'Filename cannot contain consecutive dots' };
        }

        // Check for potential script injection
        const scriptPatterns = [
            /<script/i, /javascript:/i, /vbscript:/i, /onload=/i, /onerror=/i,
            /eval\(/i, /expression\(/i, /url\(/i, /@import/i
        ];

        for (const pattern of scriptPatterns) {
            if (pattern.test(filename)) {
                return { valid: false, error: 'Filename contains potentially dangerous content' };
            }
        }

        // Check for Unicode control characters
        const controlChars = /[\u0000-\u001f\u007f-\u009f\u2000-\u200f\u2028-\u202f\u205f-\u206f]/;
        if (controlChars.test(filename)) {
            return { valid: false, error: 'Filename contains invalid Unicode characters' };
        }

        // Additional security: Check for homograph attacks (similar looking characters)
        const suspiciousChars = /[а-я]/; // Cyrillic characters that look like Latin
        if (suspiciousChars.test(filename)) {
            return {
                valid: true,
                warning: 'Filename contains characters that may be confusing (Cyrillic letters)',
                sanitized: filename
            };
        }

        return { valid: true, sanitized: filename };
    }

    // Enhanced filename sanitization
    static sanitizeFilename(filename) {
        if (!filename) return 'untitled';

        // Remove dangerous characters
        let sanitized = filename
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/\.\./g, '_')
            .trim();

        // Remove leading/trailing dots and spaces
        sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

        // Ensure it's not empty
        if (!sanitized) {
            sanitized = 'untitled';
        }

        // Ensure it's not too long
        if (sanitized.length > 255) {
            const ext = path.extname(sanitized);
            const nameWithoutExt = path.basename(sanitized, ext);
            sanitized = nameWithoutExt.substring(0, 255 - ext.length) + ext;
        }

        return sanitized;
    }

    // Get file size helper
    static getFileSize(internalFilename, uploadsDir) {
        try {
            const filePath = path.join(uploadsDir, internalFilename);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                return stats.size;
            }
        } catch (error) {
            console.warn('Could not get file size:', error);
        }
        return null;
    }

    // Format file size helper
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Calculate file hash
    static calculateFileHash(filePath) {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            return crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (error) {
            console.warn('Could not calculate hash for file:', filePath);
            return null;
        }
    }

    // Get file type information
    static getFileTypeInfo(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        
        return {
            extension: ext,
            mimeType: mimeType,
            isImage: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext),
            isVideo: ['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext),
            isAudio: ['.mp3', '.wav', '.flac', '.ogg', '.m4a'].includes(ext),
            isDocument: ['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(ext),
            isArchive: ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext),
            isCode: ['.js', '.css', '.html', '.json', '.xml', '.py', '.java', '.cpp'].includes(ext)
        };
    }

    // Generate thumbnail data for images
    static generateThumbnail(filePath, mimeType) {
        if (!mimeType.startsWith('image/')) {
            return null;
        }

        try {
            const imageBuffer = fs.readFileSync(filePath);
            return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
        } catch (error) {
            console.warn('Could not generate thumbnail:', error);
            return null;
        }
    }

    // Check if file exists
    static fileExists(filePath) {
        try {
            return fs.existsSync(filePath);
        } catch (error) {
            return false;
        }
    }

    // Get file stats safely
    static getFileStats(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                return fs.statSync(filePath);
            }
        } catch (error) {
            console.warn('Could not get file stats:', error);
        }
        return null;
    }

    // Create directory if it doesn't exist
    static ensureDirectoryExists(dirPath) {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                return true;
            }
            return true;
        } catch (error) {
            console.error('Could not create directory:', error);
            return false;
        }
    }

    // Safe file deletion
    static deleteFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Could not delete file:', error);
            return false;
        }
    }

    // Copy file safely
    static copyFile(sourcePath, destPath) {
        try {
            fs.copyFileSync(sourcePath, destPath);
            return true;
        } catch (error) {
            console.error('Could not copy file:', error);
            return false;
        }
    }

    // Get file extension from filename
    static getFileExtension(filename) {
        return path.extname(filename).toLowerCase();
    }

    // Get filename without extension
    static getFilenameWithoutExtension(filename) {
        return path.basename(filename, path.extname(filename));
    }

    // Check if filename has extension
    static hasExtension(filename) {
        return path.extname(filename).length > 0;
    }

    // Generate safe filename from display name
    static generateSafeFilename(displayName) {
        const sanitized = this.sanitizeFilename(displayName);
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        
        const ext = this.getFileExtension(sanitized);
        const nameWithoutExt = this.getFilenameWithoutExtension(sanitized);
        
        return `${nameWithoutExt}_${timestamp}_${random}${ext}`;
    }
}

module.exports = FileUtils;
