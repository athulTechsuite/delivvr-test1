const express = require('express');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const router = express.Router();

// Initialize database connection
const db = new sqlite3.Database(path.join(__dirname, '../database/users.db'));

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    
    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            res.clearCookie('token');
            return res.redirect('/login');
        }
        req.user = user;
        next();
    });
};

// Dashboard route - protected
router.get('/', authenticateToken, (req, res) => {
    // Get user details from database
    db.get('SELECT id, name, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).render('error', { 
                title: 'Error',
                message: 'Database error occurred'
            });
        }
        
        if (!user) {
            res.clearCookie('token');
            return res.redirect('/login');
        }

        res.render('dashboard', {
            title: 'Dashboard',
            user: user,
            success: req.query.success,
            layout: 'authenticated-layout'
        });
    });
});

// Profile route - protected
router.get('/profile', authenticateToken, (req, res) => {
    // Get user details from database
    db.get('SELECT id, name, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).render('error', { 
                title: 'Error',
                message: 'Database error occurred'
            });
        }
        
        if (!user) {
            res.clearCookie('token');
            return res.redirect('/login');
        }

        res.render('profile', {
            title: 'Profile',
            user: user,
            layout: 'authenticated-layout'
        });
    });
});

// Settings route - protected
router.get('/settings', authenticateToken, (req, res) => {
    // Get user details from database
    db.get('SELECT id, name, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).render('error', { 
                title: 'Error',
                message: 'Database error occurred'
            });
        }
        
        if (!user) {
            res.clearCookie('token');
            return res.redirect('/login');
        }

        res.render('settings', {
            title: 'Settings',
            user: user,
            layout: 'authenticated-layout'
        });
    });
});

// Logout route
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/?message=Successfully logged out');
});

module.exports = router;