/**
 * Theme Toggle Integration Tests
 * Tests theme switcher functionality across all pages
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Theme Toggle Feature', () => {
    let dom, document, window, localStorage;
    
    beforeEach(() => {
        // Mock DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html lang="en" data-bs-theme="light">
            <head>
                <meta charset="UTF-8">
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body>
                <nav class="navbar navbar-expand-lg bg-primary">
                    <div class="container">
                        <ul class="navbar-nav">
                            <li class="nav-item">
                                <button class="btn btn-outline-light btn-sm" id="themeToggle" type="button" title="Toggle theme">
                                    <i class="bi bi-sun-fill" id="themeIcon"></i>
                                    <span id="themeText" class="d-none d-md-inline ms-1">Light</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </nav>
                <main class="container mt-4">
                    <div class="row">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Test Content</h5>
                                    <p class="card-text">This is test content for theme toggle testing.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-12">
                            <div class="alert alert-info">
                                <strong>Info:</strong> Test alert for theme validation.
                            </div>
                        </div>
                    </div>
                </main>
                <footer class="mt-5 py-3 bg-secondary text-light">
                    <div class="container text-center">
                        <small>&copy; 2024 Test Application</small>
                    </div>
                </footer>
            </body>
            </html>
        `, {
            url: 'http://localhost',
            pretendToBeVisual: true,
            resources: 'usable'
        });
        
        document = dom.window.document;
        window = dom.window;
        
        // Mock localStorage
        localStorage = {
            storage: {},
            getItem: function(key) {
                return this.storage[key] || null;
            },
            setItem: function(key, value) {
                this.storage[key] = value;
            },
            clear: function() {
                this.storage = {};
            }
        };
        
        Object.defineProperty(window, 'localStorage', {
            value: localStorage,
            writable: true
        });
        
        // Load theme toggle script
        const themeScript = fs.readFileSync(path.join(__dirname, '../public/js/theme-toggle.js'), 'utf8');
        const script = document.createElement('script');
        script.textContent = themeScript;
        document.head.appendChild(script);
        
        global.document = document;
        global.window = window;
        global.localStorage = localStorage;
    });
    
    afterEach(() => {
        dom.window.close();
        localStorage.clear();
    });
    
    describe('AC1: Theme toggle visibility in header', () => {
        test('should display theme toggle button in header navigation', () => {
            const toggleButton = document.getElementById('themeToggle');
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            expect(toggleButton).toBeTruthy();
            expect(toggleButton.type).toBe('button');
            expect(themeIcon).toBeTruthy();
            expect(themeText).toBeTruthy();
            expect(toggleButton.getAttribute('title')).toContain('Toggle theme');
        });
        
        test('should show current mode state in toggle button', () => {
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            // Light mode by default
            expect(themeIcon.className).toContain('bi-sun-fill');
            expect(themeText.textContent).toBe('Light');
        });
    });
    
    describe('AC2: Default to light mode on first load', () => {
        test('should default to light mode when no saved preference exists', () => {
            // Clear localStorage to simulate first visit
            localStorage.clear();
            
            // Initialize theme manager
            const themeManager = new window.ThemeManager();
            
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
            expect(localStorage.getItem('theme-preference')).toBe('light');
        });
        
        test('should reflect light mode in toggle button state', () => {
            localStorage.clear();
            const themeManager = new window.ThemeManager();
            
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            expect(themeIcon.className).toContain('bi-sun-fill');
            expect(themeText.textContent).toBe('Light');
        });
    });
    
    describe('AC3: Switch from light to dark mode', () => {
        test('should switch to dark mode when toggle is clicked in light mode', () => {
            const themeManager = new window.ThemeManager();
            const toggleButton = document.getElementById('themeToggle');
            
            // Start in light mode
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
            
            // Click toggle
            toggleButton.click();
            
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
            expect(localStorage.getItem('theme-preference')).toBe('dark');
        });
        
        test('should update toggle button appearance for dark mode', () => {
            const themeManager = new window.ThemeManager();
            const toggleButton = document.getElementById('themeToggle');
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            toggleButton.click();
            
            expect(themeIcon.className).toContain('bi-moon-fill');
            expect(themeText.textContent).toBe('Dark');
        });
    });
    
    describe('AC4: Switch from dark to light mode', () => {
        test('should switch to light mode when toggle is clicked in dark mode', () => {
            const themeManager = new window.ThemeManager();
            const toggleButton = document.getElementById('themeToggle');
            
            // Switch to dark first
            toggleButton.click();
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
            
            // Switch back to light
            toggleButton.click();
            
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
            expect(localStorage.getItem('theme-preference')).toBe('light');
        });
        
        test('should update toggle button appearance for light mode', () => {
            const themeManager = new window.ThemeManager();
            const toggleButton = document.getElementById('themeToggle');
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            // Go to dark then back to light
            toggleButton.click();
            toggleButton.click();
            
            expect(themeIcon.className).toContain('bi-sun-fill');
            expect(themeText.textContent).toBe('Light');
        });
    });
    
    describe('AC5: Theme persistence across page loads', () => {
        test('should load saved dark theme preference from localStorage', () => {
            localStorage.setItem('theme-preference', 'dark');
            
            // Simulate page reload by creating new theme manager
            const themeManager = new window.ThemeManager();
            
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
        });
        
        test('should load saved light theme preference from localStorage', () => {
            localStorage.setItem('theme-preference', 'light');
            
            const themeManager = new window.ThemeManager();
            
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
        });
        
        test('should handle invalid localStorage values gracefully', () => {
            localStorage.setItem('theme-preference', 'invalid-theme');
            
            const themeManager = new window.ThemeManager();
            
            // Should default to light mode
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
        });
    });
    
    describe('AC6: Consistent theme application across components', () => {
        test('should apply dark theme to all Bootstrap components', () => {
            const themeManager = new window.ThemeManager();
            const toggleButton = document.getElementById('themeToggle');
            
            // Switch to dark mode
            toggleButton.click();
            
            // Check document theme attribute
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
            
            // Check body classes
            expect(document.body.classList.contains('theme-dark')).toBe(true);
            expect(document.body.classList.contains('theme-light')).toBe(false);
        });
        
        test('should apply light theme to all Bootstrap components', () => {
            const themeManager = new window.ThemeManager();
            
            // Start in light mode (default)
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
            expect(document.body.classList.contains('theme-light')).toBe(true);
            expect(document.body.classList.contains('theme-dark')).toBe(false);
        });
        
        test('should maintain theme consistency when switching multiple times', () => {
            const themeManager = new window.ThemeManager();
            const toggleButton = document.getElementById('themeToggle');
            
            // Multiple toggles
            toggleButton.click(); // to dark
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
            
            toggleButton.click(); // to light
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
            
            toggleButton.click(); // to dark
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
        });
    });
    
    describe('Error handling and edge cases', () => {
        test('should handle missing toggle button gracefully', () => {
            // Remove toggle button
            const toggleButton = document.getElementById('themeToggle');
            toggleButton.remove();
            
            expect(() => {
                new window.ThemeManager();
            }).not.toThrow();
        });
        
        test('should handle localStorage being unavailable', () => {
            // Mock localStorage unavailable
            delete window.localStorage;
            
            expect(() => {
                new window.ThemeManager();
            }).not.toThrow();
        });
        
        test('should handle multiple theme manager instances', () => {
            const manager1 = new window.ThemeManager();
            const manager2 = new window.ThemeManager();
            
            // Both should work independently
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
        });
    });
});