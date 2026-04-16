require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Constants
const MAX_FILE_SIZE = 5242880; // 5MB in bytes
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];
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
}

// Multer configuration for profile picture upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const userId = req.user.id;
        const timestamp = Date.now();
        cb(null, `${userId}-${timestamp}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed'));
    }
};

const uploadProfilePicture = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: fileFilter
});

// Database setup - use environment variable or fallback to default
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Create users table if it doesn't exist
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
app.use('/uploads', express.static(UPLOADS_DIR));

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
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
];

// Helper function to delete old profile picture
const deleteOldProfilePicture = (profilePicturePath) => {
    if (profilePicturePath) {
        const fullPath = path.join(__dirname, 'public', profilePicturePath);
        fs.unlink(fullPath, (err) => {
            if (err && err.code !== 'ENOENT') {
                console.error('Error deleting old profile picture:', err);
            }
        });
    }
};

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
    
    // Get user information from database including profile picture
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
            success: null,
            errors: null
        });
    });
});

app.post('/profile', authenticateToken, uploadProfilePicture.single('profilePicture'), profileUpdateValidation, (req, res) => {
    const errors = validationResult(req);
    const userId = req.user.id;
    
    // Validate user ID
    if (!userId || typeof userId !== 'number') {
        return res.status(401).redirect('/login');
    }
    
    // Check for validation errors
    if (!errors.isEmpty()) {
        // Get current user data to re-render form
        db.get('SELECT name, email, created_at, profile_picture FROM users WHERE id = ?', [userId], (err, user) => {
            if (err || !user) {
                return res.redirect('/login');
            }
            return res.render('profile', {
                user: user,
                title: 'Profile',
                success: null,
                errors: errors.array()
            });
        });
        return;
    }
    
    const { name, email } = req.body;
    
    // Get current user data to check for existing profile picture
    db.get('SELECT email, profile_picture FROM users WHERE id = ?', [userId], (err, currentUser) => {
        if (err) {
            console.error('Database error fetching current user data:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if email is being changed and if it's already taken by another user
        if (email !== currentUser.email) {
            db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId], (err, existingUser) => {
                if (err) {
                    console.error('Database error checking email uniqueness:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (existingUser) {
                    // Get current user data to re-render form
                    db.get('SELECT name, email, created_at, profile_picture FROM users WHERE id = ?', [userId], (err, user) => {
                        if (err || !user) {
                            return res.redirect('/login');
                        }
                        return res.render('profile', {
                            user: user,
                            title: 'Profile',
                            success: null,
                            errors: [{ msg: 'Email address is already in use' }]
                        });
                    });
                    return;
                }
                
                // Email is unique, proceed with update
                updateUserProfile();
            });
        } else {
            // Email not changed, proceed with update
            updateUserProfile();
        }
        
        function updateUserProfile() {
            let profilePicturePath = currentUser.profile_picture;
            let query = 'UPDATE users SET name = ?, email = ?';
            let params = [name, email];
            
            // Handle profile picture upload
            if (req.file) {
                profilePicturePath = `uploads/${req.file.filename}`;
                query += ', profile_picture = ?';
                params.push(profilePicturePath);
                
                // Delete old profile picture if it exists
                if (currentUser.profile_picture) {
                    deleteOldProfilePicture(currentUser.profile_picture);
                }
            }
            
            query += ' WHERE id = ?';
            params.push(userId);
            
            // Update user in database
            db.run(query, params, function(err) {
                if (err) {
                    console.error('Database error updating profile:', err);
                    
                    // Delete uploaded file if database update fails
                    if (req.file) {
                        fs.unlink(req.file.path, (unlinkErr) => {
                            if (unlinkErr) {
                                console.error('Error deleting uploaded file after database error:', unlinkErr);
                            }
                        });
                    }
                    
                    // Get current user data to re-render form
                    db.get('SELECT name, email, created_at, profile_picture FROM users WHERE id = ?', [userId], (err, user) => {
                        if (err || !user) {
                            return res.redirect('/login');
                        }
                        return res.render('profile', {
                            user: user,
                            title: 'Profile',
                            success: null,
                            errors: [{ msg: 'Failed to update profile' }]
                        });
                    });
                    return;
                }
                
                // Get updated user data
                db.get('SELECT name, email, created_at, profile_picture FROM users WHERE id = ?', [userId], (err, updatedUser) => {
                    if (err) {
                        console.error('Database error fetching updated user data:', err);
                        return res.redirect('/login');
                    }
                    
                    if (!updatedUser) {
                        return res.redirect('/login');
                    }
                    
                    // Render profile with success message
                    res.render('profile', {
                        user: updatedUser,
                        title: 'Profile',
                        success: 'Profile updated successfully',
                        errors: null
                    });
                });
            });
        }
    });
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

// Error handling middleware
app.use((req, res) => {
    res.status(404).render('404');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // Handle multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            // Get current user data to re-render form
            if (req.user && req.user.id) {
                db.get('SELECT name, email, created_at, profile_picture FROM users WHERE id = ?', [req.user.id], (dbErr, user) => {
                    if (dbErr || !user) {
                        return res.redirect('/login');
                    }
                    return res.render('profile', {
                        user: user,
                        title: 'Profile',
                        success: null,
                        errors: [{ msg: 'File size too large. Maximum size is 5MB.' }]
                    });
                });
                return;
            }
        }
    }
    
    // Handle file filter errors
    if (err.message.includes('Only image files')) {
        if (req.user && req.user.id) {
            db.get('SELECT name, email, created_at, profile_picture FROM users WHERE id = ?', [req.user.id], (dbErr, user) => {
                if (dbErr || !user) {
                    return res.redirect('/login');
                }
                return res.render('profile', {
                    user: user,
                    title: 'Profile',
                    success: null,
                    errors: [{ msg: err.message }]
                });
            });
            return;
        }
    }
    
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