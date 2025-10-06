// File Metadata Management System
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class FileMetadataManager {
    constructor(metadataFilePath = './file-metadata.json') {
        this.metadataFilePath = metadataFilePath;
        this.metadata = this.loadMetadata();
    }

    // Load metadata from JSON file
    loadMetadata() {
        try {
            if (fs.existsSync(this.metadataFilePath)) {
                const data = fs.readFileSync(this.metadataFilePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.warn('Error loading metadata, starting with empty metadata:', error.message);
        }
        return {};
    }

    // Save metadata to JSON file
    saveMetadata() {
        try {
            fs.writeFileSync(this.metadataFilePath, JSON.stringify(this.metadata, null, 2));
        } catch (error) {
            console.error('Error saving metadata:', error);
        }
    }

    // Generate unique internal filename
    generateInternalFilename(originalName) {
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        return `${baseName}-${timestamp}-${random}${ext}`;
    }

    // Add file metadata
    addFile(originalName, internalFilename = null) {
        if (!internalFilename) {
            internalFilename = this.generateInternalFilename(originalName);
        }

        this.metadata[internalFilename] = {
            displayName: originalName,
            originalName: originalName,
            internalName: internalFilename,
            uploadDate: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            version: 1
        };

        this.saveMetadata();
        return internalFilename;
    }

    // Get display name from internal filename
    getDisplayName(internalFilename) {
        const fileData = this.metadata[internalFilename];
        return fileData ? fileData.displayName : internalFilename;
    }

    // Get internal filename from display name
    getInternalFilename(displayName) {
        for (const [internalName, data] of Object.entries(this.metadata)) {
            if (data.displayName === displayName) {
                return internalName;
            }
        }
        return null;
    }

    // Check if display name exists
    displayNameExists(displayName) {
        return Object.values(this.metadata).some(data => data.displayName === displayName);
    }

    // Update display name (rename)
    updateDisplayName(internalFilename, newDisplayName) {
        if (this.metadata[internalFilename]) {
            this.metadata[internalFilename].displayName = newDisplayName;
            this.metadata[internalFilename].lastModified = new Date().toISOString();
            this.metadata[internalFilename].version += 1;
            this.saveMetadata();
            return true;
        }
        return false;
    }

    // Remove file metadata
    removeFile(internalFilename) {
        if (this.metadata[internalFilename]) {
            delete this.metadata[internalFilename];
            this.saveMetadata();
            return true;
        }
        return false;
    }

    // Get all files with their metadata
    getAllFiles() {
        return Object.entries(this.metadata).map(([internalName, data]) => ({
            internalName,
            ...data
        }));
    }

    // Get file metadata
    getFileMetadata(internalFilename) {
        return this.metadata[internalFilename] || null;
    }

    // Update internal filename (for file system operations)
    updateInternalFilename(oldInternalName, newInternalName) {
        if (this.metadata[oldInternalName]) {
            const data = this.metadata[oldInternalName];
            data.internalName = newInternalName;
            data.lastModified = new Date().toISOString();
            
            this.metadata[newInternalName] = data;
            delete this.metadata[oldInternalName];
            
            this.saveMetadata();
            return true;
        }
        return false;
    }

    // Clean up orphaned metadata (files that don't exist on disk)
    cleanupOrphanedMetadata(uploadsDir) {
        const existingFiles = fs.readdirSync(uploadsDir);
        const orphanedFiles = [];

        for (const internalName of Object.keys(this.metadata)) {
            if (!existingFiles.includes(internalName)) {
                orphanedFiles.push(internalName);
                delete this.metadata[internalName];
            }
        }

        if (orphanedFiles.length > 0) {
            this.saveMetadata();
            console.log(`Cleaned up ${orphanedFiles.length} orphaned metadata entries`);
        }

        return orphanedFiles;
    }

    // Sync with existing files (for migration)
    syncWithExistingFiles(uploadsDir) {
        if (!fs.existsSync(uploadsDir)) {
            return;
        }

        const existingFiles = fs.readdirSync(uploadsDir);
        let syncedCount = 0;

        for (const filename of existingFiles) {
            if (!this.metadata[filename]) {
                // Try to extract original name from filename pattern
                const originalName = this.extractOriginalName(filename);
                this.addFile(originalName, filename);
                syncedCount++;
            }
        }

        if (syncedCount > 0) {
            console.log(`Synced ${syncedCount} existing files to metadata`);
        }
    }

    // Extract original name from old filename pattern
    extractOriginalName(filename) {
        const parts = filename.split('-');
        
        if (parts.length >= 3) {
            const lastPart = parts[parts.length - 1]; // contains extension
            const secondLastPart = parts[parts.length - 2]; // random number
            const thirdLastPart = parts[parts.length - 3]; // timestamp
            
            // Check if they are numbers (timestamp and random)
            if (!isNaN(secondLastPart) && !isNaN(thirdLastPart)) {
                const ext = path.extname(lastPart);
                return parts.slice(0, -2).join('-') + ext;
            }
        }
        
        return filename;
    }
}

module.exports = FileMetadataManager;
