import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('ProfileEditor', () => {
  let window: any;
  let document: any;
  let profileEditor: any;
  
  beforeEach(() => {
    // Setup DOM
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- View Mode Elements -->
          <div id="profileViewMode">
            <div id="profileName">John Doe</div>
            <div id="profileEmail">john@example.com</div>
            <img id="profilePicture" src="/uploads/default.jpg" alt="Profile">
            <button id="editProfileBtn">Edit Profile</button>
          </div>
          
          <!-- Edit Mode Elements -->
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
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    window = dom.window;
    document = window.document;
    
    // Setup global objects
    global.window = window;
    global.document = document;
    global.FileReader = class {
      readAsDataURL() {
        this.onload({ target: { result: 'data:image/png;base64,test' } });
      }
    };
    global.FormData = class {
      private data: Map<string, any> = new Map();
      append(key: string, value: any) {
        this.data.set(key, value);
      }
      get(key: string) {
        return this.data.get(key);
      }
    };
    global.fetch = jest.fn();
    
    // Load ProfileEditor class
    const profileEditorCode = fs.readFileSync(
      path.join(__dirname, '../../public/js/profile-edit.js'),
      'utf8'
    );
    
    // Execute the code in the context of our window
    const script = new window.Function(profileEditorCode);
    script.call(window);
    
    // Create instance
    profileEditor = new window.ProfileEditor();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Profile View Mode', () => {
    test('should display profile information in read-only format by default', () => {
      // TC-F-001: User can view their current profile information in read-only format
      const viewMode = document.getElementById('profileViewMode');
      const editMode = document.getElementById('profileEditMode');
      
      expect(viewMode.style.display).not.toBe('none');
      expect(editMode.style.display).toBe('none');
      expect(document.getElementById('profileName').textContent).toBe('John Doe');
      expect(document.getElementById('profileEmail').textContent).toBe('john@example.com');
      expect(document.getElementById('profilePicture').src).toBe('http://localhost:3000/uploads/default.jpg');
    });
    
    test('should show edit button when in view mode', () => {
      // TC-F-002: User can click an Edit Profile button to switch to edit mode
      const editBtn = document.getElementById('editProfileBtn');
      const editButtons = document.getElementById('profileEditButtons');
      
      expect(editBtn.style.display).not.toBe('none');
      expect(editButtons.style.display).toBe('none');
    });
  });
  
  describe('Profile Edit Mode Activation', () => {
    test('should switch to edit mode when edit button is clicked', () => {
      // TC-F-002: User can click an Edit Profile button to switch to edit mode
      const editBtn = document.getElementById('editProfileBtn');
      
      editBtn.click();
      
      const viewMode = document.getElementById('profileViewMode');
      const editMode = document.getElementById('profileEditMode');
      const editButtons = document.getElementById('profileEditButtons');
      
      expect(viewMode.style.display).toBe('none');
      expect(editMode.style.display).toBe('block');
      expect(editBtn.style.display).toBe('none');
      expect(editButtons.style.display).toBe('block');
    });
    
    test('should pre-populate form fields with current values in edit mode', () => {
      // TC-F-003: Name and email fields become editable with current values pre-populated
      const editBtn = document.getElementById('editProfileBtn');
      
      editBtn.click();
      
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      
      expect(nameInput.value).toBe('John Doe');
      expect(emailInput.value).toBe('john@example.com');
    });
    
    test('should focus on name input when entering edit mode', () => {
      // TC-F-003: Enhanced UX with proper focus management
      const editBtn = document.getElementById('editProfileBtn');
      const nameInput = document.getElementById('nameInput');
      
      jest.spyOn(nameInput, 'focus');
      
      editBtn.click();
      
      expect(nameInput.focus).toHaveBeenCalled();
    });
    
    test('should show profile picture upload functionality in edit mode', () => {
      // TC-F-004: Profile picture upload functionality available in edit mode
      const editBtn = document.getElementById('editProfileBtn');
      
      editBtn.click();
      
      const fileInput = document.getElementById('profilePictureInput');
      expect(fileInput).toBeTruthy();
      expect(fileInput.type).toBe('file');
      expect(fileInput.accept).toBe('image/*');
    });
    
    test('should show save and cancel buttons in edit mode', () => {
      // TC-F-005: Save and Cancel buttons are visible and functional in edit mode
      const editBtn = document.getElementById('editProfileBtn');
      
      editBtn.click();
      
      const saveBtn = document.getElementById('saveProfileBtn');
      const cancelBtn = document.getElementById('cancelProfileBtn');
      const editButtons = document.getElementById('profileEditButtons');
      
      expect(editButtons.style.display).toBe('block');
      expect(saveBtn).toBeTruthy();
      expect(cancelBtn).toBeTruthy();
    });
  });
  
  describe('Form Validation', () => {
    beforeEach(() => {
      const editBtn = document.getElementById('editProfileBtn');
      editBtn.click(); // Enter edit mode
    });
    
    test('should validate name field minimum length requirement', () => {
      // TC-F-008: Name field validation enforces 2-50 character length requirement
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      
      nameInput.value = 'A';
      nameInput.dispatchEvent(new window.Event('blur'));
      
      const nameError = document.getElementById('nameError');
      expect(nameError.textContent).toContain('Name must be at least 2 characters');
      expect(nameInput.classList.contains('error') || nameInput.style.borderColor === 'red').toBeTruthy();
    });
    
    test('should validate name field maximum length requirement', () => {
      // TC-F-008: Name field validation enforces 2-50 character length requirement
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      
      nameInput.value = 'A'.repeat(51);
      nameInput.dispatchEvent(new window.Event('blur'));
      
      const nameError = document.getElementById('nameError');
      expect(nameError.textContent).toContain('Name must not exceed 50 characters');
    });
    
    test('should validate name field character pattern requirement', () => {
      // TC-F-008: Name field validation enforces letters and spaces only
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      
      nameInput.value = 'John123';
      nameInput.dispatchEvent(new window.Event('blur'));
      
      const nameError = document.getElementById('nameError');
      expect(nameError.textContent).toContain('Name must be 2-50 characters and contain only letters and spaces');
    });
    
    test('should validate email field format requirement', () => {
      // TC-F-009: Email field validation enforces valid email format
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      
      emailInput.value = 'invalid-email';
      emailInput.dispatchEvent(new window.Event('blur'));
      
      const emailError = document.getElementById('emailError');
      expect(emailError.textContent).toContain('Please enter a valid email address');
    });
    
    test('should clear validation errors on input events', () => {
      // TC-F-008/009: Real-time validation feedback
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      
      nameInput.value = 'A';
      nameInput.dispatchEvent(new window.Event('blur'));
      
      const nameError = document.getElementById('nameError');
      expect(nameError.textContent).toBeTruthy();
      
      nameInput.dispatchEvent(new window.Event('input'));
      expect(nameError.textContent).toBe('');
    });
    
    test('should accept valid name with letters and spaces', () => {
      // TC-F-008: Valid name input acceptance
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      
      nameInput.value = 'John Doe Smith';
      nameInput.dispatchEvent(new window.Event('blur'));
      
      const nameError = document.getElementById('nameError');
      expect(nameError.textContent).toBe('');
    });
    
    test('should accept valid email format', () => {
      // TC-F-009: Valid email input acceptance
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      
      emailInput.value = 'john.doe@example.com';
      emailInput.dispatchEvent(new window.Event('blur'));
      
      const emailError = document.getElementById('emailError');
      expect(emailError.textContent).toBe('');
    });
  });
  
  describe('Profile Picture Upload', () => {
    beforeEach(() => {
      const editBtn = document.getElementById('editProfileBtn');
      editBtn.click(); // Enter edit mode
    });
    
    test('should validate file type restrictions for profile picture', () => {
      // TC-F-010: Profile picture uploads restricted to common image formats
      const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true
      });
      
      fileInput.dispatchEvent(new window.Event('change'));
      
      const error = document.getElementById('profilePictureError');
      expect(error.textContent).toContain('Only JPG, JPEG, PNG, and GIF files are allowed');
    });
    
    test('should validate file size limit for profile picture', () => {
      // TC-F-012: Profile picture file size limited to 5MB
      const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
      const file = new File(['x'.repeat(6 * 1024 * 1024)], 'test.jpg', { type: 'image/jpeg' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true
      });
      
      fileInput.dispatchEvent(new window.Event('change'));
      
      const error = document.getElementById('profilePictureError');
      expect(error.textContent).toContain('File size must not exceed 5MB');
    });
    
    test('should accept valid image files', () => {
      // TC-F-010: Valid image file acceptance
      const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
      const file = new File(['image-content'], 'test.jpg', { type: 'image/jpeg' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true
      });
      
      fileInput.dispatchEvent(new window.Event('change'));
      
      const error = document.getElementById('profilePictureError');
      const preview = document.getElementById('profilePicturePreview');
      
      expect(error.textContent).toBe('');
      expect(preview.style.display).toBe('block');
    });
    
    test('should validate file extension restrictions', () => {
      // TC-F-010: File extension validation
      const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
      const file = new File(['content'], 'test.bmp', { type: 'image/bmp' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true
      });
      
      fileInput.dispatchEvent(new window.Event('change'));
      
      const error = document.getElementById('profilePictureError');
      expect(error.textContent).toContain('Invalid file extension. Use JPG, JPEG, PNG, or GIF');
    });
    
    test('should clear preview when invalid file is selected', () => {
      // TC-F-010: Invalid file handling
      const fileInput = document.getElementById('profilePictureInput') as HTMLInputElement;
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        configurable: true
      });
      
      fileInput.dispatchEvent(new window.Event('change'));
      
      expect(fileInput.value).toBe('');
    });
  });
  
  describe('Keyboard Shortcuts', () => {
    beforeEach(() => {
      const editBtn = document.getElementById('editProfileBtn');
      editBtn.click(); // Enter edit mode
    });
    
    test('should cancel edit mode when ESC key is pressed', () => {
      // TC-F-007: Enhanced UX with keyboard shortcuts
      const escEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);
      
      const viewMode = document.getElementById('profileViewMode');
      const editMode = document.getElementById('profileEditMode');
      
      expect(viewMode.style.display).toBe('block');
      expect(editMode.style.display).toBe('none');
    });
    
    test('should save when Ctrl+S is pressed', () => {
      // TC-F-006: Enhanced UX with keyboard shortcuts
      const ctrlSEvent = new window.KeyboardEvent('keydown', { 
        key: 's',
        ctrlKey: true
      });
      
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      nameInput.value = 'John Smith';
      emailInput.value = 'john.smith@example.com';
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, user: { name: 'John Smith', email: 'john.smith@example.com' } })
      });
      
      document.dispatchEvent(ctrlSEvent);
      
      expect(global.fetch).toHaveBeenCalledWith('/profile', expect.objectContaining({
        method: 'POST'
      }));
    });
  });
  
  describe('Cancel Functionality', () => {
    test('should discard changes and return to view mode when cancel is clicked', () => {
      // TC-F-007: Cancel discards unsaved changes and returns to read-only view
      const editBtn = document.getElementById('editProfileBtn');
      editBtn.click();
      
      const nameInput = document.getElementById('nameInput') as HTMLInputElement;
      const emailInput = document.getElementById('emailInput') as HTMLInputElement;
      
      // Make changes
      nameInput.value = 'Changed Name';
      emailInput.value = 'changed@example.com';
      
      const cancelBtn = document.getElementById('cancelProfileBtn');
      cancelBtn.click();
      
      // Should be back in view mode
      const viewMode = document.getElementById('profileViewMode');
      const editMode = document.getElementById('profileEditMode');
      
      expect(viewMode.style.display).toBe('block');
      expect(editMode.style.display).toBe('none');
      
      // Original values should be preserved
      expect(document.getElementById('profileName').textContent).toBe('John Doe');
      expect(document.getElementById('profileEmail').textContent).toBe('john@example.com');
    });
  });
});
