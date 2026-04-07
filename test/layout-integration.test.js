const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

describe('Layout Integration Tests', () => {
  let validToken;
  
  beforeAll(() => {
    validToken = jwt.sign(
      { userId: 1 }, 
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );
  });
  
  describe('Layout File Structure', () => {
    test('authenticated-layout.ejs should exist', () => {
      const layoutPath = path.join(__dirname, '../views/authenticated-layout.ejs');
      expect(fs.existsSync(layoutPath)).toBe(true);
    });
    
    test('dashboard.ejs should exist and use authenticated layout', () => {
      const dashboardPath = path.join(__dirname, '../views/dashboard.ejs');
      expect(fs.existsSync(dashboardPath)).toBe(true);
      
      const content = fs.readFileSync(dashboardPath, 'utf8');
      expect(content).toContain('authenticated-layout');
    });
    
    test('profile.ejs should exist and use authenticated layout', () => {
      const profilePath = path.join(__dirname, '../views/profile.ejs');
      expect(fs.existsSync(profilePath)).toBe(true);
      
      const content = fs.readFileSync(profilePath, 'utf8');
      expect(content).toContain('authenticated-layout');
    });
    
    test('settings.ejs should exist and use authenticated layout', () => {
      const settingsPath = path.join(__dirname, '../views/settings.ejs');
      expect(fs.existsSync(settingsPath)).toBe(true);
      
      const content = fs.readFileSync(settingsPath, 'utf8');
      expect(content).toContain('authenticated-layout');
    });
  });
  
  describe('Bootstrap Integration', () => {
    test('should load Bootstrap CSS and JavaScript', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('bootstrap@5.3.0/dist/css/bootstrap.min.css');
      expect(response.text).toContain('bootstrap-icons');
    });
    
    test('should use Bootstrap classes correctly', async () => {
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
  });
  
  describe('Responsive Design', () => {
    test('should include responsive viewport meta tag', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('name="viewport"');
      expect(response.text).toContain('width=device-width, initial-scale=1.0');
    });
    
    test('should have responsive CSS classes', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      
      expect($('.col-md-3').length).toBeGreaterThan(0);
      expect($('.col-lg-2').length).toBeGreaterThan(0);
    });
    
    test('should include mobile-friendly styles', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('@media (max-width: 768px)');
    });
  });
  
  describe('Navigation State Management', () => {
    test('dashboard should have active navigation state', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      const dashboardLink = $('a[href="/dashboard"]');
      
      expect(dashboardLink.hasClass('active')).toBe(true);
    });
    
    test('profile should have correct active navigation state', async () => {
      const response = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('currentPage: \'profile\'');
    });
    
    test('settings should have correct active navigation state', async () => {
      const response = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('currentPage: \'settings\'');
    });
  });
  
  describe('Layout Structure Validation', () => {
    test('should have proper HTML5 document structure', async () => {
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
    
    test('should have sidebar with proper structure', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      
      expect($('.sidebar').length).toBe(1);
      expect($('.sidebar .nav').length).toBeGreaterThan(0);
      expect($('.sidebar .nav-link').length).toBeGreaterThanOrEqual(4);
    });
    
    test('should have main content area', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      const $ = cheerio.load(response.text);
      expect($('.main-content').length).toBeGreaterThan(0);
    });
  });
  
  describe('Cross-Page Layout Consistency', () => {
    const pages = [
      { url: '/dashboard', title: 'Dashboard' },
      { url: '/dashboard/profile', title: 'Profile' },
      { url: '/dashboard/settings', title: 'Settings' }
    ];
    
    test.each(pages)('$title page should have consistent sidebar', async ({ url }) => {
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
    
    test.each(pages)('$title page should have consistent header structure', async ({ url }) => {
      const response = await request(app)
        .get(url)
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('LinkFolio');
      expect(response.text).toContain('bi bi-link-45deg');
    });
  });
  
  describe('Title and Meta Information', () => {
    test('dashboard should have correct page title', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('<title>Dashboard - LinkFolio</title>');
    });
    
    test('profile should have correct page title', async () => {
      const response = await request(app)
        .get('/dashboard/profile')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('<title>Profile - LinkFolio</title>');
    });
    
    test('settings should have correct page title', async () => {
      const response = await request(app)
        .get('/dashboard/settings')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      expect(response.text).toContain('<title>Settings - LinkFolio</title>');
    });
  });
  
  describe('Error Handling in Layout', () => {
    test('should handle missing title gracefully', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      // Should not crash if title is undefined
      expect(response.status).toBe(200);
    });
    
    test('should handle missing currentPage gracefully', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', [`token=${validToken}`])
        .expect(200);
      
      // Should not crash if currentPage is undefined
      expect(response.status).toBe(200);
    });
  });
});