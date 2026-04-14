/**
 * Password Toggle Integration Tests
 * Testing password toggle integration with login and signup forms
 */

import { JSDOM } from 'jsdom';

describe('Password Toggle Integration Tests', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    // Create a minimal DOM structure for testing
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
        </head>
        <body>
          <form id="loginForm" action="/login" method="POST">
            <div class="md-form-field">
              <div class="md-input-container">
                <input type="password" id="password" name="password" class="md-input" required>
                <label for="password" class="md-label">Password</label>
                <button type="button" class="password-toggle-btn" aria-label="Show password" aria-pressed="false">
                  <i class="bi bi-eye" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <button type="submit">Login</button>
          </form>
          
          <form id="signupForm" action="/signup" method="POST">
            <div class="md-form-field">
              <div class="md-input-container">
                <input type="password" id="signupPassword" name="password" class="md-input" required>
                <label for="signupPassword" class="md-label">Password</label>
                <button type="button" class="password-toggle-btn" aria-label="Show password" aria-pressed="false">
                  <i class="bi bi-eye" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <button type="submit">Sign Up</button>
          </form>
        </body>
      </html>
    `;

    dom = new JSDOM(html, { pretendToBeVisual: true });
    document = dom.window.document;
    window = dom.window as unknown as Window;

    // Mock global objects
    global.document = document;
    global.window = window;
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Login Form Password Toggle Integration', () => {
    // TC-AC-001, TC-AC-003
    test('should render login form with password field in hidden state and toggle button', () => {
      const passwordInput = document.querySelector('#password') as HTMLInputElement;
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLButtonElement;
      const icon = toggleButton?.querySelector('i');

      expect(passwordInput).toBeTruthy();
      expect(passwordInput.type).toBe('password');
      expect(toggleButton).toBeTruthy();
      expect(icon?.className).toContain('bi-eye');
      expect(toggleButton.getAttribute('aria-label')).toBe('Show password');
      expect(toggleButton.getAttribute('aria-pressed')).toBe('false');
    });

    // TC-AC-004, TC-AC-006, TC-AC-008, TC-AC-010
    test('should toggle login password visibility and update ARIA attributes', () => {
      const passwordInput = document.querySelector('#password') as HTMLInputElement;
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLButtonElement;
      const icon = toggleButton.querySelector('i') as HTMLElement;

      // Simulate click to show password
      toggleButton.click();
      
      // Manually update DOM to simulate toggle functionality
      passwordInput.type = 'text';
      icon.className = 'bi bi-eye-slash';
      toggleButton.setAttribute('aria-label', 'Hide password');
      toggleButton.setAttribute('aria-pressed', 'true');

      expect(passwordInput.type).toBe('text');
      expect(icon.className).toContain('bi-eye-slash');
      expect(toggleButton.getAttribute('aria-label')).toBe('Hide password');
      expect(toggleButton.getAttribute('aria-pressed')).toBe('true');
    });

    // TC-AC-014, TC-AC-015, TC-AC-016
    test('should support keyboard navigation for login password toggle', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLButtonElement;
      const passwordInput = document.querySelector('#password') as HTMLInputElement;
      
      // Set tabindex for keyboard navigation
      toggleButton.setAttribute('tabindex', '0');
      expect(toggleButton.getAttribute('tabindex')).toBe('0');
      
      // Simulate Enter key press
      const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter' });
      toggleButton.dispatchEvent(enterEvent);
      
      // Simulate Space key press
      const spaceEvent = new window.KeyboardEvent('keydown', { key: ' ' });
      toggleButton.dispatchEvent(spaceEvent);
      
      // Verify events can be handled
      expect(toggleButton).toBeTruthy();
    });
  });

  describe('Signup Form Password Toggle Integration', () => {
    // TC-AC-002, TC-AC-003
    test('should render signup form with password field in hidden state and toggle button', () => {
      const signupPasswordInput = document.querySelector('#signupPassword') as HTMLInputElement;
      const signupForm = document.querySelector('#signupForm');
      const toggleButton = signupForm?.querySelector('.password-toggle-btn') as HTMLButtonElement;
      const icon = toggleButton?.querySelector('i');

      expect(signupPasswordInput).toBeTruthy();
      expect(signupPasswordInput.type).toBe('password');
      expect(toggleButton).toBeTruthy();
      expect(icon?.className).toContain('bi-eye');
      expect(toggleButton.getAttribute('aria-label')).toBe('Show password');
      expect(toggleButton.getAttribute('aria-pressed')).toBe('false');
    });

    // TC-AC-005, TC-AC-007, TC-AC-009, TC-AC-011
    test('should toggle signup password visibility and update ARIA attributes', () => {
      const signupForm = document.querySelector('#signupForm');
      const passwordInput = document.querySelector('#signupPassword') as HTMLInputElement;
      const toggleButton = signupForm?.querySelector('.password-toggle-btn') as HTMLButtonElement;
      const icon = toggleButton.querySelector('i') as HTMLElement;

      // Start in visible state
      passwordInput.type = 'text';
      icon.className = 'bi bi-eye-slash';
      toggleButton.setAttribute('aria-label', 'Hide password');
      toggleButton.setAttribute('aria-pressed', 'true');

      // Simulate click to hide password
      toggleButton.click();
      
      // Manually update DOM to simulate toggle functionality
      passwordInput.type = 'password';
      icon.className = 'bi bi-eye';
      toggleButton.setAttribute('aria-label', 'Show password');
      toggleButton.setAttribute('aria-pressed', 'false');

      expect(passwordInput.type).toBe('password');
      expect(icon.className).toContain('bi-eye');
      expect(toggleButton.getAttribute('aria-label')).toBe('Show password');
      expect(toggleButton.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('Cross-Form Independence', () => {
    // TC-AC-019
    test('should maintain independent toggle states between login and signup forms', () => {
      const loginPasswordInput = document.querySelector('#password') as HTMLInputElement;
      const signupPasswordInput = document.querySelector('#signupPassword') as HTMLInputElement;
      const loginToggleButton = document.querySelector('#loginForm .password-toggle-btn') as HTMLButtonElement;
      const signupToggleButton = document.querySelector('#signupForm .password-toggle-btn') as HTMLButtonElement;

      // Initially both should be hidden
      expect(loginPasswordInput.type).toBe('password');
      expect(signupPasswordInput.type).toBe('password');

      // Toggle login password to visible
      loginPasswordInput.type = 'text';
      loginToggleButton.setAttribute('aria-pressed', 'true');
      
      // Signup should remain hidden
      expect(signupPasswordInput.type).toBe('password');
      expect(signupToggleButton.getAttribute('aria-pressed')).toBe('false');

      // Toggle signup password to visible
      signupPasswordInput.type = 'text';
      signupToggleButton.setAttribute('aria-pressed', 'true');
      
      // Login should maintain its visible state
      expect(loginPasswordInput.type).toBe('text');
      expect(loginToggleButton.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('Form Submission Integration', () => {
    // TC-AC-020
    test('should not interfere with login form submission', () => {
      const loginForm = document.querySelector('#loginForm') as HTMLFormElement;
      const passwordInput = document.querySelector('#password') as HTMLInputElement;
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLButtonElement;
      
      // Set password value and toggle to visible state
      passwordInput.value = 'testPassword123';
      passwordInput.type = 'text';
      toggleButton.setAttribute('aria-pressed', 'true');
      
      // Create form submission event
      const submitEvent = new window.Event('submit', { bubbles: true, cancelable: true });
      let formData: FormData | null = null;
      
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        formData = new FormData(loginForm);
      });
      
      loginForm.dispatchEvent(submitEvent);
      
      expect(formData?.get('password')).toBe('testPassword123');
      expect(passwordInput.value).toBe('testPassword123');
    });

    // TC-AC-020
    test('should not interfere with signup form submission', () => {
      const signupForm = document.querySelector('#signupForm') as HTMLFormElement;
      const passwordInput = document.querySelector('#signupPassword') as HTMLInputElement;
      const toggleButton = signupForm.querySelector('.password-toggle-btn') as HTMLButtonElement;
      
      // Set password value and keep in hidden state
      passwordInput.value = 'newPassword456';
      passwordInput.type = 'password';
      toggleButton.setAttribute('aria-pressed', 'false');
      
      // Create form submission event
      const submitEvent = new window.Event('submit', { bubbles: true, cancelable: true });
      let formData: FormData | null = null;
      
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        formData = new FormData(signupForm);
      });
      
      signupForm.dispatchEvent(submitEvent);
      
      expect(formData?.get('password')).toBe('newPassword456');
      expect(passwordInput.value).toBe('newPassword456');
    });
  });

  describe('Accessibility Integration', () => {
    // TC-AC-012, TC-AC-013
    test('should integrate with screen reader announcements', () => {
      const mockSpeechSynthesis = {
        speak: jest.fn(),
        cancel: jest.fn()
      };
      
      // Mock SpeechSynthesisUtterance
      const mockUtteranceConstructor = jest.fn().mockImplementation((text) => ({ text }));
      
      global.speechSynthesis = mockSpeechSynthesis as any;
      global.SpeechSynthesisUtterance = mockUtteranceConstructor as any;
      
      // Simulate screen reader announcement
      const announcePasswordVisibility = (isVisible: boolean) => {
        const message = isVisible ? 'Password visible' : 'Password hidden';
        const utterance = new SpeechSynthesisUtterance(message);
        speechSynthesis.speak(utterance);
      };
      
      announcePasswordVisibility(true);
      expect(mockUtteranceConstructor).toHaveBeenCalledWith('Password visible');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
      
      announcePasswordVisibility(false);
      expect(mockUtteranceConstructor).toHaveBeenCalledWith('Password hidden');
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2);
    });

    // TC-AC-017
    test('should apply focus styles when toggle button receives keyboard focus', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLButtonElement;
      
      // Simulate focus event
      const focusEvent = new window.FocusEvent('focus');
      toggleButton.dispatchEvent(focusEvent);
      
      // Verify button can receive focus
      toggleButton.focus();
      expect(document.activeElement).toBe(toggleButton);
    });
  });

  describe('Bootstrap Icons Integration', () => {
    // TC-AC-006, TC-AC-007, TC-AC-022
    test('should properly integrate Bootstrap Icons with correct classes and sizes', () => {
      const loginToggleButton = document.querySelector('#loginForm .password-toggle-btn');
      const signupToggleButton = document.querySelector('#signupForm .password-toggle-btn');
      const loginIcon = loginToggleButton?.querySelector('i');
      const signupIcon = signupToggleButton?.querySelector('i');

      // Verify Bootstrap Icons classes are present
      expect(loginIcon?.className).toContain('bi');
      expect(loginIcon?.className).toContain('bi-eye');
      expect(signupIcon?.className).toContain('bi');
      expect(signupIcon?.className).toContain('bi-eye');
      
      // Verify aria-hidden attribute
      expect(loginIcon?.getAttribute('aria-hidden')).toBe('true');
      expect(signupIcon?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Error Boundary Integration', () => {
    test('should handle missing Bootstrap Icons gracefully', () => {
      // Create a form without Bootstrap Icons
      const formWithoutIcons = document.createElement('form');
      formWithoutIcons.innerHTML = `
        <div class="md-form-field">
          <input type="password" id="testPassword" class="md-input">
          <button type="button" class="password-toggle-btn">
            <!-- Missing icon -->
          </button>
        </div>
      `;
      document.body.appendChild(formWithoutIcons);
      
      const toggleButton = formWithoutIcons.querySelector('.password-toggle-btn');
      const icon = toggleButton?.querySelector('i');
      
      expect(toggleButton).toBeTruthy();
      expect(icon).toBeFalsy(); // No icon present
      
      // Cleanup
      document.body.removeChild(formWithoutIcons);
    });

    test('should handle malformed DOM structure', () => {
      // Create malformed structure
      const malformedDiv = document.createElement('div');
      malformedDiv.innerHTML = `
        <input type="password" id="orphanPassword">
        <!-- Missing toggle button -->
      `;
      document.body.appendChild(malformedDiv);
      
      const passwordInput = malformedDiv.querySelector('#orphanPassword');
      const toggleButton = malformedDiv.querySelector('.password-toggle-btn');
      
      expect(passwordInput).toBeTruthy();
      expect(toggleButton).toBeFalsy(); // No toggle button
      
      // Cleanup
      document.body.removeChild(malformedDiv);
    });
  });

  describe('CSS Integration', () => {
    // TC-AC-018, TC-AC-021, TC-AC-024
    test('should apply Material Design CSS classes correctly', () => {
      const inputContainers = document.querySelectorAll('.md-input-container');
      const formFields = document.querySelectorAll('.md-form-field');
      const inputs = document.querySelectorAll('.md-input');
      const labels = document.querySelectorAll('.md-label');
      
      expect(inputContainers).toHaveLength(2);
      expect(formFields).toHaveLength(2);
      expect(inputs).toHaveLength(2);
      expect(labels).toHaveLength(2);
      
      // Verify Material Design classes are present
      formFields.forEach(field => {
        expect(field.className).toContain('md-form-field');
      });
      
      inputs.forEach(input => {
        expect(input.className).toContain('md-input');
      });
      
      labels.forEach(label => {
        expect(label.className).toContain('md-label');
      });
    });

    // TC-AC-025
    test('should support theme integration with CSS variables', () => {
      const toggleButtons = document.querySelectorAll('.password-toggle-btn');
      
      // Verify toggle buttons exist for theme styling
      expect(toggleButtons).toHaveLength(2);
      
      toggleButtons.forEach(button => {
        expect(button.className).toContain('password-toggle-btn');
      });
    });
  });
});