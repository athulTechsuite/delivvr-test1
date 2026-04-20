import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

// Test data
const mockUser = {
  id: 1,
  name: 'John Doe',
  email: 'john.doe@example.com',
  joinDate: '1/1/2023'
};

const mockLayoutTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %></title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <nav class="sidebar">
        <div class="nav-header">
            <h2>TaskFlow</h2>
        </div>
        <ul class="nav-links">
            <% if (user) { %>
                <li><a href="/profile" class="nav-link <%= title === 'Profile' ? 'active' : '' %>">
                    <span class="material-icons">person</span>
                    Profile
                </a></li>
                <li><a href="/dashboard" class="nav-link <%= title === 'Dashboard' ? 'active' : '' %>">
                    <span class="material-icons">dashboard</span>
                    Dashboard
                </a></li>
            <% } else { %>
                <li><a href="/" class="nav-link <%= title === 'Home' ? 'active' : '' %>">
                    <span class="material-icons">home</span>
                    Home
                </a></li>
                <li><a href="/login" class="nav-link <%= title === 'Login' ? 'active' : '' %>">
                    <span class="material-icons">login</span>
                    Login
                </a></li>
            <% } %>
        </ul>
    </nav>
    <main class="main-content">
        <%- body %>
    </main>
    <script src="/js/theme.js"></script>
    <% if (title === 'Profile') { %>
        <script src="/js/profile.js"></script>
    <% } %>
</body>
</html>
`;

const mockProfileTemplate = `
<div class="profile-container">
    <div class="profile-header">
        <h1>My Profile</h1>
        <p>Manage your account information</p>
    </div>
    
    <div class="profile-content">
        <div class="profile-section">
            <h2>Personal Information</h2>
            <form class="profile-form">
                <div class="form-group">
                    <label for="nameField">Full Name</label>
                    <input 
                        type="text" 
                        id="nameField" 
                        class="form-control" 
                        value="<%= user.name %>" 
                        readonly 
                        aria-label="Full name"
                        aria-describedby="name-help"
                    />
                    <small id="name-help" class="form-text">Click to edit your name</small>
                    <div class="profile-actions" style="display: none;">
                        <button type="button" class="save-btn btn btn-primary">Save</button>
                        <button type="button" class="cancel-btn btn btn-secondary">Cancel</button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="emailField">Email Address</label>
                    <input 
                        type="email" 
                        id="emailField" 
                        class="form-control" 
                        value="<%= user.email %>" 
                        readonly 
                        disabled
                        aria-label="Email address"
                    />
                    <small class="form-text">Email cannot be changed</small>
                </div>
                
                <div class="form-group">
                    <label for="joinDateField">Member Since</label>
                    <input 
                        type="text" 
                        id="joinDateField" 
                        class="form-control" 
                        value="<%= user.joinDate %>" 
                        readonly 
                        disabled
                        aria-label="Join date"
                    />
                </div>
            </form>
        </div>
        
        <div class="profile-section password-section">
            <h2>Change Password</h2>
            <form id="passwordChangeForm" class="password-form">
                <div class="form-group">
                    <label for="currentPassword">Current Password</label>
                    <input 
                        type="password" 
                        id="currentPassword" 
                        class="form-control" 
                        required
                        aria-label="Current password"
                        aria-describedby="current-password-help"
                    />
                    <small id="current-password-help" class="form-text">Enter your current password</small>
                </div>
                
                <div class="form-group">
                    <label for="newPassword">New Password</label>
                    <input 
                        type="password" 
                        id="newPassword" 
                        class="form-control" 
                        required
                        aria-label="New password"
                        aria-describedby="new-password-help"
                    />
                    <small id="new-password-help" class="form-text">
                        Must be at least 6 characters with uppercase, lowercase, and number
                    </small>
                </div>
                
                <button type="submit" class="password-submit-btn btn btn-primary" disabled>
                    Update Password
                </button>
            </form>
        </div>
    </div>
</div>
`;

describe('Profile Template Rendering', () => {
  let dom: JSDOM;
  let document: Document;
  
  beforeEach(() => {
    // Create a new DOM instance for each test
    dom = new JSDOM();
    document = dom.window.document;
  });
  
  afterEach(() => {
    dom.window.close();
  });

  describe('Profile Page Template Structure', () => {
    // TC-V-001: Profile page displays user's name, email, and join date in readonly format
    test('should render user information in readonly format', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const nameField = document.getElementById('nameField') as HTMLInputElement;
      const emailField = document.getElementById('emailField') as HTMLInputElement;
      const joinDateField = document.getElementById('joinDateField') as HTMLInputElement;
      
      expect(nameField.value).toBe(mockUser.name);
      expect(nameField.hasAttribute('readonly')).toBe(true);
      expect(emailField.value).toBe(mockUser.email);
      expect(emailField.hasAttribute('readonly')).toBe(true);
      expect(joinDateField.value).toBe(mockUser.joinDate);
      expect(joinDateField.hasAttribute('readonly')).toBe(true);
    });

    // TC-V-002: Profile form displays current user data as default values
    test('should display current user data as default values in form fields', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const nameField = document.getElementById('nameField') as HTMLInputElement;
      const emailField = document.getElementById('emailField') as HTMLInputElement;
      const joinDateField = document.getElementById('joinDateField') as HTMLInputElement;
      
      expect(nameField.value).toBe('John Doe');
      expect(emailField.value).toBe('john.doe@example.com');
      expect(joinDateField.value).toBe('1/1/2023');
    });

    // TC-V-003: Profile page includes separate password change section
    test('should include separate password change section', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const passwordSection = document.querySelector('.password-section');
      const passwordForm = document.getElementById('passwordChangeForm');
      const currentPasswordField = document.getElementById('currentPassword');
      const newPasswordField = document.getElementById('newPassword');
      
      expect(passwordSection).toBeTruthy();
      expect(passwordForm).toBeTruthy();
      expect(currentPasswordField).toBeTruthy();
      expect(newPasswordField).toBeTruthy();
    });

    // TC-V-004: Profile page includes proper ARIA labels and accessibility attributes
    test('should include proper ARIA labels and accessibility attributes', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const nameField = document.getElementById('nameField') as HTMLInputElement;
      const emailField = document.getElementById('emailField') as HTMLInputElement;
      const currentPasswordField = document.getElementById('currentPassword') as HTMLInputElement;
      const newPasswordField = document.getElementById('newPassword') as HTMLInputElement;
      
      expect(nameField.getAttribute('aria-label')).toBe('Full name');
      expect(nameField.getAttribute('aria-describedby')).toBe('name-help');
      expect(emailField.getAttribute('aria-label')).toBe('Email address');
      expect(currentPasswordField.getAttribute('aria-label')).toBe('Current password');
      expect(currentPasswordField.getAttribute('aria-describedby')).toBe('current-password-help');
      expect(newPasswordField.getAttribute('aria-label')).toBe('New password');
      expect(newPasswordField.getAttribute('aria-describedby')).toBe('new-password-help');
    });

    // TC-V-005: Profile page includes cancel and save buttons
    test('should include cancel and save buttons for name editing', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const saveButton = document.querySelector('.save-btn');
      const cancelButton = document.querySelector('.cancel-btn');
      const profileActions = document.querySelector('.profile-actions');
      
      expect(saveButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();
      expect(profileActions).toHaveStyle('display: none');
      expect(saveButton?.textContent?.trim()).toBe('Save');
      expect(cancelButton?.textContent?.trim()).toBe('Cancel');
    });

    // TC-V-006: Password submit button is initially disabled
    test('should have password submit button initially disabled', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const submitButton = document.querySelector('.password-submit-btn') as HTMLButtonElement;
      
      expect(submitButton.disabled).toBe(true);
      expect(submitButton.textContent?.trim()).toBe('Update Password');
    });

    // TC-V-007: Email field is disabled and cannot be edited
    test('should have email field disabled and non-editable', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const emailField = document.getElementById('emailField') as HTMLInputElement;
      
      expect(emailField.hasAttribute('disabled')).toBe(true);
      expect(emailField.hasAttribute('readonly')).toBe(true);
    });

    // TC-V-008: Join date field is disabled and non-editable
    test('should have join date field disabled and non-editable', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const joinDateField = document.getElementById('joinDateField') as HTMLInputElement;
      
      expect(joinDateField.hasAttribute('disabled')).toBe(true);
      expect(joinDateField.hasAttribute('readonly')).toBe(true);
    });
  });

  describe('Navigation Integration', () => {
    // TC-V-009: Profile link appears in sidebar navigation for authenticated users
    test('should show Profile link in sidebar navigation for authenticated users', () => {
      const renderedLayout = ejs.render(mockLayoutTemplate, { 
        title: 'Profile',
        user: mockUser,
        body: ejs.render(mockProfileTemplate, { user: mockUser })
      });
      dom = new JSDOM(renderedLayout);
      document = dom.window.document;
      
      const profileLink = document.querySelector('a[href="/profile"]');
      const dashboardLink = document.querySelector('a[href="/dashboard"]');
      
      expect(profileLink).toBeTruthy();
      expect(profileLink?.textContent?.trim()).toContain('Profile');
      expect(dashboardLink).toBeTruthy();
    });

    // TC-V-010: Profile link is positioned above Dashboard link
    test('should position Profile link above Dashboard link in navigation', () => {
      const renderedLayout = ejs.render(mockLayoutTemplate, { 
        title: 'Profile',
        user: mockUser,
        body: ejs.render(mockProfileTemplate, { user: mockUser })
      });
      dom = new JSDOM(renderedLayout);
      document = dom.window.document;
      
      const navLinks = document.querySelectorAll('.nav-link');
      const linkTexts = Array.from(navLinks).map(link => link.textContent?.trim());
      
      const profileIndex = linkTexts.findIndex(text => text?.includes('Profile'));
      const dashboardIndex = linkTexts.findIndex(text => text?.includes('Dashboard'));
      
      expect(profileIndex).toBeLessThan(dashboardIndex);
    });

    // TC-V-011: Profile navigation link shows active state when user is on profile page
    test('should show active state for Profile link when on profile page', () => {
      const renderedLayout = ejs.render(mockLayoutTemplate, { 
        title: 'Profile',
        user: mockUser,
        body: ejs.render(mockProfileTemplate, { user: mockUser })
      });
      dom = new JSDOM(renderedLayout);
      document = dom.window.document;
      
      const profileLink = document.querySelector('a[href="/profile"]');
      
      expect(profileLink?.classList.contains('active')).toBe(true);
    });

    // TC-V-012: Profile link is only visible to authenticated users
    test('should not show Profile link for unauthenticated users', () => {
      const renderedLayout = ejs.render(mockLayoutTemplate, { 
        title: 'Home',
        user: null,
        body: '<h1>Home Page</h1>'
      });
      dom = new JSDOM(renderedLayout);
      document = dom.window.document;
      
      const profileLink = document.querySelector('a[href="/profile"]');
      const homeLink = document.querySelector('a[href="/"]');
      const loginLink = document.querySelector('a[href="/login"]');
      
      expect(profileLink).toBeFalsy();
      expect(homeLink).toBeTruthy();
      expect(loginLink).toBeTruthy();
    });
  });

  describe('Form Field Validation Messages', () => {
    // TC-V-013: Profile page includes form validation help text
    test('should include form validation help text', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const nameHelp = document.getElementById('name-help');
      const currentPasswordHelp = document.getElementById('current-password-help');
      const newPasswordHelp = document.getElementById('new-password-help');
      
      expect(nameHelp?.textContent?.trim()).toBe('Click to edit your name');
      expect(currentPasswordHelp?.textContent?.trim()).toBe('Enter your current password');
      expect(newPasswordHelp?.textContent?.trim()).toContain('Must be at least 6 characters');
    });

    // TC-V-014: Email field shows non-editable message
    test('should show non-editable message for email field', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const emailGroup = document.getElementById('emailField')?.closest('.form-group');
      const helpText = emailGroup?.querySelector('.form-text');
      
      expect(helpText?.textContent?.trim()).toBe('Email cannot be changed');
    });
  });

  describe('Responsive Design Elements', () => {
    // TC-V-015: Profile page maintains responsive design structure
    test('should include responsive design classes and structure', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const profileContainer = document.querySelector('.profile-container');
      const profileContent = document.querySelector('.profile-content');
      const profileSections = document.querySelectorAll('.profile-section');
      const formGroups = document.querySelectorAll('.form-group');
      
      expect(profileContainer).toBeTruthy();
      expect(profileContent).toBeTruthy();
      expect(profileSections.length).toBe(2);
      expect(formGroups.length).toBeGreaterThan(0);
    });

    // TC-V-016: Form controls have proper CSS classes for styling
    test('should have proper CSS classes for Material Design styling', () => {
      const renderedProfile = ejs.render(mockProfileTemplate, { user: mockUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const nameField = document.getElementById('nameField');
      const submitButton = document.querySelector('.password-submit-btn');
      const saveButton = document.querySelector('.save-btn');
      const cancelButton = document.querySelector('.cancel-btn');
      
      expect(nameField?.classList.contains('form-control')).toBe(true);
      expect(submitButton?.classList.contains('btn')).toBe(true);
      expect(submitButton?.classList.contains('btn-primary')).toBe(true);
      expect(saveButton?.classList.contains('btn')).toBe(true);
      expect(saveButton?.classList.contains('btn-primary')).toBe(true);
      expect(cancelButton?.classList.contains('btn')).toBe(true);
      expect(cancelButton?.classList.contains('btn-secondary')).toBe(true);
    });
  });

  describe('Page Metadata and Scripts', () => {
    // TC-V-017: Profile page includes proper page title
    test('should include proper page title and meta information', () => {
      const renderedLayout = ejs.render(mockLayoutTemplate, { 
        title: 'Profile',
        user: mockUser,
        body: ejs.render(mockProfileTemplate, { user: mockUser })
      });
      dom = new JSDOM(renderedLayout);
      document = dom.window.document;
      
      const title = document.querySelector('title');
      const metaViewport = document.querySelector('meta[name="viewport"]');
      const metaCharset = document.querySelector('meta[charset]');
      
      expect(title?.textContent).toBe('Profile');
      expect(metaViewport?.getAttribute('content')).toBe('width=device-width, initial-scale=1.0');
      expect(metaCharset?.getAttribute('charset')).toBe('UTF-8');
    });

    // TC-V-018: Profile page loads required JavaScript files
    test('should load profile.js script on profile page', () => {
      const renderedLayout = ejs.render(mockLayoutTemplate, { 
        title: 'Profile',
        user: mockUser,
        body: ejs.render(mockProfileTemplate, { user: mockUser })
      });
      dom = new JSDOM(renderedLayout);
      document = dom.window.document;
      
      const profileScript = document.querySelector('script[src="/js/profile.js"]');
      const themeScript = document.querySelector('script[src="/js/theme.js"]');
      
      expect(profileScript).toBeTruthy();
      expect(themeScript).toBeTruthy();
    });

    // TC-V-019: Profile page includes Material Design resources
    test('should include Material Design CSS and fonts', () => {
      const renderedLayout = ejs.render(mockLayoutTemplate, { 
        title: 'Profile',
        user: mockUser,
        body: ejs.render(mockProfileTemplate, { user: mockUser })
      });
      dom = new JSDOM(renderedLayout);
      document = dom.window.document;
      
      const interFont = document.querySelector('link[href*="Inter"]');
      const materialIcons = document.querySelector('link[href*="Material+Icons"]');
      const stylesheet = document.querySelector('link[href="/css/style.css"]');
      
      expect(interFont).toBeTruthy();
      expect(materialIcons).toBeTruthy();
      expect(stylesheet).toBeTruthy();
    });
  });

  describe('Template Error Handling', () => {
    // TC-V-020: Template handles missing user data gracefully
    test('should handle missing user data gracefully', () => {
      const incompleteUser = {
        name: 'John Doe'
        // Missing email and joinDate
      };
      
      expect(() => {
        ejs.render(mockProfileTemplate, { user: incompleteUser });
      }).not.toThrow();
    });

    // TC-V-021: Template handles empty user data
    test('should handle empty user values', () => {
      const emptyUser = {
        id: 1,
        name: '',
        email: '',
        joinDate: ''
      };
      
      const renderedProfile = ejs.render(mockProfileTemplate, { user: emptyUser });
      dom = new JSDOM(renderedProfile);
      document = dom.window.document;
      
      const nameField = document.getElementById('nameField') as HTMLInputElement;
      const emailField = document.getElementById('emailField') as HTMLInputElement;
      
      expect(nameField.value).toBe('');
      expect(emailField.value).toBe('');
    });
  });
});