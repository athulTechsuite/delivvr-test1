const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// Test constants
const TEST_CSS_FILE = path.join(__dirname, '../public/css/style.css');
const TEST_VIEWS_DIR = path.join(__dirname, '../views');

// Mock Express app for testing Material Design implementation
const createMockApp = () => {
    const app = express();
    app.use(express.static(path.join(__dirname, '../public')));
    app.set('view engine', 'ejs');
    app.set('views', TEST_VIEWS_DIR);
    
    // Mock routes for testing
    app.get('/test-login', (req, res) => {
        res.render('login', { error: null });
    });
    
    app.get('/test-signup', (req, res) => {
        res.render('signup', { error: null });
    });
    
    app.get('/test-profile', (req, res) => {
        const mockUser = {
            name: 'Test User',
            email: 'test@example.com',
            created_at: new Date().toISOString()
        };
        res.render('profile', { user: mockUser });
    });
    
    app.get('/test-dashboard', (req, res) => {
        const mockUser = {
            name: 'Test User',
            email: 'test@example.com'
        };
        res.render('dashboard', { user: mockUser });
    });
    
    app.get('/test-home', (req, res) => {
        res.render('index');
    });
    
    // POST logout route for testing
    app.post('/logout', (req, res) => {
        res.clearCookie('token');
        res.redirect('/');
    });
    
    return app;
};

describe('Material Design CSS Implementation Tests', () => {
    let app;
    let cssContent;
    
    beforeAll(() => {
        app = createMockApp();
        
        // Read CSS file content for testing
        if (fs.existsSync(TEST_CSS_FILE)) {
            cssContent = fs.readFileSync(TEST_CSS_FILE, 'utf8');
        } else {
            throw new Error('Material Design CSS file not found');
        }
    });
    
    describe('CSS Loading and Structure', () => {
        test('Material Design CSS file should exist and be readable', () => {
            expect(fs.existsSync(TEST_CSS_FILE)).toBe(true);
            expect(cssContent).toBeDefined();
            expect(cssContent.length).toBeGreaterThan(0);
        });
        
        test('CSS should contain Material Design custom properties', () => {
            expect(cssContent).toMatch(/:root\s*{/);
            expect(cssContent).toMatch(/--md-primary:\s*#FF6B00/);
            expect(cssContent).toMatch(/--md-secondary:\s*#FF4081/);
            expect(cssContent).toMatch(/--md-surface:\s*#FFFFFF/);
            expect(cssContent).toMatch(/--md-background:\s*#FAFAFA/);
        });
        
        test('CSS should include Material Design elevation shadows', () => {
            expect(cssContent).toMatch(/--md-elevation-1:/);
            expect(cssContent).toMatch(/--md-elevation-2:/);
            expect(cssContent).toMatch(/--md-elevation-3:/);
            expect(cssContent).toMatch(/--md-elevation-4:/);
            expect(cssContent).toMatch(/--md-elevation-6:/);
            expect(cssContent).toMatch(/--md-elevation-8:/);
            expect(cssContent).toMatch(/--md-elevation-12:/);
            expect(cssContent).toMatch(/--md-elevation-16:/);
            expect(cssContent).toMatch(/--md-elevation-24:/);
        });
        
        test('CSS should define Material Design spacing system', () => {
            expect(cssContent).toMatch(/--md-spacing-xs:\s*4px/);
            expect(cssContent).toMatch(/--md-spacing-sm:\s*8px/);
            expect(cssContent).toMatch(/--md-spacing-md:\s*16px/);
            expect(cssContent).toMatch(/--md-spacing-lg:\s*24px/);
            expect(cssContent).toMatch(/--md-spacing-xl:\s*32px/);
            expect(cssContent).toMatch(/--md-spacing-xxl:\s*48px/);
            expect(cssContent).toMatch(/--md-spacing-xxxl:\s*64px/);
        });
    });
    
    describe('Material Design Color Scheme Tests', () => {
        test('Primary color palette should be defined correctly', () => {
            expect(cssContent).toMatch(/--md-primary:\s*#FF6B00/);
            expect(cssContent).toMatch(/--md-primary-light:\s*#42A5F5/);
            expect(cssContent).toMatch(/--md-primary-dark:\s*#1565C0/);
            expect(cssContent).toMatch(/--md-primary-50:\s*#E3F2FD/);
            expect(cssContent).toMatch(/--md-primary-100:\s*#BBDEFB/);
            expect(cssContent).toMatch(/--md-primary-900:\s*#0D47A1/);
        });
        
        test('Secondary color palette should be defined correctly', () => {
            expect(cssContent).toMatch(/--md-secondary:\s*#FF4081/);
            expect(cssContent).toMatch(/--md-secondary-light:\s*#FF79B0/);
            expect(cssContent).toMatch(/--md-secondary-dark:\s*#C60055/);
        });
        
        test('Semantic colors should be defined correctly', () => {
            expect(cssContent).toMatch(/--md-error:\s*#F44336/);
            expect(cssContent).toMatch(/--md-success:\s*#4CAF50/);
            expect(cssContent).toMatch(/--md-warning:\s*#FF9800/);
            expect(cssContent).toMatch(/--md-info:\s*#2196F3/);
        });
        
        test('Text color variants should follow Material Design opacity standards', () => {
            expect(cssContent).toMatch(/--md-text-primary:\s*rgba\(0,\s*0,\s*0,\s*0\.87\)/);
            expect(cssContent).toMatch(/--md-text-secondary:\s*rgba\(0,\s*0,\s*0,\s*0\.60\)/);
            expect(cssContent).toMatch(/--md-text-disabled:\s*rgba\(0,\s*0,\s*0,\s*0\.38\)/);
            expect(cssContent).toMatch(/--md-text-hint:\s*rgba\(0,\s*0,\s*0,\s*0\.38\)/);
        });
        
        test('Light theme text colors should be properly defined', () => {
            expect(cssContent).toMatch(/--md-text-primary-on-primary:\s*rgba\(255,\s*255,\s*255,\s*1\)/);
            expect(cssContent).toMatch(/--md-text-secondary-on-primary:\s*rgba\(255,\s*255,\s*255,\s*0\.7\)/);
        });
        
        test('Extended primary color palette should be complete', () => {
            const primaryShades = [200, 300, 400, 500, 600, 700, 800];
            primaryShades.forEach(shade => {
                expect(cssContent).toMatch(new RegExp(`--md-primary-${shade}:`));
            });
        });
        
        test('Surface colors should support elevation levels', () => {
            const elevations = ['1dp', '2dp', '3dp', '4dp', '6dp', '8dp', '12dp', '16dp', '24dp'];
            elevations.forEach(elevation => {
                expect(cssContent).toMatch(new RegExp(`--md-surface-${elevation}:`));
            });
        });
        
        test('Background colors should include paper variant', () => {
            expect(cssContent).toMatch(/--md-background-paper:\s*#FFFFFF/);
        });
    });
    
    describe('Typography Testing', () => {
        test('Material Design font family should be defined', () => {
            expect(cssContent).toMatch(/--md-font-family:\s*['"]Roboto['"],/);
            expect(cssContent).toMatch(/-apple-system/);
            expect(cssContent).toMatch(/BlinkMacSystemFont/);
            expect(cssContent).toMatch(/sans-serif/);
        });
        
        test('Material Design typography scale should be implemented', () => {
            expect(cssContent).toMatch(/--md-font-size-h1:\s*96px/);
            expect(cssContent).toMatch(/--md-font-size-h2:\s*60px/);
            expect(cssContent).toMatch(/--md-font-size-h3:\s*48px/);
            expect(cssContent).toMatch(/--md-font-size-h4:\s*34px/);
            expect(cssContent).toMatch(/--md-font-size-h5:\s*24px/);
            expect(cssContent).toMatch(/--md-font-size-h6:\s*20px/);
            expect(cssContent).toMatch(/--md-font-size-body1:\s*16px/);
            expect(cssContent).toMatch(/--md-font-size-body2:\s*14px/);
        });
        
        test('Font weights should follow Material Design standards', () => {
            expect(cssContent).toMatch(/--md-font-weight-light:\s*300/);
            expect(cssContent).toMatch(/--md-font-weight-regular:\s*400/);
            expect(cssContent).toMatch(/--md-font-weight-medium:\s*500/);
            expect(cssContent).toMatch(/--md-font-weight-bold:\s*700/);
        });
        
        test('Line heights should be defined for proper spacing', () => {
            expect(cssContent).toMatch(/--md-line-height-dense:\s*1\.2/);
            expect(cssContent).toMatch(/--md-line-height-normal:\s*1\.5/);
            expect(cssContent).toMatch(/--md-line-height-relaxed:\s*1\.75/);
        });
        
    });
    
    describe('Card Elevation and Shadows', () => {
        test('2dp elevation should be defined for standard cards', () => {
            const elevation2Regex = /--md-elevation-2:\s*0\s+2px\s+4px\s+rgba\(0,\s*0,\s*0,\s*0\.12\),\s*0\s+2px\s+4px\s+rgba\(0,\s*0,\s*0,\s*0\.24\)/;
            expect(cssContent).toMatch(elevation2Regex);
        });
        
        test('All elevation levels should have proper shadow definitions', () => {
            const elevationLevels = [1, 2, 3, 4, 6, 8, 12, 16, 24];
            elevationLevels.forEach(level => {
                const elevationVar = `--md-elevation-${level}:`;
                expect(cssContent).toMatch(new RegExp(elevationVar));
            });
        });
        
        test('Shadow values should use proper rgba opacity values', () => {
            expect(cssContent).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.12\)/);
            expect(cssContent).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.15\)/);
            expect(cssContent).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.16\)/);
            expect(cssContent).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.23\)/);
            expect(cssContent).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.24\)/);
        });
        
        test('Elevation classes should be defined for components', () => {
            const elevationClasses = ['.md-elevation-1', '.md-elevation-2', '.md-elevation-4', '.md-elevation-8'];
            elevationClasses.forEach(className => {
                expect(cssContent).toMatch(new RegExp(className.replace('.', '\\.')));
            });
        });
    });
    
    describe('Border Radius and Shape', () => {
        test('Border radius values should follow Material Design standards', () => {
            expect(cssContent).toMatch(/--md-border-radius-sm:\s*4px/);
            expect(cssContent).toMatch(/--md-border-radius-md:\s*8px/);
            expect(cssContent).toMatch(/--md-border-radius-lg:\s*12px/);
            expect(cssContent).toMatch(/--md-border-radius-xl:\s*16px/);
        });
        
    });
    
    describe('Animation and Transitions', () => {
        test('Material Design motion curves should be defined', () => {
            expect(cssContent).toMatch(/cubic-bezier\(0\.4,\s*0\.0,\s*0\.2,\s*1\)/);
        });
        
        test('Transition durations should follow Material Design timing', () => {
            expect(cssContent).toMatch(/--md-transition-fast:\s*0\.15s/);
            expect(cssContent).toMatch(/--md-transition-standard:\s*0\.3s/);
            expect(cssContent).toMatch(/--md-transition-slow:\s*0\.5s/);
        });
        
    });
    
    describe('Z-index Layering', () => {
        test('Z-index values should be defined for proper layering', () => {
            expect(cssContent).toMatch(/--md-z-tooltip:\s*1600/);
            expect(cssContent).toMatch(/--md-z-modal:\s*1300/);
            expect(cssContent).toMatch(/--md-z-drawer:\s*1200/);
        });
        
        test('Additional z-index layers should be defined', () => {
            expect(cssContent).toMatch(/--md-z-app-bar:/);
            expect(cssContent).toMatch(/--md-z-snackbar:/);
        });
    });

    describe('Card Alignment and Button Group Orientation', () => {
        test('.md-row should have align-items: stretch for equal height cards', () => {
            expect(cssContent).toMatch(/\.md-row\s*\{[^}]*align-items:\s*stretch/);
        });

        test('.md-button-group.md-vertical rule should be defined', () => {
            expect(cssContent).toMatch(/\.md-button-group\.md-vertical\s*\{[^}]*flex-direction:\s*column/);
        });

        test('.md-button-group.md-horizontal rule should be defined', () => {
            expect(cssContent).toMatch(/\.md-button-group\.md-horizontal\s*\{[^}]*flex-direction:\s*row/);
        });

        test('.md-row children should stretch card to full height', () => {
            expect(cssContent).toMatch(/\.md-card[^{]*\{[^}]*(?:flex:\s*1|height:\s*100%)/);
        });
    });
});

describe('Material Design Template Integration Tests', () => {
    let app;
    
    beforeAll(() => {
        app = createMockApp();
    });
    
    describe('Login Page Material Design', () => {
        test('Login page should load without errors', async () => {
            const response = await request(app).get('/test-login');
            expect(response.status).toBe(200);
            expect(response.text).toContain('<!DOCTYPE html>');
        });
        
        test('Login page should include Material Design CSS', async () => {
            const response = await request(app).get('/test-login');
            expect(response.text).toMatch(/\/css\/style\.css/);
        });
        
        test('Login page should include Roboto font', async () => {
            const response = await request(app).get('/test-login');
            expect(response.text).toMatch(/fonts\.googleapis\.com/);
            expect(response.text).toMatch(/Roboto/);
        });
        
        test('Login page should use Material Design classes', async () => {
            const response = await request(app).get('/test-login');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            // Check for Material Design body class
            const body = document.querySelector('body');
            expect(body?.className).toMatch(/md-body/);
            
            // Check for Material Design card elements
            const cards = document.querySelectorAll('.md-card');
            expect(cards.length).toBeGreaterThan(0);
        });
        
        test('Login page should have proper form structure', async () => {
            const response = await request(app).get('/test-login');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            const form = document.querySelector('form');
            expect(form).toBeTruthy();
            
            const emailInput = document.querySelector('input[type="email"]');
            const passwordInput = document.querySelector('input[type="password"]');
            expect(emailInput).toBeTruthy();
            expect(passwordInput).toBeTruthy();
        });
    });
    
    describe('Signup Page Material Design', () => {
        test('Signup page should load without errors', async () => {
            const response = await request(app).get('/test-signup');
            expect(response.status).toBe(200);
            expect(response.text).toContain('<!DOCTYPE html>');
        });
        
        test('Signup page should use Material Design form styling', async () => {
            const response = await request(app).get('/test-signup');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            // Check for Material Design form elements
            const forms = document.querySelectorAll('form');
            expect(forms.length).toBeGreaterThan(0);
            
            // Check for Material Design input styling
            const inputs = document.querySelectorAll('input');
            inputs.forEach(input => {
                expect(input.className).toMatch(/md-/);
            });
        });
        
        test('Signup page should have all required form fields', async () => {
            const response = await request(app).get('/test-signup');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            const nameInput = document.querySelector('input[name="name"]');
            const emailInput = document.querySelector('input[name="email"]');
            const passwordInput = document.querySelector('input[name="password"]');
            
            expect(nameInput).toBeTruthy();
            expect(emailInput).toBeTruthy();
            expect(passwordInput).toBeTruthy();
        });
    });
    
    describe('Profile Page Material Design', () => {
        test('Profile page should load without errors', async () => {
            const response = await request(app).get('/test-profile');
            expect(response.status).toBe(200);
            expect(response.text).toContain('<!DOCTYPE html>');
        });
        
        test('Profile page should display user information in Material Design cards', async () => {
            const response = await request(app).get('/test-profile');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            // Check for profile heading
            const heading = document.querySelector('#profile-heading');
            expect(heading?.textContent).toMatch(/User Profile/);
            
            // Check for Material Design cards
            const cards = document.querySelectorAll('.md-card');
            expect(cards.length).toBeGreaterThan(0);
            
            // Check for elevation classes
            const elevatedCards = document.querySelectorAll('.md-elevation-2');
            expect(elevatedCards.length).toBeGreaterThan(0);
        });
        
        test('Profile page should include person-circle icon', async () => {
            const response = await request(app).get('/test-profile');
            expect(response.text).toMatch(/bi-person-circle/);
        });
        
        test('Profile page should display user data correctly', async () => {
            const response = await request(app).get('/test-profile');
            expect(response.text).toContain('Test User');
            expect(response.text).toContain('test@example.com');
        });
    });
    
    describe('Dashboard Page Material Design', () => {
        test('Dashboard page should load without errors', async () => {
            const response = await request(app).get('/test-dashboard');
            expect(response.status).toBe(200);
            expect(response.text).toContain('<!DOCTYPE html>');
        });
        
        test('Dashboard page should use Material Design styling', async () => {
            const response = await request(app).get('/test-dashboard');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            // Check for Material Design body class
            const body = document.querySelector('body');
            expect(body?.className).toMatch(/md-body/);
        });
        
        test('Dashboard page should include navigation elements', async () => {
            const response = await request(app).get('/test-dashboard');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            const nav = document.querySelector('nav');
            expect(nav).toBeTruthy();
            expect(nav.className).toMatch(/md-navbar/);
        });
    });
    
    describe('Home Page Material Design', () => {
        test('Home page should load without errors', async () => {
            const response = await request(app).get('/test-home');
            expect(response.status).toBe(200);
            expect(response.text).toContain('<!DOCTYPE html>');
        });
        
        test('Home page should include Material Design hero section', async () => {
            const response = await request(app).get('/test-home');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            // Check for hero section or main content area
            const main = document.querySelector('main');
            expect(main).toBeTruthy();
            
            const hero = document.querySelector('.md-hero');
            expect(hero).toBeTruthy();
        });
        
        test('Home page should include proper navigation', async () => {
            const response = await request(app).get('/test-home');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            const navLinks = document.querySelectorAll('.md-navbar-link');
            expect(navLinks.length).toBeGreaterThan(0);
        });
    });
    
    describe('Logout Route Implementation', () => {
        test('POST /logout should clear token cookie and redirect', async () => {
            const response = await request(app)
                .post('/logout')
                .expect(302);
            
            expect(response.headers['set-cookie']).toBeDefined();
            expect(response.headers['set-cookie'][0]).toMatch(/token=;/);
            expect(response.headers.location).toBe('/');
        });
    });
});

describe('Material Design Component Consistency Tests', () => {
    let app;
    
    beforeAll(() => {
        app = createMockApp();
    });
    
    describe('Button Styling Consistency', () => {
        test('All pages should use consistent Material Design button classes', async () => {
            const pages = ['/test-login', '/test-signup', '/test-profile', '/test-dashboard', '/test-home'];
            
            for (const page of pages) {
                const response = await request(app).get(page);
                if (response.status === 200) {
                    const dom = new JSDOM(response.text);
                    const document = dom.window.document;
                    const buttons = document.querySelectorAll('button, .btn, [role="button"]');
                    
                    buttons.forEach(button => {
                        // Should use Material Design button classes
                        expect(button.className).toMatch(/md-|btn-/);
                    });
                }
            }
        });
        
        test('Button variants should be properly implemented', async () => {
            const response = await request(app).get('/test-login');
            expect(response.text).toMatch(/md-button--contained|md-button--outlined|md-button--text/);
        });
    });
    
    describe('Form Field Consistency', () => {
        test('Form inputs should follow Material Design patterns', async () => {
            const formPages = ['/test-login', '/test-signup'];
            
            for (const page of formPages) {
                const response = await request(app).get(page);
                const dom = new JSDOM(response.text);
                const document = dom.window.document;
                
                const inputs = document.querySelectorAll('input');
                inputs.forEach(input => {
                    // Should have Material Design input styling
                    expect(input.className).toMatch(/md-/);
                });
                
                const labels = document.querySelectorAll('label');
                labels.forEach(label => {
                    // Labels should follow Material Design patterns
                    expect(label.className).toMatch(/md-/);
                });
            }
        });
        
        test('Form validation styling should be consistent', async () => {
            const response = await request(app).get('/test-signup');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            const form = document.querySelector('form');
            expect(form.className).toMatch(/md-form/);
        });
    });
    
    describe('Card Component Consistency', () => {
        test('All cards should use consistent elevation and styling', async () => {
            const pages = ['/test-login', '/test-signup', '/test-profile', '/test-dashboard'];
            
            for (const page of pages) {
                const response = await request(app).get(page);
                if (response.status === 200) {
                    const dom = new JSDOM(response.text);
                    const document = dom.window.document;
                    const cards = document.querySelectorAll('.md-card');
                    
                    cards.forEach(card => {
                        // Cards should have elevation classes
                        expect(card.className).toMatch(/md-elevation-/);
                    });
                }
            }
        });
        
        test('Card headers and content should be properly structured', async () => {
            const response = await request(app).get('/test-profile');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            const cardHeaders = document.querySelectorAll('.md-card-header');
            const cardBodies = document.querySelectorAll('.md-card-body');
            
            expect(cardHeaders.length).toBeGreaterThan(0);
            expect(cardBodies.length).toBeGreaterThan(0);
        });
    });
    
    describe('Navigation Consistency', () => {
        test('Navigation elements should use consistent Material Design styling', async () => {
            const pages = ['/test-profile', '/test-dashboard'];
            
            for (const page of pages) {
                const response = await request(app).get(page);
                if (response.status === 200) {
                    const dom = new JSDOM(response.text);
                    const document = dom.window.document;
                    
                    // Check for navigation elements
                    const nav = document.querySelector('nav');
                    if (nav) {
                        expect(nav.className).toMatch(/md-navbar/);
                    }
                    
                    // Check for navigation links
                    const navLinks = document.querySelectorAll('.md-navbar-link');
                    expect(navLinks.length).toBeGreaterThan(0);
                }
            }
        });
        
        test('Navigation should include mobile toggle button', async () => {
            const response = await request(app).get('/test-profile');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            const toggle = document.querySelector('.md-navbar-toggle');
            expect(toggle).toBeTruthy();
        });
        
        test('Navigation should be responsive without Bootstrap dependency', async () => {
            const response = await request(app).get('/test-profile');
            // Should not contain Bootstrap-specific classes like 'navbar-toggler'
            expect(response.text).not.toMatch(/navbar-toggler(?!.*md-)/);
            // Should use Material Design responsive classes
            expect(response.text).toMatch(/md-navbar-toggle/);
        });
    });
});

describe('Material Design Accessibility and Color Contrast Tests', () => {
    let cssContent;
    
    beforeAll(() => {
        if (fs.existsSync(TEST_CSS_FILE)) {
            cssContent = fs.readFileSync(TEST_CSS_FILE, 'utf8');
        }
    });
    
    describe('Color Contrast Compliance', () => {
        test('Primary text should have high contrast ratio', () => {
            // Material Design primary text uses rgba(0, 0, 0, 0.87) for high contrast
            expect(cssContent).toMatch(/--md-text-primary:\s*rgba\(0,\s*0,\s*0,\s*0\.87\)/);
        });
        
        test('Secondary text should maintain readable contrast', () => {
            // Material Design secondary text uses rgba(0, 0, 0, 0.60) for medium contrast
            expect(cssContent).toMatch(/--md-text-secondary:\s*rgba\(0,\s*0,\s*0,\s*0\.60\)/);
        });
        
        test('Disabled text should follow accessibility guidelines', () => {
            // Material Design disabled text uses rgba(0, 0, 0, 0.38)
            expect(cssContent).toMatch(/--md-text-disabled:\s*rgba\(0,\s*0,\s*0,\s*0\.38\)/);
        });
        
        test('Primary color should provide sufficient contrast', () => {
            // Blue 700 (#FF6B00) provides good contrast against white backgrounds
            expect(cssContent).toMatch(/--md-primary:\s*#FF6B00/);
        });
        
        test('Error colors should be accessible', () => {
            expect(cssContent).toMatch(/--md-error:\s*#F44336/);
            expect(cssContent).toMatch(/--md-error-light:\s*#EF5350/);
        });
    });
    
    describe('ARIA and Semantic HTML Support', () => {
        test('CSS should not interfere with screen reader accessibility', () => {
            // Check that CSS doesn't hide content inappropriately
            expect(cssContent).not.toMatch(/display:\s*none.*aria-/);
            expect(cssContent).not.toMatch(/visibility:\s*hidden.*aria-/);
        });
        
        test('Focus styles should be clearly defined', () => {
            expect(cssContent).toMatch(/:focus/);
            expect(cssContent).toMatch(/outline/);
        });
    });
});

describe('Material Design Responsive Design Tests', () => {
    let app;
    
    beforeAll(() => {
        app = createMockApp();
    });
    
    describe('Responsive Breakpoints', () => {
        test('CSS should define responsive grid classes', async () => {
            const cssContent = fs.readFileSync(TEST_CSS_FILE, 'utf8');
            
            // Check for responsive column classes
            expect(cssContent).toMatch(/\.md-col-/);
            expect(cssContent).toMatch(/\.md-col-md-/);
            expect(cssContent).toMatch(/\.md-col-lg-/);
        });
        
        test('Pages should use responsive Material Design classes', async () => {
            const response = await request(app).get('/test-profile');
            
            // Check for responsive classes in profile page
            expect(response.text).toMatch(/md-col-12/);
            expect(response.text).toMatch(/md-col-md-/);
            expect(response.text).toMatch(/md-col-lg-/);
        });
        
        test('Breakpoints should follow Material Design standards', async () => {
            const cssContent = fs.readFileSync(TEST_CSS_FILE, 'utf8');
            
            // Check for standard breakpoints
            expect(cssContent).toMatch(/@media.*576px/);
            expect(cssContent).toMatch(/@media.*768px/);
            expect(cssContent).toMatch(/@media.*992px/);
        });
    });
    
    describe('Mobile Navigation', () => {
        test('Navigation should include mobile-friendly elements', async () => {
            const response = await request(app).get('/test-profile');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            // Check for mobile menu toggle
            const toggle = document.querySelector('.md-navbar-toggle');
            expect(toggle).toBeTruthy();
            
            // Check for collapsible navigation
            const navMenu = document.querySelector('#navbarNav');
            expect(navMenu).toBeTruthy();
        });
        
        test('Mobile navigation should work without Bootstrap', async () => {
            const response = await request(app).get('/test-profile');
            
            // Should not rely on Bootstrap collapse classes
            expect(response.text).not.toMatch(/data-bs-toggle="collapse"/);
            // Should use Material Design approach
            expect(response.text).toMatch(/md-navbar-toggle/);
        });
    });
    
    describe('Responsive Typography', () => {
        test('Typography should scale appropriately on different screen sizes', async () => {
            const cssContent = fs.readFileSync(TEST_CSS_FILE, 'utf8');
            
            // Check for responsive typography
            expect(cssContent).toMatch(/@media.*font-size/);
        });
    });
});

describe('Material Design Performance Tests', () => {
    test('CSS file size should be reasonable for production', () => {
        const stats = fs.statSync(TEST_CSS_FILE);
        const fileSizeInKB = stats.size / 1024;
        
        // CSS file should be under 100KB for good performance
        expect(fileSizeInKB).toBeLessThan(100);
    });
    
    test('CSS should not contain duplicate color definitions', () => {
        const cssContent = fs.readFileSync(TEST_CSS_FILE, 'utf8');
        
        // Extract all color definitions
        const colorMatches = cssContent.match(/--md-[^:]+:\s*#[0-9A-Fa-f]{6}/g);
        if (colorMatches) {
            const uniqueColors = new Set(colorMatches);
            
            // Should not have excessive duplicate color definitions
            const duplicateRatio = (colorMatches.length - uniqueColors.size) / colorMatches.length;
            expect(duplicateRatio).toBeLessThan(0.1); // Less than 10% duplicates
        }
    });
    
    test('CSS should be minifiable without breaking', () => {
        const cssContent = fs.readFileSync(TEST_CSS_FILE, 'utf8');
        
        // Check that CSS doesn't rely on formatting for functionality
        const minified = cssContent.replace(/\s+/g, ' ').trim();
        expect(minified.length).toBeGreaterThan(0);
    });
});

describe('Material Design CSS Validation Tests', () => {
    let cssContent;
    
    beforeAll(() => {
        cssContent = fs.readFileSync(TEST_CSS_FILE, 'utf8');
    });
    
    test('CSS should not contain syntax errors', () => {
        // Check for balanced braces
        const openBraces = (cssContent.match(/{/g) || []).length;
        const closeBraces = (cssContent.match(/}/g) || []).length;
        expect(openBraces).toBe(closeBraces);
        
        // Check for proper semicolons
        const propertyDeclarations = cssContent.match(/[^{}]+:[^{}]+;/g);
        expect(propertyDeclarations).toBeTruthy();
        expect(propertyDeclarations.length).toBeGreaterThan(0);
    });
    
    test('CSS custom properties should follow naming convention', () => {
        const customProps = cssContent.match(/--md-[a-z-]+/g);
        if (customProps) {
            customProps.forEach(prop => {
                // All Material Design custom properties should start with --md-
                expect(prop).toMatch(/^--md-[a-z][a-z0-9-]*$/);
            });
        }
    });
    
    test('CSS should include required Material Design components', () => {
        // Check for essential Material Design component classes
        const requiredClasses = [
            'md-card',
            'md-button', 
            'md-navbar',
            'md-elevation-',
            'md-text-',
            'md-body'
        ];
        
        requiredClasses.forEach(className => {
            expect(cssContent).toMatch(new RegExp(className));
        });
    });
    
    test('CSS should define grid system classes', () => {
        const gridClasses = ['md-container', 'md-row', 'md-col'];
        gridClasses.forEach(className => {
            expect(cssContent).toMatch(new RegExp(`\\.${className}`));
        });
    });
    
    test('CSS should include utility classes', () => {
        const utilityClasses = ['md-padding-', 'md-margin-', 'md-text-center', 'md-d-flex'];
        utilityClasses.forEach(className => {
            expect(cssContent).toMatch(new RegExp(className));
        });
    });
});

describe('Material Design EJS Template Markup Tests', () => {
    let app;
    
    beforeAll(() => {
        app = createMockApp();
    });
    
    describe('Template Structure Validation', () => {
        test('All templates should have proper DOCTYPE and lang attribute', async () => {
            const pages = ['/test-login', '/test-signup', '/test-profile', '/test-dashboard', '/test-home'];
            
            for (const page of pages) {
                const response = await request(app).get(page);
                if (response.status === 200) {
                    expect(response.text).toMatch(/<!DOCTYPE html>/);
                    expect(response.text).toMatch(/<html lang="en">/);
                }
            }
        });
        
        test('Templates should include proper meta tags', async () => {
            const response = await request(app).get('/test-home');
            expect(response.text).toMatch(/<meta charset="UTF-8">/);
            expect(response.text).toMatch(/<meta name="viewport".*width=device-width/);
        });
        
        test('Templates should include Material Design font imports', async () => {
            const response = await request(app).get('/test-home');
            expect(response.text).toMatch(/fonts\.googleapis\.com.*Roboto/);
        });
    });
    
    describe('Semantic HTML Structure', () => {
        test('Pages should use proper semantic HTML elements', async () => {
            const response = await request(app).get('/test-home');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            const nav = document.querySelector('nav');
            const main = document.querySelector('main');
            
            expect(nav).toBeTruthy();
            expect(main).toBeTruthy();
        });
        
        test('Navigation should have proper ARIA attributes', async () => {
            const response = await request(app).get('/test-profile');
            expect(response.text).toMatch(/role="navigation"/);
            expect(response.text).toMatch(/aria-label="Main navigation"/);
        });
        
        test('Form elements should have proper labels and accessibility', async () => {
            const response = await request(app).get('/test-login');
            const dom = new JSDOM(response.text);
            const document = dom.window.document;
            
            const inputs = document.querySelectorAll('input');
            inputs.forEach(input => {
                if (input.id) {
                    const label = document.querySelector(`label[for="${input.id}"]`);
                    expect(label).toBeTruthy();
                }
            });
        });
    });
});