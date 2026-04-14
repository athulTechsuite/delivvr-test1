const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY_24H = '24h';
const TOKEN_EXPIRY_7D = '168h';
const COOKIE_MAX_AGE_24H = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const COOKIE_MAX_AGE_7D = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

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
  const { email, password, rememberMe } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.render('login', { error: 'Email and password are required', message: null });
  }

  // Validate rememberMe field
  let rememberMeChecked = false;
  if (rememberMe !== undefined) {
    if (typeof rememberMe === 'boolean') {
      rememberMeChecked = rememberMe;
    } else if (typeof rememberMe === 'string') {
      rememberMeChecked = rememberMe === 'true' || rememberMe === 'on';
    } else {
      return res.render('login', { error: 'Invalid remember me value', message: null });
    }
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

    // Determine token expiration based on rememberMe
    const tokenExpiry = rememberMeChecked ? TOKEN_EXPIRY_7D : TOKEN_EXPIRY_24H;
    const cookieMaxAge = rememberMeChecked ? COOKIE_MAX_AGE_7D : COOKIE_MAX_AGE_24H;

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: tokenExpiry }
    );

    // Set token as HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAge
    });

    // Handle refresh token if Remember me is checked
    if (rememberMeChecked) {
      try {
        // Generate refresh token pair
        const { refreshToken, hashedRefreshToken } = User.generateRefreshTokenPair();
        
        // Store hashed refresh token in database
        await User.setRefreshToken(user.id, hashedRefreshToken);
        
        // Set refresh token cookie
        res.cookie('refresh_token', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: COOKIE_MAX_AGE_7D
        });
      } catch (refreshTokenError) {
        // Log error but don't prevent login
        console.error('Refresh token generation error:', refreshTokenError);
        // Continue with standard 24-hour session fallback
        console.warn('Falling back to 24-hour session for user:', user.id);
      }
    }

    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'An error occurred during login', message: null });
  }
});

// POST /logout - Handle user logout
router.post('/logout', async (req, res) => {
  try {
    // Extract userId from JWT if available
    const token = req.cookies.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        
        if (userId) {
          // Clear refresh token from database
          await User.clearRefreshToken(userId);
        }
      } catch (jwtError) {
        // Invalid token - continue with cookie clearing
        console.warn('Invalid JWT during logout:', jwtError.message);
      }
    }
  } catch (error) {
    // Log error but continue with logout process
    console.error('Error during logout refresh token cleanup:', error);
  }

  // Clear both token and refresh_token cookies
  res.clearCookie('token');
  res.clearCookie('refresh_token');
  
  res.redirect('/?message=Logged out successfully');
});

module.exports = router;