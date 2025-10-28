const mongoose = require('mongoose');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const fileMetadataSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    originalName: {
        type: String,
        required: true,
        trim: true
    },
    internalName: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    storageName: {
        type: String,
        required: true
    },
    storagePath: {
        type: String,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    lastModified: {
        type: Date,
        default: Date.now
    },
    version: {
        type: Number,
        default: 1
    },
    size: {
        type: Number,
        default: 0
    },
    mimeType: String,
    checksum: String,
    visibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'private'
    },
    shareToken: {
        type: String,
        default: uuidv4,
        unique: true
    },
    extra: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

fileMetadataSchema.index({ userId: 1, displayName: 1 }, { unique: true });

const FileMetadataDocument = mongoose.model('FileMetadata', fileMetadataSchema);

class FileMetadataManager {
    constructor() {
        this.Model = FileMetadataDocument;
    }

    buildInternalName(userId, storageName) {
        return `${userId}__${storageName}`;
    }

    async addFile({
        userId,
        displayName,
        originalName,
        storageName,
        size = 0,
        mimeType = 'application/octet-stream',
        checksum = null,
        visibility = 'private'
    }) {
        const internalName = this.buildInternalName(userId, storageName);
        const storagePath = path.join(userId, storageName);

        const document = await this.Model.create({
            userId,
            displayName,
            originalName,
            internalName,
            storageName,
            storagePath,
            size,
            mimeType,
            checksum,
            visibility,
            uploadDate: new Date(),
            lastModified: new Date()
        });

        return document.toObject();
    }

    async displayNameExists(userId, displayName) {
        const existing = await this.Model.exists({ userId, displayName });
        return Boolean(existing);
    }

    async getInternalFilename(userId, displayName) {
        const document = await this.Model.findOne({ userId, displayName }).lean();
        return document ? document.internalName : null;
    }

    async getFileMetadataByInternal(internalName) {
        return this.Model.findOne({ internalName }).lean();
    }

    async getFileMetadataForUser(userId, internalName) {
        return this.Model.findOne({ userId, internalName }).lean();
    }

    async updateDisplayName(userId, internalName, newDisplayName) {
        const updated = await this.Model.findOneAndUpdate(
            { userId, internalName },
            {
                displayName: newDisplayName,
                lastModified: new Date(),
                $inc: { version: 1 }
            },
            { new: true }
        ).lean();

        return Boolean(updated);
    }

    async removeFile(userId, internalName) {
        const result = await this.Model.deleteOne({ userId, internalName });
        return result.deletedCount > 0;
    }

    async listFilesForUser(userId) {
        return this.Model.find({ userId }).sort({ uploadDate: -1 }).lean();
    }

    async updateFileDetails(userId, internalName, updates) {
        const payload = {
            ...updates,
            lastModified: new Date()
        };

        if (updates.version) {
            payload.version = updates.version;
        }

        const updated = await this.Model.findOneAndUpdate(
            { userId, internalName },
            payload,
            { new: true }
        ).lean();

        return updated;
    }

    async updateShareState(userId, internalName, visibility) {
        if (!['public', 'private'].includes(visibility)) {
            throw new Error('Invalid visibility option');
        }

        const updated = await this.Model.findOneAndUpdate(
            { userId, internalName },
            {
                visibility,
                lastModified: new Date()
            },
            { new: true }
        ).lean();

        return updated;
    }

    async refreshShareToken(userId, internalName) {
        const updated = await this.Model.findOneAndUpdate(
            { userId, internalName },
            {
                shareToken: uuidv4(),
                lastModified: new Date()
            },
            { new: true }
        ).lean();

        return updated;
    }

    async findByShareToken(shareToken) {
        return this.Model.findOne({ shareToken }).lean();
    }

    async updateFileStats(userId, internalName, { size, mimeType, checksum }) {
        const payload = {
            lastModified: new Date()
        };

        if (typeof size === 'number') {
            payload.size = size;
        }
        if (mimeType) {
            payload.mimeType = mimeType;
        }
        if (checksum) {
            payload.checksum = checksum;
        }

        const updated = await this.Model.findOneAndUpdate(
            { userId, internalName },
            payload,
            { new: true }
        ).lean();

        return updated;
    }
}

module.exports = FileMetadataManager;
module.exports.FileMetadataDocument = FileMetadataDocument;
