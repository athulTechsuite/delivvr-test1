require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Constants
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure JWT_SECRET is provided - fail if not set
if (!process.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable must be set');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('Created uploads directory:', UPLOADS_DIR);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const userId = req.user.id;
        const fileExtension = path.extname(file.originalname);
        const filename = `${userId}_${timestamp}${fileExtension}`;
        cb(null, filename);
    }
});

const fileFilter = function (req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type (JPG/PNG only)'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: fileFilter
});

// Database setup - use environment variable or fallback to default
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Database migration and initialization
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add profile_picture column if it doesn't exist
    db.run(`ALTER TABLE users ADD COLUMN profile_picture TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding profile_picture column:', err);
        }
    });
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    
    if (!token) {
        return res.redirect('/login');
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.redirect('/login');
        }
        req.user = user;
        next();
    });
};

// Validation middleware
const signupValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 6, max: 128 })
        .withMessage('Password must be between 6 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

const loginValidation = [
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

const profileUpdateValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    body('email')
        .optional()
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
];

const passwordChangeValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6, max: 128 })
        .withMessage('Password must be between 6 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Password confirmation does not match');
            }
            return true;
        })
];

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.get('/dashboard', authenticateToken, (req, res) => {
    // Get user info from database
    db.get('SELECT name, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error(err);
            return res.redirect('/login');
        }
        res.render('dashboard', { user });
    });
});

app.get('/profile', authenticateToken, (req, res) => {
    // Validate user ID from JWT token
    const userId = req.user.id;
    
    if (!userId || typeof userId !== 'number') {
        console.error('Invalid user ID in JWT token:', userId);
        return res.redirect('/login');
    }
    
    // Get user information from database with profile_picture
    db.get('SELECT name, email, created_at, profile_picture FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Database error fetching user profile:', err);
            return res.redirect('/login');
        }
        
        // Handle case where user is not found
        if (!user) {
            console.error('User not found for ID:', userId);
            return res.redirect('/login');
        }
        
        // Validate user data before rendering
        if (!user.name || !user.email || !user.created_at) {
            console.error('Incomplete user data:', user);
            return res.redirect('/login');
        }
        
        // Render profile template with user data
        res.render('profile', { 
            user: user,
            title: 'Profile',
            success: req.query.success || null,
            error: req.query.error || null
        });
    });
});

app.post('/profile', authenticateToken, upload.single('profilePicture'), profileUpdateValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Clean up uploaded file if validation fails
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }
        return res.redirect(`/profile?error=${encodeURIComponent(errors.array()[0].msg)}`);
    }

    const userId = req.user.id;
    const { name, email } = req.body;
    
    try {
        // Get current user data
        const currentUser = await new Promise((resolve, reject) => {
            db.get('SELECT name, email, profile_picture FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!currentUser) {
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error deleting uploaded file:', err);
                });
            }
            return res.redirect('/profile?error=User not found');
        }

        // Build update query dynamically based on what fields are being updated
        const updates = [];
        const values = [];
        
        if (name && name.trim() !== currentUser.name) {
            updates.push('name = ?');
            values.push(name.trim());
        }
        
        if (email && email.trim() !== currentUser.email) {
            updates.push('email = ?');
            values.push(email.trim());
        }

        let newProfilePicture = currentUser.profile_picture;
        
        if (req.file) {
            // Delete old profile picture if it exists
            if (currentUser.profile_picture) {
                const oldFilePath = path.join(__dirname, 'public', currentUser.profile_picture);
                fs.unlink(oldFilePath, (err) => {
                    if (err && err.code !== 'ENOENT') {
                        console.error('Error deleting old profile picture:', err);
                    }
                });
            }
            
            // Set new profile picture path
            newProfilePicture = `uploads/${req.file.filename}`;
            updates.push('profile_picture = ?');
            values.push(newProfilePicture);
        }

        // If no updates to make, redirect back
        if (updates.length === 0) {
            return res.redirect('/profile');
        }

        // Add user ID for WHERE clause
        values.push(userId);
        
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        
        await new Promise((resolve, reject) => {
            db.run(query, values, function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        reject(new Error('This email is already registered to another account'));
                    } else {
                        reject(err);
                    }
                } else {
                    resolve();
                }
            });
        });

        res.redirect('/profile?success=Profile updated successfully');
        
    } catch (error) {
        console.error('Profile update error:', error);
        
        // Clean up uploaded file on error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }
        
        const errorMessage = error.message === 'This email is already registered to another account' 
            ? error.message 
            : 'Unable to update profile. Please try again.';
        
        res.redirect(`/profile?error=${encodeURIComponent(errorMessage)}`);
    }
});

app.post('/profile/password', authenticateToken, passwordChangeValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.redirect(`/profile?error=${encodeURIComponent(errors.array()[0].msg)}`);
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    try {
        // Get current user data
        const currentUser = await new Promise((resolve, reject) => {
            db.get('SELECT password FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!currentUser) {
            return res.redirect('/profile?error=User not found');
        }

        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, currentUser.password);
        
        if (!passwordMatch) {
            return res.redirect('/profile?error=Current password is incorrect');
        }
        
        // Hash new password
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Update password in database
        await new Promise((resolve, reject) => {
            db.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        res.redirect('/profile?success=Password updated successfully');
        
    } catch (error) {
        console.error('Password update error:', error);
        res.redirect('/profile?error=Unable to update password. Please try again.');
    }
});

app.post('/signup', signupValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('signup', { error: errors.array()[0].msg });
    }

    const { name, email, password } = req.body;
    
    try {
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Insert user into database
        db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
            [name, email, hashedPassword], 
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.render('signup', { error: 'Email already exists' });
                    }
                    console.error('Database error during signup:', err);
                    return res.render('signup', { error: 'Registration failed' });
                }
                
                // Redirect to login page after successful registration
                res.redirect('/login');
            }
        );
    } catch (error) {
        console.error('Signup error:', error);
        res.render('signup', { error: 'Registration failed' });
    }
});

app.post('/login', loginValidation, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', { error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    
    // Find user in database
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error(err);
            return res.render('login', { error: 'Login failed' });
        }
        
        if (!user) {
            return res.render('login', { error: 'Invalid email or password' });
        }
        
        try {
            // Compare password
            const passwordMatch = await bcrypt.compare(password, user.password);
            
            if (!passwordMatch) {
                return res.render('login', { error: 'Invalid email or password' });
            }
            
            // Generate JWT token
            const token = jwt.sign(
                { id: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            // Set cookie and redirect to dashboard
            res.cookie('token', token, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            
            res.redirect('/dashboard');
        } catch (error) {
            console.error(error);
            res.render('login', { error: 'Login failed' });
        }
    });
});

app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

// Error handling for multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.redirect('/profile?error=File too large (max 2MB)');
        }
    } else if (error.message === 'Invalid file type (JPG/PNG only)') {
        return res.redirect('/profile?error=Invalid file type (JPG/PNG only)');
    }
    next(error);
});

// Error handling middleware
app.use((req, res) => {
    res.status(404).render('404');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});