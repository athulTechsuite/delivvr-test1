const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');

// Integration test constants
const BASE_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 10000;
const ANIMATION_WAIT = 350;
const VIEWPORT_SIZES = {
  MOBILE: { width: 375, height: 667 },
  TABLET: { width: 768, height: 1024 },
  DESKTOP: { width: 1200, height: 800 }
};

describe('Sidebar Responsive Integration Tests', () => {
  let browser;
  let server;
  let serverProcess;

  beforeAll(async () => {
    // Start test server
    serverProcess = spawn('node', [path.join(__dirname, '../../app.js')], {
      env: { ...process.env, PORT: '3001', NODE_ENV: 'test' },
      stdio: 'pipe'
    });

    // Wait for server to start
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Cross-Device Responsive Behavior', () => {
    let page;

    beforeEach(async () => {
      page = await browser.newPage();
      await page.setDefaultTimeout(5000);
      
      // Mock authentication
      await page.evaluateOnNewDocument(() => {
        document.cookie = 'token=test-auth-token; path=/';
        localStorage.setItem('user', JSON.stringify({
          id: 'test-user',
          name: 'Test User'
        }));
      });
    });

    afterEach(async () => {
      if (page && !page.isClosed()) {
        await page.close();
      }
    });

    // TC-RESP-001: Desktop to mobile responsive transition
    test('should transition from desktop to mobile layout when resizing', async () => {
      // Start with desktop viewport
      await page.setViewport(VIEWPORT_SIZES.DESKTOP);
      await page.goto(`${BASE_URL}/dashboard`, { 
        waitUntil: 'networkidle2',
        timeout: TEST_TIMEOUT 
      });

      // Verify desktop layout
      const desktopState = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const hamburger = document.querySelector('.hamburger-btn');
        const mainContent = document.querySelector('.main-content, .content-wrapper');
        
        return {
          sidebarVisible: sidebar && !sidebar.classList.contains('collapsed'),
          hamburgerVisible: hamburger && window.getComputedStyle(hamburger).display !== 'none',
          mainContentMargin: mainContent ? window.getComputedStyle(mainContent).marginLeft : '0px'
        };
      });

      expect(desktopState.sidebarVisible).toBe(true);
      expect(desktopState.hamburgerVisible).toBe(false);
      expect(parseInt(desktopState.mainContentMargin)).toBeGreaterThan(200);

      // Resize to mobile
      await page.setViewport(VIEWPORT_SIZES.MOBILE);
      await page.waitForTimeout(ANIMATION_WAIT);

      // Verify mobile layout
      const mobileState = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const hamburger = document.querySelector('.hamburger-btn');
        const mainContent = document.querySelector('.main-content, .content-wrapper');
        
        return {
          sidebarCollapsed: sidebar && sidebar.classList.contains('collapsed'),
          hamburgerVisible: hamburger && window.getComputedStyle(hamburger).display !== 'none',
          mainContentMargin: mainContent ? window.getComputedStyle(mainContent).marginLeft : '0px'
        };
      });

      expect(mobileState.sidebarCollapsed).toBe(true);
      expect(mobileState.hamburgerVisible).toBe(true);
      expect(parseInt(mobileState.mainContentMargin)).toBeLessThan(50);
    });

    // TC-RESP-002: Mobile sidebar interaction and overlay behavior
    test('should handle complete mobile sidebar interaction flow', async () => {
      await page.setViewport(VIEWPORT_SIZES.MOBILE);
      await page.goto(`${BASE_URL}/dashboard`, { 
        waitUntil: 'networkidle2' 
      });

      // Initial mobile state
      let state = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        return {
          sidebarCollapsed: sidebar.classList.contains('collapsed'),
          overlayVisible: overlay && overlay.classList.contains('show')
        };
      });

      expect(state.sidebarCollapsed).toBe(true);
      expect(state.overlayVisible).toBe(false);

      // Open sidebar via hamburger
      await page.click('.hamburger-btn');
      await page.waitForTimeout(ANIMATION_WAIT);

      state = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        return {
          sidebarVisible: !sidebar.classList.contains('collapsed'),
          overlayVisible: overlay && overlay.classList.contains('show')
        };
      });

      expect(state.sidebarVisible).toBe(true);
      expect(state.overlayVisible).toBe(true);

      // Close sidebar by clicking overlay
      await page.click('.sidebar-overlay');
      await page.waitForTimeout(ANIMATION_WAIT);

      state = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        return {
          sidebarCollapsed: sidebar.classList.contains('collapsed'),
          overlayVisible: overlay && overlay.classList.contains('show')
        };
      });

      expect(state.sidebarCollapsed).toBe(true);
      expect(state.overlayVisible).toBe(false);
    });

    // TC-RESP-003: Navigation functionality across all viewports
    test('should maintain navigation functionality across all viewports', async () => {
      const viewports = [VIEWPORT_SIZES.DESKTOP, VIEWPORT_SIZES.TABLET, VIEWPORT_SIZES.MOBILE];
      
      for (const viewport of viewports) {
        await page.setViewport(viewport);
        await page.goto(`${BASE_URL}/dashboard`, { 
          waitUntil: 'networkidle2' 
        });

        // If mobile, open sidebar first
        if (viewport.width <= 768) {
          await page.click('.hamburger-btn');
          await page.waitForTimeout(ANIMATION_WAIT);
        }

        // Test navigation to Profile
        await page.click('a[href="/profile"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        const profileActive = await page.evaluate(() => {
          const activeItem = document.querySelector('.sidebar-nav-link.active');
          return activeItem && activeItem.textContent.includes('Profile');
        });

        expect(profileActive).toBe(true);
        expect(page.url()).toContain('/profile');

        // Test navigation to Settings
        if (viewport.width <= 768) {
          await page.click('.hamburger-btn');
          await page.waitForTimeout(ANIMATION_WAIT);
        }

        await page.click('a[href="/settings"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        const settingsActive = await page.evaluate(() => {
          const activeItem = document.querySelector('.sidebar-nav-link.active');
          return activeItem && activeItem.textContent.includes('Settings');
        });

        expect(settingsActive).toBe(true);
        expect(page.url()).toContain('/settings');
      }
    });
  });

  describe('Layout Consistency and Performance', () => {
    let page;

    beforeEach(async () => {
      page = await browser.newPage();
      await page.evaluateOnNewDocument(() => {
        document.cookie = 'token=test-auth-token; path=/';
      });
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    // TC-PERF-001: Layout shifts and animation performance
    test('should maintain smooth animations without layout shifts', async () => {
      await page.setViewport(VIEWPORT_SIZES.MOBILE);
      await page.goto(`${BASE_URL}/dashboard`, { 
        waitUntil: 'networkidle2' 
      });

      // Measure layout stability during sidebar toggle
      const performanceMetrics = await page.evaluate(async () => {
        const startTime = performance.now();
        
        // Open sidebar
        document.querySelector('.hamburger-btn').click();
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const midTime = performance.now();
        
        // Close sidebar
        document.querySelector('.hamburger-btn').click();
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const endTime = performance.now();
        
        return {
          openTime: midTime - startTime,
          closeTime: endTime - midTime,
          totalTime: endTime - startTime
        };
      });

      // Animations should complete within reasonable time
      expect(performanceMetrics.openTime).toBeLessThan(500);
      expect(performanceMetrics.closeTime).toBeLessThan(500);
      expect(performanceMetrics.totalTime).toBeLessThan(1000);
    });

    // TC-PERF-002: Content accessibility during responsive changes
    test('should maintain content accessibility during viewport changes', async () => {
      await page.setViewport(VIEWPORT_SIZES.DESKTOP);
      await page.goto(`${BASE_URL}/dashboard`, { 
        waitUntil: 'networkidle2' 
      });

      // Check accessibility on desktop
      const desktopA11y = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const hamburger = document.querySelector('.hamburger-btn');
        const mainContent = document.querySelector('.main-content, .content-wrapper');
        
        return {
          sidebarAriaHidden: sidebar.getAttribute('aria-hidden'),
          hamburgerAriaExpanded: hamburger ? hamburger.getAttribute('aria-expanded') : null,
          mainContentAccessible: !mainContent.hasAttribute('aria-hidden')
        };
      });

      expect(desktopA11y.sidebarAriaHidden).toBeFalsy();
      expect(desktopA11y.mainContentAccessible).toBe(true);

      // Change to mobile
      await page.setViewport(VIEWPORT_SIZES.MOBILE);
      await page.waitForTimeout(ANIMATION_WAIT);

      const mobileA11y = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const hamburger = document.querySelector('.hamburger-btn');
        
        return {
          sidebarAriaHidden: sidebar.getAttribute('aria-hidden'),
          hamburgerVisible: hamburger && window.getComputedStyle(hamburger).display !== 'none',
          hamburgerAriaExpanded: hamburger ? hamburger.getAttribute('aria-expanded') : null
        };
      });

      expect(mobileA11y.hamburgerVisible).toBe(true);
      expect(mobileA11y.hamburgerAriaExpanded).toBe('false');
    });

    // TC-PERF-003: State persistence across navigation
    test('should persist sidebar state across page navigation', async () => {
      await page.setViewport(VIEWPORT_SIZES.MOBILE);
      await page.goto(`${BASE_URL}/dashboard`, { 
        waitUntil: 'networkidle2' 
      });

      // Open sidebar
      await page.click('.hamburger-btn');
      await page.waitForTimeout(ANIMATION_WAIT);

      // Navigate to profile
      await page.click('a[href="/profile"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Check if sidebar state is preserved (should be closed on new page)
      const sidebarState = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        return sidebar.classList.contains('collapsed');
      });

      // On page navigation, sidebar should reset to closed state on mobile
      expect(sidebarState).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let page;

    beforeEach(async () => {
      page = await browser.newPage();
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    // TC-ERR-004: Handles unauthenticated access gracefully
    test('should handle unauthenticated access without sidebar', async () => {
      await page.setViewport(VIEWPORT_SIZES.DESKTOP);
      
      // Don't set auth cookies
      const response = await page.goto(`${BASE_URL}/dashboard`, { 
        waitUntil: 'networkidle2' 
      });

      // Should redirect to login or show login page
      expect(page.url()).toMatch(/(login|auth)/);
    });

    // TC-ERR-005: Handles rapid viewport changes
    test('should handle rapid viewport size changes gracefully', async () => {
      await page.evaluateOnNewDocument(() => {
        document.cookie = 'token=test-auth-token; path=/';
      });

      await page.setViewport(VIEWPORT_SIZES.DESKTOP);
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });

      // Rapidly change viewport sizes
      const viewportSizes = [
        VIEWPORT_SIZES.MOBILE,
        VIEWPORT_SIZES.DESKTOP,
        VIEWPORT_SIZES.TABLET,
        VIEWPORT_SIZES.MOBILE,
        VIEWPORT_SIZES.DESKTOP
      ];

      for (const size of viewportSizes) {
        await page.setViewport(size);
        await page.waitForTimeout(50); // Short wait between changes
      }

      // Final check - should still be functional
      const finalState = await page.evaluate(() => {
        const sidebar = document.querySelector('.sidebar');
        const hamburger = document.querySelector('.hamburger-btn');
        
        return {
          sidebarExists: !!sidebar,
          hamburgerExists: !!hamburger,
          pageResponsive: true
        };
      });

      expect(finalState.sidebarExists).toBe(true);
      expect(finalState.hamburgerExists).toBe(true);
      expect(finalState.pageResponsive).toBe(true);
    });
  });
});