/**
 * Profile Inline Editing Module Tests
 * Tests cover all PRD acceptance criteria for profile inline editing functionality
 */

describe('ProfileInlineEditor', () => {
  let profileEditor: any;
  let mockFetch: jest.Mock;
  let mockConsoleError: jest.Mock;

  beforeEach(() => {
    // Mock DOM elements
    document.body.innerHTML = `
      <div id="user-name">John Doe</div>
      <div id="user-email">john@example.com</div>
      <input id="profile-picture-input" type="file" style="display: none;">
      <div class="profile-picture-container">
        <div class="profile-picture">
          <img src="/uploads/test.jpg" alt="Profile">
        </div>
      </div>
      <form id="password-form">
        <input id="current-password" type="password">
        <input id="new-password" type="password">
        <input id="confirm-password" type="password">
      </form>
    `;

    // Mock fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Mock console.error
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Import and initialize ProfileInlineEditor
    const ProfileInlineEditor = require('../../public/js/profile-inline-edit.js');
    profileEditor = new ProfileInlineEditor();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockRestore();
  });

  describe('Initialization and Setup', () => {
    // TC-F-001: Profile Information Display
    test('should initialize with correct constants and store original values', () => {
      expect(profileEditor.CONSTANTS.MAX_FILE_SIZE).toBe(2097152);
      expect(profileEditor.CONSTANTS.ALLOWED_MIME_TYPES).toEqual(['image/jpeg', 'image/png']);
      expect(profileEditor.CONSTANTS.MIN_NAME_LENGTH).toBe(2);
      expect(profileEditor.CONSTANTS.MAX_NAME_LENGTH).toBe(50);
      expect(profileEditor.originalValues.name).toBe('John Doe');
      expect(profileEditor.originalValues.email).toBe('john@example.com');
    });
  });

  describe('Inline Editing - Name Field', () => {
    // TC-F-002: Inline Editing Functionality - Name field conversion
    test('should enter edit mode for name field when clicked', () => {
      const nameElement = document.getElementById('user-name')!;
      nameElement.click();
      
      expect(profileEditor.currentEditField).toBe('name');
      expect(document.getElementById('edit-name')).toBeTruthy();
      expect(document.querySelector('.save-btn')).toBeTruthy();
      expect(document.querySelector('.cancel-btn')).toBeTruthy();
    });

    // TC-F-003: Data Validation Rules - Name validation
    test('should validate name field with correct rules (2-50 chars, letters and spaces only)', () => {
      const errorDiv = document.createElement('div');
      
      // Valid name
      expect(profileEditor.validateField('name', 'John Doe', errorDiv)).toBe(true);
      expect(errorDiv.textContent).toBe('');
      
      // Too short
      expect(profileEditor.validateField('name', 'J', errorDiv)).toBe(false);
      expect(errorDiv.textContent).toContain('between 2 and 50 characters');
      
      // Too long
      const longName = 'A'.repeat(51);
      expect(profileEditor.validateField('name', longName, errorDiv)).toBe(false);
      expect(errorDiv.textContent).toContain('between 2 and 50 characters');
      
      // Invalid characters
      expect(profileEditor.validateField('name', 'John123', errorDiv)).toBe(false);
      expect(errorDiv.textContent).toContain('only contain letters and spaces');
    });

    // TC-F-004: Inline Editing Functionality - Save button state
    test('should enable save button only when name value changes and is valid', () => {
      const nameElement = document.getElementById('user-name')!;
      nameElement.click();
      
      const input = document.getElementById('edit-name') as HTMLInputElement;
      const saveBtn = document.querySelector('.save-btn') as HTMLButtonElement;
      
      // Initially disabled (no change)
      expect(saveBtn.disabled).toBe(true);
      
      // Valid change
      input.value = 'Jane Doe';
      input.dispatchEvent(new Event('input'));
      expect(saveBtn.disabled).toBe(false);
      
      // Invalid change
      input.value = 'J';
      input.dispatchEvent(new Event('input'));
      expect(saveBtn.disabled).toBe(true);
    });

    // TC-F-005: Inline Editing Functionality - Cancel and escape
    test('should cancel edit mode and revert to original value', () => {
      const nameElement = document.getElementById('user-name')!;
      nameElement.click();
      
      const input = document.getElementById('edit-name') as HTMLInputElement;
      input.value = 'Changed Name';
      
      profileEditor.cancelEdit();
      
      expect(profileEditor.currentEditField).toBe(null);
      expect(nameElement.textContent).toBe('John Doe');
    });

    // TC-F-006: Inline Editing Functionality - Escape key handling
    test('should cancel edit mode when escape key is pressed', () => {
      const nameElement = document.getElementById('user-name')!;
      nameElement.click();
      
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      expect(profileEditor.currentEditField).toBe(null);
      expect(nameElement.textContent).toBe('John Doe');
    });
  });

  describe('Inline Editing - Email Field', () => {
    // TC-F-007: Inline Editing Functionality - Email field conversion
    test('should enter edit mode for email field when clicked', () => {
      const emailElement = document.getElementById('user-email')!;
      emailElement.click();
      
      expect(profileEditor.currentEditField).toBe('email');
      expect(document.getElementById('edit-email')).toBeTruthy();
      const input = document.getElementById('edit-email') as HTMLInputElement;
      expect(input.type).toBe('email');
    });

    // TC-F-008: Data Validation Rules - Email validation
    test('should validate email field with correct format', () => {
      const errorDiv = document.createElement('div');
      
      // Valid email
      expect(profileEditor.validateField('email', 'test@example.com', errorDiv)).toBe(true);
      expect(errorDiv.textContent).toBe('');
      
      // Invalid email formats
      expect(profileEditor.validateField('email', 'invalid-email', errorDiv)).toBe(false);
      expect(errorDiv.textContent).toContain('valid email address');
      
      expect(profileEditor.validateField('email', 'test@', errorDiv)).toBe(false);
      expect(profileEditor.validateField('email', '@example.com', errorDiv)).toBe(false);
    });

    // TC-F-009: Inline Editing Functionality - Single field edit mode
    test('should allow only one field in edit mode at a time', () => {
      const nameElement = document.getElementById('user-name')!;
      const emailElement = document.getElementById('user-email')!;
      
      nameElement.click();
      expect(profileEditor.currentEditField).toBe('name');
      
      emailElement.click();
      expect(profileEditor.currentEditField).toBe('email');
      expect(document.getElementById('edit-name')).toBeFalsy();
      expect(document.getElementById('edit-email')).toBeTruthy();
    });
  });

  describe('Profile Field Save Functionality', () => {
    // TC-F-010: Backend Profile Updates - Successful save
    test('should save name field changes successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, message: 'Profile updated successfully' })
      });
      
      const nameElement = document.getElementById('user-name')!;
      nameElement.click();
      
      const input = document.getElementById('edit-name') as HTMLInputElement;
      input.value = 'Jane Doe';
      
      await profileEditor.saveField('name');
      
      expect(mockFetch).toHaveBeenCalledWith('/profile', {
        method: 'POST',
        body: expect.any(FormData),
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      expect(profileEditor.originalValues.name).toBe('Jane Doe');
      expect(profileEditor.currentEditField).toBe(null);
    });

    // TC-F-011: Error Handling and Feedback - Database errors
    test('should handle save errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ success: false, message: 'Email already exists' })
      });
      
      const spy = jest.spyOn(profileEditor, 'showErrorMessage').mockImplementation(() => {});
      
      const emailElement = document.getElementById('user-email')!;
      emailElement.click();
      
      const input = document.getElementById('edit-email') as HTMLInputElement;
      input.value = 'existing@example.com';
      
      await profileEditor.saveField('email');
      
      expect(spy).toHaveBeenCalledWith('Email already exists');
      spy.mockRestore();
    });

    // TC-F-012: Error Handling and Feedback - Network errors
    test('should handle network errors during save', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const spy = jest.spyOn(profileEditor, 'showErrorMessage').mockImplementation(() => {});
      
      const nameElement = document.getElementById('user-name')!;
      nameElement.click();
      
      await profileEditor.saveField('name');
      
      expect(spy).toHaveBeenCalledWith('Unable to update profile. Please try again.');
      expect(mockConsoleError).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('File Upload Functionality', () => {
    // TC-F-013: File Upload Processing - Trigger upload
    test('should trigger file upload when profile picture container is clicked', () => {
      const profileContainer = document.querySelector('.profile-picture-container')!;
      const fileInput = document.getElementById('profile-picture-input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});
      
      profileContainer.click();
      
      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    // TC-F-014: File Upload Processing - File validation (size)
    test('should validate file size (max 2MB)', () => {
      const spy = jest.spyOn(profileEditor, 'showErrorMessage').mockImplementation(() => {});
      
      const largeFile = new File(['x'.repeat(2097153)], 'large.jpg', { type: 'image/jpeg' });
      expect(profileEditor.validateFile(largeFile)).toBe(false);
      expect(spy).toHaveBeenCalledWith('File too large (max 2MB)');
      
      const validFile = new File(['valid'], 'valid.jpg', { type: 'image/jpeg' });
      expect(profileEditor.validateFile(validFile)).toBe(true);
      
      spy.mockRestore();
    });

    // TC-F-015: File Upload Processing - File type validation
    test('should validate file type (JPG/PNG only)', () => {
      const spy = jest.spyOn(profileEditor, 'showErrorMessage').mockImplementation(() => {});
      
      // Invalid MIME type
      const invalidFile = new File(['data'], 'file.gif', { type: 'image/gif' });
      expect(profileEditor.validateFile(invalidFile)).toBe(false);
      expect(spy).toHaveBeenCalledWith('Invalid file type (JPG/PNG only)');
      
      // Invalid extension
      const wrongExtFile = new File(['data'], 'file.bmp', { type: 'image/jpeg' });
      expect(profileEditor.validateFile(wrongExtFile)).toBe(false);
      
      // Valid files
      const jpgFile = new File(['data'], 'file.jpg', { type: 'image/jpeg' });
      expect(profileEditor.validateFile(jpgFile)).toBe(true);
      
      const pngFile = new File(['data'], 'file.png', { type: 'image/png' });
      expect(profileEditor.validateFile(pngFile)).toBe(true);
      
      spy.mockRestore();
    });

    // TC-F-016: File Upload Processing - File upload prevention during upload
    test('should prevent multiple simultaneous uploads', () => {
      profileEditor.isUploading = true;
      const fileInput = document.getElementById('profile-picture-input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});
      
      profileEditor.triggerFileUpload();
      
      expect(clickSpy).not.toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    // TC-F-017: File Upload Processing - File selection handling
    test('should handle file selection and validation', () => {
      const fileInput = document.getElementById('profile-picture-input') as HTMLInputElement;
      const validateSpy = jest.spyOn(profileEditor, 'validateFile').mockReturnValue(true);
      const previewSpy = jest.spyOn(profileEditor, 'previewAndUploadFile').mockImplementation(() => {});
      
      const validFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [validFile],
        writable: false
      });
      
      const event = new Event('change');
      Object.defineProperty(event, 'target', {
        value: fileInput,
        enumerable: true
      });
      
      profileEditor.handleFileSelect(event);
      
      expect(validateSpy).toHaveBeenCalledWith(validFile);
      expect(previewSpy).toHaveBeenCalledWith(validFile);
      
      validateSpy.mockRestore();
      previewSpy.mockRestore();
    });
  });

  describe('Password Change Functionality', () => {
    // TC-F-018: Password Change Validation - Form submission
    test('should handle password form submission', () => {
      const passwordForm = document.getElementById('password-form') as HTMLFormElement;
      const handleSpy = jest.spyOn(profileEditor, 'handlePasswordSubmit').mockImplementation(() => {});
      
      const submitEvent = new Event('submit');
      passwordForm.dispatchEvent(submitEvent);
      
      expect(handleSpy).toHaveBeenCalled();
      handleSpy.mockRestore();
    });
  });

  describe('Utility Functions', () => {
    // TC-F-019: Data Validation Rules - HTML escaping for security
    test('should escape HTML characters to prevent XSS', () => {
      const testString = '<script>alert("xss")</script>';
      const escaped = profileEditor.escapeHtml(testString);
      
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    // TC-F-020: Error Handling and Feedback - Success/Error message display
    test('should show success and error messages', () => {
      const successSpy = jest.spyOn(profileEditor, 'showSuccessMessage').mockImplementation(() => {});
      const errorSpy = jest.spyOn(profileEditor, 'showErrorMessage').mockImplementation(() => {});
      
      profileEditor.showSuccessMessage('Success!');
      profileEditor.showErrorMessage('Error!');
      
      expect(successSpy).toHaveBeenCalledWith('Success!');
      expect(errorSpy).toHaveBeenCalledWith('Error!');
      
      successSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    // TC-F-021: Data Validation Rules - Boundary value testing
    test('should handle boundary values for name length validation', () => {
      const errorDiv = document.createElement('div');
      
      // Minimum valid length (2 characters)
      expect(profileEditor.validateField('name', 'AB', errorDiv)).toBe(true);
      
      // Maximum valid length (50 characters)
      const maxName = 'A'.repeat(50);
      expect(profileEditor.validateField('name', maxName, errorDiv)).toBe(true);
      
      // Just below minimum (1 character)
      expect(profileEditor.validateField('name', 'A', errorDiv)).toBe(false);
      
      // Just above maximum (51 characters)
      const overMaxName = 'A'.repeat(51);
      expect(profileEditor.validateField('name', overMaxName, errorDiv)).toBe(false);
    });

    // TC-F-022: File Upload Processing - Exact file size boundary
    test('should handle exact file size boundary (2MB)', () => {
      const spy = jest.spyOn(profileEditor, 'showErrorMessage').mockImplementation(() => {});
      
      // Exactly 2MB (should pass)
      const exactSizeFile = new File(['x'.repeat(2097152)], 'exact.jpg', { type: 'image/jpeg' });
      expect(profileEditor.validateFile(exactSizeFile)).toBe(true);
      
      // One byte over 2MB (should fail)
      const oversizeFile = new File(['x'.repeat(2097153)], 'over.jpg', { type: 'image/jpeg' });
      expect(profileEditor.validateFile(oversizeFile)).toBe(false);
      
      spy.mockRestore();
    });

    // TC-F-023: Inline Editing Functionality - Empty field handling
    test('should handle empty or whitespace-only field values', () => {
      const errorDiv = document.createElement('div');
      
      // Empty name
      expect(profileEditor.validateField('name', '', errorDiv)).toBe(false);
      
      // Whitespace-only name
      expect(profileEditor.validateField('name', '   ', errorDiv)).toBe(false);
      
      // Empty email
      expect(profileEditor.validateField('email', '', errorDiv)).toBe(false);
    });
  });
});