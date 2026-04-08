const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database setup - use environment variable or fallback to default
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.redirect('/auth/login');
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.redirect('/auth/login');
    }
    req.user = user;
    next();
  });
};

// GET /dashboard - Dashboard page
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get user info from database
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.userId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!user) {
      return res.redirect('/auth/login');
    }

    res.render('dashboard', { title: 'Dashboard', user });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { 
      title: 'Error',
      error: 'An error occurred while loading the dashboard',
      message: null,
      user: null
    });
  }
});

// GET /signup - Show signup form
router.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

// POST /signup - Handle user registration
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  // Basic validation
  if (!name || !email || !password) {
    return res.render('signup', { error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.render('signup', { error: 'Password must be at least 6 characters long' });
  }

  try {
    // Check if user already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (existingUser) {
      return res.render('signup', { error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, hashedPassword],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    // Redirect to login page with success message
    res.redirect('/auth/login?message=Account created successfully! Please log in.');
  } catch (error) {
    console.error('Signup error:', error);
    res.render('signup', { error: 'An error occurred during registration' });
  }
});

// GET /login - Show login form
router.get('/login', (req, res) => {
  const message = req.query.message || null;
  res.render('login', { error: null, message });
});

// POST /login - Handle user login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.render('login', { error: 'Email and password are required', message: null });
  }

  try {
    // Find user by email
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!user) {
      return res.render('login', { error: 'Invalid email or password', message: null });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.render('login', { error: 'Invalid email or password', message: null });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set token as HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    // Redirect to dashboard
    res.redirect('/auth/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'An error occurred during login', message: null });
  }
});

// GET /logout - Show static logout page
router.get('/logout', (req, res) => {
  try {
    // Set security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });

    // Validate and sanitize query parameters
    const queryParams = {};
    if (req.query.message && typeof req.query.message === 'string') {
      queryParams.message = req.query.message.trim().substring(0, 255);
    }

    // Render logout page with template variables
    res.render('logout', { 
      title: 'Logout',
      error: null,
      message: queryParams.message || null,
      user: null
    });
  } catch (error) {
    console.error('Logout page error:', error);
    res.status(500).render('error', { 
      title: 'Error',
      error: 'An error occurred while loading the logout page',
      message: null,
      user: null
    });
  }
});

// POST /logout - Handle user logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/?message=Logged out successfully');
});

module.exports = router;