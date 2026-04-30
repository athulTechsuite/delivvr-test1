/**
 * requireRole(...roles) — factory returning Express middleware that enforces
 * role-based access. Must be used AFTER authenticateToken so req.user is set.
 *
 * Usage:
 *   app.patch('/orders/:id/status', authenticateToken, requireRole('driver', 'admin'), handler)
 *
 * If req.user.role is undefined or missing (legacy JWT issued before the role
 * claim was added), the caller is treated as 'customer' to avoid a 500 crash.
 */
const requireRole = (...roles) => (req, res, next) => {
    const userRole = (req.user && req.user.role) || 'customer';
    if (!roles.includes(userRole)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

module.exports = { requireRole };
