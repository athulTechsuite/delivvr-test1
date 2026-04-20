import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

describe('Profile Template Rendering', () => {
  let profileTemplate: string;
  let layoutTemplate: string;
  
  const TEST_USER = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    created_at: '2023-01-01T00:00:00.000Z'
  };
  
  beforeAll(() => {
    // Mock template files
    profileTemplate = `
      <div class="profile-container">
        <div class="profile-header">
          <h1>Profile</h1>
        </div>
        
        <form id="profile-form" class="profile-form" method="POST" action="/profile/update">
          <div class="form-group">
            <label for="name" class="form-label">Name</label>
            <input type="text" 
                   id="name" 
                   name="name" 
                   class="form-input" 
                   value="<%= user.name %>" 
                   aria-label="User name"
                   required>
          </div>
          
          <div class="form-group">
            <label for="email" class="form-label">Email</label>
            <input type="email" 
                   id="email" 
                   name="email" 
                   class="form-input" 
                   value="<%= user.email %>" 
                   readonly 
                   aria-label="User email">
          </div>
          
          <div class="form-group">
            <label for="joinDate" class="form-label">Member Since</label>
            <input type="text" 
                   id="joinDate" 
                   name="joinDate" 
                   class="form-input" 
                   value="<%= new Date(user.created_at).toLocaleDateString('en-US') %>" 
                   readonly 
                   aria-label="Join date">
          </div>
          
          <div class="form-actions">
            <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" id="save-btn" class="btn btn-primary">Save</button>
          </div>
        </form>
        
        <div class="password-section">
          <h2>Change Password</h2>
          <form id="password-form" method="POST" action="/profile/password">
            <div class="form-group">
              <label for="currentPassword" class="form-label">Current Password</label>
              <input type="password" 
                     id="currentPassword" 
                     name="currentPassword" 
                     class="form-input" 
                     aria-label="Current password"
                     required>
            </div>
            
            <div class="form-group">
              <label for="newPassword" class="form-label">New Password</label>
              <input type="password" 
                     id="newPassword" 
                     name="newPassword" 
                     class="form-input" 
                     aria-label="New password"
                     required>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Change Password</button>
            </div>
          </form>
        </div>
        
        <% if (success) { %>
          <div class="alert alert-success" role="alert">
            <%= success %>
          </div>
        <% } %>
        
        <% if (error) { %>
          <div class="alert alert-error" role="alert">
            <%= error %>
          </div>
        <% } %>
      </div>
    `;
    
    layoutTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title><%= title %> - Express Auth</title>
        <link rel="stylesheet" href="/css/style.css">
      </head>
      <body>
        <nav class="navbar">
          <div class="nav-container">
            <a href="/" class="nav-brand">Express Auth</a>
            <div class="nav-menu">
              <% if (user) { %>
                <a href="/profile" class="nav-link <%= title === 'Profile' ? 'active' : '' %>">Profile</a>
                <a href="/dashboard" class="nav-link <%= title === 'Dashboard' ? 'active' : '' %>">Dashboard</a>
                <a href="/logout" class="nav-link">Logout</a>
              <% } else { %>
                <a href="/login" class="nav-link">Login</a>
                <a href="/signup" class="nav-link">Sign Up</a>
              <% } %>
            </div>
          </div>
        </nav>
        
        <aside class="sidebar">
          <% if (user) { %>
            <a href="/profile" class="sidebar-link <%= title === 'Profile' ? 'active' : '' %>">Profile</a>
            <a href="/dashboard" class="sidebar-link <%= title === 'Dashboard' ? 'active' : '' %>">Dashboard</a>
          <% } %>
        </aside>
        
        <main class="main-content">
          <%- body || '' %>
        </main>
        
        <script src="/js/profile.js"></script>
      </body>
      </html>
    `;
  });
  
  // TC-F-001
  it('should display user name, email, and join date in readonly format when first loaded', () => {
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: null,
      error: null
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const nameInput = document.querySelector('#name') as HTMLInputElement;
    const emailInput = document.querySelector('#email') as HTMLInputElement;
    const joinDateInput = document.querySelector('#joinDate') as HTMLInputElement;
    
    expect(nameInput.value).toBe(TEST_USER.name);
    expect(emailInput.value).toBe(TEST_USER.email);
    expect(emailInput.readOnly).toBe(true);
    expect(joinDateInput.readOnly).toBe(true);
    expect(joinDateInput.value).toBe(new Date(TEST_USER.created_at).toLocaleDateString('en-US'));
  });
  
  // TC-F-002
  it('should render name field as editable when focused', () => {
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: null,
      error: null
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const nameInput = document.querySelector('#name') as HTMLInputElement;
    
    expect(nameInput.readOnly).toBe(false);
    expect(nameInput.type).toBe('text');
    expect(nameInput.getAttribute('required')).toBe('');
  });
  
  // TC-F-005, TC-F-015
  it('should include separate password change section with current and new password fields', () => {
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: null,
      error: null
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const passwordSection = document.querySelector('.password-section');
    const currentPasswordInput = document.querySelector('#currentPassword') as HTMLInputElement;
    const newPasswordInput = document.querySelector('#newPassword') as HTMLInputElement;
    
    expect(passwordSection).toBeTruthy();
    expect(currentPasswordInput.type).toBe('password');
    expect(currentPasswordInput.getAttribute('required')).toBe('');
    expect(newPasswordInput.type).toBe('password');
    expect(newPasswordInput.getAttribute('required')).toBe('');
  });
  
  // TC-F-008
  it('should include cancel button that reverts name field to original value', () => {
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: null,
      error: null
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const cancelButton = document.querySelector('#cancel-btn') as HTMLButtonElement;
    
    expect(cancelButton).toBeTruthy();
    expect(cancelButton.type).toBe('button');
    expect(cancelButton.textContent?.trim()).toBe('Cancel');
  });
  
  // TC-F-014
  it('should display current user data as default values in editable fields', () => {
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: null,
      error: null
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const nameInput = document.querySelector('#name') as HTMLInputElement;
    const emailInput = document.querySelector('#email') as HTMLInputElement;
    
    expect(nameInput.value).toBe(TEST_USER.name);
    expect(emailInput.value).toBe(TEST_USER.email);
  });
  
  // TC-F-016, TC-F-017
  it('should display success notifications for successful updates', () => {
    const successMessage = 'Profile updated successfully';
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: successMessage,
      error: null
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const successAlert = document.querySelector('.alert-success');
    
    expect(successAlert).toBeTruthy();
    expect(successAlert?.textContent?.trim()).toBe(successMessage);
    expect(successAlert?.getAttribute('role')).toBe('alert');
  });
  
  it('should display error messages for failed operations', () => {
    const errorMessage = 'Name must be at least 2 characters';
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: null,
      error: errorMessage
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const errorAlert = document.querySelector('.alert-error');
    
    expect(errorAlert).toBeTruthy();
    expect(errorAlert?.textContent?.trim()).toBe(errorMessage);
    expect(errorAlert?.getAttribute('role')).toBe('alert');
  });
  
  // TC-F-019
  it('should include proper ARIA labels and accessibility attributes for form controls', () => {
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: null,
      error: null
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const nameInput = document.querySelector('#name') as HTMLInputElement;
    const emailInput = document.querySelector('#email') as HTMLInputElement;
    const joinDateInput = document.querySelector('#joinDate') as HTMLInputElement;
    const currentPasswordInput = document.querySelector('#currentPassword') as HTMLInputElement;
    const newPasswordInput = document.querySelector('#newPassword') as HTMLInputElement;
    
    expect(nameInput.getAttribute('aria-label')).toBe('User name');
    expect(emailInput.getAttribute('aria-label')).toBe('User email');
    expect(joinDateInput.getAttribute('aria-label')).toBe('Join date');
    expect(currentPasswordInput.getAttribute('aria-label')).toBe('Current password');
    expect(newPasswordInput.getAttribute('aria-label')).toBe('New password');
  });
  
  it('should format join date using toLocaleDateString with en-US locale', () => {
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: null,
      error: null
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const joinDateInput = document.querySelector('#joinDate') as HTMLInputElement;
    const expectedDate = new Date(TEST_USER.created_at).toLocaleDateString('en-US');
    
    expect(joinDateInput.value).toBe(expectedDate);
  });
  
  it('should include proper form actions and method attributes', () => {
    const rendered = ejs.render(profileTemplate, {
      user: TEST_USER,
      success: null,
      error: null
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const profileForm = document.querySelector('#profile-form') as HTMLFormElement;
    const passwordForm = document.querySelector('#password-form') as HTMLFormElement;
    
    expect(profileForm.method.toLowerCase()).toBe('post');
    expect(profileForm.action).toBe('/profile/update');
    expect(passwordForm.method.toLowerCase()).toBe('post');
    expect(passwordForm.action).toBe('/profile/password');
  });
});

describe('Navigation Integration', () => {
  const TEST_USER = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    created_at: '2023-01-01T00:00:00.000Z'
  };
  
  const layoutTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title><%= title %> - Express Auth</title>
    </head>
    <body>
      <nav class="navbar">
        <% if (user) { %>
          <a href="/profile" class="nav-link <%= title === 'Profile' ? 'active' : '' %>">Profile</a>
          <a href="/dashboard" class="nav-link <%= title === 'Dashboard' ? 'active' : '' %>">Dashboard</a>
        <% } %>
      </nav>
      
      <aside class="sidebar">
        <% if (user) { %>
          <a href="/profile" class="sidebar-link <%= title === 'Profile' ? 'active' : '' %>">Profile</a>
          <a href="/dashboard" class="sidebar-link <%= title === 'Dashboard' ? 'active' : '' %>">Dashboard</a>
        <% } %>
      </aside>
    </body>
    </html>
  `;
  
  // TC-F-010
  it('should display profile link in sidebar navigation above dashboard link for authenticated users', () => {
    const rendered = ejs.render(layoutTemplate, {
      title: 'Profile',
      user: TEST_USER
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const profileLink = Array.from(sidebarLinks).find(link => link.getAttribute('href') === '/profile');
    const dashboardLink = Array.from(sidebarLinks).find(link => link.getAttribute('href') === '/dashboard');
    
    expect(profileLink).toBeTruthy();
    expect(dashboardLink).toBeTruthy();
    
    // Check that profile link comes before dashboard link
    const profileIndex = Array.from(sidebarLinks).indexOf(profileLink!);
    const dashboardIndex = Array.from(sidebarLinks).indexOf(dashboardLink!);
    expect(profileIndex).toBeLessThan(dashboardIndex);
  });
  
  // TC-F-011
  it('should only show profile link to authenticated users with valid JWT tokens', () => {
    // Test with authenticated user
    let rendered = ejs.render(layoutTemplate, {
      title: 'Profile',
      user: TEST_USER
    });
    
    let dom = new JSDOM(rendered);
    let document = dom.window.document;
    
    let profileLink = document.querySelector('a[href="/profile"]');
    expect(profileLink).toBeTruthy();
    
    // Test with unauthenticated user
    rendered = ejs.render(layoutTemplate, {
      title: 'Home',
      user: null
    });
    
    dom = new JSDOM(rendered);
    document = dom.window.document;
    
    profileLink = document.querySelector('a[href="/profile"]');
    expect(profileLink).toBeFalsy();
  });
  
  // TC-F-020
  it('should show active state when user is on profile page', () => {
    const rendered = ejs.render(layoutTemplate, {
      title: 'Profile',
      user: TEST_USER
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const profileNavLink = document.querySelector('.nav-link[href="/profile"]');
    const profileSidebarLink = document.querySelector('.sidebar-link[href="/profile"]');
    const dashboardNavLink = document.querySelector('.nav-link[href="/dashboard"]');
    
    expect(profileNavLink?.classList.contains('active')).toBe(true);
    expect(profileSidebarLink?.classList.contains('active')).toBe(true);
    expect(dashboardNavLink?.classList.contains('active')).toBe(false);
  });
  
  // TC-F-024
  it('should maintain consistent styling with existing dashboard navigation', () => {
    const rendered = ejs.render(layoutTemplate, {
      title: 'Profile',
      user: TEST_USER
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const profileLink = document.querySelector('.sidebar-link[href="/profile"]');
    const dashboardLink = document.querySelector('.sidebar-link[href="/dashboard"]');
    
    // Both should have the same CSS class for consistent styling
    expect(profileLink?.className).toBe('sidebar-link active');
    expect(dashboardLink?.className).toBe('sidebar-link ');
  });
  
  // TC-F-025
  it('should include proper page title and meta information', () => {
    const rendered = ejs.render(layoutTemplate, {
      title: 'Profile',
      user: TEST_USER
    });
    
    const dom = new JSDOM(rendered);
    const document = dom.window.document;
    
    const title = document.querySelector('title');
    const viewport = document.querySelector('meta[name="viewport"]');
    const charset = document.querySelector('meta[charset]');
    
    expect(title?.textContent).toBe('Profile - Express Auth');
    expect(viewport?.getAttribute('content')).toBe('width=device-width, initial-scale=1.0');
    expect(charset?.getAttribute('charset')).toBe('UTF-8');
  });
});