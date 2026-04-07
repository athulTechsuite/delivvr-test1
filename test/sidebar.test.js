const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const cheerio = require('cheerio');

// Test constants
const DESKTOP_BREAKPOINT = 769;
const MOBILE_BREAKPOINT = 768;
const SIDEBAR_WIDTH = 250;
const ANIMATION_DURATION = 300;

const NAVIGATION_ITEMS = ['Dashboard', 'Profile', 'Settings', 'Logout'];
const DASHBOARD_ROUTE = '/dashboard';
const PROFILE_ROUTE = '/profile';
const SETTINGS_ROUTE = '/settings';
const LOGOUT_ROUTE = '/logout';

describe('Sidebar Navigation Layout Tests', function() {
  let app;
  let server;
  let authenticatedUser;
  let mockSession;

  before(function() {
    // Setup test application and server
    app = require('../app');
    server = app.listen(0);
    
    // Mock authenticated user session
    authenticatedUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com'
    };
    
    mockSession = {
      user: authenticatedUser,
      isAuthenticated: true
    };
  });

  after(function() {
    if (server) {
      server.close();
    }
  });

  beforeEach(function() {
    // Reset all stubs and mocks before each test
    sinon.restore();
  });

  describe('Desktop Sidebar Layout (Screen Width > 768px)', function() {
    it('should display fixed left sidebar with all navigation items on authenticated pages', async function() {
      const agent = request.agent(app);
      
      // Mock authentication middleware
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get(DASHBOARD_ROUTE)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify sidebar container exists
      const sidebar = $('.sidebar');
      expect(sidebar).to.have.lengthOf(1);
      expect(sidebar.hasClass('sidebar-desktop')).to.be.true;
      
      // Verify all navigation items are present
      NAVIGATION_ITEMS.forEach(item => {
        const navItem = $(`.sidebar-nav a:contains("${item}")`);
        expect(navItem).to.have.lengthOf(1);
        expect(navItem.attr('href')).to.exist;
      });
      
      // Verify sidebar is fixed position
      expect(sidebar.css('position')).to.equal('fixed');
      expect(sidebar.css('left')).to.equal('0px');
      expect(sidebar.css('top')).to.equal('0px');
    });

    it('should highlight active navigation item when clicked', async function() {
      const agent = request.agent(app);
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            req.originalUrl = DASHBOARD_ROUTE;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get(DASHBOARD_ROUTE)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify active navigation item has proper styling
      const activeNavItem = $(`.sidebar-nav a[href="${DASHBOARD_ROUTE}"]`);
      expect(activeNavItem.hasClass('nav-item-active')).to.be.true;
      
      // Verify other items are not active
      const inactiveItems = $(`.sidebar-nav a:not([href="${DASHBOARD_ROUTE}"])`);
      inactiveItems.each((index, element) => {
        expect($(element).hasClass('nav-item-active')).to.be.false;
      });
    });

    it('should adjust main content area to accommodate sidebar width', async function() {
      const agent = request.agent(app);
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get(DASHBOARD_ROUTE)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify main content area has proper margin/padding for sidebar
      const mainContent = $('.main-content');
      expect(mainContent).to.have.lengthOf(1);
      
      const marginLeft = parseInt(mainContent.css('margin-left')) || 0;
      const paddingLeft = parseInt(mainContent.css('padding-left')) || 0;
      const leftOffset = marginLeft + paddingLeft;
      
      expect(leftOffset).to.be.at.least(SIDEBAR_WIDTH);
    });
  });

  describe('Mobile Sidebar Layout (Screen Width <= 768px)', function() {
    it('should collapse sidebar to hamburger menu on mobile devices', async function() {
      const agent = request.agent(app);
      
      // Mock mobile user agent
      const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15';
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            req.headers['user-agent'] = mobileUserAgent;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get(DASHBOARD_ROUTE)
        .set('User-Agent', mobileUserAgent)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify hamburger menu button exists
      const hamburgerMenu = $('.hamburger-menu-btn');
      expect(hamburgerMenu).to.have.lengthOf(1);
      expect(hamburgerMenu.attr('data-toggle')).to.equal('sidebar');
      
      // Verify sidebar is initially hidden on mobile
      const sidebar = $('.sidebar');
      expect(sidebar.hasClass('sidebar-mobile')).to.be.true;
      expect(sidebar.hasClass('sidebar-collapsed')).to.be.true;
      
      // Verify top navigation remains intact
      const topNav = $('.top-navigation');
      expect(topNav).to.have.lengthOf(1);
    });

    it('should provide smooth animation for sidebar toggle on mobile', async function() {
      const agent = request.agent(app);
      const mobileUserAgent = 'Mozilla/5.0 (Android 11; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0';
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            req.headers['user-agent'] = mobileUserAgent;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get(DASHBOARD_ROUTE)
        .set('User-Agent', mobileUserAgent)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify sidebar has transition CSS properties for smooth animation
      const sidebar = $('.sidebar');
      const transitionProperty = sidebar.css('transition');
      
      // Check for transform or left transition with proper duration
      expect(transitionProperty).to.match(/transform|left/);
      expect(transitionProperty).to.include(`${ANIMATION_DURATION}ms`);
      
      // Verify sidebar overlay functionality
      const sidebarOverlay = $('.sidebar-overlay');
      expect(sidebarOverlay).to.have.lengthOf(1);
      expect(sidebarOverlay.hasClass('sidebar-overlay-hidden')).to.be.true;
    });
  });

  describe('Dashboard Page Content', function() {
    it('should render properly formatted dashboard content', async function() {
      const agent = request.agent(app);
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get(DASHBOARD_ROUTE)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify dashboard-specific content exists
      const dashboardContent = $('.dashboard-content');
      expect(dashboardContent).to.have.lengthOf(1);
      
      // Verify page title
      const pageTitle = $('h1');
      expect(pageTitle.text()).to.include('Dashboard');
      
      // Verify dashboard widgets/cards are present
      const dashboardWidgets = $('.dashboard-widget, .dashboard-card');
      expect(dashboardWidgets.length).to.be.at.least(1);
      
      // Verify main content adjusts properly with sidebar
      const mainContent = $('.main-content');
      expect(mainContent).to.have.lengthOf(1);
      expect(mainContent.hasClass('content-with-sidebar')).to.be.true;
    });
  });

  describe('Navigation Routes', function() {
    beforeEach(function() {
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            next();
          };
        }
        return middleware;
      });
    });

    it('should navigate to Profile page with same layout structure', async function() {
      const agent = request.agent(app);
      
      const response = await agent
        .get(PROFILE_ROUTE)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify layout structure is maintained
      const sidebar = $('.sidebar');
      expect(sidebar).to.have.lengthOf(1);
      
      const mainContent = $('.main-content');
      expect(mainContent).to.have.lengthOf(1);
      
      // Verify Profile is active navigation item
      const activeNavItem = $(`.sidebar-nav a[href="${PROFILE_ROUTE}"]`);
      expect(activeNavItem.hasClass('nav-item-active')).to.be.true;
      
      // Verify page-specific content
      const pageTitle = $('h1');
      expect(pageTitle.text()).to.include('Profile');
    });

    it('should navigate to Settings page with same layout structure', async function() {
      const agent = request.agent(app);
      
      const response = await agent
        .get(SETTINGS_ROUTE)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify layout structure is maintained
      const sidebar = $('.sidebar');
      expect(sidebar).to.have.lengthOf(1);
      
      const mainContent = $('.main-content');
      expect(mainContent).to.have.lengthOf(1);
      
      // Verify Settings is active navigation item
      const activeNavItem = $(`.sidebar-nav a[href="${SETTINGS_ROUTE}"]`);
      expect(activeNavItem.hasClass('nav-item-active')).to.be.true;
      
      // Verify page-specific content
      const pageTitle = $('h1');
      expect(pageTitle.text()).to.include('Settings');
    });
  });

  describe('Security and Authentication', function() {
    it('should require authentication for all sidebar navigation routes', async function() {
      const agent = request.agent(app);
      
      // Test without authentication
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = {};
            req.user = null;
            res.redirect('/login');
          };
        }
        return middleware;
      });

      const routes = [DASHBOARD_ROUTE, PROFILE_ROUTE, SETTINGS_ROUTE];
      
      for (const route of routes) {
        const response = await agent.get(route);
        expect(response.status).to.be.oneOf([302, 401]); // Redirect to login or unauthorized
        
        if (response.status === 302) {
          expect(response.headers.location).to.include('/login');
        }
      }
    });

    it('should sanitize user data before rendering in sidebar', async function() {
      const agent = request.agent(app);
      
      // Mock user with potentially malicious data
      const maliciousUser = {
        id: 1,
        username: '<script>alert("xss")</script>testuser',
        email: 'test@example.com'
      };
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = { user: maliciousUser, isAuthenticated: true };
            req.user = maliciousUser;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get(DASHBOARD_ROUTE)
        .expect(200);

      // Verify script tags are escaped/sanitized
      expect(response.text).to.not.include('<script>alert("xss")</script>');
      expect(response.text).to.not.include('alert("xss")');
    });
  });

  describe('Error Handling', function() {
    it('should handle sidebar rendering errors gracefully', async function() {
      const agent = request.agent(app);
      
      // Mock template rendering error
      sinon.stub(app, 'render').throws(new Error('Template rendering failed'));
      
      try {
        await agent
          .get(DASHBOARD_ROUTE)
          .expect(500);
      } catch (error) {
        // Verify error is handled properly
        expect(error.message).to.include('Template rendering failed');
      }
    });

    it('should handle invalid navigation routes', async function() {
      const agent = request.agent(app);
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get('/invalid-sidebar-route')
        .expect(404);
      
      // Verify 404 page still includes proper layout if authenticated
      const $ = cheerio.load(response.text);
      const errorMessage = $('.error-message');
      expect(errorMessage).to.have.lengthOf(1);
    });
  });

  describe('Responsive Design Edge Cases', function() {
    it('should handle viewport size changes gracefully', async function() {
      const agent = request.agent(app);
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get(DASHBOARD_ROUTE)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify responsive CSS classes exist
      const sidebar = $('.sidebar');
      expect(sidebar.hasClass('sidebar-responsive')).to.be.true;
      
      // Verify CSS media queries are included
      const styleContent = $('style, link[rel="stylesheet"]');
      expect(styleContent.length).to.be.at.least(1);
    });

    it('should handle empty or null user session data', async function() {
      const agent = request.agent(app);
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = { user: null, isAuthenticated: false };
            req.user = null;
            next();
          };
        }
        return middleware;
      });

      const response = await agent.get(DASHBOARD_ROUTE);
      
      // Should redirect to login or show unauthorized
      expect(response.status).to.be.oneOf([302, 401]);
    });
  });

  describe('Performance Considerations', function() {
    it('should minimize DOM elements for sidebar on mobile', async function() {
      const agent = request.agent(app);
      const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)';
      
      sinon.stub(app, 'use').callsFake((middleware) => {
        if (middleware.name === 'authMiddleware') {
          return (req, res, next) => {
            req.session = mockSession;
            req.user = authenticatedUser;
            req.headers['user-agent'] = mobileUserAgent;
            next();
          };
        }
        return middleware;
      });

      const response = await agent
        .get(DASHBOARD_ROUTE)
        .set('User-Agent', mobileUserAgent)
        .expect(200);

      const $ = cheerio.load(response.text);
      
      // Verify sidebar content is efficiently structured for mobile
      const sidebarNavItems = $('.sidebar-nav li');
      expect(sidebarNavItems.length).to.equal(NAVIGATION_ITEMS.length);
      
      // Verify no unnecessary nested elements
      const unnecessaryNesting = $('.sidebar .sidebar .sidebar');
      expect(unnecessaryNesting).to.have.lengthOf(0);
    });
  });
});