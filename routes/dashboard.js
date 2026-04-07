const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const router = express.Router();

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
    db.get('SELECT id, name, email FROM users WHERE id = ?', [req.user.userId], (err, user) => {
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
            success: req.query.success
        });
    });
});

// Logout route
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/?message=Successfully logged out');
});

module.exports = router;