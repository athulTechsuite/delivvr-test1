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

    jwt.verify(finalToken, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
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
        jwt.verify(finalToken, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
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
    redirectIfAuthenticated
};