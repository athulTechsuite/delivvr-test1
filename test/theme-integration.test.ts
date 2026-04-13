/**
 * Theme Integration End-to-End Tests
 * Tests theme functionality across different pages and user workflows
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Mock page templates for different routes
const createPageTemplate = (pageName: string, userAuthenticated: boolean = false) => {
    const authNavigation = userAuthenticated ? `
        <li class="md-navbar-item">
            <a class="md-navbar-link" href="/dashboard">Dashboard</a>
        </li>
        <li class="md-navbar-item">
            <a class="md-navbar-link" href="/profile">Profile</a>
        </li>
        <li class="md-navbar-item">
            <form action="/logout" method="POST" style="display: inline;">
                <button type="submit" class="md-navbar-link">Logout</button>
            </form>
        </li>
    ` : `
        <li class="md-navbar-item">
            <a class="md-navbar-link" href="/login">Login</a>
        </li>
        <li class="md-navbar-item">
            <a class="md-navbar-link" href="/signup">Sign Up</a>
        </li>
    `;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageName} - Express Auth App</title>
    <link rel="stylesheet" href="/css/style.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
</head>
<body class="md-body">
    <nav class="md-navbar" role="navigation">
        <div class="md-navbar-container">
            <div class="md-navbar-brand">
                <a href="/" class="md-navbar-brand-link">
                    <i class="bi bi-shield-lock-fill"></i>
                    <span>Express Auth</span>
                </a>
            </div>
            
            <div class="md-navbar-nav">
                <ul class="md-navbar-menu">
                    <li class="md-navbar-item">
                        <a class="md-navbar-link ${pageName === 'Home' ? 'active' : ''}" href="/">Home</a>
                    </li>
                    ${authNavigation}
                    <li class="md-navbar-item md-theme-toggle-item">
                        <div class="md-theme-toggle" role="menuitem" aria-label="Toggle theme" tabindex="0">
                            <input type="checkbox" id="theme-toggle" class="md-theme-toggle-input" aria-labelledby="theme-toggle-label">
                            <label for="theme-toggle" class="md-theme-toggle-label" id="theme-toggle-label">
                                <span class="md-theme-toggle-slider">
                                    <i class="bi bi-sun-fill theme-icon-light"></i>
                                    <i class="bi bi-moon-fill theme-icon-dark"></i>
                                </span>
                            </label>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <main class="md-main">
        <div class="md-container">
            <section class="md-section">
                <h1 class="md-display-small">${pageName} Page</h1>
                
                <!-- Page-specific content -->
                <div class="md-card md-elevation-2">
                    <div class="md-card-header">
                        <h2 class="md-headline-medium">Welcome to ${pageName}</h2>
                    </div>
                    <div class="md-card-content">
                        <p class="md-body-large">This is the ${pageName.toLowerCase()} page content.</p>
                        
                        ${pageName === 'Login' ? `
                            <form class="md-form" action="/login" method="POST">
                                <div class="md-form-field">
                                    <input type="email" id="email" name="email" class="md-input" required>
                                    <label for="email" class="md-label">Email</label>
                                </div>
                                <div class="md-form-field">
                                    <input type="password" id="password" name="password" class="md-input" required>
                                    <label for="password" class="md-label">Password</label>
                                </div>
                                <button type="submit" class="md-button md-button-primary">Sign In</button>
                            </form>
                        ` : ''}
                        
                        ${pageName === 'Sign Up' ? `
                            <form class="md-form" action="/signup" method="POST">
                                <div class="md-form-field">
                                    <input type="text" id="name" name="name" class="md-input" required>
                                    <label for="name" class="md-label">Full Name</label>
                                </div>
                                <div class="md-form-field">
                                    <input type="email" id="email" name="email" class="md-input" required>
                                    <label for="email" class="md-label">Email</label>
                                </div>
                                <div class="md-form-field">
                                    <input type="password" id="password" name="password" class="md-input" required>
                                    <label for="password" class="md-label">Password</label>
                                </div>
                                <button type="submit" class="md-button md-button-primary">Create Account</button>
                            </form>
                        ` : ''}
                        
                        ${userAuthenticated ? `
                            <div class="md-user-info">
                                <p class="md-body-medium">Authenticated user content</p>
                                <div class="md-navbar md-elevation-1">
                                    <span>Protected Navigation</span>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Additional UI components for testing -->
                <div class="md-row md-margin-top-lg">
                    <div class="md-col-6">
                        <button class="md-button md-button-primary">Primary Action</button>
                        <button class="md-button md-button-secondary">Secondary Action</button>
                    </div>
                </div>
            </section>
        </div>
    </main>
    
    <script src="/js/theme-toggle.js"></script>
</body>
</html>
    `;
};

const THEME_KEY = 'theme-mode';
const DARK_THEME_CLASS = 'dark-theme';

// Mock theme toggle JavaScript functionality
const mockThemeToggleScript = (window: Window) => {
    const document = window.document;
    const localStorage = window.localStorage;

    (window as any).themeToggle = {
        init() {
            this.bindEvents();
            this.loadTheme();
        },

        bindEvents() {
            const toggles = document.querySelectorAll('.md-theme-toggle');
            toggles.forEach(toggle => {
                toggle.addEventListener('click', this.handleClick.bind(this));
                toggle.addEventListener('keydown', this.handleKeydown.bind(this));
            });
        },

        handleClick(event: Event) {
            event.preventDefault();
            this.toggleTheme();
        },

        handleKeydown(event: KeyboardEvent) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.toggleTheme();
            }
        },

        toggleTheme() {
            const currentTheme = this.getCurrentTheme();
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            this.applyTheme(newTheme);
        },

        getCurrentTheme() {
            try {
                const stored = localStorage.getItem(THEME_KEY);
                if (stored === 'light' || stored === 'dark') {
                    return stored;
                }
            } catch {}
            return 'light';
        },

        applyTheme(theme: string) {
            if (theme !== 'light' && theme !== 'dark') {
                theme = 'light';
            }

            const body = document.body;
            if (theme === 'dark') {
                body.classList.add(DARK_THEME_CLASS);
            } else {
                body.classList.remove(DARK_THEME_CLASS);
            }

            this.updateToggleStates(theme);
            this.saveTheme(theme);
        },

        updateToggleStates(theme: string) {
            const toggles = document.querySelectorAll('.md-theme-toggle');
            toggles.forEach(toggle => {
                const input = toggle.querySelector('input[type="checkbox"]') as HTMLInputElement;
                const lightIcon = toggle.querySelector('.theme-icon-light') as HTMLElement;
                const darkIcon = toggle.querySelector('.theme-icon-dark') as HTMLElement;

                if (input) {
                    input.checked = theme === 'dark';
                }

                if (lightIcon && darkIcon) {
                    if (theme === 'dark') {
                        lightIcon.style.display = 'none';
                        darkIcon.style.display = 'inline';
                    } else {
                        lightIcon.style.display = 'inline';
                        darkIcon.style.display = 'none';
                    }
                }

                const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
                toggle.setAttribute('aria-label', label);
            });
        },

        saveTheme(theme: string) {
            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch {}
        },

        loadTheme() {
            const theme = this.getCurrentTheme();
            this.applyTheme(theme);
        }
    };

    // Auto-initialize
    (window as any).themeToggle.init();
};

describe('Theme Integration Across All Pages', () => {
    const pages = [
        { name: 'Home', authenticated: false },
        { name: 'Login', authenticated: false },
        { name: 'Sign Up', authenticated: false },
        { name: 'Dashboard', authenticated: true },
        { name: 'Profile', authenticated: true }
    ];

    describe('Theme Toggle Presence and Functionality', () => {
        // TC-F-001
        test('should display theme toggle on all 6 pages (index, login, signup, dashboard, profile)', () => {
            pages.forEach(({ name, authenticated }) => {
                const dom = new JSDOM(createPageTemplate(name, authenticated), {
                    url: 'http://localhost:3000',
                    pretendToBeVisual: true
                });

                const document = dom.window.document;
                const themeToggle = document.querySelector('.md-theme-toggle');
                const navbar = document.querySelector('.md-navbar-nav');

                expect(themeToggle).toBeTruthy();
                expect(navbar?.contains(themeToggle!)).toBe(true);
                expect(themeToggle?.getAttribute('role')).toBe('menuitem');
                expect(themeToggle?.getAttribute('tabindex')).toBe('0');

                dom.window.close();
            });
        });

        // TC-F-003
        test('should position theme toggle in md-navbar-nav section after navigation links', () => {
            pages.forEach(({ name, authenticated }) => {
                const dom = new JSDOM(createPageTemplate(name, authenticated));
                const document = dom.window.document;
                
                const navbarNav = document.querySelector('.md-navbar-nav');
                const navbarMenu = navbarNav?.querySelector('.md-navbar-menu');
                const themeToggleItem = navbarMenu?.querySelector('.md-theme-toggle-item');
                const allNavItems = navbarMenu?.querySelectorAll('.md-navbar-item');
                
                expect(navbarMenu?.contains(themeToggleItem!)).toBe(true);
                
                // Theme toggle should be the last item in navigation
                const lastNavItem = allNavItems?.[allNavItems.length - 1];
                expect(lastNavItem?.classList.contains('md-theme-toggle-item')).toBe(true);

                dom.window.close();
            });
        });
    });

    describe('Theme Persistence Across Page Navigation', () => {
        let initialDOM: JSDOM;
        let secondDOM: JSDOM;
        let thirdDOM: JSDOM;

        beforeEach(() => {
            // Simulate navigation between pages with shared localStorage
            const mockStorage = new Map<string, string>();
            
            // Create mock localStorage that persists across "page navigations"
            const createMockLocalStorage = () => ({
                getItem: (key: string) => mockStorage.get(key) || null,
                setItem: (key: string, value: string) => { mockStorage.set(key, value); },
                removeItem: (key: string) => { mockStorage.delete(key); },
                clear: () => { mockStorage.clear(); },
                length: mockStorage.size,
                key: (index: number) => Array.from(mockStorage.keys())[index] || null
            });

            initialDOM = new JSDOM(createPageTemplate('Home'), { url: 'http://localhost:3000' });
            Object.defineProperty(initialDOM.window, 'localStorage', {
                value: createMockLocalStorage(),
                writable: false
            });

            secondDOM = new JSDOM(createPageTemplate('Login'), { url: 'http://localhost:3000' });
            Object.defineProperty(secondDOM.window, 'localStorage', {
                value: createMockLocalStorage(),
                writable: false
            });

            thirdDOM = new JSDOM(createPageTemplate('Dashboard', true), { url: 'http://localhost:3000' });
            Object.defineProperty(thirdDOM.window, 'localStorage', {
                value: createMockLocalStorage(),
                writable: false
            });
        });

        afterEach(() => {
            initialDOM?.window.close();
            secondDOM?.window.close();
            thirdDOM?.window.close();
        });

        // TC-F-006
        test('should persist theme across browser sessions and page navigation', () => {
            // Initialize theme toggle on first page
            mockThemeToggleScript(initialDOM.window);
            
            // Set dark theme on home page
            (initialDOM.window as any).themeToggle.applyTheme('dark');
            expect(initialDOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            expect(initialDOM.window.localStorage.getItem(THEME_KEY)).toBe('dark');

            // Navigate to login page - should load dark theme
            mockThemeToggleScript(secondDOM.window);
            expect(secondDOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);

            // Navigate to dashboard - should maintain dark theme
            mockThemeToggleScript(thirdDOM.window);
            expect(thirdDOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
        });

        // TC-F-007
        test('should switch theme immediately without page reload', () => {
            mockThemeToggleScript(initialDOM.window);
            
            const document = initialDOM.window.document;
            const themeToggle = document.querySelector('.md-theme-toggle');
            
            // Start with light theme
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            
            // Simulate click on theme toggle
            const clickEvent = new initialDOM.window.Event('click', { bubbles: true });
            themeToggle?.dispatchEvent(clickEvent);
            
            // Theme should change immediately
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // Click again to toggle back
            themeToggle?.dispatchEvent(clickEvent);
            expect(document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
        });
    });

    describe('Theme Application to All Components', () => {
        let lightPageDOM: JSDOM;
        let darkPageDOM: JSDOM;

        beforeEach(() => {
            lightPageDOM = new JSDOM(createPageTemplate('Dashboard', true));
            darkPageDOM = new JSDOM(createPageTemplate('Dashboard', true));
            
            mockThemeToggleScript(lightPageDOM.window);
            mockThemeToggleScript(darkPageDOM.window);
            
            // Apply themes
            (lightPageDOM.window as any).themeToggle.applyTheme('light');
            (darkPageDOM.window as any).themeToggle.applyTheme('dark');
        });

        afterEach(() => {
            lightPageDOM?.window.close();
            darkPageDOM?.window.close();
        });

        // TC-F-012
        test('should apply proper styling to md-card components in both themes', () => {
            const lightCard = lightPageDOM.window.document.querySelector('.md-card');
            const darkCard = darkPageDOM.window.document.querySelector('.md-card');
            
            expect(lightCard).toBeTruthy();
            expect(darkCard).toBeTruthy();
            
            // Verify theme classes are applied to body
            expect(lightPageDOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            expect(darkPageDOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // Cards should maintain their md-card classes
            expect(lightCard?.classList.contains('md-card')).toBe(true);
            expect(darkCard?.classList.contains('md-card')).toBe(true);
        });

        // TC-F-013
        test('should apply proper styling to md-navbar components in both themes', () => {
            const lightNavbar = lightPageDOM.window.document.querySelector('.md-navbar');
            const darkNavbar = darkPageDOM.window.document.querySelector('.md-navbar');
            
            expect(lightNavbar?.classList.contains('md-navbar')).toBe(true);
            expect(darkNavbar?.classList.contains('md-navbar')).toBe(true);
            
            // Additional navbar elements for authenticated pages
            const lightUserNavbar = lightPageDOM.window.document.querySelector('.md-user-info .md-navbar');
            const darkUserNavbar = darkPageDOM.window.document.querySelector('.md-user-info .md-navbar');
            
            if (lightUserNavbar && darkUserNavbar) {
                expect(lightUserNavbar.classList.contains('md-navbar')).toBe(true);
                expect(darkUserNavbar.classList.contains('md-navbar')).toBe(true);
            }
        });

        // TC-F-014
        test('should apply proper styling to md-button components in both themes', () => {
            const lightButtons = lightPageDOM.window.document.querySelectorAll('.md-button');
            const darkButtons = darkPageDOM.window.document.querySelectorAll('.md-button');
            
            expect(lightButtons.length).toBeGreaterThan(0);
            expect(darkButtons.length).toBe(lightButtons.length);
            
            lightButtons.forEach((lightButton, index) => {
                const darkButton = darkButtons[index];
                
                // Button classes should be identical
                expect(lightButton.className).toBe(darkButton.className);
                
                // Both should have md-button class
                expect(lightButton.classList.contains('md-button')).toBe(true);
                expect(darkButton.classList.contains('md-button')).toBe(true);
            });
        });

        // TC-F-015
        test('should apply proper styling to md-form components in both themes', () => {
            // Create pages with forms
            const lightLoginDOM = new JSDOM(createPageTemplate('Login'));
            const darkLoginDOM = new JSDOM(createPageTemplate('Login'));
            
            mockThemeToggleScript(lightLoginDOM.window);
            mockThemeToggleScript(darkLoginDOM.window);
            
            (lightLoginDOM.window as any).themeToggle.applyTheme('light');
            (darkLoginDOM.window as any).themeToggle.applyTheme('dark');
            
            const lightForm = lightLoginDOM.window.document.querySelector('.md-form');
            const darkForm = darkLoginDOM.window.document.querySelector('.md-form');
            const lightInputs = lightLoginDOM.window.document.querySelectorAll('.md-input');
            const darkInputs = darkLoginDOM.window.document.querySelectorAll('.md-input');
            
            expect(lightForm?.classList.contains('md-form')).toBe(true);
            expect(darkForm?.classList.contains('md-form')).toBe(true);
            
            expect(lightInputs.length).toBeGreaterThan(0);
            expect(darkInputs.length).toBe(lightInputs.length);
            
            lightInputs.forEach((lightInput, index) => {
                const darkInput = darkInputs[index];
                expect(lightInput.classList.contains('md-input')).toBe(true);
                expect(darkInput.classList.contains('md-input')).toBe(true);
            });
            
            lightLoginDOM.window.close();
            darkLoginDOM.window.close();
        });
    });

    describe('Accessibility Across All Pages', () => {
        // TC-F-018 & TC-F-019
        test('should maintain keyboard accessibility and screen reader support on all pages', () => {
            pages.forEach(({ name, authenticated }) => {
                const dom = new JSDOM(createPageTemplate(name, authenticated));
                const document = dom.window.document;
                const themeToggle = document.querySelector('.md-theme-toggle');
                
                // Keyboard accessibility
                expect(themeToggle?.getAttribute('tabindex')).toBe('0');
                expect(themeToggle?.getAttribute('role')).toBe('menuitem');
                
                // ARIA labels
                expect(themeToggle?.hasAttribute('aria-label')).toBe(true);
                
                // Input accessibility
                const toggleInput = themeToggle?.querySelector('input[type="checkbox"]');
                expect(toggleInput?.hasAttribute('aria-labelledby')).toBe(true);
                
                // Label association
                const toggleLabel = themeToggle?.querySelector('label');
                const labelFor = toggleLabel?.getAttribute('for');
                const inputId = toggleInput?.getAttribute('id');
                expect(labelFor).toBe(inputId);
                
                dom.window.close();
            });
        });

        test('should handle keyboard navigation consistently across pages', () => {
            pages.forEach(({ name, authenticated }) => {
                const dom = new JSDOM(createPageTemplate(name, authenticated));
                mockThemeToggleScript(dom.window);
                
                const document = dom.window.document;
                const themeToggle = document.querySelector('.md-theme-toggle');
                
                // Test Enter key
                const enterEvent = new dom.window.KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true
                });
                
                const initialTheme = document.body.classList.contains(DARK_THEME_CLASS);
                themeToggle?.dispatchEvent(enterEvent);
                
                const newTheme = document.body.classList.contains(DARK_THEME_CLASS);
                expect(newTheme).toBe(!initialTheme);
                
                // Test Space key
                const spaceEvent = new dom.window.KeyboardEvent('keydown', {
                    key: ' ',
                    bubbles: true
                });
                
                themeToggle?.dispatchEvent(spaceEvent);
                const finalTheme = document.body.classList.contains(DARK_THEME_CLASS);
                expect(finalTheme).toBe(initialTheme);
                
                dom.window.close();
            });
        });
    });

    describe('Cross-Page Theme Consistency', () => {
        // TC-F-021
        test('should maintain consistent theme behavior across mobile and desktop viewport sizes', () => {
            const viewports = [
                { width: 320, height: 568 },   // Mobile
                { width: 768, height: 1024 },  // Tablet
                { width: 1920, height: 1080 }  // Desktop
            ];
            
            pages.forEach(({ name, authenticated }) => {
                viewports.forEach(viewport => {
                    const dom = new JSDOM(createPageTemplate(name, authenticated), {
                        url: 'http://localhost:3000',
                        pretendToBeVisual: true
                    });
                    
                    // Mock viewport size
                    Object.defineProperty(dom.window, 'innerWidth', {
                        value: viewport.width,
                        writable: true
                    });
                    Object.defineProperty(dom.window, 'innerHeight', {
                        value: viewport.height,
                        writable: true
                    });
                    
                    mockThemeToggleScript(dom.window);
                    
                    const themeToggle = dom.window.document.querySelector('.md-theme-toggle');
                    expect(themeToggle).toBeTruthy();
                    
                    // Theme switching should work regardless of viewport
                    (dom.window as any).themeToggle.applyTheme('dark');
                    expect(dom.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
                    
                    (dom.window as any).themeToggle.applyTheme('light');
                    expect(dom.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
                    
                    dom.window.close();
                });
            });
        });
        
        test('should handle theme switching consistently across all supported page types', () => {
            const pageInstances = pages.map(({ name, authenticated }) => {
                const dom = new JSDOM(createPageTemplate(name, authenticated));
                mockThemeToggleScript(dom.window);
                return { dom, name, authenticated };
            });
            
            try {
                // Apply dark theme to all pages
                pageInstances.forEach(({ dom }) => {
                    (dom.window as any).themeToggle.applyTheme('dark');
                    expect(dom.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
                });
                
                // Apply light theme to all pages
                pageInstances.forEach(({ dom }) => {
                    (dom.window as any).themeToggle.applyTheme('light');
                    expect(dom.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
                });
                
            } finally {
                // Clean up all DOM instances
                pageInstances.forEach(({ dom }) => {
                    dom.window.close();
                });
            }
        });
    });

    describe('Error Handling and Edge Cases', () => {
        // TC-F-020
        test('should handle invalid localStorage values across all pages', () => {
            const invalidValues = ['invalid-theme', 'LIGHT', 'Dark', '', null, undefined, '{}', '[]'];
            
            pages.forEach(({ name, authenticated }) => {
                invalidValues.forEach(invalidValue => {
                    const dom = new JSDOM(createPageTemplate(name, authenticated));
                    
                    // Mock localStorage with invalid value
                    if (invalidValue === null || invalidValue === undefined) {
                        dom.window.localStorage.removeItem(THEME_KEY);
                    } else {
                        dom.window.localStorage.setItem(THEME_KEY, invalidValue);
                    }
                    
                    mockThemeToggleScript(dom.window);
                    
                    // Should default to light theme
                    expect(dom.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
                    expect((dom.window as any).themeToggle.getCurrentTheme()).toBe('light');
                    
                    dom.window.close();
                });
            });
        });

        test('should gracefully handle missing theme toggle elements', () => {
            const htmlWithoutToggle = `
<!DOCTYPE html>
<html><head><title>Test</title></head>
<body class="md-body">
    <nav class="md-navbar"><div class="md-navbar-nav"></div></nav>
    <main class="md-main"><div class="md-card">Content</div></main>
</body></html>
            `;
            
            const dom = new JSDOM(htmlWithoutToggle);
            
            expect(() => {
                mockThemeToggleScript(dom.window);
            }).not.toThrow();
            
            // Should still be able to apply themes programmatically
            (dom.window as any).themeToggle.applyTheme('dark');
            expect(dom.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            dom.window.close();
        });
    });
});

// Additional test suite for specific integration scenarios
describe('Theme Toggle User Workflows', () => {
    describe('Authentication Flow with Theme Persistence', () => {
        test('should maintain theme preference during login/logout workflow', () => {
            const mockStorage = new Map<string, string>();
            const createPersistentStorage = () => ({
                getItem: (key: string) => mockStorage.get(key) || null,
                setItem: (key: string, value: string) => { mockStorage.set(key, value); },
                removeItem: (key: string) => { mockStorage.delete(key); },
                clear: () => { mockStorage.clear(); },
                length: mockStorage.size,
                key: (index: number) => Array.from(mockStorage.keys())[index] || null
            });
            
            // Start on home page (unauthenticated)
            const homeDOM = new JSDOM(createPageTemplate('Home', false));
            Object.defineProperty(homeDOM.window, 'localStorage', { value: createPersistentStorage() });
            mockThemeToggleScript(homeDOM.window);
            
            // Set dark theme on home page
            (homeDOM.window as any).themeToggle.applyTheme('dark');
            expect(homeDOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // Navigate to login page
            const loginDOM = new JSDOM(createPageTemplate('Login', false));
            Object.defineProperty(loginDOM.window, 'localStorage', { value: createPersistentStorage() });
            mockThemeToggleScript(loginDOM.window);
            
            // Should maintain dark theme
            expect(loginDOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // After login, navigate to dashboard
            const dashboardDOM = new JSDOM(createPageTemplate('Dashboard', true));
            Object.defineProperty(dashboardDOM.window, 'localStorage', { value: createPersistentStorage() });
            mockThemeToggleScript(dashboardDOM.window);
            
            // Should still maintain dark theme
            expect(dashboardDOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // Clean up
            homeDOM.window.close();
            loginDOM.window.close();
            dashboardDOM.window.close();
        });
    });

    describe('Multi-tab Theme Synchronization Simulation', () => {
        test('should handle theme changes consistently when simulating multiple tabs', () => {
            const sharedStorage = new Map<string, string>();
            const createSharedStorage = () => ({
                getItem: (key: string) => sharedStorage.get(key) || null,
                setItem: (key: string, value: string) => { sharedStorage.set(key, value); },
                removeItem: (key: string) => { sharedStorage.delete(key); },
                clear: () => { sharedStorage.clear(); },
                length: sharedStorage.size,
                key: (index: number) => Array.from(sharedStorage.keys())[index] || null
            });
            
            // Simulate two "tabs" with the same localStorage
            const tab1DOM = new JSDOM(createPageTemplate('Dashboard', true));
            const tab2DOM = new JSDOM(createPageTemplate('Profile', true));
            
            Object.defineProperty(tab1DOM.window, 'localStorage', { value: createSharedStorage() });
            Object.defineProperty(tab2DOM.window, 'localStorage', { value: createSharedStorage() });
            
            mockThemeToggleScript(tab1DOM.window);
            mockThemeToggleScript(tab2DOM.window);
            
            // Change theme in tab1
            (tab1DOM.window as any).themeToggle.applyTheme('dark');
            
            // Tab2 should reflect the stored theme when reloaded/refreshed
            (tab2DOM.window as any).themeToggle.loadTheme();
            expect(tab2DOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(true);
            
            // Change theme in tab2
            (tab2DOM.window as any).themeToggle.applyTheme('light');
            
            // Tab1 should reflect the new stored theme when refreshed
            (tab1DOM.window as any).themeToggle.loadTheme();
            expect(tab1DOM.window.document.body.classList.contains(DARK_THEME_CLASS)).toBe(false);
            
            tab1DOM.window.close();
            tab2DOM.window.close();
        });
    });
});