require('dotenv').config();
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Check for token in cookies as fallback
    const cookieToken = req.cookies && req.cookies.token;
    const finalToken = token || cookieToken;

    if (!finalToken) {
        return res.redirect('/login');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET environment variable is not set');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    jwt.verify(finalToken, jwtSecret, (err, user) => {
        if (err) {
            return res.redirect('/login');
        }
        req.user = user;
        next();
    });
};

const redirectIfAuthenticated = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const cookieToken = req.cookies && req.cookies.token;
    const finalToken = token || cookieToken;

    if (finalToken) {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET environment variable is not set');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        jwt.verify(finalToken, jwtSecret, (err, user) => {
            if (!err && user) {
                return res.redirect('/dashboard');
            }
            next();
        });
    } else {
        next();
    }
};

/**
 * requireRole(role) — call after authenticateToken.
 * Returns 403 JSON if req.user.role does not match the required role.
 */
const requireRole = (role) => (req, res, next) => {
    if (!req.user || req.user.role !== role) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

module.exports = {
    authenticateToken,
    redirectIfAuthenticated,
    requireRole
};