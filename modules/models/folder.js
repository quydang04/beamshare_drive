const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DriveFolder',
        default: null
    },
    path: {
        type: String,
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

folderSchema.index({ userId: 1, parentId: 1, name: 1 }, { unique: true });

const FolderDocument = mongoose.model('DriveFolder', folderSchema);

class FolderManager {
    constructor() {
        this.Model = FolderDocument;
    }

    async createFolder({ userId, name, parentId = null }) {
        const normalizedName = (name || '').trim();
        if (!normalizedName) {
            throw new Error('Folder name is required');
        }

        const parentFolder = parentId ? await this.getFolderById(userId, parentId) : null;
        if (parentId && !parentFolder) {
            throw new Error('Parent folder not found');
        }

        const pathSegments = [];
        if (parentFolder?.path) {
            pathSegments.push(parentFolder.path);
        }
        pathSegments.push(normalizedName);

        const folder = await this.Model.create({
            userId,
            name: normalizedName,
            parentId: parentId || null,
            path: pathSegments.filter(Boolean).join('/') || normalizedName
        });

        return folder.toObject();
    }

    async listFolders(userId, parentId = null) {
        const query = { userId, isDeleted: false };
        if (parentId) {
            query.parentId = parentId;
        } else {
            query.parentId = null;
        }
        return this.Model.find(query).sort({ name: 1 }).lean();
    }

    async getFolderById(userId, folderId, { includeDeleted = false } = {}) {
        if (!folderId) {
            return null;
        }
        const query = { _id: folderId, userId };
        if (!includeDeleted) {
            query.isDeleted = false;
        }
        return this.Model.findOne(query).lean();
    }

    async renameFolder(userId, folderId, newName) {
        const sanitizedName = (newName || '').trim();
        if (!sanitizedName) {
            throw new Error('Tên thư mục không hợp lệ');
        }

        const folder = await this.getFolderById(userId, folderId);
        if (!folder) {
            return null;
        }

        const siblingConflict = await this.Model.exists({
            _id: { $ne: folder._id },
            userId,
            parentId: folder.parentId || null,
            name: sanitizedName,
            isDeleted: false
        });

        if (siblingConflict) {
            const error = new Error('Folder name already exists in this location');
            error.code = 'FOLDER_NAME_CONFLICT';
            throw error;
        }

        const updatedPath = this.#resolveUpdatedPath(folder, sanitizedName);

        const updated = await this.Model.findOneAndUpdate(
            { _id: folder._id },
            { name: sanitizedName, path: updatedPath },
            { new: true }
        ).lean();

        if (updated) {
            await this.#cascadePathUpdate(userId, updated._id, updatedPath);
        }

        return updated;
    }

    async markDeleted(userId, folderId) {
        const folder = await this.getFolderById(userId, folderId);
        if (!folder) {
            return null;
        }

        const updated = await this.Model.findOneAndUpdate(
            { _id: folder._id },
            { isDeleted: true },
            { new: true }
        ).lean();

        if (updated) {
            await this.#cascadeSoftDelete(userId, updated._id);
        }

        return updated;
    }

    async #cascadeSoftDelete(userId, parentId) {
        const children = await this.Model.find({ parentId, userId, isDeleted: false }).lean();
        if (!children.length) {
            return;
        }

        const childIds = children.map((child) => child._id);
        await this.Model.updateMany({ _id: { $in: childIds } }, { isDeleted: true });
        for (const childId of childIds) {
            await this.#cascadeSoftDelete(userId, childId);
        }
    }

    async #cascadePathUpdate(userId, parentId, parentPath) {
        const children = await this.Model.find({ parentId, userId, isDeleted: false }).lean();
        for (const child of children) {
            const newPath = parentPath ? `${parentPath}/${child.name}` : child.name;
            await this.Model.updateOne({ _id: child._id }, { path: newPath });
            await this.#cascadePathUpdate(userId, child._id, newPath);
        }
    }

    #resolveUpdatedPath(folder, newName) {
        const segments = folder.path ? folder.path.split('/') : [];
        if (!segments.length) {
            return newName;
        }
        segments[segments.length - 1] = newName;
        return segments.join('/');
    }
}

module.exports = FolderManager;
module.exports.FolderDocument = FolderDocument;
