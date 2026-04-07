const request = require('supertest');
const { JSDOM } = require('jsdom');
const app = require('../app');

// Test configuration constants
const DESKTOP_WIDTH = 1024;
const TABLET_WIDTH = 768;
const MOBILE_WIDTH = 480;
const SIDEBAR_BREAKPOINT = 768;
const ANIMATION_TIMEOUT = 500;
const TEST_USER_ID = 'test-user-123';
const CSRF_TOKEN = 'test-csrf-token';

// Mock authentication middleware
const mockAuthenticatedUser = {
  id: TEST_USER_ID,
  username: 'testuser',
  email: 'test@example.com'
};

describe('Navigation System Tests', () => {
  let agent;
  let dom;
  let window;
  let document;

  beforeEach(() => {
    agent = request.agent(app);
    // Mock authenticated session
    jest.spyOn(app, 'use').mockImplementation((middleware) => {
      if (middleware.name === 'isAuthenticated') {
        return (req, res, next) => {
          req.user = mockAuthenticatedUser;
          req.isAuthenticated = () => true;
          next();
        };
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (dom) {
      dom.window.close();
    }
  });

  describe('Desktop Sidebar Layout (> 768px)', () => {
    beforeEach(async () => {
      const response = await agent.get('/dashboard');
      dom = new JSDOM(response.text, {
        pretendToBeVisual: true,
        resources: 'usable'
      });
      window = dom.window;
      document = window.document;
      
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: DESKTOP_WIDTH
      });
    });

    test('AC1: Fixed left sidebar is visible on desktop with all navigation items', async () => {
      const response = await agent.get('/dashboard');
      expect(response.status).toBe(200);
      expect(response.text).toContain('class="sidebar');
      expect(response.text).toContain('Dashboard');
      expect(response.text).toContain('Profile');
      expect(response.text).toContain('Settings');
      expect(response.text).toContain('Logout');

      const sidebar = document.querySelector('.sidebar');
      expect(sidebar).toBeTruthy();
      expect(sidebar.classList.contains('sidebar-desktop')).toBe(true);
      
      const navItems = document.querySelectorAll('.sidebar-nav-item');
      expect(navItems.length).toBe(4);
      
      const navTexts = Array.from(navItems).map(item => item.textContent.trim());
      expect(navTexts).toContain('Dashboard');
      expect(navTexts).toContain('Profile');
      expect(navTexts).toContain('Settings');
      expect(navTexts).toContain('Logout');
    });

    test('AC2: Navigation item highlighting and active state management', async () => {
      const dashboardResponse = await agent.get('/dashboard');
      dom = new JSDOM(dashboardResponse.text);
      document = dom.window.document;

      const activeItem = document.querySelector('.sidebar-nav-item.active');
      expect(activeItem).toBeTruthy();
      expect(activeItem.textContent.trim()).toBe('Dashboard');
      expect(activeItem.getAttribute('href')).toBe('/dashboard');

      // Test Profile page active state
      const profileResponse = await agent.get('/profile');
      expect(profileResponse.status).toBe(200);
      
      const profileDom = new JSDOM(profileResponse.text);
      const profileActiveItem = profileDom.window.document.querySelector('.sidebar-nav-item.active');
      expect(profileActiveItem.textContent.trim()).toBe('Profile');
    });

    test('Sidebar maintains fixed positioning on desktop', () => {
      const sidebar = document.querySelector('.sidebar');
      const computedStyle = window.getComputedStyle(sidebar);
      
      expect(computedStyle.position).toBe('fixed');
      expect(computedStyle.left).toBe('0px');
      expect(computedStyle.top).toBe('0px');
      expect(computedStyle.height).toBe('100vh');
    });

    test('Main content area adjusts for sidebar width on desktop', () => {
      const mainContent = document.querySelector('.main-content');
      const sidebar = document.querySelector('.sidebar');
      
      expect(mainContent).toBeTruthy();
      expect(sidebar).toBeTruthy();
      
      const sidebarWidth = window.getComputedStyle(sidebar).width;
      const mainContentMargin = window.getComputedStyle(mainContent).marginLeft;
      
      expect(sidebarWidth).toBe('250px');
      expect(mainContentMargin).toBe('250px');
    });
  });

  describe('Mobile Responsive Layout (<= 768px)', () => {
    beforeEach(async () => {
      const response = await agent.get('/dashboard');
      dom = new JSDOM(response.text, {
        pretendToBeVisual: true,
        resources: 'usable'
      });
      window = dom.window;
      document = window.document;
      
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: MOBILE_WIDTH
      });
      
      // Trigger resize event
      const resizeEvent = new window.Event('resize');
      window.dispatchEvent(resizeEvent);
    });

    test('AC3: Sidebar collapses to hamburger menu on mobile', () => {
      const hamburgerButton = document.querySelector('.hamburger-menu');
      const sidebar = document.querySelector('.sidebar');
      
      expect(hamburgerButton).toBeTruthy();
      expect(hamburgerButton.style.display).not.toBe('none');
      
      // Sidebar should be hidden by default on mobile
      expect(sidebar.classList.contains('sidebar-mobile-hidden')).toBe(true);
    });

    test('AC4: Hamburger menu toggles sidebar with smooth animation', (done) => {
      const hamburgerButton = document.querySelector('.hamburger-menu');
      const sidebar = document.querySelector('.sidebar');
      
      expect(sidebar.classList.contains('sidebar-mobile-hidden')).toBe(true);
      
      // Simulate hamburger click
      hamburgerButton.click();
      
      // Check immediate state change
      expect(sidebar.classList.contains('sidebar-mobile-visible')).toBe(true);
      expect(sidebar.classList.contains('sidebar-mobile-hidden')).toBe(false);
      
      // Test animation classes
      expect(sidebar.classList.contains('sidebar-slide-in')).toBe(true);
      
      // Test second click to hide
      setTimeout(() => {
        hamburgerButton.click();
        expect(sidebar.classList.contains('sidebar-mobile-hidden')).toBe(true);
        expect(sidebar.classList.contains('sidebar-slide-out')).toBe(true);
        done();
      }, ANIMATION_TIMEOUT);
    });

    test('Sidebar overlay behavior on mobile', () => {
      const hamburgerButton = document.querySelector('.hamburger-menu');
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.querySelector('.sidebar-overlay');
      
      hamburgerButton.click();
      
      expect(overlay).toBeTruthy();
      expect(overlay.style.display).not.toBe('none');
      expect(sidebar.style.zIndex).toBe('1001');
      expect(overlay.style.zIndex).toBe('1000');
    });

    test('Clicking overlay closes mobile sidebar', () => {
      const hamburgerButton = document.querySelector('.hamburger-menu');
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.querySelector('.sidebar-overlay');
      
      hamburgerButton.click();
      expect(sidebar.classList.contains('sidebar-mobile-visible')).toBe(true);
      
      overlay.click();
      expect(sidebar.classList.contains('sidebar-mobile-hidden')).toBe(true);
    });
  });

  describe('Dashboard Page Content', () => {
    test('AC5: Dashboard page renders with proper content and layout', async () => {
      const response = await agent.get('/dashboard');
      expect(response.status).toBe(200);
      
      // Check for dashboard-specific content
      expect(response.text).toContain('class="dashboard-container"');
      expect(response.text).toContain('Dashboard');
      expect(response.text).toContain('class="dashboard-stats"');
      expect(response.text).toContain('class="dashboard-widgets"');
      
      dom = new JSDOM(response.text);
      document = dom.window.document;
      
      const dashboardContainer = document.querySelector('.dashboard-container');
      const mainContent = document.querySelector('.main-content');
      
      expect(dashboardContainer).toBeTruthy();
      expect(mainContent).toBeTruthy();
      expect(mainContent.contains(dashboardContainer)).toBe(true);
    });

    test('Dashboard content adjusts to sidebar width', async () => {
      const response = await agent.get('/dashboard');
      dom = new JSDOM(response.text);
      document = dom.window.document;
      window = dom.window;
      
      const dashboardContainer = document.querySelector('.dashboard-container');
      const sidebar = document.querySelector('.sidebar');
      
      const sidebarWidth = parseInt(window.getComputedStyle(sidebar).width);
      const containerMargin = parseInt(window.getComputedStyle(dashboardContainer).marginLeft);
      
      expect(containerMargin).toBeGreaterThanOrEqual(sidebarWidth);
    });
  });

  describe('Placeholder Pages', () => {
    test('AC6: Profile page maintains layout structure', async () => {
      const response = await agent.get('/profile');
      expect(response.status).toBe(200);
      
      // Check for consistent layout elements
      expect(response.text).toContain('class="sidebar');
      expect(response.text).toContain('class="main-content"');
      expect(response.text).toContain('Profile');
      
      dom = new JSDOM(response.text);
      document = dom.window.document;
      
      const activeNavItem = document.querySelector('.sidebar-nav-item.active');
      expect(activeNavItem.textContent.trim()).toBe('Profile');
    });

    test('AC6: Settings page maintains layout structure', async () => {
      const response = await agent.get('/settings');
      expect(response.status).toBe(200);
      
      // Check for consistent layout elements
      expect(response.text).toContain('class="sidebar');
      expect(response.text).toContain('class="main-content"');
      expect(response.text).toContain('Settings');
      
      dom = new JSDOM(response.text);
      document = dom.window.document;
      
      const activeNavItem = document.querySelector('.sidebar-nav-item.active');
      expect(activeNavItem.textContent.trim()).toBe('Settings');
    });

    test('All pages have consistent sidebar navigation', async () => {
      const pages = ['/dashboard', '/profile', '/settings'];
      
      for (const page of pages) {
        const response = await agent.get(page);
        expect(response.status).toBe(200);
        
        dom = new JSDOM(response.text);
        document = dom.window.document;
        
        const navItems = document.querySelectorAll('.sidebar-nav-item');
        expect(navItems.length).toBe(4);
        
        const navLinks = Array.from(navItems).map(item => item.getAttribute('href'));
        expect(navLinks).toContain('/dashboard');
        expect(navLinks).toContain('/profile');
        expect(navLinks).toContain('/settings');
        expect(navLinks).toContain('/logout');
      }
    });
  });

  describe('Authentication and Security', () => {
    test('Unauthenticated users cannot access sidebar pages', async () => {
      // Mock unauthenticated state
      jest.spyOn(app, 'use').mockImplementation((middleware) => {
        if (middleware.name === 'isAuthenticated') {
          return (req, res, next) => {
            req.isAuthenticated = () => false;
            res.redirect('/login');
          };
        }
      });

      const pages = ['/dashboard', '/profile', '/settings'];
      
      for (const page of pages) {
        const response = await request(app).get(page);
        expect([302, 401]).toContain(response.status);
      }
    });

    test('CSRF protection on logout', async () => {
      const response = await agent.post('/logout')
        .send({ _csrf: 'invalid-token' });
      
      expect([400, 403]).toContain(response.status);
    });

    test('XSS protection in navigation rendering', async () => {
      const maliciousUser = {
        ...mockAuthenticatedUser,
        username: '<script>alert("xss")</script>',
        email: 'test@example.com'
      };
      
      jest.spyOn(app, 'use').mockImplementation((middleware) => {
        if (middleware.name === 'isAuthenticated') {
          return (req, res, next) => {
            req.user = maliciousUser;
            req.isAuthenticated = () => true;
            next();
          };
        }
      });

      const response = await agent.get('/dashboard');
      expect(response.text).not.toContain('<script>alert("xss")</script>');
      expect(response.text).toContain('&lt;script&gt;');
    });
  });

  describe('Responsive Breakpoint Behavior', () => {
    test('Layout switches at exact breakpoint', async () => {
      const response = await agent.get('/dashboard');
      dom = new JSDOM(response.text, {
        pretendToBeVisual: true,
        resources: 'usable'
      });
      window = dom.window;
      document = window.document;

      // Test at breakpoint boundary
      Object.defineProperty(window, 'innerWidth', {
        value: SIDEBAR_BREAKPOINT,
        writable: true
      });
      
      const resizeEvent = new window.Event('resize');
      window.dispatchEvent(resizeEvent);
      
      const hamburgerButton = document.querySelector('.hamburger-menu');
      const sidebar = document.querySelector('.sidebar');
      
      // At exactly 768px, should show mobile layout
      expect(window.getComputedStyle(hamburgerButton).display).not.toBe('none');
      expect(sidebar.classList.contains('sidebar-mobile-hidden')).toBe(true);
    });

    test('Sidebar state persists during resize', async () => {
      const response = await agent.get('/dashboard');
      dom = new JSDOM(response.text, {
        pretendToBeVisual: true,
        resources: 'usable'
      });
      window = dom.window;
      document = window.document;

      // Start mobile, open sidebar
      Object.defineProperty(window, 'innerWidth', { value: MOBILE_WIDTH });
      window.dispatchEvent(new window.Event('resize'));
      
      const hamburgerButton = document.querySelector('.hamburger-menu');
      hamburgerButton.click();
      
      expect(document.querySelector('.sidebar').classList.contains('sidebar-mobile-visible')).toBe(true);
      
      // Resize to desktop
      Object.defineProperty(window, 'innerWidth', { value: DESKTOP_WIDTH });
      window.dispatchEvent(new window.Event('resize'));
      
      // Sidebar should be visible on desktop
      const sidebar = document.querySelector('.sidebar');
      expect(sidebar.classList.contains('sidebar-desktop')).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('Handles missing user data gracefully', async () => {
      jest.spyOn(app, 'use').mockImplementation((middleware) => {
        if (middleware.name === 'isAuthenticated') {
          return (req, res, next) => {
            req.user = null;
            req.isAuthenticated = () => true;
            next();
          };
        }
      });

      const response = await agent.get('/dashboard');
      expect(response.status).not.toBe(500);
    });

    test('Handles rapid sidebar toggle clicks', (done) => {
      agent.get('/dashboard').then((response) => {
        dom = new JSDOM(response.text, {
          pretendToBeVisual: true,
          resources: 'usable'
        });
        window = dom.window;
        document = window.document;

        Object.defineProperty(window, 'innerWidth', { value: MOBILE_WIDTH });
        
        const hamburgerButton = document.querySelector('.hamburger-menu');
        const sidebar = document.querySelector('.sidebar');
        
        // Rapid clicks
        hamburgerButton.click();
        hamburgerButton.click();
        hamburgerButton.click();
        
        setTimeout(() => {
          // Should end in a consistent state
          const isVisible = sidebar.classList.contains('sidebar-mobile-visible');
          const isHidden = sidebar.classList.contains('sidebar-mobile-hidden');
          expect(isVisible !== isHidden).toBe(true);
          done();
        }, ANIMATION_TIMEOUT + 100);
      });
    });

    test('Navigation works with keyboard interaction', async () => {
      const response = await agent.get('/dashboard');
      dom = new JSDOM(response.text);
      document = dom.window.document;
      window = dom.window;
      
      const navItems = document.querySelectorAll('.sidebar-nav-item');
      
      navItems.forEach(item => {
        expect(item.getAttribute('tabindex')).not.toBe('-1');
        expect(item.tagName.toLowerCase()).toBe('a');
      });
      
      const hamburgerButton = document.querySelector('.hamburger-menu');
      expect(hamburgerButton.getAttribute('tabindex')).not.toBe('-1');
      expect(hamburgerButton.getAttribute('role')).toBe('button');
    });
  });
});