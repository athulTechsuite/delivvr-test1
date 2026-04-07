/**
 * End-to-End Tests for Theme Toggle Across Pages
 * Tests theme consistency across different application pages
 */

const request = require('supertest');
const { JSDOM } = require('jsdom');
const path = require('path');

// Import the actual Express app to test real EJS template rendering
let app;
try {
    // Try to import the main app file (common locations)
    app = require('../app') || require('../server') || require('../index');
} catch (error) {
    // Fallback: Create Express app that properly renders EJS templates
    const express = require('express');
    app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    app.use(express.static(path.join(__dirname, '../public')));
    
    // Routes that actually render EJS templates with real template files
    app.get('/', (req, res) => res.render('index', { title: 'Home' }));
    app.get('/login', (req, res) => res.render('login', { title: 'Login' }));
    app.get('/signup', (req, res) => res.render('signup', { title: 'Sign Up' }));
    app.get('/dashboard', (req, res) => res.render('dashboard', { title: 'Dashboard', user: { name: 'Test User' } }));
}

describe('Theme Toggle E2E Tests', () => {
    
    describe('Theme toggle presence across pages', () => {
        test('should have theme toggle on home page', async () => {
            const response = await request(app).get('/');
            expect(response.status).toBe(200);
            
            const dom = new JSDOM(response.text);
            const themeToggle = dom.window.document.querySelector('#themeToggle, #theme-toggle');
            
            expect(themeToggle).toBeTruthy();
            expect(themeToggle.tagName).toBe('BUTTON');
        });
        
        test('should have theme toggle on login page', async () => {
            const response = await request(app).get('/login');
            expect(response.status).toBe(200);
            
            const dom = new JSDOM(response.text);
            const themeToggle = dom.window.document.querySelector('#themeToggle, #theme-toggle');
            
            expect(themeToggle).toBeTruthy();
            expect(themeToggle.tagName).toBe('BUTTON');
        });
        
        test('should have theme toggle on signup page', async () => {
            const response = await request(app).get('/signup');
            expect(response.status).toBe(200);
            
            const dom = new JSDOM(response.text);
            const themeToggle = dom.window.document.querySelector('#themeToggle, #theme-toggle');
            
            expect(themeToggle).toBeTruthy();
        });
        
        test('should have theme toggle on dashboard page', async () => {
            const response = await request(app).get('/dashboard');
            expect(response.status).toBe(200);
            
            const dom = new JSDOM(response.text);
            const themeToggle = dom.window.document.querySelector('#themeToggle, #theme-toggle');
            
            expect(themeToggle).toBeTruthy();
        });
    });
    
    describe('Default theme application across pages', () => {
        test('should default to light theme on all pages', async () => {
            const pages = ['/', '/login', '/signup', '/dashboard'];
            
            for (const page of pages) {
                const response = await request(app).get(page);
                const dom = new JSDOM(response.text);
                const htmlElement = dom.window.document.documentElement;
                
                expect(htmlElement.getAttribute('data-bs-theme')).toBe('light');
            }
        });
        
        test('should include theme initialization script on all pages', async () => {
            const pages = ['/', '/login', '/signup', '/dashboard'];
            
            for (const page of pages) {
                const response = await request(app).get(page);
                
                expect(response.text).toMatch(/localStorage\.getItem\('theme.*'\)/);
                expect(response.text).toMatch(/data-bs-theme/);
            }
        });
    });
    
    describe('Bootstrap components theme compatibility', () => {
        test('should have proper Bootstrap classes for theme switching', async () => {
            const response = await request(app).get('/');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            // Check for Bootstrap components that should respond to theme
            const navbar = document.querySelector('.navbar');
            const cards = document.querySelectorAll('.card');
            const alerts = document.querySelectorAll('.alert');
            
            expect(navbar).toBeTruthy();
            expect(cards.length).toBeGreaterThan(0);
            
            // Verify Bootstrap theme classes are present
            expect(response.text).toMatch(/data-bs-theme/);
        });
        
        test('should have consistent navigation structure across pages', async () => {
            const pages = [
                { path: '/', expectedLinks: ['Home', 'Sign Up', 'Login'] },
                { path: '/login', expectedLinks: ['Home', 'Sign Up', 'Login'] },
                { path: '/signup', expectedLinks: ['Home', 'Login', 'Sign Up'] }
            ];
            
            for (const { path, expectedLinks } of pages) {
                const response = await request(app).get(path);
                const dom = new JSDOM(response.text);
                const navLinks = dom.window.document.querySelectorAll('.nav-link');
                
                expect(navLinks.length).toBeGreaterThan(0);
                
                // Check that navigation contains expected links
                const linkTexts = Array.from(navLinks).map(link => link.textContent.trim());
                expectedLinks.forEach(expectedLink => {
                    expect(linkTexts.some(text => text.includes(expectedLink))).toBe(true);
                });
            }
        });
    });
    
    describe('Theme icon and text consistency', () => {
        test('should have consistent theme icon elements across pages', async () => {
            const pages = ['/', '/login', '/signup', '/dashboard'];
            
            for (const page of pages) {
                const response = await request(app).get(page);
                const dom = new JSDOM(response.text);
                
                // Look for theme icon (various implementations)
                const icons = dom.window.document.querySelectorAll('#themeIcon, #theme-icon, .bi-sun-fill, .fa-sun, .fa-moon');
                expect(icons.length).toBeGreaterThan(0);
            }
        });
        
        test('should have theme text elements where expected', async () => {
            const pagesWithThemeText = ['/', '/dashboard'];
            
            for (const page of pagesWithThemeText) {
                const response = await request(app).get(page);
                const dom = new JSDOM(response.text);
                
                const themeText = dom.window.document.querySelector('#themeText');
                if (themeText) {
                    expect(themeText.textContent.trim()).toMatch(/Light|Dark/);
                }
            }
        });
    });
    
    describe('Page-specific theme toggle implementations', () => {
        test('should handle different theme toggle implementations consistently', async () => {
            const pages = {
                '/': { expectedId: 'themeToggle' },
                '/login': { expectedId: 'themeToggle' },
                '/signup': { expectedId: 'themeToggle' },
                '/dashboard': { expectedId: 'themeToggle' }
            };
            
            for (const [page, config] of Object.entries(pages)) {
                const response = await request(app).get(page);
                const dom = new JSDOM(response.text);
                
                // Check for expected toggle button ID or fallback patterns
                let toggleButton = dom.window.document.getElementById(config.expectedId);
                if (!toggleButton) {
                    toggleButton = dom.window.document.getElementById('theme-toggle');
                }
                
                expect(toggleButton).toBeTruthy();
                expect(toggleButton.tagName).toBe('BUTTON');
            }
        });
        
        test('should have proper accessibility attributes on toggle buttons', async () => {
            const pages = ['/', '/login', '/signup', '/dashboard'];
            
            for (const page of pages) {
                const response = await request(app).get(page);
                const dom = new JSDOM(response.text);
                
                const toggleButton = dom.window.document.querySelector('#themeToggle, #theme-toggle');
                
                if (toggleButton) {
                    // Check for accessibility attributes
                    const title = toggleButton.getAttribute('title');
                    const type = toggleButton.getAttribute('type');
                    
                    expect(type).toBe('button');
                    if (title) {
                        expect(title.toLowerCase()).toMatch(/theme|toggle/);
                    }
                }
            }
        });
    });
    
    describe('Error scenarios and edge cases', () => {
        test('should handle missing user data gracefully on dashboard', async () => {
            // Test dashboard without user data
            app.get('/dashboard-no-user', (req, res) => res.render('dashboard', { title: 'Dashboard' }));
            
            const response = await request(app).get('/dashboard-no-user');
            
            // Should not throw error and still include theme toggle
            const dom = new JSDOM(response.text);
            const themeToggle = dom.window.document.querySelector('#themeToggle');
            
            expect(themeToggle).toBeTruthy();
        });
        
        test('should handle malformed theme values in HTML', async () => {
            const response = await request(app).get('/');
            
            // Check that data-bs-theme attribute has valid value
            expect(response.text).toMatch(/data-bs-theme="(light|dark)"/);
            expect(response.text).not.toMatch(/data-bs-theme="(undefined|null|)"/);
        });
    });
});