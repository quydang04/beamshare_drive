require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { connectDatabase } = require('./modules/db');
const FileMetadataManager = require('./modules/models/file-metadata.js');
const UploadHandler = require('./modules/upload-handler.js');
const ConflictHandler = require('./modules/conflict-handler.js');
const ApiRoutes = require('./modules/api-routes.js');
const AuthRoutes = require('./modules/auth-routes.js');
const ShareRoutes = require('./modules/share-routes.js');
const ShareWsServer = require('./modules/share-ws-server.js');
const authMiddleware = require('./modules/middleware/auth.js');

const app = express();
const PORT = process.env.PORT || 8080;
const beamshareStaticDir = path.join(__dirname, 'public', 'pages', 'beamshare');
const fileShareStaticDir = path.join(__dirname, 'public', 'pages', 'file');

// Initialize managers
const fileMetadata = new FileMetadataManager();
const uploadHandler = new UploadHandler();
const conflictHandler = new ConflictHandler(fileMetadata);
const apiRoutes = new ApiRoutes(fileMetadata, uploadHandler, conflictHandler, authMiddleware);
const authRoutes = new AuthRoutes();
const shareRoutes = new ShareRoutes(fileMetadata, authMiddleware);

// Core middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets for landing and SSO flows
app.use('/beamshare', express.static(beamshareStaticDir));
app.use('/file', express.static(fileShareStaticDir));
app.use('/assets/landing', express.static(path.join(__dirname, 'public', 'pages', 'landing')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname), { index: false }));

// Legacy redirects for previous share path
app.get(['/share', '/share/'], (_req, res) => {
    res.redirect(302, '/file/');
});

app.get('/share/*', (req, res) => {
    const target = req.originalUrl.replace(/^\/share/, '/file');
    res.redirect(302, target);
});

// Auth & API routes
app.use('/api/auth', authRoutes.getRouter());
app.use('/api/share', shareRoutes.getRouter());
app.use('/api', apiRoutes.getRouter());

const sendIndex = (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
};

const sendSsoPage = (res, page) => {
    res.sendFile(
        path.join(__dirname, 'public', 'pages', 'sso', `${page}.html`),
        (error) => {
            if (error) {
                console.error(`Không thể tải trang SSO "${page}":`, error.message);
                res.redirect(302, '/landing');
            }
        }
    );
};

const ensureAuthenticatedPage = (req, res, next) => {
    const user = authMiddleware.attachUser(req);
    if (!user) {
        return res.redirect(302, '/landing');
    }
    return next();
};

// Public pages
app.get('/landing', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'landing', 'index.html'));
});

app.get('/auth', (_req, res) => {
    res.redirect(302, '/auth/login');
});

app.get('/auth/login', (_req, res) => sendSsoPage(res, 'login'));
app.get('/auth/register', (_req, res) => sendSsoPage(res, 'register'));
app.get('/auth/forgot-password', (_req, res) => sendSsoPage(res, 'forgot-password'));

// Protected SPA entry
app.get('/', ensureAuthenticatedPage, sendIndex);
app.get('/index.html', ensureAuthenticatedPage, sendIndex);

// Catch-all for SPA routes requiring authentication
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }

    if (req.path.startsWith('/share')) {
        const legacyTarget = req.originalUrl.replace(/^\/share/, '/file');
        return res.redirect(302, legacyTarget);
    }

    if (req.path.startsWith('/beamshare') || req.path.startsWith('/file') || req.path.startsWith('/landing') || req.path.startsWith('/auth')) {
        return res.redirect(302, req.path);
    }

    const user = authMiddleware.attachUser(req);
    if (!user) {
        return res.redirect(302, '/landing');
    }

    return sendIndex(req, res);
});

async function startServer() {
    try {
        await connectDatabase();

        const serverInstance = app.listen(PORT, () => {
            console.log(`BeamShare Drive đang chạy trên port ${PORT}`);
            console.log(`Truy cập: http://localhost:${PORT}`);
        });

        new ShareWsServer(serverInstance);

        process.on('SIGINT', () => {
            console.log('\nĐang tắt server...');
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\nĐang tắt server...');
            process.exit(0);
        });
    } catch (error) {
        console.error('Không thể khởi động server:', error);
        process.exit(1);
    }
}

startServer();
