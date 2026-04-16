import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('ProfileEditor Save Functionality', () => {
  let window: any;
  let document: any;
  let profileEditor: any;
  let mockFetch: jest.Mock;
  
  beforeEach(() => {
    // Setup DOM
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="profileViewMode">
            <div id="profileName">John Doe</div>
            <div id="profileEmail">john@example.com</div>
            <img id="profilePicture" src="/uploads/default.jpg" alt="Profile">
            <button id="editProfileBtn">Edit Profile</button>
          </div>
          
          <div id="profileEditMode" style="display: none;">
            <input id="nameInput" type="text">
            <div id="nameError" class="error-message"></div>
            <input id="emailInput" type="email">
            <div id="emailError" class="error-message"></div>
            <input id="profilePictureInput" type="file" accept="image/*">
            <div id="profilePictureError" class="error-message"></div>
            <img id="profilePicturePreview" style="display: none;">
            <div id="profileEditButtons" style="display: none;">
              <button id="saveProfileBtn">Save</button>
              <button id="cancelProfileBtn">Cancel</button>
            </div>
          </div>
          
          <div id="messageContainer"></div>
          <div id="loadingIndicator" style="display: none;">Saving...</div>
        </body>
      </html>
    `);
    
    window = dom.window;
    document = window.document;
    
    global.window = window;
    global.document = document;
    global.FormData = class {
      private data: Map<string, any> = new Map();
      append(key: string, value: any) {
        this.data.set(key, value);
      }
      get(key: string) {
        return this.data.get(key);
      }
    };
    
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    
    // Load ProfileEditor class
    const profileEditorCode = fs.readFileSync(
      path.join(__dirname, '../../public/js/profile-edit.js'),
      'utf8'
    );
    
    const script = new window.Function(profileEditorCode);
    script.call(window);
    
    profileEditor = new window.ProfileEditor();
    
    // Enter edit mode
    const editBtn = document.getElementById('editProfileBtn');
    editBtn.click();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Save Validation', () => {
    test('should prevent save when validation fails', async () => {
      // TC-F-006: Save validates all inputs before persisting changes
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      // Invalid name
      nameInput.value = 'A';
      
      await saveBtn.click();
      
      expect(mockFetch).not.toHaveBeenCalled();
      
      const messageContainer = document.getElementById('messageContainer');
      expect(messageContainer.textContent).toContain('Please fix the validation errors');
    });
    
    test('should validate all fields before submission', async () => {
      // TC-F-006: Comprehensive validation before save
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'A'; // Invalid
      emailInput.value = 'invalid-email'; // Invalid
      
      await saveBtn.click();
      
      expect(mockFetch).not.toHaveBeenCalled();
      
      const nameError = document.getElementById('nameError');
      const emailError = document.getElementById('emailError');
      
      expect(nameError.textContent).toBeTruthy();
      expect(emailError.textContent).toBeTruthy();
    });
  });
  
  describe('Successful Save', () => {
    test('should submit valid form data and update profile display', async () => {
      // TC-F-006: Save validates and persists changes to database when validation passes
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane.smith@example.com';
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            profilePicture: '/uploads/123-1640995200000.jpg'
          }
        })
      });
      
      await saveBtn.click();
      
      expect(mockFetch).toHaveBeenCalledWith('/profile', {
        method: 'POST',
        body: expect.any(window.FormData),
        credentials: 'same-origin'
      });
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Should update display values
      expect(document.getElementById('profileName').textContent).toBe('Jane Smith');
      expect(document.getElementById('profileEmail').textContent).toBe('jane.smith@example.com');
    });
    
    test('should display success confirmation message after save', async () => {
      // TC-F-014: Success confirmation message displayed on same page after update
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane.smith@example.com';
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: { name: 'Jane Smith', email: 'jane.smith@example.com' }
        })
      });
      
      await saveBtn.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const messageContainer = document.getElementById('messageContainer');
      expect(messageContainer.textContent).toContain('Profile updated successfully');
      expect(messageContainer.classList.contains('success')).toBeTruthy();
    });
    
    test('should return to view mode after successful save', async () => {
      // TC-F-014: Auto-switch to view mode after successful save
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane.smith@example.com';
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: { name: 'Jane Smith', email: 'jane.smith@example.com' }
        })
      });
      
      await saveBtn.click();
      
      // Wait for async operations and auto-switch delay
      await new Promise(resolve => setTimeout(resolve, 3100));
      
      const viewMode = document.getElementById('profileViewMode');
      const editMode = document.getElementById('profileEditMode');
      
      expect(viewMode.style.display).toBe('block');
      expect(editMode.style.display).toBe('none');
    });
    
    test('should include profile picture in form data when file is selected', async () => {
      // TC-F-011: Profile pictures stored with unique filenames
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane.smith@example.com';
      
      const file = new File(['image-content'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true
      });
      fileInput.dispatchEvent(new window.Event('change'));
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          user: {
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            profilePicture: '/uploads/123-1640995200000.jpg'
          }
        })
      });
      
      await saveBtn.click();
      
      expect(mockFetch).toHaveBeenCalledWith('/profile', {
        method: 'POST',
        body: expect.any(window.FormData),
        credentials: 'same-origin'
      });
      
      const formData = mockFetch.mock.calls[0][1].body;
      expect(formData.get('name')).toBe('Jane Smith');
      expect(formData.get('email')).toBe('jane.smith@example.com');
      expect(formData.get('profilePicture')).toBe(file);
    });
  });
  
  describe('Save Error Handling', () => {
    test('should handle server validation errors', async () => {
      // TC-F-006: Error handling for server validation failures
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane.smith@example.com';
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          message: 'Email already exists'
        })
      });
      
      await saveBtn.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const messageContainer = document.getElementById('messageContainer');
      expect(messageContainer.textContent).toContain('Email already exists');
      expect(messageContainer.classList.contains('error')).toBeTruthy();
    });
    
    test('should handle network errors', async () => {
      // TC-F-006: Error handling for network failures
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane.smith@example.com';
      
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await saveBtn.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const messageContainer = document.getElementById('messageContainer');
      expect(messageContainer.textContent).toContain('Network error');
    });
    
    test('should handle server errors without JSON response', async () => {
      // TC-F-006: Error handling for malformed server responses
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane.smith@example.com';
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });
      
      await saveBtn.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const messageContainer = document.getElementById('messageContainer');
      expect(messageContainer.textContent).toContain('Server error: 500');
    });
    
    test('should remain in edit mode after save error', async () => {
      // TC-F-006: Stay in edit mode when save fails
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane.smith@example.com';
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Error' })
      });
      
      await saveBtn.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const viewMode = document.getElementById('profileViewMode');
      const editMode = document.getElementById('profileEditMode');
      
      expect(viewMode.style.display).toBe('none');
      expect(editMode.style.display).toBe('block');
    });
  });
  
  describe('Loading State', () => {
    test('should show loading state during save operation', async () => {
      // TC-F-006: Loading state feedback during save
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      const saveBtn = document.getElementById('saveProfileBtn');
      
      nameInput.value = 'Jane Smith';
      emailInput.value = 'jane.smith@example.com';
      
      let resolvePromise: () => void;
      const savePromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      
      mockFetch.mockReturnValue(savePromise.then(() => ({
        ok: true,
        json: () => Promise.resolve({ success: true, user: {} })
      })));
      
      saveBtn.click();
      
      // Should show loading immediately
      expect(saveBtn.disabled).toBe(true);
      
      resolvePromise!();
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(saveBtn.disabled).toBe(false);
    });
  });
});
