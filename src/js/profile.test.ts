import { JSDOM } from 'jsdom';

describe('Profile Page Client-Side Functionality', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  
  const mockProfileScript = `
    (function() {
      let originalName = '';
      let isEditing = false;
      
      function initializeProfile() {
        const nameInput = document.getElementById('name');
        const cancelBtn = document.getElementById('cancel-btn');
        const saveBtn = document.getElementById('save-btn');
        const profileForm = document.getElementById('profile-form');
        const passwordForm = document.getElementById('password-form');
        
        if (nameInput) {
          originalName = nameInput.value;
          
          nameInput.addEventListener('focus', function() {
            isEditing = true;
            this.classList.add('editing');
          });
          
          nameInput.addEventListener('input', function() {
            const hasChanges = this.value.trim() !== originalName;
            saveBtn.disabled = !hasChanges || this.value.trim().length < 2;
          });
        }
        
        if (cancelBtn) {
          cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            cancelEdit();
          });
        }
        
        if (profileForm) {
          profileForm.addEventListener('submit', function(e) {
            const nameInput = document.getElementById('name');
            if (nameInput && nameInput.value.trim() === originalName) {
              e.preventDefault();
              return false;
            }
          });
        }
        
        if (passwordForm) {
          passwordForm.addEventListener('submit', function(e) {
            const currentPassword = document.getElementById('currentPassword');
            const newPassword = document.getElementById('newPassword');
            
            if (!currentPassword.value || !newPassword.value) {
              e.preventDefault();
              return false;
            }
          });
        }
        
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && isEditing) {
            cancelEdit();
          }
        });
      }
      
      function cancelEdit() {
        const nameInput = document.getElementById('name');
        if (nameInput) {
          nameInput.value = originalName;
          nameInput.classList.remove('editing');
          nameInput.blur();
          isEditing = false;
          
          const saveBtn = document.getElementById('save-btn');
          if (saveBtn) {
            saveBtn.disabled = true;
          }
        }
      }
      
      // Initialize when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeProfile);
      } else {
        initializeProfile();
      }
      
      window.profileTest = {
        cancelEdit: cancelEdit,
        getOriginalName: function() { return originalName; },
        isEditing: function() { return isEditing; }
      };
    })();
  `;
  
  beforeEach(() => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Profile</title>
      </head>
      <body>
        <form id="profile-form">
          <input type="text" id="name" name="name" value="Test User">
          <button type="button" id="cancel-btn">Cancel</button>
          <button type="submit" id="save-btn" disabled>Save</button>
        </form>
        
        <form id="password-form">
          <input type="password" id="currentPassword" name="currentPassword">
          <input type="password" id="newPassword" name="newPassword">
          <button type="submit">Change Password</button>
        </form>
        
        <script>${mockProfileScript}</script>
      </body>
      </html>
    `;
    
    dom = new JSDOM(html, { 
      runScripts: 'dangerously',
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window as unknown as Window;
  });
  
  afterEach(() => {
    dom.window.close();
  });
  
  // TC-F-002
  it('should enable inline editing when name field is focused or clicked', (done) => {
    setTimeout(() => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      
      // Simulate focus event
      const focusEvent = new dom.window.Event('focus');
      nameInput.dispatchEvent(focusEvent);
      
      expect(nameInput.classList.contains('editing')).toBe(true);
      expect((window as any).profileTest.isEditing()).toBe(true);
      done();
    }, 100);
  });
  
  // TC-F-008, TC-F-023
  it('should cancel edit mode and revert to original values when cancel button is clicked or escape key is pressed', (done) => {
    setTimeout(() => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
      const originalValue = nameInput.value;
      
      // Start editing
      nameInput.focus();
      nameInput.value = 'Changed Name';
      
      // Click cancel
      cancelBtn.click();
      
      expect(nameInput.value).toBe(originalValue);
      expect(nameInput.classList.contains('editing')).toBe(false);
      expect((window as any).profileTest.isEditing()).toBe(false);
      
      // Test escape key
      nameInput.focus();
      nameInput.value = 'Another Change';
      
      const escapeEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      expect(nameInput.value).toBe(originalValue);
      done();
    }, 100);
  });
  
  // TC-F-003, TC-F-004
  it('should validate name field is not empty and meets minimum character requirements', (done) => {
    setTimeout(() => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
      
      // Test empty name
      nameInput.value = '';
      const inputEvent = new dom.window.Event('input');
      nameInput.dispatchEvent(inputEvent);
      
      expect(saveBtn.disabled).toBe(true);
      
      // Test single character
      nameInput.value = 'A';
      nameInput.dispatchEvent(inputEvent);
      
      expect(saveBtn.disabled).toBe(true);
      
      // Test valid name (2+ characters)
      nameInput.value = 'Valid Name';
      nameInput.dispatchEvent(inputEvent);
      
      expect(saveBtn.disabled).toBe(false);
      done();
    }, 100);
  });
  
  // TC-F-022
  it('should prevent submission of unchanged data', (done) => {
    setTimeout(() => {
      const profileForm = document.getElementById('profile-form') as HTMLFormElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      let submitPrevented = false;
      
      // Mock form submission
      profileForm.addEventListener('submit', (e) => {
        if (e.defaultPrevented) {
          submitPrevented = true;
        }
      });
      
      // Try to submit without changes
      const submitEvent = new dom.window.Event('submit', { cancelable: true });
      profileForm.dispatchEvent(submitEvent);
      
      expect(submitPrevented).toBe(true);
      done();
    }, 100);
  });
  
  // TC-F-015
  it('should only allow password form submission when both fields are completed', (done) => {
    setTimeout(() => {
      const passwordForm = document.getElementById('password-form') as HTMLFormElement;
      const currentPassword = document.getElementById('currentPassword') as HTMLInputElement;
      const newPassword = document.getElementById('newPassword') as HTMLInputElement;
      let submitPrevented = false;
      
      passwordForm.addEventListener('submit', (e) => {
        if (e.defaultPrevented) {
          submitPrevented = true;
        }
      });
      
      // Test with only current password
      currentPassword.value = 'currentpass';
      newPassword.value = '';
      
      let submitEvent = new dom.window.Event('submit', { cancelable: true });
      passwordForm.dispatchEvent(submitEvent);
      
      expect(submitPrevented).toBe(true);
      
      // Reset
      submitPrevented = false;
      
      // Test with only new password
      currentPassword.value = '';
      newPassword.value = 'newpass';
      
      submitEvent = new dom.window.Event('submit', { cancelable: true });
      passwordForm.dispatchEvent(submitEvent);
      
      expect(submitPrevented).toBe(true);
      
      // Reset
      submitPrevented = false;
      
      // Test with both passwords
      currentPassword.value = 'currentpass';
      newPassword.value = 'newpass';
      
      submitEvent = new dom.window.Event('submit', { cancelable: true });
      passwordForm.dispatchEvent(submitEvent);
      
      expect(submitPrevented).toBe(false);
      done();
    }, 100);
  });
  
  it('should save button state based on form validation', (done) => {
    setTimeout(() => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
      const originalValue = nameInput.value;
      
      // Save button should be disabled initially
      expect(saveBtn.disabled).toBe(true);
      
      // Change to valid value
      nameInput.value = 'New Valid Name';
      const inputEvent = new dom.window.Event('input');
      nameInput.dispatchEvent(inputEvent);
      
      expect(saveBtn.disabled).toBe(false);
      
      // Change back to original value
      nameInput.value = originalValue;
      nameInput.dispatchEvent(inputEvent);
      
      expect(saveBtn.disabled).toBe(true);
      done();
    }, 100);
  });
  
  it('should initialize profile functionality when DOM is ready', (done) => {
    setTimeout(() => {
      // Verify that profile test object is available
      expect((window as any).profileTest).toBeDefined();
      expect(typeof (window as any).profileTest.cancelEdit).toBe('function');
      expect(typeof (window as any).profileTest.getOriginalName).toBe('function');
      expect(typeof (window as any).profileTest.isEditing).toBe('function');
      
      // Verify original name is captured
      expect((window as any).profileTest.getOriginalName()).toBe('Test User');
      done();
    }, 100);
  });
  
  it('should handle focus and blur states for name input', (done) => {
    setTimeout(() => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      
      // Focus should start editing mode
      const focusEvent = new dom.window.Event('focus');
      nameInput.dispatchEvent(focusEvent);
      
      expect((window as any).profileTest.isEditing()).toBe(true);
      expect(nameInput.classList.contains('editing')).toBe(true);
      
      // Cancel should exit editing and blur
      (window as any).profileTest.cancelEdit();
      
      expect((window as any).profileTest.isEditing()).toBe(false);
      expect(nameInput.classList.contains('editing')).toBe(false);
      done();
    }, 100);
  });
});