import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

// Test data
const TEST_USER = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  profile_picture: 'uploads/1-123456.jpg',
  created_at: '2023-01-01T00:00:00.000Z'
};

const USER_WITHOUT_PICTURE = {
  id: 2,
  name: 'No Picture User',
  email: 'nopicture@example.com',
  profile_picture: null,
  created_at: '2023-01-01T00:00:00.000Z'
};

// Mock profile template
const mockProfileTemplate = `
<!DOCTYPE html>
<html>
<head>
  <title>Profile - <%= title %></title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="container">
    <div id="profile-container">
      <h1>Profile</h1>
      
      <% if (user) { %>
        <!-- Read-only view -->
        <div id="profile-view" class="profile-section">
          <div class="profile-info">
            <div class="profile-field">
              <label>Name:</label>
              <span id="display-name"><%= user.name %></span>
            </div>
            
            <div class="profile-field">
              <label>Email:</label>
              <span id="display-email"><%= user.email %></span>
            </div>
            
            <div class="profile-field">
              <label>Member since:</label>
              <span id="display-date"><%= new Date(user.created_at).toLocaleDateString() %></span>
            </div>
            
            <div class="profile-field">
              <label>Profile Picture:</label>
              <% if (user.profile_picture) { %>
                <img src="/<%= user.profile_picture %>" alt="Profile Picture" id="profile-picture" class="profile-img">
              <% } else { %>
                <div id="profile-picture-placeholder" class="placeholder">No profile picture uploaded</div>
              <% } %>
            </div>
          </div>
          
          <button id="edit-profile-btn" class="btn btn-primary">Edit Profile</button>
        </div>
        
        <!-- Edit mode form -->
        <div id="edit-form" class="profile-section" style="display: none;">
          <form method="POST" action="/profile" enctype="multipart/form-data">
            <div class="form-group">
              <label for="name">Name:</label>
              <input type="text" id="edit-name" name="name" value="<%= user.name %>" 
                     class="form-control" required minlength="2" maxlength="50">
              <div class="error-message" id="name-error" style="display: none;"></div>
            </div>
            
            <div class="form-group">
              <label for="email">Email:</label>
              <input type="email" id="edit-email" name="email" value="<%= user.email %>" 
                     class="form-control" required>
              <div class="error-message" id="email-error" style="display: none;"></div>
            </div>
            
            <div class="form-group">
              <label for="profilePicture">Profile Picture:</label>
              <input type="file" id="edit-profile-picture" name="profilePicture" 
                     class="form-control" accept=".jpg,.jpeg,.png,.gif">
              <small class="form-text">Accepted formats: JPG, JPEG, PNG, GIF (max 5MB)</small>
              <div class="error-message" id="picture-error" style="display: none;"></div>
            </div>
            
            <div class="form-actions">
              <button type="submit" id="save-btn" class="btn btn-success">Save Changes</button>
              <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      <% } else { %>
        <p>Please log in to view your profile.</p>
      <% } %>
      
      <!-- Messages -->
      <% if (success) { %>
        <div id="success-message" class="alert alert-success"><%= success %></div>
      <% } %>
      
      <% if (error) { %>
        <div id="error-message" class="alert alert-error"><%= error %></div>
      <% } %>
    </div>
  </div>
  
  <!-- JavaScript for inline editing -->
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const editBtn = document.getElementById('edit-profile-btn');
      const profileView = document.getElementById('profile-view');
      const editForm = document.getElementById('edit-form');
      const cancelBtn = document.getElementById('cancel-btn');
      const nameInput = document.getElementById('edit-name');
      const emailInput = document.getElementById('edit-email');
      const pictureInput = document.getElementById('edit-profile-picture');
      
      // Switch to edit mode
      if (editBtn) {
        editBtn.addEventListener('click', function() {
          profileView.style.display = 'none';
          editForm.style.display = 'block';
        });
      }
      
      // Cancel edit mode
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          // Reset form to original values
          nameInput.value = '<%= user ? user.name : "" %>';
          emailInput.value = '<%= user ? user.email : "" %>';
          pictureInput.value = '';
          
          // Clear error messages
          document.querySelectorAll('.error-message').forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
          });
          
          // Return to view mode
          editForm.style.display = 'none';
          profileView.style.display = 'block';
        });
      }
      
      // Client-side validation
      function validateField(field, errorElement, validator) {
        field.addEventListener('blur', function() {
          const result = validator(field.value);
          if (result.isValid) {
            field.classList.remove('error');
            errorElement.style.display = 'none';
          } else {
            field.classList.add('error');
            errorElement.textContent = result.message;
            errorElement.style.display = 'block';
          }
        });
      }
      
      // Name validation
      if (nameInput) {
        validateField(nameInput, document.getElementById('name-error'), function(value) {
          if (!value || value.length < 2) {
            return { isValid: false, message: 'Name must be at least 2 characters long' };
          }
          if (value.length > 50) {
            return { isValid: false, message: 'Name must be no more than 50 characters long' };
          }
          if (!/^[a-zA-Z\s]+$/.test(value)) {
            return { isValid: false, message: 'Name must contain only letters and spaces' };
          }
          return { isValid: true };
        });
      }
      
      // Email validation
      if (emailInput) {
        validateField(emailInput, document.getElementById('email-error'), function(value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!value || !emailRegex.test(value)) {
            return { isValid: false, message: 'Please enter a valid email address' };
          }
          return { isValid: true };
        });
      }
      
      // File validation
      if (pictureInput) {
        pictureInput.addEventListener('change', function() {
          const file = this.files[0];
          const errorElement = document.getElementById('picture-error');
          
          if (file) {
            // Check file size (5MB limit)
            if (file.size > 5242880) {
              errorElement.textContent = 'File size must be less than 5MB';
              errorElement.style.display = 'block';
              this.value = '';
              return;
            }
            
            // Check file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
              errorElement.textContent = 'Only JPG, JPEG, PNG, and GIF files are allowed';
              errorElement.style.display = 'block';
              this.value = '';
              return;
            }
            
            errorElement.style.display = 'none';
          }
        });
      }
      
      // Auto-hide success message after 3 seconds
      const successMessage = document.getElementById('success-message');
      if (successMessage) {
        setTimeout(function() {
          successMessage.style.display = 'none';
        }, 3000);
      }
    });
  </script>
</body>
</html>
`;

describe('Profile UI Components', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window & typeof globalThis;
  
  const renderTemplate = (templateData: any) => {
    return ejs.render(mockProfileTemplate, templateData);
  };
  
  beforeEach(() => {
    // Create a new DOM for each test
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    document = dom.window.document;
    window = dom.window as any;
    
    // Set up global document for tests
    global.document = document;
    global.window = window;
  });

  describe('Profile View Mode', () => {
    // TC-F-001: User can view current profile information in read-only format
    test('should display user profile information in read-only format', () => {
      const html = renderTemplate({ user: TEST_USER, title: 'Profile' });
      document.body.innerHTML = html;
      
      const displayName = document.getElementById('display-name');
      const displayEmail = document.getElementById('display-email');
      const profilePicture = document.getElementById('profile-picture');
      
      expect(displayName?.textContent).toBe('Test User');
      expect(displayEmail?.textContent).toBe('test@example.com');
      expect(profilePicture?.getAttribute('src')).toBe('/uploads/1-123456.jpg');
    });

    // TC-F-001: Profile picture placeholder when none exists
    test('should display placeholder when user has no profile picture', () => {
      const html = renderTemplate({ user: USER_WITHOUT_PICTURE, title: 'Profile' });
      document.body.innerHTML = html;
      
      const placeholder = document.getElementById('profile-picture-placeholder');
      const profilePicture = document.getElementById('profile-picture');
      
      expect(placeholder).toBeTruthy();
      expect(placeholder?.textContent).toBe('No profile picture uploaded');
      expect(profilePicture).toBeFalsy();
    });

    // TC-F-002: Edit Profile button visible in read-only view
    test('should display Edit Profile button in view mode', () => {
      const html = renderTemplate({ user: TEST_USER, title: 'Profile' });
      document.body.innerHTML = html;
      
      const editButton = document.getElementById('edit-profile-btn');
      
      expect(editButton).toBeTruthy();
      expect(editButton?.textContent).toBe('Edit Profile');
    });
  });

  describe('Edit Mode Functionality', () => {
    beforeEach(() => {
      const html = renderTemplate({ user: TEST_USER, title: 'Profile' });
      document.body.innerHTML = html;
      
      // Execute the inline script
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        if (script.textContent) {
          eval(script.textContent);
        }
      });
      
      // Trigger DOMContentLoaded
      const event = new window.Event('DOMContentLoaded');
      document.dispatchEvent(event);
    });

    // TC-F-002: Clicking Edit switches to edit mode on same page
    test('should switch to edit mode when Edit Profile button is clicked', () => {
      const editButton = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const profileView = document.getElementById('profile-view') as HTMLElement;
      const editForm = document.getElementById('edit-form') as HTMLElement;
      
      // Initially in view mode
      expect(profileView.style.display).not.toBe('none');
      expect(editForm.style.display).toBe('none');
      
      // Click edit button
      editButton.click();
      
      // Should switch to edit mode
      expect(profileView.style.display).toBe('none');
      expect(editForm.style.display).toBe('block');
    });

    // TC-F-003: Name and email fields become editable with pre-populated values
    test('should pre-populate edit fields with current values', () => {
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const emailInput = document.getElementById('edit-email') as HTMLInputElement;
      
      expect(nameInput.value).toBe('Test User');
      expect(emailInput.value).toBe('test@example.com');
    });

    // TC-F-004: Profile picture upload functionality available in edit mode
    test('should provide file upload input for profile picture', () => {
      const pictureInput = document.getElementById('edit-profile-picture') as HTMLInputElement;
      
      expect(pictureInput).toBeTruthy();
      expect(pictureInput.type).toBe('file');
      expect(pictureInput.accept).toBe('.jpg,.jpeg,.png,.gif');
    });

    // TC-F-005: Save and Cancel buttons visible in edit mode
    test('should display Save and Cancel buttons in edit mode', () => {
      const saveButton = document.getElementById('save-btn');
      const cancelButton = document.getElementById('cancel-btn');
      
      expect(saveButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();
      expect(saveButton?.textContent).toBe('Save Changes');
      expect(cancelButton?.textContent).toBe('Cancel');
    });

    // TC-F-007: Cancel discards changes and returns to read-only view
    test('should discard changes and return to view mode when Cancel is clicked', () => {
      const editButton = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const cancelButton = document.getElementById('cancel-btn') as HTMLButtonElement;
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const profileView = document.getElementById('profile-view') as HTMLElement;
      const editForm = document.getElementById('edit-form') as HTMLElement;
      
      // Switch to edit mode
      editButton.click();
      
      // Make changes
      nameInput.value = 'Changed Name';
      
      // Click cancel
      cancelButton.click();
      
      // Should return to view mode and reset values
      expect(profileView.style.display).toBe('block');
      expect(editForm.style.display).toBe('none');
      expect(nameInput.value).toBe('Test User'); // Reset to original
    });
  });

  describe('Client-side Validation', () => {
    beforeEach(() => {
      const html = renderTemplate({ user: TEST_USER, title: 'Profile' });
      document.body.innerHTML = html;
      
      // Execute the inline script
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        if (script.textContent) {
          eval(script.textContent);
        }
      });
      
      // Trigger DOMContentLoaded
      const event = new window.Event('DOMContentLoaded');
      document.dispatchEvent(event);
    });

    // TC-F-008: Name validation on blur with immediate feedback
    test('should validate name field on blur with visual feedback', () => {
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      // Test invalid short name
      nameInput.value = 'A';
      const blurEvent = new window.Event('blur');
      nameInput.dispatchEvent(blurEvent);
      
      expect(nameInput.classList.contains('error')).toBe(true);
      expect(nameError.style.display).toBe('block');
      expect(nameError.textContent).toContain('at least 2 characters');
    });

    // TC-F-008: Name character validation
    test('should validate name contains only letters and spaces', () => {
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      // Test invalid characters
      nameInput.value = 'Invalid123';
      const blurEvent = new window.Event('blur');
      nameInput.dispatchEvent(blurEvent);
      
      expect(nameInput.classList.contains('error')).toBe(true);
      expect(nameError.textContent).toContain('only letters and spaces');
    });

    // TC-F-009: Email validation on blur
    test('should validate email format on blur', () => {
      const emailInput = document.getElementById('edit-email') as HTMLInputElement;
      const emailError = document.getElementById('email-error') as HTMLElement;
      
      // Test invalid email
      emailInput.value = 'invalid-email';
      const blurEvent = new window.Event('blur');
      emailInput.dispatchEvent(blurEvent);
      
      expect(emailInput.classList.contains('error')).toBe(true);
      expect(emailError.style.display).toBe('block');
      expect(emailError.textContent).toContain('valid email address');
    });

    // TC-F-012: File size validation
    test('should validate file size when selecting profile picture', () => {
      const pictureInput = document.getElementById('edit-profile-picture') as HTMLInputElement;
      const pictureError = document.getElementById('picture-error') as HTMLElement;
      
      // Mock large file
      const largeFile = new File(['x'.repeat(6000000)], 'large.jpg', {
        type: 'image/jpeg'
      });
      
      // Create file list
      const dataTransfer = new window.DataTransfer();
      dataTransfer.items.add(largeFile);
      pictureInput.files = dataTransfer.files;
      
      // Trigger change event
      const changeEvent = new window.Event('change');
      pictureInput.dispatchEvent(changeEvent);
      
      expect(pictureError.style.display).toBe('block');
      expect(pictureError.textContent).toContain('less than 5MB');
    });

    // TC-F-010: File type validation
    test('should validate file type for profile picture', () => {
      const pictureInput = document.getElementById('edit-profile-picture') as HTMLInputElement;
      const pictureError = document.getElementById('picture-error') as HTMLElement;
      
      // Mock invalid file type
      const invalidFile = new File(['content'], 'file.txt', {
        type: 'text/plain'
      });
      
      const dataTransfer = new window.DataTransfer();
      dataTransfer.items.add(invalidFile);
      pictureInput.files = dataTransfer.files;
      
      const changeEvent = new window.Event('change');
      pictureInput.dispatchEvent(changeEvent);
      
      expect(pictureError.style.display).toBe('block');
      expect(pictureError.textContent).toContain('JPG, JPEG, PNG, and GIF files');
    });
  });

  describe('Message Display', () => {
    // TC-F-014: Success confirmation message display
    test('should display success message when provided', () => {
      const html = renderTemplate({ 
        user: TEST_USER, 
        title: 'Profile',
        success: 'Profile updated successfully'
      });
      document.body.innerHTML = html;
      
      const successMessage = document.getElementById('success-message');
      expect(successMessage).toBeTruthy();
      expect(successMessage?.textContent).toBe('Profile updated successfully');
      expect(successMessage?.className).toContain('alert-success');
    });

    // TC-F-014: Error message display
    test('should display error message when provided', () => {
      const html = renderTemplate({ 
        user: TEST_USER, 
        title: 'Profile',
        error: 'Validation failed'
      });
      document.body.innerHTML = html;
      
      const errorMessage = document.getElementById('error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toBe('Validation failed');
      expect(errorMessage?.className).toContain('alert-error');
    });

    // TC-F-014: Success message auto-hide after 3 seconds
    test('should auto-hide success message after 3 seconds', (done) => {
      const html = renderTemplate({ 
        user: TEST_USER, 
        title: 'Profile',
        success: 'Profile updated successfully'
      });
      document.body.innerHTML = html;
      
      // Execute the inline script
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        if (script.textContent) {
          eval(script.textContent);
        }
      });
      
      // Trigger DOMContentLoaded
      const event = new window.Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      const successMessage = document.getElementById('success-message') as HTMLElement;
      expect(successMessage.style.display).not.toBe('none');
      
      // Check after timeout
      setTimeout(() => {
        expect(successMessage.style.display).toBe('none');
        done();
      }, 3100);
    });
  });

  describe('Form Attributes and Accessibility', () => {
    test('should have proper form attributes for profile update', () => {
      const html = renderTemplate({ user: TEST_USER, title: 'Profile' });
      document.body.innerHTML = html;
      
      const form = document.querySelector('form');
      const nameInput = document.getElementById('edit-name');
      const emailInput = document.getElementById('edit-email');
      const pictureInput = document.getElementById('edit-profile-picture');
      
      expect(form?.method.toLowerCase()).toBe('post');
      expect(form?.action).toBe('/profile');
      expect(form?.enctype).toBe('multipart/form-data');
      
      expect(nameInput?.getAttribute('required')).toBeDefined();
      expect(nameInput?.getAttribute('minlength')).toBe('2');
      expect(nameInput?.getAttribute('maxlength')).toBe('50');
      
      expect(emailInput?.getAttribute('required')).toBeDefined();
      expect(emailInput?.getAttribute('type')).toBe('email');
      
      expect(pictureInput?.getAttribute('accept')).toBe('.jpg,.jpeg,.png,.gif');
    });

    // TC-F-003: Input fields have proper labels
    test('should have proper labels for all input fields', () => {
      const html = renderTemplate({ user: TEST_USER, title: 'Profile' });
      document.body.innerHTML = html;
      
      const nameLabel = document.querySelector('label[for="name"]');
      const emailLabel = document.querySelector('label[for="email"]');
      const pictureLabel = document.querySelector('label[for="profilePicture"]');
      
      expect(nameLabel?.textContent).toContain('Name:');
      expect(emailLabel?.textContent).toContain('Email:');
      expect(pictureLabel?.textContent).toContain('Profile Picture:');
    });
  });
});