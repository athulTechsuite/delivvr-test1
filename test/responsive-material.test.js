const puppeteer = require('puppeteer');
const { expect } = require('chai');
const app = require('../app');
const http = require('http');
const jwt = require('jsonwebtoken');

describe('Material Design Responsive Testing Suite', function() {
    this.timeout(30000); // Extended timeout for browser operations
    
    let server;
    let browser;
    let page;
    const PORT = 3001;
    const BASE_URL = `http://localhost:${PORT}`;
    
    // Test configuration constants
    const VIEWPORTS = {
        mobile: { width: 375, height: 667, isMobile: true, hasTouch: true },
        tablet: { width: 768, height: 1024, isMobile: true, hasTouch: true },
        desktop: { width: 1200, height: 800, isMobile: false, hasTouch: false },
        largeMobile: { width: 414, height: 896, isMobile: true, hasTouch: true },
        smallTablet: { width: 600, height: 960, isMobile: true, hasTouch: true },
        largeDesktop: { width: 1920, height: 1080, isMobile: false, hasTouch: false }
    };
    
    const BREAKPOINTS = {
        xs: 0,
        sm: 576,
        md: 768,
        lg: 992,
        xl: 1200,
        xxl: 1400
    };
    
    const MIN_TOUCH_TARGET_SIZE = 44; // Minimum touch target size in pixels
    const PERFORMANCE_THRESHOLDS = {
        loadTime: 3000, // 3 seconds
        renderTime: 1000, // 1 second
        interactionTime: 100 // 100ms
    };
    
    // Valid JWT token for testing authenticated routes
    const testToken = jwt.sign(
        { id: 1, email: 'test@example.com' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
    );
    
    before(async function() {
        // Start server
        server = http.createServer(app);
        await new Promise(resolve => {
            server.listen(PORT, resolve);
        });
        
        // Launch browser
        browser = await puppeteer.launch({
            headless: process.env.NODE_ENV === 'production',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
    });
    
    after(async function() {
        if (browser) {
            await browser.close();
        }
        if (server) {
            server.close();
        }
    });
    
    beforeEach(async function() {
        page = await browser.newPage();
        
        // Enable request interception for performance monitoring
        await page.setRequestInterception(true);
        page.on('request', request => {
            request.continue();
        });
        
        // Set user agent for consistent testing
        await page.setUserAgent('Mozilla/5.0 (compatible; MaterialDesignTest/1.0)');
    });
    
    afterEach(async function() {
        if (page) {
            await page.close();
        }
    });
    
    describe('Mobile Breakpoint Testing', function() {
        beforeEach(async function() {
            await page.setViewport(VIEWPORTS.mobile);
        });
        
        it('should display login page correctly on mobile', async function() {
            const startTime = Date.now();
            await page.goto(`${BASE_URL}/login`);
            const loadTime = Date.now() - startTime;
            
            expect(loadTime).to.be.below(PERFORMANCE_THRESHOLDS.loadTime);
            
            // Check Material Design card layout
            const card = await page.$('.md-card');
            expect(card).to.not.be.null;
            
            const cardStyles = await page.evaluate(() => {
                const card = document.querySelector('.md-card');
                const styles = window.getComputedStyle(card);
                return {
                    width: styles.width,
                    margin: styles.margin,
                    padding: styles.padding,
                    borderRadius: styles.borderRadius,
                    boxShadow: styles.boxShadow
                };
            });
            
            // Verify Material Design properties
            expect(cardStyles.borderRadius).to.match(/8px/);
            expect(cardStyles.boxShadow).to.include('rgba');
            
            // Check form elements are properly sized for mobile
            const formElements = await page.$$('.md-text-field, .md-button');
            for (const element of formElements) {
                const box = await element.boundingBox();
                expect(box.height).to.be.at.least(MIN_TOUCH_TARGET_SIZE);
            }
        });
        
        it('should adapt navigation menu for mobile screens', async function() {
            // Set authentication cookie
            await page.setCookie({
                name: 'token',
                value: testToken,
                domain: 'localhost',
                path: '/'
            });
            
            await page.goto(`${BASE_URL}/profile`);
            
            // Check mobile navigation toggle exists and is visible
            const navToggle = await page.$('.md-navbar-toggle');
            expect(navToggle).to.not.be.null;
            
            const toggleVisible = await page.evaluate(() => {
                const toggle = document.querySelector('.md-navbar-toggle');
                const styles = window.getComputedStyle(toggle);
                return styles.display !== 'none';
            });
            
            expect(toggleVisible).to.be.true;
            
            // Test mobile menu toggle functionality
            await navToggle.click();
            await page.waitForTimeout(300); // Wait for animation
            
            const navMenu = await page.$('.md-navbar-nav');
            const menuStyles = await page.evaluate(() => {
                const menu = document.querySelector('.md-navbar-nav');
                return window.getComputedStyle(menu);
            });
            
            // Verify mobile menu behavior
            expect(menuStyles.display).to.match(/none|flex|block/);
        });
        
        it('should scale Material Design typography appropriately on mobile', async function() {
            await page.goto(`${BASE_URL}/`);
            
            const typographyElements = await page.evaluate(() => {
                const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, .md-display-small, .md-headline-small, .md-body-large');
                return Array.from(elements).map(el => {
                    const styles = window.getComputedStyle(el);
                    return {
                        tagName: el.tagName,
                        className: el.className,
                        fontSize: parseFloat(styles.fontSize),
                        lineHeight: parseFloat(styles.lineHeight),
                        fontWeight: styles.fontWeight
                    };
                });
            });
            
            // Verify typography scaling
            typographyElements.forEach(element => {
                expect(element.fontSize).to.be.at.least(14); // Minimum readable size
                expect(element.lineHeight).to.be.at.least(element.fontSize * 1.2); // Proper line height
            });
        });
        
        it('should maintain proper spacing using 8dp grid on mobile', async function() {
            await page.goto(`${BASE_URL}/signup`);
            
            const spacingValues = await page.evaluate(() => {
                const elements = document.querySelectorAll('.md-margin-bottom-sm, .md-margin-bottom-md, .md-margin-bottom-lg, .md-padding-md');
                return Array.from(elements).map(el => {
                    const styles = window.getComputedStyle(el);
                    return {
                        marginBottom: parseFloat(styles.marginBottom),
                        paddingTop: parseFloat(styles.paddingTop),
                        paddingBottom: parseFloat(styles.paddingBottom),
                        paddingLeft: parseFloat(styles.paddingLeft),
                        paddingRight: parseFloat(styles.paddingRight)
                    };
                });
            });
            
            // Check spacing follows 8dp grid system
            spacingValues.forEach(spacing => {
                Object.values(spacing).forEach(value => {
                    if (value > 0) {
                        expect(value % 8).to.equal(0, `Spacing value ${value} should follow 8dp grid`);
                    }
                });
            });
        });
    });
    
    describe('Tablet Responsiveness Testing', function() {
        beforeEach(async function() {
            await page.setViewport(VIEWPORTS.tablet);
        });
        
        it('should adapt card layouts for tablet screen size', async function() {
            // Set authentication cookie
            await page.setCookie({
                name: 'token',
                value: testToken,
                domain: 'localhost',
                path: '/'
            });
            
            await page.goto(`${BASE_URL}/dashboard`);
            
            const cardLayout = await page.evaluate(() => {
                const cards = document.querySelectorAll('.md-card');
                const container = document.querySelector('.md-container');
                const containerStyles = window.getComputedStyle(container);
                
                return {
                    cardCount: cards.length,
                    containerWidth: parseFloat(containerStyles.width),
                    maxWidth: containerStyles.maxWidth,
                    padding: containerStyles.padding
                };
            });
            
            // Verify responsive container behavior
            expect(cardLayout.containerWidth).to.be.above(600);
            expect(cardLayout.maxWidth).to.not.equal('none');
        });
        
        it('should maintain Material Design elevation on tablet', async function() {
            await page.goto(`${BASE_URL}/login`);
            
            const elevationStyles = await page.evaluate(() => {
                const cards = document.querySelectorAll('.md-card, .md-elevation-2, .md-elevation-4');
                return Array.from(cards).map(card => {
                    const styles = window.getComputedStyle(card);
                    return {
                        boxShadow: styles.boxShadow,
                        borderRadius: styles.borderRadius,
                        backgroundColor: styles.backgroundColor
                    };
                });
            });
            
            elevationStyles.forEach(style => {
                expect(style.boxShadow).to.include('rgba');
                expect(style.borderRadius).to.match(/\d+px/);
                expect(style.backgroundColor).to.not.equal('transparent');
            });
        });
        
        it('should handle intermediate screen sizes properly', async function() {
            // Test small tablet size
            await page.setViewport(VIEWPORTS.smallTablet);
            await page.goto(`${BASE_URL}/`);
            
            const layoutProperties = await page.evaluate(() => {
                const hero = document.querySelector('.md-hero');
                const features = document.querySelectorAll('.md-feature-card');
                
                return {
                    heroHeight: hero ? window.getComputedStyle(hero).height : '0px',
                    featureCardWidths: Array.from(features).map(card => 
                        window.getComputedStyle(card).width
                    ),
                    flexDirection: hero ? window.getComputedStyle(hero).flexDirection : 'column'
                };
            });
            
            // Verify responsive behavior at intermediate breakpoint
            expect(layoutProperties.heroHeight).to.not.equal('0px');
            expect(layoutProperties.flexDirection).to.match(/column|row/);
        });
    });
    
    describe('Desktop Layout Testing', function() {
        beforeEach(async function() {
            await page.setViewport(VIEWPORTS.desktop);
        });
        
        it('should display full Material Design implementation on desktop', async function() {
            await page.goto(`${BASE_URL}/`);
            
            const desktopLayout = await page.evaluate(() => {
                const hero = document.querySelector('.md-hero');
                const features = document.querySelectorAll('.md-feature-card');
                const navbar = document.querySelector('.md-navbar');
                
                const heroStyles = hero ? window.getComputedStyle(hero) : {};
                const navbarStyles = navbar ? window.getComputedStyle(navbar) : {};
                
                return {
                    heroDisplay: heroStyles.display,
                    heroFlexDirection: heroStyles.flexDirection,
                    navbarDisplay: navbarStyles.display,
                    featureCount: features.length,
                    containerMaxWidth: window.getComputedStyle(document.querySelector('.md-container')).maxWidth
                };
            });
            
            expect(desktopLayout.heroDisplay).to.not.equal('none');
            expect(desktopLayout.navbarDisplay).to.not.equal('none');
            expect(desktopLayout.containerMaxWidth).to.not.equal('none');
        });
        
        it('should handle large screen layouts correctly', async function() {
            await page.setViewport(VIEWPORTS.largeDesktop);
            
            // Set authentication cookie
            await page.setCookie({
                name: 'token',
                value: testToken,
                domain: 'localhost',
                path: '/'
            });
            
            await page.goto(`${BASE_URL}/profile`);
            
            const largeScreenLayout = await page.evaluate(() => {
                const profileCard = document.querySelector('.md-card');
                const container = document.querySelector('.md-container');
                
                return {
                    cardWidth: window.getComputedStyle(profileCard).width,
                    cardMaxWidth: window.getComputedStyle(profileCard).maxWidth,
                    containerWidth: window.getComputedStyle(container).width,
                    containerMaxWidth: window.getComputedStyle(container).maxWidth
                };
            });
            
            // Verify content doesn't stretch too wide on large screens
            expect(parseFloat(largeScreenLayout.containerWidth)).to.be.below(1920);
        });
        
        it('should display navigation menu properly on desktop', async function() {
            // Set authentication cookie
            await page.setCookie({
                name: 'token',
                value: testToken,
                domain: 'localhost',
                path: '/'
            });
            
            await page.goto(`${BASE_URL}/dashboard`);
            
            const navProperties = await page.evaluate(() => {
                const navToggle = document.querySelector('.md-navbar-toggle');
                const navMenu = document.querySelector('.md-navbar-nav');
                const navItems = document.querySelectorAll('.md-navbar-item');
                
                return {
                    toggleDisplay: navToggle ? window.getComputedStyle(navToggle).display : 'none',
                    menuDisplay: navMenu ? window.getComputedStyle(navMenu).display : 'none',
                    itemCount: navItems.length,
                    menuFlexDirection: navMenu ? window.getComputedStyle(navMenu).flexDirection : 'row'
                };
            });
            
            // Desktop should hide mobile toggle and show full menu
            expect(navProperties.toggleDisplay).to.equal('none');
            expect(navProperties.menuDisplay).to.not.equal('none');
            expect(navProperties.itemCount).to.be.at.least(3);
        });
    });
    
    describe('Touch Interaction Testing', function() {
        beforeEach(async function() {
            await page.setViewport(VIEWPORTS.mobile);
        });
        
        it('should handle touch interactions on Material Design buttons', async function() {
            await page.goto(`${BASE_URL}/login`);
            
            // Test button touch targets
            const buttons = await page.$$('.md-button');
            
            for (const button of buttons) {
                const box = await button.boundingBox();
                expect(box.width).to.be.at.least(MIN_TOUCH_TARGET_SIZE);
                expect(box.height).to.be.at.least(MIN_TOUCH_TARGET_SIZE);
                
                // Test touch interaction
                const startTime = Date.now();
                await button.tap();
                const interactionTime = Date.now() - startTime;
                
                expect(interactionTime).to.be.below(PERFORMANCE_THRESHOLDS.interactionTime);
            }
        });
        
        it('should provide appropriate touch feedback', async function() {
            await page.goto(`${BASE_URL}/signup`);
            
            // Test touch ripple effect or hover states
            const touchElements = await page.$$('.md-button, .md-text-field');
            
            for (const element of touchElements) {
                await element.hover();
                
                // Check for visual feedback
                const hasHoverState = await page.evaluate((el) => {
                    const styles = window.getComputedStyle(el, ':hover');
                    return styles.backgroundColor !== window.getComputedStyle(el).backgroundColor ||
                           styles.boxShadow !== window.getComputedStyle(el).boxShadow;
                }, element);
                
                expect(hasHoverState).to.be.true;
            }
        });
        
        it('should handle touch scrolling smoothly', async function() {
            // Set authentication cookie
            await page.setCookie({
                name: 'token',
                value: testToken,
                domain: 'localhost',
                path: '/'
            });
            
            await page.goto(`${BASE_URL}/profile`);
            
            // Simulate touch scroll
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight / 2);
            });
            
            await page.waitForTimeout(300); // Wait for smooth scroll
            
            const scrollPosition = await page.evaluate(() => window.pageYOffset);
            expect(scrollPosition).to.be.above(0);
        });
    });
    
    describe('Viewport Adaptation Testing', function() {
        it('should adapt layout when viewport changes', async function() {
            await page.goto(`${BASE_URL}/`);
            
            // Start with desktop
            await page.setViewport(VIEWPORTS.desktop);
            const desktopLayout = await page.evaluate(() => {
                const hero = document.querySelector('.md-hero');
                return hero ? window.getComputedStyle(hero).flexDirection : 'row';
            });
            
            // Change to mobile
            await page.setViewport(VIEWPORTS.mobile);
            await page.waitForTimeout(500); // Wait for layout recalculation
            
            const mobileLayout = await page.evaluate(() => {
                const hero = document.querySelector('.md-hero');
                return hero ? window.getComputedStyle(hero).flexDirection : 'column';
            });
            
            // Layout should adapt to viewport change
            expect(desktopLayout).to.not.equal(mobileLayout);
        });
        
        it('should maintain Material Design consistency across viewports', async function() {
            const viewports = [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop];
            const consistencyData = [];
            
            for (const viewport of viewports) {
                await page.setViewport(viewport);
                await page.goto(`${BASE_URL}/login`);
                
                const materialProperties = await page.evaluate(() => {
                    const card = document.querySelector('.md-card');
                    const button = document.querySelector('.md-button');
                    
                    return {
                        cardBorderRadius: card ? window.getComputedStyle(card).borderRadius : '0px',
                        cardBoxShadow: card ? window.getComputedStyle(card).boxShadow : 'none',
                        buttonBorderRadius: button ? window.getComputedStyle(button).borderRadius : '0px',
                        primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--md-primary')
                    };
                });
                
                consistencyData.push(materialProperties);
            }
            
            // Verify consistency across viewports
            const firstViewport = consistencyData[0];
            consistencyData.forEach(data => {
                expect(data.cardBorderRadius).to.equal(firstViewport.cardBorderRadius);
                expect(data.buttonBorderRadius).to.equal(firstViewport.buttonBorderRadius);
                expect(data.primaryColor).to.equal(firstViewport.primaryColor);
            });
        });
    });
    
    describe('Typography Scaling Testing', function() {
        it('should scale typography appropriately across devices', async function() {
            const viewports = [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop];
            const typographyData = [];
            
            for (const viewport of viewports) {
                await page.setViewport(viewport);
                await page.goto(`${BASE_URL}/`);
                
                const typography = await page.evaluate(() => {
                    const heading = document.querySelector('h1');
                    const body = document.querySelector('.md-body-large, p');
                    
                    return {
                        headingSize: heading ? parseFloat(window.getComputedStyle(heading).fontSize) : 0,
                        bodySize: body ? parseFloat(window.getComputedStyle(body).fontSize) : 0,
                        viewportWidth: window.innerWidth
                    };
                });
                
                typographyData.push(typography);
            }
            
            // Verify typography scales with viewport
            typographyData.sort((a, b) => a.viewportWidth - b.viewportWidth);
            
            for (let i = 1; i < typographyData.length; i++) {
                expect(typographyData[i].headingSize).to.be.at.least(typographyData[i-1].headingSize - 2);
                expect(typographyData[i].bodySize).to.be.at.least(14); // Minimum readable size
            }
        });
        
        it('should maintain readable line heights across devices', async function() {
            const viewports = [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop];
            
            for (const viewport of viewports) {
                await page.setViewport(viewport);
                await page.goto(`${BASE_URL}/`);
                
                const lineHeights = await page.evaluate(() => {
                    const textElements = document.querySelectorAll('h1, h2, h3, p, .md-body-large');
                    return Array.from(textElements).map(el => {
                        const styles = window.getComputedStyle(el);
                        return {
                            fontSize: parseFloat(styles.fontSize),
                            lineHeight: parseFloat(styles.lineHeight),
                            ratio: parseFloat(styles.lineHeight) / parseFloat(styles.fontSize)
                        };
                    });
                });
                
                lineHeights.forEach(data => {
                    expect(data.ratio).to.be.at.least(1.2); // Minimum readable line height ratio
                    expect(data.ratio).to.be.at.most(2.0); // Maximum reasonable line height ratio
                });
            }
        });
    });
    
    describe('Button Accessibility Testing', function() {
        it('should meet minimum touch target sizes on all devices', async function() {
            const viewports = [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop];
            
            for (const viewport of viewports) {
                await page.setViewport(viewport);
                await page.goto(`${BASE_URL}/login`);
                
                const buttons = await page.$$('.md-button, button');
                
                for (const button of buttons) {
                    const box = await button.boundingBox();
                    
                    if (viewport.isMobile) {
                        expect(box.width).to.be.at.least(MIN_TOUCH_TARGET_SIZE);
                        expect(box.height).to.be.at.least(MIN_TOUCH_TARGET_SIZE);
                    } else {
                        expect(box.width).to.be.at.least(32); // Desktop minimum
                        expect(box.height).to.be.at.least(32);
                    }
                }
            }
        });
        
        it('should provide keyboard accessibility for buttons', async function() {
            await page.setViewport(VIEWPORTS.desktop);
            await page.goto(`${BASE_URL}/signup`);
            
            // Test keyboard navigation
            await page.keyboard.press('Tab');
            
            const focusedElement = await page.evaluate(() => {
                return {
                    tagName: document.activeElement.tagName,
                    className: document.activeElement.className,
                    hasOutline: window.getComputedStyle(document.activeElement).outline !== 'none'
                };
            });
            
            expect(['BUTTON', 'INPUT', 'A']).to.include(focusedElement.tagName);
        });
    });
    
    describe('Form Usability Testing', function() {
        it('should provide usable forms on mobile devices', async function() {
            await page.setViewport(VIEWPORTS.mobile);
            await page.goto(`${BASE_URL}/signup`);
            
            const formElements = await page.$$('input, textarea');
            
            for (const element of formElements) {
                const box = await element.boundingBox();
                expect(box.height).to.be.at.least(44); // Mobile touch target
                
                // Test focus behavior
                await element.click();
                const isFocused = await page.evaluate((el) => {
                    return document.activeElement === el;
                }, element);
                
                expect(isFocused).to.be.true;
            }
        });
        
        it('should handle virtual keyboard properly on mobile', async function() {
            await page.setViewport(VIEWPORTS.mobile);
            await page.goto(`${BASE_URL}/login`);
            
            // Focus on input field
            await page.focus('#email');
            
            // Check viewport adjustments
            const viewportHeight = await page.evaluate(() => window.innerHeight);
            expect(viewportHeight).to.be.above(300); // Should maintain usable viewport
        });
    });
    
    describe('Navigation Responsiveness Testing', function() {
        it('should adapt navigation across all screen sizes', async function() {
            const viewports = [VIEWPORTS.mobile, VIEWPORTS.tablet, VIEWPORTS.desktop];
            
            // Set authentication cookie
            await page.setCookie({
                name: 'token',
                value: testToken,
                domain: 'localhost',
                path: '/'
            });
            
            for (const viewport of viewports) {
                await page.setViewport(viewport);
                await page.goto(`${BASE_URL}/dashboard`);
                
                const navState = await page.evaluate(() => {
                    const toggle = document.querySelector('.md-navbar-toggle');
                    const menu = document.querySelector('.md-navbar-nav');
                    
                    return {
                        toggleVisible: toggle ? window.getComputedStyle(toggle).display !== 'none' : false,
                        menuDisplay: menu ? window.getComputedStyle(menu).display : 'none',
                        isMobile: window.innerWidth < 768
                    };
                });
                
                if (navState.isMobile) {
                    expect(navState.toggleVisible).to.be.true;
                } else {
                    expect(navState.toggleVisible).to.be.false;
                    expect(navState.menuDisplay).to.not.equal('none');
                }
            }
        });
        
        it('should maintain active states in responsive navigation', async function() {
            // Set authentication cookie
            await page.setCookie({
                name: 'token',
                value: testToken,
                domain: 'localhost',
                path: '/'
            });
            
            await page.setViewport(VIEWPORTS.mobile);
            await page.goto(`${BASE_URL}/profile`);
            
            const activeState = await page.evaluate(() => {
                const activeLink = document.querySelector('.md-navbar-link.active');
                return {
                    exists: !!activeLink,
                    href: activeLink ? activeLink.getAttribute('href') : null,
                    styles: activeLink ? {
                        color: window.getComputedStyle(activeLink).color,
                        backgroundColor: window.getComputedStyle(activeLink).backgroundColor
                    } : null
                };
            });
            
            expect(activeState.exists).to.be.true;
            expect(activeState.href).to.equal('/profile');
        });
        
        it('should toggle mobile navigation menu correctly', async function() {
            await page.setViewport(VIEWPORTS.mobile);
            await page.goto(`${BASE_URL}/`);
            
            const navToggle = await page.$('.md-navbar-toggle');
            if (navToggle) {
                // Test menu toggle functionality
                await navToggle.click();
                await page.waitForTimeout(300); // Wait for animation
                
                const menuExpanded = await page.evaluate(() => {
                    const menu = document.querySelector('.md-navbar-nav');
                    const toggle = document.querySelector('.md-navbar-toggle');
                    return {
                        menuVisible: menu ? window.getComputedStyle(menu).display !== 'none' : false,
                        ariaExpanded: toggle ? toggle.getAttribute('aria-expanded') : null
                    };
                });
                
                expect(menuExpanded.menuVisible || menuExpanded.ariaExpanded === 'true').to.be.true;
            }
        });
    });
    
    describe('Performance Testing', function() {
        it('should load Material Design CSS efficiently', async function() {
            const metrics = [];
            
            await page.tracing.start({ path: 'performance-trace.json' });
            
            const startTime = Date.now();
            await page.goto(`${BASE_URL}/`);
            await page.waitForSelector('.md-card', { timeout: 5000 });
            const loadTime = Date.now() - startTime;
            
            await page.tracing.stop();
            
            expect(loadTime).to.be.below(PERFORMANCE_THRESHOLDS.loadTime);
            
            // Check CSS loading performance
            const cssMetrics = await page.evaluate(() => {
                const styleSheets = Array.from(document.styleSheets);
                return styleSheets.map(sheet => {
                    try {
                        return {
                            href: sheet.href,
                            rules: sheet.cssRules ? sheet.cssRules.length : 0
                        };
                    } catch (e) {
                        return { href: sheet.href, rules: 0, error: e.message };
                    }
                });
            });
            
            const materialCSS = cssMetrics.find(sheet => 
                sheet.href && sheet.href.includes('style.css')
            );
            
            expect(materialCSS).to.not.be.undefined;
            expect(materialCSS.rules).to.be.above(0);
        });
        
        it('should maintain smooth animations and transitions', async function() {
            await page.setViewport(VIEWPORTS.desktop);
            await page.goto(`${BASE_URL}/login`);
            
            // Test hover animations
            const button = await page.$('.md-button');
            
            const animationStart = Date.now();
            await button.hover();
            await page.waitForTimeout(100); // Wait for transition
            const animationTime = Date.now() - animationStart;
            
            expect(animationTime).to.be.below(500); // Should be smooth
            
            // Check transition properties
            const transitionData = await page.evaluate(() => {
                const elements = document.querySelectorAll('.md-button, .md-card');
                return Array.from(elements).map(el => {
                    const styles = window.getComputedStyle(el);
                    return {
                        transition: styles.transition,
                        hasTransition: styles.transition !== 'all 0s ease 0s'
                    };
                });
            });
            
            const elementsWithTransitions = transitionData.filter(data => data.hasTransition);
            expect(elementsWithTransitions.length).to.be.above(0);
        });
    });
    
    describe('Cross-browser Compatibility Testing', function() {
        it('should render Material Design consistently across browsers', async function() {
            // This test would ideally run with different browser engines
            await page.goto(`${BASE_URL}/`);
            
            const cssSupport = await page.evaluate(() => {
                const testElement = document.createElement('div');
                testElement.style.cssText = `
                    display: flex;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
                    transition: all 0.3s ease;
                `;
                
                return {
                    flexSupport: testElement.style.display === 'flex',
                    borderRadiusSupport: testElement.style.borderRadius === '8px',
                    boxShadowSupport: testElement.style.boxShadow.includes('rgba'),
                    transitionSupport: testElement.style.transition.includes('ease')
                };
            });
            
            expect(cssSupport.flexSupport).to.be.true;
            expect(cssSupport.borderRadiusSupport).to.be.true;
            expect(cssSupport.boxShadowSupport).to.be.true;
            expect(cssSupport.transitionSupport).to.be.true;
        });
        
        it('should handle CSS custom properties correctly', async function() {
            await page.goto(`${BASE_URL}/`);
            
            const customProperties = await page.evaluate(() => {
                const rootStyles = getComputedStyle(document.documentElement);
                return {
                    primaryColor: rootStyles.getPropertyValue('--md-primary').trim(),
                    spacing: rootStyles.getPropertyValue('--md-spacing-md').trim(),
                    elevation: rootStyles.getPropertyValue('--md-elevation-2').trim()
                };
            });
            
            expect(customProperties.primaryColor).to.not.be.empty;
            expect(customProperties.spacing).to.not.be.empty;
            expect(customProperties.elevation).to.not.be.empty;
        });
    });
    
    describe('Accessibility Compliance Testing', function() {
        it('should meet WCAG AA color contrast requirements', async function() {
            await page.goto(`${BASE_URL}/`);
            
            const contrastResults = await page.evaluate(() => {
                // Simple contrast ratio calculation
                const getContrastRatio = (color1, color2) => {
                    const getLuminance = (r, g, b) => {
                        const [rs, gs, bs] = [r, g, b].map(c => {
                            c = c / 255;
                            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
                        });
                        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
                    };
                    
                    const parseRgb = (rgb) => {
                        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                        return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0];
                    };
                    
                    const [r1, g1, b1] = parseRgb(color1);
                    const [r2, g2, b2] = parseRgb(color2);
                    
                    const lum1 = getLuminance(r1, g1, b1);
                    const lum2 = getLuminance(r2, g2, b2);
                    
                    const brightest = Math.max(lum1, lum2);
                    const darkest = Math.min(lum1, lum2);
                    
                    return (brightest + 0.05) / (darkest + 0.05);
                };
                
                const textElements = document.querySelectorAll('h1, h2, h3, p, a, button, .md-text-primary, .md-text-secondary');
                const results = [];
                
                Array.from(textElements).forEach(el => {
                    const styles = window.getComputedStyle(el);
                    const color = styles.color;
                    const backgroundColor = styles.backgroundColor;
                    
                    if (color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
                        const contrast = getContrastRatio(color, backgroundColor);
                        results.push({
                            element: el.tagName + (el.className ? '.' + el.className : ''),
                            contrast: contrast,
                            meetsAA: contrast >= 4.5
                        });
                    }
                });
                
                return results;
            });
            
            contrastResults.forEach(result => {
                expect(result.meetsAA).to.be.true, 
                    `${result.element} contrast ratio ${result.contrast} should meet WCAG AA (4.5:1)`);
            });
        });
        
        it('should provide proper ARIA labels and roles', async function() {
            // Set authentication cookie
            await page.setCookie({
                name: 'token',
                value: testToken,
                domain: 'localhost',
                path: '/'
            });
            
            await page.goto(`${BASE_URL}/profile`);
            
            const accessibilityFeatures = await page.evaluate(() => {
                const nav = document.querySelector('nav');
                const buttons = document.querySelectorAll('button');
                const links = document.querySelectorAll('a');
                const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
                
                return {
                    navHasRole: nav ? nav.hasAttribute('role') : false,
                    navHasAriaLabel: nav ? nav.hasAttribute('aria-label') : false,
                    buttonsWithAriaLabel: Array.from(buttons).filter(btn => btn.hasAttribute('aria-label')).length,
                    linksWithAriaLabel: Array.from(links).filter(link => link.hasAttribute('aria-label')).length,
                    headingsWithId: Array.from(headings).filter(h => h.hasAttribute('id')).length,
                    totalButtons: buttons.length,
                    totalLinks: links.length,
                    totalHeadings: headings.length
                };
            });
            
            expect(accessibilityFeatures.navHasRole).to.be.true;
            expect(accessibilityFeatures.navHasAriaLabel).to.be.true;
            expect(accessibilityFeatures.headingsWithId).to.be.at.least(1);
        });
        
        it('should support keyboard navigation', async function() {
            await page.setViewport(VIEWPORTS.desktop);
            await page.goto(`${BASE_URL}/login`);
            
            // Test keyboard tab navigation
            await page.keyboard.press('Tab');
            let focusedElement = await page.evaluate(() => {
                return {
                    tagName: document.activeElement.tagName,
                    type: document.activeElement.type,
                    id: document.activeElement.id
                };
            });
            
            expect(['INPUT', 'BUTTON', 'A']).to.include(focusedElement.tagName);
            
            // Continue tabbing through form
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            
            focusedElement = await page.evaluate(() => {
                return {
                    tagName: document.activeElement.tagName,
                    canFocus: document.activeElement.tabIndex >= 0
                };
            });
            
            expect(focusedElement.canFocus).to.be.true;
        });
    });
    
    describe('Edge Case Testing', function() {
        it('should handle viewport rotation on mobile devices', async function() {
            await page.setViewport(VIEWPORTS.mobile);
            await page.goto(`${BASE_URL}/login`);
            
            // Test portrait orientation
            const portraitLayout = await page.evaluate(() => {
                return {
                    orientation: window.innerWidth < window.innerHeight ? 'portrait' : 'landscape',
                    cardWidth: document.querySelector('.md-card') ? 
                        window.getComputedStyle(document.querySelector('.md-card')).width : '0px'
                };
            });
            
            // Simulate landscape rotation
            await page.setViewport({ width: 667, height: 375, isMobile: true, hasTouch: true });
            await page.waitForTimeout(500);
            
            const landscapeLayout = await page.evaluate(() => {
                return {
                    orientation: window.innerWidth < window.innerHeight ? 'portrait' : 'landscape',
                    cardWidth: document.querySelector('.md-card') ? 
                        window.getComputedStyle(document.querySelector('.md-card')).width : '0px'
                };
            });
            
            expect(portraitLayout.orientation).to.equal('portrait');
            expect(landscapeLayout.orientation).to.equal('landscape');
            expect(landscapeLayout.cardWidth).to.not.equal('0px');
        });
        
        it('should handle extreme viewport sizes gracefully', async function() {
            // Test very small viewport
            await page.setViewport({ width: 240, height: 320, isMobile: true, hasTouch: true });
            await page.goto(`${BASE_URL}/signup`);
            
            const smallViewportLayout = await page.evaluate(() => {
                const card = document.querySelector('.md-card');
                const formElements = document.querySelectorAll('input, button');
                return {
                    cardOverflows: card ? card.offsetWidth > window.innerWidth : false,
                    elementsVisible: Array.from(formElements).every(el => el.offsetHeight > 0)
                };
            });
            
            expect(smallViewportLayout.cardOverflows).to.be.false;
            expect(smallViewportLayout.elementsVisible).to.be.true;
            
            // Test very large viewport
            await page.setViewport({ width: 2560, height: 1440, isMobile: false, hasTouch: false });
            
            const largeViewportLayout = await page.evaluate(() => {
                const container = document.querySelector('.md-container');
                return {
                    containerCentered: container ? container.offsetLeft > 0 : false,
                    maxWidthApplied: container ? 
                        parseFloat(window.getComputedStyle(container).maxWidth) < window.innerWidth : false
                };
            });
            
            expect(largeViewportLayout.containerCentered).to.be.true;
            expect(largeViewportLayout.maxWidthApplied).to.be.true;
        });
    });
    
    describe('Material Design Color Scheme Testing', function() {
        it('should support light theme consistently', async function() {
            await page.goto(`${BASE_URL}/`);
            
            const lightThemeColors = await page.evaluate(() => {
                const rootStyles = getComputedStyle(document.documentElement);
                const body = document.body;
                
                return {
                    primary: rootStyles.getPropertyValue('--md-primary').trim(),
                    surface: rootStyles.getPropertyValue('--md-surface').trim(),
                    background: rootStyles.getPropertyValue('--md-background').trim(),
                    textPrimary: rootStyles.getPropertyValue('--md-text-primary').trim(),
                    bodyBackground: window.getComputedStyle(body).backgroundColor
                };
            });
            
            expect(lightThemeColors.primary).to.not.be.empty;
            expect(lightThemeColors.surface).to.not.be.empty;
            expect(lightThemeColors.background).to.not.be.empty;
            expect(lightThemeColors.textPrimary).to.not.be.empty;
        });
        
        it('should maintain color accessibility across all pages', async function() {
            const pages = ['/', '/login', '/signup'];
            
            for (const pagePath of pages) {
                await page.goto(`${BASE_URL}${pagePath}`);
                
                const colorAccessibility = await page.evaluate(() => {
                    const elements = document.querySelectorAll('h1, h2, p, a, button');
                    return Array.from(elements).map(el => {
                        const styles = window.getComputedStyle(el);
                        const color = styles.color;
                        const backgroundColor = styles.backgroundColor;
                        
                        // Simple check for readable colors
                        return {
                            element: el.tagName,
                            hasColor: color !== 'rgba(0, 0, 0, 0)',
                            hasBackground: backgroundColor !== 'rgba(0, 0, 0, 0)',
                            colorValue: color,
                            backgroundValue: backgroundColor
                        };
                    });
                });
                
                colorAccessibility.forEach(result => {
                    expect(result.hasColor).to.be.true;
                    expect(result.colorValue).to.not.equal('rgba(0, 0, 0, 0)');
                });
            }
        });
    });
    
    describe('Interactive Component Testing', function() {
        it('should handle form validation messages responsively', async function() {
            await page.goto(`${BASE_URL}/signup`);
            
            // Trigger validation by submitting empty form
            await page.click('.md-button[type="submit"]');
            await page.waitForTimeout(500);
            
            const validationMessages = await page.evaluate(() => {
                const messages = document.querySelectorAll('.error-message, .md-error');
                return Array.from(messages).map(msg => {
                    const styles = window.getComputedStyle(msg);
                    return {
                        visible: styles.display !== 'none',
                        readable: parseFloat(styles.fontSize) >= 12,
                        positioned: styles.position !== 'static'
                    };
                });
            });
            
            validationMessages.forEach(message => {
                if (message.visible) {
                    expect(message.readable).to.be.true;
                }
            });
        });
        
        it('should handle loading states appropriately', async function() {
            await page.goto(`${BASE_URL}/login`);
            
            // Fill form and submit to test loading state
            await page.type('#email', 'test@example.com');
            await page.type('#password', 'password123');
            
            const button = await page.$('.md-button[type="submit"]');
            await button.click();
            
            // Check for loading indicators
            const loadingState = await page.evaluate(() => {
                const submitButton = document.querySelector('.md-button[type="submit"]');
                const loadingIndicator = document.querySelector('.loading, .spinner, .md-loading');
                
                return {
                    buttonDisabled: submitButton ? submitButton.disabled : false,
                    hasLoadingIndicator: !!loadingIndicator,
                    buttonText: submitButton ? submitButton.textContent.trim() : ''
                };
            });
            
            // Loading states should provide feedback
            expect(loadingState.buttonDisabled || loadingState.hasLoadingIndicator || 
                   loadingState.buttonText.toLowerCase().includes('loading')).to.be.true;
        });
    });
});