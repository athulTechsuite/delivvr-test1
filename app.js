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

// User context middleware - makes user context available to all templates
app.use((req, res, next) => {
    const token = req.cookies.token;
    
    if (!token) {
        res.locals.user = null;
        return next();
    }
    
    try {
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                res.locals.user = null;
            } else {
                // Get user info from database for template context
                db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [decoded.userId], (dbErr, user) => {
                    if (dbErr || !user) {
                        res.locals.user = null;
                    } else {
                        res.locals.user = user;
                    }
                    next();
                });
                return;
            }
            next();
        });
    } catch (error) {
        console.error('Error in user context middleware:', error);
        res.locals.user = null;
        next();
    }
});

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

// Auth routes integration
try {
    app.use('/auth', require('./routes/auth'));
} catch (error) {
    console.warn('Auth routes not found, using inline auth routes');
}

// Routes
app.get('/', (req, res) => {
    try {
        res.render('index', { title: 'Home', error: null, success: null });
    } catch (error) {
        console.error('Error rendering home page:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/signup', (req, res) => {
    try {
        res.render('signup', { title: 'Sign Up', error: null, success: null });
    } catch (error) {
        console.error('Error rendering signup page:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/login', (req, res) => {
    try {
        res.render('login', { title: 'Login', error: null, success: null });
    } catch (error) {
        console.error('Error rendering login page:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/dashboard', authenticateToken, (req, res) => {
    if (!req.user || !req.user.userId) {
        return res.redirect('/login');
    }

    try {
        // Get user info from database
        db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.userId], (err, user) => {
            if (err) {
                console.error('Database error in dashboard route:', err);
                return res.status(500).render('error', { 
                    title: 'Error', 
                    error: 'Database error occurred',
                    success: null
                });
            }
            
            if (!user) {
                console.error('User not found in database for id:', req.user.userId);
                return res.redirect('/login');
            }
            
            try {
                res.render('dashboard', { 
                    title: 'Dashboard', 
                    user: user,
                    error: null,
                    success: null
                });
            } catch (renderError) {
                console.error('Error rendering dashboard template:', renderError);
                res.status(500).send('Error rendering dashboard page');
            }
        });
    } catch (error) {
        console.error('Error in dashboard route:', error);
        res.status(500).render('error', { 
            title: 'Error', 
            error: 'An unexpected error occurred',
            success: null
        });
    }
});

app.get('/logout', (req, res) => {
    try {
        res.render('logout', { 
            title: 'Logout', 
            user: null,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error rendering logout page:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/signup', signupValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('signup', { 
            title: 'Sign Up',
            error: errors.array()[0].msg,
            success: null
        });
    }

    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.render('signup', { 
            title: 'Sign Up',
            error: 'All fields are required',
            success: null
        });
    }
    
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
                            error: 'Email already exists',
                            success: null
                        });
                    }
                    return res.render('signup', { 
                        title: 'Sign Up',
                        error: 'Registration failed',
                        success: null
                    });
                }
                
                // Redirect to login page after successful registration
                res.redirect('/login');
            }
        );
    } catch (error) {
        console.error('Error during signup:', error);
        res.render('signup', { 
            title: 'Sign Up',
            error: 'Registration failed',
            success: null
        });
    }
});

app.post('/login', loginValidation, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', { 
            title: 'Login',
            error: errors.array()[0].msg,
            success: null
        });
    }

    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.render('login', { 
            title: 'Login',
            error: 'Email and password are required',
            success: null
        });
    }
    
    try {
        // Find user in database
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                console.error('Database error during login:', err);
                return res.render('login', { 
                    title: 'Login',
                    error: 'Login failed',
                    success: null
                });
            }
            
            if (!user) {
                return res.render('login', { 
                    title: 'Login',
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
                        error: 'Invalid email or password',
                        success: null
                    });
                }
                
                // Generate JWT token
                const token = jwt.sign(
                    { userId: user.id, email: user.email },
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
                console.error('Error comparing password during login:', error);
                res.render('login', { 
                    title: 'Login',
                    error: 'Login failed',
                    success: null
                });
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.render('login', { 
            title: 'Login',
            error: 'Login failed',
            success: null
        });
    }
});

app.post('/logout', (req, res) => {
    try {
        res.clearCookie('token');
        res.redirect('/');
    } catch (error) {
        console.error('Error during logout:', error);
        res.redirect('/');
    }
});

// Error handling middleware
app.use((req, res) => {
    try {
        res.status(404).render('404', { 
            title: 'Page Not Found',
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error rendering 404 page:', error);
        res.status(404).send('Page Not Found');
    }
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
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
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});