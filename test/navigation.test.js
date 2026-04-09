const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');

// Test constants
const TEST_SECRET = 'test-jwt-secret-key-for-testing';
const TEST_PORT = 3001;

describe('Side Navigation Tests', () => {
  let app;
  let server;

  // Mock user data
  const TEST_USER = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com'
  };

  beforeAll((done) => {
    // Create test Express app
    app = express();
    
    // Set view engine and views directory
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    
    // Middleware setup
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, '../public')));

    // Mock cookie parser
    app.use((req, res, next) => {
      const cookieHeader = req.headers.cookie;
      req.cookies = {};
      
      if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
          const [name, value] = cookie.trim().split('=');
          req.cookies[name] = value;
        });
      }
      
      res.clearCookie = function(name, options) {
        res.setHeader('Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        return res;
      };
      
      next();
    });

    // Mock authentication middleware
    const authenticateToken = (req, res, next) => {
      const token = req.cookies?.token;
      
      if (!token) {
        return res.status(401).render('login', { 
          title: 'Login', 
          error: 'Access denied. Please log in.',
          user: null,
          success: null
        });
      }

      try {
        const decoded = jwt.verify(token, TEST_SECRET);
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).render('login', { 
          title: 'Login', 
          error: 'Invalid token. Please log in again.',
          user: null,
          success: null
        });
      }
    };

    // User context middleware
    const getUserContext = (req, res, next) => {
      const token = req.cookies?.token;
      
      if (!token) {
        req.user = null;
        return next();
      }
      
      try {
        const decoded = jwt.verify(token, TEST_SECRET);
        req.user = decoded;
      } catch (error) {
        req.user = null;
      }
      next();
    };

    // Routes
    app.get('/', getUserContext, (req, res) => {
      res.render('index', { 
        title: 'Home', 
        user: req.user,
        error: null,
        success: null
      });
    });

    app.get('/login', getUserContext, (req, res) => {
      res.render('login', { 
        title: 'Login', 
        user: req.user,
        error: null,
        success: null
      });
    });

    app.get('/signup', getUserContext, (req, res) => {
      res.render('signup', { 
        title: 'Sign Up', 
        user: req.user,
        error: null,
        success: null
      });
    });

    app.get('/dashboard', authenticateToken, (req, res) => {
      res.render('dashboard', { 
        title: 'Dashboard', 
        user: req.user,
        error: null,
        success: null
      });
    });

    app.get('/logout', getUserContext, (req, res) => {
      res.render('logout', { 
        title: 'Logout', 
        user: req.user,
        error: null,
        success: null
      });
    });

    app.post('/logout', (req, res) => {
      res.clearCookie('token');
      res.redirect('/?success=' + encodeURIComponent('You have been successfully logged out.'));
    });

    server = app.listen(TEST_PORT, done);
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('PRD Acceptance Criteria Coverage', () => {
    // TC-AC-01: Side navigation replaces top horizontal navbar in all pages
    test('AC-01: should replace horizontal navbar with vertical side navigation', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify side navigation exists
      expect($('#sidebar').length).toBe(1);
      expect($('#sidebar').hasClass('sidebar')).toBe(true);
      expect($('#sidebar').hasClass('bg-dark')).toBe(true);
      
      // Verify no horizontal navbar exists
      expect($('.navbar').length).toBe(0);
      expect($('nav.navbar').length).toBe(0);
    });

    // TC-AC-02: Hamburger menu button appears on mobile devices (viewport < 992px)
    test('AC-02: should display hamburger menu button with mobile-only visibility', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      const hamburgerBtn = $('.sidebar-toggle');
      expect(hamburgerBtn.length).toBe(1);
      expect(hamburgerBtn.hasClass('d-lg-none')).toBe(true);
      expect(hamburgerBtn.hasClass('btn-dark')).toBe(true);
      expect(hamburgerBtn.find('.bi-list').length).toBe(1);
    });

    // TC-AC-03: Hamburger menu button toggles side navigation visibility when clicked
    test('AC-03: should have correct Bootstrap collapse attributes for toggle functionality', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      const hamburgerBtn = $('.sidebar-toggle');
      expect(hamburgerBtn.attr('data-bs-toggle')).toBe('collapse');
      expect(hamburgerBtn.attr('data-bs-target')).toBe('#sidebar');
      expect(hamburgerBtn.attr('aria-controls')).toBe('sidebar');
      expect(hamburgerBtn.attr('aria-expanded')).toBe('false');
      
      const sidebar = $('#sidebar');
      expect(sidebar.hasClass('collapse')).toBe(true);
    });

    // TC-AC-04: Side navigation shows Dashboard and Logout links when user is authenticated
    test('AC-04: should display Dashboard and Logout links for authenticated users', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Check Dashboard link
      const dashboardLink = $('a[href="/dashboard"]');
      expect(dashboardLink.length).toBe(1);
      expect(dashboardLink.text()).toContain('Dashboard');
      expect(dashboardLink.find('.bi-person-circle').length).toBe(1);
      
      // Check Logout form (POST logout functionality)
      const logoutForm = $('form[action="/logout"][method="POST"]');
      expect(logoutForm.length).toBe(1);
      expect(logoutForm.find('button[type="submit"]').text()).toContain('Logout');
      expect(logoutForm.find('.bi-box-arrow-right').length).toBe(1);
    });

    // TC-AC-05: Side navigation shows Login and Signup links when user is not authenticated
    test('AC-05: should display Login and Signup links for unauthenticated users', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Check Login link
      const loginLink = $('a[href="/login"]');
      expect(loginLink.length).toBe(1);
      expect(loginLink.text()).toContain('Login');
      expect(loginLink.find('.bi-box-arrow-in-right').length).toBe(1);
      
      // Check Signup link
      const signupLink = $('a[href="/signup"]');
      expect(signupLink.length).toBe(1);
      expect(signupLink.text()).toContain('Sign Up');
      expect(signupLink.find('.bi-person-plus').length).toBe(1);
      
      // Verify Dashboard and Logout are NOT present
      expect($('a[href="/dashboard"]').length).toBe(0);
      expect($('form[action="/logout"]').length).toBe(0);
    });

    // TC-AC-06: Brand logo/title 'Auth App' displays at top of side navigation
    test('AC-06: should display Auth App brand at top of sidebar', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      const brand = $('.sidebar-brand .navbar-brand');
      expect(brand.length).toBe(1);
      expect(brand.text()).toContain('Auth App');
      expect(brand.find('.bi-shield-lock').length).toBe(1);
      expect(brand.attr('href')).toBe('/');
    });

    // TC-AC-07: Side navigation has dark background matching original navbar theme
    test('AC-07: should have dark theme styling', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      const sidebar = $('#sidebar');
      expect(sidebar.hasClass('bg-dark')).toBe(true);
      
      const navLinks = sidebar.find('.nav-link');
      navLinks.each((i, el) => {
        expect($(el).hasClass('text-white')).toBe(true);
      });
    });

    // TC-AC-08: Dashboard link in side navigation navigates to /dashboard page
    test('AC-08: should navigate to dashboard page correctly', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      expect(response.text).toContain('Dashboard');
      const $ = cheerio.load(response.text);
      expect($('a[href="/dashboard"]').hasClass('active')).toBe(true);
    });

    // TC-AC-09: Logout link in side navigation navigates to /logout page
    test('AC-09: should navigate to logout page correctly', async () => {
      const response = await request(app)
        .get('/logout')
        .expect(200);

      expect(response.text).toContain('Logout');
      const $ = cheerio.load(response.text);
      expect($('h1').text()).toContain('Logout');
    });

    // TC-AC-10: Dashboard page displays only 'Dashboard' title with no other content
    test('AC-10: should display minimal Dashboard page content', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const $ = cheerio.load(response.text);
      const mainContent = $('.container h1');
      expect(mainContent.text()).toBe('Dashboard');
      
      // Verify minimal content - should not have extensive dashboard features
      expect($('.dashboard-widget').length).toBe(0);
      expect($('.chart').length).toBe(0);
      expect($('.data-table').length).toBe(0);
    });

    // TC-AC-11: Logout page displays only 'Logout' title with no other content
    test('AC-11: should display minimal Logout page content', async () => {
      const response = await request(app)
        .get('/logout')
        .expect(200);

      const $ = cheerio.load(response.text);
      const title = $('h1');
      expect(title.text()).toContain('Logout');
      
      // Verify it's a confirmation page, not complex logout functionality
      expect($('form[action="/logout"]').length).toBe(1);
      expect($('button[type="submit"]').text()).toContain('Yes, Logout');
    });

    // TC-AC-12: Dashboard page requires authentication through existing authenticateToken middleware
    test('AC-12: should protect Dashboard page with authentication middleware', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(401);

      expect(response.text).toContain('Access denied. Please log in.');
    });

    // TC-AC-13: Logout page is publicly accessible without authentication
    test('AC-13: should allow public access to Logout page', async () => {
      const response = await request(app)
        .get('/logout')
        .expect(200);

      expect(response.text).toContain('Logout');
      const $ = cheerio.load(response.text);
      expect($('h1').text()).toContain('Logout');
    });

    // TC-AC-14: Side navigation collapses automatically on mobile after link selection
    test('AC-14: should have JavaScript for auto-collapse on mobile', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Verify auto-collapse JavaScript is present
      expect(response.text).toContain('data-bs-toggle="collapse"');
      expect(response.text).toContain('data-bs-target="#sidebar.collapse.show"');
      expect(response.text).toContain('window.innerWidth < 992');
      expect(response.text).toContain('bootstrap.Collapse');
    });

    // TC-AC-15: Main content area adjusts to accommodate side navigation layout
    test('AC-15: should have main content wrapper with proper layout', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      const mainContent = $('.main-content');
      expect(mainContent.length).toBe(1);
      
      // Verify main content container structure
      expect(mainContent.find('.container').length).toBeGreaterThan(0);
    });

    // TC-AC-16: Flash messages (error/success) still display correctly in main content area
    test('AC-16: should display flash messages in main content area', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Verify flash message structure exists
      expect(response.text).toContain('alert-danger');
      expect(response.text).toContain('alert-success');
      expect(response.text).toContain('bi-exclamation-triangle');
      expect(response.text).toContain('bi-check-circle');
    });

    // TC-AC-17 & TC-AC-18: Existing authentication flows remain unchanged & JWT cookie auth works
    test('AC-17-18: should maintain existing authentication flow', async () => {
      // Test invalid token handling
      const invalidToken = 'invalid.jwt.token';
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${invalidToken}`])
        .expect(401);

      expect(response.text).toContain('Invalid token. Please log in again.');
      
      // Test valid token handling
      const validToken = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const validResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);

      expect(validResponse.text).toContain('Dashboard');
    });

    // TC-AC-19: Login and signup forms function identically to previous implementation
    test('AC-19: should maintain login and signup form structure', async () => {
      const loginResponse = await request(app)
        .get('/login')
        .expect(200);

      const signupResponse = await request(app)
        .get('/signup')
        .expect(200);

      // Verify forms are still present and structured correctly
      expect(loginResponse.text).toContain('<form');
      expect(signupResponse.text).toContain('<form');
      
      const $ = cheerio.load(loginResponse.text);
      expect($('input[type="email"]').length).toBe(1);
      expect($('input[type="password"]').length).toBe(1);
    });

    // TC-AC-20: Home page content displays correctly with new side navigation layout
    test('AC-20: should display home page content with side navigation', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify both sidebar and main content exist
      expect($('#sidebar').length).toBe(1);
      expect($('.main-content').length).toBe(1);
      
      // Verify home link is active
      expect($('.nav-link.active').length).toBeGreaterThan(0);
    });

    // TC-AC-21: Navigation links highlight appropriately when active
    test('AC-21: should highlight active navigation links', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const $ = cheerio.load(dashboardResponse.text);
      const activeLink = $('a[href="/dashboard"].active');
      expect(activeLink.length).toBe(1);
      expect(activeLink.hasClass('active')).toBe(true);
    });

    // TC-AC-22: Side navigation is responsive across desktop, tablet, and mobile viewports
    test('AC-22: should have responsive CSS classes for all viewports', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify responsive classes
      const sidebar = $('#sidebar');
      expect(sidebar.hasClass('collapse')).toBe(true);
      expect(sidebar.hasClass('d-lg-block')).toBe(true);
      
      const toggleBtn = $('.sidebar-toggle');
      expect(toggleBtn.hasClass('d-lg-none')).toBe(true);
    });

    // TC-AC-23: Bootstrap icons display correctly in navigation links
    test('AC-23: should display Bootstrap icons in all navigation links', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Check brand icon
      expect($('.bi-shield-lock').length).toBe(1);
      
      // Check navigation icons for unauthenticated state
      expect($('.bi-house').length).toBe(1); // Home
      expect($('.bi-box-arrow-in-right').length).toBe(1); // Login
      expect($('.bi-person-plus').length).toBe(1); // Signup
      
      // Test authenticated state
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const authResponse = await request(app)
        .get('/')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const $auth = cheerio.load(authResponse.text);
      expect($auth('.bi-person-circle').length).toBe(1); // Dashboard
      expect($auth('.bi-box-arrow-right').length).toBe(1); // Logout
    });

    // TC-AC-24: Navigation styling matches existing dark theme color scheme
    test('AC-24: should maintain dark theme styling consistency', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify dark theme classes
      const sidebar = $('#sidebar');
      expect(sidebar.hasClass('bg-dark')).toBe(true);
      
      const toggleBtn = $('.sidebar-toggle');
      expect(toggleBtn.hasClass('btn-dark')).toBe(true);
      
      // Verify all nav links have white text
      const navLinks = $('.nav-link');
      navLinks.each((i, el) => {
        expect($(el).hasClass('text-white')).toBe(true);
      });
      
      // Verify brand text is white
      expect($('.sidebar-brand .navbar-brand').hasClass('text-white')).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing token gracefully', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(401);

      expect(response.text).toContain('Access denied. Please log in.');
    });

    test('should handle expired JWT token', async () => {
      const expiredToken = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '-1h' });
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${expiredToken}`])
        .expect(401);

      expect(response.text).toContain('Invalid token. Please log in again.');
    });

    test('should handle malformed JWT token', async () => {
      const malformedToken = 'malformed.jwt.token.structure';
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${malformedToken}`])
        .expect(401);

      expect(response.text).toContain('Invalid token. Please log in again.');
    });

    test('should POST logout successfully and clear cookie', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .post('/logout')
        .set('Cookie', [`token=${token}`])
        .expect(302);

      expect(response.headers.location).toContain('/?success=');
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('token=;');
    });
  });

  describe('Layout Integration Tests', () => {
    test('should render complete HTML structure with DOCTYPE and meta tags', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toMatch(/^<!DOCTYPE html>/);
      expect(response.text).toContain('<meta charset="UTF-8">');
      expect(response.text).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
      expect(response.text).toContain('<title>Home | Auth App</title>');
    });

    test('should include all required CSS and JS dependencies', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // CSS dependencies
      expect(response.text).toContain('bootstrap@5.3.0/dist/css/bootstrap.min.css');
      expect(response.text).toContain('bootstrap-icons@1.10.0/font/bootstrap-icons.css');
      expect(response.text).toContain('/css/style.css');
      
      // JavaScript dependencies
      expect(response.text).toContain('bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js');
      
      // Custom JavaScript for sidebar functionality
      expect(response.text).toContain('DOMContentLoaded');
      expect(response.text).toContain('sidebar-toggle');
      expect(response.text).toContain('bootstrap.Collapse');
    });

    test('should maintain footer structure', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      const $ = cheerio.load(response.text);
      const footer = $('footer');
      expect(footer.length).toBe(1);
      expect(footer.hasClass('bg-light')).toBe(true);
      expect(footer.text()).toContain('2024 Auth App');
      expect(footer.text()).toContain('Express.js & Bootstrap');
    });
  });
});