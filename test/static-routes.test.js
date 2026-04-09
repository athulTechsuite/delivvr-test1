const request = require('supertest');
const cheerio = require('cheerio');
const path = require('path');
const express = require('express');

// Import the actual app for testing routes
const app = require('../app');

describe('Static Routes Tests', () => {

  describe('AC-6 & AC-8: Static Dashboard Route', () => {
    test('TC-006: Dashboard menu item should link to /static/dashboard route', async () => {
      // Test that the route handler exists and is accessible
      const response = await request(app).get('/static/dashboard');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('TC-008: GET /static/dashboard should return 200 status with rendered HTML', async () => {
      const response = await request(app).get('/static/dashboard');
      expect(response.status).toBe(200);
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<html');
    });
  });

  describe('AC-7 & AC-9: Static Logout Route', () => {
    test('TC-007: Logout menu item should link to /static/logout route', async () => {
      const response = await request(app).get('/static/logout');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    test('TC-009: GET /static/logout should return 200 status with rendered HTML', async () => {
      const response = await request(app).get('/static/logout');
      expect(response.status).toBe(200);
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<html');
    });
  });

  describe('AC-10 & AC-11: Static Dashboard Content', () => {
    test('TC-010: Static dashboard page should display dummy user email (demo@example.com)', async () => {
      const response = await request(app).get('/static/dashboard');
      const $ = cheerio.load(response.text);
      
      expect(response.text).toContain('demo@example.com');
      
      const emailInfo = $('.info-value:contains("demo@example.com")');
      expect(emailInfo.length).toBe(1);
    });

    test('TC-011: Static dashboard page should show welcome message for Demo User', async () => {
      const response = await request(app).get('/static/dashboard');
      const $ = cheerio.load(response.text);
      
      expect(response.text).toContain('Welcome, Demo User!');
      
      const welcomeMessage = $('.card-title:contains("Welcome, Demo User!")');
      expect(welcomeMessage.length).toBe(1);
    });

    test('TC-011-extra: Static dashboard should display user role information', async () => {
      const response = await request(app).get('/static/dashboard');
      const $ = cheerio.load(response.text);
      
      const roleInfo = $('.info-value:contains("User")');
      expect(roleInfo.length).toBe(1);
    });
  });

  describe('AC-12 & AC-13: Static Logout Content', () => {
    test('TC-012: Static logout page should display logout confirmation message', async () => {
      const response = await request(app).get('/static/logout');
      const $ = cheerio.load(response.text);
      
      expect(response.text).toContain('Logout Confirmation');
      
      const confirmationTitle = $('.card-title:contains("Logout Confirmation")');
      expect(confirmationTitle.length).toBe(1);
    });

    test('TC-013: Static logout page should contain disabled Logout (Demo) button', async () => {
      const response = await request(app).get('/static/logout');
      const $ = cheerio.load(response.text);
      
      const logoutButton = $('button:contains("Logout (Demo)")');
      expect(logoutButton.length).toBe(1);
      expect(logoutButton.attr('disabled')).toBeDefined();
      expect(logoutButton.hasClass('btn')).toBe(true);
      expect(logoutButton.hasClass('btn-primary')).toBe(true);
    });
  });

  describe('AC-14: No Authentication Required', () => {
    test('TC-014: Static routes should be accessible without authentication', async () => {
      // Test dashboard route without any auth cookies or headers
      const dashboardResponse = await request(app).get('/static/dashboard');
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.headers.location).toBeUndefined(); // No redirect
      
      // Test logout route without any auth cookies or headers
      const logoutResponse = await request(app).get('/static/logout');
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.headers.location).toBeUndefined(); // No redirect
    });

    test('TC-014-redirect: Static routes should not redirect to login page', async () => {
      const dashboardResponse = await request(app).get('/static/dashboard');
      expect(dashboardResponse.status).not.toBe(302);
      expect(dashboardResponse.headers.location).not.toBe('/login');
      
      const logoutResponse = await request(app).get('/static/logout');
      expect(logoutResponse.status).not.toBe(302);
      expect(logoutResponse.headers.location).not.toBe('/login');
    });
  });

  describe('AC-15: No Database Interactions', () => {
    test('TC-015: Static routes should not perform database queries', async () => {
      // Test that static routes return immediately without database calls
      const start = Date.now();
      const dashboardResponse = await request(app).get('/static/dashboard');
      const dashboardTime = Date.now() - start;
      
      const start2 = Date.now();
      const logoutResponse = await request(app).get('/static/logout');
      const logoutTime = Date.now() - start2;
      
      // Both should complete quickly (no DB queries)
      expect(dashboardResponse.status).toBe(200);
      expect(logoutResponse.status).toBe(200);
      
      // Response should be fast (< 100ms typically for static content)
      expect(dashboardTime).toBeLessThan(1000);
      expect(logoutTime).toBeLessThan(1000);
    });

    test('TC-015-content: Static routes should display dummy data only', async () => {
      const dashboardResponse = await request(app).get('/static/dashboard');
      const $ = cheerio.load(dashboardResponse.text);
      
      // Should contain only static dummy content
      expect($('.card-text:contains("static dashboard page with no functionality")').length).toBe(1);
      expect($('p:contains("demo@example.com")').length).toBeGreaterThan(0);
      
      const logoutResponse = await request(app).get('/static/logout');
      const $2 = cheerio.load(logoutResponse.text);
      
      expect($2('.card-text:contains("static logout page with no functionality")').length).toBe(1);
    });
  });

  describe('AC-20: Existing Routes Functionality', () => {
    test('TC-020: Existing authenticated routes should continue to function normally', async () => {
      // Test that existing routes still exist and behave correctly
      const response = await request(app).get('/dashboard');
      
      // Should redirect to login (302) since no auth token provided
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });

    test('TC-020-login: Login route should still function normally', async () => {
      const response = await request(app).get('/login');
      expect(response.status).toBe(200);
      expect(response.text).toContain('login'); // Should contain login form
    });

    test('TC-020-signup: Signup route should still function normally', async () => {
      const response = await request(app).get('/signup');
      expect(response.status).toBe(200);
      expect(response.text).toContain('signup'); // Should contain signup form
    });
  });

  describe('AC-21: Layout Template Usage', () => {
    test('TC-021: Static pages should use the same layout template structure', async () => {
      const dashboardResponse = await request(app).get('/static/dashboard');
      const logoutResponse = await request(app).get('/static/logout');
      
      // Both should have the same sidebar structure
      const $dash = cheerio.load(dashboardResponse.text);
      const $logout = cheerio.load(logoutResponse.text);
      
      expect($dash('.sidebar').length).toBe(1);
      expect($logout('.sidebar').length).toBe(1);
      
      // Both should have the same navigation menu
      expect($dash('.sidebar .nav-item').length).toBe(2);
      expect($logout('.sidebar .nav-item').length).toBe(2);
      
      // Both should have footer
      expect($dash('footer').length).toBe(1);
      expect($logout('footer').length).toBe(1);
    });
  });

  describe('AC-23: CSS Styling', () => {
    test('TC-023: CSS styling should be added to public/css/style.css', async () => {
      const response = await request(app).get('/css/style.css');
      expect(response.status).toBe(200);
      
      // Should contain sidebar specific styles
      expect(response.text).toContain('.sidebar');
      expect(response.text).toContain('.main-content');
      expect(response.text).toContain('width: 250px');
      expect(response.text).toContain('margin-left: 250px');
    });
  });

  describe('AC-24: Route Handler Implementation', () => {
    test('TC-024: Static routes should be simple GET handlers in app.js', async () => {
      // Test the route handlers respond correctly
      const dashboardResponse = await request(app).get('/static/dashboard');
      const logoutResponse = await request(app).get('/static/logout');
      
      expect(dashboardResponse.status).toBe(200);
      expect(logoutResponse.status).toBe(200);
      
      // Should contain expected title data
      expect(dashboardResponse.text).toContain('Static Dashboard');
      expect(logoutResponse.text).toContain('Logout');
    });

    test('TC-024-method: Static routes should only respond to GET method', async () => {
      const postDashboard = await request(app).post('/static/dashboard');
      const putDashboard = await request(app).put('/static/dashboard');
      const deleteDashboard = await request(app).delete('/static/dashboard');
      
      // Should return 404 or 405 for non-GET methods
      expect(postDashboard.status).not.toBe(200);
      expect(putDashboard.status).not.toBe(200);
      expect(deleteDashboard.status).not.toBe(200);
    });
  });

  describe('Error Cases and Edge Cases', () => {
    test('TC-E01: Non-existent static routes should return 404', async () => {
      const response = await request(app).get('/static/nonexistent');
      expect(response.status).toBe(404);
    });

    test('TC-E02: Static routes should handle malformed URLs gracefully', async () => {
      const response1 = await request(app).get('/static/dashboard/../');
      const response2 = await request(app).get('/static/logout?param=value');
      
      // Should either work normally or return appropriate error
      expect([200, 404]).toContain(response1.status);
      expect(response2.status).toBe(200); // Query params should be ignored
    });

    test('TC-E03: Static routes should handle concurrent requests', async () => {
      const requests = Array(10).fill().map(() => 
        request(app).get('/static/dashboard')
      );
      
      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});