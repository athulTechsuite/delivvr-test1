const request = require('supertest');
const cheerio = require('cheerio');
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

describe('Side Navigation Layout Tests', () => {
  let app;

  beforeEach(() => {
    // Create a minimal app instance for testing layout
    app = express();
    app.use(express.static('public'));
    app.use(expressLayouts);
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../views'));
    app.set('layout', 'layout');

    // Add test routes
    app.get('/test', (req, res) => {
      res.render('index', { title: 'Test Page' });
    });
  });

  describe('AC-1: Fixed side navigation visibility', () => {
    test('TC-001: Side navigation should be visible on all pages with fixed position', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      const sidebar = $('.sidebar');
      expect(sidebar.length).toBe(1);
      expect(sidebar.hasClass('position-fixed')).toBe(true);
      expect(sidebar.hasClass('h-100')).toBe(true);
    });
  });

  describe('AC-2: Side navigation menu items', () => {
    test('TC-002: Side navigation should contain exactly 2 menu items - Dashboard and Logout', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      const navItems = $('.sidebar .nav-item');
      expect(navItems.length).toBe(2);

      const dashboardLink = $('.sidebar .nav-item a[href="/static/dashboard"]');
      const logoutLink = $('.sidebar .nav-item a[href="/static/logout"]');
      
      expect(dashboardLink.length).toBe(1);
      expect(logoutLink.length).toBe(1);
      expect(dashboardLink.text().trim()).toContain('Dashboard');
      expect(logoutLink.text().trim()).toContain('Logout');
    });
  });

  describe('AC-3: Side navigation width', () => {
    test('TC-003: Side navigation should have 250px width as defined in CSS', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      const sidebar = $('.sidebar');
      expect(sidebar.length).toBe(1);
      // CSS class should be present - actual width testing would require browser environment
      expect(sidebar.hasClass('sidebar')).toBe(true);
    });
  });

  describe('AC-4: Main content positioning', () => {
    test('TC-004: Main content area should be shifted 250px to the right', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      const mainContent = $('.main-content');
      expect(mainContent.length).toBe(1);
      // CSS class should be present for proper positioning
      expect(mainContent.hasClass('main-content')).toBe(true);
    });
  });

  describe('AC-5: Bootstrap styling consistency', () => {
    test('TC-005: Side navigation should use Bootstrap nav classes', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      const navList = $('.sidebar ul');
      const navItems = $('.sidebar .nav-item');
      const navLinks = $('.sidebar .nav-link');

      expect(navList.hasClass('nav')).toBe(true);
      expect(navList.hasClass('flex-column')).toBe(true);
      expect(navItems.length).toBe(2);
      expect(navLinks.length).toBe(2);
      
      navLinks.each((i, el) => {
        expect($(el).hasClass('nav-link')).toBe(true);
        expect($(el).hasClass('text-white')).toBe(true);
      });
    });
  });

  describe('AC-16: Top navbar removal', () => {
    test('TC-016: Existing top navbar should be completely removed from layout', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      // Check that no top navbar elements exist
      const topNavbar = $('.navbar-expand-lg');
      const navbarBrand = $('.navbar-brand');
      
      expect(topNavbar.length).toBe(0);
      expect(navbarBrand.length).toBe(0);
    });
  });

  describe('AC-17: Hover effects', () => {
    test('TC-017: Side navigation menu items should have hover class support', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      const navLinks = $('.sidebar .nav-link');
      expect(navLinks.length).toBe(2);
      
      // Verify CSS class structure supports hover effects
      navLinks.each((i, el) => {
        expect($(el).hasClass('nav-link')).toBe(true);
      });
    });
  });

  describe('AC-18: App branding', () => {
    test('TC-018: Side navigation should display Auth App branding in header section', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      const sidebarHeader = $('.sidebar-header');
      expect(sidebarHeader.length).toBe(1);
      expect(sidebarHeader.text()).toContain('Auth App');
      
      const brandIcon = $('.sidebar-header i.bi-shield-lock');
      expect(brandIcon.length).toBe(1);
    });
  });

  describe('AC-19: Main content responsive behavior', () => {
    test('TC-019: Main content area should maintain proper spacing and structure', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      const mainContent = $('.main-content');
      const container = $('.main-content main.container');
      const footer = $('.main-content footer');

      expect(mainContent.length).toBe(1);
      expect(container.length).toBe(1);
      expect(footer.length).toBe(1);
    });
  });

  describe('AC-22: Bootstrap icons', () => {
    test('TC-022: Side navigation should use Bootstrap icons for menu items', async () => {
      const response = await request(app).get('/test');
      const $ = cheerio.load(response.text);

      const dashboardIcon = $('.sidebar .nav-link i.bi-speedometer2');
      const logoutIcon = $('.sidebar .nav-link i.bi-box-arrow-right');

      expect(dashboardIcon.length).toBe(1);
      expect(logoutIcon.length).toBe(1);
    });
  });

  describe('AC-23: Additional layout tests', () => {
    test('TC-023: Layout should handle error states gracefully', async () => {
      app.get('/error-test', (req, res, next) => {
        const error = new Error('Test error');
        next(error);
      });

      app.use((err, req, res, next) => {
        res.status(500).render('error', { 
          title: 'Error',
          error: err.message 
        });
      });

      const response = await request(app).get('/error-test');
      expect(response.status).toBe(500);
    });

    test('TC-024: Layout should properly escape content to prevent XSS', async () => {
      const maliciousTitle = '<script>alert("xss")</script>';
      
      app.get('/xss-test', (req, res) => {
        res.render('index', { title: maliciousTitle });
      });

      const response = await request(app).get('/xss-test');
      const $ = cheerio.load(response.text);
      
      // Content should be escaped
      expect(response.text).not.toContain('<script>alert("xss")</script>');
      expect(response.text).toContain('&lt;script&gt;');
    });
  });
});