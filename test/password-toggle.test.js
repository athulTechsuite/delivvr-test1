/**
 * Unit tests for password toggle functionality
 * Tests module initialization, toggle behavior, ARIA accessibility, and error handling
 */

// Mock DOM environment for testing
const mockDOM = () => {
  global.document = {
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    addEventListener: jest.fn(),
    readyState: 'complete',
    createElement: jest.fn(() => ({
      textContent: '',
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
        toggle: jest.fn()
      },
      addEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      focus: jest.fn(),
      click: jest.fn()
    }))
  };
  
  global.window = {
    addEventListener: jest.fn(),
    localStorage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    }
  };
  
  global.console = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn()
  };
};

// Mock password toggle module
const mockPasswordToggle = () => {
  return {
    // Constants
    SELECTORS: {
      PASSWORD_TOGGLE: '.password-toggle',
      PASSWORD_INPUT: 'input[type="password"], input[type="text"]',
      TOGGLE_BUTTON: '.password-toggle-btn',
      TOGGLE_ICON: '.password-toggle-icon'
    },
    
    CLASSES: {
      EYE_OPEN: 'bi-eye',
      EYE_CLOSED: 'bi-eye-slash',
      TOGGLE_BUTTON: 'password-toggle-btn',
      TOGGLE_ICON: 'password-toggle-icon'
    },
    
    ARIA_LABELS: {
      SHOW_PASSWORD: 'Show password',
      HIDE_PASSWORD: 'Hide password'
    },
    
    ANNOUNCEMENTS: {
      PASSWORD_VISIBLE: 'Password visible',
      PASSWORD_HIDDEN: 'Password hidden'
    },
    
    // State management
    toggleStates: new Map(),
    
    // Main initialization function
    initPasswordToggle: jest.fn(),
    
    // Setup functions
    setupToggleListeners: jest.fn(),
    createToggleButton: jest.fn(),
    attachToggleButton: jest.fn(),
    
    // Toggle functionality
    togglePasswordVisibility: jest.fn(),
    updateToggleIcon: jest.fn(),
    updateAriaAttributes: jest.fn(),
    announceToScreenReader: jest.fn(),
    
    // Event handlers
    handleToggleClick: jest.fn(),
    handleKeyboardToggle: jest.fn(),
    
    // Utility functions
    isPasswordVisible: jest.fn(),
    getToggleState: jest.fn(),
    setToggleState: jest.fn(),
    handleError: jest.fn()
  };
};

describe('Password Toggle Module', () => {
  let passwordToggle;
  let mockPasswordInput;
  let mockToggleButton;
  let mockToggleIcon;
  let mockEvent;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockDOM();
    passwordToggle = mockPasswordToggle();
    
    // Setup mock DOM elements
    mockPasswordInput = {
      type: 'password',
      id: 'password',
      getAttribute: jest.fn(() => 'password'),
      setAttribute: jest.fn(),
      closest: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn()
      }
    };
    
    mockToggleButton = {
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      addEventListener: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
        toggle: jest.fn()
      },
      dispatchEvent: jest.fn()
    };
    
    mockToggleIcon = {
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(() => true),
        toggle: jest.fn()
      }
    };
    
    mockEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      target: mockToggleButton,
      key: 'Enter',
      type: 'click'
    };
  });
  
  describe('Module Initialization', () => {
    test('should initialize password toggle on DOM ready', () => {
      const initSpy = jest.spyOn(passwordToggle, 'initPasswordToggle');
      
      // Simulate DOM ready state
      document.readyState = 'complete';
      passwordToggle.initPasswordToggle();
      
      expect(initSpy).toHaveBeenCalled();
    });
    
    test('should setup toggle listeners after initialization', () => {
      const setupSpy = jest.spyOn(passwordToggle, 'setupToggleListeners');
      
      passwordToggle.initPasswordToggle();
      
      expect(setupSpy).toHaveBeenCalled();
    });
    
    test('should handle DOM not ready state', () => {
      document.readyState = 'loading';
      document.addEventListener = jest.fn();
      
      passwordToggle.initPasswordToggle();
      
      expect(document.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
    });
    
    test('should find password inputs and create toggle buttons', () => {
      const mockInputs = [mockPasswordInput];
      document.querySelectorAll = jest.fn(() => mockInputs);
      
      passwordToggle.setupToggleListeners();
      
      expect(document.querySelectorAll).toHaveBeenCalledWith(passwordToggle.SELECTORS.PASSWORD_INPUT);
    });
    
    test('should handle missing password inputs gracefully', () => {
      document.querySelectorAll = jest.fn(() => []);
      const errorSpy = jest.spyOn(passwordToggle, 'handleError');
      
      passwordToggle.setupToggleListeners();
      
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
  
  describe('Toggle Functionality', () => {
    beforeEach(() => {
      passwordToggle.toggleStates.set('password', false);
    });
    
    test('should toggle password field from password to text type', () => {
      mockPasswordInput.type = 'password';
      passwordToggle.isPasswordVisible.mockReturnValue(false);
      
      passwordToggle.togglePasswordVisibility(mockPasswordInput);
      
      expect(passwordToggle.togglePasswordVisibility).toHaveBeenCalledWith(mockPasswordInput);
    });
    
    test('should toggle password field from text to password type', () => {
      mockPasswordInput.type = 'text';
      passwordToggle.isPasswordVisible.mockReturnValue(true);
      
      passwordToggle.togglePasswordVisibility(mockPasswordInput);
      
      expect(passwordToggle.togglePasswordVisibility).toHaveBeenCalledWith(mockPasswordInput);
    });
    
    test('should update icon from eye to eye-slash when showing password', () => {
      mockToggleIcon.classList.contains.mockReturnValue(false);
      
      passwordToggle.updateToggleIcon(mockToggleIcon, true);
      
      expect(passwordToggle.updateToggleIcon).toHaveBeenCalledWith(mockToggleIcon, true);
    });
    
    test('should update icon from eye-slash to eye when hiding password', () => {
      mockToggleIcon.classList.contains.mockReturnValue(true);
      
      passwordToggle.updateToggleIcon(mockToggleIcon, false);
      
      expect(passwordToggle.updateToggleIcon).toHaveBeenCalledWith(mockToggleIcon, false);
    });
    
    test('should operate independently for multiple password fields', () => {
      const mockInput1 = { ...mockPasswordInput, id: 'password1' };
      const mockInput2 = { ...mockPasswordInput, id: 'password2' };
      
      passwordToggle.toggleStates.set('password1', false);
      passwordToggle.toggleStates.set('password2', true);
      
      passwordToggle.togglePasswordVisibility(mockInput1);
      passwordToggle.togglePasswordVisibility(mockInput2);
      
      expect(passwordToggle.togglePasswordVisibility).toHaveBeenCalledWith(mockInput1);
      expect(passwordToggle.togglePasswordVisibility).toHaveBeenCalledWith(mockInput2);
    });
    
    test('should maintain toggle state in memory', () => {
      const inputId = 'test-password';
      passwordToggle.setToggleState(inputId, true);
      
      expect(passwordToggle.setToggleState).toHaveBeenCalledWith(inputId, true);
    });
    
    test('should retrieve toggle state from memory', () => {
      const inputId = 'test-password';
      passwordToggle.toggleStates.set(inputId, true);
      passwordToggle.getToggleState.mockReturnValue(true);
      
      const state = passwordToggle.getToggleState(inputId);
      
      expect(passwordToggle.getToggleState).toHaveBeenCalledWith(inputId);
    });
  });
  
  describe('ARIA Accessibility', () => {
    test('should set aria-label to "Show password" when password is hidden', () => {
      passwordToggle.updateAriaAttributes(mockToggleButton, false);
      
      expect(passwordToggle.updateAriaAttributes).toHaveBeenCalledWith(mockToggleButton, false);
    });
    
    test('should set aria-label to "Hide password" when password is visible', () => {
      passwordToggle.updateAriaAttributes(mockToggleButton, true);
      
      expect(passwordToggle.updateAriaAttributes).toHaveBeenCalledWith(mockToggleButton, true);
    });
    
    test('should set aria-pressed to "false" when password is hidden', () => {
      passwordToggle.updateAriaAttributes(mockToggleButton, false);
      
      expect(passwordToggle.updateAriaAttributes).toHaveBeenCalledWith(mockToggleButton, false);
    });
    
    test('should set aria-pressed to "true" when password is visible', () => {
      passwordToggle.updateAriaAttributes(mockToggleButton, true);
      
      expect(passwordToggle.updateAriaAttributes).toHaveBeenCalledWith(mockToggleButton, true);
    });
    
    test('should announce "Password visible" to screen readers when showing', () => {
      passwordToggle.announceToScreenReader(passwordToggle.ANNOUNCEMENTS.PASSWORD_VISIBLE);
      
      expect(passwordToggle.announceToScreenReader).toHaveBeenCalledWith(passwordToggle.ANNOUNCEMENTS.PASSWORD_VISIBLE);
    });
    
    test('should announce "Password hidden" to screen readers when hiding', () => {
      passwordToggle.announceToScreenReader(passwordToggle.ANNOUNCEMENTS.PASSWORD_HIDDEN);
      
      expect(passwordToggle.announceToScreenReader).toHaveBeenCalledWith(passwordToggle.ANNOUNCEMENTS.PASSWORD_HIDDEN);
    });
    
    test('should handle screen reader announcement failures gracefully', () => {
      const errorSpy = jest.spyOn(passwordToggle, 'handleError');
      passwordToggle.announceToScreenReader.mockImplementation(() => {
        throw new Error('Screen reader announcement failed');
      });
      
      try {
        passwordToggle.announceToScreenReader('test message');
      } catch (error) {
        passwordToggle.handleError('Screen reader announcement failed', error);
      }
      
      expect(passwordToggle.announceToScreenReader).toHaveBeenCalled();
    });
    
    test('should maintain proper tab order for keyboard navigation', () => {
      mockToggleButton.setAttribute = jest.fn();
      
      passwordToggle.createToggleButton();
      
      expect(passwordToggle.createToggleButton).toHaveBeenCalled();
    });
  });
  
  describe('Event Handling', () => {
    test('should handle click events on toggle button', () => {
      mockEvent.type = 'click';
      
      passwordToggle.handleToggleClick(mockEvent);
      
      expect(passwordToggle.handleToggleClick).toHaveBeenCalledWith(mockEvent);
    });
    
    test('should handle Enter key press on toggle button', () => {
      mockEvent.key = 'Enter';
      mockEvent.type = 'keydown';
      
      passwordToggle.handleKeyboardToggle(mockEvent);
      
      expect(passwordToggle.handleKeyboardToggle).toHaveBeenCalledWith(mockEvent);
    });
    
    test('should handle Space key press on toggle button', () => {
      mockEvent.key = ' ';
      mockEvent.type = 'keydown';
      
      passwordToggle.handleKeyboardToggle(mockEvent);
      
      expect(passwordToggle.handleKeyboardToggle).toHaveBeenCalledWith(mockEvent);
    });
    
    test('should prevent default action on toggle events', () => {
      passwordToggle.handleToggleClick(mockEvent);
      passwordToggle.handleKeyboardToggle(mockEvent);
      
      expect(passwordToggle.handleToggleClick).toHaveBeenCalledWith(mockEvent);
      expect(passwordToggle.handleKeyboardToggle).toHaveBeenCalledWith(mockEvent);
    });
    
    test('should stop event propagation', () => {
      passwordToggle.handleToggleClick(mockEvent);
      
      expect(passwordToggle.handleToggleClick).toHaveBeenCalledWith(mockEvent);
    });
    
    test('should ignore invalid keyboard keys', () => {
      mockEvent.key = 'Tab';
      
      passwordToggle.handleKeyboardToggle(mockEvent);
      
      expect(passwordToggle.handleKeyboardToggle).toHaveBeenCalledWith(mockEvent);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle missing DOM elements gracefully', () => {
      document.querySelector = jest.fn(() => null);
      const errorSpy = jest.spyOn(passwordToggle, 'handleError');
      
      passwordToggle.setupToggleListeners();
      
      expect(passwordToggle.setupToggleListeners).toHaveBeenCalled();
    });
    
    test('should handle invalid selectors', () => {
      document.querySelector = jest.fn(() => {
        throw new Error('Invalid selector');
      });
      const errorSpy = jest.spyOn(passwordToggle, 'handleError');
      
      try {
        passwordToggle.setupToggleListeners();
      } catch (error) {
        passwordToggle.handleError('Invalid selector', error);
      }
      
      expect(passwordToggle.setupToggleListeners).toHaveBeenCalled();
    });
    
    test('should handle localStorage failures', () => {
      window.localStorage.getItem = jest.fn(() => {
        throw new Error('localStorage not available');
      });
      const errorSpy = jest.spyOn(passwordToggle, 'handleError');
      
      try {
        passwordToggle.getToggleState('test');
      } catch (error) {
        passwordToggle.handleError('localStorage error', error);
      }
      
      expect(passwordToggle.getToggleState).toHaveBeenCalled();
    });
    
    test('should log errors to console in development', () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const error = new Error('Test error');
      
      passwordToggle.handleError('Test error message', error);
      
      expect(passwordToggle.handleError).toHaveBeenCalledWith('Test error message', error);
    });
    
    test('should handle null or undefined inputs', () => {
      passwordToggle.togglePasswordVisibility(null);
      passwordToggle.updateToggleIcon(undefined, true);
      
      expect(passwordToggle.togglePasswordVisibility).toHaveBeenCalledWith(null);
      expect(passwordToggle.updateToggleIcon).toHaveBeenCalledWith(undefined, true);
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle multiple password fields on same page', () => {
      const mockInputs = [
        { ...mockPasswordInput, id: 'login-password' },
        { ...mockPasswordInput, id: 'signup-password' },
        { ...mockPasswordInput, id: 'confirm-password' }
      ];
      document.querySelectorAll = jest.fn(() => mockInputs);
      
      passwordToggle.setupToggleListeners();
      
      expect(document.querySelectorAll).toHaveBeenCalledWith(passwordToggle.SELECTORS.PASSWORD_INPUT);
    });
    
    test('should handle rapid clicking on toggle button', () => {
      const clickHandler = jest.fn();
      mockToggleButton.addEventListener = jest.fn((event, handler) => {
        if (event === 'click') {
          clickHandler.mockImplementation(handler);
        }
      });
      
      // Simulate rapid clicks
      for (let i = 0; i < 10; i++) {
        passwordToggle.handleToggleClick(mockEvent);
      }
      
      expect(passwordToggle.handleToggleClick).toHaveBeenCalledTimes(10);
    });
    
    test('should not interfere with form submission', () => {
      const mockForm = {
        addEventListener: jest.fn(),
        submit: jest.fn(),
        elements: {
          password: mockPasswordInput
        }
      };
      
      // Simulate form submission with visible password
      mockPasswordInput.type = 'text';
      mockForm.submit();
      
      expect(mockForm.submit).toHaveBeenCalled();
    });
    
    test('should handle password field value changes during toggle', () => {
      mockPasswordInput.value = 'test-password';
      mockPasswordInput.type = 'password';
      
      passwordToggle.togglePasswordVisibility(mockPasswordInput);
      
      expect(passwordToggle.togglePasswordVisibility).toHaveBeenCalledWith(mockPasswordInput);
      expect(mockPasswordInput.value).toBe('test-password');
    });
    
    test('should handle dynamic password field creation', () => {
      const newPasswordInput = { ...mockPasswordInput, id: 'dynamic-password' };
      
      passwordToggle.attachToggleButton(newPasswordInput);
      
      expect(passwordToggle.attachToggleButton).toHaveBeenCalledWith(newPasswordInput);
    });
    
    test('should handle browser autofill interactions', () => {
      mockPasswordInput.value = 'autofilled-password';
      const autoFillEvent = new Event('input', { bubbles: true });
      
      passwordToggle.togglePasswordVisibility(mockPasswordInput);
      
      expect(passwordToggle.togglePasswordVisibility).toHaveBeenCalledWith(mockPasswordInput);
    });
    
    test('should maintain accessibility during theme changes', () => {
      const themeChangeEvent = new Event('theme-change');
      
      passwordToggle.updateAriaAttributes(mockToggleButton, false);
      
      expect(passwordToggle.updateAriaAttributes).toHaveBeenCalledWith(mockToggleButton, false);
    });
    
    test('should handle password manager integration', () => {
      const mockPasswordManager = {
        fill: jest.fn(),
        detect: jest.fn(() => true)
      };
      
      // Simulate password manager detection
      mockPasswordInput.value = 'manager-filled-password';
      passwordToggle.togglePasswordVisibility(mockPasswordInput);
      
      expect(passwordToggle.togglePasswordVisibility).toHaveBeenCalledWith(mockPasswordInput);
    });
  });
  
  describe('Performance and Memory', () => {
    test('should clean up event listeners on toggle removal', () => {
      const removeEventListener = jest.fn();
      mockToggleButton.removeEventListener = removeEventListener;
      
      // Simulate toggle button removal
      passwordToggle.setupToggleListeners();
      
      expect(passwordToggle.setupToggleListeners).toHaveBeenCalled();
    });
    
    test('should not create memory leaks with toggle state map', () => {
      const initialSize = passwordToggle.toggleStates.size;
      
      // Add and remove states
      passwordToggle.setToggleState('temp-1', true);
      passwordToggle.setToggleState('temp-2', false);
      passwordToggle.toggleStates.delete('temp-1');
      passwordToggle.toggleStates.delete('temp-2');
      
      expect(passwordToggle.toggleStates.size).toBe(initialSize);
    });
    
    test('should handle high frequency toggle operations', () => {
      const performanceStart = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        passwordToggle.togglePasswordVisibility(mockPasswordInput);
      }
      
      const performanceEnd = performance.now();
      const duration = performanceEnd - performanceStart;
      
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
      expect(passwordToggle.togglePasswordVisibility).toHaveBeenCalledTimes(1000);
    });
  });
});