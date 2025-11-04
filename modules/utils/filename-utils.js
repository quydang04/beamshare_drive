const path = require('path');
const crypto = require('crypto');

class FilenameUtils {
    /**
     * Generate unique filename with comprehensive edge case handling
     */
    static generateUniqueFilename(originalName, fileMetadata) {
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

        while (fileMetadata.displayNameExists(newName) && counter < maxAttempts) {
            newName = `${baseName} (${counter})${extension}`;
            counter++;
        }

        // Fallback to timestamp if we hit the safety limit
        if (counter >= maxAttempts) {
            const timestamp = Date.now();
            newName = `${baseName}_${timestamp}${extension}`;

            // Final check - if even timestamp version exists, add random suffix
            if (fileMetadata.displayNameExists(newName)) {
                const randomSuffix = Math.random().toString(36).substring(2, 8);
                newName = `${baseName}_${timestamp}_${randomSuffix}${extension}`;
            }
        }

        return newName;
    }

    /**
     * Generate filename suggestions for conflict resolution
     */
    static generateFilenameSuggestions(originalName, fileMetadata) {
        const suggestions = [];
        const lastDotIndex = originalName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
        const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';

        // Generate numbered suggestions
        for (let i = 1; i <= 5; i++) {
            const suggestion = `${nameWithoutExt} (${i})${extension}`;
            if (!fileMetadata.displayNameExists(suggestion)) {
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

    /**
     * Comprehensive filename validation with security checks
     */
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

    /**
     * Enhanced filename sanitization
     */
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

    /**
     * Format file size in human readable format
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get file extension from filename
     */
    static getFileExtension(filename) {
        return path.extname(filename).toLowerCase();
    }

    /**
     * Check if file is of specific type
     */
    static isFileType(filename, type) {
        const ext = this.getFileExtension(filename);
        
        const typeMap = {
            image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
            video: ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'],
            audio: ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma'],
            document: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.xls', '.xlsx', '.ppt', '.pptx'],
            archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
            code: ['.js', '.html', '.css', '.php', '.py', '.java', '.cpp', '.c', '.cs', '.rb']
        };

        return typeMap[type] ? typeMap[type].includes(ext) : false;
    }

    /**
     * Generate session ID for tracking related actions
     */
    static generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Calculate file hash
     */
    static calculateFileHash(filePath, algorithm = 'sha256') {
        const fs = require('fs');
        try {
            const fileBuffer = fs.readFileSync(filePath);
            return crypto.createHash(algorithm).update(fileBuffer).digest('hex');
        } catch (error) {
            console.warn('Could not calculate hash for file:', filePath);
            return null;
        }
    }
}

module.exports = FilenameUtils;
