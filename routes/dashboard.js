const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Dashboard route - protected
router.get('/', authenticateToken, (req, res) => {
    // Get user details from database — use req.user.id (app.js JWT convention)
    // Note: this route is a legacy parallel to the dashboard route in app.js.
    // If app.js handles /dashboard directly, this router may be unmounted.
    const db = require('../database/db');
    db.get('SELECT id, name, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).render('404');
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
