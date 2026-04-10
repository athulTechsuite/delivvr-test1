import puppeteer, { Browser, Page } from 'puppeteer';
import express from 'express';
import { Server } from 'http';
import path from 'path';

// Test viewport configurations
const VIEWPORTS = {
  MOBILE_SMALL: { width: 320, height: 568 },
  MOBILE: { width: 375, height: 667 },
  MOBILE_LARGE: { width: 414, height: 896 },
  TABLET_PORTRAIT: { width: 768, height: 1024 },
  TABLET_LANDSCAPE: { width: 1024, height: 768 },
  DESKTOP_SMALL: { width: 992, height: 768 },
  DESKTOP: { width: 1200, height: 800 },
  DESKTOP_LARGE: { width: 1920, height: 1080 }
};

// Bootstrap breakpoints
const BREAKPOINT_LG = 992;
const SIDEBAR_WIDTH = 280;

// Test selectors
const SELECTORS = {
  sidebar: '#sidebar',
  toggleButton: '[data-bs-toggle="offcanvas"][data-bs-target="#sidebar"]',
  closeButton: '.btn-close',
  backdrop: '.offcanvas-backdrop',
  mainContent: '.main-content',
  mobileToggleContainer: '.d-lg-none',
  navLinks: '.nav-link',
  offcanvasHeader: '.offcanvas-header',
  offcanvasBody: '.offcanvas-body'
};

// Mock Express app for testing
const createTestApp = () => {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Mock middleware for flash messages and user context
  app.use((req, res, next) => {
    res.locals.success = null;
    res.locals.error = null;
    res.locals.user = null;
    next();
  });
  
  // Test routes
  app.get('/', (req, res) => {
    res.render('layout', { 
      title: 'Home', 
      user: res.locals.user,
      body: '<h1>Home Page</h1>' 
    });
  });
  
  app.get('/dashboard', (req, res) => {
    const mockUser = { 
      id: 1, 
      username: 'testuser', 
      name: 'Test User', 
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };
    res.render('layout', { 
      title: 'Dashboard', 
      user: mockUser,
      body: '<h1>Dashboard</h1>' 
    });
  });
  
  app.get('/authenticated', (req, res) => {
    const mockUser = { 
      id: 1, 
      username: 'testuser', 
      name: 'Test User', 
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };
    res.render('layout', { 
      title: 'Authenticated Page', 
      user: mockUser,
      body: '<h1>Authenticated Content</h1>' 
    });
  });
  
  return app;
};

describe('Responsive Sidebar Behavior Tests', () => {
  let browser: Browser;
  let server: Server;
  let baseURL: string;
  let app: express.Application;
  
  beforeAll(async () => {
    // Create test app and server
    app = createTestApp();
    server = app.listen(0);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    baseURL = `http://localhost:${port}`;
    
    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: process.env.NODE_ENV === 'test',
      devtools: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }, 30000);
  
  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.close();
    }
  });
  
  describe('Mobile Responsive Behavior (< 992px)', () => {
    let page: Page;
    
    beforeEach(async () => {
      page = await browser.newPage();
      await page.setViewport(VIEWPORTS.MOBILE);
    });
    
    afterEach(async () => {
      await page.close();
    });
    
    test('should collapse sidebar on mobile devices', async () => {
      // TC-005: Sidebar remains collapsed on mobile devices and expands on larger screens
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.sidebar);
      
      // Check sidebar is initially hidden/collapsed on mobile
      const sidebarVisible = await page.evaluate((selector) => {
        const sidebar = document.querySelector(selector);
        return sidebar?.classList.contains('show') || false;
      }, SELECTORS.sidebar);
      
      expect(sidebarVisible).toBe(false);
    });
    
    test('should display mobile toggle button below 992px', async () => {
      // TC-005: Sidebar remains collapsed on mobile devices
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.toggleButton);
      
      const toggleVisible = await page.evaluate((selector) => {
        const toggleContainer = document.querySelector('.d-lg-none');
        if (!toggleContainer) return false;
        
        const computedStyle = window.getComputedStyle(toggleContainer);
        return computedStyle.display !== 'none';
      });
      
      expect(toggleVisible).toBe(true);
    });
    
    test('should expand sidebar when toggle button is clicked on mobile', async () => {
      // TC-005: Mobile toggle functionality
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.toggleButton);
      
      // Click toggle button
      await page.click(SELECTORS.toggleButton);
      await page.waitForTimeout(500); // Wait for animation
      
      // Check sidebar is now visible
      const sidebarVisible = await page.evaluate((selector) => {
        const sidebar = document.querySelector(selector);
        return sidebar?.classList.contains('show') || false;
      }, SELECTORS.sidebar);
      
      expect(sidebarVisible).toBe(true);
    });
    
    test('should display backdrop overlay on mobile when expanded', async () => {
      // TC-015: Sidebar backdrop closes sidebar on mobile when clicking outside navigation area
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.toggleButton);
      
      // Open sidebar
      await page.click(SELECTORS.toggleButton);
      await page.waitForSelector(SELECTORS.backdrop, { timeout: 3000 });
      
      const backdropExists = await page.$(SELECTORS.backdrop);
      expect(backdropExists).toBeTruthy();
      
      const backdropVisible = await page.evaluate((selector) => {
        const backdrop = document.querySelector(selector);
        if (!backdrop) return false;
        const computedStyle = window.getComputedStyle(backdrop);
        return computedStyle.display !== 'none';
      }, SELECTORS.backdrop);
      
      expect(backdropVisible).toBe(true);
    });
    
    test('should close sidebar when clicking on backdrop', async () => {
      // TC-015: Sidebar backdrop closes sidebar on mobile when clicking outside navigation area
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.toggleButton);
      
      // Open sidebar
      await page.click(SELECTORS.toggleButton);
      await page.waitForSelector(SELECTORS.backdrop);
      
      // Click backdrop to close
      await page.click(SELECTORS.backdrop);
      await page.waitForTimeout(500); // Wait for animation
      
      const sidebarVisible = await page.evaluate((selector) => {
        const sidebar = document.querySelector(selector);
        return sidebar?.classList.contains('show') || false;
      }, SELECTORS.sidebar);
      
      expect(sidebarVisible).toBe(false);
    });
    
    test('should adjust main content area properly when sidebar is collapsed on mobile', async () => {
      // TC-016: Main content area adjusts properly when sidebar is expanded or collapsed
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.mainContent);
      
      const mainContentMargin = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const computedStyle = window.getComputedStyle(element);
        return computedStyle.marginLeft;
      }, SELECTORS.mainContent);
      
      // On mobile, main content should have no left margin when sidebar is collapsed
      expect(mainContentMargin).toBe('0px');
      
      // Check that main content has top padding for mobile toggle button
      const paddingTop = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const computedStyle = window.getComputedStyle(element);
        return parseFloat(computedStyle.paddingTop);
      }, SELECTORS.mainContent);
      
      expect(paddingTop).toBeGreaterThan(60); // Should have padding for toggle button
    });
    
    test('should handle touch interactions on mobile', async () => {
      // Mobile touch interaction test
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.toggleButton);
      
      // Use touch tap instead of click
      const toggleButton = await page.$(SELECTORS.toggleButton);
      if (toggleButton) {
        const box = await toggleButton.boundingBox();
        if (box) {
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          await page.waitForTimeout(500);
          
          const sidebarVisible = await page.evaluate((selector) => {
            const sidebar = document.querySelector(selector);
            return sidebar?.classList.contains('show') || false;
          }, SELECTORS.sidebar);
          
          expect(sidebarVisible).toBe(true);
        }
      }
    });
    
    test('should maintain responsive behavior across different mobile sizes', async () => {
      // TC-013: Sidebar maintains responsive behavior across desktop, tablet, and mobile viewports
      const mobileViewports = [VIEWPORTS.MOBILE_SMALL, VIEWPORTS.MOBILE, VIEWPORTS.MOBILE_LARGE];
      
      for (const viewport of mobileViewports) {
        await page.setViewport(viewport);
        await page.goto(`${baseURL}/`);
        await page.waitForSelector(SELECTORS.toggleButton);
        
        // Toggle button should be visible on all mobile sizes
        const toggleVisible = await page.evaluate(() => {
          const toggleContainer = document.querySelector('.d-lg-none');
          if (!toggleContainer) return false;
          const computedStyle = window.getComputedStyle(toggleContainer);
          return computedStyle.display !== 'none';
        });
        
        expect(toggleVisible).toBe(true);
        
        // Sidebar should be collapsed by default
        const sidebarCollapsed = await page.evaluate((selector) => {
          const sidebar = document.querySelector(selector);
          return !sidebar?.classList.contains('show');
        }, SELECTORS.sidebar);
        
        expect(sidebarCollapsed).toBe(true);
      }
    });
  });
  
  describe('Desktop Responsive Behavior (>= 992px)', () => {
    let page: Page;
    
    beforeEach(async () => {
      page = await browser.newPage();
      await page.setViewport(VIEWPORTS.DESKTOP);
    });
    
    afterEach(async () => {
      await page.close();
    });
    
    test('should expand sidebar on larger screens (>=992px)', async () => {
      // TC-005: Sidebar remains collapsed on mobile devices and expands on larger screens
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.sidebar);
      
      // On desktop, sidebar should be visible without 'show' class (using offcanvas-lg)
      const sidebarVisible = await page.evaluate((selector) => {
        const sidebar = document.querySelector(selector);
        if (!sidebar) return false;
        
        const computedStyle = window.getComputedStyle(sidebar);
        return computedStyle.visibility !== 'hidden' && computedStyle.display !== 'none';
      }, SELECTORS.sidebar);
      
      expect(sidebarVisible).toBe(true);
    });
    
    test('should hide mobile toggle button on desktop', async () => {
      // TC-005: Toggle button behavior on desktop
      await page.goto(`${baseURL}/`);
      
      const toggleHidden = await page.evaluate(() => {
        const toggleContainer = document.querySelector('.d-lg-none');
        if (!toggleContainer) return true;
        
        const computedStyle = window.getComputedStyle(toggleContainer);
        return computedStyle.display === 'none';
      });
      
      expect(toggleHidden).toBe(true);
    });
    
    test('should adjust main content with proper left margin on desktop', async () => {
      // TC-016: Main content area adjusts properly when sidebar is expanded or collapsed
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.mainContent);
      
      const mainContentMargin = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const computedStyle = window.getComputedStyle(element);
        return computedStyle.marginLeft;
      }, SELECTORS.mainContent);
      
      // On desktop, main content should have left margin equal to sidebar width
      expect(mainContentMargin).toBe(`${SIDEBAR_WIDTH}px`);
    });
    
    test('should not display backdrop on desktop', async () => {
      // Desktop should not have backdrop overlay
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.sidebar);
      
      const backdrop = await page.$(SELECTORS.backdrop);
      expect(backdrop).toBeFalsy();
    });
    
    test('should maintain sidebar visibility during navigation on desktop', async () => {
      // Test sidebar persistence across page navigation
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.sidebar);
      
      // Navigate to another page
      await page.goto(`${baseURL}/dashboard`);
      await page.waitForSelector(SELECTORS.sidebar);
      
      const sidebarVisible = await page.evaluate((selector) => {
        const sidebar = document.querySelector(selector);
        if (!sidebar) return false;
        const computedStyle = window.getComputedStyle(sidebar);
        return computedStyle.visibility !== 'hidden';
      }, SELECTORS.sidebar);
      
      expect(sidebarVisible).toBe(true);
    });
    
    test('should handle desktop viewport transitions properly', async () => {
      // TC-013: Sidebar maintains responsive behavior across desktop, tablet, and mobile viewports
      
      // Start with mobile
      await page.setViewport(VIEWPORTS.MOBILE);
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.toggleButton);
      
      let toggleVisible = await page.evaluate(() => {
        const toggleContainer = document.querySelector('.d-lg-none');
        if (!toggleContainer) return false;
        const computedStyle = window.getComputedStyle(toggleContainer);
        return computedStyle.display !== 'none';
      });
      expect(toggleVisible).toBe(true);
      
      // Switch to desktop
      await page.setViewport(VIEWPORTS.DESKTOP);
      await page.waitForTimeout(500); // Allow for CSS transitions
      
      toggleVisible = await page.evaluate(() => {
        const toggleContainer = document.querySelector('.d-lg-none');
        if (!toggleContainer) return false;
        const computedStyle = window.getComputedStyle(toggleContainer);
        return computedStyle.display === 'none';
      });
      expect(toggleVisible).toBe(true);
      
      // Check main content margin adjusted
      const mainContentMargin = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const computedStyle = window.getComputedStyle(element);
        return computedStyle.marginLeft;
      }, SELECTORS.mainContent);
      
      expect(mainContentMargin).toBe('280px');
    });
  });
  
  describe('Tablet Responsive Behavior', () => {
    let page: Page;
    
    beforeEach(async () => {
      page = await browser.newPage();
    });
    
    afterEach(async () => {
      await page.close();
    });
    
    test('should behave like mobile on tablet portrait (768px)', async () => {
      // TC-013: Sidebar maintains responsive behavior across desktop, tablet, and mobile viewports
      await page.setViewport(VIEWPORTS.TABLET_PORTRAIT);
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.toggleButton);
      
      // Should show toggle button (mobile behavior)
      const toggleVisible = await page.evaluate(() => {
        const toggleContainer = document.querySelector('.d-lg-none');
        if (!toggleContainer) return false;
        const computedStyle = window.getComputedStyle(toggleContainer);
        return computedStyle.display !== 'none';
      });
      
      expect(toggleVisible).toBe(true);
      
      // Sidebar should be collapsed by default
      const sidebarCollapsed = await page.evaluate((selector) => {
        const sidebar = document.querySelector(selector);
        return !sidebar?.classList.contains('show');
      }, SELECTORS.sidebar);
      
      expect(sidebarCollapsed).toBe(true);
    });
    
    test('should behave like desktop on tablet landscape (1024px)', async () => {
      await page.setViewport(VIEWPORTS.TABLET_LANDSCAPE);
      await page.goto(`${baseURL}/`);
      await page.waitForSelector(SELECTORS.sidebar);
      
      // Should hide toggle button (desktop behavior)
      const toggleHidden = await page.evaluate(() => {
        const toggleContainer = document.querySelector('.d-lg-none');
        if (!toggleContainer) return true;
        const computedStyle = window.getComputedStyle(toggleContainer);
        return computedStyle.display === 'none';
      });
      
      expect(toggleHidden).toBe(true);
      
      // Main content should have left margin
      const mainContentMargin = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const computedStyle = window.getComputedStyle(element);
        return computedStyle.marginLeft;
      }, SELECTORS.mainContent);
      
      expect(mainContentMargin).toBe('280px');
    });
  });
  
  describe('Cross-Viewport Consistency', () => {
    let page: Page;
    
    beforeEach(async () => {
      page = await browser.newPage();
    });
    
    afterEach(async () => {
      await page.close();
    });
    
    test('should maintain navigation functionality across all viewports', async () => {
      // TC-013: Sidebar maintains responsive behavior across desktop, tablet, and mobile viewports
      const viewportsToTest = [VIEWPORTS.MOBILE, VIEWPORTS.TABLET_PORTRAIT, VIEWPORTS.DESKTOP];
      
      for (const viewport of viewportsToTest) {
        await page.setViewport(viewport);
        await page.goto(`${baseURL}/authenticated`);
        await page.waitForSelector(SELECTORS.sidebar);
        
        // Check navigation links are present
        const homeLink = await page.$('a[href="/"]');
        const dashboardLink = await page.$('a[href="/dashboard"]');
        
        expect(homeLink).toBeTruthy();
        expect(dashboardLink).toBeTruthy();
        
        // Test navigation functionality
        await page.click('a[href="/"]');
        await page.waitForSelector('h1');
        
        const pageContent = await page.evaluate(() => {
          const h1 = document.querySelector('h1');
          return h1?.textContent || '';
        });
        
        expect(pageContent).toContain('Home');
      }
    });
    
    test('should handle rapid viewport changes without breaking', async () => {
      await page.goto(`${baseURL}/`);
      
      const viewports = [VIEWPORTS.MOBILE, VIEWPORTS.DESKTOP, VIEWPORTS.TABLET_PORTRAIT, VIEWPORTS.DESKTOP_LARGE];
      
      for (let i = 0; i < viewports.length; i++) {
        await page.setViewport(viewports[i]);
        await page.waitForTimeout(200); // Brief pause for transitions
        
        // Verify sidebar structure remains intact
        const sidebar = await page.$(SELECTORS.sidebar);
        expect(sidebar).toBeTruthy();
        
        const sidebarClasses = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          return element?.className || '';
        }, SELECTORS.sidebar);
        
        expect(sidebarClasses).toContain('offcanvas-lg');
        expect(sidebarClasses).toContain('offcanvas-start');
      }
    });
  });
  
  describe('Accessibility and User Experience', () => {
    let page: Page;
    
    beforeEach(async () => {
      page = await browser.newPage();
    });
    
    afterEach(async () => {
      await page.close();
    });
    
    test('should maintain proper ARIA attributes across viewports', async () => {
      const viewports = [VIEWPORTS.MOBILE, VIEWPORTS.DESKTOP];
      
      for (const viewport of viewports) {
        await page.setViewport(viewport);
        await page.goto(`${baseURL}/`);
        await page.waitForSelector(SELECTORS.sidebar);
        
        // Check ARIA attributes
        const sidebarAria = await page.evaluate((selector) => {
          const sidebar = document.querySelector(selector);
          return {
            labelledby: sidebar?.getAttribute('aria-labelledby'),
            tabindex: sidebar?.getAttribute('tabindex')
          };
        }, SELECTORS.sidebar);
        
        expect(sidebarAria.labelledby).toBe('sidebarLabel');
        expect(sidebarAria.tabindex).toBe('-1');
      }
    });
    
    test('should handle keyboard navigation consistently', async () => {
      await page.setViewport(VIEWPORTS.DESKTOP);
      await page.goto(`${baseURL}/authenticated`);
      await page.waitForSelector(SELECTORS.sidebar);
      
      // Focus first navigation link
      await page.focus('a[href="/"]');
      
      // Use Tab to navigate through sidebar links
      await page.keyboard.press('Tab');
      
      const focusedElement = await page.evaluate(() => {
        const focused = document.activeElement;
        return focused?.getAttribute('href') || '';
      });
      
      expect(['/dashboard', '/auth/logout', '/']).toContain(focusedElement);
    });
  });
});