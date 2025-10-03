const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const mime = require('mime-types');

const app = express();
const PORT = process.env.PORT || 8080;

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

        const files = fs.readdirSync(uploadsDir).map(filename => {
            const filePath = path.join(uploadsDir, filename);
            const stats = fs.statSync(filePath);
            const ext = path.extname(filename).toLowerCase();
            
            const originalName = getOriginalName(filename);
            
            return {
                id: filename,
                name: filename,
                originalName: originalName,
                size: stats.size,
                type: mime.lookup(filename) || 'application/octet-stream',
                uploadDate: stats.birthtime,
                modifiedDate: stats.mtime,
                extension: ext,
                isImage: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext),
                isVideo: ['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext),
                isAudio: ['.mp3', '.wav', '.flac', '.ogg', '.m4a'].includes(ext),
                isDocument: ['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(ext),
                path: `/uploads/${filename}`
            };
        });

        res.json(files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)));
    } catch (error) {
        console.error('Error getting files:', error);
        res.status(500).json({ error: 'Failed to get files' });
    }
});

// Upload files
app.post('/api/upload', upload.array('files', 5), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const uploadedFiles = req.files.map(file => ({
            id: file.filename,
            name: file.filename,
            originalName: file.originalname,
            size: file.size,
            type: file.mimetype,
            path: `/uploads/${file.filename}`,
            uploadDate: new Date()
        }));

        res.json({
            success: true,
            message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
            files: uploadedFiles
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

// Delete file
app.delete('/api/files/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'uploads', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Delete failed' });
    }
});

// Rename file
app.put('/api/files/:filename', (req, res) => {
    try {
        const oldFilename = req.params.filename;
        const { newName } = req.body;
        
        if (!newName) {
            return res.status(400).json({ error: 'New name is required' });
        }

        const oldPath = path.join(__dirname, 'uploads', oldFilename);
        const ext = path.extname(oldFilename);
        const timestamp = oldFilename.split('-').slice(-2, -1)[0];
        const random = oldFilename.split('-').slice(-1)[0].replace(ext, '');
        const newFilename = newName + '-' + timestamp + '-' + random + ext;
        const newPath = path.join(__dirname, 'uploads', newFilename);
        
        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        fs.renameSync(oldPath, newPath);
        res.json({ 
            success: true, 
            message: 'File renamed successfully',
            newFilename: newFilename
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
