require('dotenv').config();
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

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

    jwt.verify(finalToken, jwtSecret, (err, decoded) => {
        if (err) {
            return res.redirect('/login');
        }
        // Live DB lookup — role is never trusted from the JWT payload.
        db.get('SELECT role FROM users WHERE id = ?', [decoded.id], (dbErr, row) => {
            if (dbErr) {
                console.error('DB error during role lookup:', dbErr);
                return res.status(500).json({ error: 'Server error' });
            }
            if (!row) {
                // User deleted after token was issued.
                return res.redirect('/login');
            }
            req.user = { ...decoded, role: row.role };
            next();
        });
    });
};

const requireRole = (role) => (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(req.user.role)) {
        return res.status(403).render('403', { user: req.user });
    }
    next();
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

module.exports = {
    authenticateToken,
    requireRole,
    redirectIfAuthenticated
};
