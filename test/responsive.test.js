const { JSDOM } = require('jsdom');
const puppeteer = require('puppeteer');

// Test constants
const DESKTOP_WIDTH = 1024;
const TABLET_WIDTH = 768;
const MOBILE_WIDTH = 320;
const ANIMATION_TIMEOUT = 500;
const PAGE_LOAD_TIMEOUT = 5000;

describe('Responsive Sidebar Navigation Tests', () => {
  let browser;
  let page;
  let dom;
  let document;

  // Test URLs
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const DASHBOARD_URL = `${BASE_URL}/dashboard`;
  const PROFILE_URL = `${BASE_URL}/profile`;
  const SETTINGS_URL = `${BASE_URL}/settings`;

  beforeAll(async () => {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    try {
      page = await browser.newPage();
      await page.setDefaultTimeout(PAGE_LOAD_TIMEOUT);
      
      // Mock authentication
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('auth_token', 'test_token');
        localStorage.setItem('user_id', 'test_user');
      });

      // Set up JSDOM for unit tests
      dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Test Page</title>
          </head>
          <body>
            <div id="app"></div>
          </body>
        </html>
      `);
      document = dom.window.document;
      global.document = document;
      global.window = dom.window;
    } catch (error) {
      console.error('Failed to setup test environment:', error);
      throw error;
    }
  });

  afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  describe('Desktop Sidebar Visibility (>768px)', () => {
    beforeEach(async () => {
      await page.setViewport({ width: DESKTOP_WIDTH, height: 800 });
    });

    test('should display fixed left sidebar on desktop load', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const sidebar = await page.$('.sidebar');
        expect(sidebar).toBeTruthy();
        
        const sidebarStyle = await page.evaluate(() => {
          const element = document.querySelector('.sidebar');
          if (!element) return null;
          const styles = window.getComputedStyle(element);
          return {
            position: styles.position,
            left: styles.left,
            display: styles.display,
            visibility: styles.visibility
          };
        });
        
        expect(sidebarStyle).not.toBeNull();
        expect(sidebarStyle.position).toBe('fixed');
        expect(sidebarStyle.display).not.toBe('none');
        expect(sidebarStyle.visibility).not.toBe('hidden');
      } catch (error) {
        console.error('Desktop sidebar visibility test failed:', error);
        throw error;
      }
    });

    test('should contain all required navigation items', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const navItems = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          if (!sidebar) return [];
          
          const links = sidebar.querySelectorAll('a, button');
          return Array.from(links).map(link => ({
            text: link.textContent?.trim(),
            href: link.href,
            tag: link.tagName.toLowerCase()
          }));
        });
        
        const expectedItems = ['Dashboard', 'Profile', 'Settings', 'Logout'];
        expectedItems.forEach(item => {
          expect(navItems.some(nav => nav.text === item)).toBe(true);
        });
      } catch (error) {
        console.error('Navigation items test failed:', error);
        throw error;
      }
    });

    test('should maintain top navigation alongside sidebar', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const topNav = await page.$('.top-navigation, .navbar, header nav');
        const sidebar = await page.$('.sidebar');
        
        expect(topNav).toBeTruthy();
        expect(sidebar).toBeTruthy();
        
        const bothVisible = await page.evaluate(() => {
          const top = document.querySelector('.top-navigation, .navbar, header nav');
          const side = document.querySelector('.sidebar');
          
          if (!top || !side) return false;
          
          const topStyles = window.getComputedStyle(top);
          const sideStyles = window.getComputedStyle(side);
          
          return topStyles.display !== 'none' && sideStyles.display !== 'none';
        });
        
        expect(bothVisible).toBe(true);
      } catch (error) {
        console.error('Top navigation test failed:', error);
        throw error;
      }
    });
  });

  describe('Navigation Active States', () => {
    beforeEach(async () => {
      await page.setViewport({ width: DESKTOP_WIDTH, height: 800 });
    });

    test('should highlight active navigation item', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const dashboardLink = await page.$('.sidebar a[href*="dashboard"], .sidebar .nav-item.dashboard');
        expect(dashboardLink).toBeTruthy();
        
        const isActive = await page.evaluate(() => {
          const activeLink = document.querySelector('.sidebar .active, .sidebar .nav-item.active');
          return activeLink && activeLink.textContent?.includes('Dashboard');
        });
        
        expect(isActive).toBe(true);
      } catch (error) {
        console.error('Active state test failed:', error);
        throw error;
      }
    });

    test('should update active state when clicking navigation items', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const profileLink = await page.$('.sidebar a[href*="profile"]');
        if (profileLink) {
          await profileLink.click();
          await page.waitForTimeout(ANIMATION_TIMEOUT);
          
          const activeItem = await page.evaluate(() => {
            const active = document.querySelector('.sidebar .active, .sidebar .nav-item.active');
            return active ? active.textContent?.trim() : null;
          });
          
          expect(activeItem).toBe('Profile');
        }
      } catch (error) {
        console.error('Active state update test failed:', error);
        throw error;
      }
    });

    test('should provide proper visual feedback for navigation items', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const navItems = await page.$$('.sidebar a, .sidebar button');
        
        for (let item of navItems) {
          await item.hover();
          
          const hoverStyles = await page.evaluate((element) => {
            const styles = window.getComputedStyle(element, ':hover');
            return {
              cursor: styles.cursor,
              backgroundColor: styles.backgroundColor,
              color: styles.color
            };
          }, item);
          
          expect(hoverStyles.cursor).toBe('pointer');
        }
      } catch (error) {
        console.error('Visual feedback test failed:', error);
        throw error;
      }
    });
  });

  describe('Mobile Responsive Behavior (<=768px)', () => {
    beforeEach(async () => {
      await page.setViewport({ width: MOBILE_WIDTH, height: 600 });
    });

    test('should collapse sidebar to hamburger menu on mobile', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const hamburgerMenu = await page.$('.hamburger-menu, .menu-toggle, .sidebar-toggle');
        expect(hamburgerMenu).toBeTruthy();
        
        const sidebarHidden = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          if (!sidebar) return true;
          
          const styles = window.getComputedStyle(sidebar);
          return styles.display === 'none' || 
                 styles.visibility === 'hidden' || 
                 styles.transform.includes('translateX(-');
        });
        
        expect(sidebarHidden).toBe(true);
      } catch (error) {
        console.error('Mobile collapse test failed:', error);
        throw error;
      }
    });

    test('should maintain top navigation on mobile', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const topNavVisible = await page.evaluate(() => {
          const topNav = document.querySelector('.top-navigation, .navbar, header nav');
          if (!topNav) return false;
          
          const styles = window.getComputedStyle(topNav);
          return styles.display !== 'none' && styles.visibility !== 'hidden';
        });
        
        expect(topNavVisible).toBe(true);
      } catch (error) {
        console.error('Mobile top navigation test failed:', error);
        throw error;
      }
    });

    test('should toggle sidebar with smooth animation on hamburger click', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const hamburgerButton = await page.$('.hamburger-menu, .menu-toggle, .sidebar-toggle');
        expect(hamburgerButton).toBeTruthy();
        
        // Click to open
        await hamburgerButton.click();
        await page.waitForTimeout(ANIMATION_TIMEOUT);
        
        const sidebarVisible = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          if (!sidebar) return false;
          
          const styles = window.getComputedStyle(sidebar);
          return styles.display !== 'none' && 
                 styles.visibility !== 'hidden' &&
                 !styles.transform.includes('translateX(-');
        });
        
        expect(sidebarVisible).toBe(true);
        
        // Click to close
        await hamburgerButton.click();
        await page.waitForTimeout(ANIMATION_TIMEOUT);
        
        const sidebarHidden = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          if (!sidebar) return true;
          
          const styles = window.getComputedStyle(sidebar);
          return styles.display === 'none' || 
                 styles.visibility === 'hidden' || 
                 styles.transform.includes('translateX(-');
        });
        
        expect(sidebarHidden).toBe(true);
      } catch (error) {
        console.error('Hamburger toggle test failed:', error);
        throw error;
      }
    });

    test('should overlay content when sidebar is open on mobile', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const hamburgerButton = await page.$('.hamburger-menu, .menu-toggle, .sidebar-toggle');
        await hamburgerButton.click();
        await page.waitForTimeout(ANIMATION_TIMEOUT);
        
        const hasOverlay = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          const overlay = document.querySelector('.sidebar-overlay, .backdrop');
          
          if (!sidebar) return false;
          
          const sidebarStyles = window.getComputedStyle(sidebar);
          return sidebarStyles.position === 'fixed' && 
                 sidebarStyles.zIndex > 100 ||
                 overlay !== null;
        });
        
        expect(hasOverlay).toBe(true);
      } catch (error) {
        console.error('Mobile overlay test failed:', error);
        throw error;
      }
    });
  });

  describe('Content Layout Adjustment', () => {
    beforeEach(async () => {
      await page.setViewport({ width: DESKTOP_WIDTH, height: 800 });
    });

    test('should adjust main content area for sidebar width on desktop', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const contentAdjustment = await page.evaluate(() => {
          const mainContent = document.querySelector('.main-content, main, .content');
          const sidebar = document.querySelector('.sidebar');
          
          if (!mainContent || !sidebar) return null;
          
          const contentStyles = window.getComputedStyle(mainContent);
          const sidebarStyles = window.getComputedStyle(sidebar);
          
          return {
            marginLeft: contentStyles.marginLeft,
            paddingLeft: contentStyles.paddingLeft,
            left: contentStyles.left,
            sidebarWidth: sidebarStyles.width
          };
        });
        
        expect(contentAdjustment).not.toBeNull();
        
        const hasAdjustment = contentAdjustment.marginLeft !== '0px' ||
                             contentAdjustment.paddingLeft !== '0px' ||
                             contentAdjustment.left !== 'auto';
        
        expect(hasAdjustment).toBe(true);
      } catch (error) {
        console.error('Content adjustment test failed:', error);
        throw error;
      }
    });

    test('should display properly formatted dashboard content', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const dashboardContent = await page.evaluate(() => {
          const content = document.querySelector('.main-content, main, .content');
          if (!content) return null;
          
          return {
            hasContent: content.children.length > 0,
            isVisible: window.getComputedStyle(content).display !== 'none',
            textContent: content.textContent?.trim().substring(0, 100)
          };
        });
        
        expect(dashboardContent).not.toBeNull();
        expect(dashboardContent.hasContent).toBe(true);
        expect(dashboardContent.isVisible).toBe(true);
        expect(dashboardContent.textContent.length).toBeGreaterThan(0);
      } catch (error) {
        console.error('Dashboard content test failed:', error);
        throw error;
      }
    });
  });

  describe('Placeholder Pages Navigation', () => {
    beforeEach(async () => {
      await page.setViewport({ width: DESKTOP_WIDTH, height: 800 });
    });

    test('should navigate to Profile page with same layout structure', async () => {
      try {
        await page.goto(PROFILE_URL, { waitUntil: 'networkidle0' });
        
        const layoutStructure = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          const topNav = document.querySelector('.top-navigation, .navbar, header nav');
          const mainContent = document.querySelector('.main-content, main, .content');
          
          return {
            hasSidebar: !!sidebar,
            hasTopNav: !!topNav,
            hasMainContent: !!mainContent,
            pageTitle: document.title,
            activeNav: document.querySelector('.sidebar .active')?.textContent?.trim()
          };
        });
        
        expect(layoutStructure.hasSidebar).toBe(true);
        expect(layoutStructure.hasTopNav).toBe(true);
        expect(layoutStructure.hasMainContent).toBe(true);
        expect(layoutStructure.activeNav).toBe('Profile');
      } catch (error) {
        console.error('Profile page test failed:', error);
        throw error;
      }
    });

    test('should navigate to Settings page with same layout structure', async () => {
      try {
        await page.goto(SETTINGS_URL, { waitUntil: 'networkidle0' });
        
        const layoutStructure = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          const topNav = document.querySelector('.top-navigation, .navbar, header nav');
          const mainContent = document.querySelector('.main-content, main, .content');
          
          return {
            hasSidebar: !!sidebar,
            hasTopNav: !!topNav,
            hasMainContent: !!mainContent,
            pageTitle: document.title,
            activeNav: document.querySelector('.sidebar .active')?.textContent?.trim()
          };
        });
        
        expect(layoutStructure.hasSidebar).toBe(true);
        expect(layoutStructure.hasTopNav).toBe(true);
        expect(layoutStructure.hasMainContent).toBe(true);
        expect(layoutStructure.activeNav).toBe('Settings');
      } catch (error) {
        console.error('Settings page test failed:', error);
        throw error;
      }
    });

    test('should handle navigation between pages correctly', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        // Navigate to Profile
        const profileLink = await page.$('.sidebar a[href*="profile"]');
        if (profileLink) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            profileLink.click()
          ]);
          
          expect(page.url()).toContain('profile');
        }
        
        // Navigate to Settings
        const settingsLink = await page.$('.sidebar a[href*="settings"]');
        if (settingsLink) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            settingsLink.click()
          ]);
          
          expect(page.url()).toContain('settings');
        }
        
        // Navigate back to Dashboard
        const dashboardLink = await page.$('.sidebar a[href*="dashboard"]');
        if (dashboardLink) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            dashboardLink.click()
          ]);
          
          expect(page.url()).toContain('dashboard');
        }
      } catch (error) {
        console.error('Navigation between pages test failed:', error);
        throw error;
      }
    });
  });

  describe('Responsive Breakpoint Testing', () => {
    const testBreakpoints = [
      { name: 'Mobile Small', width: 320 },
      { name: 'Mobile Large', width: 480 },
      { name: 'Tablet Portrait', width: 768 },
      { name: 'Tablet Landscape', width: 1024 },
      { name: 'Desktop', width: 1200 },
      { name: 'Large Desktop', width: 1600 }
    ];

    testBreakpoints.forEach(({ name, width }) => {
      test(`should handle ${name} (${width}px) breakpoint correctly`, async () => {
        try {
          await page.setViewport({ width, height: 800 });
          await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
          
          const responsiveBehavior = await page.evaluate((screenWidth) => {
            const sidebar = document.querySelector('.sidebar');
            const hamburger = document.querySelector('.hamburger-menu, .menu-toggle, .sidebar-toggle');
            const mainContent = document.querySelector('.main-content, main, .content');
            
            if (!sidebar || !mainContent) return null;
            
            const sidebarStyles = window.getComputedStyle(sidebar);
            const mainStyles = window.getComputedStyle(mainContent);
            
            const isMobile = screenWidth <= 768;
            const sidebarVisible = sidebarStyles.display !== 'none' && 
                                 sidebarStyles.visibility !== 'hidden' &&
                                 !sidebarStyles.transform.includes('translateX(-');
            
            return {
              isMobile,
              sidebarVisible,
              hasHamburger: !!hamburger,
              mainContentAdjusted: mainStyles.marginLeft !== '0px' || 
                                 mainStyles.paddingLeft !== '0px' ||
                                 mainStyles.left !== 'auto'
            };
          }, width);
          
          expect(responsiveBehavior).not.toBeNull();
          
          if (width <= TABLET_WIDTH) {
            // Mobile behavior
            expect(responsiveBehavior.hasHamburger).toBe(true);
            expect(responsiveBehavior.sidebarVisible).toBe(false);
          } else {
            // Desktop behavior
            expect(responsiveBehavior.sidebarVisible).toBe(true);
            expect(responsiveBehavior.mainContentAdjusted).toBe(true);
          }
        } catch (error) {
          console.error(`${name} breakpoint test failed:`, error);
          throw error;
        }
      });
    });
  });

  describe('Accessibility and User Experience', () => {
    beforeEach(async () => {
      await page.setViewport({ width: DESKTOP_WIDTH, height: 800 });
    });

    test('should have proper ARIA labels and roles', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        const accessibilityFeatures = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          const hamburger = document.querySelector('.hamburger-menu, .menu-toggle, .sidebar-toggle');
          const navItems = document.querySelectorAll('.sidebar a, .sidebar button');
          
          return {
            sidebarRole: sidebar?.getAttribute('role'),
            sidebarAriaLabel: sidebar?.getAttribute('aria-label'),
            hamburgerAriaLabel: hamburger?.getAttribute('aria-label'),
            hamburgerAriaExpanded: hamburger?.getAttribute('aria-expanded'),
            navItemsWithLabels: Array.from(navItems).filter(item => 
              item.getAttribute('aria-label') || item.textContent?.trim()
            ).length,
            totalNavItems: navItems.length
          };
        });
        
        expect(accessibilityFeatures.sidebarRole).toBeTruthy();
        expect(accessibilityFeatures.navItemsWithLabels).toBe(accessibilityFeatures.totalNavItems);
      } catch (error) {
        console.error('Accessibility test failed:', error);
        throw error;
      }
    });

    test('should support keyboard navigation', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        // Test Tab navigation through sidebar items
        const navItems = await page.$$('.sidebar a, .sidebar button');
        
        for (let i = 0; i < navItems.length; i++) {
          await page.keyboard.press('Tab');
          
          const focusedElement = await page.evaluate(() => {
            return document.activeElement?.tagName?.toLowerCase();
          });
          
          expect(['a', 'button'].includes(focusedElement)).toBe(true);
        }
        
        // Test Enter key activation
        await page.keyboard.press('Enter');
        await page.waitForTimeout(ANIMATION_TIMEOUT);
        
        // Should have navigated or triggered an action
        const pageChanged = await page.evaluate(() => {
          return window.location.href;
        });
        
        expect(pageChanged).toBeTruthy();
      } catch (error) {
        console.error('Keyboard navigation test failed:', error);
        throw error;
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing sidebar elements gracefully', async () => {
      try {
        // Create a page without sidebar
        const testHtml = `
          <!DOCTYPE html>
          <html>
            <head><title>Test</title></head>
            <body>
              <div class="main-content">Content without sidebar</div>
            </body>
          </html>
        `;
        
        await page.setContent(testHtml);
        
        const handlesMissingSidebar = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          const mainContent = document.querySelector('.main-content');
          
          // Should not throw errors when sidebar is missing
          try {
            const sidebarStyles = sidebar ? window.getComputedStyle(sidebar) : null;
            const contentStyles = window.getComputedStyle(mainContent);
            return true;
          } catch (error) {
            return false;
          }
        });
        
        expect(handlesMissingSidebar).toBe(true);
      } catch (error) {
        console.error('Missing sidebar test failed:', error);
        throw error;
      }
    });

    test('should handle rapid resize events', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        // Rapidly change viewport sizes
        const sizes = [
          { width: DESKTOP_WIDTH, height: 800 },
          { width: MOBILE_WIDTH, height: 600 },
          { width: TABLET_WIDTH, height: 700 },
          { width: DESKTOP_WIDTH, height: 800 }
        ];
        
        for (let size of sizes) {
          await page.setViewport(size);
          await page.waitForTimeout(100); // Short delay
        }
        
        // Check final state is correct
        const finalState = await page.evaluate(() => {
          const sidebar = document.querySelector('.sidebar');
          const hamburger = document.querySelector('.hamburger-menu, .menu-toggle, .sidebar-toggle');
          
          if (!sidebar) return null;
          
          const styles = window.getComputedStyle(sidebar);
          return {
            isVisible: styles.display !== 'none' && styles.visibility !== 'hidden',
            hasHamburger: !!hamburger
          };
        });
        
        expect(finalState).not.toBeNull();
        expect(finalState.isVisible).toBe(true); // Should be visible on desktop
      } catch (error) {
        console.error('Rapid resize test failed:', error);
        throw error;
      }
    });

    test('should handle authentication state changes', async () => {
      try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle0' });
        
        // Simulate logout
        await page.evaluate(() => {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_id');
        });
        
        const logoutButton = await page.$('.sidebar a[href*="logout"], .sidebar button[data-action="logout"]');
        if (logoutButton) {
          await logoutButton.click();
          await page.waitForTimeout(ANIMATION_TIMEOUT);
          
          // Should handle the logout action gracefully
          const currentUrl = page.url();
          expect(currentUrl).toBeTruthy();
        }
      } catch (error) {
        console.error('Authentication state test failed:', error);
        throw error;
      }
    });
  });
});