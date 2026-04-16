import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

// Mock profile template content
const PROFILE_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <title>Profile - <%= title %></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="/css/style.css">
    <style>
        .profile-container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .profile-view { display: block; }
        .profile-edit { display: none; }
        .edit-active .profile-view { display: none; }
        .edit-active .profile-edit { display: block; }
        .form-group { margin-bottom: 15px; }
        .error { color: red; font-size: 12px; margin-top: 5px; }
        .success { color: green; padding: 10px; margin-bottom: 15px; border: 1px solid green; background: #f0fff0; }
        .profile-picture { width: 150px; height: 150px; border-radius: 50%; object-fit: cover; }
        .file-upload { margin: 10px 0; }
        .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .invalid { border: 2px solid red; }
    </style>
</head>
<body>
    <div class="profile-container" id="profileContainer">
        <h1>My Profile</h1>
        
        <!-- Success Message -->
        <div id="successMessage" class="success" style="display: none;"></div>
        
        <!-- Profile View Mode -->
        <div class="profile-view" id="profileView">
            <div class="profile-picture-section">
                <% if (user.profile_picture) { %>
                    <img src="/<%= user.profile_picture %>" alt="Profile Picture" class="profile-picture" id="profileImage">
                <% } else { %>
                    <img src="/images/default-avatar.png" alt="Default Avatar" class="profile-picture" id="profileImage">
                <% } %>
            </div>
            
            <div class="profile-info">
                <p><strong>Name:</strong> <span id="displayName"><%= user.name %></span></p>
                <p><strong>Email:</strong> <span id="displayEmail"><%= user.email %></span></p>
                <p><strong>Member Since:</strong> <%= new Date(user.created_at).toLocaleDateString() %></p>
            </div>
            
            <button type="button" class="btn btn-primary" id="editButton" onclick="enableEditMode()">Edit Profile</button>
        </div>
        
        <!-- Profile Edit Mode -->
        <div class="profile-edit" id="profileEdit">
            <form id="profileForm" enctype="multipart/form-data">
                <div class="profile-picture-section">
                    <div class="current-picture">
                        <% if (user.profile_picture) { %>
                            <img src="/<%= user.profile_picture %>" alt="Current Profile Picture" class="profile-picture" id="currentProfileImage">
                        <% } else { %>
                            <img src="/images/default-avatar.png" alt="Default Avatar" class="profile-picture" id="currentProfileImage">
                        <% } %>
                    </div>
                    
                    <div class="form-group file-upload">
                        <label for="profilePicture">Upload New Profile Picture:</label>
                        <input type="file" id="profilePicture" name="profilePicture" accept="image/*" onchange="previewImage()">
                        <div id="profilePictureError" class="error"></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="name">Name:</label>
                    <input type="text" id="name" name="name" value="<%= user.name %>" required 
                           pattern="^[a-zA-Z\\s]+$" minlength="2" maxlength="50"
                           onblur="validateName()">
                    <div id="nameError" class="error"></div>
                </div>
                
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" value="<%= user.email %>" required
                           onblur="validateEmail()">
                    <div id="emailError" class="error"></div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary" id="saveButton">Save Changes</button>
                    <button type="button" class="btn btn-secondary" id="cancelButton" onclick="cancelEdit()">Cancel</button>
                </div>
            </form>
        </div>
    </div>
    
    <script>
        let originalData = {
            name: '<%= user.name %>',
            email: '<%= user.email %>',
            profilePicture: '<%= user.profile_picture || "" %>'
        };
        
        function enableEditMode() {
            document.getElementById('profileContainer').classList.add('edit-active');
        }
        
        function cancelEdit() {
            // Reset form values to original
            document.getElementById('name').value = originalData.name;
            document.getElementById('email').value = originalData.email;
            document.getElementById('profilePicture').value = '';
            
            // Clear errors
            clearErrors();
            
            // Return to view mode
            document.getElementById('profileContainer').classList.remove('edit-active');
        }
        
        function clearErrors() {
            document.getElementById('nameError').textContent = '';
            document.getElementById('emailError').textContent = '';
            document.getElementById('profilePictureError').textContent = '';
            
            document.getElementById('name').classList.remove('invalid');
            document.getElementById('email').classList.remove('invalid');
            document.getElementById('profilePicture').classList.remove('invalid');
        }
        
        function validateName() {
            const nameInput = document.getElementById('name');
            const nameError = document.getElementById('nameError');
            const name = nameInput.value.trim();
            
            if (name.length < 2 || name.length > 50) {
                nameError.textContent = 'Name must be between 2 and 50 characters';
                nameInput.classList.add('invalid');
                return false;
            }
            
            if (!/^[a-zA-Z\\s]+$/.test(name)) {
                nameError.textContent = 'Name can only contain letters and spaces';
                nameInput.classList.add('invalid');
                return false;
            }
            
            nameError.textContent = '';
            nameInput.classList.remove('invalid');
            return true;
        }
        
        function validateEmail() {
            const emailInput = document.getElementById('email');
            const emailError = document.getElementById('emailError');
            const email = emailInput.value.trim();
            
            if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
                emailError.textContent = 'Please enter a valid email address';
                emailInput.classList.add('invalid');
                return false;
            }
            
            emailError.textContent = '';
            emailInput.classList.remove('invalid');
            return true;
        }
        
        function validateFile() {
            const fileInput = document.getElementById('profilePicture');
            const fileError = document.getElementById('profilePictureError');
            const file = fileInput.files[0];
            
            if (!file) return true; // File is optional
            
            // Check file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                fileError.textContent = 'Only JPG, JPEG, PNG, and GIF files are allowed';
                fileInput.classList.add('invalid');
                return false;
            }
            
            // Check file size (5MB = 5242880 bytes)
            if (file.size > 5242880) {
                fileError.textContent = 'File size must be less than 5MB';
                fileInput.classList.add('invalid');
                return false;
            }
            
            fileError.textContent = '';
            fileInput.classList.remove('invalid');
            return true;
        }
        
        function previewImage() {
            const fileInput = document.getElementById('profilePicture');
            const currentImage = document.getElementById('currentProfileImage');
            const file = fileInput.files[0];
            
            if (file && validateFile()) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
        
        function showSuccess(message) {
            const successDiv = document.getElementById('successMessage');
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            
            setTimeout(() => {
                successDiv.style.display = 'none';
                document.getElementById('profileContainer').classList.remove('edit-active');
            }, 3000);
        }
        
        // Form submission
        document.getElementById('profileForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Validate all fields
            const isNameValid = validateName();
            const isEmailValid = validateEmail();
            const isFileValid = validateFile();
            
            if (!isNameValid || !isEmailValid || !isFileValid) {
                return false;
            }
            
            // Submit form data
            const formData = new FormData(this);
            
            try {
                const response = await fetch('/profile', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // Update displayed values
                    document.getElementById('displayName').textContent = result.user.name;
                    document.getElementById('displayEmail').textContent = result.user.email;
                    
                    if (result.user.profile_picture) {
                        document.getElementById('profileImage').src = '/' + result.user.profile_picture;
                    }
                    
                    // Update original data
                    originalData = {
                        name: result.user.name,
                        email: result.user.email,
                        profilePicture: result.user.profile_picture || ''
                    };
                    
                    showSuccess(result.message);
                } else {
                    // Handle errors
                    if (result.errors) {
                        result.errors.forEach(error => {
                            if (error.path === 'name') {
                                document.getElementById('nameError').textContent = error.msg;
                                document.getElementById('name').classList.add('invalid');
                            } else if (error.path === 'email') {
                                document.getElementById('emailError').textContent = error.msg;
                                document.getElementById('email').classList.add('invalid');
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('An error occurred while updating your profile. Please try again.');
            }
        });
    </script>
</body>
</html>
`;

describe('Profile Interface - UI Components and Interactions', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  
  const mockUser = {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    profile_picture: null,
    created_at: '2023-01-01T00:00:00.000Z'
  };
  
  const mockUserWithPicture = {
    ...mockUser,
    profile_picture: 'uploads/1-1640995200000.jpg'
  };
  
  beforeEach(() => {
    // Render template with mock user data
    const html = ejs.render(PROFILE_TEMPLATE, { 
      user: mockUser, 
      title: 'Profile'
    });
    
    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      resources: 'usable'
    });
    
    document = dom.window.document;
    window = dom.window;
    
    // Mock fetch API
    (global as any).fetch = jest.fn();
  });
  
  afterEach(() => {
    dom.window.close();
    jest.restoreAllMocks();
  });
  
  describe('Profile View Mode Display', () => {
    // TC-UI-001
    it('should display user profile information in read-only format by default', () => {
      const profileView = document.getElementById('profileView');
      const profileEdit = document.getElementById('profileEdit');
      
      expect(profileView?.style.display).not.toBe('none');
      expect(profileEdit?.style.display).toBe('none');
      
      expect(document.getElementById('displayName')?.textContent).toBe(mockUser.name);
      expect(document.getElementById('displayEmail')?.textContent).toBe(mockUser.email);
    });
    
    // TC-UI-002
    it('should display default avatar when no profile picture exists', () => {
      const profileImage = document.getElementById('profileImage') as HTMLImageElement;
      
      expect(profileImage?.src).toContain('default-avatar.png');
      expect(profileImage?.alt).toBe('Default Avatar');
    });
    
    // TC-UI-003
    it('should display profile picture when user has one', () => {
      // Re-render with user that has profile picture
      const htmlWithPicture = ejs.render(PROFILE_TEMPLATE, { 
        user: mockUserWithPicture, 
        title: 'Profile'
      });
      
      const domWithPicture = new JSDOM(htmlWithPicture, { runScripts: 'dangerously' });
      const docWithPicture = domWithPicture.window.document;
      
      const profileImage = docWithPicture.getElementById('profileImage') as HTMLImageElement;
      
      expect(profileImage?.src).toContain(mockUserWithPicture.profile_picture);
      expect(profileImage?.alt).toBe('Profile Picture');
      
      domWithPicture.window.close();
    });
    
    // TC-UI-004
    it('should display Edit Profile button in view mode', () => {
      const editButton = document.getElementById('editButton');
      
      expect(editButton).toBeTruthy();
      expect(editButton?.textContent).toContain('Edit Profile');
      expect(editButton?.classList.contains('btn-primary')).toBe(true);
    });
    
    // TC-UI-005
    it('should display member since date in formatted manner', () => {
      const memberSinceText = document.querySelector('p:has(strong:contains("Member Since"))');
      const expectedDate = new Date(mockUser.created_at).toLocaleDateString();
      
      expect(document.body.textContent).toContain('Member Since');
      expect(document.body.textContent).toContain('2023');
    });
  });
  
  describe('Edit Mode Activation and UI Transition', () => {
    // TC-UI-006
    it('should switch to edit mode when Edit Profile button is clicked', () => {
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      const profileContainer = document.getElementById('profileContainer');
      
      editButton.click();
      
      expect(profileContainer?.classList.contains('edit-active')).toBe(true);
    });
    
    // TC-UI-007
    it('should show editable form fields with pre-populated values in edit mode', () => {
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
      
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      
      expect(nameInput?.value).toBe(mockUser.name);
      expect(emailInput?.value).toBe(mockUser.email);
      expect(nameInput?.type).toBe('text');
      expect(emailInput?.type).toBe('email');
    });
    
    // TC-UI-008
    it('should display file upload input for profile picture in edit mode', () => {
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
      
      const fileInput = document.getElementById('profilePicture') as HTMLInputElement;
      
      expect(fileInput).toBeTruthy();
      expect(fileInput?.type).toBe('file');
      expect(fileInput?.accept).toBe('image/*');
      expect(fileInput?.name).toBe('profilePicture');
    });
    
    // TC-UI-009
    it('should display Save and Cancel buttons in edit mode', () => {
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
      
      const saveButton = document.getElementById('saveButton');
      const cancelButton = document.getElementById('cancelButton');
      
      expect(saveButton?.textContent).toContain('Save Changes');
      expect(cancelButton?.textContent).toContain('Cancel');
      expect(saveButton?.classList.contains('btn-primary')).toBe(true);
      expect(cancelButton?.classList.contains('btn-secondary')).toBe(true);
    });
    
    // TC-UI-010
    it('should hide view mode elements when in edit mode', () => {
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
      
      const profileView = document.getElementById('profileView');
      const profileEdit = document.getElementById('profileEdit');
      
      expect(window.getComputedStyle(profileView!).display).toBe('none');
      expect(window.getComputedStyle(profileEdit!).display).toBe('block');
    });
  });
  
  describe('Form Validation and Error Display', () => {
    beforeEach(() => {
      // Switch to edit mode
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
    });
    
    // TC-UI-011
    it('should validate name field on blur with character length requirements', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const nameError = document.getElementById('nameError');
      
      // Test minimum length violation
      nameInput.value = 'A';
      nameInput.dispatchEvent(new dom.window.Event('blur'));
      
      expect(nameError?.textContent).toContain('between 2 and 50 characters');
      expect(nameInput.classList.contains('invalid')).toBe(true);
      
      // Test maximum length violation
      nameInput.value = 'A'.repeat(51);
      nameInput.dispatchEvent(new dom.window.Event('blur'));
      
      expect(nameError?.textContent).toContain('between 2 and 50 characters');
      expect(nameInput.classList.contains('invalid')).toBe(true);
    });
    
    // TC-UI-012
    it('should validate name field contains only letters and spaces', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const nameError = document.getElementById('nameError');
      
      nameInput.value = 'Test123';
      nameInput.dispatchEvent(new dom.window.Event('blur'));
      
      expect(nameError?.textContent).toContain('letters and spaces');
      expect(nameInput.classList.contains('invalid')).toBe(true);
    });
    
    // TC-UI-013
    it('should validate email field format on blur', () => {
      const emailInput = document.getElementById('email') as HTMLInputElement;
      const emailError = document.getElementById('emailError');
      
      emailInput.value = 'invalid-email';
      emailInput.dispatchEvent(new dom.window.Event('blur'));
      
      expect(emailError?.textContent).toContain('valid email address');
      expect(emailInput.classList.contains('invalid')).toBe(true);
    });
    
    // TC-UI-014
    it('should clear validation errors when input becomes valid', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const nameError = document.getElementById('nameError');
      
      // First make it invalid
      nameInput.value = 'A';
      nameInput.dispatchEvent(new dom.window.Event('blur'));
      expect(nameInput.classList.contains('invalid')).toBe(true);
      
      // Then make it valid
      nameInput.value = 'Valid Name';
      nameInput.dispatchEvent(new dom.window.Event('blur'));
      
      expect(nameError?.textContent).toBe('');
      expect(nameInput.classList.contains('invalid')).toBe(false);
    });
    
    // TC-UI-015
    it('should validate file upload restrictions', () => {
      const fileInput = document.getElementById('profilePicture') as HTMLInputElement;
      const fileError = document.getElementById('profilePictureError');
      
      // Mock file validation (since we can't actually upload files in JSDOM)
      const mockFile = new dom.window.File([''], 'test.txt', { type: 'text/plain' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });
      
      // Trigger validation function
      window.eval('validateFile()');
      
      expect(fileError?.textContent).toContain('Only JPG, JPEG, PNG, and GIF files are allowed');
      expect(fileInput.classList.contains('invalid')).toBe(true);
    });
  });
  
  describe('Cancel Functionality', () => {
    beforeEach(() => {
      // Switch to edit mode
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
    });
    
    // TC-UI-016
    it('should discard changes and return to view mode when Cancel is clicked', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      const cancelButton = document.getElementById('cancelButton') as HTMLButtonElement;
      const profileContainer = document.getElementById('profileContainer');
      
      // Modify form values
      nameInput.value = 'Changed Name';
      emailInput.value = 'changed@example.com';
      
      // Click cancel
      cancelButton.click();
      
      // Should return to view mode
      expect(profileContainer?.classList.contains('edit-active')).toBe(false);
      
      // Values should be reset to original
      expect(nameInput.value).toBe(mockUser.name);
      expect(emailInput.value).toBe(mockUser.email);
    });
    
    // TC-UI-017
    it('should clear any validation errors when Cancel is clicked', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const nameError = document.getElementById('nameError');
      const cancelButton = document.getElementById('cancelButton') as HTMLButtonElement;
      
      // Create validation error
      nameInput.value = 'A';
      nameInput.dispatchEvent(new dom.window.Event('blur'));
      expect(nameInput.classList.contains('invalid')).toBe(true);
      
      // Click cancel
      cancelButton.click();
      
      // Errors should be cleared
      expect(nameError?.textContent).toBe('');
      expect(nameInput.classList.contains('invalid')).toBe(false);
    });
  });
  
  describe('Form Submission and Success Handling', () => {
    beforeEach(() => {
      // Switch to edit mode
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
    });
    
    // TC-UI-018
    it('should prevent form submission if validation fails', async () => {
      const form = document.getElementById('profileForm') as HTMLFormElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      
      // Set invalid data
      nameInput.value = 'A'; // Too short
      
      const submitEvent = new dom.window.Event('submit', { cancelable: true });
      const preventDefaultSpy = jest.spyOn(submitEvent, 'preventDefault');
      
      form.dispatchEvent(submitEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect((global as any).fetch).not.toHaveBeenCalled();
    });
    
    // TC-UI-019
    it('should submit form data via fetch API when validation passes', async () => {
      const form = document.getElementById('profileForm') as HTMLFormElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      
      // Mock successful response
      (global as any).fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Profile updated successfully',
          user: { name: 'Valid Name', email: 'valid@example.com', profile_picture: null }
        })
      });
      
      // Set valid data
      nameInput.value = 'Valid Name';
      emailInput.value = 'valid@example.com';
      
      const submitEvent = new dom.window.Event('submit', { cancelable: true });
      form.dispatchEvent(submitEvent);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect((global as any).fetch).toHaveBeenCalledWith('/profile', {
        method: 'POST',
        body: expect.any(dom.window.FormData)
      });
    });
    
    // TC-UI-020
    it('should display success message and update UI after successful submission', async () => {
      const successMessage = document.getElementById('successMessage');
      const displayName = document.getElementById('displayName');
      const displayEmail = document.getElementById('displayEmail');
      
      // Mock successful response
      const updatedUser = {
        name: 'Updated Name',
        email: 'updated@example.com',
        profile_picture: 'uploads/1-123456789.jpg'
      };
      
      (global as any).fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          message: 'Profile updated successfully',
          user: updatedUser
        })
      });
      
      // Trigger form submission with valid data
      const form = document.getElementById('profileForm') as HTMLFormElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      
      nameInput.value = updatedUser.name;
      emailInput.value = updatedUser.email;
      
      const submitEvent = new dom.window.Event('submit', { cancelable: true });
      form.dispatchEvent(submitEvent);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(successMessage?.textContent).toBe('Profile updated successfully');
      expect(successMessage?.style.display).toBe('block');
      expect(displayName?.textContent).toBe(updatedUser.name);
      expect(displayEmail?.textContent).toBe(updatedUser.email);
    });
    
    // TC-UI-021
    it('should auto-switch to view mode after 3 seconds of success message', (done) => {
      const profileContainer = document.getElementById('profileContainer');
      
      // Manually trigger success message display
      window.eval(`showSuccess('Test success message')`);
      
      expect(profileContainer?.classList.contains('edit-active')).toBe(true);
      
      // Check after 3.1 seconds
      setTimeout(() => {
        expect(profileContainer?.classList.contains('edit-active')).toBe(false);
        done();
      }, 3100);
    }, 4000);
  });
  
  describe('Responsive Design and Accessibility', () => {
    // TC-UI-022
    it('should have proper responsive viewport meta tag', () => {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      
      expect(viewportMeta?.getAttribute('content')).toContain('width=device-width');
      expect(viewportMeta?.getAttribute('content')).toContain('initial-scale=1.0');
    });
    
    // TC-UI-023
    it('should have proper form labels associated with inputs', () => {
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
      
      const nameLabel = document.querySelector('label[for="name"]');
      const emailLabel = document.querySelector('label[for="email"]');
      const fileLabel = document.querySelector('label[for="profilePicture"]');
      
      expect(nameLabel?.textContent).toContain('Name');
      expect(emailLabel?.textContent).toContain('Email');
      expect(fileLabel?.textContent).toContain('Upload New Profile Picture');
    });
    
    // TC-UI-024
    it('should have proper alt attributes for images', () => {
      const profileImage = document.getElementById('profileImage') as HTMLImageElement;
      
      expect(profileImage?.alt).toBeTruthy();
      expect(profileImage?.alt).toMatch(/(Default Avatar|Profile Picture)/);
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    // TC-UI-025
    it('should handle network errors gracefully during form submission', async () => {
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
      
      // Mock network error
      (global as any).fetch.mockRejectedValue(new Error('Network error'));
      
      const form = document.getElementById('profileForm') as HTMLFormElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      
      nameInput.value = 'Valid Name';
      emailInput.value = 'valid@example.com';
      
      // Mock alert to check if error is handled
      window.alert = jest.fn();
      
      const submitEvent = new dom.window.Event('submit', { cancelable: true });
      form.dispatchEvent(submitEvent);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('An error occurred while updating your profile')
      );
    });
    
    // TC-UI-026
    it('should handle server validation errors in response', async () => {
      const editButton = document.getElementById('editButton') as HTMLButtonElement;
      editButton.click();
      
      // Mock server validation error response
      (global as any).fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          errors: [
            { path: 'name', msg: 'Name is required' },
            { path: 'email', msg: 'Email already in use' }
          ]
        })
      });
      
      const form = document.getElementById('profileForm') as HTMLFormElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      
      nameInput.value = 'Valid Name';
      emailInput.value = 'existing@example.com';
      
      const submitEvent = new dom.window.Event('submit', { cancelable: true });
      form.dispatchEvent(submitEvent);
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const nameError = document.getElementById('nameError');
      const emailError = document.getElementById('emailError');
      
      expect(nameError?.textContent).toBe('Name is required');
      expect(emailError?.textContent).toBe('Email already in use');
      expect(nameInput.classList.contains('invalid')).toBe(true);
      expect(emailInput.classList.contains('invalid')).toBe(true);
    });
  });
});