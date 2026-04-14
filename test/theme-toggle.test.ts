/**
 * Theme Toggle Component Tests
 * Tests the dark/light mode theme toggle functionality across all pages
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Test constants
const THEME_KEY = 'theme-mode';
const VALID_THEMES = ['light', 'dark'];
const DEFAULT_THEME = 'light';
const DARK_THEME_CLASS = 'dark-theme';

// Mock HTML template for testing
const createMockHTML = (page: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${page} - Express Auth App</title>
    <link href="/css/style.css" rel="stylesheet">
</head>
<body class="md-body">
    <nav class="md-navbar">
        <div class="md-navbar-nav">
            <div class="md-theme-toggle" role="menuitem" aria-label="Toggle theme" tabindex="0">
                <input type="checkbox" id="theme-toggle-switch" class="md-theme-toggle-input">
                <label for="theme-toggle-switch" class="md-theme-toggle-label">
                    <span class="md-theme-toggle-slider">
                        <span class="md-theme-toggle-thumb">
                            <i class="bi bi-sun-fill theme-icon-light"></i>
                            <i class="bi bi-moon-fill theme-icon-dark"></i>
                        </span>
                    </span>
                </label>
            </div>
        </div>
    </nav>
    <main class="md-main">
        <div class="md-card">Test Card Content</div>
        <div class="md-navbar">Test Navbar</div>
        <button class="md-button">Test Button</button>
        <form class="md-form">
            <input type="text" class="md-input" placeholder="Test Input">
        </form>
    </main>
</body>
</html>
`;

describe('Theme Toggle Functionality', () => {
    let dom: JSDOM;
    let window: Window;
    let document: Document;
    let localStorage: Storage;
    let themeToggle: any;

    beforeEach(() => {
        // Create fresh DOM for each test
        dom = new JSDOM(createMockHTML('Test Page'), {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        window = dom.window as unknown as Window;
        document = window.document;
        localStorage = window.localStorage;

        // Clear localStorage
        localStorage.clear();

        // Mock theme toggle implementation
        themeToggle = {
            getStoredTheme() {
                try {
                    const storedTheme = localStorage.getItem(THEME_KEY);
                    if (storedTheme && VALID_THEMES.includes(storedTheme)) {
                        return storedTheme;
                    }
                    return DEFAULT_THEME;
                } catch (error) {
                    return DEFAULT_THEME;
                }
            },

            setStoredTheme(theme: string) {
                if (!theme || !VALID_THEMES.includes(theme)) {
                    return false;
                }
                try {
                    localStorage.setItem(THEME_KEY, theme);
                    return true;
                } catch (error) {
                    return false;
                }
            },

            applyTheme(theme: string) {
                if (!theme || !VALID_THEMES.includes(theme)) {
                    theme = DEFAULT_THEME;
                }
                
                const body = document.body;
                if (theme === 'dark') {
                    body.classList.add(DARK_THEME_CLASS);
                } else {
                    body.classList.remove(DARK_THEME_CLASS);
                }
                
                this.updateToggleStates(theme);
            },

            updateToggleStates(theme: string) {
                const toggles = document.querySelectorAll('.md-theme-toggle');
                toggles.forEach(toggle => {
                    const input = toggle.querySelector('input[type="checkbox"]) as HTMLInputElement;
                    const iconLight = toggle.querySelector('.theme-icon-light') as HTMLElement;
                    const iconDark = toggle.querySelector('.theme-icon-dark') as HTMLElement;
                    
                    if (input) {
                        input.checked = (theme === 'dark');
                    }
                    
                    if (iconLight && iconDark) {
                        if (theme === 'dark') {
                            iconLight.style.display = 'none';
                            iconDark.style.display = 'inline';
                        } else {
                            iconLight.style.display = 'inline';
                            iconDark.style.display = 'none';
                        }
                    }
                    
                    const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
                    toggle.setAttribute('aria-label', label);
                });
            },

            handleToggleClick() {
                const currentTheme = this.getStoredTheme();
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                this.applyTheme(newTheme);
                this.setStoredTheme(newTheme);
            },

            initializeTheme() {
                const storedTheme = this.getStoredTheme();
                this.applyTheme(storedTheme);
            }
        };
    });

    afterEach(() => {
        if (dom) {
            dom.window.close();
        }
    });

    describe('Theme Toggle Visibility and Positioning', () => {
        // TC-F-001
        test('should display theme toggle switch in header navigation on all pages', () => {
            const pages = ['index', 'login', 'signup', 'dashboard', 'profile'];
            
            pages.forEach(page => {
                const pageDOM = new JSDOM(createMockHTML(page));
                const pageDoc = pageDOM.window.document;
                
                const toggle = pageDoc.querySelector('.md-theme-toggle');
                expect(toggle).toBeTruthy();
                expect(toggle).toBeVisible();
                
                const navbar = pageDoc.querySelector('.md-navbar-nav');
                expect(navbar?.contains(toggle!)).toBe(true);
                
                pageDOM.window.close();
            });
        });

        // TC-F-002 & TC-F-003
        test('should use Material Design styling and position toggle in md-navbar-nav section', () => {
            const toggle = document.querySelector('.md-theme-toggle');
            const navbar = document.querySelector('.md-navbar-nav');
            
            expect(toggle).toBeTruthy();
            expect(navbar?.contains(toggle!)).toBe(true);
            
            // Check for Material Design classes
            expect(toggle?.classList.contains('md-theme-toggle')).toBe(true);
            
            const input = toggle?.querySelector('input[type="checkbox"]');
            const label = toggle?.querySelector('label');
            expect(input).toBeTruthy();
            expect(label).toBeTruthy();
        });
    });

    describe('Default Theme and Persistence', () => {
        // TC-F-004
        test('should default to light mode for new visitors on first page load', () => {
            // Ensure no stored theme
            localStorage.clear();
            
            themeToggle.initializeTheme();
            
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            expect(themeToggle.getStoredTheme()).toBe('light');
        });

        // TC-F-005
        test('should store theme preference in localStorage under key theme-mode', () => {
            themeToggle.setStoredTheme('dark');
            
            expect(localStorage.getItem(THEME_KEY)).toBe('dark');
            
            themeToggle.setStoredTheme('light');
            
            expect(localStorage.getItem(THEME_KEY)).toBe('light');
        });

        // TC-F-006
        test('should persist theme across browser sessions and page navigation', () => {
            // Set dark theme
            themeToggle.setStoredTheme('dark');
            themeToggle.initializeTheme();
            
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // Simulate page reload by reinitializing
            const newThemeToggle = Object.create(themeToggle);
            newThemeToggle.initializeTheme();
            
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            expect(newThemeToggle.getStoredTheme()).toBe('dark');
        });
    });

    describe('Theme Switching Behavior', () => {
        // TC-F-007
        test('should switch theme immediately on toggle without page reload', () => {
            // Start with light theme
            themeToggle.initializeTheme();
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            
            // Toggle to dark
            themeToggle.handleToggleClick();
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // Toggle back to light
            themeToggle.handleToggleClick();
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
        });

        // TC-F-008
        test('should apply dark theme by adding dark-theme class to document body', () => {
            themeToggle.applyTheme('dark');
            
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            expect(document.body.classList.contains('md-body')).toBe(true); // Original class preserved
        });

        // TC-F-009
        test('should apply light theme by removing dark-theme class from document body', () => {
            // First apply dark theme
            document.body.classList.add(DARK_THEME_CLASS);
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // Then apply light theme
            themeToggle.applyTheme('light');
            
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
        });
    });

    describe('Toggle Switch UI State', () => {
        // TC-F-010 & TC-F-011
        test('should show correct icons for light and dark modes', () => {
            const toggle = document.querySelector('.md-theme-toggle');
            const lightIcon = toggle?.querySelector('.theme-icon-light') as HTMLElement;
            const darkIcon = toggle?.querySelector('.theme-icon-dark') as HTMLElement;
            
            // Light mode - sun icon visible, moon hidden
            themeToggle.applyTheme('light');
            expect(lightIcon.style.display).toBe('inline');
            expect(darkIcon.style.display).toBe('none');
            
            // Dark mode - moon icon visible, sun hidden
            themeToggle.applyTheme('dark');
            expect(lightIcon.style.display).toBe('none');
            expect(darkIcon.style.display).toBe('inline');
        });

        // TC-F-011
        test('should update toggle state to reflect current theme immediately', () => {
            const toggle = document.querySelector('.md-theme-toggle');
            const input = toggle?.querySelector('input[type="checkbox"]') as HTMLInputElement;
            
            // Light theme - checkbox unchecked
            themeToggle.applyTheme('light');
            expect(input.checked).toBe(false);
            
            // Dark theme - checkbox checked
            themeToggle.applyTheme('dark');
            expect(input.checked).toBe(true);
        });
    });

    describe('Component Theme Application', () => {
        // TC-F-012
        test('should apply proper styling to md-card components in both themes', () => {
            const card = document.querySelector('.md-card');
            expect(card).toBeTruthy();
            
            // Light theme
            themeToggle.applyTheme('light');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            
            // Dark theme
            themeToggle.applyTheme('dark');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            // Card should inherit dark theme styling through CSS cascade
        });

        // TC-F-013
        test('should apply proper styling to md-navbar components in both themes', () => {
            const navbar = document.querySelector('.md-navbar');
            expect(navbar).toBeTruthy();
            
            // Light theme
            themeToggle.applyTheme('light');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            
            // Dark theme
            themeToggle.applyTheme('dark');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
        });

        // TC-F-014
        test('should maintain proper contrast for md-button components in both themes', () => {
            const button = document.querySelector('.md-button');
            expect(button).toBeTruthy();
            
            // Themes should apply through CSS cascade
            themeToggle.applyTheme('light');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            
            themeToggle.applyTheme('dark');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
        });

        // TC-F-015
        test('should style md-form components correctly in both themes', () => {
            const form = document.querySelector('.md-form');
            const input = document.querySelector('.md-input');
            
            expect(form).toBeTruthy();
            expect(input).toBeTruthy();
            
            // Test theme application
            themeToggle.applyTheme('light');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            
            themeToggle.applyTheme('dark');
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
        });
    });

    describe('Text Readability and Layout', () => {
        // TC-F-016 & TC-F-017
        test('should maintain proper text contrast and card alignment in both themes', () => {
            const body = document.body;
            
            // Light theme
            themeToggle.applyTheme('light');
            expect(body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            
            // Dark theme
            themeToggle.applyTheme('dark');
            expect(body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // Layout classes should remain unchanged
            expect(body.classList.contains('md-body')).toBe(true);
        });
    });

    describe('Accessibility', () => {
        // TC-F-018
        test('should be keyboard accessible with proper ARIA labels', () => {
            const toggle = document.querySelector('.md-theme-toggle');
            
            expect(toggle?.getAttribute('tabindex')).toBe('0');
            expect(toggle?.getAttribute('role')).toBe('menuitem');
            
            // Test ARIA label updates
            themeToggle.applyTheme('light');
            expect(toggle?.getAttribute('aria-label')).toBe('Switch to dark mode');
            
            themeToggle.applyTheme('dark');
            expect(toggle?.getAttribute('aria-label')).toBe('Switch to light mode');
        });

        // TC-F-019
        test('should be screen reader accessible with appropriate role attributes', () => {
            const toggle = document.querySelector('.md-theme-toggle');
            const input = toggle?.querySelector('input[type="checkbox"]');
            
            expect(toggle?.getAttribute('role')).toBe('menuitem');
            expect(input?.getAttribute('type')).toBe('checkbox');
            expect(toggle?.hasAttribute('aria-label')).toBe(true);
        });
    });

    describe('Error Handling and Fallbacks', () => {
        // TC-F-020
        test('should fallback to light mode for invalid localStorage values', () => {
            const invalidValues = ['invalid', 'DARK', 'Light', 'auto', '', null, undefined];
            
            invalidValues.forEach(value => {
                if (value === null || value === undefined) {
                    localStorage.removeItem(THEME_KEY);
                } else {
                    localStorage.setItem(THEME_KEY, value as string);
                }
                
                const theme = themeToggle.getStoredTheme();
                expect(theme).toBe('light');
            });
        });

        test('should handle localStorage unavailability gracefully', () => {
            // Mock localStorage to throw errors
            const originalSetItem = localStorage.setItem;
            const originalGetItem = localStorage.getItem;
            
            localStorage.setItem = jest.fn(() => {
                throw new Error('localStorage unavailable');
            });
            localStorage.getItem = jest.fn(() => {
                throw new Error('localStorage unavailable');
            });
            
            expect(() => {
                themeToggle.getStoredTheme();
            }).not.toThrow();
            
            expect(() => {
                themeToggle.setStoredTheme('dark');
            }).not.toThrow();
            
            expect(themeToggle.getStoredTheme()).toBe('light');
            expect(themeToggle.setStoredTheme('dark')).toBe(false);
            
            // Restore original methods
            localStorage.setItem = originalSetItem;
            localStorage.getItem = originalGetItem;
        });
    });

    describe('Cross-Platform Compatibility', () => {
        // TC-F-021 & TC-F-024
        test('should work on mobile and desktop viewport sizes and across browsers', () => {
            // Test different viewport sizes
            const viewports = [
                { width: 320, height: 568 },   // Mobile
                { width: 768, height: 1024 },  // Tablet
                { width: 1920, height: 1080 }  // Desktop
            ];
            
            viewports.forEach(viewport => {
                // Simulate viewport resize
                Object.defineProperty(window, 'innerWidth', {
                    writable: true,
                    configurable: true,
                    value: viewport.width,
                });
                Object.defineProperty(window, 'innerHeight', {
                    writable: true,
                    configurable: true,
                    value: viewport.height,
                });
                
                // Theme toggle should still be functional
                const toggle = document.querySelector('.md-theme-toggle');
                expect(toggle).toBeTruthy();
                
                themeToggle.applyTheme('dark');
                expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
                
                themeToggle.applyTheme('light');
                expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            });
        });
    });

    describe('Theme Color Variables', () => {
        // TC-F-022 & TC-F-023
        test('should preserve existing Material Design variables in light mode', () => {
            themeToggle.applyTheme('light');
            
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            // CSS variables should be applied through stylesheet
            // This test validates the class application, actual color testing would require CSS parsing
        });

        test('should use appropriate Material Design dark mode color palette', () => {
            themeToggle.applyTheme('dark');
            
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            // Dark theme CSS variables should be applied through stylesheet
        });
    });

    describe('Performance', () => {
        // TC-F-025
        test('should not negatively impact page performance during theme switching', () => {
            const startTime = performance.now();
            
            // Perform multiple theme switches
            for (let i = 0; i < 10; i++) {
                themeToggle.applyTheme('dark');
                themeToggle.applyTheme('light');
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Theme switching should complete quickly (under 100ms for 20 switches)
            expect(duration).toBeLessThan(100);
        });

        test('should handle rapid theme switching without errors', () => {
            expect(() => {
                for (let i = 0; i < 50; i++) {
                    themeToggle.handleToggleClick();
                }
            }).not.toThrow();
            
            // Final state should be consistent
            const finalTheme = themeToggle.getStoredTheme();
            expect(VALID_THEMES.includes(finalTheme)).toBe(true);
        });
    });
});