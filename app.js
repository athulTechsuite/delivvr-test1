require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Constants
const SALT_ROUNDS = 10;
const JWT_EXPIRY = '24h';
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;

// Ensure JWT_SECRET is provided - fail if not set
if (!process.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable must be set');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// Database setup - use environment variable or fallback to default
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Database helpers
const dbHelpers = {
    updateUserName: (userId, name) => {
        return new Promise((resolve, reject) => {
            db.run('UPDATE users SET name = ? WHERE id = ?', [name, userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },
    
    updateUserPassword: (userId, hashedPassword) => {
        return new Promise((resolve, reject) => {
            db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    },
    
    getUserById: (userId) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT id, name, email, password, created_at FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(user);
                }
            });
        });
    }
};

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
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
        .isLength({ min: MIN_NAME_LENGTH, max: MAX_NAME_LENGTH })
        .withMessage(`Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters`)
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })
        .withMessage(`Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`)
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

const profileNameValidation = [
    body('name')
        .trim()
        .isLength({ min: MIN_NAME_LENGTH, max: MAX_NAME_LENGTH })
        .withMessage(`Name must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters`)
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces')
];

const profilePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })
        .withMessage(`New password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
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
    
    // Get user information from database using parameterized query
    db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [userId], (err, user) => {
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
            title: 'Profile'
        });
    });
});

app.post('/profile/update-name', authenticateToken, profileNameValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            error: errors.array()[0].msg 
        });
    }

    const { name } = req.body;
    const userId = req.user.id;

    if (!userId || typeof userId !== 'number') {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid user session' 
        });
    }

    if (!name || typeof name !== 'string') {
        return res.status(400).json({ 
            success: false, 
            error: 'Name is required' 
        });
    }

    try {
        const changedRows = await dbHelpers.updateUserName(userId, name.trim());
        
        if (changedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Name updated successfully',
            name: name.trim()
        });
    } catch (error) {
        console.error('Error updating user name:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update name' 
        });
    }
});

app.post('/profile/update-password', authenticateToken, profilePasswordValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            error: errors.array()[0].msg 
        });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!userId || typeof userId !== 'number') {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid user session' 
        });
    }

    if (!currentPassword || typeof currentPassword !== 'string') {
        return res.status(400).json({ 
            success: false, 
            error: 'Current password is required' 
        });
    }

    if (!newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({ 
            success: false, 
            error: 'New password is required' 
        });
    }

    try {
        // Get user's current password from database
        const user = await dbHelpers.getUserById(userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (!passwordMatch) {
            return res.status(400).json({ 
                success: false, 
                error: 'Current password is incorrect' 
            });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        
        // Update password in database
        const changedRows = await dbHelpers.updateUserPassword(userId, hashedNewPassword);
        
        if (changedRows === 0) {
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to update password' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Password updated successfully' 
        });
    } catch (error) {
        console.error('Error updating user password:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update password' 
        });
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
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        
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
                { expiresIn: JWT_EXPIRY }
            );
            
            // Set cookie and redirect to dashboard
            res.cookie('token', token, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production',
                maxAge: COOKIE_MAX_AGE
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