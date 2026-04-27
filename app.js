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

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        pickup_address TEXT NOT NULL,
        delivery_address TEXT NOT NULL,
        package_description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run('CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status)');
});

// Models
const Order = require('./models/Order');

// Order field length constants
const ADDRESS_MIN_LENGTH = 3;
const ADDRESS_MAX_LENGTH = 500;
const DESCRIPTION_MAX_LENGTH = 1000;

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

const orderValidation = [
    body('pickup_address')
        .exists({ checkFalsy: true })
        .withMessage('Pickup address is required')
        .bail()
        .trim()
        .isLength({ min: ADDRESS_MIN_LENGTH, max: ADDRESS_MAX_LENGTH })
        .withMessage(`Pickup address must be between ${ADDRESS_MIN_LENGTH} and ${ADDRESS_MAX_LENGTH} characters`),
    body('delivery_address')
        .exists({ checkFalsy: true })
        .withMessage('Delivery address is required')
        .bail()
        .trim()
        .isLength({ min: ADDRESS_MIN_LENGTH, max: ADDRESS_MAX_LENGTH })
        .withMessage(`Delivery address must be between ${ADDRESS_MIN_LENGTH} and ${ADDRESS_MAX_LENGTH} characters`),
    body('package_description')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: DESCRIPTION_MAX_LENGTH })
        .withMessage(`Package description must be at most ${DESCRIPTION_MAX_LENGTH} characters`)
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
    db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) {
            console.error('Database error loading dashboard user:', err);
            return res.redirect('/login');
        }
        if (!user) {
            return res.redirect('/login');
        }

        try {
            const [activeDeliveriesCount, pendingPickupsCount, deliveredCount] = await Promise.all([
                Order.countActiveByUserId(req.user.id),
                Order.countPendingByUserId(req.user.id),
                Order.countDeliveredByUserId(req.user.id).catch((err) => {
                    console.error('Error loading delivered count:', err);
                    return 0;
                })
            ]);
            res.render('dashboard', {
                user,
                activeDeliveriesCount,
                pendingPickupsCount,
                deliveredCount
            });
        } catch (statsErr) {
            console.error('Error loading dashboard stats:', statsErr);
            res.render('dashboard', {
                user,
                activeDeliveriesCount: 0,
                pendingPickupsCount: 0,
                deliveredCount: 0
            });
        }
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
    db.get('SELECT name, email, created_at FROM users WHERE id = ?', [userId], (err, user) => {
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

// Order routes (authenticated)
app.get('/orders/new', authenticateToken, (req, res) => {
    res.render('orders-new', {
        user: req.user,
        errors: [],
        values: { pickup_address: '', delivery_address: '', package_description: '' }
    });
});

app.post('/orders', authenticateToken, orderValidation, async (req, res) => {
    const errors = validationResult(req);
    const submitted = {
        pickup_address: typeof req.body.pickup_address === 'string' ? req.body.pickup_address : '',
        delivery_address: typeof req.body.delivery_address === 'string' ? req.body.delivery_address : '',
        package_description: typeof req.body.package_description === 'string' ? req.body.package_description : ''
    };

    if (!errors.isEmpty()) {
        return res.status(400).render('orders-new', {
            user: req.user,
            errors: errors.array(),
            values: submitted
        });
    }

    try {
        await Order.create(req.user.id, {
            pickup_address: submitted.pickup_address,
            delivery_address: submitted.delivery_address,
            package_description: submitted.package_description
        });
        return res.redirect('/orders');
    } catch (createErr) {
        console.error('Error creating order:', createErr);
        return res.status(500).render('orders-new', {
            user: req.user,
            errors: [{ msg: 'Unable to place order. Please try again.' }],
            values: submitted
        });
    }
});

app.get('/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await Order.findByUserId(req.user.id);
        res.render('orders-list', { user: req.user, orders });
    } catch (listErr) {
        console.error('Error loading orders list:', listErr);
        res.render('orders-list', { user: req.user, orders: [] });
    }
});

// IMPORTANT: register `/orders/:id` AFTER `/orders/new` and `/orders` so the
// static `new` segment and the list route are not shadowed by the `:id` param.
app.get('/orders/:id', authenticateToken, async (req, res) => {
    const rawId = req.params.id;
    const parsedId = Number.parseInt(rawId, 10);

    // Reject any id that isn't a strictly-positive integer (also rejects
    // non-numeric input like "abc" because Number.parseInt would NaN, and
    // rejects strings like "12abc" by checking string equality).
    if (
        !Number.isInteger(parsedId) ||
        parsedId <= 0 ||
        String(parsedId) !== String(rawId).trim()
    ) {
        return res.status(404).render('404');
    }

    try {
        const order = await Order.findById(parsedId);
        if (!order) {
            return res.status(404).render('404');
        }
        // Tenant isolation: leak nothing to other users — return 404, not 403.
        if (order.user_id !== req.user.id) {
            return res.status(404).render('404');
        }
        return res.render('orders-detail', { user: req.user, order });
    } catch (detailErr) {
        console.error('Error loading order detail:', detailErr);
        return res.status(404).render('404');
    }
});

app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

// Health / liveness endpoint — unauthenticated, DB-independent.
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((req, res) => {
    res.status(404).render('404');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server (skip when required as a module, e.g. from tests)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;

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