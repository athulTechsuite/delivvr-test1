const express = require('express');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Constants
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const LOGIN_REDIRECT_PATH = '/login';
const HOME_REDIRECT_PATH = '/';
const LOGOUT_SUCCESS_MESSAGE = 'Successfully logged out';
const DATABASE_PATH = path.join(__dirname, '../database/users.db');

// Database initialization with proper error handling
let db;

const initializeDatabase = () => {
    try {
        // Check if database directory exists, create if not
        const dbDir = path.dirname(DATABASE_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Check if database file exists
        const dbExists = fs.existsSync(DATABASE_PATH);
        
        // Create database connection
        db = new sqlite3.Database(DATABASE_PATH, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                throw err;
            }
            console.log('Connected to SQLite database');
        });

        // If database file didn't exist, create the users table
        if (!dbExists) {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('Error creating users table:', err.message);
                } else {
                    console.log('Users table created successfully');
                }
            });
        }

        return db;
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
};

// Initialize database on module load
try {
    initializeDatabase();
} catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
}

// Database connection health check middleware
const checkDatabaseConnection = (req, res, next) => {
    if (!db) {
        console.error('Database connection not available');
        return res.status(500).render('error', { 
            title: 'Error',
            message: 'Database connection error. Please try again later.'
        });
    }
    next();
};

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    
    if (!token) {
        return res.redirect(LOGIN_REDIRECT_PATH);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie('token');
            return res.redirect(LOGIN_REDIRECT_PATH);
        }
        req.user = user;
        next();
    });
};

// Input validation middleware for user ID
const validateUserId = (req, res, next) => {
    if (!req.user || !req.user.userId || typeof req.user.userId !== 'number') {
        res.clearCookie('token');
        return res.redirect(LOGIN_REDIRECT_PATH);
    }
    next();
};

// Database error handler
const handleDatabaseError = (err, res, message = 'Database error occurred') => {
    console.error('Database error:', err);
    return res.status(500).render('error', { 
        title: 'Error',
        message: message
    });
};

// User not found handler
const handleUserNotFound = (res) => {
    res.clearCookie('token');
    return res.redirect(LOGIN_REDIRECT_PATH);
};

// Dashboard route - protected
router.get('/', checkDatabaseConnection, authenticateToken, validateUserId, (req, res) => {
    try {
        // Get user details from database with created_at field
        db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.userId], (err, user) => {
            if (err) {
                return handleDatabaseError(err, res);
            }
            
            if (!user) {
                return handleUserNotFound(res);
            }

            res.render('dashboard', {
                title: 'Dashboard',
                user: user,
                currentPath: '/dashboard',
                success: req.query.success,
                error: req.query.error
            });
        });
    } catch (error) {
        console.error('Dashboard route error:', error);
        return res.status(500).render('error', { 
            title: 'Error',
            message: 'An unexpected error occurred'
        });
    }
});

// Profile route - protected
router.get('/profile', checkDatabaseConnection, authenticateToken, validateUserId, (req, res) => {
    try {
        // Get user details from database with created_at field
        db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.userId], (err, user) => {
            if (err) {
                return handleDatabaseError(err, res, 'Failed to load profile information');
            }
            
            if (!user) {
                return handleUserNotFound(res);
            }

            res.render('profile', {
                title: 'Profile',
                user: user,
                currentPath: '/profile',
                success: req.query.success,
                error: req.query.error
            });
        });
    } catch (error) {
        console.error('Profile route error:', error);
        return res.status(500).render('error', { 
            title: 'Error',
            message: 'Failed to load profile page'
        });
    }
});

// Settings route - protected
router.get('/settings', checkDatabaseConnection, authenticateToken, validateUserId, (req, res) => {
    try {
        // Get user details from database with created_at field
        db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.userId], (err, user) => {
            if (err) {
                return handleDatabaseError(err, res, 'Failed to load settings information');
            }
            
            if (!user) {
                return handleUserNotFound(res);
            }

            res.render('settings', {
                title: 'Settings',
                user: user,
                currentPath: '/settings',
                success: req.query.success,
                error: req.query.error
            });
        });
    } catch (error) {
        console.error('Settings route error:', error);
        return res.status(500).render('error', { 
            title: 'Error',
            message: 'Failed to load settings page'
        });
    }
});

// Logout route
router.post('/logout', (req, res) => {
    try {
        res.clearCookie('token');
        res.redirect(`${HOME_REDIRECT_PATH}?message=${encodeURIComponent(LOGOUT_SUCCESS_MESSAGE)}`);
    } catch (error) {
        console.error('Logout route error:', error);
        res.clearCookie('token');
        res.redirect(HOME_REDIRECT_PATH);
    }
});

// Graceful database shutdown
process.on('SIGINT', () => {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

module.exports = router;