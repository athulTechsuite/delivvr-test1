/**
 * Password Toggle Module Tests
 * Tests for password visibility toggle functionality with accessibility support
 */

describe('Password Toggle Module', () => {
  let mockButton: HTMLElement;
  let mockPasswordInput: HTMLInputElement;
  let mockIcon: HTMLElement;
  let container: HTMLElement;

  beforeEach(() => {
    // Reset DOM and create test environment
    document.body.innerHTML = '';
    
    // Create test container
    container = document.createElement('div');
    container.className = 'password-input-container';
    
    // Create password input
    mockPasswordInput = document.createElement('input');
    mockPasswordInput.type = 'password';
    mockPasswordInput.id = 'test-password';
    mockPasswordInput.value = 'testpassword123';
    
    // Create toggle button
    mockButton = document.createElement('button');
    mockButton.setAttribute('data-password-toggle', 'test-password');
    
    // Create icon
    mockIcon = document.createElement('i');
    mockIcon.className = 'bi bi-eye';
    mockButton.appendChild(mockIcon);
    
    // Append to container
    container.appendChild(mockPasswordInput);
    container.appendChild(mockButton);
    document.body.appendChild(container);
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    // TC-AC-003: Password fields start in hidden state on page load
    it('should initialize password fields in hidden state by default', () => {
      initPasswordToggle();
      setupToggleListeners();
      
      expect(mockPasswordInput.type).toBe('password');
      expect(mockPasswordInput.getAttribute('data-password-field')).toBe('true');
    });

    // TC-AC-008: Toggle button has proper ARIA label 'Show password' when password is hidden
    it('should set initial ARIA label to "Show password" when password is hidden', () => {
      initPasswordToggle();
      setupToggleListeners();
      
      expect(mockButton.getAttribute('aria-label')).toBe('Show password');
    });

    // TC-AC-010: Toggle button aria-pressed attribute is 'false' when password is hidden
    it('should set initial aria-pressed to false when password is hidden', () => {
      initPasswordToggle();
      setupToggleListeners();
      
      expect(mockButton.getAttribute('aria-pressed')).toBe('false');
    });

    // TC-AC-014: Toggle button is reachable via keyboard tab navigation
    it('should make toggle button focusable via keyboard navigation', () => {
      initPasswordToggle();
      setupToggleListeners();
      
      expect(mockButton.getAttribute('tabindex')).toBe('0');
      expect(mockButton.getAttribute('role')).toBe('button');
    });

    it('should create screen reader description element', () => {
      initPasswordToggle();
      setupToggleListeners();
      
      const description = document.getElementById('test-password-toggle-desc');
      expect(description).toBeTruthy();
      expect(description?.textContent).toBe('Toggle password visibility');
      expect(description?.className).toBe('sr-only');
    });

    it('should handle missing password input gracefully', () => {
      mockButton.setAttribute('data-password-toggle', 'nonexistent-input');
      
      expect(() => {
        initPasswordToggle();
        setupToggleListeners();
      }).not.toThrow();
      
      expect(console.warn).toHaveBeenCalledWith(
        'Password input not found for toggle button with target: nonexistent-input'
      );
    });

    it('should prevent duplicate initialization', () => {
      initPasswordToggle();
      setupToggleListeners();
      setupToggleListeners(); // Call again
      
      expect(mockButton.getAttribute('data-toggle-initialized')).toBe('true');
    });
  });

  describe('Password Visibility Toggle - Click Events', () => {
    beforeEach(() => {
      initPasswordToggle();
      setupToggleListeners();
    });

    // TC-AC-004: Clicking the eye icon changes password field to text type showing plain text
    it('should change password field to text type when eye icon is clicked', () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent);
      
      expect(mockPasswordInput.type).toBe('text');
    });

    // TC-AC-005: Clicking eye icon when password is visible changes field back to password type
    it('should change text field back to password type when clicked again', () => {
      // First click - show password
      const clickEvent1 = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent1);
      expect(mockPasswordInput.type).toBe('text');
      
      // Second click - hide password
      const clickEvent2 = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent2);
      expect(mockPasswordInput.type).toBe('password');
    });

    // TC-AC-006: Eye icon changes from bi-eye to bi-eye-slash when password becomes visible
    it('should change icon from bi-eye to bi-eye-slash when password becomes visible', () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent);
      
      expect(mockIcon.className).toBe('bi bi-eye-slash');
    });

    // TC-AC-007: Eye icon changes from bi-eye-slash to bi-eye when password becomes hidden
    it('should change icon from bi-eye-slash to bi-eye when password becomes hidden', () => {
      // First click - show password
      const clickEvent1 = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent1);
      expect(mockIcon.className).toBe('bi bi-eye-slash');
      
      // Second click - hide password
      const clickEvent2 = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent2);
      expect(mockIcon.className).toBe('bi bi-eye');
    });

    // TC-AC-009: Toggle button has proper ARIA label 'Hide password' when password is visible
    it('should update ARIA label to "Hide password" when password is visible', () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent);
      
      expect(mockButton.getAttribute('aria-label')).toBe('Hide password');
    });

    // TC-AC-011: Toggle button aria-pressed attribute is 'true' when password is visible
    it('should set aria-pressed to true when password is visible', () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent);
      
      expect(mockButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('should prevent event propagation on click', () => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      jest.spyOn(clickEvent, 'preventDefault');
      jest.spyOn(clickEvent, 'stopPropagation');
      
      mockButton.dispatchEvent(clickEvent);
      
      expect(clickEvent.preventDefault).toHaveBeenCalled();
      expect(clickEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Keyboard Interaction', () => {
    beforeEach(() => {
      initPasswordToggle();
      setupToggleListeners();
    });

    // TC-AC-015: Pressing Enter key when toggle button is focused activates password visibility toggle
    it('should toggle password visibility when Enter key is pressed', () => {
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      jest.spyOn(keydownEvent, 'preventDefault');
      
      mockButton.dispatchEvent(keydownEvent);
      
      expect(mockPasswordInput.type).toBe('text');
      expect(keydownEvent.preventDefault).toHaveBeenCalled();
    });

    // TC-AC-016: Pressing Space key when toggle button is focused activates password visibility toggle
    it('should toggle password visibility when Space key is pressed', () => {
      const keydownEvent = new KeyboardEvent('keydown', { key: ' ' });
      jest.spyOn(keydownEvent, 'preventDefault');
      
      mockButton.dispatchEvent(keydownEvent);
      
      expect(mockPasswordInput.type).toBe('text');
      expect(keydownEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not respond to other keys', () => {
      const keydownEvent = new KeyboardEvent('keydown', { key: 'a' });
      jest.spyOn(keydownEvent, 'preventDefault');
      
      mockButton.dispatchEvent(keydownEvent);
      
      expect(mockPasswordInput.type).toBe('password');
      expect(keydownEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Screen Reader Announcements', () => {
    let mockLiveRegion: HTMLElement;

    beforeEach(() => {
      initPasswordToggle();
      setupToggleListeners();
      
      // Mock live region creation
      mockLiveRegion = document.createElement('div');
      mockLiveRegion.id = 'password-toggle-announcer';
      jest.spyOn(document, 'createElement').mockReturnValue(mockLiveRegion);
    });

    // TC-AC-012: Screen reader announces 'Password visible' when password is shown
    it('should announce "Password visible" when password is shown', (done) => {
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent);
      
      setTimeout(() => {
        const announcer = document.getElementById('password-toggle-announcer');
        expect(announcer?.textContent).toBe('Password visible');
        done();
      }, 100);
    });

    // TC-AC-013: Screen reader announces 'Password hidden' when password is concealed
    it('should announce "Password hidden" when password is concealed', (done) => {
      // First show password
      const clickEvent1 = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent1);
      
      setTimeout(() => {
        // Then hide password
        const clickEvent2 = new MouseEvent('click', { bubbles: true });
        mockButton.dispatchEvent(clickEvent2);
        
        setTimeout(() => {
          const announcer = document.getElementById('password-toggle-announcer');
          expect(announcer?.textContent).toBe('Password hidden');
          done();
        }, 100);
      }, 100);
    });
  });

  describe('Focus Management', () => {
    beforeEach(() => {
      initPasswordToggle();
      setupToggleListeners();
    });

    it('should maintain focus on password input after toggle', (done) => {
      mockPasswordInput.focus();
      mockPasswordInput.setSelectionRange(5, 10); // Set cursor position
      
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent);
      
      setTimeout(() => {
        expect(document.activeElement).toBe(mockPasswordInput);
        expect(mockPasswordInput.selectionStart).toBe(5);
        expect(mockPasswordInput.selectionEnd).toBe(10);
        done();
      }, 20);
    });

    it('should not interfere with focus when password input is not focused', () => {
      mockButton.focus();
      
      const clickEvent = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent);
      
      expect(document.activeElement).toBe(mockButton);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing icon element gracefully', () => {
      mockButton.innerHTML = ''; // Remove icon
      
      expect(() => {
        initPasswordToggle();
        setupToggleListeners();
        const clickEvent = new MouseEvent('click', { bubbles: true });
        mockButton.dispatchEvent(clickEvent);
      }).not.toThrow();
      
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle null button or input parameters', () => {
      expect(() => {
        togglePasswordVisibility(null as any, mockPasswordInput);
      }).not.toThrow();
      
      expect(() => {
        togglePasswordVisibility(mockButton, null as any);
      }).not.toThrow();
      
      expect(console.error).toHaveBeenCalledTimes(2);
    });

    it('should handle initialization errors', () => {
      jest.spyOn(document, 'querySelectorAll').mockImplementation(() => {
        throw new Error('DOM query failed');
      });
      
      expect(() => {
        setupToggleListeners();
      }).not.toThrow();
      
      expect(console.error).toHaveBeenCalledWith('Failed to setup toggle listeners:', expect.any(Error));
    });
  });

  describe('Multiple Password Fields', () => {
    let secondButton: HTMLElement;
    let secondPasswordInput: HTMLInputElement;
    let secondIcon: HTMLElement;

    beforeEach(() => {
      // Create second password field
      secondPasswordInput = document.createElement('input');
      secondPasswordInput.type = 'password';
      secondPasswordInput.id = 'test-password-2';
      
      secondButton = document.createElement('button');
      secondButton.setAttribute('data-password-toggle', 'test-password-2');
      
      secondIcon = document.createElement('i');
      secondIcon.className = 'bi bi-eye';
      secondButton.appendChild(secondIcon);
      
      container.appendChild(secondPasswordInput);
      container.appendChild(secondButton);
      
      initPasswordToggle();
      setupToggleListeners();
    });

    // TC-AC-019: Toggle functionality works independently on login and signup pages
    it('should handle multiple password fields independently', () => {
      // Toggle first password field
      const clickEvent1 = new MouseEvent('click', { bubbles: true });
      mockButton.dispatchEvent(clickEvent1);
      
      expect(mockPasswordInput.type).toBe('text');
      expect(secondPasswordInput.type).toBe('password'); // Should remain hidden
      
      // Toggle second password field
      const clickEvent2 = new MouseEvent('click', { bubbles: true });
      secondButton.dispatchEvent(clickEvent2);
      
      expect(mockPasswordInput.type).toBe('text'); // Should remain visible
      expect(secondPasswordInput.type).toBe('text'); // Now visible
    });
  });

  describe('Event Listener Management', () => {
    it('should handle document ready state properly', () => {
      // Mock document.readyState
      Object.defineProperty(document, 'readyState', {
        value: 'loading',
        configurable: true
      });
      
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      
      initPasswordToggle();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', setupToggleListeners);
    });

    it('should setup listeners immediately when document is already loaded', () => {
      Object.defineProperty(document, 'readyState', {
        value: 'complete',
        configurable: true
      });
      
      const setupSpy = jest.spyOn(window, 'setupToggleListeners' as any);
      
      expect(() => initPasswordToggle()).not.toThrow();
    });

    it('should handle pageshow events for SPA navigation', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      initPasswordToggle();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('pageshow', setupToggleListeners);
    });
  });
});

// Helper function exports for testing
declare global {
  function initPasswordToggle(): void;
  function setupToggleListeners(): void;
  function togglePasswordVisibility(button: HTMLElement, passwordInput: HTMLInputElement): void;
  function handleToggleClick(event: Event, button: HTMLElement, passwordInput: HTMLInputElement): void;
  function handleToggleKeydown(event: KeyboardEvent, button: HTMLElement, passwordInput: HTMLInputElement): void;
}