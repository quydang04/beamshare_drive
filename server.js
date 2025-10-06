const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const mime = require('mime-types');
const crypto = require('crypto');
const FileMetadataManager = require('./file-metadata.js');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize file metadata manager
const fileMetadata = new FileMetadataManager();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, name + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept all file types for now
        cb(null, true);
    }
});

// Helper function to get original name from filename
function getOriginalName(filename) {
    // Handle files uploaded by multer (with timestamp and random numbers)
    // Format: originalname-timestamp-randomnumber.ext
    const parts = filename.split('-');

    if (parts.length >= 3) {
        // Check if last two parts are timestamp and random number
        const lastPart = parts[parts.length - 1]; // contains extension
        const secondLastPart = parts[parts.length - 2]; // random number
        const thirdLastPart = parts[parts.length - 3]; // timestamp

        // Check if they are numbers (timestamp and random)
        if (!isNaN(secondLastPart) && !isNaN(thirdLastPart)) {
            const ext = path.extname(lastPart);
            return parts.slice(0, -2).join('-') + ext;
        }
    }

    // Return filename as is if no pattern matches
    return filename;
}

// Enhanced file validation function
function validateUploadedFile(file) {
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    const allowedTypes = [
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
        // Documents
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'application/rtf',
        // Archives
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
        // Audio
        'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/mp4',
        // Video
        'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska',
        // Code files
        'text/javascript', 'text/css', 'text/html', 'application/json', 'text/xml'
    ];

    // Check file size
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File "${file.originalname}" exceeds maximum size of 2GB`
        };
    }

    // Check file type (optional - can be disabled for more flexibility)
    if (process.env.STRICT_FILE_VALIDATION === 'true' && !allowedTypes.includes(file.mimetype)) {
        return {
            valid: false,
            error: `File type "${file.mimetype}" is not allowed for "${file.originalname}"`
        };
    }

    // Check filename for dangerous characters
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(file.originalname)) {
        return {
            valid: false,
            error: `Filename "${file.originalname}" contains invalid characters`
        };
    }

    // Check filename length
    if (file.originalname.length > 255) {
        return {
            valid: false,
            error: `Filename "${file.originalname}" is too long (max 255 characters)`
        };
    }

    return { valid: true };
}

// Format file size helper
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// API Routes

// Get all files
app.get('/api/files', (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            return res.json([]);
        }

        // Sync metadata with existing files and clean up orphaned entries
        fileMetadata.syncWithExistingFiles(uploadsDir);
        fileMetadata.cleanupOrphanedMetadata(uploadsDir);

        const files = fs.readdirSync(uploadsDir).map(internalFilename => {
            const filePath = path.join(uploadsDir, internalFilename);
            const stats = fs.statSync(filePath);
            const ext = path.extname(internalFilename).toLowerCase();

            // Get display name from metadata, fallback to extracted name
            const metadata = fileMetadata.getFileMetadata(internalFilename);
            const displayName = metadata ? metadata.displayName : fileMetadata.extractOriginalName(internalFilename);

            return {
                id: internalFilename,
                name: internalFilename,
                originalName: displayName,
                displayName: displayName,
                size: stats.size,
                type: mime.lookup(internalFilename) || 'application/octet-stream',
                uploadDate: metadata ? new Date(metadata.uploadDate) : stats.birthtime,
                modifiedDate: stats.mtime,
                extension: ext,
                isImage: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext),
                isVideo: ['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext),
                isAudio: ['.mp3', '.wav', '.flac', '.ogg', '.m4a'].includes(ext),
                isDocument: ['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(ext),
                path: `/uploads/${internalFilename}`,
                metadata: metadata
            };
        });

        res.json(files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)));
    } catch (error) {
        console.error('Error getting files:', error);
        res.status(500).json({ error: 'Failed to get files' });
    }
});

// Check if file exists (for duplicate handling)
app.post('/api/files/check-exists', (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        // Check if display name already exists in metadata
        const exists = fileMetadata.displayNameExists(filename);

        if (exists) {
            const internalFilename = fileMetadata.getInternalFilename(filename);
            res.json({
                exists: true,
                internalFilename: internalFilename,
                displayName: filename
            });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('Error checking file existence:', error);
        res.status(500).json({ error: 'Failed to check file existence' });
    }
});

// Check for upload conflicts before upload
app.post('/api/files/check-conflict', (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) {
            return res.status(400).json({ error: 'Filename is required' });
        }

        const exists = fileMetadata.displayNameExists(filename);

        res.json({
            hasConflict: exists,
            existingFile: exists ? {
                displayName: filename,
                internalFilename: fileMetadata.getInternalFilename(filename)
            } : null
        });
    } catch (error) {
        console.error('Error checking file conflict:', error);
        res.status(500).json({ error: 'Failed to check file conflict' });
    }
});

// Enhanced upload with multi-file support and better validation
app.post('/api/upload', upload.array('files', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadResults = [];
        const errors = [];

        // Process each file
        for (const file of req.files) {
            try {
                const originalName = file.originalname;
                const conflictAction = req.body.conflictAction;
                const customName = req.body.customName;

                // Validate file
                const validation = validateUploadedFile(file);
                if (!validation.valid) {
                    errors.push({
                        filename: originalName,
                        error: validation.error
                    });
                    // Remove invalid file
                    fs.unlinkSync(file.path);
                    continue;
                }

                // Determine display name
                let displayName = customName || originalName;

                // Handle conflicts
                if (!conflictAction && fileMetadata.displayNameExists(displayName)) {
                    fs.unlinkSync(file.path);
                    errors.push({
                        filename: originalName,
                        error: 'File with this name already exists',
                        conflict: true,
                        existingFile: {
                            displayName: displayName,
                            internalFilename: fileMetadata.getInternalFilename(displayName)
                        }
                    });
                    continue;
                }

                // Process conflict resolution
                if (conflictAction === 'replace') {
                    const existingInternalName = fileMetadata.getInternalFilename(displayName);
                    if (existingInternalName) {
                        const existingPath = path.join(__dirname, 'uploads', existingInternalName);
                        if (fs.existsSync(existingPath)) {
                            fs.unlinkSync(existingPath);
                        }
                        fileMetadata.removeFile(existingInternalName);
                    }
                } else if (conflictAction === 'rename') {
                    displayName = customName;
                    if (fileMetadata.displayNameExists(displayName)) {
                        fs.unlinkSync(file.path);
                        errors.push({
                            filename: originalName,
                            error: 'The new filename also conflicts with an existing file'
                        });
                        continue;
                    }
                }

                // Add to metadata system
                const internalFilename = fileMetadata.addFile(displayName, file.filename);

                const uploadedFile = {
                    id: internalFilename,
                    name: internalFilename,
                    originalName: displayName,
                    displayName: displayName,
                    size: file.size,
                    type: file.mimetype,
                    path: `/uploads/${internalFilename}`,
                    uploadDate: new Date()
                };

                uploadResults.push(uploadedFile);

            } catch (fileError) {
                console.error('Error processing file:', file.originalname, fileError);
                errors.push({
                    filename: file.originalname,
                    error: fileError.message
                });
                // Clean up file on error
                try {
                    fs.unlinkSync(file.path);
                } catch (unlinkError) {
                    console.error('Error cleaning up file:', unlinkError);
                }
            }
        }

        // Return results
        const response = {
            success: uploadResults.length > 0,
            message: `Uploaded ${uploadResults.length} file(s) successfully`,
            files: uploadResults,
            totalUploaded: uploadResults.length,
            totalFiles: req.files.length
        };

        if (errors.length > 0) {
            response.errors = errors;
            response.message += `, ${errors.length} file(s) failed`;
        }

        res.json(response);

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Single file upload endpoint (for backward compatibility)
app.post('/api/upload-single', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const originalName = req.file.originalname;
        const conflictAction = req.body.conflictAction;
        const customName = req.body.customName;

        // Validate file
        const validation = validateUploadedFile(req.file);
        if (!validation.valid) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: validation.error });
        }

        let displayName = customName || originalName;

        // Check for conflicts
        if (!conflictAction && fileMetadata.displayNameExists(displayName)) {
            fs.unlinkSync(req.file.path);
            return res.json({
                success: false,
                conflict: true,
                message: 'File with this name already exists',
                existingFile: {
                    displayName: displayName,
                    internalFilename: fileMetadata.getInternalFilename(displayName)
                }
            });
        }

        // Handle conflict resolution
        if (conflictAction === 'replace') {
            const existingInternalName = fileMetadata.getInternalFilename(displayName);
            if (existingInternalName) {
                const existingPath = path.join(__dirname, 'uploads', existingInternalName);
                if (fs.existsSync(existingPath)) {
                    fs.unlinkSync(existingPath);
                }
                fileMetadata.removeFile(existingInternalName);
            }
        } else if (conflictAction === 'rename') {
            displayName = customName;
            if (fileMetadata.displayNameExists(displayName)) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    error: 'The new filename also conflicts with an existing file'
                });
            }
        }

        const internalFilename = fileMetadata.addFile(displayName, req.file.filename);

        const uploadedFile = {
            id: internalFilename,
            name: internalFilename,
            originalName: displayName,
            displayName: displayName,
            size: req.file.size,
            type: req.file.mimetype,
            path: `/uploads/${internalFilename}`,
            uploadDate: new Date()
        };

        res.json({
            success: true,
            message: 'File uploaded successfully',
            file: uploadedFile
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Download file
app.get('/api/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'uploads', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stats = fs.statSync(filePath);
        const originalName = filename.split('-').slice(0, -2).join('-') + path.extname(filename);
        
        res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Content-Type', mime.lookup(filename) || 'application/octet-stream');
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// Preview file (for images, videos, etc.)
app.get('/api/preview/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'uploads', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        
        // Add CORS headers for Vue Office
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ error: 'Preview failed' });
    }
});

// Get file details
app.get('/api/files/:filename/details', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'uploads', filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stats = fs.statSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        const originalName = getOriginalName(filename);

        // Calculate SHA-256 hash
        let hash = null;
        try {
            const fileBuffer = fs.readFileSync(filePath);
            hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (hashError) {
            console.warn('Could not calculate hash for file:', filename);
        }

        const fileDetails = {
            id: filename,
            name: filename,
            originalName: originalName,
            size: stats.size,
            type: mime.lookup(filename) || 'application/octet-stream',
            uploadDate: stats.birthtime,
            modifiedDate: stats.mtime,
            extension: ext,
            hash: hash,
            owner: 'User', // Default owner
            permissions: 'Riêng tư', // Default permissions
            version: '1.0', // Default version
            isImage: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext),
            isVideo: ['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext),
            isAudio: ['.mp3', '.wav', '.flac', '.ogg', '.m4a'].includes(ext),
            isDocument: ['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(ext),
            path: `/uploads/${filename}`
        };

        res.json(fileDetails);
    } catch (error) {
        console.error('Error getting file details:', error);
        res.status(500).json({ error: 'Failed to get file details' });
    }
});

// Delete file
app.delete('/api/files/:filename', (req, res) => {
    try {
        const internalFilename = req.params.filename;
        const filePath = path.join(__dirname, 'uploads', internalFilename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Get display name for response
        const metadata = fileMetadata.getFileMetadata(internalFilename);
        const displayName = metadata ? metadata.displayName : internalFilename;

        // Delete physical file
        fs.unlinkSync(filePath);

        // Remove from metadata
        fileMetadata.removeFile(internalFilename);

        res.json({
            success: true,
            message: 'File deleted successfully',
            deletedFile: {
                internalFilename,
                displayName
            }
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Delete failed' });
    }
});

// Rename file
app.put('/api/files/:filename', (req, res) => {
    try {
        const internalFilename = req.params.filename;
        const { newName } = req.body;

        if (!newName) {
            return res.status(400).json({ error: 'New name is required' });
        }

        const filePath = path.join(__dirname, 'uploads', internalFilename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if the file exists in metadata
        const metadata = fileMetadata.getFileMetadata(internalFilename);
        if (!metadata) {
            return res.status(404).json({ error: 'File metadata not found' });
        }

        // Extract extension from the new name or use the original extension
        const originalExt = path.extname(internalFilename);
        const newExt = path.extname(newName);
        const finalNewName = newExt ? newName : newName + originalExt;

        // Check if the new display name conflicts with existing files
        if (fileMetadata.displayNameExists(finalNewName)) {
            const existingInternalName = fileMetadata.getInternalFilename(finalNewName);
            if (existingInternalName !== internalFilename) {
                return res.status(400).json({
                    error: 'A file with this name already exists'
                });
            }
        }

        // Update the display name in metadata (no need to rename the physical file)
        const success = fileMetadata.updateDisplayName(internalFilename, finalNewName);

        if (!success) {
            return res.status(500).json({ error: 'Failed to update file metadata' });
        }

        res.json({
            success: true,
            message: 'File renamed successfully',
            newDisplayName: finalNewName,
            internalFilename: internalFilename
        });
    } catch (error) {
        console.error('Rename error:', error);
        res.status(500).json({ error: 'Rename failed' });
    }
});

// Route cho trang chính
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route cho các trang khác (SPA routing)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`BeamShare Drive đang chạy trên port ${PORT}`);
    console.log(`Truy cập: http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nĐang tắt server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nĐang tắt server...');
    process.exit(0);
});
