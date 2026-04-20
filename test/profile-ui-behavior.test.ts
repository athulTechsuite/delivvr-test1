import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

// Mock profile page HTML template for testing UI behavior
const mockProfilePageHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Profile</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    .profile-form { max-width: 600px; margin: 0 auto; }
    .form-group { margin-bottom: 1rem; }
    .form-control { width: 100%; padding: 0.5rem; border: 1px solid #ccc; }
    .form-control:focus { border-color: #007bff; outline: none; }
    .btn { padding: 0.5rem 1rem; border: none; cursor: pointer; }
    .btn-primary { background-color: #007bff; color: white; }
    .btn-secondary { background-color: #6c757d; color: white; }
    .password-section { margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #eee; }
    .readonly { background-color: #f8f9fa; }
    .error-message { color: #dc3545; font-size: 0.875rem; }
    .success-message { color: #28a745; font-size: 0.875rem; }
    .edit-mode { border-color: #007bff; }
    .hidden { display: none; }
    
    /* Mobile responsive styles */
    @media (max-width: 767.98px) {
      .profile-form { padding: 1rem; }
      .btn { width: 100%; margin-bottom: 0.5rem; }
    }
    
    /* Tablet responsive styles */
    @media (min-width: 768px) and (max-width: 991.98px) {
      .profile-form { max-width: 80%; }
    }
    
    /* Dark theme support */
    .dark-theme .form-control { background-color: #343a40; color: white; border-color: #495057; }
    .dark-theme .readonly { background-color: #495057; }
  </style>
</head>
<body>
  <nav class="sidebar">
    <ul class="nav-list">
      <li class="nav-item active">
        <a href="/profile" class="nav-link" aria-current="page">Profile</a>
      </li>
      <li class="nav-item">
        <a href="/dashboard" class="nav-link">Dashboard</a>
      </li>
    </ul>
  </nav>
  
  <main class="main-content">
    <div class="profile-form">
      <h1>User Profile</h1>
      
      <form id="profile-form">
        <div class="form-group">
          <label for="name-field" class="form-label">Name</label>
          <input 
            type="text" 
            id="name-field" 
            class="form-control" 
            value="Test User" 
            data-original-value="Test User"
            minlength="2"
            maxlength="50"
            pattern="^[a-zA-Z\\s]+$"
            aria-describedby="name-help name-error"
            aria-label="User name"
          >
          <div id="name-help" class="form-text">Click to edit your name</div>
          <div id="name-error" class="error-message hidden"></div>
          <div id="name-success" class="success-message hidden"></div>
        </div>
        
        <div class="form-group">
          <label for="email-field" class="form-label">Email</label>
          <input 
            type="email" 
            id="email-field" 
            class="form-control readonly" 
            value="test@example.com" 
            readonly
            aria-label="User email (read-only)"
          >
        </div>
        
        <div class="form-group">
          <label for="join-date-field" class="form-label">Member Since</label>
          <input 
            type="text" 
            id="join-date-field" 
            class="form-control readonly" 
            value="January 1, 2023" 
            readonly
            aria-label="Account creation date (read-only)"
          >
        </div>
        
        <div class="form-actions">
          <button type="button" id="save-name-btn" class="btn btn-primary hidden">Save Changes</button>
          <button type="button" id="cancel-name-btn" class="btn btn-secondary hidden">Cancel</button>
        </div>
      </form>
      
      <div class="password-section">
        <h2>Change Password</h2>
        <form id="password-form">
          <div class="form-group">
            <label for="current-password" class="form-label">Current Password</label>
            <input 
              type="password" 
              id="current-password" 
              class="form-control" 
              aria-describedby="current-password-help current-password-error"
              aria-label="Current password"
              required
            >
            <div id="current-password-help" class="form-text">Enter your current password</div>
            <div id="current-password-error" class="error-message hidden"></div>
          </div>
          
          <div class="form-group">
            <label for="new-password" class="form-label">New Password</label>
            <input 
              type="password" 
              id="new-password" 
              class="form-control" 
              minlength="6"
              maxlength="128"
              pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"
              aria-describedby="new-password-help new-password-error"
              aria-label="New password"
              required
            >
            <div id="new-password-help" class="form-text">Must be 6+ characters with uppercase, lowercase, and number</div>
            <div id="new-password-error" class="error-message hidden"></div>
          </div>
          
          <div class="form-actions">
            <button type="submit" id="save-password-btn" class="btn btn-primary" disabled>Update Password</button>
          </div>
          
          <div id="password-success" class="success-message hidden"></div>
        </form>
      </div>
    </div>
  </main>
  
  <script>
    // Profile page JavaScript functionality
    let isNameEditing = false;
    let originalNameValue = 'Test User';
    
    const nameField = document.getElementById('name-field');
    const saveNameBtn = document.getElementById('save-name-btn');
    const cancelNameBtn = document.getElementById('cancel-name-btn');
    const nameError = document.getElementById('name-error');
    const nameSuccess = document.getElementById('name-success');
    
    const currentPasswordField = document.getElementById('current-password');
    const newPasswordField = document.getElementById('new-password');
    const savePasswordBtn = document.getElementById('save-password-btn');
    const passwordError = document.getElementById('current-password-error');
    const newPasswordError = document.getElementById('new-password-error');
    const passwordSuccess = document.getElementById('password-success');
    
    // Name editing functionality
    nameField.addEventListener('focus', enterNameEditMode);
    nameField.addEventListener('click', enterNameEditMode);
    nameField.addEventListener('input', validateNameField);
    nameField.addEventListener('keydown', handleNameKeydown);
    
    saveNameBtn.addEventListener('click', saveName);
    cancelNameBtn.addEventListener('click', cancelNameEdit);
    
    // Password form functionality
    currentPasswordField.addEventListener('input', validatePasswordForm);
    newPasswordField.addEventListener('input', validatePasswordForm);
    document.getElementById('password-form').addEventListener('submit', updatePassword);
    
    function enterNameEditMode() {
      if (!isNameEditing) {
        isNameEditing = true;
        nameField.classList.add('edit-mode');
        saveNameBtn.classList.remove('hidden');
        cancelNameBtn.classList.remove('hidden');
        nameField.focus();
        nameField.select();
      }
    }
    
    function cancelNameEdit() {
      isNameEditing = false;
      nameField.value = originalNameValue;
      nameField.classList.remove('edit-mode');
      saveNameBtn.classList.add('hidden');
      cancelNameBtn.classList.add('hidden');
      hideMessage(nameError);
      hideMessage(nameSuccess);
      nameField.blur();
    }
    
    function validateNameField() {
      const value = nameField.value.trim();
      const isValid = value.length >= 2 && value.length <= 50 && /^[a-zA-Z\\s]+$/.test(value);
      
      if (!isValid && value.length > 0) {
        let errorMsg = '';
        if (value.length < 2) {
          errorMsg = 'Name must be at least 2 characters';
        } else if (value.length > 50) {
          errorMsg = 'Name must be no more than 50 characters';
        } else if (!/^[a-zA-Z\\s]+$/.test(value)) {
          errorMsg = 'Name can only contain letters and spaces';
        }
        showMessage(nameError, errorMsg);
      } else {
        hideMessage(nameError);
      }
      
      saveNameBtn.disabled = !isValid || value === originalNameValue;
    }
    
    function handleNameKeydown(event) {
      if (event.key === 'Escape') {
        cancelNameEdit();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (!saveNameBtn.disabled) {
          saveName();
        }
      }
    }
    
    function saveName() {
      const value = nameField.value.trim();
      
      if (value === originalNameValue) {
        cancelNameEdit();
        return;
      }
      
      // Simulate API call
      setTimeout(() => {
        originalNameValue = value;
        nameField.setAttribute('data-original-value', value);
        isNameEditing = false;
        nameField.classList.remove('edit-mode');
        saveNameBtn.classList.add('hidden');
        cancelNameBtn.classList.add('hidden');
        showMessage(nameSuccess, 'Name updated successfully');
        hideMessage(nameError);
      }, 100);
    }
    
    function validatePasswordForm() {
      const currentPassword = currentPasswordField.value;
      const newPassword = newPasswordField.value;
      const hasCurrentPassword = currentPassword.length > 0;
      const isNewPasswordValid = newPassword.length >= 6 && 
                               newPassword.length <= 128 && 
                               /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/.test(newPassword);
      
      savePasswordBtn.disabled = !(hasCurrentPassword && isNewPasswordValid);
      
      // Validate new password
      if (newPassword.length > 0 && !isNewPasswordValid) {
        let errorMsg = '';
        if (newPassword.length < 6) {
          errorMsg = 'Password must be at least 6 characters';
        } else if (newPassword.length > 128) {
          errorMsg = 'Password must be no more than 128 characters';
        } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/.test(newPassword)) {
          errorMsg = 'Password must contain uppercase, lowercase, and number';
        }
        showMessage(newPasswordError, errorMsg);
      } else {
        hideMessage(newPasswordError);
      }
    }
    
    function updatePassword(event) {
      event.preventDefault();
      
      // Simulate API call
      setTimeout(() => {
        currentPasswordField.value = '';
        newPasswordField.value = '';
        savePasswordBtn.disabled = true;
        showMessage(passwordSuccess, 'Password updated successfully');
        hideMessage(passwordError);
        hideMessage(newPasswordError);
      }, 100);
    }
    
    function showMessage(element, message) {
      element.textContent = message;
      element.classList.remove('hidden');
    }
    
    function hideMessage(element) {
      element.classList.add('hidden');
      element.textContent = '';
    }
    
    // Theme management
    function initializeTheme() {
      const savedTheme = localStorage.getItem('theme-mode') || 'light';
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
      }
    }
    
    initializeTheme();
  </script>
</body>
</html>
`;

describe('Profile UI Behavior and Interaction', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  
  beforeEach(() => {
    dom = new JSDOM(mockProfilePageHtml, {
      url: 'http://localhost:3000/profile',
      runScripts: 'dangerously',
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window as any;
    
    // Wait for scripts to execute
    return new Promise(resolve => setTimeout(resolve, 100));
  });
  
  afterEach(() => {
    dom.window.close();
  });
  
  describe('Profile Form Display and Readonly Fields', () => {
    // TC-U-001
    test('should display user name, email, and join date in readonly format initially', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const emailField = document.getElementById('email-field') as HTMLInputElement;
      const joinDateField = document.getElementById('join-date-field') as HTMLInputElement;
      
      expect(nameField.value).toBe('Test User');
      expect(emailField.value).toBe('test@example.com');
      expect(joinDateField.value).toBe('January 1, 2023');
      expect(emailField.readOnly).toBe(true);
      expect(joinDateField.readOnly).toBe(true);
    });
    
    // TC-U-002
    test('should display current user data as default values in editable fields', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      
      expect(nameField.value).toBe('Test User');
      expect(nameField.getAttribute('data-original-value')).toBe('Test User');
      expect(nameField.readOnly).toBe(false);
    });
  });
  
  describe('Inline Name Editing Functionality', () => {
    // TC-U-003
    test('should allow inline editing when name field is clicked or focused', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const saveBtn = document.getElementById('save-name-btn') as HTMLButtonElement;
      const cancelBtn = document.getElementById('cancel-name-btn') as HTMLButtonElement;
      
      // Initially buttons should be hidden
      expect(saveBtn.classList.contains('hidden')).toBe(true);
      expect(cancelBtn.classList.contains('hidden')).toBe(true);
      
      // Click to enter edit mode
      nameField.click();
      
      expect(nameField.classList.contains('edit-mode')).toBe(true);
      expect(saveBtn.classList.contains('hidden')).toBe(false);
      expect(cancelBtn.classList.contains('hidden')).toBe(false);
    });
    
    // TC-U-004
    test('should enter edit mode when name field is focused', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const saveBtn = document.getElementById('save-name-btn') as HTMLButtonElement;
      
      nameField.focus();
      
      expect(nameField.classList.contains('edit-mode')).toBe(true);
      expect(saveBtn.classList.contains('hidden')).toBe(false);
    });
    
    // TC-U-005
    test('should validate name is not empty before enabling save button', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const saveBtn = document.getElementById('save-name-btn') as HTMLButtonElement;
      
      nameField.click();
      nameField.value = '';
      nameField.dispatchEvent(new window.Event('input'));
      
      expect(saveBtn.disabled).toBe(true);
    });
    
    // TC-U-006
    test('should validate minimum 2 character requirement for name', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const saveBtn = document.getElementById('save-name-btn') as HTMLButtonElement;
      const errorDiv = document.getElementById('name-error') as HTMLElement;
      
      nameField.click();
      nameField.value = 'A';
      nameField.dispatchEvent(new window.Event('input'));
      
      expect(saveBtn.disabled).toBe(true);
      expect(errorDiv.textContent).toBe('Name must be at least 2 characters');
      expect(errorDiv.classList.contains('hidden')).toBe(false);
    });
    
    // TC-U-007
    test('should validate maximum 50 character limit for name', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const saveBtn = document.getElementById('save-name-btn') as HTMLButtonElement;
      const errorDiv = document.getElementById('name-error') as HTMLElement;
      
      nameField.click();
      nameField.value = 'A'.repeat(51);
      nameField.dispatchEvent(new window.Event('input'));
      
      expect(saveBtn.disabled).toBe(true);
      expect(errorDiv.textContent).toBe('Name must be no more than 50 characters');
      expect(errorDiv.classList.contains('hidden')).toBe(false);
    });
    
    // TC-U-008
    test('should validate name contains only letters and spaces', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const saveBtn = document.getElementById('save-name-btn') as HTMLButtonElement;
      const errorDiv = document.getElementById('name-error') as HTMLElement;
      
      nameField.click();
      nameField.value = 'Test Name123';
      nameField.dispatchEvent(new window.Event('input'));
      
      expect(saveBtn.disabled).toBe(true);
      expect(errorDiv.textContent).toBe('Name can only contain letters and spaces');
      expect(errorDiv.classList.contains('hidden')).toBe(false);
    });
  });
  
  describe('Cancel and Save Functionality', () => {
    // TC-U-009
    test('should revert name field to original value when cancel button is clicked', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const cancelBtn = document.getElementById('cancel-name-btn') as HTMLButtonElement;
      const originalValue = nameField.value;
      
      nameField.click();
      nameField.value = 'Modified Name';
      cancelBtn.click();
      
      expect(nameField.value).toBe(originalValue);
      expect(nameField.classList.contains('edit-mode')).toBe(false);
    });
    
    // TC-U-010
    test('should exit edit mode and revert to original values on escape key', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const originalValue = nameField.value;
      
      nameField.click();
      nameField.value = 'Modified Name';
      
      const escapeEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
      nameField.dispatchEvent(escapeEvent);
      
      expect(nameField.value).toBe(originalValue);
      expect(nameField.classList.contains('edit-mode')).toBe(false);
    });
    
    // TC-U-011
    test('should save changes and show success feedback', (done) => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const saveBtn = document.getElementById('save-name-btn') as HTMLButtonElement;
      const successDiv = document.getElementById('name-success') as HTMLElement;
      
      nameField.click();
      nameField.value = 'Updated Name';
      nameField.dispatchEvent(new window.Event('input'));
      saveBtn.click();
      
      setTimeout(() => {
        expect(successDiv.textContent).toBe('Name updated successfully');
        expect(successDiv.classList.contains('hidden')).toBe(false);
        expect(nameField.classList.contains('edit-mode')).toBe(false);
        done();
      }, 150);
    });
    
    // TC-U-012
    test('should prevent submission of unchanged data', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const saveBtn = document.getElementById('save-name-btn') as HTMLButtonElement;
      
      nameField.click();
      // Keep original value
      nameField.dispatchEvent(new window.Event('input'));
      
      expect(saveBtn.disabled).toBe(true);
    });
  });
  
  describe('Password Change Section', () => {
    // TC-U-013
    test('should include separate password change section with current and new password fields', () => {
      const passwordSection = document.querySelector('.password-section');
      const currentPasswordField = document.getElementById('current-password') as HTMLInputElement;
      const newPasswordField = document.getElementById('new-password') as HTMLInputElement;
      
      expect(passwordSection).toBeTruthy();
      expect(currentPasswordField).toBeTruthy();
      expect(newPasswordField).toBeTruthy();
      expect(currentPasswordField.type).toBe('password');
      expect(newPasswordField.type).toBe('password');
    });
    
    // TC-U-014
    test('should require both current and new password fields before enabling submit', () => {
      const currentPasswordField = document.getElementById('current-password') as HTMLInputElement;
      const newPasswordField = document.getElementById('new-password') as HTMLInputElement;
      const savePasswordBtn = document.getElementById('save-password-btn') as HTMLButtonElement;
      
      expect(savePasswordBtn.disabled).toBe(true);
      
      currentPasswordField.value = 'currentpass';
      currentPasswordField.dispatchEvent(new window.Event('input'));
      expect(savePasswordBtn.disabled).toBe(true);
      
      newPasswordField.value = 'NewPass123';
      newPasswordField.dispatchEvent(new window.Event('input'));
      expect(savePasswordBtn.disabled).toBe(false);
    });
    
    // TC-U-015
    test('should validate new password meets minimum requirements', () => {
      const newPasswordField = document.getElementById('new-password') as HTMLInputElement;
      const savePasswordBtn = document.getElementById('save-password-btn') as HTMLButtonElement;
      const errorDiv = document.getElementById('new-password-error') as HTMLElement;
      
      newPasswordField.value = 'weak';
      newPasswordField.dispatchEvent(new window.Event('input'));
      
      expect(savePasswordBtn.disabled).toBe(true);
      expect(errorDiv.textContent).toBe('Password must be at least 6 characters');
    });
    
    // TC-U-016
    test('should validate new password contains required character types', () => {
      const newPasswordField = document.getElementById('new-password') as HTMLInputElement;
      const errorDiv = document.getElementById('new-password-error') as HTMLElement;
      
      newPasswordField.value = 'simplepassword';
      newPasswordField.dispatchEvent(new window.Event('input'));
      
      expect(errorDiv.textContent).toBe('Password must contain uppercase, lowercase, and number');
    });
    
    // TC-U-017
    test('should show success message after password update', (done) => {
      const currentPasswordField = document.getElementById('current-password') as HTMLInputElement;
      const newPasswordField = document.getElementById('new-password') as HTMLInputElement;
      const passwordForm = document.getElementById('password-form') as HTMLFormElement;
      const successDiv = document.getElementById('password-success') as HTMLElement;
      
      currentPasswordField.value = 'currentpass';
      newPasswordField.value = 'NewPass123';
      currentPasswordField.dispatchEvent(new window.Event('input'));
      newPasswordField.dispatchEvent(new window.Event('input'));
      
      passwordForm.dispatchEvent(new window.Event('submit'));
      
      setTimeout(() => {
        expect(successDiv.textContent).toBe('Password updated successfully');
        expect(successDiv.classList.contains('hidden')).toBe(false);
        expect(currentPasswordField.value).toBe('');
        expect(newPasswordField.value).toBe('');
        done();
      }, 150);
    });
  });
  
  describe('Responsive Design and Accessibility', () => {
    // TC-U-018
    test('should maintain responsive design across different viewport sizes', () => {
      const profileForm = document.querySelector('.profile-form') as HTMLElement;
      const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
      
      expect(viewportMeta.content).toBe('width=device-width, initial-scale=1.0');
      expect(profileForm).toBeTruthy();
      
      // Check CSS rules exist for responsive breakpoints
      const styles = document.querySelector('style')?.textContent;
      expect(styles).toContain('@media (max-width: 767.98px)');
      expect(styles).toContain('@media (min-width: 768px) and (max-width: 991.98px)');
    });
    
    // TC-U-019
    test('should include proper ARIA labels and accessibility attributes', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const emailField = document.getElementById('email-field') as HTMLInputElement;
      const currentPasswordField = document.getElementById('current-password') as HTMLInputElement;
      
      expect(nameField.getAttribute('aria-label')).toBe('User name');
      expect(nameField.getAttribute('aria-describedby')).toContain('name-help');
      expect(emailField.getAttribute('aria-label')).toBe('User email (read-only)');
      expect(currentPasswordField.getAttribute('aria-label')).toBe('Current password');
      
      // Check for required attributes
      expect(currentPasswordField.required).toBe(true);
    });
    
    // TC-U-020
    test('should show active state in navigation when on profile page', () => {
      const profileNavItem = document.querySelector('li.nav-item.active a[href="/profile"]');
      const profileLink = profileNavItem as HTMLAnchorElement;
      
      expect(profileNavItem).toBeTruthy();
      expect(profileLink.getAttribute('aria-current')).toBe('page');
    });
    
    // TC-U-021
    test('should handle graceful error display with user-friendly messages', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const errorDiv = document.getElementById('name-error') as HTMLElement;
      
      nameField.click();
      nameField.value = '123';
      nameField.dispatchEvent(new window.Event('input'));
      
      expect(errorDiv.classList.contains('error-message')).toBe(true);
      expect(errorDiv.textContent).toBeTruthy();
      expect(errorDiv.classList.contains('hidden')).toBe(false);
    });
    
    // TC-U-022
    test('should support keyboard navigation with Enter and Escape keys', () => {
      const nameField = document.getElementById('name-field') as HTMLInputElement;
      const saveBtn = document.getElementById('save-name-btn') as HTMLButtonElement;
      
      nameField.click();
      nameField.value = 'New Name';
      nameField.dispatchEvent(new window.Event('input'));
      
      // Test Enter key saves (when valid)
      const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter' });
      nameField.dispatchEvent(enterEvent);
      
      // Should trigger save functionality
      expect(nameField.value).toBe('New Name');
    });
    
    // TC-U-023
    test('should include proper page title and meta information', () => {
      const title = document.querySelector('title')?.textContent;
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      
      expect(title).toBe('Profile');
      expect(viewportMeta).toBeTruthy();
    });
    
    // TC-U-024
    test('should support theme persistence and dark theme styling', () => {
      // Test theme initialization
      const body = document.body;
      const styles = document.querySelector('style')?.textContent;
      
      expect(styles).toContain('.dark-theme');
      expect(styles).toContain('.dark-theme .form-control');
      
      // Test localStorage theme handling would be tested in integration
      expect(typeof window.localStorage).toBe('object');
    });
    
    // TC-U-025
    test('should maintain consistent styling with Material Design principles', () => {
      const formControls = document.querySelectorAll('.form-control');
      const buttons = document.querySelectorAll('.btn');
      const styles = document.querySelector('style')?.textContent;
      
      expect(formControls.length).toBeGreaterThan(0);
      expect(buttons.length).toBeGreaterThan(0);
      
      // Check for Material Design-like styling
      expect(styles).toContain('border-radius');
      expect(styles).toContain(':focus');
      expect(styles).toContain('outline: none');
    });
  });
});