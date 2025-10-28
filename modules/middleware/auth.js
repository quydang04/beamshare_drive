const jwt = require('jsonwebtoken');

const AUTH_COOKIE = 'bs_token';

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('Missing JWT_SECRET environment variable');
    }
    return secret;
}

function getJwtExpiryMs() {
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    if (typeof expiresIn === 'string' && expiresIn.endsWith('d')) {
        const days = Number(expiresIn.slice(0, -1)) || 7;
        return days * 24 * 60 * 60 * 1000;
    }
    if (typeof expiresIn === 'string' && expiresIn.endsWith('h')) {
        const hours = Number(expiresIn.slice(0, -1)) || 24;
        return hours * 60 * 60 * 1000;
    }
    const numeric = Number(expiresIn);
    return Number.isFinite(numeric) ? numeric : 7 * 24 * 60 * 60 * 1000;
}

function signToken(payload) {
    const secret = getJwtSecret();
    const expires = process.env.JWT_EXPIRES_IN || '7d';
    return jwt.sign(payload, secret, { expiresIn: expires });
}

function verifyToken(token) {
    if (!token) {
        return null;
    }
    try {
        const secret = getJwtSecret();
        return jwt.verify(token, secret);
    } catch (error) {
        return null;
    }
}

function setAuthCookie(res, token) {
    const maxAge = getJwtExpiryMs();
    const isProduction = String(process.env.NODE_ENV).toLowerCase() === 'production';

    res.cookie(AUTH_COOKIE, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge
    });
}

function clearAuthCookie(res) {
    res.clearCookie(AUTH_COOKIE, {
        httpOnly: true,
        sameSite: 'lax'
    });
}

function extractToken(req) {
    if (req.cookies && req.cookies[AUTH_COOKIE]) {
        return req.cookies[AUTH_COOKIE];
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    return null;
}

function attachUser(req) {
    if (req.user) {
        return req.user;
    }

    const token = extractToken(req);
    const decoded = verifyToken(token);

    if (decoded) {
        req.user = {
            id: decoded.id,
            userId: decoded.userId,
            email: decoded.email,
            fullName: decoded.fullName || null
        };
        return req.user;
    }

    return null;
}

function requireAuth(req, res, next) {
    const user = attachUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    return next();
}

function optionalAuth(req, _res, next) {
    attachUser(req);
    next();
}

function issueAuthCookie(res, userDocument) {
    const token = signToken({
        id: userDocument._id.toString(),
        userId: userDocument.userId,
        email: userDocument.email,
        fullName: userDocument.fullName || null
    });
    setAuthCookie(res, token);
    return token;
}

module.exports = {
    AUTH_COOKIE,
    requireAuth,
    optionalAuth,
    attachUser,
    issueAuthCookie,
    clearAuthCookie
};
