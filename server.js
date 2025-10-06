const express = require('express');
const path = require('path');
const FileMetadataManager = require('./file-metadata.js');
const UploadHandler = require('./modules/upload-handler.js');
const ConflictHandler = require('./modules/conflict-handler.js');
const ApiRoutes = require('./modules/api-routes.js');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize managers
const fileMetadata = new FileMetadataManager();
const uploadHandler = new UploadHandler();
const conflictHandler = new ConflictHandler(fileMetadata);
const apiRoutes = new ApiRoutes(fileMetadata, uploadHandler, conflictHandler);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Use API routes
app.use('/api', apiRoutes.getRouter());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// All API routes are now handled by the ApiRoutes module
// Upload routes are now handled by the UploadHandler and ApiRoutes modules
// All file operations are now handled by the ApiRoutes module
// Route cho trang chính
app.get('/', (_req, res) => {
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
