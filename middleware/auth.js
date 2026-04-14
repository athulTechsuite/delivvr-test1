require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Constants
const TOKEN_REFRESH_THRESHOLD_SECONDS = 3600; // 1 hour
const JWT_EXPIRY_DAYS = 7;
const COOKIE_OPTIONS_SECURE = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
};

// In-memory mutex for preventing concurrent refresh operations per user
const refreshMutex = new Map();

/**
 * Check if JWT token needs refresh (expires in less than 1 hour)
 * @param {Object} decodedToken - Decoded JWT token object
 * @returns {boolean} - True if token needs refresh
 */
const tokenNeedsRefresh = (decodedToken) => {
    if (!decodedToken || !decodedToken.exp) {
        return false;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decodedToken.exp - currentTime;
    
    return timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD_SECONDS;
};

/**
 * Refresh user token using refresh token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token from cookie
 * @returns {Object} - New user object or null if refresh failed
 */
const refreshUserToken = async (req, res, userId, refreshToken) => {
    if (!userId || !refreshToken) {
        return null;
    }

    // Check for concurrent refresh operations
    const mutexKey = `refresh_${userId}`;
    if (refreshMutex.has(mutexKey)) {
        // Wait for concurrent refresh to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        return null;
    }

    refreshMutex.set(mutexKey, true);

    try {
        // Validate refresh token exists and format
        if (typeof refreshToken !== 'string' || refreshToken.length !== 64) {
            return null;
        }

        // Find user and validate refresh token
        const user = await User.findById(userId);
        if (!user) {
            return null;
        }

        // Check if refresh token is valid
        const isValidRefreshToken = await user.validateRefreshToken(refreshToken);
        if (!isValidRefreshToken) {
            return null;
        }

        // Check if refresh token is expired
        if (user.token_expires_at && new Date() > new Date(user.token_expires_at)) {
            await user.clearRefreshToken();
            return null;
        }

        // Generate new JWT with 7-day expiration
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET environment variable is not set');
            return null;
        }

        const newToken = jwt.sign(
            { 
                userId: user._id.toString(),
                email: user.email
            }, 
            jwtSecret, 
            { expiresIn: `${JWT_EXPIRY_DAYS}d` }
        );

        // Generate new refresh token
        const newRefreshTokenData = await user.generateRefreshToken();

        // Set new cookies
        res.cookie('token', newToken, COOKIE_OPTIONS_SECURE);
        res.cookie('refresh_token', newRefreshTokenData.refreshToken, COOKIE_OPTIONS_SECURE);

        return {
            userId: user._id.toString(),
            email: user.email
        };

    } catch (error) {
        console.error('Token refresh error:', error.message);
        return null;
    } finally {
        refreshMutex.delete(mutexKey);
    }
};

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
const clearAuthCookies = (res) => {
    res.clearCookie('token');
    res.clearCookie('refresh_token');
};

const authenticateToken = async (req, res, next) => {
    try {
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

        // Verify JWT token
        let decodedToken;
        try {
            decodedToken = jwt.verify(finalToken, jwtSecret);
        } catch (jwtError) {
            clearAuthCookies(res);
            return res.redirect('/login');
        }

        // Check if token needs refresh
        if (tokenNeedsRefresh(decodedToken)) {
            const refreshToken = req.cookies && req.cookies.refresh_token;
            
            if (refreshToken) {
                // Attempt to refresh token
                const refreshedUser = await refreshUserToken(req, res, decodedToken.userId, refreshToken);
                
                if (refreshedUser) {
                    req.user = refreshedUser;
                    return next();
                } else {
                    // Refresh failed, clear cookies and redirect to login
                    clearAuthCookies(res);
                    return res.redirect('/login');
                }
            }
        }

        // Token is valid and doesn't need refresh, or no refresh token available
        req.user = {
            userId: decodedToken.userId,
            email: decodedToken.email
        };
        next();

    } catch (error) {
        console.error('Authentication error:', error.message);
        clearAuthCookies(res);
        return res.redirect('/login');
    }
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
    redirectIfAuthenticated,
    clearAuthCookies
};