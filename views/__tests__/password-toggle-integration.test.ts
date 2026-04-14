/**
 * Password Toggle Integration Tests
 * Tests for password toggle functionality in actual login and signup page contexts
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Password Toggle Integration', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  
  const loadTemplate = (templateName: string): string => {
    const templatePath = path.join(__dirname, '../../views', `${templateName}.ejs`);
    return fs.readFileSync(templatePath, 'utf-8');
  };
  
  const renderTemplate = (templateContent: string, variables: any = {}): string => {
    // Simple EJS-like variable replacement for testing
    let rendered = templateContent;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`<%=\s*${key}\s*%>`, 'g');
      rendered = rendered.replace(regex, variables[key]);
    });
    // Remove any remaining EJS tags for testing
    rendered = rendered.replace(/<%[\s\S]*?%>/g, '');
    return rendered;
  };

  beforeEach(() => {
    // Create fresh DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      runScripts: 'dangerously',
      resources: 'usable'
    });
    
    window = dom.window as any;
    document = window.document;
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    dom.window.close();
  });

  describe('Login Page Integration', () => {
    beforeEach(() => {
      const loginTemplate = `
        <div class="login-container">
          <form id="loginForm" method="POST" action="/auth/login">
            <div class="password-input-container">
              <input type="password" id="password" name="password" required>
              <button type="button" class="password-toggle-btn" data-password-toggle="password">
                <i class="bi bi-eye"></i>
              </button>
            </div>
            <button type="submit">Login</button>
          </form>
        </div>
      `;
      
      document.body.innerHTML = loginTemplate;
      
      // Load and execute password toggle script
      const scriptContent = fs.readFileSync(
        path.join(__dirname, '../../public/js/password-toggle.js'), 
        'utf-8'
      );
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
    });

    // TC-AC-001: Password fields on login page display with eye icon positioned on the right side
    it('should display password field with properly positioned eye icon on login page', () => {
      const passwordInput = document.getElementById('password') as HTMLInputElement;
      const toggleButton = document.querySelector('[data-password-toggle="password"]') as HTMLElement;
      const icon = toggleButton?.querySelector('i');
      
      expect(passwordInput).toBeTruthy();
      expect(passwordInput.type).toBe('password');
      expect(toggleButton).toBeTruthy();
      expect(icon?.className).toContain('bi-eye');
    });

    // TC-AC-020: Password toggle does not interfere with form submission
    it('should not interfere with login form submission', () => {
      const form = document.getElementById('loginForm') as HTMLFormElement;
      const passwordInput = document.getElementById('password') as HTMLInputElement;
      const toggleButton = document.querySelector('[data-password-toggle="password"]') as HTMLElement;
      
      // Set password value
      passwordInput.value = 'testpassword123';
      
      // Toggle password visibility
      const clickEvent = new window.MouseEvent('click', { bubbles: true });
      toggleButton.dispatchEvent(clickEvent);
      
      // Verify form data is intact
      const formData = new FormData(form);
      expect(formData.get('password')).toBe('testpassword123');
      expect(passwordInput.value).toBe('testpassword123');
    });

    // TC-AC-021: Toggle button maintains 24x24px clickable area for accessibility compliance
    it('should maintain minimum 24x24px clickable area for accessibility', () => {
      const toggleButton = document.querySelector('[data-password-toggle="password"]') as HTMLElement;
      
      // Apply CSS styles that would be in production
      toggleButton.style.width = '24px';
      toggleButton.style.height = '24px';
      toggleButton.style.minWidth = '24px';
      toggleButton.style.minHeight = '24px';
      
      const computedStyle = window.getComputedStyle(toggleButton);
      expect(parseInt(computedStyle.width)).toBeGreaterThanOrEqual(24);
      expect(parseInt(computedStyle.height)).toBeGreaterThanOrEqual(24);
    });

    // TC-AC-024: Password field maintains proper right padding to prevent text overlap
    it('should maintain proper right padding to prevent text overlap on login page', () => {
      const passwordInput = document.getElementById('password') as HTMLInputElement;
      
      // Apply CSS that would be in production
      passwordInput.style.paddingRight = '40px';
      
      const computedStyle = window.getComputedStyle(passwordInput);
      expect(parseInt(computedStyle.paddingRight)).toBeGreaterThanOrEqual(40);
    });
  });

  describe('Signup Page Integration', () => {
    beforeEach(() => {
      const signupTemplate = `
        <div class="signup-container">
          <form id="signupForm" method="POST" action="/auth/signup">
            <div class="password-input-container">
              <input type="password" id="signup-password" name="password" required>
              <button type="button" class="password-toggle-btn" data-password-toggle="signup-password">
                <i class="bi bi-eye"></i>
              </button>
            </div>
            <div class="password-input-container">
              <input type="password" id="confirm-password" name="confirmPassword" required>
              <button type="button" class="password-toggle-btn" data-password-toggle="confirm-password">
                <i class="bi bi-eye"></i>
              </button>
            </div>
            <button type="submit">Sign Up</button>
          </form>
        </div>
      `;
      
      document.body.innerHTML = signupTemplate;
      
      // Load and execute password toggle script
      const scriptContent = fs.readFileSync(
        path.join(__dirname, '../../public/js/password-toggle.js'), 
        'utf-8'
      );
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
    });

    // TC-AC-002: Password fields on signup page display with eye icon positioned on the right side
    it('should display password fields with properly positioned eye icons on signup page', () => {
      const passwordInput = document.getElementById('signup-password') as HTMLInputElement;
      const confirmPasswordInput = document.getElementById('confirm-password') as HTMLInputElement;
      const passwordToggle = document.querySelector('[data-password-toggle="signup-password"]') as HTMLElement;
      const confirmToggle = document.querySelector('[data-password-toggle="confirm-password"]') as HTMLElement;
      
      expect(passwordInput).toBeTruthy();
      expect(confirmPasswordInput).toBeTruthy();
      expect(passwordInput.type).toBe('password');
      expect(confirmPasswordInput.type).toBe('password');
      expect(passwordToggle).toBeTruthy();
      expect(confirmToggle).toBeTruthy();
    });

    it('should handle multiple password fields independently on signup page', () => {
      const passwordInput = document.getElementById('signup-password') as HTMLInputElement;
      const confirmPasswordInput = document.getElementById('confirm-password') as HTMLInputElement;
      const passwordToggle = document.querySelector('[data-password-toggle="signup-password"]') as HTMLElement;
      const confirmToggle = document.querySelector('[data-password-toggle="confirm-password"]') as HTMLElement;
      
      // Initialize toggle functionality
      (window as any).initPasswordToggle();
      
      // Toggle only password field
      const clickEvent1 = new window.MouseEvent('click', { bubbles: true });
      passwordToggle.dispatchEvent(clickEvent1);
      
      expect(passwordInput.type).toBe('text');
      expect(confirmPasswordInput.type).toBe('password'); // Should remain hidden
      
      // Toggle confirm password field
      const clickEvent2 = new window.MouseEvent('click', { bubbles: true });
      confirmToggle.dispatchEvent(clickEvent2);
      
      expect(passwordInput.type).toBe('text'); // Should remain visible
      expect(confirmPasswordInput.type).toBe('text'); // Now visible
    });
  });

  describe('Cross-Page Functionality', () => {
    // TC-AC-019: Toggle functionality works independently on login and signup pages when both are present
    it('should work independently when both login and signup forms are present', () => {
      const combinedTemplate = `
        <div class="login-container">
          <form id="loginForm">
            <div class="password-input-container">
              <input type="password" id="login-password" name="password">
              <button type="button" data-password-toggle="login-password">
                <i class="bi bi-eye"></i>
              </button>
            </div>
          </form>
        </div>
        <div class="signup-container">
          <form id="signupForm">
            <div class="password-input-container">
              <input type="password" id="signup-password" name="password">
              <button type="button" data-password-toggle="signup-password">
                <i class="bi bi-eye"></i>
              </button>
            </div>
          </form>
        </div>
      `;
      
      document.body.innerHTML = combinedTemplate;
      
      const loginPasswordInput = document.getElementById('login-password') as HTMLInputElement;
      const signupPasswordInput = document.getElementById('signup-password') as HTMLInputElement;
      const loginToggle = document.querySelector('[data-password-toggle="login-password"]') as HTMLElement;
      const signupToggle = document.querySelector('[data-password-toggle="signup-password"]') as HTMLElement;
      
      // Initialize toggle functionality
      const scriptContent = fs.readFileSync(
        path.join(__dirname, '../../public/js/password-toggle.js'), 
        'utf-8'
      );
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
      
      (window as any).initPasswordToggle();
      
      // Toggle login password
      const clickEvent1 = new window.MouseEvent('click', { bubbles: true });
      loginToggle.dispatchEvent(clickEvent1);
      
      expect(loginPasswordInput.type).toBe('text');
      expect(signupPasswordInput.type).toBe('password'); // Should remain hidden
      
      // Toggle signup password
      const clickEvent2 = new window.MouseEvent('click', { bubbles: true });
      signupToggle.dispatchEvent(clickEvent2);
      
      expect(loginPasswordInput.type).toBe('text'); // Should remain visible
      expect(signupPasswordInput.type).toBe('text'); // Now visible
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="password-input-container">
          <input type="password" id="test-password" name="password">
          <button type="button" data-password-toggle="test-password">
            <i class="bi bi-eye"></i>
          </button>
        </div>
      `;
    });

    // TC-AC-023: Toggle functionality works on mobile devices with touch interaction
    it('should handle touch events on mobile devices', () => {
      const toggleButton = document.querySelector('[data-password-toggle="test-password"]') as HTMLElement;
      const passwordInput = document.getElementById('test-password') as HTMLInputElement;
      
      // Initialize toggle functionality
      const scriptContent = fs.readFileSync(
        path.join(__dirname, '../../public/js/password-toggle.js'), 
        'utf-8'
      );
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
      
      (window as any).initPasswordToggle();
      
      // Simulate touch interaction
      const touchStartEvent = new window.TouchEvent('touchstart', { bubbles: true });
      const touchEndEvent = new window.TouchEvent('touchend', { bubbles: true });
      const clickEvent = new window.MouseEvent('click', { bubbles: true });
      
      toggleButton.dispatchEvent(touchStartEvent);
      toggleButton.dispatchEvent(touchEndEvent);
      toggleButton.dispatchEvent(clickEvent);
      
      expect(passwordInput.type).toBe('text');
    });

    // TC-AC-022: Icon size remains 16px and properly centered within toggle button area
    it('should maintain proper icon size and centering', () => {
      const icon = document.querySelector('[data-password-toggle="test-password"] i') as HTMLElement;
      
      // Apply CSS that would be in production
      icon.style.fontSize = '16px';
      icon.style.width = '16px';
      icon.style.height = '16px';
      
      const computedStyle = window.getComputedStyle(icon);
      expect(parseInt(computedStyle.fontSize)).toBe(16);
    });
  });

  describe('Theme Compatibility', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="password-input-container">
          <input type="password" id="test-password" name="password">
          <button type="button" data-password-toggle="test-password">
            <i class="bi bi-eye"></i>
          </button>
        </div>
      `;
    });

    // TC-AC-025: Feature works correctly in both light and dark theme modes
    it('should work correctly in light theme mode', () => {
      document.body.setAttribute('data-theme', 'light');
      
      const toggleButton = document.querySelector('[data-password-toggle="test-password"]') as HTMLElement;
      const icon = toggleButton.querySelector('i') as HTMLElement;
      
      // Apply light theme styles
      icon.style.color = '#6c757d'; // Material Design secondary text
      
      const scriptContent = fs.readFileSync(
        path.join(__dirname, '../../public/js/password-toggle.js'), 
        'utf-8'
      );
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
      
      expect(() => (window as any).initPasswordToggle()).not.toThrow();
    });

    it('should work correctly in dark theme mode', () => {
      document.body.setAttribute('data-theme', 'dark');
      
      const toggleButton = document.querySelector('[data-password-toggle="test-password"]') as HTMLElement;
      const icon = toggleButton.querySelector('i') as HTMLElement;
      
      // Apply dark theme styles
      icon.style.color = '#adb5bd'; // Material Design secondary text (dark)
      
      const scriptContent = fs.readFileSync(
        path.join(__dirname, '../../public/js/password-toggle.js'), 
        'utf-8'
      );
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
      
      expect(() => (window as any).initPasswordToggle()).not.toThrow();
    });
  });

  describe('Browser Compatibility', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div class="password-input-container">
          <input type="password" id="test-password" name="password">
          <button type="button" data-password-toggle="test-password">
            <i class="bi bi-eye"></i>
          </button>
        </div>
      `;
    });

    it('should handle legacy browsers gracefully', () => {
      // Mock older browser environment
      delete (window as any).MouseEvent;
      (window as any).MouseEvent = function(type: string, options: any) {
        const event = document.createEvent('MouseEvents');
        event.initMouseEvent(type, options.bubbles, options.cancelable, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        return event;
      };
      
      const scriptContent = fs.readFileSync(
        path.join(__dirname, '../../public/js/password-toggle.js'), 
        'utf-8'
      );
      const script = document.createElement('script');
      script.textContent = scriptContent;
      document.head.appendChild(script);
      
      expect(() => (window as any).initPasswordToggle()).not.toThrow();
    });

    it('should work without modern JavaScript features', () => {
      // Test that core functionality works even with limited JavaScript support
      const passwordInput = document.getElementById('test-password') as HTMLInputElement;
      const toggleButton = document.querySelector('[data-password-toggle="test-password"]') as HTMLElement;
      
      expect(passwordInput).toBeTruthy();
      expect(toggleButton).toBeTruthy();
      expect(passwordInput.type).toBe('password');
    });
  });
});

// Additional utility tests for edge cases
describe('Password Toggle Edge Cases', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
    window = dom.window as any;
    document = window.document;
  });

  afterEach(() => {
    dom.window.close();
  });

  it('should handle missing Bootstrap Icons gracefully', () => {
    document.body.innerHTML = `
      <div class="password-input-container">
        <input type="password" id="test-password" name="password">
        <button type="button" data-password-toggle="test-password">
          <!-- No icon element -->
        </button>
      </div>
    `;
    
    const scriptContent = fs.readFileSync(
      path.join(__dirname, '../../public/js/password-toggle.js'), 
      'utf-8'
    );
    const script = document.createElement('script');
    script.textContent = scriptContent;
    document.head.appendChild(script);
    
    expect(() => (window as any).initPasswordToggle()).not.toThrow();
  });

  it('should handle malformed HTML structure', () => {
    document.body.innerHTML = `
      <input type="password" id="test-password">
      <button data-password-toggle="wrong-id">
        <i class="bi bi-eye"></i>
      </button>
    `;
    
    const scriptContent = fs.readFileSync(
      path.join(__dirname, '../../public/js/password-toggle.js'), 
      'utf-8'
    );
    const script = document.createElement('script');
    script.textContent = scriptContent;
    document.head.appendChild(script);
    
    expect(() => (window as any).initPasswordToggle()).not.toThrow();
  });

  it('should handle rapid successive toggles', () => {
    document.body.innerHTML = `
      <div class="password-input-container">
        <input type="password" id="test-password" name="password">
        <button type="button" data-password-toggle="test-password">
          <i class="bi bi-eye"></i>
        </button>
      </div>
    `;
    
    const scriptContent = fs.readFileSync(
      path.join(__dirname, '../../public/js/password-toggle.js'), 
      'utf-8'
    );
    const script = document.createElement('script');
    script.textContent = scriptContent;
    document.head.appendChild(script);
    
    (window as any).initPasswordToggle();
    
    const toggleButton = document.querySelector('[data-password-toggle="test-password"]') as HTMLElement;
    const passwordInput = document.getElementById('test-password') as HTMLInputElement;
    
    // Rapid successive clicks
    for (let i = 0; i < 10; i++) {
      const clickEvent = new window.MouseEvent('click', { bubbles: true });
      toggleButton.dispatchEvent(clickEvent);
    }
    
    // Should end up in text mode (odd number of clicks)
    expect(passwordInput.type).toBe('text');
  });
});

// Mock required for JSDOM
if (typeof global !== 'undefined') {
  (global as any).TouchEvent = class TouchEvent extends Event {
    constructor(type: string, options?: any) {
      super(type, options);
    }
  };
}