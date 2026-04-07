/**
 * Theme Toggle Test Suite
 * Tests for dark/light mode theme switching functionality
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Mock localStorage for testing
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

describe('Theme Toggle Functionality', () => {
  let dom;
  let document;
  let window;
  let ThemeToggle;

  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();

    // Create a new JSDOM instance with HTML structure
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Test</title>
      </head>
      <body>
        <nav class="navbar">
          <div class="navbar-nav">
            <label class="theme-toggle">
              <input type="checkbox" id="theme-toggle-checkbox">
              <span class="theme-toggle-slider"></span>
            </label>
          </div>
        </nav>
        <div class="card">Test Card</div>
        <form class="form">
          <input type="text" class="form-control" placeholder="Test Input">
        </form>
      </body>
      </html>
    `;

    dom = new JSDOM(htmlContent, { 
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    document = dom.window.document;
    window = dom.window;
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    });

    // Set global document and window for the ThemeToggle class
    global.document = document;
    global.window = window;
    global.localStorage = localStorageMock;

    // Load ThemeToggle class
    const themeToggleCode = fs.readFileSync(
      path.join(__dirname, '../public/js/theme-toggle.js'), 
      'utf8'
    );
    eval(themeToggleCode);
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('AC1: Theme toggle switch visibility in header', () => {
    test('should display theme toggle switch in header navigation', () => {
      const themeToggle = document.querySelector('.theme-toggle');
      const navbar = document.querySelector('.navbar');
      
      expect(themeToggle).toBeTruthy();
      expect(navbar.contains(themeToggle)).toBe(true);
      
      const toggleInput = themeToggle.querySelector('input[type="checkbox"]');
      const toggleSlider = themeToggle.querySelector('.theme-toggle-slider');
      
      expect(toggleInput).toBeTruthy();
      expect(toggleSlider).toBeTruthy();
    });

    test('should have proper toggle switch structure', () => {
      const themeToggle = document.querySelector('.theme-toggle');
      const toggleInput = themeToggle.querySelector('#theme-toggle-checkbox');
      
      expect(toggleInput.type).toBe('checkbox');
      expect(themeToggle.querySelector('.theme-toggle-slider')).toBeTruthy();
    });
  });

  describe('AC2: Default to light mode for new users', () => {
    test('should default to light mode when no stored preference exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const themeToggleInstance = new ThemeToggle();
      
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.classList.contains('light-theme')).toBe(true);
      expect(document.body.classList.contains('light-theme')).toBe(true);
    });

    test('should not check the toggle switch by default', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const themeToggleInstance = new ThemeToggle();
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      
      expect(toggleInput.checked).toBe(false);
    });
  });

  describe('AC3: Switch from light to dark mode', () => {
    test('should switch to dark mode when toggle is clicked in light mode', () => {
      localStorageMock.getItem.mockReturnValue('light');
      
      const themeToggleInstance = new ThemeToggle();
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      
      // Simulate click on toggle
      toggleInput.click();
      
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
      expect(document.body.classList.contains('dark-theme')).toBe(true);
      expect(toggleInput.checked).toBe(true);
    });

    test('should update all UI elements with dark mode styles', () => {
      localStorageMock.getItem.mockReturnValue('light');
      
      const themeToggleInstance = new ThemeToggle();
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      
      toggleInput.click();
      
      // Check that data-theme attribute is set for CSS targeting
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      
      // Verify CSS custom properties can be applied
      const computedStyle = window.getComputedStyle(document.documentElement);
      expect(document.documentElement.hasAttribute('data-theme')).toBe(true);
    });

    test('should switch back to light mode when toggled again', () => {
      localStorageMock.getItem.mockReturnValue('light');
      
      const themeToggleInstance = new ThemeToggle();
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      
      // Switch to dark
      toggleInput.click();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      
      // Switch back to light
      toggleInput.click();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(toggleInput.checked).toBe(false);
    });
  });

  describe('AC4: Theme persistence across pages and sessions', () => {
    test('should save dark mode preference to localStorage', () => {
      localStorageMock.getItem.mockReturnValue('light');
      
      const themeToggleInstance = new ThemeToggle();
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      
      toggleInput.click();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('app-theme', 'dark');
    });

    test('should save light mode preference to localStorage', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      
      const themeToggleInstance = new ThemeToggle();
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      
      toggleInput.click();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('app-theme', 'light');
    });

    test('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });
      
      const themeToggleInstance = new ThemeToggle();
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      
      // Should not throw error when localStorage fails
      expect(() => toggleInput.click()).not.toThrow();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('AC5: Load saved dark mode preference', () => {
    test('should load dark mode when stored preference is dark', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      
      const themeToggleInstance = new ThemeToggle();
      
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
      expect(document.body.classList.contains('dark-theme')).toBe(true);
      
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      expect(toggleInput.checked).toBe(true);
    });

    test('should load light mode when stored preference is light', () => {
      localStorageMock.getItem.mockReturnValue('light');
      
      const themeToggleInstance = new ThemeToggle();
      
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.classList.contains('light-theme')).toBe(true);
      
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      expect(toggleInput.checked).toBe(false);
    });

    test('should handle invalid stored theme values', () => {
      localStorageMock.getItem.mockReturnValue('invalid-theme');
      
      const themeToggleInstance = new ThemeToggle();
      
      // Should default to light mode for invalid values
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('AC6: Dark mode applied to all components', () => {
    test('should apply dark theme data attribute to document root', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      
      const themeToggleInstance = new ThemeToggle();
      
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
    });

    test('should dispatch theme change event for component updates', (done) => {
      localStorageMock.getItem.mockReturnValue('light');
      
      const themeToggleInstance = new ThemeToggle();
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      
      // Listen for custom theme change event
      document.addEventListener('themeChanged', (event) => {
        expect(event.detail.theme).toBe('dark');
        expect(event.detail.previousTheme).toBe('light');
        done();
      });
      
      toggleInput.click();
    });

    test('should remove previous theme classes when switching', () => {
      localStorageMock.getItem.mockReturnValue('light');
      
      const themeToggleInstance = new ThemeToggle();
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      
      // Initially light theme
      expect(document.documentElement.classList.contains('light-theme')).toBe(true);
      expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
      
      // Switch to dark
      toggleInput.click();
      expect(document.documentElement.classList.contains('light-theme')).toBe(false);
      expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
      
      // Switch back to light
      toggleInput.click();
      expect(document.documentElement.classList.contains('light-theme')).toBe(true);
      expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
    });
  });

  describe('Theme Toggle Integration', () => {
    test('should initialize properly without errors', () => {
      expect(() => new ThemeToggle()).not.toThrow();
    });

    test('should handle missing toggle button gracefully', () => {
      // Remove toggle button from DOM
      const toggle = document.querySelector('.theme-toggle');
      if (toggle) toggle.remove();
      
      expect(() => new ThemeToggle()).not.toThrow();
    });

    test('should maintain theme state consistency', () => {
      localStorageMock.getItem.mockReturnValue('dark');
      
      const themeToggleInstance = new ThemeToggle();
      
      expect(themeToggleInstance.currentTheme).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      
      const toggleInput = document.querySelector('#theme-toggle-checkbox');
      expect(toggleInput.checked).toBe(true);
    });
  });
});