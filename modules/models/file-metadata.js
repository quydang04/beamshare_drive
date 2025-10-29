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
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    recycleExpiresAt: {
        type: Date,
        default: null,
        index: true
    },
    extra: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

fileMetadataSchema.index({ userId: 1, displayName: 1 }, { unique: true });
fileMetadataSchema.index({ userId: 1, isDeleted: 1, deletedAt: -1 });
fileMetadataSchema.index({ isDeleted: 1, recycleExpiresAt: 1 });

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
        const existing = await this.Model.exists({ userId, displayName, isDeleted: false });
        return Boolean(existing);
    }

    async getInternalFilename(userId, displayName) {
        const document = await this.Model.findOne({ userId, displayName, isDeleted: false }).lean();
        return document ? document.internalName : null;
    }

    async getFileMetadataByInternal(internalName, options = {}) {
        const query = { internalName };
        if (!options.includeDeleted) {
            query.isDeleted = false;
        }
        return this.Model.findOne(query).lean();
    }

    async getFileMetadataForUser(userId, internalName, options = {}) {
        const query = { userId, internalName };
        if (!options.includeDeleted) {
            query.isDeleted = false;
        }
        return this.Model.findOne(query).lean();
    }

    async updateDisplayName(userId, internalName, newDisplayName) {
        const updated = await this.Model.findOneAndUpdate(
            { userId, internalName, isDeleted: false },
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
        return this.Model.find({ userId, isDeleted: false }).sort({ uploadDate: -1 }).lean();
    }

    async listRecycleBin(userId) {
        return this.Model.find({ userId, isDeleted: true }).sort({ deletedAt: -1 }).lean();
    }

    async moveToRecycleBin(userId, internalName, expiresAt) {
        const now = new Date();
        const update = {
            isDeleted: true,
            deletedAt: now,
            recycleExpiresAt: expiresAt instanceof Date ? expiresAt : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            lastModified: now,
            visibility: 'private'
        };

        const updated = await this.Model.findOneAndUpdate(
            { userId, internalName, isDeleted: false },
            update,
            { new: true }
        ).lean();

        return updated;
    }

    async restoreFromRecycleBin(userId, internalName) {
        const now = new Date();
        const updated = await this.Model.findOneAndUpdate(
            { userId, internalName, isDeleted: true },
            {
                isDeleted: false,
                deletedAt: null,
                recycleExpiresAt: null,
                lastModified: now
            },
            { new: true }
        ).lean();

        return updated;
    }

    async findDeletedFile(userId, internalName) {
        return this.Model.findOne({ userId, internalName, isDeleted: true }).lean();
    }

    async findExpiredDeletedFiles(referenceDate = new Date()) {
        return this.Model.find({
            isDeleted: true,
            recycleExpiresAt: { $lte: referenceDate }
        }).lean();
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
            { userId, internalName, isDeleted: false },
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
            { userId, internalName, isDeleted: false },
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
            { userId, internalName, isDeleted: false },
            {
                shareToken: uuidv4(),
                lastModified: new Date()
            },
            { new: true }
        ).lean();

        return updated;
    }

    async findByShareToken(shareToken) {
        return this.Model.findOne({ shareToken, isDeleted: false }).lean();
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
            { userId, internalName, isDeleted: false },
            payload,
            { new: true }
        ).lean();

        return updated;
    }
}

module.exports = FileMetadataManager;
module.exports.FileMetadataDocument = FileMetadataDocument;
