const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const methodOverride = require('method-override');
const router = express.Router();

// Import database connection from config
const { db, dbHelpers } = require('../config/database');

// Method override middleware for handling PUT requests from forms
router.use(methodOverride('_method'));

// Configure multer for avatar uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/avatars/'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + req.user.userId + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Constants for validation
const VALIDATION_CONSTANTS = {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 50,
    BIO_MAX_LENGTH: 500,
    PHONE_MAX_LENGTH: 20,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_REGEX: /^[\d\s\-\(\)]+$/
};

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

// XSS prevention function
const sanitizeForXSS = (str) => {
    if (!str) return str;
    return str.replace(/[<>'"&]/g, function(match) {
        const escapeMap = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '&': '&amp;'
        };
        return escapeMap[match];
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

// Profile page route - protected
router.get('/profile', authenticateToken, (req, res) => {
    // Get full user profile including new fields
    db.get('SELECT id, name, email, phone, bio, avatar_url, created_at FROM users WHERE id = ?', [req.user.userId], (err, user) => {
        if (err) {
            console.error('Database error retrieving profile:', err);
            return res.status(500).render('error', {
                title: 'Error',
                message: 'Database error occurred while loading profile'
            });
        }
        
        if (!user) {
            res.clearCookie('token');
            return res.redirect('/login');
        }

        res.render('profile', {
            title: 'Profile',
            user: user,
            success: req.query.success,
            error: req.query.error
        });
    });
});

// Profile update route - protected with validation and file upload
router.put('/profile', 
    authenticateToken,
    upload.single('avatar'),
    [
        body('name')
            .trim()
            .notEmpty()
            .withMessage('Name is required')
            .isLength({ min: VALIDATION_CONSTANTS.NAME_MIN_LENGTH, max: VALIDATION_CONSTANTS.NAME_MAX_LENGTH })
            .withMessage(`Name must be between ${VALIDATION_CONSTANTS.NAME_MIN_LENGTH} and ${VALIDATION_CONSTANTS.NAME_MAX_LENGTH} characters`)
            .customSanitizer(sanitizeForXSS),
        
        body('email')
            .trim()
            .notEmpty()
            .withMessage('Email is required')
            .isEmail()
            .withMessage('Please provide a valid email address')
            .matches(VALIDATION_CONSTANTS.EMAIL_REGEX)
            .withMessage('Invalid email format')
            .normalizeEmail(),
        
        body('phone')
            .optional({ nullable: true, checkFalsy: true })
            .trim()
            .isLength({ max: VALIDATION_CONSTANTS.PHONE_MAX_LENGTH })
            .withMessage(`Phone number must not exceed ${VALIDATION_CONSTANTS.PHONE_MAX_LENGTH} characters`)
            .matches(VALIDATION_CONSTANTS.PHONE_REGEX)
            .withMessage('Phone number can only contain digits, spaces, dashes, and parentheses')
            .customSanitizer(sanitizeForXSS),
        
        body('bio')
            .optional({ nullable: true, checkFalsy: true })
            .trim()
            .isLength({ max: VALIDATION_CONSTANTS.BIO_MAX_LENGTH })
            .withMessage(`Bio must not exceed ${VALIDATION_CONSTANTS.BIO_MAX_LENGTH} characters`)
            .customSanitizer(sanitizeForXSS)
    ],
    (req, res) => {
        // Handle file upload errors
        if (req.fileValidationError) {
            const errorMsg = 'Invalid file type. Only image files are allowed.';
            
            if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                return res.status(400).json({
                    success: false,
                    message: errorMsg
                });
            }
            
            return res.redirect(`/dashboard/profile?error=${encodeURIComponent(errorMsg)}`);
        }

        // Handle validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(error => error.msg).join(', ');
            
            // Check if request is AJAX
            if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }
            
            return res.redirect(`/dashboard/profile?error=${encodeURIComponent(errorMessages)}`);
        }

        const { name, email, phone, bio } = req.body;
        const userId = req.user.userId;

        // Sanitize inputs - convert empty strings to null for optional fields
        const sanitizedPhone = phone && phone.trim() ? phone.trim() : null;
        const sanitizedBio = bio && bio.trim() ? bio.trim() : null;

        // Handle avatar upload
        const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : null;

        // Check if email is already taken by another user
        db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email.trim(), userId], (err, existingUser) => {
            if (err) {
                console.error('Database error checking email:', err);
                
                if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                    return res.status(500).json({
                        success: false,
                        message: 'Database error occurred'
                    });
                }
                
                return res.redirect('/dashboard/profile?error=Database error occurred');
            }

            if (existingUser) {
                const errorMsg = 'Email address is already in use by another account';
                
                if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                    return res.status(400).json({
                        success: false,
                        message: errorMsg
                    });
                }
                
                return res.redirect(`/dashboard/profile?error=${encodeURIComponent(errorMsg)}`);
            }

            // Build update query dynamically based on whether avatar was uploaded
            let updateQuery, params;
            
            if (avatarUrl) {
                updateQuery = 'UPDATE users SET name = ?, email = ?, phone = ?, bio = ?, avatar_url = ? WHERE id = ?';
                params = [name.trim(), email.trim(), sanitizedPhone, sanitizedBio, avatarUrl, userId];
            } else {
                updateQuery = 'UPDATE users SET name = ?, email = ?, phone = ?, bio = ? WHERE id = ?';
                params = [name.trim(), email.trim(), sanitizedPhone, sanitizedBio, userId];
            }

            db.run(updateQuery, params, function(err) {
                if (err) {
                    console.error('Database error updating profile:', err);
                    
                    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                        return res.status(500).json({
                            success: false,
                            message: 'Failed to update profile. Please try again.'
                        });
                    }
                    
                    return res.redirect('/dashboard/profile?error=Failed to update profile. Please try again.');
                }

                if (this.changes === 0) {
                    const errorMsg = 'No changes were made to your profile';
                    
                    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                        return res.status(400).json({
                            success: false,
                            message: errorMsg
                        });
                    }
                    
                    return res.redirect(`/dashboard/profile?error=${encodeURIComponent(errorMsg)}`);
                }

                const successMsg = 'Profile updated successfully';
                
                // Handle AJAX requests
                if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                    return res.json({
                        success: true,
                        message: successMsg,
                        user: {
                            name: name.trim(),
                            email: email.trim(),
                            phone: sanitizedPhone,
                            bio: sanitizedBio,
                            avatar_url: avatarUrl
                        }
                    });
                }
                
                res.redirect(`/dashboard/profile?success=${encodeURIComponent(successMsg)}`);
            });
        });
    }
);

// Alternative POST route for form submissions with method override
router.post('/profile', (req, res, next) => {
    if (req.body._method === 'PUT') {
        // Convert POST to PUT and forward to PUT handler
        req.method = 'PUT';
        return router.handle(req, res, next);
    }
    next();
});

// Avatar delete route
router.delete('/profile/avatar', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    
    db.run('UPDATE users SET avatar_url = NULL WHERE id = ?', [userId], function(err) {
        if (err) {
            console.error('Database error removing avatar:', err);
            
            if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to remove avatar. Please try again.'
                });
            }
            
            return res.redirect('/dashboard/profile?error=Failed to remove avatar. Please try again.');
        }

        if (this.changes === 0) {
            const errorMsg = 'No avatar found to remove';
            
            if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                return res.status(404).json({
                    success: false,
                    message: errorMsg
                });
            }
            
            return res.redirect(`/dashboard/profile?error=${encodeURIComponent(errorMsg)}`);
        }

        const successMsg = 'Avatar removed successfully';
        
        if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
            return res.json({
                success: true,
                message: successMsg
            });
        }
        
        res.redirect(`/dashboard/profile?success=${encodeURIComponent(successMsg)}`);
    });
});

// Logout route
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/?message=Successfully logged out');
});

module.exports = router;