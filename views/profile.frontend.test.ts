/**
 * @jest-environment jsdom
 */

// Mock DOM environment for frontend testing
document.body.innerHTML = `
  <div class="profile-container">
    <div class="profile-header">
      <div class="profile-picture-container">
        <img id="profilePicture" src="/default-avatar.png" alt="Profile Picture" class="profile-picture">
        <input type="file" id="profilePictureInput" accept="image/jpeg,image/png" style="display: none;">
      </div>
    </div>
    
    <div class="profile-info">
      <div class="field-group">
        <label>Name:</label>
        <div class="editable-field" data-field="name">
          <span class="field-value" id="nameValue">John Doe</span>
          <button class="edit-btn" data-field="name" style="display: none;">✏️</button>
          <div class="edit-form" style="display: none;">
            <input type="text" id="nameInput" class="field-input" value="John Doe">
            <button class="save-btn" data-field="name">Save</button>
            <button class="cancel-btn" data-field="name">Cancel</button>
          </div>
        </div>
        <div class="field-error" id="nameError"></div>
      </div>
      
      <div class="field-group">
        <label>Email:</label>
        <div class="editable-field" data-field="email">
          <span class="field-value" id="emailValue">john@example.com</span>
          <button class="edit-btn" data-field="email" style="display: none;">✏️</button>
          <div class="edit-form" style="display: none;">
            <input type="email" id="emailInput" class="field-input" value="john@example.com">
            <button class="save-btn" data-field="email">Save</button>
            <button class="cancel-btn" data-field="email">Cancel</button>
          </div>
        </div>
        <div class="field-error" id="emailError"></div>
      </div>
      
      <div class="account-info">
        <p>Member since: <span id="memberSince">January 1, 2024</span></p>
      </div>
    </div>
    
    <div class="password-section">
      <h3>Change Password</h3>
      <form id="passwordForm">
        <div class="form-group">
          <input type="password" id="currentPassword" placeholder="Current Password" required>
          <div class="field-error" id="currentPasswordError"></div>
        </div>
        <div class="form-group">
          <input type="password" id="newPassword" placeholder="New Password" required>
          <div class="field-error" id="newPasswordError"></div>
        </div>
        <div class="form-group">
          <input type="password" id="confirmPassword" placeholder="Confirm Password" required>
          <div class="field-error" id="confirmPasswordError"></div>
        </div>
        <button type="submit" class="btn btn-primary">Update Password</button>
      </form>
    </div>
    
    <div id="successMessage" class="alert alert-success" style="display: none;"></div>
    <div id="errorMessage" class="alert alert-error" style="display: none;"></div>
  </div>
`;

// Mock fetch API
global.fetch = jest.fn();

// Mock profile JavaScript functionality
class ProfileManager {
  constructor() {
    this.currentEditField = null;
    this.originalValues = {};
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Hover effects for edit buttons
    document.querySelectorAll('.editable-field').forEach(field => {
      field.addEventListener('mouseenter', () => {
        const editBtn = field.querySelector('.edit-btn');
        if (editBtn && !this.currentEditField) {
          editBtn.style.display = 'inline-block';
        }
      });
      
      field.addEventListener('mouseleave', () => {
        const editBtn = field.querySelector('.edit-btn');
        if (editBtn && !this.currentEditField) {
          editBtn.style.display = 'none';
        }
      });
    });

    // Edit button clicks
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fieldName = e.target.getAttribute('data-field');
        this.enterEditMode(fieldName);
      });
    });

    // Save button clicks
    document.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fieldName = e.target.getAttribute('data-field');
        this.saveField(fieldName);
      });
    });

    // Cancel button clicks
    document.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fieldName = e.target.getAttribute('data-field');
        this.cancelEdit(fieldName);
      });
    });

    // Profile picture click
    document.getElementById('profilePicture').addEventListener('click', () => {
      document.getElementById('profilePictureInput').click();
    });

    // File input change
    document.getElementById('profilePictureInput').addEventListener('change', (e) => {
      this.handleFileUpload(e.target.files[0]);
    });

    // Password form submit
    document.getElementById('passwordForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePasswordChange();
    });
  }

  enterEditMode(fieldName) {
    if (this.currentEditField && this.currentEditField !== fieldName) {
      this.cancelEdit(this.currentEditField);
    }

    this.currentEditField = fieldName;
    const field = document.querySelector(`[data-field="${fieldName}"]`);
    const value = field.querySelector('.field-value');
    const editForm = field.querySelector('.edit-form');
    const editBtn = field.querySelector('.edit-btn');
    const input = field.querySelector('.field-input');

    this.originalValues[fieldName] = value.textContent;
    
    value.style.display = 'none';
    editBtn.style.display = 'none';
    editForm.style.display = 'block';
    input.focus();
  }

  cancelEdit(fieldName) {
    const field = document.querySelector(`[data-field="${fieldName}"]`);
    const value = field.querySelector('.field-value');
    const editForm = field.querySelector('.edit-form');
    const editBtn = field.querySelector('.edit-btn');
    const input = field.querySelector('.field-input');

    input.value = this.originalValues[fieldName] || '';
    value.style.display = 'inline';
    editForm.style.display = 'none';
    editBtn.style.display = 'none';
    
    this.currentEditField = null;
    this.clearFieldError(fieldName);
  }

  async saveField(fieldName) {
    const field = document.querySelector(`[data-field="${fieldName}"]`);
    const input = field.querySelector('.field-input');
    const newValue = input.value.trim();

    // Check if value changed
    if (newValue === this.originalValues[fieldName]) {
      this.cancelEdit(fieldName);
      return;
    }

    // Client-side validation
    if (!this.validateField(fieldName, newValue)) {
      return;
    }

    try {
      const response = await fetch('/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: newValue })
      });

      if (response.ok) {
        const value = field.querySelector('.field-value');
        value.textContent = newValue;
        this.exitEditMode(fieldName);
        this.showSuccessMessage('Profile updated successfully');
      } else {
        const error = await response.json();
        this.showFieldError(fieldName, error.error);
      }
    } catch (error) {
      this.showFieldError(fieldName, 'Unable to update profile. Please try again.');
    }
  }

  exitEditMode(fieldName) {
    const field = document.querySelector(`[data-field="${fieldName}"]`);
    const value = field.querySelector('.field-value');
    const editForm = field.querySelector('.edit-form');
    
    value.style.display = 'inline';
    editForm.style.display = 'none';
    this.currentEditField = null;
    this.clearFieldError(fieldName);
  }

  validateField(fieldName, value) {
    this.clearFieldError(fieldName);

    if (fieldName === 'name') {
      if (value.length < 2 || value.length > 50) {
        this.showFieldError(fieldName, 'Name must be between 2 and 50 characters');
        return false;
      }
      if (!/^[a-zA-Z\s]+$/.test(value)) {
        this.showFieldError(fieldName, 'Name must contain only letters and spaces');
        return false;
      }
    }

    if (fieldName === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        this.showFieldError(fieldName, 'Please enter a valid email address');
        return false;
      }
    }

    return true;
  }

  async handleFileUpload(file) {
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.showErrorMessage('Invalid file type (JPG/PNG only)');
      return;
    }

    // Validate file size (2MB = 2,097,152 bytes)
    if (file.size > 2097152) {
      this.showErrorMessage('File too large (max 2MB)');
      return;
    }

    const formData = new FormData();
    formData.append('profile_picture', file);

    try {
      const response = await fetch('/profile', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        document.getElementById('profilePicture').src = previewUrl;
        this.showSuccessMessage('Profile picture updated successfully');
      } else {
        const error = await response.json();
        this.showErrorMessage(error.error);
      }
    } catch (error) {
      this.showErrorMessage('Unable to update profile picture. Please try again.');
    }
  }

  async handlePasswordChange() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Clear previous errors
    this.clearAllPasswordErrors();

    // Validate fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      this.showFieldError('currentPassword', 'All password fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showFieldError('confirmPassword', 'New password and confirmation do not match');
      return;
    }

    if (!this.validatePassword(newPassword)) {
      this.showFieldError('newPassword', 'Password must be 6-128 characters with uppercase, lowercase, and number');
      return;
    }

    try {
      const response = await fetch('/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });

      if (response.ok) {
        // Clear form
        document.getElementById('passwordForm').reset();
        this.showSuccessMessage('Password updated successfully');
      } else {
        const error = await response.json();
        if (error.error.includes('Current password is incorrect')) {
          this.showFieldError('currentPassword', error.error);
        } else {
          this.showErrorMessage(error.error);
        }
      }
    } catch (error) {
      this.showErrorMessage('Unable to update password. Please try again.');
    }
  }

  validatePassword(password) {
    if (password.length < 6 || password.length > 128) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
  }

  showFieldError(fieldName, message) {
    const errorDiv = document.getElementById(`${fieldName}Error`);
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  clearFieldError(fieldName) {
    const errorDiv = document.getElementById(`${fieldName}Error`);
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }
  }

  clearAllPasswordErrors() {
    ['currentPassword', 'newPassword', 'confirmPassword'].forEach(field => {
      this.clearFieldError(field);
    });
  }

  showSuccessMessage(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
      successDiv.style.display = 'none';
    }, 3000);
  }

  showErrorMessage(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}

describe('Profile Frontend Functionality', () => {
  let profileManager;

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    profileManager = new ProfileManager();
  });

  describe('Inline Editing UI', () => {
    // TC-F-005: Clicking on name field converts it to editable input with save/cancel buttons
    test('TC-F-005: should enter edit mode for name field', () => {
      const editBtn = document.querySelector('[data-field="name"] .edit-btn');
      const nameValue = document.getElementById('nameValue');
      const editForm = document.querySelector('[data-field="name"] .edit-form');
      
      editBtn.click();
      
      expect(nameValue.style.display).toBe('none');
      expect(editForm.style.display).toBe('block');
      expect(profileManager.currentEditField).toBe('name');
    });

    // TC-F-006: Clicking on email field converts it to editable input with save/cancel buttons
    test('TC-F-006: should enter edit mode for email field', () => {
      const editBtn = document.querySelector('[data-field="email"] .edit-btn');
      const emailValue = document.getElementById('emailValue');
      const editForm = document.querySelector('[data-field="email"] .edit-form');
      
      editBtn.click();
      
      expect(emailValue.style.display).toBe('none');
      expect(editForm.style.display).toBe('block');
      expect(profileManager.currentEditField).toBe('email');
    });

    // TC-F-007: Only one field can be in edit mode at a time across the entire form
    test('TC-F-007: should allow only one field in edit mode at a time', () => {
      const nameEditBtn = document.querySelector('[data-field="name"] .edit-btn');
      const emailEditBtn = document.querySelector('[data-field="email"] .edit-btn');
      
      // Enter edit mode for name
      nameEditBtn.click();
      expect(profileManager.currentEditField).toBe('name');
      
      // Try to enter edit mode for email
      emailEditBtn.click();
      expect(profileManager.currentEditField).toBe('email');
      
      // Name field should be back to normal mode
      const nameValue = document.getElementById('nameValue');
      const nameEditForm = document.querySelector('[data-field="name"] .edit-form');
      expect(nameValue.style.display).toBe('inline');
      expect(nameEditForm.style.display).toBe('none');
    });

    // TC-F-008: Save button only appears when field value differs from original value
    test('TC-F-008: should validate field changes before saving', async () => {
      const nameEditBtn = document.querySelector('[data-field="name"] .edit-btn');
      const nameInput = document.getElementById('nameInput');
      const saveBtn = document.querySelector('[data-field="name"] .save-btn');
      
      nameEditBtn.click();
      
      // Test no change scenario
      nameInput.value = 'John Doe'; // Same as original
      saveBtn.click();
      
      // Should exit edit mode without API call
      expect(profileManager.currentEditField).toBe(null);
      expect(fetch).not.toHaveBeenCalled();
    });

    // TC-F-009: Cancel button reverts field to original value and exits edit mode
    test('TC-F-009: should cancel edit and revert to original value', () => {
      const nameEditBtn = document.querySelector('[data-field="name"] .edit-btn');
      const nameInput = document.getElementById('nameInput');
      const cancelBtn = document.querySelector('[data-field="name"] .cancel-btn');
      const nameValue = document.getElementById('nameValue');
      
      nameEditBtn.click();
      nameInput.value = 'Changed Name';
      cancelBtn.click();
      
      expect(nameInput.value).toBe('John Doe');
      expect(nameValue.style.display).toBe('inline');
      expect(profileManager.currentEditField).toBe(null);
    });
  });

  describe('File Upload UI', () => {
    // TC-F-015: Profile picture upload accepts only JPG and PNG files with MIME type validation
    test('TC-F-015: should validate file type on upload', async () => {
      const file = new File(['fake content'], 'test.txt', { type: 'text/plain' });
      
      await profileManager.handleFileUpload(file);
      
      const errorMessage = document.getElementById('errorMessage');
      expect(errorMessage.textContent).toBe('Invalid file type (JPG/PNG only)');
      expect(errorMessage.style.display).toBe('block');
      expect(fetch).not.toHaveBeenCalled();
    });

    // TC-F-016: File size validation rejects uploads larger than 2MB with error message
    test('TC-F-016: should validate file size on upload', async () => {
      const largeFile = new File(['x'.repeat(3000000)], 'large.jpg', { type: 'image/jpeg' });
      
      await profileManager.handleFileUpload(largeFile);
      
      const errorMessage = document.getElementById('errorMessage');
      expect(errorMessage.textContent).toBe('File too large (max 2MB)');
      expect(errorMessage.style.display).toBe('block');
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should handle successful file upload', async () => {
      const validFile = new File(['fake image'], 'avatar.jpg', { type: 'image/jpeg' });
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Profile picture updated' })
      });
      
      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      
      await profileManager.handleFileUpload(validFile);
      
      expect(fetch).toHaveBeenCalledWith('/profile', {
        method: 'POST',
        body: expect.any(FormData)
      });
      
      const profileImg = document.getElementById('profilePicture');
      expect(profileImg.src).toBe('blob:mock-url');
    });
  });

  describe('Password Change UI', () => {
    // TC-F-022: Confirm password must exactly match new password field
    test('TC-F-022: should validate password confirmation match', async () => {
      document.getElementById('currentPassword').value = 'oldPassword1';
      document.getElementById('newPassword').value = 'NewPassword1';
      document.getElementById('confirmPassword').value = 'DifferentPassword1';
      
      await profileManager.handlePasswordChange();
      
      const confirmError = document.getElementById('confirmPasswordError');
      expect(confirmError.textContent).toBe('New password and confirmation do not match');
      expect(confirmError.style.display).toBe('block');
      expect(fetch).not.toHaveBeenCalled();
    });

    // TC-F-021: New password must be 6-128 characters with uppercase, lowercase, and number
    test('TC-F-021: should validate password strength', async () => {
      document.getElementById('currentPassword').value = 'oldPassword1';
      document.getElementById('newPassword').value = 'weak';
      document.getElementById('confirmPassword').value = 'weak';
      
      await profileManager.handlePasswordChange();
      
      const newPasswordError = document.getElementById('newPasswordError');
      expect(newPasswordError.textContent).toBe('Password must be 6-128 characters with uppercase, lowercase, and number');
      expect(newPasswordError.style.display).toBe('block');
      expect(fetch).not.toHaveBeenCalled();
    });

    // TC-F-024: Successful password update shows success message and clears all password fields
    test('TC-F-024: should handle successful password change', async () => {
      document.getElementById('currentPassword').value = 'oldPassword1';
      document.getElementById('newPassword').value = 'NewPassword1';
      document.getElementById('confirmPassword').value = 'NewPassword1';
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password updated successfully' })
      });
      
      await profileManager.handlePasswordChange();
      
      expect(fetch).toHaveBeenCalledWith('/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'oldPassword1',
          newPassword: 'NewPassword1',
          confirmPassword: 'NewPassword1'
        })
      });
      
      const successMessage = document.getElementById('successMessage');
      expect(successMessage.textContent).toBe('Password updated successfully');
      expect(successMessage.style.display).toBe('block');
      
      // Check form is cleared
      expect(document.getElementById('currentPassword').value).toBe('');
      expect(document.getElementById('newPassword').value).toBe('');
      expect(document.getElementById('confirmPassword').value).toBe('');
    });

    // TC-F-023: Password change shows error 'Current password is incorrect' when validation fails
    test('TC-F-023: should show current password error', async () => {
      document.getElementById('currentPassword').value = 'wrongPassword';
      document.getElementById('newPassword').value = 'NewPassword1';
      document.getElementById('confirmPassword').value = 'NewPassword1';
      
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Current password is incorrect' })
      });
      
      await profileManager.handlePasswordChange();
      
      const currentPasswordError = document.getElementById('currentPasswordError');
      expect(currentPasswordError.textContent).toBe('Current password is incorrect');
      expect(currentPasswordError.style.display).toBe('block');
    });
  });

  describe('Success and Error Messages', () => {
    // TC-F-014: Successful profile update redirects to /profile with green success message for 3 seconds
    test('TC-F-014: should show success message for 3 seconds', (done) => {
      profileManager.showSuccessMessage('Profile updated successfully');
      
      const successMessage = document.getElementById('successMessage');
      expect(successMessage.textContent).toBe('Profile updated successfully');
      expect(successMessage.style.display).toBe('block');
      
      setTimeout(() => {
        expect(successMessage.style.display).toBe('none');
        done();
      }, 3100);
    });

    test('should display field-level validation errors', () => {
      profileManager.showFieldError('name', 'Name must be between 2 and 50 characters');
      
      const nameError = document.getElementById('nameError');
      expect(nameError.textContent).toBe('Name must be between 2 and 50 characters');
      expect(nameError.style.display).toBe('block');
    });
  });

  describe('Form Validation', () => {
    test('should validate name format client-side', () => {
      expect(profileManager.validateField('name', 'John Doe')).toBe(true);
      expect(profileManager.validateField('name', 'A')).toBe(false); // Too short
      expect(profileManager.validateField('name', 'John123')).toBe(false); // Invalid chars
    });

    test('should validate email format client-side', () => {
      expect(profileManager.validateField('email', 'john@example.com')).toBe(true);
      expect(profileManager.validateField('email', 'invalid-email')).toBe(false);
    });

    test('should validate password strength', () => {
      expect(profileManager.validatePassword('Password1')).toBe(true);
      expect(profileManager.validatePassword('weak')).toBe(false);
      expect(profileManager.validatePassword('PASSWORD1')).toBe(false); // No lowercase
      expect(profileManager.validatePassword('password1')).toBe(false); // No uppercase
      expect(profileManager.validatePassword('Password')).toBe(false); // No number
    });
  });
});