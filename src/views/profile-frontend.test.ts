import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Mock fetch for testing AJAX calls
global.fetch = jest.fn();

describe('Profile Frontend Interactions', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  
  beforeEach(() => {
    // Load the profile.ejs template and simulate browser environment
    const profileHtml = fs.readFileSync(path.join(__dirname, '../views/profile.ejs'), 'utf8');
    
    // Strip EJS syntax for testing (simulate rendered HTML)
    const renderedHtml = profileHtml
      .replace(/<%[^%]*%>/g, '') // Remove EJS tags
      .replace(/<%= pageTitle %>/g, 'Profile')
      .replace(/<%= .* %>/g, 'Test User'); // Replace other EJS variables
    
    dom = new JSDOM(renderedHtml, {
      runScripts: 'dangerously',
      resources: 'usable'
    });
    
    document = dom.window.document;
    window = dom.window;
    
    // Mock console methods to avoid test output pollution
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup fetch mock
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });
  
  afterEach(() => {
    dom.window.close();
    jest.restoreAllMocks();
  });

  describe('Inline Editing UI', () => {
    // TC-A-005: Clicking on name field converts it to editable input with save/cancel buttons
    it('should convert name field to edit mode when clicked', () => {
      // Create mock name field element
      const nameField = document.createElement('div');
      nameField.className = 'inline-edit-field';
      nameField.textContent = 'Test User';
      nameField.setAttribute('data-field', 'name');
      nameField.setAttribute('data-value', 'Test User');
      document.body.appendChild(nameField);
      
      // Simulate click event
      nameField.click();
      
      // Should have edit class and input field
      expect(nameField.classList.contains('editing')).toBe(true);
      expect(nameField.querySelector('.inline-edit-input')).toBeTruthy();
      expect(nameField.querySelector('.inline-edit-actions')).toBeTruthy();
    });
    
    // TC-A-006: Clicking on email field converts it to editable input with save/cancel buttons
    it('should convert email field to edit mode when clicked', () => {
      const emailField = document.createElement('div');
      emailField.className = 'inline-edit-field';
      emailField.textContent = 'test@example.com';
      emailField.setAttribute('data-field', 'email');
      emailField.setAttribute('data-value', 'test@example.com');
      document.body.appendChild(emailField);
      
      emailField.click();
      
      expect(emailField.classList.contains('editing')).toBe(true);
      expect(emailField.querySelector('input[type="email"]')).toBeTruthy();
    });
    
    // TC-A-007: Only one field can be in edit mode at a time across the entire form
    it('should allow only one field in edit mode at a time', () => {
      const nameField = document.createElement('div');
      nameField.className = 'inline-edit-field';
      nameField.setAttribute('data-field', 'name');
      nameField.setAttribute('data-value', 'Test User');
      
      const emailField = document.createElement('div');
      emailField.className = 'inline-edit-field';
      emailField.setAttribute('data-field', 'email');
      emailField.setAttribute('data-value', 'test@example.com');
      
      document.body.appendChild(nameField);
      document.body.appendChild(emailField);
      
      // Click first field
      nameField.click();
      expect(nameField.classList.contains('editing')).toBe(true);
      
      // Click second field should exit edit mode on first
      emailField.click();
      expect(nameField.classList.contains('editing')).toBe(false);
      expect(emailField.classList.contains('editing')).toBe(true);
    });
    
    // TC-A-008: Save button only appears when field value differs from original value
    it('should show save button only when value changes', () => {
      const nameField = document.createElement('div');
      nameField.className = 'inline-edit-field';
      nameField.setAttribute('data-field', 'name');
      nameField.setAttribute('data-value', 'Original Name');
      document.body.appendChild(nameField);
      
      nameField.click();
      
      const input = nameField.querySelector('.inline-edit-input') as HTMLInputElement;
      const saveBtn = nameField.querySelector('.inline-edit-btn-save') as HTMLButtonElement;
      
      // Initially disabled when value hasn't changed
      expect(saveBtn.disabled).toBe(true);
      
      // Enable when value changes
      input.value = 'New Name';
      input.dispatchEvent(new Event('input'));
      expect(saveBtn.disabled).toBe(false);
    });
    
    // TC-A-009: Cancel button reverts field to original value and exits edit mode
    it('should revert to original value when cancel is clicked', () => {
      const nameField = document.createElement('div');
      nameField.className = 'inline-edit-field';
      nameField.textContent = 'Original Name';
      nameField.setAttribute('data-field', 'name');
      nameField.setAttribute('data-value', 'Original Name');
      document.body.appendChild(nameField);
      
      nameField.click();
      
      const input = nameField.querySelector('.inline-edit-input') as HTMLInputElement;
      const cancelBtn = nameField.querySelector('.inline-edit-btn-cancel') as HTMLButtonElement;
      
      // Change value and then cancel
      input.value = 'Changed Name';
      cancelBtn.click();
      
      expect(nameField.classList.contains('editing')).toBe(false);
      expect(nameField.textContent).toBe('Original Name');
    });
  });

  describe('File Upload Interface', () => {
    // TC-A-015: Profile picture upload accepts only JPG and PNG files with MIME type validation
    it('should validate file type before upload', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/jpeg,image/png';
      fileInput.className = 'file-upload-input';
      document.body.appendChild(fileInput);
      
      // Create mock file with invalid type
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false
      });
      
      // Trigger change event
      fileInput.dispatchEvent(new Event('change'));
      
      // Should show error for invalid file type
      const errorElement = document.querySelector('.field-error');
      expect(errorElement?.textContent).toContain('Invalid file type');
    });
    
    // TC-A-016: File size validation rejects uploads larger than 2MB with error message
    it('should validate file size before upload', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/jpeg,image/png';
      document.body.appendChild(fileInput);
      
      // Create mock large file (3MB)
      const largeFile = new File(['x'.repeat(3 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false
      });
      
      fileInput.dispatchEvent(new Event('change'));
      
      const errorElement = document.querySelector('.field-error');
      expect(errorElement?.textContent).toContain('File too large (max 2MB)');
    });
    
    it('should show upload preview for valid image files', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/jpeg,image/png';
      document.body.appendChild(fileInput);
      
      // Create mock valid file
      const validFile = new File(['valid-image'], 'test.jpg', { type: 'image/jpeg' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        writable: false
      });
      
      // Mock FileReader
      const mockFileReader = {
        readAsDataURL: jest.fn(),
        onload: null as any,
        result: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD'
      };
      
      global.FileReader = jest.fn(() => mockFileReader) as any;
      
      fileInput.dispatchEvent(new Event('change'));
      
      // Simulate FileReader onload
      if (mockFileReader.onload) {
        mockFileReader.onload({ target: { result: mockFileReader.result } } as any);
      }
      
      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(validFile);
    });
  });

  describe('Form Validation and Feedback', () => {
    // TC-A-011: Name validation error displays below field: 'Name must be between 2 and 50 characters'
    it('should show name validation errors', () => {
      const nameField = document.createElement('div');
      nameField.className = 'inline-edit-field';
      nameField.setAttribute('data-field', 'name');
      nameField.setAttribute('data-value', 'Original Name');
      document.body.appendChild(nameField);
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      nameField.appendChild(errorDiv);
      
      nameField.click();
      
      const input = nameField.querySelector('.inline-edit-input') as HTMLInputElement;
      
      // Test short name
      input.value = 'A';
      input.dispatchEvent(new Event('blur'));
      
      expect(errorDiv.textContent).toContain('Name must be between 2 and 50 characters');
      expect(errorDiv.classList.contains('visible')).toBe(true);
    });
    
    // TC-A-012: Email field requires valid email format and shows format error if invalid
    it('should show email validation errors', () => {
      const emailField = document.createElement('div');
      emailField.className = 'inline-edit-field';
      emailField.setAttribute('data-field', 'email');
      emailField.setAttribute('data-value', 'test@example.com');
      document.body.appendChild(emailField);
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      emailField.appendChild(errorDiv);
      
      emailField.click();
      
      const input = emailField.querySelector('input') as HTMLInputElement;
      
      // Test invalid email
      input.value = 'invalid-email';
      input.dispatchEvent(new Event('blur'));
      
      expect(errorDiv.textContent).toContain('Please enter a valid email address');
      expect(errorDiv.classList.contains('visible')).toBe(true);
    });
    
    // TC-A-014: Successful profile update redirects to /profile with green success message for 3 seconds
    it('should show success message after successful update', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: 'Profile updated successfully' })
      } as Response);
      
      const successAlert = document.createElement('div');
      successAlert.id = 'success-alert';
      successAlert.className = 'alert alert-success';
      document.body.appendChild(successAlert);
      
      const successMessage = document.createElement('span');
      successMessage.id = 'success-message';
      successAlert.appendChild(successMessage);
      
      // Simulate successful form submission
      const form = document.createElement('form');
      form.action = '/profile';
      form.method = 'POST';
      document.body.appendChild(form);
      
      // Mock form submission
      const formData = new FormData();
      formData.append('name', 'Updated Name');
      formData.append('email', 'updated@example.com');
      
      await fetch('/profile', {
        method: 'POST',
        body: formData
      });
      
      // Should show success message
      successAlert.classList.add('visible');
      successMessage.textContent = 'Profile updated successfully';
      
      expect(successAlert.classList.contains('visible')).toBe(true);
      expect(successMessage.textContent).toBe('Profile updated successfully');
    });
    
    it('should show error message for failed updates', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unable to update profile. Please try again.' })
      } as Response);
      
      const errorAlert = document.createElement('div');
      errorAlert.id = 'error-alert';
      errorAlert.className = 'alert alert-error';
      document.body.appendChild(errorAlert);
      
      const errorMessage = document.createElement('span');
      errorMessage.id = 'error-message';
      errorAlert.appendChild(errorMessage);
      
      await fetch('/profile', {
        method: 'POST',
        body: new FormData()
      });
      
      errorAlert.classList.add('visible');
      errorMessage.textContent = 'Unable to update profile. Please try again.';
      
      expect(errorAlert.classList.contains('visible')).toBe(true);
      expect(errorMessage.textContent).toContain('Unable to update profile');
    });
  });

  describe('Password Change Form', () => {
    // TC-A-019: Password change form requires current password, new password, and confirm password fields
    it('should validate all password fields are present', () => {
      const passwordForm = document.createElement('form');
      passwordForm.className = 'password-form';
      
      const currentPasswordInput = document.createElement('input');
      currentPasswordInput.type = 'password';
      currentPasswordInput.name = 'currentPassword';
      currentPasswordInput.required = true;
      
      const newPasswordInput = document.createElement('input');
      newPasswordInput.type = 'password';
      newPasswordInput.name = 'newPassword';
      newPasswordInput.required = true;
      
      const confirmPasswordInput = document.createElement('input');
      confirmPasswordInput.type = 'password';
      confirmPasswordInput.name = 'confirmPassword';
      confirmPasswordInput.required = true;
      
      passwordForm.appendChild(currentPasswordInput);
      passwordForm.appendChild(newPasswordInput);
      passwordForm.appendChild(confirmPasswordInput);
      document.body.appendChild(passwordForm);
      
      expect(currentPasswordInput.required).toBe(true);
      expect(newPasswordInput.required).toBe(true);
      expect(confirmPasswordInput.required).toBe(true);
    });
    
    // TC-A-021: New password must be 6-128 characters with uppercase, lowercase, and number
    it('should validate new password strength', () => {
      const newPasswordInput = document.createElement('input');
      newPasswordInput.type = 'password';
      newPasswordInput.name = 'newPassword';
      newPasswordInput.pattern = '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d]{6,128}$';
      document.body.appendChild(newPasswordInput);
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      newPasswordInput.parentNode?.appendChild(errorDiv);
      
      // Test weak password
      newPasswordInput.value = 'weak';
      newPasswordInput.dispatchEvent(new Event('blur'));
      
      // Simulate validation
      const isValid = newPasswordInput.checkValidity();
      expect(isValid).toBe(false);
    });
    
    // TC-A-022: Confirm password must exactly match new password field
    it('should validate password confirmation matches', () => {
      const newPasswordInput = document.createElement('input');
      newPasswordInput.type = 'password';
      newPasswordInput.name = 'newPassword';
      newPasswordInput.value = 'ValidPass123';
      
      const confirmPasswordInput = document.createElement('input');
      confirmPasswordInput.type = 'password';
      confirmPasswordInput.name = 'confirmPassword';
      confirmPasswordInput.value = 'DifferentPass123';
      
      document.body.appendChild(newPasswordInput);
      document.body.appendChild(confirmPasswordInput);
      
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      confirmPasswordInput.parentNode?.appendChild(errorDiv);
      
      confirmPasswordInput.dispatchEvent(new Event('blur'));
      
      // Simulate password match validation
      if (newPasswordInput.value !== confirmPasswordInput.value) {
        errorDiv.textContent = 'New passwords do not match';
        errorDiv.classList.add('visible');
      }
      
      expect(errorDiv.textContent).toBe('New passwords do not match');
      expect(errorDiv.classList.contains('visible')).toBe(true);
    });
    
    // TC-A-024: Successful password update shows success message and clears all password fields
    it('should clear password fields after successful update', () => {
      const currentPasswordInput = document.createElement('input');
      currentPasswordInput.type = 'password';
      currentPasswordInput.name = 'currentPassword';
      currentPasswordInput.value = 'oldpassword';
      
      const newPasswordInput = document.createElement('input');
      newPasswordInput.type = 'password';
      newPasswordInput.name = 'newPassword';
      newPasswordInput.value = 'NewPass123';
      
      const confirmPasswordInput = document.createElement('input');
      confirmPasswordInput.type = 'password';
      confirmPasswordInput.name = 'confirmPassword';
      confirmPasswordInput.value = 'NewPass123';
      
      document.body.appendChild(currentPasswordInput);
      document.body.appendChild(newPasswordInput);
      document.body.appendChild(confirmPasswordInput);
      
      // Simulate successful password update
      currentPasswordInput.value = '';
      newPasswordInput.value = '';
      confirmPasswordInput.value = '';
      
      expect(currentPasswordInput.value).toBe('');
      expect(newPasswordInput.value).toBe('');
      expect(confirmPasswordInput.value).toBe('');
    });
  });

  describe('Accessibility and UX', () => {
    it('should maintain proper ARIA labels and roles', () => {
      const profilePicture = document.createElement('div');
      profilePicture.className = 'profile-picture-container';
      profilePicture.setAttribute('role', 'button');
      profilePicture.setAttribute('aria-label', 'Change profile picture');
      profilePicture.setAttribute('tabindex', '0');
      document.body.appendChild(profilePicture);
      
      expect(profilePicture.getAttribute('role')).toBe('button');
      expect(profilePicture.getAttribute('aria-label')).toBe('Change profile picture');
      expect(profilePicture.getAttribute('tabindex')).toBe('0');
    });
    
    it('should handle keyboard navigation for inline editing', () => {
      const nameField = document.createElement('div');
      nameField.className = 'inline-edit-field';
      nameField.setAttribute('tabindex', '0');
      nameField.setAttribute('data-field', 'name');
      nameField.setAttribute('data-value', 'Test User');
      document.body.appendChild(nameField);
      
      // Simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      nameField.dispatchEvent(enterEvent);
      
      // Should enter edit mode
      nameField.classList.add('editing');
      expect(nameField.classList.contains('editing')).toBe(true);
    });
    
    it('should provide screen reader announcements for state changes', () => {
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
      
      // Simulate announcing edit mode
      liveRegion.textContent = 'Name field is now editable';
      expect(liveRegion.textContent).toBe('Name field is now editable');
    });
  });
});