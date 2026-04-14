const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Constants for testing
const THEME_STORAGE_KEY = 'theme-mode';
const VALID_THEMES = ['light', 'dark'];
const DEFAULT_THEME = 'light';
const DARK_THEME_CLASS = 'dark-theme';
const TOGGLE_SWITCH_ID = 'theme-toggle-switch';
const TOGGLE_BUTTON_ID = 'theme-toggle-button';

describe('Theme Toggle Functionality', () => {
    let dom;
    let window;
    let document;
    let localStorage;
    let themeToggleScript;

    beforeEach(() => {
        // Create a new JSDOM instance for each test
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Page</title>
            </head>
            <body>
                <nav class="md-navbar">
                    <div class="md-navbar-nav">
                        <div class="md-theme-toggle">
                            <label class="md-switch" for="${TOGGLE_SWITCH_ID}">
                                <input type="checkbox" id="${TOGGLE_SWITCH_ID}" aria-label="Toggle dark mode">
                                <span class="md-slider">
                                    <button id="${TOGGLE_BUTTON_ID}" type="button" aria-label="Toggle theme">
                                        <span class="theme-icon light-icon">☀️</span>
                                        <span class="theme-icon dark-icon">🌙</span>
                                    </button>
                                </span>
                            </label>
                        </div>
                    </div>
                </nav>
                <div class="md-card">Test Card</div>
                <button class="md-button">Test Button</button>
            </body>
            </html>
        `, {
            url: 'http://localhost',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;
        localStorage = window.localStorage;

        // Clear localStorage before each test
        localStorage.clear();

        // Mock theme toggle script functionality
        themeToggleScript = {
            init: function() {
                this.bindEvents();
                this.loadThemeFromStorage();
            },

            bindEvents: function() {
                const toggleSwitch = document.getElementById(TOGGLE_SWITCH_ID);
                const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);

                if (toggleSwitch) {
                    toggleSwitch.addEventListener('change', this.handleToggleChange.bind(this));
                }

                if (toggleButton) {
                    toggleButton.addEventListener('click', this.handleButtonClick.bind(this));
                    toggleButton.addEventListener('keydown', this.handleKeydown.bind(this));
                }
            },

            handleToggleChange: function(event) {
                const isDarkMode = event.target.checked;
                const theme = isDarkMode ? 'dark' : 'light';
                this.applyTheme(theme);
            },

            handleButtonClick: function(event) {
                event.preventDefault();
                const toggleSwitch = document.getElementById(TOGGLE_SWITCH_ID);
                if (toggleSwitch) {
                    toggleSwitch.checked = !toggleSwitch.checked;
                    const theme = toggleSwitch.checked ? 'dark' : 'light';
                    this.applyTheme(theme);
                }
            },

            handleKeydown: function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleButtonClick(event);
                }
            },

            loadThemeFromStorage: function() {
                try {
                    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
                    const theme = this.validateTheme(savedTheme) ? savedTheme : DEFAULT_THEME;
                    this.applyTheme(theme);
                } catch (error) {
                    console.warn('Failed to load theme from storage:', error);
                    this.applyTheme(DEFAULT_THEME);
                }
            },

            validateTheme: function(theme) {
                return typeof theme === 'string' && VALID_THEMES.includes(theme);
            },

            applyTheme: function(theme) {
                if (!this.validateTheme(theme)) {
                    console.warn('Invalid theme provided:', theme);
                    theme = DEFAULT_THEME;
                }

                try {
                    // Update DOM
                    const body = document.body;
                    const toggleSwitch = document.getElementById(TOGGLE_SWITCH_ID);
                    const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);

                    if (theme === 'dark') {
                        body.classList.add(DARK_THEME_CLASS);
                        if (toggleSwitch) toggleSwitch.checked = true;
                    } else {
                        body.classList.remove(DARK_THEME_CLASS);
                        if (toggleSwitch) toggleSwitch.checked = false;
                    }

                    // Update ARIA attributes
                    if (toggleButton) {
                        toggleButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
                    }

                    if (toggleSwitch) {
                        toggleSwitch.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
                    }

                    // Save to localStorage
                    this.saveThemeToStorage(theme);

                } catch (error) {
                    console.error('Failed to apply theme:', error);
                }
            },

            saveThemeToStorage: function(theme) {
                try {
                    localStorage.setItem(THEME_STORAGE_KEY, theme);
                } catch (error) {
                    console.warn('Failed to save theme to storage:', error);
                }
            },

            getCurrentTheme: function() {
                return document.body.classList.contains(DARK_THEME_CLASS) ? 'dark' : 'light';
            }
        };

        // Initialize the theme toggle
        themeToggleScript.init();
    });

    afterEach(() => {
        if (dom) {
            dom.window.close();
        }
    });

    describe('Theme Initialization', () => {
        test('should default to light mode on first visit', () => {
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            expect(themeToggleScript.getCurrentTheme()).toBe('light');
        });

        test('should load theme from localStorage if valid', () => {
            localStorage.setItem(THEME_STORAGE_KEY, 'dark');
            themeToggleScript.loadThemeFromStorage();
            
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');
        });

        test('should fallback to light mode for invalid localStorage values', () => {
            const invalidValues = ['invalid', 'darkmode', 'DARK', '', null, undefined, 123, {}, []];
            
            invalidValues.forEach(value => {
                localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(value));
                themeToggleScript.loadThemeFromStorage();
                
                expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
                expect(themeToggleScript.getCurrentTheme()).toBe('light');
            });
        });

        test('should handle localStorage unavailability gracefully', () => {
            // Mock localStorage to throw an error
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = jest.fn(() => {
                throw new Error('localStorage unavailable');
            });

            expect(() => {
                themeToggleScript.loadThemeFromStorage();
            }).not.toThrow();

            expect(themeToggleScript.getCurrentTheme()).toBe('light');

            // Restore original method
            localStorage.getItem = originalGetItem;
        });

        test('should handle malformed JSON in localStorage', () => {
            // Set invalid JSON directly to storage
            Object.defineProperty(localStorage, THEME_STORAGE_KEY, {
                value: '{invalid json}',
                writable: true
            });

            expect(() => {
                themeToggleScript.loadThemeFromStorage();
            }).not.toThrow();

            expect(themeToggleScript.getCurrentTheme()).toBe('light');
        });
    });

    describe('Theme Switching', () => {
        test('should toggle from light to dark mode', () => {
            themeToggleScript.applyTheme('light');
            expect(themeToggleScript.getCurrentTheme()).toBe('light');

            themeToggleScript.applyTheme('dark');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');
        });

        test('should toggle from dark to light mode', () => {
            themeToggleScript.applyTheme('dark');
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');

            themeToggleScript.applyTheme('light');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            expect(themeToggleScript.getCurrentTheme()).toBe('light');
        });

        test('should persist theme changes to localStorage', () => {
            themeToggleScript.applyTheme('dark');
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

            themeToggleScript.applyTheme('light');
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
        });

        test('should update toggle switch state when theme changes', () => {
            const toggleSwitch = document.getElementById(TOGGLE_SWITCH_ID);

            themeToggleScript.applyTheme('dark');
            expect(toggleSwitch.checked).toBe(true);
            expect(toggleSwitch.getAttribute('aria-checked')).toBe('true');

            themeToggleScript.applyTheme('light');
            expect(toggleSwitch.checked).toBe(false);
            expect(toggleSwitch.getAttribute('aria-checked')).toBe('false');
        });

        test('should handle rapid theme switching', (done) => {
            let switchCount = 0;
            const totalSwitches = 10;

            const rapidSwitch = () => {
                const currentTheme = themeToggleScript.getCurrentTheme();
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                themeToggleScript.applyTheme(newTheme);
                switchCount++;

                if (switchCount < totalSwitches) {
                    setTimeout(rapidSwitch, 10);
                } else {
                    // Verify final state is consistent
                    const finalTheme = themeToggleScript.getCurrentTheme();
                    const expectedClass = finalTheme === 'dark';
                    expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(expectedClass);
                    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(finalTheme);
                    done();
                }
            };

            rapidSwitch();
        });
    });

    describe('LocalStorage Interaction', () => {
        test('should handle localStorage quota exceeded error', () => {
            // Mock localStorage to throw quota exceeded error
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = jest.fn(() => {
                const error = new Error('QuotaExceededError');
                error.name = 'QuotaExceededError';
                throw error;
            });

            expect(() => {
                themeToggleScript.saveThemeToStorage('dark');
            }).not.toThrow();

            // Restore original method
            localStorage.setItem = originalSetItem;
        });

        test('should handle localStorage disabled in private browsing', () => {
            // Mock localStorage to be null (private browsing scenario)
            Object.defineProperty(window, 'localStorage', {
                value: null,
                writable: true
            });

            expect(() => {
                themeToggleScript.loadThemeFromStorage();
            }).not.toThrow();

            expect(themeToggleScript.getCurrentTheme()).toBe('light');
        });

        test('should validate theme values before storage', () => {
            const invalidThemes = ['invalid', '', null, undefined, 123, {}, []];
            
            invalidThemes.forEach(theme => {
                themeToggleScript.applyTheme(theme);
                expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(DEFAULT_THEME);
            });
        });

        test('should handle storage corruption gracefully', () => {
            // Simulate corrupted storage by overriding getItem
            const originalGetItem = localStorage.getItem;
            localStorage.getItem = jest.fn(() => {
                throw new Error('Storage corruption');
            });

            themeToggleScript.loadThemeFromStorage();
            expect(themeToggleScript.getCurrentTheme()).toBe('light');

            // Restore original method
            localStorage.getItem = originalGetItem;
        });
    });

    describe('DOM Manipulation', () => {
        test('should apply dark-theme class to body element', () => {
            themeToggleScript.applyTheme('dark');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
        });

        test('should remove dark-theme class from body element', () => {
            document.body.classList.add(DARK_THEME_CLASS);
            themeToggleScript.applyTheme('light');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
        });

        test('should handle missing DOM elements gracefully', () => {
            // Remove toggle elements
            const toggleSwitch = document.getElementById(TOGGLE_SWITCH_ID);
            const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);
            
            if (toggleSwitch) toggleSwitch.remove();
            if (toggleButton) toggleButton.remove();

            expect(() => {
                themeToggleScript.applyTheme('dark');
            }).not.toThrow();

            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
        });

        test('should preserve existing body classes when applying theme', () => {
            document.body.classList.add('existing-class', 'another-class');
            
            themeToggleScript.applyTheme('dark');
            expect(document.body.classList.contains('existing-class')).toBe(true);
            expect(document.body.classList.contains('another-class')).toBe(true);
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);

            themeToggleScript.applyTheme('light');
            expect(document.body.classList.contains('existing-class')).toBe(true);
            expect(document.body.classList.contains('another-class')).toBe(true);
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
        });
    });

    describe('Input Validation', () => {
        test('should validate theme parameter types', () => {
            expect(themeToggleScript.validateTheme('light')).toBe(true);
            expect(themeToggleScript.validateTheme('dark')).toBe(true);
            expect(themeToggleScript.validateTheme('invalid')).toBe(false);
            expect(themeToggleScript.validateTheme(null)).toBe(false);
            expect(themeToggleScript.validateTheme(undefined)).toBe(false);
            expect(themeToggleScript.validateTheme(123)).toBe(false);
            expect(themeToggleScript.validateTheme({})).toBe(false);
            expect(themeToggleScript.validateTheme([])).toBe(false);
        });

        test('should sanitize invalid theme inputs', () => {
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                'javascript:void(0)',
                'dark"; DROP TABLE themes; --',
                '\n\r\t   dark   \n\r\t'
            ];

            maliciousInputs.forEach(input => {
                themeToggleScript.applyTheme(input);
                expect(themeToggleScript.getCurrentTheme()).toBe('light');
            });
        });

        test('should handle case sensitivity correctly', () => {
            const caseSensitiveInputs = ['DARK', 'Dark', 'LIGHT', 'Light', 'dArK', 'lIgHt'];
            
            caseSensitiveInputs.forEach(input => {
                themeToggleScript.applyTheme(input);
                expect(themeToggleScript.getCurrentTheme()).toBe('light');
            });
        });
    });

    describe('Toggle UI Interaction', () => {
        test('should handle toggle switch change events', () => {
            const toggleSwitch = document.getElementById(TOGGLE_SWITCH_ID);
            
            toggleSwitch.checked = true;
            toggleSwitch.dispatchEvent(new window.Event('change'));
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');

            toggleSwitch.checked = false;
            toggleSwitch.dispatchEvent(new window.Event('change'));
            expect(themeToggleScript.getCurrentTheme()).toBe('light');
        });

        test('should handle toggle button click events', () => {
            const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);
            
            // Start in light mode
            expect(themeToggleScript.getCurrentTheme()).toBe('light');

            // Click to switch to dark
            toggleButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');

            // Click to switch back to light
            toggleButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
            expect(themeToggleScript.getCurrentTheme()).toBe('light');
        });

        test('should handle keyboard navigation with Enter key', () => {
            const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);
            
            expect(themeToggleScript.getCurrentTheme()).toBe('light');

            const enterEvent = new window.KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true
            });
            
            toggleButton.dispatchEvent(enterEvent);
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');
        });

        test('should handle keyboard navigation with Space key', () => {
            const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);
            
            expect(themeToggleScript.getCurrentTheme()).toBe('light');

            const spaceEvent = new window.KeyboardEvent('keydown', {
                key: ' ',
                bubbles: true
            });
            
            toggleButton.dispatchEvent(spaceEvent);
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');
        });

        test('should ignore non-activating keyboard keys', () => {
            const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);
            const initialTheme = themeToggleScript.getCurrentTheme();

            const ignoredKeys = ['Tab', 'Shift', 'Alt', 'Control', 'Escape', 'ArrowUp', 'ArrowDown'];
            
            ignoredKeys.forEach(key => {
                const keyEvent = new window.KeyboardEvent('keydown', {
                    key: key,
                    bubbles: true
                });
                
                toggleButton.dispatchEvent(keyEvent);
                expect(themeToggleScript.getCurrentTheme()).toBe(initialTheme);
            });
        });
    });

    describe('Accessibility Features', () => {
        test('should have proper ARIA labels on toggle elements', () => {
            const toggleSwitch = document.getElementById(TOGGLE_SWITCH_ID);
            const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);

            expect(toggleSwitch.getAttribute('aria-label')).toBe('Toggle dark mode');
            expect(toggleButton.getAttribute('aria-label')).toContain('Toggle theme');
        });

        test('should update ARIA attributes when theme changes', () => {
            const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);
            const toggleSwitch = document.getElementById(TOGGLE_SWITCH_ID);

            themeToggleScript.applyTheme('dark');
            expect(toggleButton.getAttribute('aria-label')).toBe('Switch to light theme');
            expect(toggleSwitch.getAttribute('aria-checked')).toBe('true');

            themeToggleScript.applyTheme('light');
            expect(toggleButton.getAttribute('aria-label')).toBe('Switch to dark theme');
            expect(toggleSwitch.getAttribute('aria-checked')).toBe('false');
        });

        test('should maintain focus after theme switching', () => {
            const toggleButton = document.getElementById(TOGGLE_BUTTON_ID);
            toggleButton.focus();

            expect(document.activeElement).toBe(toggleButton);

            themeToggleScript.applyTheme('dark');
            expect(document.activeElement).toBe(toggleButton);
        });

        test('should have proper role attributes for screen readers', () => {
            const toggleSwitch = document.getElementById(TOGGLE_SWITCH_ID);
            
            // Checkbox input should have implicit role
            expect(toggleSwitch.type).toBe('checkbox');
        });
    });

    describe('Error Handling', () => {
        test('should handle DOM manipulation errors gracefully', () => {
            // Mock classList.add to throw an error
            const originalAdd = document.body.classList.add;
            document.body.classList.add = jest.fn(() => {
                throw new Error('DOM manipulation failed');
            });

            expect(() => {
                themeToggleScript.applyTheme('dark');
            }).not.toThrow();

            // Restore original method
            document.body.classList.add = originalAdd;
        });

        test('should handle event binding errors', () => {
            // Remove toggle elements to cause binding errors
            document.getElementById(TOGGLE_SWITCH_ID).remove();
            document.getElementById(TOGGLE_BUTTON_ID).remove();

            expect(() => {
                themeToggleScript.bindEvents();
            }).not.toThrow();
        });

        test('should provide meaningful error context', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            themeToggleScript.applyTheme('invalid-theme');
            expect(consoleSpy).toHaveBeenCalledWith('Invalid theme provided:', 'invalid-theme');

            consoleSpy.mockRestore();
        });

        test('should handle concurrent theme switching', (done) => {
            let completedOperations = 0;
            const totalOperations = 5;

            const performConcurrentSwitch = (theme) => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        themeToggleScript.applyTheme(theme);
                        resolve(theme);
                    }, Math.random() * 50);
                });
            };

            const promises = [
                performConcurrentSwitch('dark'),
                performConcurrentSwitch('light'),
                performConcurrentSwitch('dark'),
                performConcurrentSwitch('light'),
                performConcurrentSwitch('dark')
            ];

            Promise.all(promises).then(() => {
                // Verify final state is consistent
                const finalTheme = themeToggleScript.getCurrentTheme();
                const hasClass = document.body.classList.contains(DARK_THEME_CLASS);
                const expectedClass = finalTheme === 'dark';
                
                expect(hasClass).toBe(expectedClass);
                expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(finalTheme);
                done();
            });
        });
    });

    describe('Performance', () => {
        test('should complete theme switching within reasonable time', () => {
            const startTime = performance.now();
            
            for (let i = 0; i < 100; i++) {
                themeToggleScript.applyTheme(i % 2 === 0 ? 'light' : 'dark');
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Should complete 100 theme switches in less than 100ms
            expect(duration).toBeLessThan(100);
        });

        test('should not cause memory leaks with repeated theme switching', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Perform many theme switches
            for (let i = 0; i < 1000; i++) {
                themeToggleScript.applyTheme(i % 2 === 0 ? 'light' : 'dark');
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be minimal (less than 1MB)
            expect(memoryIncrease).toBeLessThan(1024 * 1024);
        });
    });

    describe('Integration', () => {
        test('should work with existing navbar functionality', () => {
            const navbar = document.querySelector('.md-navbar');
            expect(navbar).toBeTruthy();

            const themeToggle = document.querySelector('.md-theme-toggle');
            expect(themeToggle).toBeTruthy();
            expect(navbar.contains(themeToggle)).toBe(true);
        });

        test('should not interfere with other page elements', () => {
            const card = document.querySelector('.md-card');
            const button = document.querySelector('.md-button');

            const originalCardText = card.textContent;
            const originalButtonText = button.textContent;

            themeToggleScript.applyTheme('dark');
            expect(card.textContent).toBe(originalCardText);
            expect(button.textContent).toBe(originalButtonText);

            themeToggleScript.applyTheme('light');
            expect(card.textContent).toBe(originalCardText);
            expect(button.textContent).toBe(originalButtonText);
        });

        test('should maintain theme consistency across DOM manipulations', () => {
            themeToggleScript.applyTheme('dark');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);

            // Simulate dynamic content addition
            const newElement = document.createElement('div');
            newElement.className = 'md-card new-card';
            newElement.textContent = 'New Card';
            document.body.appendChild(newElement);

            // Theme should still be applied
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');
        });
    });

    describe('Edge Cases', () => {
        test('should handle page reload scenarios', () => {
            themeToggleScript.applyTheme('dark');
            expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

            // Simulate page reload by reinitializing
            themeToggleScript.init();
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
        });

        test('should handle browser back/forward navigation', () => {
            themeToggleScript.applyTheme('dark');
            
            // Simulate navigation away and back
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            expect(savedTheme).toBe('dark');

            // Clear DOM state (simulate new page load)
            document.body.classList.remove(DARK_THEME_CLASS);
            
            // Reload theme from storage
            themeToggleScript.loadThemeFromStorage();
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');
        });

        test('should handle multiple theme toggle instances', () => {
            // Create a second toggle instance
            const secondToggle = Object.create(themeToggleScript);
            secondToggle.init();

            themeToggleScript.applyTheme('dark');
            expect(secondToggle.getCurrentTheme()).toBe('dark');

            secondToggle.applyTheme('light');
            expect(themeToggleScript.getCurrentTheme()).toBe('light');
        });

        test('should handle storage events from other tabs', () => {
            themeToggleScript.applyTheme('light');
            
            // Simulate storage change from another tab
            localStorage.setItem(THEME_STORAGE_KEY, 'dark');
            
            // Reload theme from updated storage
            themeToggleScript.loadThemeFromStorage();
            expect(themeToggleScript.getCurrentTheme()).toBe('dark');
        });
    });
});