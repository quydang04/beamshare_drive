const express = require('express');
const path = require('path');
const FileMetadataManager = require('./file-metadata.js');
const UploadHandler = require('./modules/upload-handler.js');
const ConflictHandler = require('./modules/conflict-handler.js');
const ApiRoutes = require('./modules/api-routes.js');
const ShareWsServer = require('./modules/share-ws-server.js');

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
app.use('/share', express.static(path.join(__dirname, 'public', 'pages', 'share')));
app.use(express.static(path.join(__dirname)));

// Use API routes
app.use('/api', apiRoutes.getRouter());

// All API routes are now handled by the ApiRoutes module
// Upload routes are now handled by the UploadHandler and ApiRoutes modules
// All file operations are now handled by the ApiRoutes module
// Utilities
const sendIndex = (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
};

const sendSsoPage = (res, page) => {
    res.sendFile(
        path.join(__dirname, 'public', 'html', 'pages', 'sso', `${page}.html`),
        (error) => {
            if (error) {
                console.error(`Không thể tải trang SSO "${page}":`, error.message);
                res.redirect(302, '/');
            }
        }
    );
};

// Route cho trang chính
app.get('/', sendIndex);

app.get('/auth', (_req, res) => {
    res.redirect(302, '/auth/login');
});

// Route dành riêng cho các trang SSO độc lập
app.get('/auth/login', (_req, res) => sendSsoPage(res, 'login'));
app.get('/auth/register', (_req, res) => sendSsoPage(res, 'register'));
app.get('/auth/forgot-password', (_req, res) => sendSsoPage(res, 'forgot-password'));

// Route cho các trang khác (SPA routing)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    sendIndex(req, res);
});

// Start server
const serverInstance = app.listen(PORT, () => {
    console.log(`BeamShare Drive đang chạy trên port ${PORT}`);
    console.log(`Truy cập: http://localhost:${PORT}`);
});

// Initialize WebSocket signaling for the share experience
new ShareWsServer(serverInstance);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nĐang tắt server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nĐang tắt server...');
    process.exit(0);
});
