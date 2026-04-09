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

// Ensure JWT_SECRET is provided - fail if not set
if (!process.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable must be set');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

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

// User context middleware for all routes
const getUserContext = (req, res, next) => {
    const token = req.cookies.token;
    
    if (!token) {
        req.user = null;
        return next();
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
};

// Flash message middleware
const flashMessages = (req, res, next) => {
    res.locals.error = req.cookies.error || null;
    res.locals.success = req.cookies.success || null;
    
    // Clear flash message cookies after reading
    if (req.cookies.error) {
        res.clearCookie('error');
    }
    if (req.cookies.success) {
        res.clearCookie('success');
    }
    
    next();
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

// Routes
app.get('/', getUserContext, flashMessages, (req, res) => {
    res.render('index', {
        title: 'Home',
        user: req.user,
        error: res.locals.error,
        success: res.locals.success
    });
});

app.get('/signup', getUserContext, flashMessages, (req, res) => {
    res.render('signup', {
        title: 'Sign Up',
        user: req.user,
        error: res.locals.error,
        success: res.locals.success
    });
});

app.get('/login', getUserContext, flashMessages, (req, res) => {
    res.render('login', {
        title: 'Login',
        user: req.user,
        error: res.locals.error,
        success: res.locals.success
    });
});

app.get('/dashboard', authenticateToken, flashMessages, (req, res) => {
    // Get user info from database
    db.get('SELECT name, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error(err);
            return res.redirect('/login');
        }
        res.render('dashboard', {
            title: 'Dashboard',
            user: user,
            error: res.locals.error,
            success: res.locals.success
        });
    });
});

app.get('/logout', getUserContext, flashMessages, (req, res) => {
    try {
        res.render('logout', {
            title: 'Logout',
            user: req.user,
            error: res.locals.error,
            success: res.locals.success
        });
    } catch (error) {
        console.error('Error rendering logout page:', error);
        res.status(500).send('Failed to render logout page');
    }
});

app.post('/signup', getUserContext, signupValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('signup', {
            title: 'Sign Up',
            user: req.user,
            error: errors.array()[0].msg,
            success: null
        });
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
                    console.error('Database error during signup:', err);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.render('signup', {
                            title: 'Sign Up',
                            user: req.user,
                            error: 'Email already exists',
                            success: null
                        });
                    }
                    return res.render('signup', {
                        title: 'Sign Up',
                        user: req.user,
                        error: 'Registration failed. Please try again.',
                        success: null
                    });
                }
                
                // Set success flash message and redirect to login
                res.cookie('success', 'Account created successfully! Please log in.', {
                    httpOnly: true,
                    maxAge: 5000 // 5 seconds
                });
                res.redirect('/login');
            }
        );
    } catch (error) {
        console.error('Unexpected error during signup:', error);
        res.render('signup', {
            title: 'Sign Up',
            user: req.user,
            error: 'Registration failed. Please try again.',
            success: null
        });
    }
});

app.post('/login', getUserContext, loginValidation, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', {
            title: 'Login',
            user: req.user,
            error: errors.array()[0].msg,
            success: null
        });
    }

    const { email, password } = req.body;
    
    // Find user in database
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.render('login', {
                title: 'Login',
                user: req.user,
                error: 'Login failed. Please try again.',
                success: null
            });
        }
        
        if (!user) {
            return res.render('login', {
                title: 'Login',
                user: req.user,
                error: 'Invalid email or password',
                success: null
            });
        }
        
        try {
            // Compare password
            const passwordMatch = await bcrypt.compare(password, user.password);
            
            if (!passwordMatch) {
                return res.render('login', {
                    title: 'Login',
                    user: req.user,
                    error: 'Invalid email or password',
                    success: null
                });
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
            
            // Set success flash message
            res.cookie('success', 'Login successful! Welcome to your dashboard.', {
                httpOnly: true,
                maxAge: 5000 // 5 seconds
            });
            
            res.redirect('/dashboard');
        } catch (error) {
            console.error('Unexpected error during login:', error);
            res.render('login', {
                title: 'Login',
                user: req.user,
                error: 'Login failed. Please try again.',
                success: null
            });
        }
    });
});

app.post('/logout', (req, res) => {
    try {
        // Clear the JWT token cookie
        res.clearCookie('token');
        
        // Set success flash message
        res.cookie('success', 'You have been logged out successfully.', {
            httpOnly: true,
            maxAge: 5000 // 5 seconds
        });
        
        // Redirect to home page
        res.redirect('/');
    } catch (error) {
        console.error('Error during logout:', error);
        res.cookie('error', 'An error occurred during logout.', {
            httpOnly: true,
            maxAge: 5000 // 5 seconds
        });
        res.redirect('/');
    }
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