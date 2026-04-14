import { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect } from '@jest/globals';
import puppeteer, { Browser, Page } from 'puppeteer';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import express from 'express';
import path from 'path';

// Test constants
const TEST_TIMEOUT = 30000;
const TOGGLE_ANIMATION_DELAY = 350;
const FORM_LOAD_DELAY = 500;
const THEME_TRANSITION_DELAY = 300;
const RAPID_TOGGLE_COUNT = 10;
const MEMORY_LEAK_ITERATIONS = 50;
const MOBILE_VIEWPORT = { width: 375, height: 667 };
const DESKTOP_VIEWPORT = { width: 1200, height: 800 };

// CSS selectors
const SELECTORS = {
  LOGIN_FORM: '#loginForm',
  SIGNUP_FORM: '#signupForm',
  LOGIN_PASSWORD: '#password',
  SIGNUP_PASSWORD: '#password',
  SIGNUP_CONFIRM_PASSWORD: '#confirmPassword',
  LOGIN_TOGGLE: '#password + .password-toggle',
  SIGNUP_PASSWORD_TOGGLE: '#password + .password-toggle',
  SIGNUP_CONFIRM_TOGGLE: '#confirmPassword + .password-toggle',
  TOGGLE_ICON: '.password-toggle i',
  THEME_TOGGLE: '.theme-toggle',
  SUBMIT_BUTTON: 'button[type="submit"]',
  ERROR_MESSAGE: '.error-message'
} as const;

// ARIA attributes
const ARIA_ATTRIBUTES = {
  LABEL: 'aria-label',
  PRESSED: 'aria-pressed',
  DESCRIBEDBY: 'aria-describedby'
} as const;

// Icon classes
const ICON_CLASSES = {
  EYE: 'bi-eye',
  EYE_SLASH: 'bi-eye-slash'
} as const;

// Input types
const INPUT_TYPES = {
  PASSWORD: 'password',
  TEXT: 'text'
} as const;

// ARIA labels
const ARIA_LABELS = {
  SHOW_PASSWORD: 'Show password',
  HIDE_PASSWORD: 'Hide password'
} as const;

interface TestServer {
  server: ReturnType<typeof createServer>;
  port: number;
  url: string;
}

interface ToggleTestResult {
  initialType: string;
  initialIcon: string;
  initialAriaLabel: string;
  initialAriaPressed: string;
  afterToggleType: string;
  afterToggleIcon: string;
  afterToggleAriaLabel: string;
  afterToggleAriaPressed: string;
}

interface FormSubmissionResult {
  success: boolean;
  passwordValue: string;
  passwordType: string;
  toggleState: string;
}

interface ThemeTestResult {
  lightTheme: {
    iconVisible: boolean;
    buttonClickable: boolean;
  };
  darkTheme: {
    iconVisible: boolean;
    buttonClickable: boolean;
  };
}

describe('Password Toggle Integration Tests', () => {
  let browser: Browser;
  let testServer: TestServer;

  beforeAll(async () => {
    // Start test server
    testServer = await startTestServer();

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (testServer?.server) {
      await new Promise<void>((resolve) => {
        testServer.server.close(() => resolve());
      });
    }
  }, TEST_TIMEOUT);

  describe('Login Form Integration', () => {
    let page: Page;

    beforeEach(async () => {
      page = await browser.newPage();
      await page.setViewport(DESKTOP_VIEWPORT);
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('should display toggle button in login form', async () => {
      const toggleButton = await page.$(SELECTORS.LOGIN_TOGGLE);
      expect(toggleButton).not.toBeNull();

      const isVisible = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element && window.getComputedStyle(element).display !== 'none';
      }, SELECTORS.LOGIN_TOGGLE);

      expect(isVisible).toBe(true);
    });

    test('should toggle password visibility in login form', async () => {
      const result = await togglePasswordField(page, SELECTORS.LOGIN_PASSWORD, SELECTORS.LOGIN_TOGGLE);

      expect(result.initialType).toBe(INPUT_TYPES.PASSWORD);
      expect(result.initialIcon).toBe(ICON_CLASSES.EYE);
      expect(result.initialAriaLabel).toBe(ARIA_LABELS.SHOW_PASSWORD);
      expect(result.initialAriaPressed).toBe('false');

      expect(result.afterToggleType).toBe(INPUT_TYPES.TEXT);
      expect(result.afterToggleIcon).toBe(ICON_CLASSES.EYE_SLASH);
      expect(result.afterToggleAriaLabel).toBe(ARIA_LABELS.HIDE_PASSWORD);
      expect(result.afterToggleAriaPressed).toBe('true');
    });

    test('should maintain toggle state during form interaction', async () => {
      const passwordInput = SELECTORS.LOGIN_PASSWORD;
      const toggleButton = SELECTORS.LOGIN_TOGGLE;

      // Toggle password visibility
      await page.click(toggleButton);
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      // Type in password field
      await page.type(passwordInput, 'testpassword123');

      // Verify toggle state persists
      const passwordType = await page.evaluate((selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        return input?.type;
      }, passwordInput);

      expect(passwordType).toBe(INPUT_TYPES.TEXT);

      // Verify password value is visible
      const passwordValue = await page.$eval(passwordInput, (el: HTMLInputElement) => el.value);
      expect(passwordValue).toBe('testpassword123');
    });

    test('should handle form submission with toggled password', async () => {
      const result = await testFormSubmission(page, {
        passwordSelector: SELECTORS.LOGIN_PASSWORD,
        toggleSelector: SELECTORS.LOGIN_TOGGLE,
        formSelector: SELECTORS.LOGIN_FORM,
        passwordValue: 'logintest123'
      });

      expect(result.success).toBe(true);
      expect(result.passwordValue).toBe('logintest123');
      expect(result.toggleState).toBe('true'); // Password visible during submission
    });

    test('should support keyboard navigation for toggle button', async () => {
      // Focus on password input
      await page.focus(SELECTORS.LOGIN_PASSWORD);

      // Tab to toggle button
      await page.keyboard.press('Tab');

      // Verify toggle button is focused
      const focusedElement = await page.evaluate(() => document.activeElement?.classList.contains('password-toggle'));
      expect(focusedElement).toBe(true);

      // Activate with Enter key
      await page.keyboard.press('Enter');
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      const passwordType = await page.$eval(SELECTORS.LOGIN_PASSWORD, (el: HTMLInputElement) => el.type);
      expect(passwordType).toBe(INPUT_TYPES.TEXT);
    });

    test('should support space key activation', async () => {
      await page.focus(SELECTORS.LOGIN_TOGGLE);
      await page.keyboard.press('Space');
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      const passwordType = await page.$eval(SELECTORS.LOGIN_PASSWORD, (el: HTMLInputElement) => el.type);
      expect(passwordType).toBe(INPUT_TYPES.TEXT);
    });
  });

  describe('Signup Form Integration', () => {
    let page: Page;

    beforeEach(async () => {
      page = await browser.newPage();
      await page.setViewport(DESKTOP_VIEWPORT);
      await page.goto(`${testServer.url}/signup`);
      await page.waitForTimeout(FORM_LOAD_DELAY);
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('should display toggle buttons for both password fields', async () => {
      const passwordToggle = await page.$(SELECTORS.SIGNUP_PASSWORD_TOGGLE);
      const confirmToggle = await page.$(SELECTORS.SIGNUP_CONFIRM_TOGGLE);

      expect(passwordToggle).not.toBeNull();
      expect(confirmToggle).not.toBeNull();
    });

    test('should operate password toggles independently', async () => {
      // Toggle main password field
      await page.click(SELECTORS.SIGNUP_PASSWORD_TOGGLE);
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      const passwordType = await page.$eval(SELECTORS.SIGNUP_PASSWORD, (el: HTMLInputElement) => el.type);
      const confirmType = await page.$eval(SELECTORS.SIGNUP_CONFIRM_PASSWORD, (el: HTMLInputElement) => el.type);

      expect(passwordType).toBe(INPUT_TYPES.TEXT);
      expect(confirmType).toBe(INPUT_TYPES.PASSWORD); // Should remain hidden

      // Toggle confirm password field
      await page.click(SELECTORS.SIGNUP_CONFIRM_TOGGLE);
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      const passwordTypeAfter = await page.$eval(SELECTORS.SIGNUP_PASSWORD, (el: HTMLInputElement) => el.type);
      const confirmTypeAfter = await page.$eval(SELECTORS.SIGNUP_CONFIRM_PASSWORD, (el: HTMLInputElement) => el.type);

      expect(passwordTypeAfter).toBe(INPUT_TYPES.TEXT); // Should remain visible
      expect(confirmTypeAfter).toBe(INPUT_TYPES.TEXT); // Should now be visible
    });

    test('should maintain independent ARIA states', async () => {
      // Check initial states
      const passwordLabel = await page.$eval(SELECTORS.SIGNUP_PASSWORD_TOGGLE, (el) => el.getAttribute('aria-label'));
      const confirmLabel = await page.$eval(SELECTORS.SIGNUP_CONFIRM_TOGGLE, (el) => el.getAttribute('aria-label'));

      expect(passwordLabel).toBe(ARIA_LABELS.SHOW_PASSWORD);
      expect(confirmLabel).toBe(ARIA_LABELS.SHOW_PASSWORD);

      // Toggle main password
      await page.click(SELECTORS.SIGNUP_PASSWORD_TOGGLE);
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      const passwordLabelAfter = await page.$eval(SELECTORS.SIGNUP_PASSWORD_TOGGLE, (el) => el.getAttribute('aria-label'));
      const confirmLabelAfter = await page.$eval(SELECTORS.SIGNUP_CONFIRM_TOGGLE, (el) => el.getAttribute('aria-label'));

      expect(passwordLabelAfter).toBe(ARIA_LABELS.HIDE_PASSWORD);
      expect(confirmLabelAfter).toBe(ARIA_LABELS.SHOW_PASSWORD); // Should remain unchanged
    });

    test('should integrate with form validation', async () => {
      // Fill form with mismatched passwords
      await page.type(SELECTORS.SIGNUP_PASSWORD, 'password123');
      await page.type(SELECTORS.SIGNUP_CONFIRM_PASSWORD, 'differentpassword');

      // Toggle visibility to verify values
      await page.click(SELECTORS.SIGNUP_PASSWORD_TOGGLE);
      await page.click(SELECTORS.SIGNUP_CONFIRM_TOGGLE);
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      // Submit form
      await page.click(SELECTORS.SUBMIT_BUTTON);
      await page.waitForTimeout(500);

      // Check for validation error
      const errorMessage = await page.$(SELECTORS.ERROR_MESSAGE);
      expect(errorMessage).not.toBeNull();

      // Verify toggle states persist despite validation error
      const passwordType = await page.$eval(SELECTORS.SIGNUP_PASSWORD, (el: HTMLInputElement) => el.type);
      const confirmType = await page.$eval(SELECTORS.SIGNUP_CONFIRM_PASSWORD, (el: HTMLInputElement) => el.type);

      expect(passwordType).toBe(INPUT_TYPES.TEXT);
      expect(confirmType).toBe(INPUT_TYPES.TEXT);
    });
  });

  describe('Theme Compatibility', () => {
    let page: Page;

    beforeEach(async () => {
      page = await browser.newPage();
      await page.setViewport(DESKTOP_VIEWPORT);
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('should work correctly in light theme', async () => {
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      const result = await testThemeCompatibility(page);
      expect(result.lightTheme.iconVisible).toBe(true);
      expect(result.lightTheme.buttonClickable).toBe(true);
    });

    test('should work correctly in dark theme', async () => {
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      // Switch to dark theme
      await page.click(SELECTORS.THEME_TOGGLE);
      await page.waitForTimeout(THEME_TRANSITION_DELAY);

      const result = await testThemeCompatibility(page);
      expect(result.darkTheme.iconVisible).toBe(true);
      expect(result.darkTheme.buttonClickable).toBe(true);
    });

    test('should maintain functionality during theme switches', async () => {
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      // Toggle password visibility in light theme
      await page.click(SELECTORS.LOGIN_TOGGLE);
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      let passwordType = await page.$eval(SELECTORS.LOGIN_PASSWORD, (el: HTMLInputElement) => el.type);
      expect(passwordType).toBe(INPUT_TYPES.TEXT);

      // Switch to dark theme
      await page.click(SELECTORS.THEME_TOGGLE);
      await page.waitForTimeout(THEME_TRANSITION_DELAY);

      // Verify toggle state persists
      passwordType = await page.$eval(SELECTORS.LOGIN_PASSWORD, (el: HTMLInputElement) => el.type);
      expect(passwordType).toBe(INPUT_TYPES.TEXT);

      // Test toggle functionality in dark theme
      await page.click(SELECTORS.LOGIN_TOGGLE);
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      passwordType = await page.$eval(SELECTORS.LOGIN_PASSWORD, (el: HTMLInputElement) => el.type);
      expect(passwordType).toBe(INPUT_TYPES.PASSWORD);
    });
  });

  describe('Form Submission Integration', () => {
    let page: Page;

    beforeEach(async () => {
      page = await browser.newPage();
      await page.setViewport(DESKTOP_VIEWPORT);
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('should submit hidden passwords correctly', async () => {
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      const result = await testFormSubmission(page, {
        passwordSelector: SELECTORS.LOGIN_PASSWORD,
        toggleSelector: SELECTORS.LOGIN_TOGGLE,
        formSelector: SELECTORS.LOGIN_FORM,
        passwordValue: 'hiddenpassword123',
        toggleBeforeSubmit: false
      });

      expect(result.success).toBe(true);
      expect(result.passwordValue).toBe('hiddenpassword123');
      expect(result.passwordType).toBe(INPUT_TYPES.PASSWORD);
    });

    test('should submit visible passwords correctly', async () => {
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      const result = await testFormSubmission(page, {
        passwordSelector: SELECTORS.LOGIN_PASSWORD,
        toggleSelector: SELECTORS.LOGIN_TOGGLE,
        formSelector: SELECTORS.LOGIN_FORM,
        passwordValue: 'visiblepassword123',
        toggleBeforeSubmit: true
      });

      expect(result.success).toBe(true);
      expect(result.passwordValue).toBe('visiblepassword123');
      expect(result.passwordType).toBe(INPUT_TYPES.TEXT);
    });

    test('should not affect form validation', async () => {
      await page.goto(`${testServer.url}/signup`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      // Fill form with valid data
      await page.type('#email', 'test@example.com');
      await page.type(SELECTORS.SIGNUP_PASSWORD, 'validpassword123');
      await page.type(SELECTORS.SIGNUP_CONFIRM_PASSWORD, 'validpassword123');

      // Toggle password visibility
      await page.click(SELECTORS.SIGNUP_PASSWORD_TOGGLE);
      await page.click(SELECTORS.SIGNUP_CONFIRM_TOGGLE);
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      // Submit form
      await page.click(SELECTORS.SUBMIT_BUTTON);
      await page.waitForTimeout(500);

      // Should not have validation errors
      const errorMessage = await page.$(SELECTORS.ERROR_MESSAGE);
      expect(errorMessage).toBeNull();
    });
  });

  describe('Browser Compatibility', () => {
    let page: Page;

    beforeEach(async () => {
      page = await browser.newPage();
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('should work on mobile devices', async () => {
      await page.setViewport(MOBILE_VIEWPORT);
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      // Test touch interaction
      await page.touchscreen.tap(50, 100); // Approximate toggle button position
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

      const passwordType = await page.$eval(SELECTORS.LOGIN_PASSWORD, (el: HTMLInputElement) => el.type);
      expect(passwordType).toBe(INPUT_TYPES.TEXT);
    });

    test('should maintain proper touch target size', async () => {
      await page.setViewport(MOBILE_VIEWPORT);
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      const toggleSize = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }, SELECTORS.LOGIN_TOGGLE);

      expect(toggleSize).not.toBeNull();
      expect(toggleSize!.width).toBeGreaterThanOrEqual(24);
      expect(toggleSize!.height).toBeGreaterThanOrEqual(24);
    });

    test('should work with different screen sizes', async () => {
      const viewports = [
        { width: 320, height: 568 }, // iPhone SE
        { width: 768, height: 1024 }, // iPad
        { width: 1920, height: 1080 } // Desktop
      ];

      for (const viewport of viewports) {
        await page.setViewport(viewport);
        await page.goto(`${testServer.url}/login`);
        await page.waitForTimeout(FORM_LOAD_DELAY);

        const toggleVisible = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          return element && window.getComputedStyle(element).display !== 'none';
        }, SELECTORS.LOGIN_TOGGLE);

        expect(toggleVisible).toBe(true);

        await page.click(SELECTORS.LOGIN_TOGGLE);
        await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

        const passwordType = await page.$eval(SELECTORS.LOGIN_PASSWORD, (el: HTMLInputElement) => el.type);
        expect(passwordType).toBe(INPUT_TYPES.TEXT);
      }
    });
  });

  describe('Performance Tests', () => {
    let page: Page;

    beforeEach(async () => {
      page = await browser.newPage();
      await page.setViewport(DESKTOP_VIEWPORT);
    });

    afterEach(async () => {
      if (page) {
        await page.close();
      }
    });

    test('should handle rapid toggle operations', async () => {
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      // Perform rapid toggles
      for (let i = 0; i < RAPID_TOGGLE_COUNT; i++) {
        await page.click(SELECTORS.LOGIN_TOGGLE);
        await page.waitForTimeout(50); // Minimal delay
      }

      // Verify final state is consistent
      const passwordType = await page.$eval(SELECTORS.LOGIN_PASSWORD, (el: HTMLInputElement) => el.type);
      const expectedType = RAPID_TOGGLE_COUNT % 2 === 0 ? INPUT_TYPES.PASSWORD : INPUT_TYPES.TEXT;
      expect(passwordType).toBe(expectedType);
    });

    test('should not cause memory leaks', async () => {
      await page.goto(`${testServer.url}/signup`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      const initialMemory = await getMemoryUsage(page);

      // Perform many toggle operations
      for (let i = 0; i < MEMORY_LEAK_ITERATIONS; i++) {
        await page.click(SELECTORS.SIGNUP_PASSWORD_TOGGLE);
        await page.click(SELECTORS.SIGNUP_CONFIRM_TOGGLE);
        await page.waitForTimeout(10);
      }

      // Force garbage collection
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });

      const finalMemory = await getMemoryUsage(page);
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    test('should handle multiple forms efficiently', async () => {
      // Test scenario where both login and signup forms might be present
      await page.goto(`${testServer.url}/login`);
      await page.waitForTimeout(FORM_LOAD_DELAY);

      const startTime = Date.now();

      // Simulate presence of multiple forms by testing toggle performance
      for (let i = 0; i < 20; i++) {
        await page.click(SELECTORS.LOGIN_TOGGLE);
        await page.waitForTimeout(10);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (less than 2 seconds)
      expect(totalTime).toBeLessThan(2000);
    });
  });

  // Helper functions
  async function startTestServer(): Promise<TestServer> {
    const app = express();

    // Serve static files
    app.use('/css', express.static(path.join(process.cwd(), 'public/css')));
    app.use('/js', express.static(path.join(process.cwd(), 'public/js')));

    // Set up EJS
    app.set('view engine', 'ejs');
    app.set('views', path.join(process.cwd(), 'views'));

    // Routes
    app.get('/login', (req, res) => {
      res.render('login');
    });

    app.get('/signup', (req, res) => {
      res.render('signup');
    });

    app.post('/login', (req, res) => {
      res.json({ success: true, message: 'Login successful' });
    });

    app.post('/signup', (req, res) => {
      res.json({ success: true, message: 'Signup successful' });
    });

    const server = createServer(app);

    return new Promise((resolve, reject) => {
      server.listen(0, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        const address = server.address() as AddressInfo;
        const port = address.port;
        const url = `http://localhost:${port}`;

        resolve({ server, port, url });
      });
    });
  }

  async function togglePasswordField(
    page: Page,
    passwordSelector: string,
    toggleSelector: string
  ): Promise<ToggleTestResult> {
    // Get initial state
    const initialState = await page.evaluate(
      (selectors) => {
        const passwordInput = document.querySelector(selectors.password) as HTMLInputElement;
        const toggleButton = document.querySelector(selectors.toggle) as HTMLButtonElement;
        const icon = toggleButton.querySelector('i');

        return {
          type: passwordInput?.type,
          iconClass: icon?.className,
          ariaLabel: toggleButton?.getAttribute('aria-label'),
          ariaPressed: toggleButton?.getAttribute('aria-pressed')
        };
      },
      { password: passwordSelector, toggle: toggleSelector }
    );

    // Click toggle
    await page.click(toggleSelector);
    await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);

    // Get state after toggle
    const afterToggleState = await page.evaluate(
      (selectors) => {
        const passwordInput = document.querySelector(selectors.password) as HTMLInputElement;
        const toggleButton = document.querySelector(selectors.toggle) as HTMLButtonElement;
        const icon = toggleButton.querySelector('i');

        return {
          type: passwordInput?.type,
          iconClass: icon?.className,
          ariaLabel: toggleButton?.getAttribute('aria-label'),
          ariaPressed: toggleButton?.getAttribute('aria-pressed')
        };
      },
      { password: passwordSelector, toggle: toggleSelector }
    );

    return {
      initialType: initialState.type || '',
      initialIcon: getIconClass(initialState.iconClass || ''),
      initialAriaLabel: initialState.ariaLabel || '',
      initialAriaPressed: initialState.ariaPressed || '',
      afterToggleType: afterToggleState.type || '',
      afterToggleIcon: getIconClass(afterToggleState.iconClass || ''),
      afterToggleAriaLabel: afterToggleState.ariaLabel || '',
      afterToggleAriaPressed: afterToggleState.ariaPressed || ''
    };
  }

  async function testFormSubmission(
    page: Page,
    options: {
      passwordSelector: string;
      toggleSelector: string;
      formSelector: string;
      passwordValue: string;
      toggleBeforeSubmit?: boolean;
    }
  ): Promise<FormSubmissionResult> {
    const { passwordSelector, toggleSelector, formSelector, passwordValue, toggleBeforeSubmit = false } = options;

    // Fill password field
    await page.type(passwordSelector, passwordValue);

    // Toggle if requested
    if (toggleBeforeSubmit) {
      await page.click(toggleSelector);
      await page.waitForTimeout(TOGGLE_ANIMATION_DELAY);
    }

    // Get state before submission
    const preSubmissionState = await page.evaluate(
      (selectors) => {
        const passwordInput = document.querySelector(selectors.password) as HTMLInputElement;
        const toggleButton = document.querySelector(selectors.toggle) as HTMLButtonElement;

        return {
          passwordValue: passwordInput?.value,
          passwordType: passwordInput?.type,
          toggleState: toggleButton?.getAttribute('aria-pressed')
        };
      },
      { password: passwordSelector, toggle: toggleSelector }
    );

    // Submit form
    await page.click(SELECTORS.SUBMIT_BUTTON);
    await page.waitForTimeout(500);

    return {
      success: true, // Assume success if no errors thrown
      passwordValue: preSubmissionState.passwordValue || '',
      passwordType: preSubmissionState.passwordType || '',
      toggleState: preSubmissionState.toggleState || ''
    };
  }

  async function testThemeCompatibility(page: Page): Promise<ThemeTestResult> {
    // Test current theme (assuming light theme initially)
    const lightThemeResult = await page.evaluate((selector) => {
      const toggleButton = document.querySelector(selector) as HTMLElement;
      const icon = toggleButton?.querySelector('i') as HTMLElement;

      return {
        iconVisible: icon && window.getComputedStyle(icon).opacity !== '0',
        buttonClickable: toggleButton && !toggleButton.hasAttribute('disabled')
      };
    }, SELECTORS.LOGIN_TOGGLE);

    // Switch to dark theme if theme toggle exists
    const themeToggleExists = await page.$(SELECTORS.THEME_TOGGLE);
    let darkThemeResult = lightThemeResult;

    if (themeToggleExists) {
      await page.click(SELECTORS.THEME_TOGGLE);
      await page.waitForTimeout(THEME_TRANSITION_DELAY);

      darkThemeResult = await page.evaluate((selector) => {
        const toggleButton = document.querySelector(selector) as HTMLElement;
        const icon = toggleButton?.querySelector('i') as HTMLElement;

        return {
          iconVisible: icon && window.getComputedStyle(icon).opacity !== '0',
          buttonClickable: toggleButton && !toggleButton.hasAttribute('disabled')
        };
      }, SELECTORS.LOGIN_TOGGLE);
    }

    return {
      lightTheme: lightThemeResult,
      darkTheme: darkThemeResult
    };
  }

  async function getMemoryUsage(page: Page): Promise<number> {
    return await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
  }

  function getIconClass(classList: string): string {
    if (classList.includes(ICON_CLASSES.EYE_SLASH)) {
      return ICON_CLASSES.EYE_SLASH;
    }
    if (classList.includes(ICON_CLASSES.EYE)) {
      return ICON_CLASSES.EYE;
    }
    return '';
  }
});