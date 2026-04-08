const express = require('express');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const router = express.Router();

// Initialize database connection
const db = new sqlite3.Database(path.join(__dirname, '../database/users.db'));

// Constants
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TOKEN_COOKIE_NAME = 'token';

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies[TOKEN_COOKIE_NAME];
    
    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie(TOKEN_COOKIE_NAME);
            return res.redirect('/login');
        }
        req.user = user;
        next();
    });
};

// Helper function to get user data from database
const getUserById = (userId, callback) => {
    if (!userId || typeof userId !== 'number') {
        return callback(new Error('Invalid user ID'));
    }

    const query = 'SELECT id, name, email, created_at FROM users WHERE id = ?';
    db.get(query, [userId], (err, user) => {
        if (err) {
            console.error('Database error in getUserById:', err);
            return callback(err);
        }
        
        if (!user) {
            return callback(new Error('User not found'));
        }

        callback(null, user);
    });
};

// Logout route - GET method for navbar link and mobile overlay functionality
router.get('/logout', (req, res) => {
    try {
        res.clearCookie(TOKEN_COOKIE_NAME);
        res.redirect('/?message=Successfully logged out');
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'An error occurred during logout'
        });
    }
});

// Logout route - POST method for form submission
router.post('/logout', (req, res) => {
    try {
        res.clearCookie(TOKEN_COOKIE_NAME);
        res.redirect('/?message=Successfully logged out');
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'An error occurred during logout'
        });
    }
});

module.exports = router;