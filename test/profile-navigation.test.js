const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const { expect } = require('chai');
const cheerio = require('cheerio');

// Mock database
const mockDb = {
  get: () => null,
  run: () => ({ changes: 1 }),
  prepare: () => ({
    get: () => null,
    run: () => ({ changes: 1 }),
    finalize: () => {}
  })
};

// Test constants
const TEST_JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
const TEST_USER_ID = 1;
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_NAME = 'Test User';
const TOKEN_EXPIRY = '24h';
const VALID_PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890';

describe('Profile Navigation Integration Tests', function() {
  let app;
  let authenticateToken;
  
  beforeEach(function() {
    // Create Express app with required middleware
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(cookieParser());
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '..', 'views'));
    
    // Mock authenticateToken middleware
    authenticateToken = (req, res, next) => {
      const token = req.cookies.token;
      
      if (!token) {
        return res.redirect('/login');
      }
      
      try {
        const decoded = jwt.verify(token, TEST_JWT_SECRET);
        req.user = decoded;
        next();
      } catch (error) {
        res.clearCookie('token');
        return res.redirect('/login');
      }
    };
    
    // Mock database helpers
    const dbHelpers = {
      getUserById: (id) => {
        if (id === TEST_USER_ID) {
          return {
            id: TEST_USER_ID,
            name: TEST_USER_NAME,
            email: TEST_USER_EMAIL,
            password: VALID_PASSWORD_HASH,
            created_at: '2024-01-01T00:00:00.000Z'
          };
        }
        return null;
      },
      updateUserById: (id, updates) => {
        return { changes: 1 };
      }
    };
    
    // Setup routes
    app.get('/', (req, res) => {
      const token = req.cookies.token;
      let user = null;
      
      if (token) {
        try {
          const decoded = jwt.verify(token, TEST_JWT_SECRET);
          user = decoded;
        } catch (error) {
          // Invalid token, user remains null
        }
      }
      
      res.render('layout', {
        title: 'Home',
        user: user,
        body: '<h1>Welcome</h1>'
      });
    });
    
    app.get('/login', (req, res) => {
      const token = req.cookies.token;
      let user = null;
      
      if (token) {
        try {
          const decoded = jwt.verify(token, TEST_JWT_SECRET);
          return res.redirect('/dashboard');
        } catch (error) {
          // Invalid token, continue to login
        }
      }
      
      res.render('layout', {
        title: 'Login',
        user: null,
        body: '<form id="loginForm"><input name="email"><input name="password" type="password"><button type="submit">Login</button></form>'
      });
    });
    
    app.get('/dashboard', authenticateToken, (req, res) => {
      const user = dbHelpers.getUserById(req.user.id);
      if (!user) {
        return res.redirect('/login');
      }
      
      res.render('layout', {
        title: 'Dashboard',
        user: req.user,
        body: '<h1>Dashboard</h1>'
      });
    });
    
    app.get('/profile', authenticateToken, (req, res) => {
      const user = dbHelpers.getUserById(req.user.id);
      if (!user) {
        return res.redirect('/login');
      }
      
      res.render('layout', {
        title: 'Profile',
        user: req.user,
        body: `
          <div class="profile-container">
            <h1>Profile</h1>
            <form id="profileForm">
              <input name="name" value="${user.name}">
              <input name="email" value="${user.email}" readonly>
              <button type="submit">Save</button>
              <button type="button" id="cancelButton">Cancel</button>
            </form>
          </div>
        `
      });
    });
  });
  
  function generateValidToken() {
    return jwt.sign(
      { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      TEST_JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
  }
  
  function generateExpiredToken() {
    return jwt.sign(
      { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      TEST_JWT_SECRET,
      { expiresIn: '-1h' }
    );
  }
  
  describe('Profile Link Visibility', function() {
    it('should show profile link for authenticated users', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const profileLink = $('a[href="/profile"]');
      
      expect(profileLink.length).to.equal(1);
      expect(profileLink.text().trim()).to.include('Profile');
    });
    
    it('should not show profile link for unauthenticated users', async function() {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const profileLink = $('a[href="/profile"]');
      
      expect(profileLink.length).to.equal(0);
    });
    
    it('should not show profile link with invalid token', async function() {
      const response = await request(app)
        .get('/')
        .set('Cookie', 'token=invalid_token')
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const profileLink = $('a[href="/profile"]');
      
      expect(profileLink.length).to.equal(0);
    });
    
    it('should not show profile link with expired token', async function() {
      const expiredToken = generateExpiredToken();
      
      const response = await request(app)
        .get('/')
        .set('Cookie', `token=${expiredToken}`)
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const profileLink = $('a[href="/profile"]');
      
      expect(profileLink.length).to.equal(0);
    });
  });
  
  describe('Profile Link Positioning', function() {
    it('should position profile link above dashboard link in sidebar', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const sidebarLinks = $('.sidebar a, .nav-link');
      const profileLinkIndex = sidebarLinks.toArray().findIndex(el => 
        $(el).attr('href') === '/profile'
      );
      const dashboardLinkIndex = sidebarLinks.toArray().findIndex(el => 
        $(el).attr('href') === '/dashboard'
      );
      
      expect(profileLinkIndex).to.be.greaterThan(-1);
      expect(dashboardLinkIndex).to.be.greaterThan(-1);
      expect(profileLinkIndex).to.be.lessThan(dashboardLinkIndex);
    });
    
    it('should maintain consistent navigation structure across pages', async function() {
      const token = generateValidToken();
      
      // Check dashboard page navigation
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $dashboard = cheerio.load(dashboardResponse.text);
      const dashboardProfileLink = $dashboard('a[href="/profile"]');
      
      // Check profile page navigation
      const profileResponse = await request(app)
        .get('/profile')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $profile = cheerio.load(profileResponse.text);
      const profilePageProfileLink = $profile('a[href="/profile"]');
      
      expect(dashboardProfileLink.length).to.equal(1);
      expect(profilePageProfileLink.length).to.equal(1);
    });
  });
  
  describe('Active State Highlighting', function() {
    it('should highlight profile link when on profile page', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const profileLink = $('a[href="/profile"]');
      
      expect(profileLink.length).to.equal(1);
      // Check for active state classes
      const hasActiveClass = profileLink.hasClass('active') || 
                           profileLink.hasClass('current') ||
                           profileLink.closest('.active').length > 0 ||
                           profileLink.closest('.current').length > 0;
      
      expect(hasActiveClass).to.be.true;
    });
    
    it('should not highlight profile link when on dashboard page', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const profileLink = $('a[href="/profile"]');
      const dashboardLink = $('a[href="/dashboard"]');
      
      expect(profileLink.length).to.equal(1);
      expect(dashboardLink.length).to.equal(1);
      
      // Profile link should not have active state
      const profileHasActiveClass = profileLink.hasClass('active') || 
                                   profileLink.hasClass('current');
      
      // Dashboard link should have active state
      const dashboardHasActiveClass = dashboardLink.hasClass('active') || 
                                     dashboardLink.hasClass('current') ||
                                     dashboardLink.closest('.active').length > 0 ||
                                     dashboardLink.closest('.current').length > 0;
      
      expect(profileHasActiveClass).to.be.false;
      expect(dashboardHasActiveClass).to.be.true;
    });
  });
  
  describe('Profile Link Routing', function() {
    it('should route to correct profile URL', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      expect(response.text).to.include('Profile');
      expect(response.text).to.include('profile-container');
    });
    
    it('should redirect to login when accessing profile without authentication', async function() {
      const response = await request(app)
        .get('/profile')
        .expect(302);
      
      expect(response.headers.location).to.equal('/login');
    });
    
    it('should redirect to login when accessing profile with invalid token', async function() {
      const response = await request(app)
        .get('/profile')
        .set('Cookie', 'token=invalid_token')
        .expect(302);
      
      expect(response.headers.location).to.equal('/login');
    });
  });
  
  describe('Mobile Navigation Behavior', function() {
    it('should include profile link in mobile navigation menu', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .expect(200);
      
      const $ = cheerio.load(response.text);
      
      // Check for mobile navigation structure
      const mobileNav = $('.navbar-collapse, .mobile-nav, .nav-menu');
      const profileLinkInMobile = mobileNav.find('a[href="/profile"]');
      
      if (mobileNav.length > 0) {
        expect(profileLinkInMobile.length).to.equal(1);
      } else {
        // If no specific mobile nav structure, ensure profile link exists
        const profileLink = $('a[href="/profile"]');
        expect(profileLink.length).to.equal(1);
      }
    });
    
    it('should maintain proper navigation order in mobile view', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const navLinks = $('.nav-link, .navbar-nav a, .mobile-nav a');
      
      if (navLinks.length > 0) {
        const profileLinkIndex = navLinks.toArray().findIndex(el => 
          $(el).attr('href') === '/profile'
        );
        const dashboardLinkIndex = navLinks.toArray().findIndex(el => 
          $(el).attr('href') === '/dashboard'
        );
        
        if (profileLinkIndex > -1 && dashboardLinkIndex > -1) {
          expect(profileLinkIndex).to.be.lessThan(dashboardLinkIndex);
        }
      }
    });
  });
  
  describe('Profile Link Accessibility', function() {
    it('should include proper ARIA labels for screen readers', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const profileLink = $('a[href="/profile"]');
      
      expect(profileLink.length).to.equal(1);
      
      // Check for accessibility attributes
      const hasAriaLabel = profileLink.attr('aria-label') ||
                          profileLink.attr('title') ||
                          profileLink.find('.sr-only').length > 0;
      
      expect(hasAriaLabel).to.be.ok;
    });
    
    it('should support keyboard navigation to profile link', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const profileLink = $('a[href="/profile"]');
      
      expect(profileLink.length).to.equal(1);
      
      // Check that link is focusable (has href and not disabled)
      const href = profileLink.attr('href');
      const tabIndex = profileLink.attr('tabindex');
      const isDisabled = profileLink.attr('disabled') || profileLink.hasClass('disabled');
      
      expect(href).to.equal('/profile');
      expect(isDisabled).to.not.be.ok;
      expect(tabIndex !== '-1').to.be.true;
    });
  });
  
  describe('Navigation State Persistence', function() {
    it('should maintain navigation state across page loads', async function() {
      const token = generateValidToken();
      
      // First request to dashboard
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $dashboard = cheerio.load(dashboardResponse.text);
      const dashboardProfileLink = $dashboard('a[href="/profile"]');
      
      // Second request to profile
      const profileResponse = await request(app)
        .get('/profile')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $profile = cheerio.load(profileResponse.text);
      const profilePageProfileLink = $profile('a[href="/profile"]');
      
      // Both pages should have profile link
      expect(dashboardProfileLink.length).to.equal(1);
      expect(profilePageProfileLink.length).to.equal(1);
    });
    
    it('should handle session expiry gracefully in navigation', async function() {
      const expiredToken = generateExpiredToken();
      
      const response = await request(app)
        .get('/profile')
        .set('Cookie', `token=${expiredToken}`)
        .expect(302);
      
      expect(response.headers.location).to.equal('/login');
    });
  });
  
  describe('Integration with Existing Sidebar Navigation', function() {
    it('should not break existing navigation functionality', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $ = cheerio.load(response.text);
      
      // Check that both profile and dashboard links exist
      const profileLink = $('a[href="/profile"]');
      const dashboardLink = $('a[href="/dashboard"]');
      
      expect(profileLink.length).to.equal(1);
      expect(dashboardLink.length).to.equal(1);
    });
    
    it('should maintain consistent styling with existing navigation', async function() {
      const token = generateValidToken();
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const profileLink = $('a[href="/profile"]');
      const dashboardLink = $('a[href="/dashboard"]');
      
      if (profileLink.length > 0 && dashboardLink.length > 0) {
        // Check that both links have similar class structure
        const profileClasses = profileLink.attr('class') || '';
        const dashboardClasses = dashboardLink.attr('class') || '';
        
        // Both should have nav-related classes or be in similar containers
        const profileInNav = profileLink.closest('.nav, .navbar, .sidebar').length > 0;
        const dashboardInNav = dashboardLink.closest('.nav, .navbar, .sidebar').length > 0;
        
        expect(profileInNav).to.equal(dashboardInNav);
      }
    });
    
    it('should handle logout functionality with profile navigation', async function() {
      const token = generateValidToken();
      
      // First verify profile link exists when authenticated
      const authenticatedResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', `token=${token}`)
        .expect(200);
      
      const $authenticated = cheerio.load(authenticatedResponse.text);
      const profileLinkAuthenticated = $authenticated('a[href="/profile"]');
      expect(profileLinkAuthenticated.length).to.equal(1);
      
      // Then check that profile link is hidden after logout (simulated by no token)
      const loggedOutResponse = await request(app)
        .get('/')
        .expect(200);
      
      const $loggedOut = cheerio.load(loggedOutResponse.text);
      const profileLinkLoggedOut = $loggedOut('a[href="/profile"]');
      expect(profileLinkLoggedOut.length).to.equal(0);
    });
  });
});