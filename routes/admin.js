const express = require('express');

const VALID_ROLES = ['customer', 'driver', 'admin'];

/**
 * createAdminRouter(db, authenticateToken, requireRole)
 *
 * Receives the shared sqlite3 db instance from app.js so it operates on
 * database.sqlite, not the separate database.db used by models/User.js.
 *
 * Routes:
 *   GET  /admin/users          — list all users with roles (admin only)
 *   POST /admin/users/:id/role — update a user's role (admin only)
 */
function createAdminRouter(db, authenticateToken, requireRole) {
    const router = express.Router();

    // GET /admin/users — list all users with roles
    router.get('/users', authenticateToken, requireRole('admin'), (req, res) => {
        db.all(
            'SELECT id, name, email, role, created_at FROM users ORDER BY id ASC',
            [],
            (err, users) => {
                if (err) {
                    console.error('Error fetching users:', err);
                    return res.status(500).json({ error: 'Internal server error' });
                }
                res.render('admin-users', { user: req.user, users: users || [] });
            }
        );
    });

    // POST /admin/users/:id/role — update a user's role, redirect to user list on success
    router.post('/users/:id/role', authenticateToken, requireRole('admin'), (req, res) => {
        const rawId = req.params.id;
        const parsedId = Number.parseInt(rawId, 10);

        if (!Number.isInteger(parsedId) || parsedId <= 0 || String(parsedId) !== String(rawId).trim()) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        const { role } = req.body;
        if (!role || !VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        db.run('UPDATE users SET role = ? WHERE id = ?', [role, parsedId], function (err) {
            if (err) {
                console.error('Error updating user role:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.redirect('/admin/users');
        });
    });

    return router;
}

module.exports = { createAdminRouter };
