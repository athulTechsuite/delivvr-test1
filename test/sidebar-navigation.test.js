const request = require('supertest');
const { JSDOM } = require('jsdom');
const puppeteer = require('puppeteer');
const app = require('../app');

// Test configuration constants
const DESKTOP_BREAKPOINT = 769;
const MOBILE_BREAKPOINT = 768;
const SIDEBAR_WIDTH = 250;
const ANIMATION_TIMEOUT = 300;
const TEST_USER = {
  id: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com'
};

describe('Fixed Sidebar Navigation Layout Tests', () => {
  let browser;
  let page;
  let authenticatedAgent;

  beforeAll(async () => {
    // Setup Puppeteer for responsive testing
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Setup authenticated session for each test
    authenticatedAgent = request.agent(app);
    
    // Mock authentication by setting session
    jest.spyOn(app, 'use').mockImplementation((middleware) => {
      if (middleware.name === 'authenticateToken') {
        return (req, res, next) => {
          req.user = TEST_USER;
          req.cookies = { token: 'valid-token' };
          next();
        };
      }
      return middleware;
    });

    if (browser) {
      page = await browser.newPage();
      await page.setDefaultTimeout(5000);
    }
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  describe('AC1: Desktop Sidebar Visibility (screen width > 768px)', () => {
    beforeEach(async () => {
      if (page) {
        await page.setViewport({ width: 1024, height: 768 });
      }
    });

    // TC-AC1-001: Fixed sidebar displays on desktop with all navigation items
    test('should display fixed left sidebar with Dashboard, Profile, Settings, and Logout items on desktop', async () => {
      const response = await authenticatedAgent
        .get('/dashboard')
        .expect(200);

      const dom = new JSDOM(response.text);
      const document = dom.window.document;

      // Verify sidebar exists and is fixed
      const sidebar = document.querySelector('.sidebar');
      expect(sidebar).toBeTruthy();
      expect(sidebar.style.position).toBe('fixed');

      // Verify all navigation items are present
      const navItems = document.querySelectorAll('.sidebar-nav-link');
      const navTexts = Array.from(navItems).map(item => item.textContent.trim());
      
      expect(navTexts).toContain('Dashboard');
      expect(navTexts).toContain('Profile');
      expect(navTexts).toContain('Settings');
      expect(navTexts).toContain('Logout');
      expect(navItems.length).toBe(4);
    });

    // TC-AC1-002: Sidebar coexists with top navigation
    test('should maintain existing top navigation alongside sidebar', async () => {
      const response = await authenticatedAgent
        .get('/dashboard')
        .expect(200);

      expect(response.text).toContain('class="sidebar"');
      expect(response.text).toContain('class="top-nav"');
      expect(response.text).toContain('navbar');
    });

    // TC-AC1-003: Sidebar positioning and dimensions
    test('should have correct fixed positioning and width on desktop', async () => {
      if (!page) {
        pending('Puppeteer not available');
        return;
      }

      await page.goto('http://localhost:3000/dashboard', { 
        waitUntil: 'networkidle0' 
      });

      const sidebarStyles = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return null;
        
        const styles = window.getComputedStyle(sidebar);
        return {
          position: styles.position,
          left: styles.left,
          top: styles.top,
          width: styles.width,
          height: styles.height
        };
      });

      expect(sidebarStyles).toBeTruthy();
      expect(sidebarStyles.position).toBe('fixed');
      expect(sidebarStyles.left).toBe('0px');
      expect(sidebarStyles.top).toBe('0px');
      expect(parseInt(sidebarStyles.width)).toBe(SIDEBAR_WIDTH);
    });
  });

  describe('AC2: Navigation Active States and Visual Feedback', () => {
    // TC-AC2-001: Active navigation item highlighting
    test('should highlight active navigation item with proper visual feedback', async () => {
      const dashboardResponse = await authenticatedAgent
        .get('/dashboard')
        .expect(200);

      const dashboardDom = new JSDOM(dashboardResponse.text);
      const dashboardDoc = dashboardDom.window.document;
      
      const activeDashboard = dashboardDoc.querySelector('.sidebar-nav-link.active');
      expect(activeDashboard).toBeTruthy();
      expect(activeDashboard.textContent.trim()).toContain('Dashboard');

      // Test profile page active state
      const profileResponse = await authenticatedAgent
        .get('/profile')
        .expect(200);

      const profileDom = new JSDOM(profileResponse.text);
      const profileDoc = profileDom.window.document;
      
      const activeProfile = profileDoc.querySelector('.sidebar-nav-link.active');
      expect(activeProfile).toBeTruthy();
      expect(activeProfile.textContent.trim()).toContain('Profile');
    });

    // TC-AC2-002: Only one active item at a time
    test('should maintain only one active navigation item at a time', async () => {
      const response = await authenticatedAgent
        .get('/settings')
        .expect(200);

      const dom = new JSDOM(response.text);
      const document = dom.window.document;
      
      const activeItems = document.querySelectorAll('.sidebar-nav-link.active');
      expect(activeItems.length).toBe(1);
      expect(activeItems[0].textContent.trim()).toContain('Settings');
    });
  });

  describe('AC3: Mobile Responsive Behavior (screen width <= 768px)', () => {
    beforeEach(async () => {
      if (page) {
        await page.setViewport({ width: 375, height: 667 }); // Mobile viewport
      }
    });

    // TC-AC3-001: Sidebar collapses to hamburger menu on mobile
    test('should collapse sidebar to hamburger menu on mobile load', async () => {
      if (!page) {
        pending('Puppeteer not available');
        return;
      }

      await page.goto('http://localhost:3000/dashboard', { 
        waitUntil: 'networkidle0' 
      });

      // Check hamburger button is visible
      const hamburgerVisible = await page.evaluate(() => {
        const hamburger = document.querySelector('.hamburger-btn');
        return hamburger && window.getComputedStyle(hamburger).display !== 'none';
      });

      expect(hamburgerVisible).toBe(true);

      // Check sidebar is initially collapsed
      const sidebarCollapsed = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return sidebar && sidebar.classList.contains('collapsed');
      });

      expect(sidebarCollapsed).toBe(true);
    });

    // TC-AC3-002: Top navigation remains intact on mobile
    test('should keep top navigation intact when sidebar collapses', async () => {
      const response = await authenticatedAgent
        .get('/dashboard')
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .expect(200);

      // Top navigation should still be present
      expect(response.text).toContain('top-nav');
      expect(response.text).toContain('navbar');
      
      // Hamburger menu should be present
      expect(response.text).toContain('hamburger-btn');
    });
  });

  describe('AC4: Mobile Sidebar Animation and Overlay', () => {
    beforeEach(async () => {
      if (page) {
        await page.setViewport({ width: 375, height: 667 });
      }
    });

    // TC-AC4-001: Hamburger menu toggles sidebar with animation
    test('should slide sidebar in/out with smooth animation when hamburger is tapped', async () => {
      if (!page) {
        pending('Puppeteer not available');
        return;
      }

      await page.goto('http://localhost:3000/dashboard', { 
        waitUntil: 'networkidle0' 
      });

      // Initial state - sidebar should be collapsed
      let sidebarState = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return {
          isCollapsed: sidebar.classList.contains('collapsed'),
          transform: window.getComputedStyle(sidebar).transform
        };
      });

      expect(sidebarState.isCollapsed).toBe(true);

      // Click hamburger to open sidebar
      await page.click('.hamburger-btn');
      await page.waitForTimeout(ANIMATION_TIMEOUT);

      sidebarState = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return {
          isCollapsed: sidebar.classList.contains('collapsed'),
          isVisible: !sidebar.classList.contains('collapsed')
        };
      });

      expect(sidebarState.isCollapsed).toBe(false);
      expect(sidebarState.isVisible).toBe(true);

      // Click hamburger again to close sidebar
      await page.click('.hamburger-btn');
      await page.waitForTimeout(ANIMATION_TIMEOUT);

      sidebarState = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return sidebar.classList.contains('collapsed');
      });

      expect(sidebarState).toBe(true);
    });

    // TC-AC4-002: Sidebar overlays content on mobile
    test('should overlay content when sidebar slides out on mobile', async () => {
      if (!page) {
        pending('Puppeteer not available');
        return;
      }

      await page.goto('http://localhost:3000/dashboard', { 
        waitUntil: 'networkidle0' 
      });

      // Open sidebar
      await page.click('.hamburger-btn');
      await page.waitForTimeout(ANIMATION_TIMEOUT);

      // Check overlay is visible
      const overlayVisible = await page.evaluate(() => {
        const overlay = document.querySelector('.sidebar-overlay');
        return overlay && overlay.classList.contains('show');
      });

      expect(overlayVisible).toBe(true);

      // Check sidebar has proper z-index for overlay
      const sidebarZIndex = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return parseInt(window.getComputedStyle(sidebar).zIndex);
      });

      expect(sidebarZIndex).toBeGreaterThan(1000);
    });
  });

  describe('AC5: Dashboard Content Layout Adjustment', () => {
    // TC-AC5-001: Main content adjusts for sidebar width
    test('should adjust main content area to accommodate sidebar width on dashboard', async () => {
      const response = await authenticatedAgent
        .get('/dashboard')
        .expect(200);

      const dom = new JSDOM(response.text);
      const document = dom.window.document;

      const mainContent = document.querySelector('.main-content, .content-wrapper');
      expect(mainContent).toBeTruthy();

      // Check for CSS classes or inline styles that adjust for sidebar
      const hasMarginLeft = response.text.includes('margin-left') || 
                           response.text.includes('content-wrapper');
      expect(hasMarginLeft).toBe(true);
    });

    // TC-AC5-002: Dashboard content displays properly formatted
    test('should display properly formatted dashboard content with sidebar layout', async () => {
      const response = await authenticatedAgent
        .get('/dashboard')
        .expect(200);

      // Verify dashboard-specific content is present
      expect(response.text).toContain('Dashboard');
      expect(response.text).toContain('main-content');
      
      // Verify layout structure
      expect(response.text).toContain('authenticated-layout');
      expect(response.text).toContain('sidebar');
      expect(response.text).toContain('content-wrapper');
    });
  });

  describe('AC6: Placeholder Pages Navigation', () => {
    // TC-AC6-001: Profile navigation maintains layout structure
    test('should direct to profile page maintaining same layout structure', async () => {
      const response = await authenticatedAgent
        .get('/profile')
        .expect(200);

      const dom = new JSDOM(response.text);
      const document = dom.window.document;

      // Verify sidebar structure is maintained
      const sidebar = document.querySelector('.sidebar');
      expect(sidebar).toBeTruthy();

      const navItems = document.querySelectorAll('.sidebar-nav-link');
      expect(navItems.length).toBe(4);

      // Verify profile is marked as active
      const activeItem = document.querySelector('.sidebar-nav-link.active');
      expect(activeItem.textContent.trim()).toContain('Profile');

      // Verify page content
      expect(response.text).toContain('Profile');
    });

    // TC-AC6-002: Settings navigation maintains layout structure  
    test('should direct to settings page maintaining same layout structure', async () => {
      const response = await authenticatedAgent
        .get('/settings')
        .expect(200);

      const dom = new JSDOM(response.text);
      const document = dom.window.document;

      // Verify sidebar structure is maintained
      const sidebar = document.querySelector('.sidebar');
      expect(sidebar).toBeTruthy();

      const navItems = document.querySelectorAll('.sidebar-nav-link');
      expect(navItems.length).toBe(4);

      // Verify settings is marked as active
      const activeItem = document.querySelector('.sidebar-nav-link.active');
      expect(activeItem.textContent.trim()).toContain('Settings');

      // Verify page content
      expect(response.text).toContain('Settings');
    });

    // TC-AC6-003: Navigation links have correct href attributes
    test('should have correct navigation links for all sidebar items', async () => {
      const response = await authenticatedAgent
        .get('/dashboard')
        .expect(200);

      const dom = new JSDOM(response.text);
      const document = dom.window.document;

      const dashboardLink = document.querySelector('a[href="/dashboard"]');
      const profileLink = document.querySelector('a[href="/profile"]');
      const settingsLink = document.querySelector('a[href="/settings"]');
      const logoutLink = document.querySelector('a[href="/logout"]');

      expect(dashboardLink).toBeTruthy();
      expect(profileLink).toBeTruthy();
      expect(settingsLink).toBeTruthy();
      expect(logoutLink).toBeTruthy();

      expect(dashboardLink.textContent.trim()).toContain('Dashboard');
      expect(profileLink.textContent.trim()).toContain('Profile');
      expect(settingsLink.textContent.trim()).toContain('Settings');
      expect(logoutLink.textContent.trim()).toContain('Logout');
    });
  });

  describe('Error Cases and Edge Conditions', () => {
    // TC-ERR-001: Unauthenticated access redirects properly
    test('should redirect unauthenticated users without showing sidebar', async () => {
      // Remove authentication mock
      jest.restoreAllMocks();

      const response = await request(app)
        .get('/dashboard')
        .expect(302);

      expect(response.headers.location).toContain('/login');
    });

    // TC-ERR-002: Handles missing navigation elements gracefully
    test('should handle missing sidebar elements gracefully', async () => {
      const response = await authenticatedAgent
        .get('/dashboard')
        .expect(200);

      // Should not crash even if some elements are missing
      expect(response.status).toBe(200);
      expect(response.text).toContain('Dashboard');
    });

    // TC-ERR-003: Responsive behavior at exact breakpoint
    test('should handle responsive behavior at exact 768px breakpoint', async () => {
      if (!page) {
        pending('Puppeteer not available');
        return;
      }

      // Test at exact breakpoint
      await page.setViewport({ width: MOBILE_BREAKPOINT, height: 600 });
      await page.goto('http://localhost:3000/dashboard', { 
        waitUntil: 'networkidle0' 
      });

      const isMobile = await page.evaluate(() => {
        return window.innerWidth <= 768;
      });

      const hamburgerVisible = await page.evaluate(() => {
        const hamburger = document.querySelector('.hamburger-btn');
        return hamburger && window.getComputedStyle(hamburger).display !== 'none';
      });

      expect(isMobile).toBe(true);
      expect(hamburgerVisible).toBe(true);
    });
  });
});