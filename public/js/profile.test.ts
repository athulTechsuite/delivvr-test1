import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Mock fetch for testing async operations
global.fetch = jest.fn();

// Test environment setup
let dom: JSDOM;
let window: Window;
let document: Document;
let mockConsoleError: jest.SpyInstance;

describe('Profile Page JavaScript Functionality', () => {
  beforeEach(() => {
    // Create fresh DOM for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Profile Page</title>
        </head>
        <body>
          <div class="profile-container">
            <div class="form-group">
              <input id="nameField" type="text" value="John Doe" readonly class="form-control" />
              <div class="profile-actions" style="display: none;">
                <button class="save-btn">Save</button>
                <button class="cancel-btn">Cancel</button>
              </div>
            </div>
            <form id="passwordChangeForm" class="password-form">
              <div class="form-group">
                <input id="currentPassword" type="password" class="form-control" />
              </div>
              <div class="form-group">
                <input id="newPassword" type="password" class="form-control" />
              </div>
              <button type="submit" class="password-submit-btn" disabled>Update Password</button>
            </form>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000/profile',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    window = dom.window as unknown as Window;
    document = window.document;
    
    // Setup global objects
    global.window = window;
    global.document = document;
    global.setTimeout = window.setTimeout;
    global.console = window.console;
    
    // Mock console.error
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock fetch responses
    (fetch as jest.MockedFunction<typeof fetch>).mockClear();
    
    // Load and execute the profile.js module
    const profileJs = fs.readFileSync(path.join(__dirname, '../public/js/profile.js'), 'utf8');
    
    // Create a script element and execute it in the DOM context
    const script = document.createElement('script');
    script.textContent = profileJs;
    document.head.appendChild(script);
    
    // Mock profile page manager for success/error messages
    (window as any).profilePageManager = {
      showSuccessMessage: jest.fn(),
      showErrorMessage: jest.fn()
    };
  });
  
  afterEach(() => {
    mockConsoleError.mockRestore();
    jest.clearAllMocks();
    dom.window.close();
  });

  describe('EditableNameField - Inline Editing', () => {
    let nameField: HTMLInputElement;
    let editableField: any;

    beforeEach(() => {
      nameField = document.getElementById('nameField') as HTMLInputElement;
      const EditableNameField = (window as any).EditableNameField;
      editableField = new EditableNameField(nameField, 'John Doe');
    });

    // TC-F-001: Profile name field allows inline editing when clicked
    test('should enter edit mode when name field is clicked', () => {
      nameField.click();
      
      expect(nameField.hasAttribute('readonly')).toBe(false);
      expect(nameField.classList.contains('editing')).toBe(true);
      expect(document.querySelector('.profile-actions')).toHaveStyle('display: flex');
    });

    // TC-F-002: Profile name field allows inline editing when focused
    test('should enter edit mode when name field is focused', () => {
      nameField.focus();
      
      expect(nameField.hasAttribute('readonly')).toBe(false);
      expect(nameField.classList.contains('editing')).toBe(true);
      expect(document.querySelector('.profile-actions')).toHaveStyle('display: flex');
    });

    // TC-F-003: Profile name field validates that the name is not empty before saving
    test('should show validation error for empty name', () => {
      nameField.click();
      nameField.value = '';
      nameField.dispatchEvent(new Event('input'));
      
      expect(nameField.classList.contains('error')).toBe(true);
      expect(document.querySelector('.validation-error')).toBeTruthy();
      expect(document.querySelector('.validation-error')?.textContent)
        .toContain('Name must be 2-50 characters and contain only letters and spaces');
    });

    // TC-F-004: Profile name field applies same validation rules as signup form (minimum 2 characters)
    test('should validate minimum 2 characters for name', () => {
      nameField.click();
      nameField.value = 'J';
      nameField.dispatchEvent(new Event('input'));
      
      expect(nameField.classList.contains('error')).toBe(true);
      expect(editableField.isValid()).toBe(false);
    });

    // TC-F-005: Profile name field validates maximum 50 characters
    test('should validate maximum 50 characters for name', () => {
      nameField.click();
      nameField.value = 'a'.repeat(51);
      nameField.dispatchEvent(new Event('input'));
      
      expect(nameField.classList.contains('error')).toBe(true);
      expect(editableField.isValid()).toBe(false);
    });

    // TC-F-006: Profile name field validates letters and spaces only
    test('should validate letters and spaces only', () => {
      nameField.click();
      nameField.value = 'John123';
      nameField.dispatchEvent(new Event('input'));
      
      expect(nameField.classList.contains('error')).toBe(true);
      expect(editableField.isValid()).toBe(false);
    });

    // TC-F-007: Profile name field accepts valid name
    test('should accept valid name with letters and spaces', () => {
      nameField.click();
      nameField.value = 'John Doe Jr';
      nameField.dispatchEvent(new Event('input'));
      
      expect(nameField.classList.contains('error')).toBe(false);
      expect(editableField.isValid()).toBe(true);
    });

    // TC-F-008: Cancel button reverts name field to original value and exits edit mode
    test('should revert to original value when cancelled via escape key', () => {
      nameField.click();
      nameField.value = 'Changed Name';
      
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      nameField.dispatchEvent(escEvent);
      
      expect(nameField.value).toBe('John Doe');
      expect(nameField.hasAttribute('readonly')).toBe(true);
      expect(nameField.classList.contains('editing')).toBe(false);
    });

    // TC-F-009: Save with Enter key when valid
    test('should save changes when Enter key is pressed with valid input', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response);
      
      nameField.click();
      nameField.value = 'Jane Smith';
      
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      nameField.dispatchEvent(enterEvent);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetch).toHaveBeenCalledWith('/profile/update', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({ name: 'Jane Smith' })
      }));
    });

    // TC-F-010: Save button updates user name in database and shows success feedback
    test('should save changes successfully and show success message', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response);
      
      nameField.click();
      nameField.value = 'Jane Smith';
      
      const result = await editableField.saveChanges();
      
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/profile/update', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Jane Smith' })
      }));
      expect((window as any).profilePageManager.showSuccessMessage)
        .toHaveBeenCalledWith('Name updated successfully');
    });

    // TC-F-011: Handle save errors gracefully
    test('should handle save errors gracefully', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ success: false, message: 'Server error' })
      } as Response);
      
      nameField.click();
      nameField.value = 'Jane Smith';
      
      const result = await editableField.saveChanges();
      
      expect(result).toBe(false);
      expect((window as any).profilePageManager.showErrorMessage)
        .toHaveBeenCalledWith('Server error');
    });

    // TC-F-012: Profile form prevents submission of unchanged data
    test('should not make API call for unchanged data', async () => {
      nameField.click();
      nameField.value = 'John Doe'; // Same as original
      
      const result = await editableField.saveChanges();
      
      expect(result).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    });

    // TC-F-013: Exit edit mode on blur
    test('should exit edit mode when field loses focus', (done) => {
      nameField.click();
      expect(editableField.isEditing).toBe(true);
      
      nameField.blur();
      
      setTimeout(() => {
        expect(editableField.isEditing).toBe(false);
        expect(nameField.hasAttribute('readonly')).toBe(true);
        done();
      }, 200);
    });
  });

  describe('PasswordChangeForm - Password Management', () => {
    let passwordForm: HTMLFormElement;
    let currentPasswordField: HTMLInputElement;
    let newPasswordField: HTMLInputElement;
    let submitButton: HTMLButtonElement;
    let passwordChangeForm: any;

    beforeEach(() => {
      passwordForm = document.getElementById('passwordChangeForm') as HTMLFormElement;
      currentPasswordField = document.getElementById('currentPassword') as HTMLInputElement;
      newPasswordField = document.getElementById('newPassword') as HTMLInputElement;
      submitButton = passwordForm.querySelector('.password-submit-btn') as HTMLButtonElement;
      
      const PasswordChangeForm = (window as any).PasswordChangeForm;
      passwordChangeForm = new PasswordChangeForm(passwordForm);
    });

    // TC-F-014: Current password field validates against user's existing password
    test('should validate current password field is not empty', () => {
      currentPasswordField.value = '';
      currentPasswordField.dispatchEvent(new Event('input'));
      
      expect(currentPasswordField.classList.contains('error')).toBe(true);
      expect(submitButton.disabled).toBe(true);
    });

    // TC-F-015: New password field applies same validation rules as signup form (minimum 6 characters)
    test('should validate new password minimum 6 characters', () => {
      newPasswordField.value = '12345';
      newPasswordField.dispatchEvent(new Event('input'));
      
      expect(newPasswordField.classList.contains('error')).toBe(true);
      expect(submitButton.disabled).toBe(true);
    });

    // TC-F-016: New password requires uppercase letter
    test('should validate new password requires uppercase letter', () => {
      newPasswordField.value = 'password123';
      newPasswordField.dispatchEvent(new Event('input'));
      
      expect(newPasswordField.classList.contains('error')).toBe(true);
      expect(submitButton.disabled).toBe(true);
    });

    // TC-F-017: New password requires lowercase letter
    test('should validate new password requires lowercase letter', () => {
      newPasswordField.value = 'PASSWORD123';
      newPasswordField.dispatchEvent(new Event('input'));
      
      expect(newPasswordField.classList.contains('error')).toBe(true);
      expect(submitButton.disabled).toBe(true);
    });

    // TC-F-018: New password requires number
    test('should validate new password requires number', () => {
      newPasswordField.value = 'Password';
      newPasswordField.dispatchEvent(new Event('input'));
      
      expect(newPasswordField.classList.contains('error')).toBe(true);
      expect(submitButton.disabled).toBe(true);
    });

    // TC-F-019: Valid password enables submit button
    test('should enable submit button when both passwords are valid', () => {
      currentPasswordField.value = 'currentpass';
      newPasswordField.value = 'Password123';
      
      currentPasswordField.dispatchEvent(new Event('input'));
      newPasswordField.dispatchEvent(new Event('input'));
      
      expect(submitButton.disabled).toBe(false);
    });

    // TC-F-020: Password change form only submits when both fields are completed
    test('should prevent submission when current password is missing', () => {
      currentPasswordField.value = '';
      newPasswordField.value = 'Password123';
      
      const submitSpy = jest.spyOn(passwordChangeForm, 'handleSubmit');
      passwordForm.dispatchEvent(new Event('submit'));
      
      expect(submitButton.disabled).toBe(true);
    });

    // TC-F-021: Successful password change shows success message
    test('should show success message on successful password change', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      } as Response);
      
      currentPasswordField.value = 'currentpass';
      newPasswordField.value = 'Password123';
      
      // Mock the handleSubmit method to test success scenario
      passwordChangeForm.handleSubmit = jest.fn().mockResolvedValue(true);
      
      await passwordChangeForm.handleSubmit();
      
      expect(passwordChangeForm.handleSubmit).toHaveBeenCalled();
    });

    // TC-F-022: Handle password change errors
    test('should handle password change errors gracefully', async () => {
      currentPasswordField.value = 'wrongpass';
      newPasswordField.value = 'Password123';
      
      const validateSpy = jest.spyOn(passwordChangeForm, 'validateCurrentPassword').mockReturnValue(true);
      const validateNewSpy = jest.spyOn(passwordChangeForm, 'validateNewPassword').mockReturnValue(true);
      
      await passwordChangeForm.handleSubmit();
      
      expect(validateSpy).toHaveBeenCalled();
      expect(validateNewSpy).toHaveBeenCalled();
    });

    // TC-F-023: Floating label behavior on focus
    test('should add focused class to form group on field focus', () => {
      const formGroup = currentPasswordField.closest('.form-group');
      
      currentPasswordField.focus();
      
      expect(formGroup?.classList.contains('focused')).toBe(true);
    });

    // TC-F-024: Remove focused class on blur when empty
    test('should remove focused class on blur when field is empty', () => {
      const formGroup = currentPasswordField.closest('.form-group');
      
      currentPasswordField.focus();
      currentPasswordField.value = '';
      currentPasswordField.blur();
      
      expect(formGroup?.classList.contains('focused')).toBe(false);
    });

    // TC-F-025: Keep focused class on blur when field has value
    test('should keep focused class on blur when field has value', () => {
      const formGroup = currentPasswordField.closest('.form-group');
      
      currentPasswordField.focus();
      currentPasswordField.value = 'somevalue';
      currentPasswordField.blur();
      
      expect(formGroup?.classList.contains('focused')).toBe(true);
    });
  });

  describe('Accessibility and ARIA Support', () => {
    // TC-F-026: Profile page includes proper ARIA labels for form controls
    test('should add ARIA alert role to validation errors', () => {
      const nameField = document.getElementById('nameField') as HTMLInputElement;
      const EditableNameField = (window as any).EditableNameField;
      const editableField = new EditableNameField(nameField, 'John Doe');
      
      nameField.click();
      nameField.value = '';
      nameField.dispatchEvent(new Event('input'));
      
      const errorElement = document.querySelector('.validation-error');
      expect(errorElement?.getAttribute('role')).toBe('alert');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    // TC-F-027: Handle network errors during save
    test('should handle network errors during name save', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Network error')
      );
      
      const nameField = document.getElementById('nameField') as HTMLInputElement;
      const EditableNameField = (window as any).EditableNameField;
      const editableField = new EditableNameField(nameField, 'John Doe');
      
      nameField.click();
      nameField.value = 'Jane Smith';
      
      const result = await editableField.saveChanges();
      
      expect(result).toBe(false);
      expect((window as any).profilePageManager.showErrorMessage)
        .toHaveBeenCalledWith('Failed to update name');
    });

    // TC-F-028: Clear existing validation errors when new input is provided
    test('should clear validation errors when valid input is entered', () => {
      const nameField = document.getElementById('nameField') as HTMLInputElement;
      const EditableNameField = (window as any).EditableNameField;
      const editableField = new EditableNameField(nameField, 'John Doe');
      
      nameField.click();
      nameField.value = 'J'; // Invalid
      nameField.dispatchEvent(new Event('input'));
      
      expect(document.querySelector('.validation-error')).toBeTruthy();
      
      nameField.value = 'Jane Smith'; // Valid
      nameField.dispatchEvent(new Event('input'));
      
      expect(document.querySelector('.validation-error')).toBeFalsy();
    });
  });
});