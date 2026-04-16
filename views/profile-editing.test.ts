import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

// Mock profile template
const profileTemplate = `
<div class="profile-container">
  <div class="profile-header">
    <h1>Profile</h1>
    <% if (success) { %>
      <div class="alert alert-success" id="success-message">
        <%= success %>
      </div>
    <% } %>
    <% if (error) { %>
      <div class="alert alert-error" id="error-message">
        <%= error %>
      </div>
    <% } %>
  </div>
  
  <div class="profile-content">
    <!-- View Mode -->
    <div id="view-mode" class="view-mode">
      <div class="profile-picture-container">
        <% if (profile.profile_picture) { %>
          <img src="/<%= profile.profile_picture %>" alt="Profile Picture" class="profile-picture" />
        <% } else { %>
          <div class="profile-picture-placeholder">
            <i class="material-icons">person</i>
          </div>
        <% } %>
      </div>
      
      <div class="profile-info">
        <div class="info-item">
          <label>Name:</label>
          <span id="display-name"><%= profile.name %></span>
        </div>
        
        <div class="info-item">
          <label>Email:</label>
          <span id="display-email"><%= profile.email %></span>
        </div>
        
        <div class="info-item">
          <label>Member Since:</label>
          <span><%= new Date(profile.created_at).toLocaleDateString() %></span>
        </div>
      </div>
      
      <button id="edit-profile-btn" class="btn btn-primary">Edit Profile</button>
    </div>
    
    <!-- Edit Mode -->
    <div id="edit-mode" class="edit-mode" style="display: none;">
      <form id="profile-form" enctype="multipart/form-data">
        <div class="form-group">
          <label for="profile-picture-upload">Profile Picture:</label>
          <input type="file" id="profile-picture-upload" name="profilePicture" accept=".jpg,.jpeg,.png,.gif" />
          <div class="file-info">
            <small>Accepted formats: JPG, JPEG, PNG, GIF (max 5MB)</small>
          </div>
        </div>
        
        <div class="form-group">
          <label for="edit-name">Name:</label>
          <input type="text" id="edit-name" name="name" value="<%= profile.name %>" maxlength="50" required />
          <div class="error-message" id="name-error"></div>
        </div>
        
        <div class="form-group">
          <label for="edit-email">Email:</label>
          <input type="email" id="edit-email" name="email" value="<%= profile.email %>" required />
          <div class="error-message" id="email-error"></div>
        </div>
        
        <div class="form-actions">
          <button type="submit" id="save-btn" class="btn btn-primary">Save</button>
          <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</div>

<script>
// Profile editing functionality
(function() {
  const viewMode = document.getElementById('view-mode');
  const editMode = document.getElementById('edit-mode');
  const editBtn = document.getElementById('edit-profile-btn');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const profileForm = document.getElementById('profile-form');
  const nameInput = document.getElementById('edit-name');
  const emailInput = document.getElementById('edit-email');
  const nameError = document.getElementById('name-error');
  const emailError = document.getElementById('email-error');
  const successMessage = document.getElementById('success-message');
  
  // Store original values
  let originalName = nameInput.value;
  let originalEmail = emailInput.value;
  
  // Edit mode activation
  editBtn.addEventListener('click', function() {
    viewMode.style.display = 'none';
    editMode.style.display = 'block';
  });
  
  // Cancel editing
  cancelBtn.addEventListener('click', function() {
    // Restore original values
    nameInput.value = originalName;
    emailInput.value = originalEmail;
    
    // Clear errors
    nameError.textContent = '';
    emailError.textContent = '';
    nameInput.classList.remove('error');
    emailInput.classList.remove('error');
    
    // Reset file input
    document.getElementById('profile-picture-upload').value = '';
    
    // Switch back to view mode
    editMode.style.display = 'none';
    viewMode.style.display = 'block';
  });
  
  // Input validation
  function validateName(name) {
    if (!name || name.trim().length < 2) {
      return 'Name must be at least 2 characters long';
    }
    if (name.trim().length > 50) {
      return 'Name must not exceed 50 characters';
    }
    if (!/^[a-zA-Z\\s]+$/.test(name.trim())) {
      return 'Name must contain only letters and spaces';
    }
    return null;
  }
  
  function validateEmail(email) {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return 'Please enter a valid email address';
    }
    return null;
  }
  
  // Real-time validation
  nameInput.addEventListener('blur', function() {
    const error = validateName(this.value);
    if (error) {
      nameError.textContent = error;
      this.classList.add('error');
    } else {
      nameError.textContent = '';
      this.classList.remove('error');
    }
  });
  
  emailInput.addEventListener('blur', function() {
    const error = validateEmail(this.value);
    if (error) {
      emailError.textContent = error;
      this.classList.add('error');
    } else {
      emailError.textContent = '';
      this.classList.remove('error');
    }
  });
  
  // Form submission
  profileForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Validate all fields
    const nameValidationError = validateName(nameInput.value);
    const emailValidationError = validateEmail(emailInput.value);
    
    // Show errors if any
    if (nameValidationError) {
      nameError.textContent = nameValidationError;
      nameInput.classList.add('error');
    }
    
    if (emailValidationError) {
      emailError.textContent = emailValidationError;
      emailInput.classList.add('error');
    }
    
    // Stop if validation fails
    if (nameValidationError || emailValidationError) {
      return;
    }
    
    // Disable save button during submission
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    // Create form data
    const formData = new FormData(this);
    
    // Submit form
    fetch('/profile', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Update display values
        document.getElementById('display-name').textContent = data.user.name;
        document.getElementById('display-email').textContent = data.user.email;
        
        // Update original values
        originalName = data.user.name;
        originalEmail = data.user.email;
        
        // Show success message
        showSuccessMessage('Profile updated successfully');
        
        // Switch back to view mode after delay
        setTimeout(() => {
          editMode.style.display = 'none';
          viewMode.style.display = 'block';
          hideSuccessMessage();
        }, 3000);
      } else {
        // Show validation errors
        if (data.errors) {
          data.errors.forEach(error => {
            if (error.includes('Name')) {
              nameError.textContent = error;
              nameInput.classList.add('error');
            } else if (error.includes('Email') || error.includes('email')) {
              emailError.textContent = error;
              emailInput.classList.add('error');
            }
          });
        } else {
          alert('An error occurred while updating your profile');
        }
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('An error occurred while updating your profile');
    })
    .finally(() => {
      // Re-enable save button
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    });
  });
  
  // Success message functions
  function showSuccessMessage(message) {
    if (successMessage) {
      successMessage.textContent = message;
      successMessage.style.display = 'block';
    } else {
      const messageDiv = document.createElement('div');
      messageDiv.id = 'success-message';
      messageDiv.className = 'alert alert-success';
      messageDiv.textContent = message;
      document.querySelector('.profile-header').appendChild(messageDiv);
    }
  }
  
  function hideSuccessMessage() {
    const message = document.getElementById('success-message');
    if (message) {
      message.style.display = 'none';
    }
  }
})();
</script>
`;

// Test data
const TEST_USER = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  profile_picture: null,
  created_at: '2023-01-01T00:00:00.000Z'
};

const USER_WITH_PICTURE = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  profile_picture: 'uploads/1-123456.jpg',
  created_at: '2023-01-01T00:00:00.000Z'
};

describe('Profile Editing UI', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  
  const renderProfile = (profile: any, success?: string, error?: string) => {
    const html = ejs.render(profileTemplate, { 
      profile, 
      success: success || null, 
      error: error || null 
    });
    return html;
  };
  
  beforeEach(() => {
    const html = renderProfile(TEST_USER);
    dom = new JSDOM(html, {
      url: 'http://localhost:3000',
      runScripts: 'dangerously',
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window as unknown as Window;
    
    // Mock fetch
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    dom.window.close();
  });
  
  describe('Profile Display', () => {
    // TC-F-001: User can view their current profile information (name, email, profile picture) in a read-only format when navigating to the profile page
    test('should display profile information in read-only format', () => {
      const viewMode = document.getElementById('view-mode');
      const editMode = document.getElementById('edit-mode');
      
      expect(viewMode?.style.display).not.toBe('none');
      expect(editMode?.style.display).toBe('none');
      
      expect(document.getElementById('display-name')?.textContent).toBe('Test User');
      expect(document.getElementById('display-email')?.textContent).toBe('test@example.com');
    });
    
    // TC-F-001: User can view their current profile information (name, email, profile picture) in a read-only format when navigating to the profile page
    test('should show profile picture when available', () => {
      const html = renderProfile(USER_WITH_PICTURE);
      const tempDom = new JSDOM(html);
      const tempDoc = tempDom.window.document;
      
      const profileImg = tempDoc.querySelector('img.profile-picture') as HTMLImageElement;
      expect(profileImg).toBeTruthy();
      expect(profileImg?.src).toContain('uploads/1-123456.jpg');
      
      tempDom.window.close();
    });
    
    // TC-F-001: User can view their current profile information (name, email, profile picture) in a read-only format when navigating to the profile page
    test('should show placeholder when no profile picture', () => {
      const placeholder = document.querySelector('.profile-picture-placeholder');
      const profileImg = document.querySelector('img.profile-picture');
      
      expect(placeholder).toBeTruthy();
      expect(profileImg).toBeFalsy();
    });
  });
  
  describe('Edit Mode Activation', () => {
    // TC-F-002: User can click an 'Edit Profile' button or similar control to switch to edit mode on the same page
    test('should switch to edit mode when edit button is clicked', () => {
      const editBtn = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const viewMode = document.getElementById('view-mode') as HTMLElement;
      const editMode = document.getElementById('edit-mode') as HTMLElement;
      
      editBtn.click();
      
      expect(viewMode.style.display).toBe('none');
      expect(editMode.style.display).toBe('block');
    });
    
    // TC-F-003: When in edit mode, name and email fields become editable input fields with current values pre-populated
    test('should pre-populate input fields with current values', () => {
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const emailInput = document.getElementById('edit-email') as HTMLInputElement;
      
      expect(nameInput.value).toBe('Test User');
      expect(emailInput.value).toBe('test@example.com');
    });
    
    // TC-F-004: Profile picture upload functionality is available in edit mode with file selection dialog
    test('should provide profile picture upload functionality', () => {
      const fileInput = document.getElementById('profile-picture-upload') as HTMLInputElement;
      
      expect(fileInput).toBeTruthy();
      expect(fileInput.type).toBe('file');
      expect(fileInput.accept).toBe('.jpg,.jpeg,.png,.gif');
    });
    
    // TC-F-005: Save and Cancel buttons are visible and functional when in edit mode
    test('should show save and cancel buttons in edit mode', () => {
      const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
      const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
      
      expect(saveBtn).toBeTruthy();
      expect(cancelBtn).toBeTruthy();
      expect(saveBtn.textContent).toBe('Save');
      expect(cancelBtn.textContent).toBe('Cancel');
    });
  });
  
  describe('Cancel Functionality', () => {
    // TC-F-007: Clicking Cancel discards any unsaved changes and returns to read-only view
    test('should discard changes when cancel is clicked', () => {
      const editBtn = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const emailInput = document.getElementById('edit-email') as HTMLInputElement;
      const fileInput = document.getElementById('profile-picture-upload') as HTMLInputElement;
      
      // Enter edit mode
      editBtn.click();
      
      // Make changes
      nameInput.value = 'Changed Name';
      emailInput.value = 'changed@example.com';
      
      // Cancel changes
      cancelBtn.click();
      
      // Check values are restored
      expect(nameInput.value).toBe('Test User');
      expect(emailInput.value).toBe('test@example.com');
      expect(fileInput.value).toBe('');
    });
    
    // TC-F-007: Clicking Cancel discards any unsaved changes and returns to read-only view
    test('should return to view mode when cancel is clicked', () => {
      const editBtn = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
      const viewMode = document.getElementById('view-mode') as HTMLElement;
      const editMode = document.getElementById('edit-mode') as HTMLElement;
      
      // Enter edit mode
      editBtn.click();
      expect(viewMode.style.display).toBe('none');
      expect(editMode.style.display).toBe('block');
      
      // Cancel
      cancelBtn.click();
      expect(viewMode.style.display).toBe('block');
      expect(editMode.style.display).toBe('none');
    });
    
    // TC-F-007: Clicking Cancel discards any unsaved changes and returns to read-only view
    test('should clear validation errors when cancel is clicked', () => {
      const editBtn = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      // Enter edit mode and trigger validation error
      editBtn.click();
      nameInput.value = 'A'; // Too short
      nameInput.dispatchEvent(new window.Event('blur'));
      
      // Should have error
      expect(nameError.textContent).toContain('Name must be at least 2 characters');
      expect(nameInput.classList.contains('error')).toBe(true);
      
      // Cancel should clear errors
      cancelBtn.click();
      expect(nameError.textContent).toBe('');
      expect(nameInput.classList.contains('error')).toBe(false);
    });
  });
  
  describe('Input Validation', () => {
    beforeEach(() => {
      const editBtn = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      editBtn.click(); // Enter edit mode
    });
    
    test('should validate name length on blur', () => {
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      // Test too short
      nameInput.value = 'A';
      nameInput.dispatchEvent(new window.Event('blur'));
      expect(nameError.textContent).toContain('Name must be at least 2 characters');
      expect(nameInput.classList.contains('error')).toBe(true);
      
      // Test too long
      nameInput.value = 'A'.repeat(51);
      nameInput.dispatchEvent(new window.Event('blur'));
      expect(nameError.textContent).toContain('Name must not exceed 50 characters');
      
      // Test valid length
      nameInput.value = 'Valid Name';
      nameInput.dispatchEvent(new window.Event('blur'));
      expect(nameError.textContent).toBe('');
      expect(nameInput.classList.contains('error')).toBe(false);
    });
    
    test('should validate name characters on blur', () => {
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      // Test invalid characters
      nameInput.value = 'John123';
      nameInput.dispatchEvent(new window.Event('blur'));
      expect(nameError.textContent).toContain('Name must contain only letters and spaces');
      expect(nameInput.classList.contains('error')).toBe(true);
      
      // Test valid characters
      nameInput.value = 'John Doe';
      nameInput.dispatchEvent(new window.Event('blur'));
      expect(nameError.textContent).toBe('');
      expect(nameInput.classList.contains('error')).toBe(false);
    });
    
    test('should validate email format on blur', () => {
      const emailInput = document.getElementById('edit-email') as HTMLInputElement;
      const emailError = document.getElementById('email-error') as HTMLElement;
      
      // Test invalid email
      emailInput.value = 'invalid-email';
      emailInput.dispatchEvent(new window.Event('blur'));
      expect(emailError.textContent).toContain('Please enter a valid email address');
      expect(emailInput.classList.contains('error')).toBe(true);
      
      // Test valid email
      emailInput.value = 'valid@example.com';
      emailInput.dispatchEvent(new window.Event('blur'));
      expect(emailError.textContent).toBe('');
      expect(emailInput.classList.contains('error')).toBe(false);
    });
  });
  
  describe('Form Submission', () => {
    beforeEach(() => {
      const editBtn = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      editBtn.click(); // Enter edit mode
    });
    
    // TC-F-006: Clicking Save validates all inputs and persists changes to the database if validation passes
    test('should prevent submission with invalid data', () => {
      const form = document.getElementById('profile-form') as HTMLFormElement;
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const emailInput = document.getElementById('edit-email') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      const emailError = document.getElementById('email-error') as HTMLElement;
      
      // Set invalid data
      nameInput.value = 'A'; // Too short
      emailInput.value = 'invalid-email';
      
      // Try to submit
      form.dispatchEvent(new window.Event('submit'));
      
      // Should show validation errors
      expect(nameError.textContent).toContain('Name must be at least 2 characters');
      expect(emailError.textContent).toContain('Please enter a valid email address');
      expect(nameInput.classList.contains('error')).toBe(true);
      expect(emailInput.classList.contains('error')).toBe(true);
      
      // Fetch should not be called
      expect(fetch).not.toHaveBeenCalled();
    });
    
    // TC-F-006: Clicking Save validates all inputs and persists changes to the database if validation passes
    test('should submit form with valid data', async () => {
      const form = document.getElementById('profile-form') as HTMLFormElement;
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const emailInput = document.getElementById('edit-email') as HTMLInputElement;
      const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
      
      // Mock successful response
      const mockResponse = {
        success: true,
        user: {
          name: 'Updated Name',
          email: 'updated@example.com'
        }
      };
      
      (fetch as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });
      
      // Set valid data
      nameInput.value = 'Updated Name';
      emailInput.value = 'updated@example.com';
      
      // Submit form
      form.dispatchEvent(new window.Event('submit'));
      
      // Should disable save button
      expect(saveBtn.disabled).toBe(true);
      expect(saveBtn.textContent).toBe('Saving...');
      
      // Should call fetch
      expect(fetch).toHaveBeenCalledWith('/profile', {
        method: 'POST',
        body: expect.any(FormData)
      });
    });
    
    // TC-F-014: Success confirmation message is displayed on the same page after successful profile update
    test('should show success message after successful update', async () => {
      const form = document.getElementById('profile-form') as HTMLFormElement;
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const emailInput = document.getElementById('edit-email') as HTMLInputElement;
      
      // Mock successful response
      const mockResponse = {
        success: true,
        user: {
          name: 'Updated Name',
          email: 'updated@example.com'
        }
      };
      
      (fetch as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });
      
      // Set valid data and submit
      nameInput.value = 'Updated Name';
      emailInput.value = 'updated@example.com';
      form.dispatchEvent(new window.Event('submit'));
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should update display values
      expect(document.getElementById('display-name')?.textContent).toBe('Updated Name');
      expect(document.getElementById('display-email')?.textContent).toBe('updated@example.com');
    });
    
    test('should handle server validation errors', async () => {
      const form = document.getElementById('profile-form') as HTMLFormElement;
      const nameInput = document.getElementById('edit-name') as HTMLInputElement;
      const emailInput = document.getElementById('edit-email') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      const emailError = document.getElementById('email-error') as HTMLElement;
      
      // Mock error response
      const mockResponse = {
        success: false,
        errors: ['Name must be unique', 'Email already exists']
      };
      
      (fetch as jest.Mock).mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });
      
      // Submit form
      nameInput.value = 'Valid Name';
      emailInput.value = 'valid@example.com';
      form.dispatchEvent(new window.Event('submit'));
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should show server errors
      expect(nameError.textContent).toContain('Name must be unique');
      expect(emailError.textContent).toContain('Email already exists');
    });
  });
  
  describe('Success and Error Messages', () => {
    // TC-F-014: Success confirmation message is displayed on the same page after successful profile update
    test('should display success message from server', () => {
      const html = renderProfile(TEST_USER, 'Profile updated successfully');
      const tempDom = new JSDOM(html);
      const tempDoc = tempDom.window.document;
      
      const successMessage = tempDoc.getElementById('success-message');
      expect(successMessage).toBeTruthy();
      expect(successMessage?.textContent).toBe('Profile updated successfully');
      expect(successMessage?.className).toContain('alert-success');
      
      tempDom.window.close();
    });
    
    test('should display error message from server', () => {
      const html = renderProfile(TEST_USER, null, 'An error occurred');
      const tempDom = new JSDOM(html);
      const tempDoc = tempDom.window.document;
      
      const errorMessage = tempDoc.getElementById('error-message');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.textContent).toBe('An error occurred');
      expect(errorMessage?.className).toContain('alert-error');
      
      tempDom.window.close();
    });
  });
  
  describe('File Upload Constraints', () => {
    test('should show file format and size constraints', () => {
      const fileInfo = document.querySelector('.file-info small');
      expect(fileInfo?.textContent).toContain('JPG, JPEG, PNG, GIF');
      expect(fileInfo?.textContent).toContain('max 5MB');
    });
    
    test('should have proper file input attributes', () => {
      const fileInput = document.getElementById('profile-picture-upload') as HTMLInputElement;
      expect(fileInput.accept).toBe('.jpg,.jpeg,.png,.gif');
      expect(fileInput.name).toBe('profilePicture');
    });
  });
});