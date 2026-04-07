require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Constants
const MOBILE_BREAKPOINT = 768;
const JWT_EXPIRY = '24h';
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const BCRYPT_SALT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 128;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const MAX_USER_ID = 2147483647; // Max 32-bit integer

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

// User ID validation and sanitization function
const validateAndSanitizeUserId = (userId) => {
    // Validate that userId exists and is a number
    if (userId === null || userId === undefined) {
        throw new Error('User ID is required');
    }
    
    // Convert to number if it's a string
    const numericId = Number(userId);
    
    // Validate that it's a valid integer
    if (!Number.isInteger(numericId) || numericId <= 0 || numericId > MAX_USER_ID) {
        throw new Error('Invalid user ID format');
    }
    
    return numericId;
};

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
        
        try {
            // Validate and sanitize user ID from token
            user.id = validateAndSanitizeUserId(user.id);
            req.user = user;
            next();
        } catch (error) {
            console.error('Invalid user ID in token:', error);
            return res.redirect('/login');
        }
    });
};

// Middleware to add layout context for authenticated routes
const addLayoutContext = (req, res, next) => {
    res.locals.isAuthenticated = !!req.user;
    res.locals.currentPage = req.route?.path || req.path;
    next();
};

// Ensure required view files exist
const ensureViewFilesExist = () => {
    const viewsDir = path.join(__dirname, 'views');
    const layoutsDir = path.join(viewsDir, 'layouts');
    
    // Create directories if they don't exist
    if (!fs.existsSync(viewsDir)) {
        fs.mkdirSync(viewsDir, { recursive: true });
    }
    if (!fs.existsSync(layoutsDir)) {
        fs.mkdirSync(layoutsDir, { recursive: true });
    }
    
    // Create authenticated-layout.ejs if it doesn't exist
    const authenticatedLayoutPath = path.join(layoutsDir, 'authenticated-layout.ejs');
    if (!fs.existsSync(authenticatedLayoutPath)) {
        const authenticatedLayoutContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title || 'Dashboard' %></title>
    <link rel="stylesheet" href="/css/style.css">
    <style>
        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            width: 250px;
            background: #2c3e50;
            color: white;
            transform: translateX(0);
            transition: transform 0.3s ease-in-out;
            z-index: 1000;
        }
        
        .sidebar.closed {
            transform: translateX(-100%);
        }
        
        .sidebar-header {
            padding: 20px;
            border-bottom: 1px solid #34495e;
        }
        
        .sidebar-nav {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .sidebar-nav li {
            border-bottom: 1px solid #34495e;
        }
        
        .sidebar-nav a {
            display: block;
            padding: 15px 20px;
            color: white;
            text-decoration: none;
            transition: background-color 0.3s ease;
        }
        
        .sidebar-nav a:hover,
        .sidebar-nav a.active {
            background-color: #34495e;
        }
        
        .main-content {
            margin-left: 250px;
            padding: 20px;
            transition: margin-left 0.3s ease-in-out;
            min-height: 100vh;
        }
        
        .main-content.sidebar-closed {
            margin-left: 0;
        }
        
        .hamburger {
            display: none;
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1001;
            background: #2c3e50;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        }
        
        .overlay.active {
            opacity: 1;
        }
        
        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
            }
            
            .sidebar.open {
                transform: translateX(0);
            }
            
            .main-content {
                margin-left: 0;
            }
            
            .hamburger {
                display: block;
            }
            
            .overlay {
                display: block;
            }
        }
    </style>
</head>
<body>
    <button class="hamburger" id="hamburger" aria-label="Toggle menu">
        <span>☰</span>
    </button>
    
    <div class="overlay" id="overlay"></div>
    
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h2>Dashboard</h2>
        </div>
        <nav>
            <ul class="sidebar-nav">
                <li><a href="/dashboard" class="<%= currentPage === '/dashboard' ? 'active' : '' %>">Dashboard</a></li>
                <li><a href="/profile" class="<%= currentPage === '/profile' ? 'active' : '' %>">Profile</a></li>
                <li><a href="/settings" class="<%= currentPage === '/settings' ? 'active' : '' %>">Settings</a></li>
                <li>
                    <form method="POST" action="/logout" style="margin: 0;">
                        <button type="submit" style="width: 100%; background: none; border: none; color: white; padding: 15px 20px; text-align: left; cursor: pointer; transition: background-color 0.3s ease;">
                            Logout
                        </button>
                    </form>
                </li>
            </ul>
        </nav>
    </aside>
    
    <main class="main-content" id="mainContent">
        <%- body %>
    </main>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const hamburger = document.getElementById('hamburger');
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('overlay');
            const mainContent = document.getElementById('mainContent');
            
            let isMobile = window.innerWidth <= 768;
            
            // Handle window resize
            window.addEventListener('resize', function() {
                const wasMobile = isMobile;
                isMobile = window.innerWidth <= 768;
                
                if (wasMobile !== isMobile) {
                    // Reset states when switching between mobile/desktop
                    if (!isMobile) {
                        sidebar.classList.remove('open', 'closed');
                        overlay.classList.remove('active');
                        mainContent.classList.remove('sidebar-closed');
                    } else {
                        sidebar.classList.remove('open');
                        overlay.classList.remove('active');
                    }
                }
            });
            
            // Hamburger menu functionality
            hamburger.addEventListener('click', function() {
                if (isMobile) {
                    const isOpen = sidebar.classList.contains('open');
                    
                    if (isOpen) {
                        // Close sidebar
                        sidebar.classList.remove('open');
                        overlay.classList.remove('active');
                    } else {
                        // Open sidebar
                        sidebar.classList.add('open');
                        overlay.classList.add('active');
                    }
                } else {
                    // Desktop toggle
                    const isClosed = sidebar.classList.contains('closed');
                    
                    if (isClosed) {
                        // Open sidebar
                        sidebar.classList.remove('closed');
                        mainContent.classList.remove('sidebar-closed');
                    } else {
                        // Close sidebar
                        sidebar.classList.add('closed');
                        mainContent.classList.add('sidebar-closed');
                    }
                }
            });
            
            // Close mobile sidebar when clicking overlay
            overlay.addEventListener('click', function() {
                if (isMobile) {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('active');
                }
            });
            
            // Close mobile sidebar when clicking outside on mobile
            document.addEventListener('click', function(e) {
                if (isMobile && 
                    sidebar.classList.contains('open') && 
                    !sidebar.contains(e.target) && 
                    !hamburger.contains(e.target)) {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('active');
                }
            });
            
            // Handle escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && isMobile && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('active');
                }
            });
        });
    </script>
</body>
</html>`;
        fs.writeFileSync(authenticatedLayoutPath, authenticatedLayoutContent);
    }
    
    // Create profile.ejs if it doesn't exist
    const profilePath = path.join(viewsDir, 'profile.ejs');
    if (!fs.existsSync(profilePath)) {
        const profileContent = `<% layout('layouts/authenticated-layout') -%>
<div class="profile-container">
    <h1>Profile</h1>
    <div class="profile-card">
        <h2>User Information</h2>
        <div class="profile-info">
            <div class="info-item">
                <label>Name:</label>
                <span><%= user.name %></span>
            </div>
            <div class="info-item">
                <label>Email:</label>
                <span><%= user.email %></span>
            </div>
        </div>
        <div class="profile-actions">
            <button class="btn btn-primary" onclick="editProfile()">Edit Profile</button>
        </div>
    </div>
</div>

<style>
    .profile-container {
        max-width: 600px;
        margin: 0 auto;
    }
    
    .profile-card {
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .profile-info {
        margin: 20px 0;
    }
    
    .info-item {
        display: flex;
        margin-bottom: 15px;
        align-items: center;
    }
    
    .info-item label {
        font-weight: bold;
        width: 100px;
        color: #555;
    }
    
    .info-item span {
        color: #333;
    }
    
    .profile-actions {
        margin-top: 30px;
    }
    
    .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        text-decoration: none;
        display: inline-block;
    }
    
    .btn-primary {
        background-color: #007bff;
        color: white;
    }
    
    .btn-primary:hover {
        background-color: #0056b3;
    }
</style>

<script>
    function editProfile() {
        alert('Profile editing functionality coming soon!');
    }
</script>`;
        fs.writeFileSync(profilePath, profileContent);
    }
    
    // Create settings.ejs if it doesn't exist
    const settingsPath = path.join(viewsDir, 'settings.ejs');
    if (!fs.existsSync(settingsPath)) {
        const settingsContent = `<% layout('layouts/authenticated-layout') -%>
<div class="settings-container">
    <h1>Settings</h1>
    <div class="settings-sections">
        <div class="settings-section">
            <h2>Account Settings</h2>
            <div class="settings-card">
                <div class="setting-item">
                    <label>Change Password</label>
                    <button class="btn btn-secondary" onclick="changePassword()">Update Password</button>
                </div>
                <div class="setting-item">
                    <label>Two-Factor Authentication</label>
                    <button class="btn btn-secondary" onclick="enable2FA()">Enable 2FA</button>
                </div>
            </div>
        </div>
        
        <div class="settings-section">
            <h2>Preferences</h2>
            <div class="settings-card">
                <div class="setting-item">
                    <label>Theme</label>
                    <select class="form-control" onchange="changeTheme(this.value)">
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="auto">Auto</option>
                    </select>
                </div>
                <div class="setting-item">
                    <label>Language</label>
                    <select class="form-control" onchange="changeLanguage(this.value)">
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="settings-section">
            <h2>Privacy</h2>
            <div class="settings-card">
                <div class="setting-item">
                    <label>Profile Visibility</label>
                    <select class="form-control" onchange="changeVisibility(this.value)">
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                        <option value="friends">Friends Only</option>
                    </select>
                </div>
                <div class="setting-item">
                    <label>Data Export</label>
                    <button class="btn btn-secondary" onclick="exportData()">Download My Data</button>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .settings-container {
        max-width: 800px;
        margin: 0 auto;
    }
    
    .settings-sections {
        display: flex;
        flex-direction: column;
        gap: 30px;
    }
    
    .settings-section h2 {
        color: #333;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e9ecef;
    }
    
    .settings-card {
        background: white;
        padding: 25px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .setting-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 0;
        border-bottom: 1px solid #e9ecef;
    }
    
    .setting-item:last-child {
        border-bottom: none;
    }
    
    .setting-item label {
        font-weight: 500;
        color: #555;
        flex: 1;
    }
    
    .form-control {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        min-width: 150px;
    }
    
    .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        text-decoration: none;
        display: inline-block;
        min-width: 120px;
    }
    
    .btn-secondary {
        background-color: #6c757d;
        color: white;
    }
    
    .btn-secondary:hover {
        background-color: #545b62;
    }
    
    @media (max-width: 600px) {
        .setting-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
        }
        
        .form-control,
        .btn {
            width: 100%;
        }
    }
</style>

<script>
    function changePassword() {
        alert('Change password functionality coming soon!');
    }
    
    function enable2FA() {
        alert('Two-factor authentication setup coming soon!');
    }
    
    function changeTheme(theme) {
        alert('Theme changed to: ' + theme);
        // Theme switching logic would go here
    }
    
    function changeLanguage(lang) {
        alert('Language changed to: ' + lang);
        // Language switching logic would go here
    }
    
    function changeVisibility(visibility) {
        alert('Profile visibility changed to: ' + visibility);
        // Privacy settings logic would go here
    }
    
    function exportData() {
        alert('Data export functionality coming soon!');
    }
</script>`;
        fs.writeFileSync(settingsPath, settingsContent);
    }
};

// Initialize view files
ensureViewFilesExist();

// Configure express-ejs-layouts
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'layouts/layout'); // Default layout

// Validation middleware
const signupValidation = [
    body('name')
        .trim()
        .isLength({ min: NAME_MIN_LENGTH, max: NAME_MAX_LENGTH })
        .withMessage(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`)
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
        .withMessage(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`)
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

app.get('/dashboard', authenticateToken, addLayoutContext, (req, res) => {
    // Get user info from database with validated user ID
    try {
        const sanitizedUserId = validateAndSanitizeUserId(req.user.id);
        
        db.get('SELECT name, email FROM users WHERE id = ?', [sanitizedUserId], (err, user) => {
            if (err) {
                console.error('Database error fetching user:', err);
                return res.redirect('/login');
            }
            if (!user) {
                console.error('User not found in database');
                return res.redirect('/login');
            }
            res.render('dashboard', { 
                user,
                layout: 'layouts/authenticated-layout',
                currentPage: '/dashboard'
            });
        });
    } catch (error) {
        console.error('User ID validation error:', error);
        return res.redirect('/login');
    }
});

app.get('/profile', authenticateToken, addLayoutContext, (req, res) => {
    // Get user info from database with validated user ID
    try {
        const sanitizedUserId = validateAndSanitizeUserId(req.user.id);
        
        db.get('SELECT name, email FROM users WHERE id = ?', [sanitizedUserId], (err, user) => {
            if (err) {
                console.error('Database error fetching user:', err);
                return res.redirect('/login');
            }
            if (!user) {
                console.error('User not found in database');
                return res.redirect('/login');
            }
            res.render('profile', { 
                user,
                layout: 'layouts/authenticated-layout',
                currentPage: '/profile'
            });
        });
    } catch (error) {
        console.error('User ID validation error:', error);
        return res.redirect('/login');
    }
});

app.get('/settings', authenticateToken, addLayoutContext, (req, res) => {
    // Get user info from database with validated user ID
    try {
        const sanitizedUserId = validateAndSanitizeUserId(req.user.id);
        
        db.get('SELECT name, email FROM users WHERE id = ?', [sanitizedUserId], (err, user) => {
            if (err) {
                console.error('Database error fetching user:', err);
                return res.redirect('/login');
            }
            if (!user) {
                console.error('User not found in database');
                return res.redirect('/login');
            }
            res.render('settings', { 
                user,
                layout: 'layouts/authenticated-layout',
                currentPage: '/settings'
            });
        });
    } catch (error) {
        console.error('User ID validation error:', error);
        return res.redirect('/login');
    }
});

app.post('/signup', signupValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('signup', { error: errors.array()[0].msg });
    }

    const { name, email, password } = req.body;
    
    // Additional server-side validation
    if (!name || typeof name !== 'string') {
        return res.render('signup', { error: 'Invalid name provided' });
    }
    if (!email || typeof email !== 'string') {
        return res.render('signup', { error: 'Invalid email provided' });
    }
    if (!password || typeof password !== 'string') {
        return res.render('signup', { error: 'Invalid password provided' });
    }
    
    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        
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
    
    // Additional server-side validation
    if (!email || typeof email !== 'string') {
        return res.render('login', { error: 'Invalid email provided' });
    }
    if (!password || typeof password !== 'string') {
        return res.render('login', { error: 'Invalid password provided' });
    }
    
    // Find user in database
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Database error during login:', err);
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
            
            // Validate user ID before creating token
            const sanitizedUserId = validateAndSanitizeUserId(user.id);
            
            // Generate JWT token
            const token = jwt.sign(
                { id: sanitizedUserId, email: user.email },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRY }
            );
            
            // Set cookie and redirect to dashboard
            res.cookie('token', token, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production',
                maxAge: COOKIE_MAX_AGE,
                sameSite: 'strict'
            });
            
            res.redirect('/dashboard');
        } catch (error) {
            console.error('Login error:', error);
            res.render('login', { error: 'Login failed' });
        }
    });
});

app.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.redirect('/');
});

// Error handling middleware
app.use((req, res) => {
    res.status(404).render('404');
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
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});