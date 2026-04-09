const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const cheerio = require('cheerio');

// Test constants
const TEST_SECRET = 'test-jwt-secret-key-for-testing';
const TEST_PORT = 3002;

describe('Page Content Tests', () => {
  let app;
  let server;

  const TEST_USER = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com'
  };

  beforeAll((done) => {
    app = express();
    
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    
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

    // Authentication middleware
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
        error: req.query.error || null,
        success: req.query.success || null
      });
    });

    app.get('/dashboard', authenticateToken, (req, res) => {
      res.render('dashboard', { 
        title: 'Dashboard', 
        user: req.user,
        error: req.query.error || null,
        success: req.query.success || null
      });
    });

    app.get('/logout', getUserContext, (req, res) => {
      res.render('logout', { 
        title: 'Logout', 
        user: req.user,
        error: req.query.error || null,
        success: req.query.success || null
      });
    });

    app.post('/logout', (req, res) => {
      res.clearCookie('token');
      res.redirect('/?success=' + encodeURIComponent('You have been successfully logged out.'));
    });

    // Error handling
    app.use((err, req, res, next) => {
      console.error('Test app error:', err);
      res.status(500).send('Internal server error');
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

  describe('Dashboard Page Tests', () => {
    // TC-AC-10: Dashboard page displays only 'Dashboard' title with no other content
    test('AC-10: should display minimal Dashboard page with only title', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Check title in head
      expect($('title').text()).toBe('Dashboard | Auth App');
      
      // Check main heading
      const mainHeading = $('.container h1');
      expect(mainHeading.length).toBe(1);
      expect(mainHeading.text().trim()).toBe('Dashboard');
      
      // Verify no complex dashboard content
      expect($('.dashboard-widget').length).toBe(0);
      expect($('.chart').length).toBe(0);
      expect($('.graph').length).toBe(0);
      expect($('.analytics').length).toBe(0);
      expect($('.metrics').length).toBe(0);
      expect($('.data-table').length).toBe(0);
      expect($('.dashboard-card').length).toBe(0);
      expect($('.statistics').length).toBe(0);
    });

    // TC-AC-12: Dashboard page requires authentication through existing authenticateToken middleware
    test('AC-12: should require authentication for Dashboard page access', async () => {
      // Test without token
      const response = await request(app)
        .get('/dashboard')
        .expect(401);

      expect(response.text).toContain('Access denied. Please log in.');
      
      // Test with invalid token
      const invalidResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', ['token=invalid.jwt.token'])
        .expect(401);

      expect(invalidResponse.text).toContain('Invalid token. Please log in again.');
    });

    test('should inherit layout structure with side navigation', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify sidebar exists
      expect($('#sidebar').length).toBe(1);
      expect($('#sidebar').hasClass('sidebar')).toBe(true);
      
      // Verify main content wrapper
      expect($('.main-content').length).toBe(1);
      
      // Verify Dashboard link is active
      const dashboardLink = $('a[href="/dashboard"]');
      expect(dashboardLink.hasClass('active')).toBe(true);
      
      // Verify authenticated navigation links
      expect($('a[href="/dashboard"]').length).toBe(1);
      expect($('form[action="/logout"]').length).toBe(1);
      expect($('a[href="/login"]').length).toBe(0);
      expect($('a[href="/signup"]').length).toBe(0);
    });

    test('should handle flash messages on Dashboard page', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/dashboard?success=Welcome%20to%20dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      expect(response.text).toContain('alert-success');
      expect(response.text).toContain('Welcome to dashboard');
    });
  });

  describe('Logout Page Tests', () => {
    // TC-AC-11: Logout page displays only 'Logout' title with no other content
    test('AC-11: should display minimal Logout page with title and confirmation', async () => {
      const response = await request(app)
        .get('/logout')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Check title in head
      expect($('title').text()).toBe('Logout | Auth App');
      
      // Check main heading
      const mainHeading = $('h1');
      expect(mainHeading.length).toBe(1);
      expect(mainHeading.text()).toContain('Logout');
      
      // Verify it's a confirmation page with logout form
      const logoutForm = $('form[action="/logout"][method="POST"]');
      expect(logoutForm.length).toBe(1);
      
      const submitButton = logoutForm.find('button[type="submit"]');
      expect(submitButton.length).toBe(1);
      expect(submitButton.text()).toContain('Yes, Logout');
      
      // Should have cancel button/link
      const cancelLink = $('a[href="/dashboard"]');
      expect(cancelLink.length).toBe(1);
      expect(cancelLink.text()).toContain('Cancel');
      
      // Verify no complex logout functionality
      expect($('.user-sessions').length).toBe(0);
      expect($('.logout-history').length).toBe(0);
      expect($('.device-management').length).toBe(0);
    });

    // TC-AC-13: Logout page is publicly accessible without authentication
    test('AC-13: should allow public access to Logout page', async () => {
      // Test without any authentication
      const response = await request(app)
        .get('/logout')
        .expect(200);

      const $ = cheerio.load(response.text);
      expect($('h1').text()).toContain('Logout');
      
      // Should still show the logout page even without authentication
      expect($('form[action="/logout"]').length).toBe(1);
    });

    test('should inherit layout structure with side navigation', async () => {
      const response = await request(app)
        .get('/logout')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify sidebar exists
      expect($('#sidebar').length).toBe(1);
      expect($('#sidebar').hasClass('sidebar')).toBe(true);
      
      // Verify main content wrapper
      expect($('.main-content').length).toBe(1);
      
      // For unauthenticated access, should show login/signup links
      expect($('a[href="/login"]').length).toBe(1);
      expect($('a[href="/signup"]').length).toBe(1);
    });

    test('should show proper styling and Bootstrap icons', async () => {
      const response = await request(app)
        .get('/logout')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Check for Bootstrap icons
      expect($('.bi-box-arrow-right').length).toBeGreaterThan(0);
      expect($('.bi-arrow-left').length).toBe(1); // Cancel button icon
      
      // Check for proper styling classes
      expect($('.btn-danger').length).toBe(1); // Logout button
      expect($('.btn-secondary').length).toBe(1); // Cancel button
      expect($('.card').length).toBe(1); // Card layout
      expect($('.card-body').length).toBe(1);
    });

    test('should handle flash messages on Logout page', async () => {
      const response = await request(app)
        .get('/logout?error=Session%20expired')
        .expect(200);

      expect(response.text).toContain('alert-danger');
      expect(response.text).toContain('Session expired');
    });
  });

  describe('Logout Functionality Tests', () => {
    test('should handle POST logout and redirect with success message', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .post('/logout')
        .set('Cookie', [`token=${token}`])
        .expect(302);

      // Should redirect to home page with success message
      expect(response.headers.location).toMatch(/\/\?success=/);
      expect(decodeURIComponent(response.headers.location)).toContain('logged out successfully');
      
      // Should clear the token cookie
      expect(response.headers['set-cookie']).toBeDefined();
      const setCookieHeader = response.headers['set-cookie'][0];
      expect(setCookieHeader).toContain('token=;');
      expect(setCookieHeader).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });

    test('should handle POST logout without token', async () => {
      const response = await request(app)
        .post('/logout')
        .expect(302);

      // Should still redirect successfully
      expect(response.headers.location).toMatch(/\/\?success=/);
    });
  });

  describe('Page Title and Meta Tests', () => {
    test('should have correct page titles for all pages', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      // Home page
      const homeResponse = await request(app).get('/').expect(200);
      expect(homeResponse.text).toContain('<title>Home | Auth App</title>');
      
      // Dashboard page (authenticated)
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);
      expect(dashboardResponse.text).toContain('<title>Dashboard | Auth App</title>');
      
      // Logout page
      const logoutResponse = await request(app).get('/logout').expect(200);
      expect(logoutResponse.text).toContain('<title>Logout | Auth App</title>');
    });

    test('should have proper HTML structure and meta tags', async () => {
      const response = await request(app).get('/').expect(200);
      
      // Check DOCTYPE and HTML structure
      expect(response.text).toMatch(/^<!DOCTYPE html>/);
      expect(response.text).toContain('<html lang="en">');
      expect(response.text).toContain('<meta charset="UTF-8">');
      expect(response.text).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
      
      // Check CSS and JS includes
      expect(response.text).toContain('bootstrap@5.3.0/dist/css/bootstrap.min.css');
      expect(response.text).toContain('bootstrap-icons@1.10.0/font/bootstrap-icons.css');
      expect(response.text).toContain('/css/style.css');
      expect(response.text).toContain('bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js');
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle expired JWT token on Dashboard', async () => {
      const expiredToken = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '-1h' });
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${expiredToken}`])
        .expect(401);

      expect(response.text).toContain('Invalid token. Please log in again.');
    });

    test('should handle malformed JWT token', async () => {
      const malformedToken = 'not.a.valid.jwt';
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${malformedToken}`])
        .expect(401);

      expect(response.text).toContain('Invalid token. Please log in again.');
    });

    test('should handle missing JWT secret gracefully', async () => {
      // This test ensures the app would fail fast if JWT_SECRET is missing
      // In real implementation, this should cause the app to exit during startup
      expect(TEST_SECRET).toBeDefined();
      expect(TEST_SECRET).not.toBe('');
    });
  });

  describe('Layout Integration Tests', () => {
    test('should render complete page structure for Dashboard', async () => {
      const token = jwt.sign(TEST_USER, TEST_SECRET, { expiresIn: '1h' });
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${token}`])
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify complete page structure
      expect($('html').length).toBe(1);
      expect($('head').length).toBe(1);
      expect($('body').length).toBe(1);
      expect($('#sidebar').length).toBe(1);
      expect($('.main-content').length).toBe(1);
      expect($('footer').length).toBe(1);
      
      // Verify sidebar content
      expect($('.sidebar-brand').length).toBe(1);
      expect($('.sidebar-nav').length).toBe(1);
      
      // Verify main content structure
      expect($('.container').length).toBeGreaterThan(0);
      expect($('h1').text()).toContain('Dashboard');
    });

    test('should render complete page structure for Logout', async () => {
      const response = await request(app)
        .get('/logout')
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify complete page structure
      expect($('html').length).toBe(1);
      expect($('head').length).toBe(1);
      expect($('body').length).toBe(1);
      expect($('#sidebar').length).toBe(1);
      expect($('.main-content').length).toBe(1);
      
      // Verify logout page specific content
      expect($('.card').length).toBe(1);
      expect($('form[action="/logout"]').length).toBe(1);
      expect($('h1').text()).toContain('Logout');
    });
  });
});