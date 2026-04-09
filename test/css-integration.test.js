const request = require('supertest');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

// Import the actual app for testing CSS integration
const app = require('../app');

describe('CSS and Styling Integration Tests', () => {

  describe('AC-19: Main content responsive behavior', () => {
    test('TC-019-1: Main content should adapt to desktop viewport with proper margins', async () => {
      const cssResponse = await request(app).get('/css/style.css');
      expect(cssResponse.status).toBe(200);
      
      const cssContent = cssResponse.text;
      
      // Validate desktop responsive behavior for main content
      expect(cssContent).toContain('.main-content');
      expect(cssContent).toContain('margin-left: 250px');
      expect(cssContent).toContain('min-height: 100vh');
      
      // Check that main content container has proper responsive classes
      const dashboardResponse = await request(app).get('/static/dashboard');
      const $ = cheerio.load(dashboardResponse.text);
      
      const mainContent = $('.main-content');
      expect(mainContent.length).toBe(1);
      
      // Validate container structure for responsive layout
      expect(mainContent.find('.container-fluid').length).toBeGreaterThan(0);
    });

    test('TC-019-2: Main content should adapt to mobile viewport with full width', async () => {
      const cssResponse = await request(app).get('/css/style.css');
      const cssContent = cssResponse.text;
      
      // Validate mobile media queries exist for main content responsiveness
      expect(cssContent).toContain('@media');
      expect(cssContent).toContain('max-width: 768px');
      
      // Check for mobile-specific main content adjustments
      const mobileMediaQuery = cssContent.match(/@media[^{]*max-width:\s*768px[^}]*\{[^}]*\}/g);
      expect(mobileMediaQuery).toBeTruthy();
      
      // Should contain rules to reset margin-left on mobile
      expect(cssContent).toMatch(/@media[\s\S]*max-width:\s*768px[\s\S]*\.main-content[\s\S]*margin-left:\s*0/);
    });

    test('TC-019-3: Main content should handle tablet viewport breakpoints correctly', async () => {
      const cssResponse = await request(app).get('/css/style.css');
      const cssContent = cssResponse.text;
      
      // Check for tablet-specific media queries
      const tabletBreakpoints = ['768px', '992px', '1024px'];
      let hasTabletBreakpoint = false;
      
      tabletBreakpoints.forEach(breakpoint => {
        if (cssContent.includes(breakpoint)) {
          hasTabletBreakpoint = true;
        }
      });
      
      expect(hasTabletBreakpoint).toBe(true);
      
      // Validate that main content positioning is responsive across breakpoints
      expect(cssContent).toMatch(/\.main-content.*\{[\s\S]*transition/);
    });

    test('TC-019-4: Main content should preserve content visibility across all viewport sizes', async () => {
      const dashboardResponse = await request(app).get('/static/dashboard');
      const $ = cheerio.load(dashboardResponse.text);
      
      const mainContent = $('.main-content');
      expect(mainContent.length).toBe(1);
      
      // Check that essential content elements are present
      expect(mainContent.find('h1, h2, h3').length).toBeGreaterThan(0);
      expect(mainContent.text().trim().length).toBeGreaterThan(0);
      
      // Validate that viewport meta tag exists for proper mobile rendering
      const viewportMeta = $('meta[name="viewport"]');
      expect(viewportMeta.length).toBe(1);
      expect(viewportMeta.attr('content')).toContain('width=device-width');
      expect(viewportMeta.attr('content')).toContain('initial-scale=1');
    });

    test('TC-019-5: Main content responsive behavior should handle sidebar toggle states', async () => {
      const cssResponse = await request(app).get('/css/style.css');
      const cssContent = cssResponse.text;
      
      // Check for CSS rules that handle sidebar show/hide states
      expect(cssContent).toMatch(/\.sidebar-collapsed[\s\S]*\.main-content|\.main-content[\s\S]*\.sidebar-collapsed/);
      
      // Validate transition properties for smooth responsive behavior
      expect(cssContent).toMatch(/\.main-content[\s\S]*transition[\s\S]*margin/);
      
      const dashboardResponse = await request(app).get('/static/dashboard');
      const $ = cheerio.load(dashboardResponse.text);
      
      // Check for sidebar toggle functionality elements
      const toggleButton = $('.sidebar-toggle, .navbar-toggler, [data-toggle="sidebar"]');
      expect(toggleButton.length).toBeGreaterThan(0);
    });

    // Error path testing for AC-19
    test('TC-019-E1: Main content should gracefully handle missing CSS responsive rules', async () => {
      const dashboardResponse = await request(app).get('/static/dashboard');
      expect(dashboardResponse.status).toBe(200);
      
      const $ = cheerio.load(dashboardResponse.text);
      
      // Even without CSS, main content structure should exist
      const mainContent = $('.main-content');
      expect(mainContent.length).toBe(1);
      
      // Essential content should still be accessible
      expect(dashboardResponse.text).toContain('Dashboard');
      expect(mainContent.text().trim().length).toBeGreaterThan(0);
    });

    test('TC-019-E2: Main content should handle malformed viewport configurations', async () => {
      const dashboardResponse = await request(app).get('/static/dashboard');
      const $ = cheerio.load(dashboardResponse.text);
      
      const viewportMeta = $('meta[name="viewport"]');
      
      // Should have properly formed viewport meta tag
      expect(viewportMeta.length).toBe(1);
      const content = viewportMeta.attr('content');
      
      // Validate viewport content is not malformed
      expect(content).toBeTruthy();
      expect(content).not.toContain('undefined');
      expect(content).not.toContain('null');
      expect(content.split(',').length).toBeGreaterThanOrEqual(2);
    });

    test('TC-019-E3: Main content should handle CSS load failures gracefully', async () => {
      // Test that page still functions even if CSS fails to load
      const dashboardResponse = await request(app).get('/static/dashboard');
      const $ = cheerio.load(dashboardResponse.text);
      
      // Page should still have semantic HTML structure
      expect($('nav.sidebar').length).toBe(1);
      expect($('.main-content').length).toBe(1);
      expect($('main, .main-content').text().trim().length).toBeGreaterThan(0);
      
      // Critical functionality should remain
      expect(dashboardResponse.text).toContain('Dashboard');
      expect($('.nav-link').length).toBeGreaterThan(0);
    });
  });

  describe('AC-23: CSS Sidebar Positioning', () => {
    test('TC-023-1: CSS file should contain sidebar positioning rules', async () => {
      const cssResponse = await request(app).get('/css/style.css');
      expect(cssResponse.status).toBe(200);
      
      const cssContent = cssResponse.text;
      
      // Check for sidebar specific CSS rules
      expect(cssContent).toContain('.sidebar');
      expect(cssContent).toContain('width: 250px');
      expect(cssContent).toContain('z-index: 1000');
      expect(cssContent).toContain('position-fixed'); // or expect it in HTML classes
    });

    test('TC-023-2: CSS file should contain main-content positioning rules', async () => {
      const cssResponse = await request(app).get('/css/style.css');
      const cssContent = cssResponse.text;
      
      expect(cssContent).toContain('.main-content');
      expect(cssContent).toContain('margin-left: 250px');
      expect(cssContent).toContain('min-height: 100vh');
    });

    test('TC-023-3: CSS file should contain hover effects for nav links', async () => {
      const cssResponse = await request(app).get('/css/style.css');
      const cssContent = cssResponse.text;
      
      expect(cssContent).toContain('.sidebar .nav-link:hover');
      expect(cssContent).toContain('background-color: rgba(255, 255, 255, 0.1)');
      expect(cssContent).toContain('border-radius: 5px');
    });
  });

  describe('Layout CSS Classes Integration', () => {
    test('TC-CSS-001: HTML should properly reference CSS classes for sidebar', async () => {
      const response = await request(app).get('/static/dashboard');
      const $ = cheerio.load(response.text);
      
      const sidebar = $('.sidebar');
      expect(sidebar.hasClass('bg-primary')).toBe(true);
      expect(sidebar.hasClass('text-white')).toBe(true);
      expect(sidebar.hasClass('position-fixed')).toBe(true);
      expect(sidebar.hasClass('h-100')).toBe(true);
    });

    test('TC-CSS-002: HTML should properly reference CSS classes for main content', async () => {
      const response = await request(app).get('/static/dashboard');
      const $ = cheerio.load(response.text);
      
      const mainContent = $('.main-content');
      expect(mainContent.length).toBe(1);
    });

    test('TC-CSS-003: CSS link should be properly included in HTML head', async () => {
      const response = await request(app).get('/static/dashboard');
      const $ = cheerio.load(response.text);
      
      const cssLink = $('link[href="/css/style.css"]');
      expect(cssLink.length).toBe(1);
      expect(cssLink.attr('rel')).toBe('stylesheet');
    });
  });

  describe('Bootstrap Integration', () => {
    test('TC-CSS-004: Bootstrap CSS should be properly included', async () => {
      const response = await request(app).get('/static/dashboard');
      const $ = cheerio.load(response.text);
      
      const bootstrapCSS = $('link[href*="bootstrap"]');
      expect(bootstrapCSS.length).toBeGreaterThan(0);
    });

    test('TC-CSS-005: Bootstrap icons should be properly included', async () => {
      const response = await request(app).get('/static/dashboard');
      const $ = cheerio.load(response.text);
      
      const bootstrapIcons = $('link[href*="bootstrap-icons"]');
      expect(bootstrapIcons.length).toBeGreaterThan(0);
    });

    test('TC-CSS-006: Bootstrap JavaScript should be properly included', async () => {
      const response = await request(app).get('/static/dashboard');
      const $ = cheerio.load(response.text);
      
      const bootstrapJS = $('script[src*="bootstrap"]');
      expect(bootstrapJS.length).toBeGreaterThan(0);
    });
  });

  describe('Mobile Responsiveness', () => {
    test('TC-CSS-007: CSS should contain mobile responsive rules', async () => {
      const cssResponse = await request(app).get('/css/style.css');
      const cssContent = cssResponse.text;
      
      // Should contain media queries for mobile
      expect(cssContent).toContain('@media');
      expect(cssContent).toContain('max-width: 768px');
    });

    test('TC-CSS-008: Mobile sidebar behavior should be defined in CSS', async () => {
      const cssResponse = await request(app).get('/css/style.css');
      const cssContent = cssResponse.text;
      
      // Should contain mobile-specific sidebar rules
      expect(cssContent).toMatch(/@media.*\{[\s\S]*\.sidebar[\s\S]*transform.*translateX/);
    });
  });

  describe('Visual Consistency Tests', () => {
    test('TC-CSS-009: Both static pages should load CSS consistently', async () => {
      const dashboardResponse = await request(app).get('/static/dashboard');
      const logoutResponse = await request(app).get('/static/logout');
      
      const $dash = cheerio.load(dashboardResponse.text);
      const $logout = cheerio.load(logoutResponse.text);
      
      // Both should have the same CSS links
      expect($dash('link[href="/css/style.css"]').length).toBe(1);
      expect($logout('link[href="/css/style.css"]').length).toBe(1);
      
      // Both should have the same Bootstrap CSS
      expect($dash('link[href*="bootstrap"]').length).toBeGreaterThan(0);
      expect($logout('link[href*="bootstrap"]').length).toBeGreaterThan(0);
    });

    test('TC-CSS-010: Sidebar styling should be consistent across pages', async () => {
      const dashboardResponse = await request(app).get('/static/dashboard');
      const logoutResponse = await request(app).get('/static/logout');
      
      const $dash = cheerio.load(dashboardResponse.text);
      const $logout = cheerio.load(logoutResponse.text);
      
      // Sidebar structure should be identical
      expect($dash('.sidebar .sidebar-header').text()).toBe($logout('.sidebar .sidebar-header').text());
      expect($dash('.sidebar .nav-item').length).toBe($logout('.sidebar .nav-item').length);
    });
  });

  describe('Error Cases for CSS', () => {
    test('TC-CSS-E01: Missing CSS should not break page functionality', async () => {
      // Even if CSS fails to load, pages should still render HTML
      const response = await request(app).get('/static/dashboard');
      expect(response.status).toBe(200);
      expect(response.text).toContain('<nav class="sidebar');
      expect(response.text).toContain('Dashboard');
    });

    test('TC-CSS-E02: Invalid CSS requests should return 404', async () => {
      const response = await request(app).get('/css/nonexistent.css');
      expect(response.status).toBe(404);
    });
  });

  describe('Performance and Optimization', () => {
    test('TC-CSS-P01: CSS file should load efficiently', async () => {
      const start = Date.now();
      const response = await request(app).get('/css/style.css');
      const loadTime = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(loadTime).toBeLessThan(1000); // Should load quickly
    });

    test('TC-CSS-P02: CSS should have proper content-type header', async () => {
      const response = await request(app).get('/css/style.css');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/css/);
    });
  });
});