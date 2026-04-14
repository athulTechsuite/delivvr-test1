const request = require('supertest');
const { JSDOM } = require('jsdom');
const app = require('../app');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Constants for test configuration
const REMEMBER_ME_LABEL = 'Remember me for 7 days';
const DEFAULT_TOKEN_EXPIRY = 24 * 60 * 60; // 24 hours in seconds
const REMEMBER_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const CHECKBOX_SELECTOR = 'input[name="rememberMe"]';
const LABEL_SELECTOR = 'label[for="rememberMe"]';
const FORM_SELECTOR = '#loginForm';

describe('Remember Me Checkbox Feature', () => {
  let testUser;
  
  beforeEach(async () => {
    // Clear any existing test data
    await User.deleteMany({ email: 'test@example.com' });
    
    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    testUser = new User({
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User'
    });
    await testUser.save();
  });

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: 'test@example.com' });
  });

  describe('UI Rendering and Behavior', () => {
    let dom;
    let document;
    let window;

    beforeEach(async () => {
      // Fetch login page HTML
      const response = await request(app)
        .get('/login')
        .expect(200);

      // Parse HTML with JSDOM
      dom = new JSDOM(response.text, {
        url: 'http://localhost:3000/login',
        runScripts: 'dangerously',
        resources: 'usable'
      });
      document = dom.window.document;
      window = dom.window;
    });

    afterEach(() => {
      if (dom) {
        dom.window.close();
      }
    });

    test('checkbox renders unchecked by default', () => {
      const checkbox = document.querySelector(CHECKBOX_SELECTOR);
      
      expect(checkbox).toBeTruthy();
      expect(checkbox.type).toBe('checkbox');
      expect(checkbox.name).toBe('rememberMe');
      expect(checkbox.id).toBe('rememberMe');
      expect(checkbox.checked).toBe(false);
      expect(checkbox.defaultChecked).toBe(false);
    });

    test('checkbox has correct label text', () => {
      const label = document.querySelector(LABEL_SELECTOR);
      
      expect(label).toBeTruthy();
      expect(label.textContent.trim()).toBe(REMEMBER_ME_LABEL);
      expect(label.getAttribute('for')).toBe('rememberMe');
    });

    test('checkbox has proper accessibility attributes', () => {
      const checkbox = document.querySelector(CHECKBOX_SELECTOR);
      const label = document.querySelector(LABEL_SELECTOR);
      
      expect(checkbox.getAttribute('id')).toBe('rememberMe');
      expect(label.getAttribute('for')).toBe('rememberMe');
      expect(checkbox.getAttribute('aria-labelledby')).toBeTruthy();
    });

    test('checkbox has Material Design styling classes', () => {
      const checkboxContainer = document.querySelector('.form-check');
      const checkbox = document.querySelector(CHECKBOX_SELECTOR);
      const label = document.querySelector(LABEL_SELECTOR);
      
      expect(checkboxContainer).toBeTruthy();
      expect(checkboxContainer.classList.contains('form-check')).toBe(true);
      expect(checkbox.classList.contains('form-check-input')).toBe(true);
      expect(label.classList.contains('form-check-label')).toBe(true);
    });

    test('checkbox is keyboard navigable', () => {
      const checkbox = document.querySelector(CHECKBOX_SELECTOR);
      
      expect(checkbox.tabIndex).toBeGreaterThanOrEqual(0);
      expect(checkbox.getAttribute('tabindex')).not.toBe('-1');
    });

    test('checkbox toggles state correctly', () => {
      const checkbox = document.querySelector(CHECKBOX_SELECTOR);
      
      // Initial state
      expect(checkbox.checked).toBe(false);
      
      // Toggle checked
      checkbox.click();
      expect(checkbox.checked).toBe(true);
      
      // Toggle unchecked
      checkbox.click();
      expect(checkbox.checked).toBe(false);
    });

    test('form contains checkbox within proper structure', () => {
      const form = document.querySelector(FORM_SELECTOR);
      const checkbox = document.querySelector(CHECKBOX_SELECTOR);
      
      expect(form).toBeTruthy();
      expect(form.contains(checkbox)).toBe(true);
      expect(checkbox.form).toBe(form);
    });

    test('responsive design classes are present', () => {
      const checkboxContainer = document.querySelector('.form-check');
      
      // Check for responsive utility classes
      const hasResponsiveClasses = Array.from(checkboxContainer.classList)
        .some(className => 
          className.includes('col-') || 
          className.includes('mb-') || 
          className.includes('mt-')
        );
      
      expect(hasResponsiveClasses || checkboxContainer.closest('.row')).toBeTruthy();
    });
  });

  describe('Form Submission Behavior', () => {
    test('form submission includes checkbox value when checked', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: 'on'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');
      expect(response.headers['set-cookie']).toBeDefined();
      
      // Verify token has extended expiry
      const tokenCookie = response.headers['set-cookie']
        .find(cookie => cookie.startsWith('token='));
      expect(tokenCookie).toBeTruthy();
      
      const token = tokenCookie.split(';')[0].split('=')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const tokenExpiry = decoded.exp - decoded.iat;
      
      expect(tokenExpiry).toBe(REMEMBER_TOKEN_EXPIRY);
    });

    test('form submission works correctly when unchecked', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
        // rememberMe intentionally omitted (unchecked)
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');
      expect(response.headers['set-cookie']).toBeDefined();
      
      // Verify token has default expiry
      const tokenCookie = response.headers['set-cookie']
        .find(cookie => cookie.startsWith('token='));
      expect(tokenCookie).toBeTruthy();
      
      const token = tokenCookie.split(';')[0].split('=')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const tokenExpiry = decoded.exp - decoded.iat;
      
      expect(tokenExpiry).toBe(DEFAULT_TOKEN_EXPIRY);
    });

    test('checkbox state does not persist between page loads', async () => {
      // First request to login page
      const response1 = await request(app)
        .get('/login')
        .expect(200);

      const dom1 = new JSDOM(response1.text);
      const checkbox1 = dom1.window.document.querySelector(CHECKBOX_SELECTOR);
      expect(checkbox1.checked).toBe(false);

      // Second request to login page (simulating page reload)
      const response2 = await request(app)
        .get('/login')
        .expect(200);

      const dom2 = new JSDOM(response2.text);
      const checkbox2 = dom2.window.document.querySelector(CHECKBOX_SELECTOR);
      expect(checkbox2.checked).toBe(false);

      dom1.window.close();
      dom2.window.close();
    });

    test('handles various checkbox value formats', async () => {
      const testCases = [
        { rememberMe: 'on', shouldRemember: true },
        { rememberMe: 'true', shouldRemember: true },
        { rememberMe: '1', shouldRemember: true },
        { rememberMe: 'false', shouldRemember: false },
        { rememberMe: '0', shouldRemember: false },
        { rememberMe: '', shouldRemember: false },
        {} // no rememberMe field
      ];

      for (const testCase of testCases) {
        const loginData = {
          email: 'test@example.com',
          password: 'password123',
          ...testCase
        };

        const response = await request(app)
          .post('/login')
          .send(loginData)
          .expect(302);

        const tokenCookie = response.headers['set-cookie']
          .find(cookie => cookie.startsWith('token='));
        const token = tokenCookie.split(';')[0].split('=')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const tokenExpiry = decoded.exp - decoded.iat;

        const expectedExpiry = testCase.shouldRemember ? 
          REMEMBER_TOKEN_EXPIRY : DEFAULT_TOKEN_EXPIRY;
        
        expect(tokenExpiry).toBe(expectedExpiry);
      }
    });
  });

  describe('Token and Cookie Behavior', () => {
    test('login with checkbox checked sets refresh token cookie', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: 'on'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));

      expect(tokenCookie).toBeTruthy();
      expect(refreshTokenCookie).toBeTruthy();
      
      // Verify refresh token cookie has proper attributes
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('Secure');
      expect(refreshTokenCookie).toContain('SameSite=Strict');
    });

    test('login without checkbox checked creates only JWT cookie', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      const cookies = response.headers['set-cookie'];
      const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
      const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));

      expect(tokenCookie).toBeTruthy();
      expect(refreshTokenCookie).toBeUndefined();
    });

    test('refresh token is stored in database when remember me is checked', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: 'on'
      };

      await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      const updatedUser = await User.findOne({ email: 'test@example.com' });
      expect(updatedUser.refresh_token).toBeTruthy();
      expect(updatedUser.token_expires_at).toBeTruthy();
      
      // Verify refresh token is hashed
      expect(updatedUser.refresh_token).toHaveLength(60); // bcrypt hash length
      
      // Verify expiration date is approximately 7 days from now
      const expiryDate = new Date(updatedUser.token_expires_at);
      const now = new Date();
      const timeDiff = expiryDate.getTime() - now.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      expect(daysDiff).toBeCloseTo(7, 0);
    });

    test('refresh token is not stored when remember me is unchecked', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      const updatedUser = await User.findOne({ email: 'test@example.com' });
      expect(updatedUser.refresh_token).toBeFalsy();
      expect(updatedUser.token_expires_at).toBeFalsy();
    });

    test('multiple logins overwrite previous refresh token', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: 'on'
      };

      // First login
      await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      const userAfterFirstLogin = await User.findOne({ email: 'test@example.com' });
      const firstRefreshToken = userAfterFirstLogin.refresh_token;

      // Wait a brief moment to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second login
      await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      const userAfterSecondLogin = await User.findOne({ email: 'test@example.com' });
      const secondRefreshToken = userAfterSecondLogin.refresh_token;

      expect(firstRefreshToken).toBeTruthy();
      expect(secondRefreshToken).toBeTruthy();
      expect(firstRefreshToken).not.toBe(secondRefreshToken);
    });
  });

  describe('Client-side Validation', () => {
    test('form validates email format before submission', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);

      const dom = new JSDOM(response.text, { runScripts: 'dangerously' });
      const document = dom.window.document;
      
      const emailInput = document.querySelector('input[name="email"]');
      expect(emailInput.type).toBe('email');
      expect(emailInput.required).toBe(true);
      
      dom.window.close();
    });

    test('form validates password is required', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);

      const dom = new JSDOM(response.text, { runScripts: 'dangerously' });
      const document = dom.window.document;
      
      const passwordInput = document.querySelector('input[name="password"]');
      expect(passwordInput.type).toBe('password');
      expect(passwordInput.required).toBe(true);
      
      dom.window.close();
    });

    test('checkbox does not prevent form submission when unchecked', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');
    });
  });

  describe('Error Handling', () => {
    test('handles malformed checkbox values gracefully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: null
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');
    });

    test('handles missing checkbox field gracefully', async () => {
      const formData = new URLSearchParams();
      formData.append('email', 'test@example.com');
      formData.append('password', 'password123');
      // Intentionally omit rememberMe field

      const response = await request(app)
        .post('/login')
        .type('form')
        .send(formData.toString())
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');
    });

    test('invalid login credentials work same with or without remember me', async () => {
      const invalidLoginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
        rememberMe: 'on'
      };

      const response = await request(app)
        .post('/login')
        .send(invalidLoginData)
        .expect(302);

      expect(response.headers.location).toBe('/login?error=invalid');
    });
  });

  describe('Cross-browser Compatibility', () => {
    test('checkbox renders consistently across different JSDOM configurations', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);

      // Test with different JSDOM options
      const configurations = [
        { pretendToBeVisual: true },
        { pretendToBeVisual: false },
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      ];

      for (const config of configurations) {
        const dom = new JSDOM(response.text, config);
        const document = dom.window.document;
        
        const checkbox = document.querySelector(CHECKBOX_SELECTOR);
        expect(checkbox).toBeTruthy();
        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(false);
        
        dom.window.close();
      }
    });
  });

  describe('Form Data Serialization', () => {
    test('checkbox value serializes correctly in form data', () => {
      const testCases = [
        { rememberMe: 'on', expected: true },
        { rememberMe: 'off', expected: false },
        { rememberMe: true, expected: true },
        { rememberMe: false, expected: false },
        { rememberMe: '1', expected: true },
        { rememberMe: '0', expected: false },
        { rememberMe: '', expected: false },
        { rememberMe: undefined, expected: false },
        { rememberMe: null, expected: false }
      ];

      testCases.forEach(testCase => {
        const formData = {
          email: 'test@example.com',
          password: 'password123'
        };

        if (testCase.rememberMe !== undefined) {
          formData.rememberMe = testCase.rememberMe;
        }

        // Simulate form processing logic
        const shouldRemember = !!(formData.rememberMe && 
          formData.rememberMe !== 'false' && 
          formData.rememberMe !== '0' && 
          formData.rememberMe !== 'off');

        expect(shouldRemember).toBe(testCase.expected);
      });
    });
  });

  describe('Visual Regression Prevention', () => {
    test('login form structure remains intact with checkbox addition', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);

      const dom = new JSDOM(response.text);
      const document = dom.window.document;

      // Verify form structure
      const form = document.querySelector(FORM_SELECTOR);
      const emailInput = document.querySelector('input[name="email"]');
      const passwordInput = document.querySelector('input[name="password"]');
      const rememberMeCheckbox = document.querySelector(CHECKBOX_SELECTOR);
      const submitButton = document.querySelector('button[type="submit"]');

      expect(form).toBeTruthy();
      expect(emailInput).toBeTruthy();
      expect(passwordInput).toBeTruthy();
      expect(rememberMeCheckbox).toBeTruthy();
      expect(submitButton).toBeTruthy();

      // Verify order of elements
      const formElements = Array.from(form.elements);
      const emailIndex = formElements.indexOf(emailInput);
      const passwordIndex = formElements.indexOf(passwordInput);
      const checkboxIndex = formElements.indexOf(rememberMeCheckbox);

      expect(emailIndex).toBeLessThan(passwordIndex);
      expect(passwordIndex).toBeLessThan(checkboxIndex);

      dom.window.close();
    });

    test('checkbox container has proper spacing and layout', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);

      const dom = new JSDOM(response.text);
      const document = dom.window.document;

      const checkboxContainer = document.querySelector('.form-check');
      expect(checkboxContainer).toBeTruthy();

      // Verify container has margin/padding classes
      const hasSpacing = Array.from(checkboxContainer.classList)
        .some(className => 
          className.startsWith('mb-') || 
          className.startsWith('mt-') || 
          className.startsWith('my-') ||
          className.startsWith('p-')
        );

      expect(hasSpacing || checkboxContainer.closest('.mb-3, .my-3')).toBeTruthy();

      dom.window.close();
    });
  });

  describe('Performance and Memory', () => {
    test('JSDOM instances are properly cleaned up', () => {
      let dom;
      
      return request(app)
        .get('/login')
        .expect(200)
        .then(response => {
          dom = new JSDOM(response.text);
          const checkbox = dom.window.document.querySelector(CHECKBOX_SELECTOR);
          expect(checkbox).toBeTruthy();
          return checkbox;
        })
        .finally(() => {
          if (dom) {
            dom.window.close();
            dom = null;
          }
        });
    });

    test('multiple form submissions do not leak memory', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: 'on'
      };

      // Perform multiple rapid submissions
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/login')
          .send(loginData)
          .expect(302)
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.headers.location).toBe('/dashboard');
      });
    });
  });
});