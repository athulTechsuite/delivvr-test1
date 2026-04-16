import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

// Mock profile template content
const mockProfileTemplate = `
<!DOCTYPE html>
<html>
<head>
  <title>Profile</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="profile-container">
    <div class="profile-header">
      <h1>Profile</h1>
    </div>
    
    <!-- View Mode -->
    <div id="view-mode" class="profile-view">
      <div class="profile-picture-container">
        <% if (profile.profile_picture) { %>
          <img src="/<%= profile.profile_picture %>" alt="Profile Picture" class="profile-picture">
        <% } else { %>
          <div class="profile-picture-placeholder">No Image</div>
        <% } %>
      </div>
      
      <div class="profile-info">
        <div class="field">
          <label>Name:</label>
          <span class="value" id="display-name"><%= profile.name %></span>
        </div>
        
        <div class="field">
          <label>Email:</label>
          <span class="value" id="display-email"><%= profile.email %></span>
        </div>
        
        <div class="field">
          <label>Join Date:</label>
          <span class="value"><%= new Date(profile.created_at).toLocaleDateString() %></span>
        </div>
      </div>
      
      <button id="edit-btn" class="md-button md-button-primary">Edit Profile</button>
    </div>
    
    <!-- Edit Mode -->
    <div id="edit-mode" class="profile-edit" style="display: none;">
      <form id="profile-form" enctype="multipart/form-data">
        <div class="profile-picture-upload">
          <div class="current-picture">
            <% if (profile.profile_picture) { %>
              <img src="/<%= profile.profile_picture %>" alt="Current Profile Picture" class="current-profile-picture">
            <% } else { %>
              <div class="profile-picture-placeholder">No Image</div>
            <% } %>
          </div>
          
          <div class="upload-section">
            <label for="profilePicture">Profile Picture:</label>
            <input type="file" id="profilePicture" name="profilePicture" accept=".jpg,.jpeg,.png,.gif">
            <small class="file-info">Max size: 5MB. Formats: JPG, PNG, GIF</small>
          </div>
        </div>
        
        <div class="form-group">
          <label for="name">Name:</label>
          <input type="text" id="name" name="name" value="<%= profile.name %>" 
                 class="md-input" maxlength="50" required>
          <div class="error-message" id="name-error"></div>
        </div>
        
        <div class="form-group">
          <label for="email">Email:</label>
          <input type="email" id="email" name="email" value="<%= profile.email %>" 
                 class="md-input" required>
          <div class="error-message" id="email-error"></div>
        </div>
        
        <div class="form-actions">
          <button type="submit" id="save-btn" class="md-button md-button-primary">Save</button>
          <button type="button" id="cancel-btn" class="md-button md-button-secondary">Cancel</button>
        </div>
      </form>
      
      <div id="success-message" class="success-message" style="display: none;">
        Profile updated successfully
      </div>
      
      <div id="error-messages" class="error-messages" style="display: none;">
      </div>
    </div>
  </div>
  
  <script src="/js/profile.js"></script>
</body>
</html>
`;

// Mock profile JavaScript for inline editing
const mockProfileScript = `
class ProfileEditor {
  constructor() {
    this.viewMode = document.getElementById('view-mode');
    this.editMode = document.getElementById('edit-mode');
    this.editBtn = document.getElementById('edit-btn');
    this.saveBtn = document.getElementById('save-btn');
    this.cancelBtn = document.getElementById('cancel-btn');
    this.form = document.getElementById('profile-form');
    this.nameInput = document.getElementById('name');
    this.emailInput = document.getElementById('email');
    this.fileInput = document.getElementById('profilePicture');
    
    this.originalData = {
      name: this.nameInput.value,
      email: this.emailInput.value
    };
    
    this.bindEvents();
  }
  
  bindEvents() {
    this.editBtn.addEventListener('click', () => this.enterEditMode());
    this.cancelBtn.addEventListener('click', () => this.exitEditMode());
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Real-time validation on blur
    this.nameInput.addEventListener('blur', () => this.validateName());
    this.emailInput.addEventListener('blur', () => this.validateEmail());
    this.fileInput.addEventListener('change', () => this.validateFile());
  }
  
  enterEditMode() {
    this.viewMode.style.display = 'none';
    this.editMode.style.display = 'block';
  }
  
  exitEditMode() {
    this.viewMode.style.display = 'block';
    this.editMode.style.display = 'none';
    
    // Reset form to original values
    this.nameInput.value = this.originalData.name;
    this.emailInput.value = this.originalData.email;
    this.fileInput.value = '';
    
    // Clear error messages
    this.clearErrors();
    this.hideMessages();
  }
  
  validateName() {
    const name = this.nameInput.value.trim();
    const nameError = document.getElementById('name-error');
    
    if (name.length < 2 || name.length > 50) {
      this.showFieldError('name', 'Name must be between 2 and 50 characters');
      return false;
    }
    
    if (!/^[a-zA-Z\\s]+$/.test(name)) {
      this.showFieldError('name', 'Name can only contain letters and spaces');
      return false;
    }
    
    this.clearFieldError('name');
    return true;
  }
  
  validateEmail() {
    const email = this.emailInput.value.trim();
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    
    if (!emailRegex.test(email)) {
      this.showFieldError('email', 'Please enter a valid email address');
      return false;
    }
    
    this.clearFieldError('email');
    return true;
  }
  
  validateFile() {
    const file = this.fileInput.files[0];
    
    if (!file) {
      return true;
    }
    
    // Check file size (5MB)
    if (file.size > 5242880) {
      alert('File size must be less than 5MB');
      this.fileInput.value = '';
      return false;
    }
    
    // Check file type
    const allowedTypes = /\\.(jpg|jpeg|png|gif)$/i;
    if (!allowedTypes.test(file.name)) {
      alert('Only JPG, PNG and GIF files are allowed');
      this.fileInput.value = '';
      return false;
    }
    
    return true;
  }
  
  showFieldError(fieldName, message) {
    const errorElement = document.getElementById(fieldName + '-error');
    const inputElement = document.getElementById(fieldName);
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    inputElement.classList.add('error');
  }
  
  clearFieldError(fieldName) {
    const errorElement = document.getElementById(fieldName + '-error');
    const inputElement = document.getElementById(fieldName);
    
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    inputElement.classList.remove('error');
  }
  
  clearErrors() {
    this.clearFieldError('name');
    this.clearFieldError('email');
  }
  
  showSuccess(message) {
    const successElement = document.getElementById('success-message');
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    // Auto-hide after 3 seconds and switch to view mode
    setTimeout(() => {
      successElement.style.display = 'none';
      this.exitEditMode();
    }, 3000);
  }
  
  showErrors(errors) {
    const errorContainer = document.getElementById('error-messages');
    errorContainer.innerHTML = errors.map(error => 
      \`<div class="error">${error}</div>\`
    ).join('');
    errorContainer.style.display = 'block';
  }
  
  hideMessages() {
    document.getElementById('success-message').style.display = 'none';
    document.getElementById('error-messages').style.display = 'none';
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    // Validate all fields
    const nameValid = this.validateName();
    const emailValid = this.validateEmail();
    const fileValid = this.validateFile();
    
    if (!nameValid || !emailValid || !fileValid) {
      return;
    }
    
    const formData = new FormData(this.form);
    
    try {
      const response = await fetch('/profile', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update original data
        this.originalData.name = formData.get('name');
        this.originalData.email = formData.get('email');
        
        // Update display values
        document.getElementById('display-name').textContent = data.user.name;
        document.getElementById('display-email').textContent = data.user.email;
        
        // Show success message
        this.showSuccess(data.message);
      } else {
        this.showErrors(data.errors);
      }
    } catch (error) {
      this.showErrors(['An error occurred while updating your profile']);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ProfileEditor();
});
`;

// Test data
const TEST_PROFILE = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2023-01-01T00:00:00.000Z',
  profile_picture: null
};

const TEST_PROFILE_WITH_PICTURE = {
  ...TEST_PROFILE,
  profile_picture: 'uploads/1-1640995200000.jpg'
};

describe('Profile UI Tests', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  
  beforeEach(() => {
    // Create DOM environment
    const html = ejs.render(mockProfileTemplate, { profile: TEST_PROFILE });
    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true
    });
    
    document = dom.window.document;
    window = dom.window as any;
    
    // Add profile script to DOM
    const script = document.createElement('script');
    script.textContent = mockProfileScript;
    document.head.appendChild(script);
    
    // Mock fetch for testing
    window.fetch = jest.fn();
  });
  
  afterEach(() => {
    dom.window.close();
  });
  
  describe('Profile View Mode', () => {
    // TC-F-001: User can view their current profile information in read-only format
    test('should display profile information in read-only format', () => {
      const nameDisplay = document.getElementById('display-name');
      const emailDisplay = document.getElementById('display-email');
      const viewMode = document.getElementById('view-mode');
      const editMode = document.getElementById('edit-mode');
      
      expect(nameDisplay?.textContent).toBe('Test User');
      expect(emailDisplay?.textContent).toBe('test@example.com');
      expect(viewMode?.style.display).not.toBe('none');
      expect(editMode?.style.display).toBe('none');
    });
    
    // TC-F-002: User can click an 'Edit Profile' button to switch to edit mode
    test('should have edit profile button that switches to edit mode', () => {
      const editBtn = document.getElementById('edit-btn') as HTMLButtonElement;
      const viewMode = document.getElementById('view-mode') as HTMLElement;
      const editMode = document.getElementById('edit-mode') as HTMLElement;
      
      expect(editBtn).toBeTruthy();
      expect(editBtn.textContent).toBe('Edit Profile');
      
      // Simulate click
      editBtn.click();
      
      expect(viewMode.style.display).toBe('none');
      expect(editMode.style.display).toBe('block');
    });
    
    test('should display profile picture when available', () => {
      const htmlWithPicture = ejs.render(mockProfileTemplate, { profile: TEST_PROFILE_WITH_PICTURE });
      const domWithPicture = new JSDOM(htmlWithPicture);
      const docWithPicture = domWithPicture.window.document;
      
      const profilePicture = docWithPicture.querySelector('.profile-picture') as HTMLImageElement;
      expect(profilePicture).toBeTruthy();
      expect(profilePicture.src).toContain('uploads/1-1640995200000.jpg');
      
      domWithPicture.window.close();
    });
    
    test('should display placeholder when no profile picture', () => {
      const placeholder = document.querySelector('.profile-picture-placeholder');
      expect(placeholder).toBeTruthy();
      expect(placeholder?.textContent).toBe('No Image');
    });
  });
  
  describe('Profile Edit Mode', () => {
    beforeEach(() => {
      // Switch to edit mode
      const editBtn = document.getElementById('edit-btn') as HTMLButtonElement;
      editBtn.click();
    });
    
    // TC-F-003: Name and email fields become editable with current values pre-populated
    test('should pre-populate form fields with current values', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      
      expect(nameInput.value).toBe('Test User');
      expect(emailInput.value).toBe('test@example.com');
    });
    
    // TC-F-004: Profile picture upload functionality is available in edit mode
    test('should have profile picture upload input', () => {
      const fileInput = document.getElementById('profilePicture') as HTMLInputElement;
      
      expect(fileInput).toBeTruthy();
      expect(fileInput.type).toBe('file');
      expect(fileInput.accept).toBe('.jpg,.jpeg,.png,.gif');
    });
    
    // TC-F-005: Save and Cancel buttons are visible and functional
    test('should have save and cancel buttons', () => {
      const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
      const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
      
      expect(saveBtn).toBeTruthy();
      expect(cancelBtn).toBeTruthy();
      expect(saveBtn.textContent).toBe('Save');
      expect(cancelBtn.textContent).toBe('Cancel');
    });
    
    // TC-F-007: Cancel discards unsaved changes and returns to read-only view
    test('should discard changes and return to view mode when cancel is clicked', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
      const viewMode = document.getElementById('view-mode') as HTMLElement;
      const editMode = document.getElementById('edit-mode') as HTMLElement;
      
      // Make changes
      nameInput.value = 'Changed Name';
      emailInput.value = 'changed@example.com';
      
      // Click cancel
      cancelBtn.click();
      
      // Check that changes are discarded
      expect(nameInput.value).toBe('Test User');
      expect(emailInput.value).toBe('test@example.com');
      expect(viewMode.style.display).toBe('block');
      expect(editMode.style.display).toBe('none');
    });
  });
  
  describe('Form Validation', () => {
    beforeEach(() => {
      // Switch to edit mode
      const editBtn = document.getElementById('edit-btn') as HTMLButtonElement;
      editBtn.click();
    });
    
    // TC-F-008: Name field validation with real-time feedback
    test('should validate name field on blur', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      // Test too short name
      nameInput.value = 'A';
      nameInput.dispatchEvent(new window.Event('blur'));
      
      expect(nameError.textContent).toBe('Name must be between 2 and 50 characters');
      expect(nameInput.classList.contains('error')).toBe(true);
      
      // Test invalid characters
      nameInput.value = 'Test123';
      nameInput.dispatchEvent(new window.Event('blur'));
      
      expect(nameError.textContent).toBe('Name can only contain letters and spaces');
      
      // Test valid name
      nameInput.value = 'Valid Name';
      nameInput.dispatchEvent(new window.Event('blur'));
      
      expect(nameError.textContent).toBe('');
      expect(nameInput.classList.contains('error')).toBe(false);
    });
    
    // TC-F-009: Email field validation with real-time feedback
    test('should validate email field on blur', () => {
      const emailInput = document.getElementById('email') as HTMLInputElement;
      const emailError = document.getElementById('email-error') as HTMLElement;
      
      // Test invalid email
      emailInput.value = 'invalid-email';
      emailInput.dispatchEvent(new window.Event('blur'));
      
      expect(emailError.textContent).toBe('Please enter a valid email address');
      expect(emailInput.classList.contains('error')).toBe(true);
      
      // Test valid email
      emailInput.value = 'valid@example.com';
      emailInput.dispatchEvent(new window.Event('blur'));
      
      expect(emailError.textContent).toBe('');
      expect(emailInput.classList.contains('error')).toBe(false);
    });
    
    // TC-F-010: Profile picture file type validation
    test('should validate file types and size', () => {
      const fileInput = document.getElementById('profilePicture') as HTMLInputElement;
      
      // Mock alert function
      window.alert = jest.fn();
      
      // Create mock file with invalid type
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false
      });
      
      fileInput.dispatchEvent(new window.Event('change'));
      
      expect(window.alert).toHaveBeenCalledWith('Only JPG, PNG and GIF files are allowed');
      expect(fileInput.value).toBe('');
      
      // Test file size validation
      const largeFile = new File([new ArrayBuffer(5242881)], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false
      });
      
      fileInput.dispatchEvent(new window.Event('change'));
      
      expect(window.alert).toHaveBeenCalledWith('File size must be less than 5MB');
    });
  });
  
  describe('Form Submission', () => {
    beforeEach(() => {
      // Switch to edit mode
      const editBtn = document.getElementById('edit-btn') as HTMLButtonElement;
      editBtn.click();
    });
    
    // TC-F-006: Save validates inputs and persists changes
    test('should submit form with valid data', async () => {
      const form = document.getElementById('profile-form') as HTMLFormElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      
      // Set up mock response
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          success: true,
          message: 'Profile updated successfully',
          user: { name: 'Updated Name', email: 'updated@example.com' }
        })
      };
      
      (window.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      // Update form values
      nameInput.value = 'Updated Name';
      emailInput.value = 'updated@example.com';
      
      // Submit form
      form.dispatchEvent(new window.Event('submit'));
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(window.fetch).toHaveBeenCalledWith('/profile', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      }));
    });
    
    test('should prevent submission with invalid data', () => {
      const form = document.getElementById('profile-form') as HTMLFormElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      
      // Set invalid name
      nameInput.value = 'A';
      
      // Mock preventDefault
      const submitEvent = new window.Event('submit');
      submitEvent.preventDefault = jest.fn();
      
      form.dispatchEvent(submitEvent);
      
      expect(window.fetch).not.toHaveBeenCalled();
    });
    
    // TC-F-014: Success confirmation message displayed
    test('should display success message and auto-switch to view mode', async () => {
      const form = document.getElementById('profile-form') as HTMLFormElement;
      const successMessage = document.getElementById('success-message') as HTMLElement;
      
      // Set up mock response
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          success: true,
          message: 'Profile updated successfully',
          user: { name: 'Updated Name', email: 'updated@example.com' }
        })
      };
      
      (window.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      // Submit form
      form.dispatchEvent(new window.Event('submit'));
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(successMessage.style.display).toBe('block');
      expect(successMessage.textContent).toBe('Profile updated successfully');
      
      // Test auto-hide after timeout (mocked)
      jest.useFakeTimers();
      jest.advanceTimersByTime(3000);
      
      expect(successMessage.style.display).toBe('none');
      
      jest.useRealTimers();
    });
    
    test('should display error messages on failure', async () => {
      const form = document.getElementById('profile-form') as HTMLFormElement;
      const errorContainer = document.getElementById('error-messages') as HTMLElement;
      
      // Set up mock error response
      const mockResponse = {
        json: jest.fn().mockResolvedValue({
          success: false,
          errors: ['Name is required', 'Email is invalid']
        })
      };
      
      (window.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      // Submit form
      form.dispatchEvent(new window.Event('submit'));
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(errorContainer.style.display).toBe('block');
      expect(errorContainer.innerHTML).toContain('Name is required');
      expect(errorContainer.innerHTML).toContain('Email is invalid');
    });
  });
});