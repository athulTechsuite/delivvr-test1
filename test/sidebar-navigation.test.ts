import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

// Test data constants
const TEST_USER_AUTHENTICATED = {
  id: 1,
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2023-01-01T00:00:00.000Z'
};

const TEST_TITLES = {
  HOME: 'Home',
  DASHBOARD: 'Dashboard', 
  LOGIN: 'Login',
  SIGNUP: 'Sign Up'
};

const SIDEBAR_SELECTORS = {
  sidebar: '#sidebar',
  toggleButton: '[data-bs-toggle="offcanvas"][data-bs-target="#sidebar"]',
  closeButton: '.btn-close',
  sidebarTitle: '.offcanvas-title',
  navLinks: '.nav-link',
  userSection: '.px-3.py-2.border-bottom',
  logoutForm: 'form[action="/auth/logout"]',
  homeLink: 'a[href="/"]',
  dashboardLink: 'a[href="/dashboard"]',
  loginLink: 'a[href="/login"]',
  signupLink: 'a[href="/signup"]',
  activeLink: '.nav-link.active',
  bootstrapIcons: '.bi'
};

describe('Sidebar Navigation Component Tests', () => {
  let layoutTemplate: string;
  let dashboardTemplate: string;

  beforeAll(() => {
    // Load template files for testing
    layoutTemplate = fs.readFileSync(
      path.join(__dirname, '../views/layout.ejs'),
      'utf-8'
    );
    dashboardTemplate = fs.readFileSync(
      path.join(__dirname, '../views/dashboard.ejs'),
      'utf-8'
    );
  });

  describe('Bootstrap Sidebar Structure', () => {
    test('should replace top navbar with Bootstrap sidebar navigation', async () => {
      // TC-001: Bootstrap sidebar navigation replaces the existing top navbar in layout.ejs
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: null,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Verify sidebar exists with correct Bootstrap classes
      const sidebar = document.querySelector(SIDEBAR_SELECTORS.sidebar);
      expect(sidebar).toBeTruthy();
      expect(sidebar?.classList.contains('offcanvas-lg')).toBe(true);
      expect(sidebar?.classList.contains('offcanvas-start')).toBe(true);
      expect(sidebar?.classList.contains('bg-primary')).toBe(true);
      
      // Verify no top navbar exists
      const topNavbar = document.querySelector('.navbar');
      expect(topNavbar).toBeFalsy();
    });

    test('should use Bootstrap 5.3.0 classes and components for consistency', async () => {
      // TC-009: Sidebar styling uses Bootstrap 5.3.0 classes and components for consistency
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: TEST_USER_AUTHENTICATED,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      const sidebar = document.querySelector(SIDEBAR_SELECTORS.sidebar);
      expect(sidebar?.getAttribute('tabindex')).toBe('-1');
      expect(sidebar?.getAttribute('aria-labelledby')).toBe('sidebarLabel');
      
      const offcanvasHeader = document.querySelector('.offcanvas-header');
      expect(offcanvasHeader?.classList.contains('border-bottom')).toBe(true);
      expect(offcanvasHeader?.classList.contains('border-light')).toBe(true);
      
      const offcanvasBody = document.querySelector('.offcanvas-body');
      expect(offcanvasBody?.classList.contains('p-0')).toBe(true);
    });

    test('should display Bootstrap icons correctly for each navigation item', async () => {
      // TC-014: Bootstrap icons display correctly for each navigation item in sidebar
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: TEST_USER_AUTHENTICATED,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      const homeLink = document.querySelector(SIDEBAR_SELECTORS.homeLink);
      const dashboardLink = document.querySelector(SIDEBAR_SELECTORS.dashboardLink);
      const logoutButton = document.querySelector('form[action="/auth/logout"] button');
      
      expect(homeLink?.querySelector('.bi-house')).toBeTruthy();
      expect(dashboardLink?.querySelector('.bi-speedometer2')).toBeTruthy();
      expect(logoutButton?.querySelector('.bi-box-arrow-right')).toBeTruthy();
      
      const sidebarTitle = document.querySelector(SIDEBAR_SELECTORS.sidebarTitle);
      expect(sidebarTitle?.querySelector('.bi-shield-lock')).toBeTruthy();
    });
  });

  describe('Authentication-Based Navigation Links', () => {
    test('should show authenticated user navigation links in sidebar', async () => {
      // TC-002: Sidebar contains navigation links for Home, Dashboard, and Logout (when authenticated)
      // TC-003: Sidebar includes user profile section showing username when authenticated
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: TEST_USER_AUTHENTICATED,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Check authenticated navigation links
      expect(document.querySelector(SIDEBAR_SELECTORS.homeLink)).toBeTruthy();
      expect(document.querySelector(SIDEBAR_SELECTORS.dashboardLink)).toBeTruthy();
      expect(document.querySelector(SIDEBAR_SELECTORS.logoutForm)).toBeTruthy();
      
      // Check user profile section
      const userSection = document.querySelector(SIDEBAR_SELECTORS.userSection);
      expect(userSection).toBeTruthy();
      expect(userSection?.textContent).toContain('Signed in as:');
      expect(userSection?.textContent).toContain(TEST_USER_AUTHENTICATED.username);
      
      // Verify unauthenticated links are not present
      expect(document.querySelector(SIDEBAR_SELECTORS.loginLink)).toBeFalsy();
      expect(document.querySelector(SIDEBAR_SELECTORS.signupLink)).toBeFalsy();
    });

    test('should show unauthenticated user navigation links in sidebar', async () => {
      // TC-018: Unauthenticated users see Login and Sign Up links in sidebar
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.LOGIN,
        user: null,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Check unauthenticated navigation links
      expect(document.querySelector(SIDEBAR_SELECTORS.homeLink)).toBeTruthy();
      expect(document.querySelector(SIDEBAR_SELECTORS.loginLink)).toBeTruthy();
      expect(document.querySelector(SIDEBAR_SELECTORS.signupLink)).toBeTruthy();
      
      // Verify authenticated links are not present
      expect(document.querySelector(SIDEBAR_SELECTORS.dashboardLink)).toBeFalsy();
      expect(document.querySelector(SIDEBAR_SELECTORS.logoutForm)).toBeFalsy();
      expect(document.querySelector(SIDEBAR_SELECTORS.userSection)).toBeFalsy();
    });

    test('should determine authentication state from user context variable', async () => {
      // TC-008: Authentication state determines which navigation links are visible in sidebar
      // TC-010: User context variable remains available in all EJS templates for authentication checks
      
      // Test with undefined user
      const htmlUndefined = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: undefined,
        error: null,
        success: null
      });
      
      const domUndefined = new JSDOM(htmlUndefined);
      const documentUndefined = domUndefined.window.document;
      
      expect(documentUndefined.querySelector(SIDEBAR_SELECTORS.loginLink)).toBeTruthy();
      expect(documentUndefined.querySelector(SIDEBAR_SELECTORS.dashboardLink)).toBeFalsy();
      
      // Test with null user
      const htmlNull = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: null,
        error: null,
        success: null
      });
      
      const domNull = new JSDOM(htmlNull);
      const documentNull = domNull.window.document;
      
      expect(documentNull.querySelector(SIDEBAR_SELECTORS.loginLink)).toBeTruthy();
      expect(documentNull.querySelector(SIDEBAR_SELECTORS.dashboardLink)).toBeFalsy();
    });
  });

  describe('Logout Functionality', () => {
    test('should trigger POST request to /auth/logout endpoint', async () => {
      // TC-004: Logout link in sidebar triggers POST request to existing /auth/logout endpoint
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: TEST_USER_AUTHENTICATED,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      const logoutForm = document.querySelector(SIDEBAR_SELECTORS.logoutForm);
      expect(logoutForm?.getAttribute('action')).toBe('/auth/logout');
      expect(logoutForm?.getAttribute('method')).toBe('POST');
      
      const logoutButton = logoutForm?.querySelector('button[type="submit"]');
      expect(logoutButton).toBeTruthy();
      expect(logoutButton?.textContent?.trim()).toContain('Logout');
    });
  });

  describe('Navigation Route Links', () => {
    test('should redirect Home link to root path', async () => {
      // TC-011: Home page link in sidebar redirects to root path '/'
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: null,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      const homeLink = document.querySelector(SIDEBAR_SELECTORS.homeLink);
      expect(homeLink?.getAttribute('href')).toBe('/');
    });

    test('should redirect Dashboard link to /dashboard and require authentication', async () => {
      // TC-012: Dashboard link in sidebar redirects to '/dashboard' and requires authentication
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.DASHBOARD,
        user: TEST_USER_AUTHENTICATED,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      const dashboardLink = document.querySelector(SIDEBAR_SELECTORS.dashboardLink);
      expect(dashboardLink?.getAttribute('href')).toBe('/dashboard');
      
      // Dashboard link should only be present when authenticated
      expect(dashboardLink).toBeTruthy();
    });
  });

  describe('Active Page Highlighting', () => {
    test('should show active navigation state for current page', async () => {
      // TC-017: Current page highlighting shows active navigation state in sidebar
      
      // Test Home page active state
      const homeHtml = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: null,
        error: null,
        success: null
      });
      
      const homeDom = new JSDOM(homeHtml);
      const homeDocument = homeDom.window.document;
      const homeLink = homeDocument.querySelector(SIDEBAR_SELECTORS.homeLink);
      
      expect(homeLink?.classList.contains('active')).toBe(true);
      expect(homeLink?.classList.contains('bg-primary-dark')).toBe(true);
      
      // Test Dashboard page active state
      const dashboardHtml = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.DASHBOARD,
        user: TEST_USER_AUTHENTICATED,
        error: null,
        success: null
      });
      
      const dashboardDom = new JSDOM(dashboardHtml);
      const dashboardDocument = dashboardDom.window.document;
      const dashboardLink = dashboardDocument.querySelector(SIDEBAR_SELECTORS.dashboardLink);
      
      expect(dashboardLink?.classList.contains('active')).toBe(true);
      expect(dashboardLink?.classList.contains('bg-primary-dark')).toBe(true);
      
      // Test Login page active state
      const loginHtml = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.LOGIN,
        user: null,
        error: null,
        success: null
      });
      
      const loginDom = new JSDOM(loginHtml);
      const loginDocument = loginDom.window.document;
      const loginLink = loginDocument.querySelector(SIDEBAR_SELECTORS.loginLink);
      
      expect(loginLink?.classList.contains('active')).toBe(true);
      expect(loginLink?.classList.contains('bg-primary-dark')).toBe(true);
    });
  });

  describe('Flash Message Display', () => {
    test('should display flash messages properly with sidebar layout', async () => {
      // TC-007: Flash messages (success/error alerts) continue to display properly with sidebar layout
      
      // Test error message
      const errorHtml = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: null,
        error: 'Test error message',
        success: null
      });
      
      const errorDom = new JSDOM(errorHtml);
      const errorDocument = errorDom.window.document;
      
      const errorAlert = errorDocument.querySelector('.alert-danger');
      expect(errorAlert).toBeTruthy();
      expect(errorAlert?.textContent).toContain('Test error message');
      expect(errorAlert?.querySelector('.bi-exclamation-triangle')).toBeTruthy();
      
      // Test success message
      const successHtml = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: null,
        error: null,
        success: 'Test success message'
      });
      
      const successDom = new JSDOM(successHtml);
      const successDocument = successDom.window.document;
      
      const successAlert = successDocument.querySelector('.alert-success');
      expect(successAlert).toBeTruthy();
      expect(successAlert?.textContent).toContain('Test success message');
      expect(successAlert?.querySelector('.bi-check-circle')).toBeTruthy();
    });
  });

  describe('Dashboard Template Updates', () => {
    test('should remove duplicate navbar from dashboard template', async () => {
      // TC-006: Dashboard page removes duplicate navbar and uses only the sidebar layout
      const dashboardHtml = await ejs.render(dashboardTemplate, {
        user: TEST_USER_AUTHENTICATED
      });
      
      const dom = new JSDOM(dashboardHtml);
      const document = dom.window.document;
      
      // Verify no navbar elements exist in dashboard template
      expect(document.querySelector('.navbar')).toBeFalsy();
      expect(document.querySelector('.navbar-brand')).toBeFalsy();
      expect(document.querySelector('.navbar-nav')).toBeFalsy();
      
      // Verify dashboard content is present
      const dashboardCard = document.querySelector('.card');
      expect(dashboardCard).toBeTruthy();
      
      const dashboardHeader = document.querySelector('.card-header');
      expect(dashboardHeader?.textContent).toContain('Dashboard');
    });
  });

  describe('User Context Availability', () => {
    test('should maintain user context variable in templates', async () => {
      // TC-010: User context variable remains available in all EJS templates for authentication checks
      // TC-020: Existing authentication middleware continues to work without modification
      
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.DASHBOARD,
        user: TEST_USER_AUTHENTICATED,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Verify user data is accessible and displayed
      const userSection = document.querySelector(SIDEBAR_SELECTORS.userSection);
      expect(userSection?.textContent).toContain(TEST_USER_AUTHENTICATED.username);
      
      // Test with missing user properties gracefully handled
      const htmlMissingUsername = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.DASHBOARD,
        user: { id: 1, email: 'test@example.com' }, // Missing username
        error: null,
        success: null
      });
      
      const domMissingUsername = new JSDOM(htmlMissingUsername);
      const documentMissingUsername = domMissingUsername.window.document;
      
      const userSectionMissing = documentMissingUsername.querySelector(SIDEBAR_SELECTORS.userSection);
      expect(userSectionMissing?.textContent).toContain('Unknown User');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle missing template variables gracefully', async () => {
      // Test with minimal variables
      const html = await ejs.render(layoutTemplate, {
        title: undefined,
        user: undefined,
        error: undefined,
        success: undefined
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Should still render sidebar structure
      expect(document.querySelector(SIDEBAR_SELECTORS.sidebar)).toBeTruthy();
      expect(document.querySelector(SIDEBAR_SELECTORS.homeLink)).toBeTruthy();
      expect(document.querySelector(SIDEBAR_SELECTORS.loginLink)).toBeTruthy();
    });

    test('should handle empty user object', async () => {
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: {},
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Should treat empty object as authenticated but show fallback username
      expect(document.querySelector(SIDEBAR_SELECTORS.dashboardLink)).toBeTruthy();
      expect(document.querySelector(SIDEBAR_SELECTORS.userSection)?.textContent).toContain('Unknown User');
    });

    test('should handle special characters in user data', async () => {
      const userWithSpecialChars = {
        ...TEST_USER_AUTHENTICATED,
        username: '<script>alert("xss")</script>',
        name: 'User & Co.'
      };
      
      const html = await ejs.render(layoutTemplate, {
        title: TEST_TITLES.HOME,
        user: userWithSpecialChars,
        error: null,
        success: null
      });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Should escape HTML in user data
      const userSection = document.querySelector(SIDEBAR_SELECTORS.userSection);
      expect(userSection?.innerHTML).not.toContain('<script>');
      expect(userSection?.textContent).toContain('&lt;script&gt;');
    });
  });
});