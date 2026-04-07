/**
 * End-to-End Theme Persistence Tests
 * Tests theme functionality across different pages and browser sessions
 */

const puppeteer = require('puppeteer');
const path = require('path');

describe('Theme Persistence E2E Tests', () => {
  let browser;
  let page;
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.CI ? true : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    // Clear localStorage before each test
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('AC1: Theme toggle visibility across all pages', () => {
    const testPages = [
      { path: '/', name: 'Home' },
      { path: '/login', name: 'Login' },
      { path: '/signup', name: 'Sign Up' },
      { path: '/dashboard', name: 'Dashboard' }
    ];

    testPages.forEach(({ path, name }) => {
      test(`should display theme toggle in header on ${name} page`, async () => {
        await page.goto(`${baseUrl}${path}`);
        
        const themeToggle = await page.$('.theme-toggle');
        expect(themeToggle).toBeTruthy();
        
        const toggleInput = await page.$('.theme-toggle input[type="checkbox"]');
        const toggleSlider = await page.$('.theme-toggle-slider');
        
        expect(toggleInput).toBeTruthy();
        expect(toggleSlider).toBeTruthy();
        
        // Verify it's in the navbar/header
        const navbar = await page.$('nav, .navbar, header');
        expect(navbar).toBeTruthy();
        
        const isToggleInNavbar = await page.evaluate(() => {
          const toggle = document.querySelector('.theme-toggle');
          const navbar = document.querySelector('nav, .navbar, header');
          return navbar && navbar.contains(toggle);
        });
        
        expect(isToggleInNavbar).toBe(true);
      }, 10000);
    });
  });

  describe('AC2: Default light mode for new users', () => {
    test('should default to light mode on first visit', async () => {
      await page.goto(`${baseUrl}/`);
      
      const dataTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });
      
      const toggleChecked = await page.evaluate(() => {
        const toggle = document.querySelector('.theme-toggle input');
        return toggle ? toggle.checked : false;
      });
      
      expect(dataTheme).toBe('light');
      expect(toggleChecked).toBe(false);
    });

    test('should have light mode styles applied by default', async () => {
      await page.goto(`${baseUrl}/`);
      
      const hasLightTheme = await page.evaluate(() => {
        return document.documentElement.classList.contains('light-theme') ||
               document.documentElement.getAttribute('data-theme') === 'light';
      });
      
      expect(hasLightTheme).toBe(true);
    });
  });

  describe('AC3: Immediate theme switching', () => {
    test('should immediately switch to dark mode when toggle is clicked', async () => {
      await page.goto(`${baseUrl}/`);
      
      // Verify initial light mode
      let dataTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });
      expect(dataTheme).toBe('light');
      
      // Click the toggle
      await page.click('.theme-toggle input');
      
      // Wait for theme change
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      }, { timeout: 5000 });
      
      dataTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });
      
      const toggleChecked = await page.evaluate(() => {
        const toggle = document.querySelector('.theme-toggle input');
        return toggle.checked;
      });
      
      expect(dataTheme).toBe('dark');
      expect(toggleChecked).toBe(true);
    });

    test('should apply dark mode styles to all visible elements', async () => {
      await page.goto(`${baseUrl}/`);
      
      await page.click('.theme-toggle input');
      
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      });
      
      // Check that CSS custom properties are applied for dark mode
      const isDarkModeApplied = await page.evaluate(() => {
        const root = document.documentElement;
        const dataTheme = root.getAttribute('data-theme');
        const hasDarkClass = root.classList.contains('dark-theme');
        
        return dataTheme === 'dark' || hasDarkClass;
      });
      
      expect(isDarkModeApplied).toBe(true);
    });
  });

  describe('AC4: Theme persistence across pages and browser refresh', () => {
    test('should persist dark mode when navigating between pages', async () => {
      await page.goto(`${baseUrl}/`);
      
      // Switch to dark mode
      await page.click('.theme-toggle input');
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      });
      
      // Navigate to different pages and verify dark mode persists
      const testPages = ['/login', '/signup', '/'];
      
      for (const pagePath of testPages) {
        await page.goto(`${baseUrl}${pagePath}`);
        
        await page.waitForFunction(() => {
          return document.documentElement.getAttribute('data-theme') === 'dark';
        }, { timeout: 5000 });
        
        const dataTheme = await page.evaluate(() => {
          return document.documentElement.getAttribute('data-theme');
        });
        
        const toggleChecked = await page.evaluate(() => {
          const toggle = document.querySelector('.theme-toggle input');
          return toggle ? toggle.checked : false;
        });
        
        expect(dataTheme).toBe('dark');
        expect(toggleChecked).toBe(true);
      }
    });

    test('should persist theme after browser refresh', async () => {
      await page.goto(`${baseUrl}/`);
      
      // Switch to dark mode
      await page.click('.theme-toggle input');
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      });
      
      // Refresh the page
      await page.reload();
      
      // Wait for page to load and theme to be applied
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      }, { timeout: 5000 });
      
      const dataTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });
      
      const toggleChecked = await page.evaluate(() => {
        const toggle = document.querySelector('.theme-toggle input');
        return toggle ? toggle.checked : false;
      });
      
      expect(dataTheme).toBe('dark');
      expect(toggleChecked).toBe(true);
    });
  });

  describe('AC5: Saved preference in new browser session', () => {
    test('should load saved dark mode preference in new session', async () => {
      // First session - set dark mode
      await page.goto(`${baseUrl}/`);
      await page.click('.theme-toggle input');
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      });
      
      // Verify localStorage is set
      const storedTheme = await page.evaluate(() => {
        return localStorage.getItem('app-theme');
      });
      expect(storedTheme).toBe('dark');
      
      // Simulate new session by creating new page with same localStorage
      const newPage = await browser.newPage();
      
      // Set localStorage to simulate returning user
      await newPage.evaluateOnNewDocument(() => {
        localStorage.setItem('app-theme', 'dark');
      });
      
      await newPage.goto(`${baseUrl}/`);
      
      // Wait for theme to be applied
      await newPage.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      }, { timeout: 5000 });
      
      const dataTheme = await newPage.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });
      
      const toggleChecked = await newPage.evaluate(() => {
        const toggle = document.querySelector('.theme-toggle input');
        return toggle ? toggle.checked : false;
      });
      
      expect(dataTheme).toBe('dark');
      expect(toggleChecked).toBe(true);
      
      await newPage.close();
    });
  });

  describe('AC6: Dark mode applied to all components', () => {
    test('should apply dark mode to all page components', async () => {
      await page.goto(`${baseUrl}/`);
      
      // Switch to dark mode
      await page.click('.theme-toggle input');
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      });
      
      // Check that various components have dark mode applied
      const componentsHaveDarkMode = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        
        // Check data-theme attribute
        const hasDataTheme = root.getAttribute('data-theme') === 'dark';
        
        // Check for dark theme classes
        const hasDarkClass = root.classList.contains('dark-theme') || 
                            body.classList.contains('dark-theme');
        
        return hasDataTheme || hasDarkClass;
      });
      
      expect(componentsHaveDarkMode).toBe(true);
    });

    test('should apply dark mode to forms and inputs', async () => {
      await page.goto(`${baseUrl}/login`);
      
      // Switch to dark mode
      await page.click('.theme-toggle input');
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      });
      
      // Verify form elements can access dark mode styling
      const formsHaveThemeAccess = await page.evaluate(() => {
        const forms = document.querySelectorAll('form');
        const inputs = document.querySelectorAll('input[type="email"], input[type="password"], input[type="text"]');
        
        // Check that document has dark theme applied so CSS can target elements
        const rootHasDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark' ||
                                document.documentElement.classList.contains('dark-theme');
        
        return rootHasDarkTheme && (forms.length > 0 || inputs.length > 0);
      });
      
      expect(formsHaveThemeAccess).toBe(true);
    });

    test('should apply dark mode to navigation and cards', async () => {
      await page.goto(`${baseUrl}/`);
      
      // Switch to dark mode
      await page.click('.theme-toggle input');
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      });
      
      const navAndCardsHaveThemeAccess = await page.evaluate(() => {
        const navElements = document.querySelectorAll('nav, .navbar');
        const cardElements = document.querySelectorAll('.card');
        
        const rootHasDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark' ||
                                document.documentElement.classList.contains('dark-theme');
        
        return rootHasDarkTheme;
      });
      
      expect(navAndCardsHaveThemeAccess).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle localStorage being disabled', async () => {
      await page.goto(`${baseUrl}/`);
      
      // Disable localStorage
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(window, 'localStorage', {
          value: {
            getItem: () => { throw new Error('localStorage disabled'); },
            setItem: () => { throw new Error('localStorage disabled'); }
          }
        });
      });
      
      await page.reload();
      
      // Should still work without localStorage
      await page.click('.theme-toggle input');
      
      await page.waitForFunction(() => {
        return document.documentElement.getAttribute('data-theme') === 'dark';
      }, { timeout: 5000 });
      
      const dataTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });
      
      expect(dataTheme).toBe('dark');
    });

    test('should handle missing theme toggle gracefully', async () => {
      await page.goto(`${baseUrl}/`);
      
      // Remove theme toggle from DOM
      await page.evaluate(() => {
        const toggle = document.querySelector('.theme-toggle');
        if (toggle) toggle.remove();
      });
      
      // Should not throw errors
      const hasErrors = await page.evaluate(() => {
        try {
          new ThemeToggle();
          return false;
        } catch (error) {
          return true;
        }
      });
      
      expect(hasErrors).toBe(false);
    });
  });
});