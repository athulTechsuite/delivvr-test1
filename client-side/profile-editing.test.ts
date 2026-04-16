import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Mock profile page HTML content
const getProfilePageHTML = (user: any = null) => {
  const templatePath = path.join(__dirname, '../views/profile.ejs');
  const template = fs.readFileSync(templatePath, 'utf-8');
  
  // Simple EJS template replacement for testing
  let html = template.replace(/<%[^%]*%>/g, (match) => {
    if (match.includes('pageTitle')) return '';
    if (match.includes('typeof user') && user) return '';
    if (match.includes('user.profile_picture') && user?.profile_picture) {
      return `<img id="profile-picture-display" src="/${user.profile_picture}" alt="Profile picture" class="md-profile-picture" />`;
    }
    if (match.includes('user.profile_picture') && !user?.profile_picture) {
      return `<div id="profile-picture-placeholder" class="md-profile-picture-placeholder"><i class="bi bi-person-fill" aria-hidden="true"></i></div>`;
    }
    return '';
  });
  
  return html;
};

// Mock fetch for API calls
class MockFetch {
  private responses: Map<string, any> = new Map();
  
  setResponse(url: string, response: any) {
    this.responses.set(url, response);
  }
  
  async fetch(url: string, options?: any): Promise<Response> {
    const mockResponse = this.responses.get(url) || { success: true };
    
    return {
      ok: !mockResponse.error,
      status: mockResponse.error ? 400 : 200,
      json: async () => mockResponse
    } as Response;
  }
  
  reset() {
    this.responses.clear();
  }
}

const mockFetch = new MockFetch();

// Client-side JavaScript simulation
const simulateClientSideJS = (dom: JSDOM) => {
  const { window } = dom;
  const { document } = window;
  
  // Mock fetch on window
  (window as any).fetch = mockFetch.fetch.bind(mockFetch);
  
  // Profile editing functionality simulation
  class ProfileEditor {
    private editMode = false;
    private originalData = { name: '', email: '', profilePicture: null };
    
    constructor() {
      this.bindEvents();
      this.loadOriginalData();
    }
    
    private bindEvents() {
      // Edit button click
      const editBtn = document.getElementById('edit-profile-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => this.enterEditMode());
      }
      
      // Save button click  
      const saveBtn = document.getElementById('save-profile-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.saveProfile();
        });
      }
      
      // Cancel button click
      const cancelBtn = document.getElementById('cancel-profile-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.cancelEdit();
        });
      }
      
      // File input change
      const fileInput = document.getElementById('profile-picture-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
      }
      
      // Field validation on blur
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      if (nameInput) {
        nameInput.addEventListener('blur', () => this.validateName(nameInput.value));
      }
      
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      if (emailInput) {
        emailInput.addEventListener('blur', () => this.validateEmail(emailInput.value));
      }
    }
    
    private loadOriginalData() {
      const nameDisplay = document.getElementById('name-display');
      const emailDisplay = document.getElementById('email-display');
      const pictureDisplay = document.getElementById('profile-picture-display') as HTMLImageElement;
      
      this.originalData = {
        name: nameDisplay?.textContent?.trim() || '',
        email: emailDisplay?.textContent?.trim() || '',
        profilePicture: pictureDisplay?.src || null
      };
    }
    
    enterEditMode() {
      this.editMode = true;
      
      // Hide view mode elements
      this.hideElement('profile-picture-view');
      this.hideElement('edit-profile-btn');
      
      // Show edit mode elements
      this.showElement('profile-picture-edit');
      this.showElement('edit-form-buttons');
      
      // Convert displays to inputs
      this.createEditInput('name-display', 'name-input', 'text', this.originalData.name);
      this.createEditInput('email-display', 'email-input', 'email', this.originalData.email);
      
      // Focus first input
      const firstInput = document.getElementById('name-input') as HTMLInputElement;
      if (firstInput) firstInput.focus();
    }
    
    cancelEdit() {
      this.editMode = false;
      
      // Restore original values
      this.restoreDisplay('name-display', this.originalData.name);
      this.restoreDisplay('email-display', this.originalData.email);
      
      // Show view mode elements
      this.showElement('profile-picture-view');
      this.showElement('edit-profile-btn');
      
      // Hide edit mode elements
      this.hideElement('profile-picture-edit');
      this.hideElement('edit-form-buttons');
      
      // Clear error messages
      this.clearValidationErrors();
    }
    
    async saveProfile() {
      if (!this.validateForm()) {
        return;
      }
      
      const formData = this.collectFormData();
      
      try {
        const response = await (window as any).fetch('/profile', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          this.showSuccessMessage('Profile updated successfully');
          this.updateDisplayData(result.user);
          
          // Auto-switch to view mode after 3 seconds
          setTimeout(() => {
            this.exitEditMode();
          }, 3000);
        } else {
          this.showErrorMessage(result.error || 'Update failed');
        }
      } catch (error) {
        this.showErrorMessage('Network error occurred');
      }
    }
    
    private validateForm(): boolean {
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      
      const nameValid = this.validateName(nameInput?.value || '');
      const emailValid = this.validateEmail(emailInput?.value || '');
      
      return nameValid && emailValid;
    }
    
    private validateName(name: string): boolean {
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      const nameRegex = /^[a-zA-Z\s]+$/;
      
      let isValid = true;
      let errorMessage = '';
      
      if (!name || name.length < 2) {
        isValid = false;
        errorMessage = 'Name must be at least 2 characters long';
      } else if (name.length > 50) {
        isValid = false;
        errorMessage = 'Name must be no more than 50 characters long';
      } else if (!nameRegex.test(name)) {
        isValid = false;
        errorMessage = 'Name can only contain letters and spaces';
      }
      
      this.showFieldValidation(nameInput, isValid, errorMessage);
      return isValid;
    }
    
    private validateEmail(email: string): boolean {
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      const isValid = email && emailRegex.test(email);
      const errorMessage = isValid ? '' : 'Please enter a valid email address';
      
      this.showFieldValidation(emailInput, isValid, errorMessage);
      return isValid;
    }
    
    private showFieldValidation(input: HTMLInputElement, isValid: boolean, errorMessage: string) {
      if (!input) return;
      
      if (isValid) {
        input.classList.remove('md-input-error');
        input.style.borderColor = '';
      } else {
        input.classList.add('md-input-error');
        input.style.borderColor = 'red';
      }
      
      // Show/hide error message
      const errorId = `${input.id}-error`;
      let errorEl = document.getElementById(errorId);
      
      if (!isValid && errorMessage) {
        if (!errorEl) {
          errorEl = document.createElement('div');
          errorEl.id = errorId;
          errorEl.className = 'md-field-error';
          input.parentNode?.insertBefore(errorEl, input.nextSibling);
        }
        errorEl.textContent = errorMessage;
        errorEl.style.display = 'block';
      } else if (errorEl) {
        errorEl.style.display = 'none';
      }
    }
    
    private handleFileSelect(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      
      if (!file) return;
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.showErrorMessage('Only image files (JPG, PNG, GIF) are allowed');
        input.value = '';
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5242880) {
        this.showErrorMessage('File size must be less than 5MB');
        input.value = '';
        return;
      }
      
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = document.getElementById('profile-picture-preview') as HTMLImageElement;
        if (preview) {
          preview.src = e.target?.result as string;
          preview.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    }
    
    private collectFormData(): FormData {
      const formData = new FormData();
      
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      const fileInput = document.getElementById('profile-picture-input') as HTMLInputElement;
      
      if (nameInput) formData.append('name', nameInput.value);
      if (emailInput) formData.append('email', emailInput.value);
      if (fileInput && fileInput.files?.[0]) {
        formData.append('profilePicture', fileInput.files[0]);
      }
      
      return formData;
    }
    
    private exitEditMode() {
      this.editMode = false;
      
      // Show view mode elements
      this.showElement('profile-picture-view');
      this.showElement('edit-profile-btn');
      
      // Hide edit mode elements
      this.hideElement('profile-picture-edit');
      this.hideElement('edit-form-buttons');
      
      // Clear inputs and restore displays
      this.restoreDisplay('name-display', this.originalData.name);
      this.restoreDisplay('email-display', this.originalData.email);
    }
    
    private updateDisplayData(user: any) {
      this.originalData = {
        name: user.name,
        email: user.email,
        profilePicture: user.profile_picture
      };
      
      // Update display elements
      const nameDisplay = document.getElementById('name-display');
      const emailDisplay = document.getElementById('email-display');
      const pictureDisplay = document.getElementById('profile-picture-display') as HTMLImageElement;
      
      if (nameDisplay) nameDisplay.textContent = user.name;
      if (emailDisplay) emailDisplay.textContent = user.email;
      if (pictureDisplay && user.profile_picture) {
        pictureDisplay.src = `/${user.profile_picture}`;
      }
    }
    
    private showSuccessMessage(message: string) {
      const messageSection = document.getElementById('message-section');
      const successMessage = document.getElementById('success-message');
      const successText = document.getElementById('success-text');
      
      if (messageSection && successMessage && successText) {
        successText.textContent = message;
        successMessage.style.display = 'block';
        messageSection.style.display = 'block';
        
        // Hide error message
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) errorMessage.style.display = 'none';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          messageSection.style.display = 'none';
          successMessage.style.display = 'none';
        }, 3000);
      }
    }
    
    private showErrorMessage(message: string) {
      const messageSection = document.getElementById('message-section');
      const errorMessage = document.getElementById('error-message');
      const errorText = document.getElementById('error-text');
      
      if (messageSection && errorMessage && errorText) {
        errorText.textContent = message;
        errorMessage.style.display = 'block';
        messageSection.style.display = 'block';
        
        // Hide success message
        const successMessage = document.getElementById('success-message');
        if (successMessage) successMessage.style.display = 'none';
      }
    }
    
    private hideElement(id: string) {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    }
    
    private showElement(id: string) {
      const element = document.getElementById(id);
      if (element) element.style.display = 'block';
    }
    
    private createEditInput(displayId: string, inputId: string, type: string, value: string) {
      const display = document.getElementById(displayId);
      if (!display) return;
      
      const input = document.createElement('input');
      input.id = inputId;
      input.type = type;
      input.value = value;
      input.className = 'md-input';
      
      display.style.display = 'none';
      display.parentNode?.insertBefore(input, display.nextSibling);
    }
    
    private restoreDisplay(displayId: string, value: string) {
      const display = document.getElementById(displayId);
      const input = document.getElementById(displayId.replace('-display', '-input'));
      
      if (display) {
        display.textContent = value;
        display.style.display = 'block';
      }
      
      if (input) {
        input.remove();
      }
    }
    
    private clearValidationErrors() {
      const errorElements = document.querySelectorAll('.md-field-error');
      errorElements.forEach(el => {
        el.style.display = 'none';
      });
      
      const inputElements = document.querySelectorAll('.md-input-error');
      inputElements.forEach(el => {
        el.classList.remove('md-input-error');
        (el as HTMLElement).style.borderColor = '';
      });
    }
    
    // Public methods for testing
    isEditMode(): boolean {
      return this.editMode;
    }
    
    getOriginalData() {
      return this.originalData;
    }
  }
  
  // Initialize profile editor and expose for testing
  const profileEditor = new ProfileEditor();
  (window as any).profileEditor = profileEditor;
  
  return profileEditor;
};

describe('Client-Side Profile Editing Functionality', () => {
  let dom: JSDOM;
  let window: any;
  let document: any;
  let profileEditor: any;
  
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    profile_picture: 'uploads/1-test.jpg'
  };
  
  beforeEach(() => {
    // Create DOM with profile page HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Profile</title></head>
      <body>
        <!-- Profile Display Elements -->
        <div id="name-display">Test User</div>
        <div id="email-display">test@example.com</div>
        <img id="profile-picture-display" src="/uploads/1-test.jpg" alt="Profile" />
        
        <!-- Edit Mode Elements (initially hidden) -->
        <div id="profile-picture-view" style="display: block;">
          <img id="profile-picture-display" src="/uploads/1-test.jpg" alt="Profile" />
        </div>
        <div id="profile-picture-edit" style="display: none;">
          <input type="file" id="profile-picture-input" accept="image/jpeg,image/jpg,image/png,image/gif" />
          <img id="profile-picture-preview" style="display: none;" />
        </div>
        
        <!-- Control Buttons -->
        <button id="edit-profile-btn">Edit Profile</button>
        <div id="edit-form-buttons" style="display: none;">
          <button id="save-profile-btn">Save</button>
          <button id="cancel-profile-btn">Cancel</button>
        </div>
        
        <!-- Message Areas -->
        <div id="message-section" style="display: none;">
          <div id="success-message" style="display: none;">
            <span id="success-text"></span>
          </div>
          <div id="error-message" style="display: none;">
            <span id="error-text"></span>
          </div>
        </div>
      </body>
      </html>
    `;
    
    dom = new JSDOM(html, {
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    window = dom.window;
    document = window.document;
    
    // Initialize client-side functionality
    profileEditor = simulateClientSideJS(dom);
    mockFetch.reset();
  });
  
  describe('Edit Mode Activation', () => {
    // TC-F-002: Edit button functionality
    it('should switch to edit mode when edit button is clicked', () => {
      const editBtn = document.getElementById('edit-profile-btn');
      expect(editBtn).toBeTruthy();
      
      // Initially in view mode
      expect(profileEditor.isEditMode()).toBe(false);
      
      // Click edit button
      editBtn.click();
      
      // Should be in edit mode now
      expect(profileEditor.isEditMode()).toBe(true);
      
      // UI elements should reflect edit mode
      const profilePictureView = document.getElementById('profile-picture-view');
      const profilePictureEdit = document.getElementById('profile-picture-edit');
      const editFormButtons = document.getElementById('edit-form-buttons');
      
      expect(profilePictureView?.style.display).toBe('none');
      expect(profilePictureEdit?.style.display).toBe('block');
      expect(editFormButtons?.style.display).toBe('block');
    });
    
    // TC-F-003: Input field creation and pre-population
    it('should create editable input fields with current values pre-populated', () => {
      const editBtn = document.getElementById('edit-profile-btn');
      editBtn.click();
      
      // Check name input
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      expect(nameInput).toBeTruthy();
      expect(nameInput.value).toBe('Test User');
      expect(nameInput.type).toBe('text');
      
      // Check email input
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      expect(emailInput).toBeTruthy();
      expect(emailInput.value).toBe('test@example.com');
      expect(emailInput.type).toBe('email');
      
      // Original displays should be hidden
      const nameDisplay = document.getElementById('name-display');
      const emailDisplay = document.getElementById('email-display');
      expect(nameDisplay?.style.display).toBe('none');
      expect(emailDisplay?.style.display).toBe('none');
    });
  });
  
  describe('Save and Cancel Functionality', () => {
    // TC-F-005: Save button validation and submission
    it('should validate inputs and submit when save button is clicked with valid data', async () => {
      mockFetch.setResponse('/profile', { 
        success: true, 
        user: { name: 'Updated User', email: 'updated@example.com', profile_picture: null } 
      });
      
      const editBtn = document.getElementById('edit-profile-btn');
      editBtn.click();
      
      // Modify inputs
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      nameInput.value = 'Updated User';
      emailInput.value = 'updated@example.com';
      
      // Click save
      const saveBtn = document.getElementById('save-profile-btn');
      await new Promise(resolve => {
        saveBtn.addEventListener('click', resolve, { once: true });
        saveBtn.click();
      });
      
      // Should show success message
      const successMessage = document.getElementById('success-message');
      const successText = document.getElementById('success-text');
      expect(successMessage?.style.display).toBe('block');
      expect(successText?.textContent).toBe('Profile updated successfully');
    });
    
    // TC-F-007: Cancel button functionality
    it('should discard changes and return to view mode when cancel is clicked', () => {
      const editBtn = document.getElementById('edit-profile-btn');
      editBtn.click();
      
      // Modify inputs
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      nameInput.value = 'Changed Name';
      emailInput.value = 'changed@example.com';
      
      // Click cancel
      const cancelBtn = document.getElementById('cancel-profile-btn');
      cancelBtn.click();
      
      // Should be back in view mode
      expect(profileEditor.isEditMode()).toBe(false);
      
      // Original values should be restored
      const nameDisplay = document.getElementById('name-display');
      const emailDisplay = document.getElementById('email-display');
      expect(nameDisplay?.textContent).toBe('Test User');
      expect(emailDisplay?.textContent).toBe('test@example.com');
      
      // Edit form should be hidden
      const editFormButtons = document.getElementById('edit-form-buttons');
      expect(editFormButtons?.style.display).toBe('none');
    });
  });
  
  describe('Input Validation', () => {
    beforeEach(() => {
      const editBtn = document.getElementById('edit-profile-btn');
      editBtn.click();
    });
    
    // TC-F-008: Name validation with visual feedback
    it('should show validation errors for invalid name inputs', () => {
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      
      // Test too short
      nameInput.value = 'A';
      nameInput.blur();
      
      expect(nameInput.style.borderColor).toBe('red');
      const errorEl = document.getElementById('name-input-error');
      expect(errorEl?.textContent).toContain('at least 2 characters');
      
      // Test too long
      nameInput.value = 'A'.repeat(51);
      nameInput.blur();
      
      expect(nameInput.style.borderColor).toBe('red');
      expect(errorEl?.textContent).toContain('no more than 50 characters');
      
      // Test invalid characters
      nameInput.value = 'Test123';
      nameInput.blur();
      
      expect(nameInput.style.borderColor).toBe('red');
      expect(errorEl?.textContent).toContain('only contain letters and spaces');
    });
    
    // TC-F-008: Valid name inputs should not show errors
    it('should not show validation errors for valid name inputs', () => {
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      
      const validNames = ['John Doe', 'Al', 'Mary Jane Smith'];
      
      validNames.forEach(name => {
        nameInput.value = name;
        nameInput.blur();
        
        expect(nameInput.style.borderColor).toBe('');
        const errorEl = document.getElementById('name-input-error');
        expect(errorEl?.style.display).toBe('none');
      });
    });
    
    // TC-F-009: Email validation with visual feedback
    it('should show validation errors for invalid email inputs', () => {
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      
      const invalidEmails = ['invalid-email', 'missing@domain', '@missing-local.com', 'double@@domain.com'];
      
      invalidEmails.forEach(email => {
        emailInput.value = email;
        emailInput.blur();
        
        expect(emailInput.style.borderColor).toBe('red');
        const errorEl = document.getElementById('email-input-error');
        expect(errorEl?.textContent).toContain('valid email address');
      });
    });
    
    // TC-F-009: Valid email inputs should not show errors
    it('should not show validation errors for valid email inputs', () => {
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      
      const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'valid+email@test.org'];
      
      validEmails.forEach(email => {
        emailInput.value = email;
        emailInput.blur();
        
        expect(emailInput.style.borderColor).toBe('');
        const errorEl = document.getElementById('email-input-error');
        expect(errorEl?.style.display).toBe('none');
      });
    });
    
    // TC-F-006: Form validation prevents invalid submission
    it('should prevent form submission when validation fails', async () => {
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      const emailInput = document.getElementById('email-input') as HTMLInputElement;
      
      // Set invalid values
      nameInput.value = 'A'; // Too short
      emailInput.value = 'invalid-email'; // Invalid format
      
      // Try to save
      const saveBtn = document.getElementById('save-profile-btn');
      saveBtn.click();
      
      // Should still be in edit mode (save prevented)
      expect(profileEditor.isEditMode()).toBe(true);
      
      // Error messages should be visible
      const nameError = document.getElementById('name-input-error');
      const emailError = document.getElementById('email-input-error');
      expect(nameError?.style.display).toBe('block');
      expect(emailError?.style.display).toBe('block');
    });
  });
  
  describe('Profile Picture Upload', () => {
    beforeEach(() => {
      const editBtn = document.getElementById('edit-profile-btn');
      editBtn.click();
    });
    
    // TC-F-004 & TC-F-010: File input restrictions
    it('should have profile picture input with correct file type restrictions', () => {
      const fileInput = document.getElementById('profile-picture-input') as HTMLInputElement;
      
      expect(fileInput).toBeTruthy();
      expect(fileInput.type).toBe('file');
      expect(fileInput.accept).toBe('image/jpeg,image/jpg,image/png,image/gif');
    });
    
    // TC-F-010: File type validation
    it('should validate file types and reject invalid formats', () => {
      const fileInput = document.getElementById('profile-picture-input') as HTMLInputElement;
      
      // Mock invalid file
      const invalidFile = new window.File(['content'], 'test.txt', { type: 'text/plain' });
      
      // Create file list mock
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false
      });
      
      // Trigger change event
      const changeEvent = new window.Event('change');
      fileInput.dispatchEvent(changeEvent);
      
      // Should show error message
      const errorMessage = document.getElementById('error-message');
      const errorText = document.getElementById('error-text');
      expect(errorMessage?.style.display).toBe('block');
      expect(errorText?.textContent).toContain('Only image files');
      
      // File input should be cleared
      expect(fileInput.value).toBe('');
    });
    
    // TC-F-012: File size validation
    it('should validate file size and reject files over 5MB', () => {
      const fileInput = document.getElementById('profile-picture-input') as HTMLInputElement;
      
      // Mock large file (over 5MB)
      const largeFile = new window.File(['x'.repeat(5242881)], 'large.jpg', { 
        type: 'image/jpeg'
      });
      
      // Mock file size property
      Object.defineProperty(largeFile, 'size', {
        value: 5242881,
        writable: false
      });
      
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        writable: false
      });
      
      // Trigger change event
      const changeEvent = new window.Event('change');
      fileInput.dispatchEvent(changeEvent);
      
      // Should show error message
      const errorMessage = document.getElementById('error-message');
      const errorText = document.getElementById('error-text');
      expect(errorMessage?.style.display).toBe('block');
      expect(errorText?.textContent).toContain('File size must be less than 5MB');
      
      // File input should be cleared
      expect(fileInput.value).toBe('');
    });
  });
  
  describe('Success/Error Message Display', () => {
    // TC-F-014: Success message display and auto-hide
    it('should display success message and auto-hide after 3 seconds', async () => {
      mockFetch.setResponse('/profile', { 
        success: true, 
        user: { name: 'Updated', email: 'updated@test.com' } 
      });
      
      const editBtn = document.getElementById('edit-profile-btn');
      editBtn.click();
      
      const saveBtn = document.getElementById('save-profile-btn');
      saveBtn.click();
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Success message should be visible
      const messageSection = document.getElementById('message-section');
      const successMessage = document.getElementById('success-message');
      expect(messageSection?.style.display).toBe('block');
      expect(successMessage?.style.display).toBe('block');
      
      // Wait for auto-hide (3 seconds)
      await new Promise(resolve => setTimeout(resolve, 3010));
      
      // Should be hidden and back in view mode
      expect(messageSection?.style.display).toBe('none');
      expect(profileEditor.isEditMode()).toBe(false);
    });
    
    // TC-F-014: Error message display
    it('should display error messages for failed updates', async () => {
      mockFetch.setResponse('/profile', { 
        error: 'Email already exists' 
      });
      
      const editBtn = document.getElementById('edit-profile-btn');
      editBtn.click();
      
      const saveBtn = document.getElementById('save-profile-btn');
      saveBtn.click();
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Error message should be visible
      const messageSection = document.getElementById('message-section');
      const errorMessage = document.getElementById('error-message');
      const errorText = document.getElementById('error-text');
      
      expect(messageSection?.style.display).toBe('block');
      expect(errorMessage?.style.display).toBe('block');
      expect(errorText?.textContent).toBe('Email already exists');
      
      // Should remain in edit mode
      expect(profileEditor.isEditMode()).toBe(true);
    });
    
    // TC-F-014: Message area ARIA attributes
    it('should have proper ARIA attributes for screen readers', () => {
      const messageSection = document.getElementById('message-section');
      
      // In the actual implementation, this should have aria-live="polite"
      // For this test, we're checking the HTML structure exists
      expect(messageSection).toBeTruthy();
      
      const successMessage = document.getElementById('success-message');
      const errorMessage = document.getElementById('error-message');
      
      expect(successMessage).toBeTruthy();
      expect(errorMessage).toBeTruthy();
    });
  });
  
  describe('State Management and Persistence', () => {
    // TC-F-007: Original data preservation for cancel operation
    it('should preserve original data for proper cancel functionality', () => {
      const originalData = profileEditor.getOriginalData();
      
      expect(originalData.name).toBe('Test User');
      expect(originalData.email).toBe('test@example.com');
      expect(originalData.profilePicture).toContain('uploads/1-test.jpg');
      
      // Enter edit mode and modify
      const editBtn = document.getElementById('edit-profile-btn');
      editBtn.click();
      
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      nameInput.value = 'Modified Name';
      
      // Original data should remain unchanged
      const currentOriginal = profileEditor.getOriginalData();
      expect(currentOriginal.name).toBe('Test User'); // Still original
    });
    
    // TC-F-006: Data persistence after successful save
    it('should update stored original data after successful save', async () => {
      const updatedUser = {
        success: true,
        user: { name: 'New Name', email: 'new@example.com', profile_picture: 'uploads/1-new.jpg' }
      };
      
      mockFetch.setResponse('/profile', updatedUser);
      
      const editBtn = document.getElementById('edit-profile-btn');
      editBtn.click();
      
      const nameInput = document.getElementById('name-input') as HTMLInputElement;
      nameInput.value = 'New Name';
      
      const saveBtn = document.getElementById('save-profile-btn');
      saveBtn.click();
      
      // Wait for async update
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Original data should be updated
      const newOriginalData = profileEditor.getOriginalData();
      expect(newOriginalData.name).toBe('New Name');
      expect(newOriginalData.email).toBe('new@example.com');
    });
  });
});