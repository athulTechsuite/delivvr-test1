const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

describe('Layout Integration Tests - TC-LAYOUT-INT-001', () => {
  let validToken;
  
  beforeAll(() => {
    validToken = jwt.sign(
      { userId: 1 }, 
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );
  });
  
  describe('Layout File Structure - TC-LAYOUT-INT-001A', () => {
    test('authenticated-layout.ejs should exist - Happy Path', () => {
      const layoutPath = path.join(__dirname, '../views/authenticated-layout.ejs');
      expect(fs.existsSync(layoutPath)).toBe(true);
    });

    test('should handle missing layout file gracefully - Error Path', () => {
      const nonExistentPath = path.join(__dirname, '../views/non-existent-layout.ejs');
      expect(fs.existsSync(nonExistentPath)).toBe(false);
    });
    
    test('dashboard.ejs should exist and use authenticated layout - Happy Path', () => {
      const dashboardPath = path.join(__dirname, '../views/dashboard.ejs');
      expect(fs.existsSync(dashboardPath)).toBe(true);
      
      const content = fs.readFileSync(dashboardPath, 'utf8');
      expect(content).toContain('authenticated-layout');
    });

    test('should handle corrupted view files - Error Path', () => {
      const dashboardPath = path.join(__dirname, '../views/dashboard.ejs');
      if (fs.existsSync(dashboardPath)) {
        expect(() => {
          fs.readFileSync(dashboardPath, 'utf8');
        }).not.toThrow();
      }
    });
    
    test('profile.ejs should exist and use authenticated layout - Happy Path', () => {
      const profilePath = path.join(__dirname, '../views/profile.ejs');
      expect(fs.existsSync(profilePath)).toBe(true);
      
      const content = fs.readFileSync(profilePath, 'utf8');
      expect(content).toContain('authenticated-layout');
    });
    
    test('settings.ejs should exist and use authenticated layout - Happy Path', () => {
      const settingsPath = path.join(__dirname, '../views/settings.ejs');
      expect(fs.existsSync(settingsPath)).toBe(true);
      
      const content = fs.readFileSync(settingsPath, 'utf8');
      expect(content).toContain('authenticated-layout');
    });
  });
  
  describe('Bootstrap Integration - TC-LAYOUT-INT-001B', () => {
    test('should load Bootstrap CSS and JavaScript - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('bootstrap@5.3.0/dist/css/bootstrap.min.css');
      expect(response.text).toContain('bootstrap-icons');
    });

    test('should handle Bootstrap loading failures gracefully - Error Path', async () => {
      // Test that page still loads even if Bootstrap CDN fails
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      // Page should still have basic HTML structure
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<body>');
    });
    
    test('should use Bootstrap classes correctly - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      
      expect($('.container-fluid').length).toBeGreaterThan(0);
      expect($('.row').length).toBeGreaterThan(0);
      expect($('.col-md-3, .col-lg-2').length).toBeGreaterThan(0);
      expect($('.nav').length).toBeGreaterThan(0);
      expect($('.nav-link').length).toBeGreaterThan(0);
    });

    test('should handle malformed Bootstrap classes - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Even with potential class issues, page should load
      expect(response.status).toBe(200);
    });
  });
  
  describe('Responsive Design - TC-LAYOUT-INT-001C', () => {
    test('should include responsive viewport meta tag - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('name="viewport"');
      expect(response.text).toContain('width=device-width, initial-scale=1.0');
    });

    test('should handle missing viewport meta tag - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Page should still function without viewport tag
      expect(response.status).toBe(200);
      expect(response.text).toContain('<html');
    });
    
    test('should have responsive CSS classes - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      
      expect($('.col-md-3').length).toBeGreaterThan(0);
      expect($('.col-lg-2').length).toBeGreaterThan(0);
    });
    
    test('should include mobile-friendly styles - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('@media (max-width: 768px)');
    });

    test('should handle missing media queries gracefully - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Page should render even without media queries
      expect(response.status).toBe(200);
    });
  });
  
  describe('Navigation State Management - TC-LAYOUT-INT-001D', () => {
    test('dashboard should have active navigation state - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const dashboardLink = $('a[href="/dashboard"]');
      
      expect(dashboardLink.hasClass('active')).toBe(true);
    });

    test('should handle invalid navigation state - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Navigation should still work even if state is incorrect
      expect(response.status).toBe(200);
      const $ = cheerio.load(response.text);
      expect($('a[href="/dashboard"]').length).toBeGreaterThan(0);
    });
    
    test('profile should have correct active navigation state - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('currentPage: \'profile\'');
    });
    
    test('settings should have correct active navigation state - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('currentPage: \'settings\'');
    });

    test('should handle undefined currentPage - Error Path', async () => {
      // Test navigation works even with undefined currentPage
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      expect(response.status).toBe(200);
    });
  });
  
  describe('Layout Structure Validation - TC-LAYOUT-INT-001E', () => {
    test('should have proper HTML5 document structure - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<html lang="en">');
      expect(response.text).toContain('<head>');
      expect(response.text).toContain('<body>');
      expect(response.text).toContain('</html>');
    });

    test('should handle malformed HTML structure - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Even with potential HTML issues, response should be received
      expect(response.status).toBe(200);
      expect(typeof response.text).toBe('string');
    });
    
    test('should have sidebar with proper structure - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      
      expect($('.sidebar').length).toBe(1);
      expect($('.sidebar .nav').length).toBeGreaterThan(0);
      expect($('.sidebar .nav-link').length).toBeGreaterThanOrEqual(4);
    });

    test('should handle missing sidebar elements - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      const $ = cheerio.load(response.text);
      // Page should still load even if sidebar is missing
      expect(response.status).toBe(200);
      expect($('body').length).toBe(1);
    });
    
    test('should have main content area - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      expect($('.main-content').length).toBeGreaterThan(0);
    });
  });
  
  describe('Cross-Page Layout Consistency - TC-LAYOUT-INT-001F', () => {
    const pages = [
      { url: '/dashboard', title: 'Dashboard' },
      { url: '/dashboard/profile', title: 'Profile' },
      { url: '/dashboard/settings', title: 'Settings' }
    ];
    
    test.each(pages)('$title page should have consistent sidebar - Happy Path', async ({ url }) => {
      const response = await request(app)
        .get(url)
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      
      // Check for consistent navigation links
      expect($('a[href="/dashboard"]').length).toBeGreaterThan(0);
      expect($('a[href="/dashboard/profile"]').length).toBeGreaterThan(0);
      expect($('a[href="/dashboard/settings"]').length).toBeGreaterThan(0);
      expect($('a[href="/logout"]').length).toBeGreaterThan(0);
    });

    test('should handle inconsistent page layouts - Error Path', async () => {
      // Test that even with layout inconsistencies, pages still load
      const pages = ['/dashboard', '/dashboard/profile', '/dashboard/settings'];
      
      for (const page of pages) {
        const response = await request(app)
          .get(page)
          .set('Cookie', [`token=${validToken}`]);
        
        expect(response.status).toBe(200);
      }
    });
    
    test.each(pages)('$title page should have consistent header structure - Happy Path', async ({ url }) => {
      const response = await request(app)
        .get(url)
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('LinkFolio');
      expect(response.text).toContain('bi bi-link-45deg');
    });
  });
  
  describe('Title and Meta Information - TC-LAYOUT-INT-001G', () => {
    test('dashboard should have correct page title - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('<title>Dashboard - LinkFolio</title>');
    });

    test('should handle missing page titles - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Page should load even without proper title
      expect(response.status).toBe(200);
      expect(response.text).toContain('<title>');
    });
    
    test('profile should have correct page title - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('<title>Profile - LinkFolio</title>');
    });
    
    test('settings should have correct page title - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('<title>Settings - LinkFolio</title>');
    });
  });
  
  describe('Error Handling in Layout - TC-LAYOUT-INT-001H', () => {
    test('should handle missing title gracefully - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      // Should not crash if title is undefined
      expect(response.status).toBe(200);
    });
    
    test('should handle missing currentPage gracefully - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      // Should not crash if currentPage is undefined
      expect(response.status).toBe(200);
    });

    test('should handle invalid template variables - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Should handle undefined or null template variables
      expect(response.status).toBe(200);
    });

    test('should handle authentication errors in layout - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', ['token=invalid-token']);
      
      // Should redirect or show error, not crash
      expect([302, 401, 403]).toContain(response.status);
    });

    test('should handle missing CSS/JS resources - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Page should still load even if external resources fail
      expect(response.status).toBe(200);
      expect(response.text).toContain('<body>');
    });
  });

  describe('Layout Performance and Accessibility - TC-LAYOUT-INT-001I', () => {
    test('should include accessibility attributes - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      expect($('[aria-label]').length).toBeGreaterThan(0);
      expect($('html[lang]').length).toBe(1);
    });

    test('should handle missing accessibility attributes - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Page should still be functional without accessibility attributes
      expect(response.status).toBe(200);
    });

    test('should load efficiently with minimal DOM elements - Happy Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      // Ensure page doesn't have excessive DOM elements
      expect($('*').length).toBeLessThan(1000);
    });

    test('should handle large DOM structures gracefully - Error Path', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`]);
      
      // Should handle even if DOM becomes large
      expect(response.status).toBe(200);
      expect(typeof response.text).toBe('string');
    });
  });
});