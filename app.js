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

// Database setup - use environment variable or fallback to default (matching dashboard.js expectations)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database/users.db');
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

// Middleware to add user data and current page to locals for sidebar layout
const addSidebarData = (req, res, next) => {
    if (req.user) {
        db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.userId], (err, user) => {
            if (err) {
                console.error('Database error in addSidebarData:', err);
                return res.redirect('/login');
            }
            if (!user) {
                return res.redirect('/login');
            }
            res.locals.user = user;
            res.locals.currentPage = req.route ? req.route.path : req.path;
            next();
        });
    } else {
        next();
    }
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
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.get('/dashboard', authenticateToken, addSidebarData, (req, res) => {
    try {
        res.render('sidebar-layout', { 
            title: 'Dashboard',
            currentPage: 'dashboard',
            user: res.locals.user,
            content: 'dashboard'
        });
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.redirect('/login');
    }
});

app.get('/profile', authenticateToken, addSidebarData, (req, res) => {
    try {
        res.render('sidebar-layout', { 
            title: 'Profile',
            currentPage: 'profile',
            user: res.locals.user,
            content: 'profile'
        });
    } catch (error) {
        console.error('Error rendering profile:', error);
        res.redirect('/login');
    }
});

app.get('/settings', authenticateToken, addSidebarData, (req, res) => {
    try {
        res.render('sidebar-layout', { 
            title: 'Settings',
            currentPage: 'settings',
            user: res.locals.user,
            content: 'settings'
        });
    } catch (error) {
        console.error('Error rendering settings:', error);
        res.redirect('/login');
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
                    console.error('Signup error:', err);
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
            console.error('Login database error:', err);
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
            
            // Generate JWT token - using userId to match routes/dashboard.js expectations
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
            console.error('Login error:', error);
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