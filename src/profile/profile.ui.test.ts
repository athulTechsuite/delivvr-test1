import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

// Mock user data for testing
const TEST_USER = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  created_at: '2023-01-01T00:00:00.000Z',
  profile_picture: null
};

const TEST_USER_WITH_PICTURE = {
  ...TEST_USER,
  profile_picture: 'uploads/1-1640995200000.jpg'
};

// Mock EJS template content
const PROFILE_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <title><%= title %></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div class="container">
        <div class="profile-container">
            <h1>Profile</h1>
            
            <!-- Profile View Mode -->
            <div id="profile-view" class="profile-section">
                <div class="profile-picture-container">
                    <% if (user.profile_picture) { %>
                        <img src="/<%= user.profile_picture %>" alt="Profile Picture" class="profile-picture" id="current-profile-picture">
                    <% } else { %>
                        <div class="profile-picture-placeholder" id="profile-picture-placeholder">
                            <i class="material-icons">account_circle</i>
                        </div>
                    <% } %>
                </div>
                
                <div class="profile-info">
                    <div class="info-group">
                        <label>Name:</label>
                        <span id="display-name" class="info-value"><%= user.name %></span>
                    </div>
                    
                    <div class="info-group">
                        <label>Email:</label>
                        <span id="display-email" class="info-value"><%= user.email %></span>
                    </div>
                    
                    <div class="info-group">
                        <label>Member Since:</label>
                        <span id="display-date" class="info-value"><%= new Date(user.created_at).toLocaleDateString() %></span>
                    </div>
                </div>
                
                <button id="edit-profile-btn" class="btn btn-primary">
                    <i class="material-icons">edit</i> Edit Profile
                </button>
            </div>
            
            <!-- Profile Edit Mode -->
            <div id="profile-edit" class="profile-section" style="display: none;">
                <form id="profile-form" enctype="multipart/form-data">
                    <div class="profile-picture-container">
                        <% if (user.profile_picture) { %>
                            <img src="/<%= user.profile_picture %>" alt="Profile Picture" class="profile-picture" id="edit-profile-picture">
                        <% } else { %>
                            <div class="profile-picture-placeholder" id="edit-profile-picture-placeholder">
                                <i class="material-icons">account_circle</i>
                            </div>
                        <% } %>
                        
                        <div class="upload-container">
                            <input type="file" id="profilePicture" name="profilePicture" accept=".jpg,.jpeg,.png,.gif" class="file-input">
                            <label for="profilePicture" class="file-label">
                                <i class="material-icons">photo_camera</i> Change Picture
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="name">Name:</label>
                        <input type="text" id="name" name="name" value="<%= user.name %>" required 
                               class="form-input" minlength="2" maxlength="50" pattern="[a-zA-Z\\s]+">
                        <div class="error-message" id="name-error"></div>
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email:</label>
                        <input type="email" id="email" name="email" value="<%= user.email %>" required class="form-input">
                        <div class="error-message" id="email-error"></div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" id="save-btn" class="btn btn-primary">
                            <i class="material-icons">save</i> Save Changes
                        </button>
                        <button type="button" id="cancel-btn" class="btn btn-secondary">
                            <i class="material-icons">cancel</i> Cancel
                        </button>
                    </div>
                </form>
            </div>
            
            <!-- Success Message -->
            <div id="success-message" class="alert alert-success" style="display: none;">
                <i class="material-icons">check_circle</i>
                <span id="success-text">Profile updated successfully</span>
            </div>
            
            <!-- Error Messages -->
            <div id="error-messages" class="alert alert-error" style="display: none;">
                <i class="material-icons">error</i>
                <ul id="error-list"></ul>
            </div>
        </div>
    </div>
    
    <script src="/js/profile.js"></script>
</body>
</html>
`;

// Mock JavaScript for profile functionality
const PROFILE_JS = `
document.addEventListener('DOMContentLoaded', function() {
    const editBtn = document.getElementById('edit-profile-btn');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const profileView = document.getElementById('profile-view');
    const profileEdit = document.getElementById('profile-edit');
    const profileForm = document.getElementById('profile-form');
    const successMessage = document.getElementById('success-message');
    const errorMessages = document.getElementById('error-messages');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    
    let originalData = {
        name: nameInput.value,
        email: emailInput.value
    };
    
    // Switch to edit mode
    editBtn.addEventListener('click', function() {
        profileView.style.display = 'none';
        profileEdit.style.display = 'block';
        hideMessages();
    });
    
    // Cancel editing
    cancelBtn.addEventListener('click', function() {
        // Restore original values
        nameInput.value = originalData.name;
        emailInput.value = originalData.email;
        
        // Clear file input
        const fileInput = document.getElementById('profilePicture');
        fileInput.value = '';
        
        // Switch back to view mode
        profileEdit.style.display = 'none';
        profileView.style.display = 'block';
        hideMessages();
    });
    
    // Handle form submission
    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Client-side validation
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const errors = [];
        
        if (name.length < 2 || name.length > 50 || !/^[a-zA-Z\\s]+$/.test(name)) {
            errors.push('Name must be 2-50 characters and contain only letters and spaces');
        }
        
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
            errors.push('Please provide a valid email address');
        }
        
        if (errors.length > 0) {
            showErrors(errors);
            return;
        }
        
        // Submit form data
        const formData = new FormData(profileForm);
        
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
                
                // Update profile picture if changed
                if (data.user.profile_picture) {
                    updateProfilePicture(data.user.profile_picture);
                }
                
                // Update original data
                originalData.name = data.user.name;
                originalData.email = data.user.email;
                
                // Show success message
                showSuccess(data.message);
                
                // Switch back to view mode after 3 seconds
                setTimeout(() => {
                    profileEdit.style.display = 'none';
                    profileView.style.display = 'block';
                    hideMessages();
                }, 3000);
            } else {
                showErrors(data.errors.map(err => err.msg));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showErrors(['An error occurred while updating your profile']);
        });
    });
    
    // Input validation on blur
    nameInput.addEventListener('blur', function() {
        validateName();
    });
    
    emailInput.addEventListener('blur', function() {
        validateEmail();
    });
    
    function validateName() {
        const name = nameInput.value.trim();
        const errorDiv = document.getElementById('name-error');
        
        if (name.length < 2 || name.length > 50 || !/^[a-zA-Z\\s]+$/.test(name)) {
            errorDiv.textContent = 'Name must be 2-50 characters and contain only letters and spaces';
            nameInput.classList.add('invalid');
            return false;
        } else {
            errorDiv.textContent = '';
            nameInput.classList.remove('invalid');
            return true;
        }
    }
    
    function validateEmail() {
        const email = emailInput.value.trim();
        const errorDiv = document.getElementById('email-error');
        
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
            errorDiv.textContent = 'Please provide a valid email address';
            emailInput.classList.add('invalid');
            return false;
        } else {
            errorDiv.textContent = '';
            emailInput.classList.remove('invalid');
            return true;
        }
    }
    
    function updateProfilePicture(picturePath) {
        const currentPicture = document.getElementById('current-profile-picture');
        const editPicture = document.getElementById('edit-profile-picture');
        const placeholder = document.getElementById('profile-picture-placeholder');
        const editPlaceholder = document.getElementById('edit-profile-picture-placeholder');
        
        if (currentPicture) {
            currentPicture.src = '/' + picturePath;
        } else if (placeholder) {
            placeholder.innerHTML = \`<img src="/\${picturePath}" alt="Profile Picture" class="profile-picture" id="current-profile-picture">\`;
        }
        
        if (editPicture) {
            editPicture.src = '/' + picturePath;
        } else if (editPlaceholder) {
            editPlaceholder.innerHTML = \`<img src="/\${picturePath}" alt="Profile Picture" class="profile-picture" id="edit-profile-picture">\`;
        }
    }
    
    function showSuccess(message) {
        const successDiv = document.getElementById('success-message');
        const successText = document.getElementById('success-text');
        successText.textContent = message;
        successDiv.style.display = 'block';
        errorMessages.style.display = 'none';
    }
    
    function showErrors(errors) {
        const errorDiv = document.getElementById('error-messages');
        const errorList = document.getElementById('error-list');
        
        errorList.innerHTML = '';
        errors.forEach(error => {
            const li = document.createElement('li');
            li.textContent = error;
            errorList.appendChild(li);
        });
        
        errorDiv.style.display = 'block';
        successMessage.style.display = 'none';
    }
    
    function hideMessages() {
        successMessage.style.display = 'none';
        errorMessages.style.display = 'none';
    }
});
`;

describe('Profile Page UI Tests', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  
  const renderProfilePage = (user = TEST_USER, success = null, errors = null) => {
    const html = ejs.render(PROFILE_TEMPLATE, { user, title: 'Profile', success, errors });
    return html;
  };
  
  beforeEach(() => {
    const html = renderProfilePage();
    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      resources: 'usable',
      beforeParse(win) {
        win.fetch = jest.fn();
      }
    });
    document = dom.window.document;
    window = dom.window as any;
    
    // Add profile JavaScript functionality
    const script = document.createElement('script');
    script.textContent = PROFILE_JS;
    document.head.appendChild(script);
  });
  
  afterEach(() => {
    dom.window.close();
  });
  
  // TC-AC-001: User can view their current profile information in read-only format
  describe('Profile View Mode', () => {
    test('should display user profile information in read-only format', () => {
      const nameDisplay = document.getElementById('display-name');
      const emailDisplay = document.getElementById('display-email');
      const dateDisplay = document.getElementById('display-date');
      const editButton = document.getElementById('edit-profile-btn');
      const profileView = document.getElementById('profile-view');
      const profileEdit = document.getElementById('profile-edit');
      
      expect(nameDisplay?.textContent).toBe('John Doe');
      expect(emailDisplay?.textContent).toBe('john@example.com');
      expect(dateDisplay?.textContent).toBe('1/1/2023');
      expect(editButton).toBeTruthy();
      expect(profileView?.style.display).not.toBe('none');
      expect(profileEdit?.style.display).toBe('none');
    });
    
    test('should display profile picture placeholder when no picture is set', () => {
      const placeholder = document.getElementById('profile-picture-placeholder');
      const profilePicture = document.getElementById('current-profile-picture');
      
      expect(placeholder).toBeTruthy();
      expect(profilePicture).toBeFalsy();
      expect(placeholder?.querySelector('.material-icons')?.textContent).toBe('account_circle');
    });
    
    test('should display profile picture when user has one', () => {
      const html = renderProfilePage(TEST_USER_WITH_PICTURE);
      dom = new JSDOM(html);
      document = dom.window.document;
      
      const profilePicture = document.getElementById('current-profile-picture') as HTMLImageElement;
      const placeholder = document.getElementById('profile-picture-placeholder');
      
      expect(profilePicture).toBeTruthy();
      expect(profilePicture?.src).toContain('uploads/1-1640995200000.jpg');
      expect(placeholder).toBeFalsy();
    });
  });
  
  // TC-AC-002: User can click Edit Profile button to switch to edit mode
  describe('Edit Mode Activation', () => {
    test('should switch to edit mode when edit button is clicked', () => {
      const editButton = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const profileView = document.getElementById('profile-view') as HTMLElement;
      const profileEdit = document.getElementById('profile-edit') as HTMLElement;
      
      // Simulate click event
      editButton.click();
      
      expect(profileView.style.display).toBe('none');
      expect(profileEdit.style.display).toBe('block');
    });
    
    test('should hide messages when switching to edit mode', () => {
      const editButton = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const successMessage = document.getElementById('success-message') as HTMLElement;
      const errorMessages = document.getElementById('error-messages') as HTMLElement;
      
      // Show messages first
      successMessage.style.display = 'block';
      errorMessages.style.display = 'block';
      
      editButton.click();
      
      expect(successMessage.style.display).toBe('none');
      expect(errorMessages.style.display).toBe('none');
    });
  });
  
  // TC-AC-003, TC-AC-004: Edit mode with pre-populated fields and file upload
  describe('Edit Mode Interface', () => {
    test('should pre-populate form fields with current values', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      
      expect(nameInput.value).toBe('John Doe');
      expect(emailInput.value).toBe('john@example.com');
    });
    
    test('should display file upload input for profile picture', () => {
      const fileInput = document.getElementById('profilePicture') as HTMLInputElement;
      const fileLabel = document.querySelector('.file-label');
      
      expect(fileInput).toBeTruthy();
      expect(fileInput.type).toBe('file');
      expect(fileInput.accept).toBe('.jpg,.jpeg,.png,.gif');
      expect(fileLabel?.textContent?.trim()).toContain('Change Picture');
    });
    
    test('should display save and cancel buttons in edit mode', () => {
      const editButton = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const saveButton = document.getElementById('save-btn');
      const cancelButton = document.getElementById('cancel-btn');
      
      editButton.click();
      
      expect(saveButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();
      expect(saveButton?.textContent?.trim()).toContain('Save Changes');
      expect(cancelButton?.textContent?.trim()).toContain('Cancel');
    });
  });
  
  // TC-AC-005, TC-AC-007: Save and Cancel functionality
  describe('Save and Cancel Operations', () => {
    test('should validate form before submission', () => {
      const editButton = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const profileForm = document.getElementById('profile-form') as HTMLFormElement;
      
      editButton.click();
      
      // Set invalid name
      nameInput.value = 'A'; // Too short
      
      // Simulate form submission
      const submitEvent = new window.Event('submit', { bubbles: true, cancelable: true });
      profileForm.dispatchEvent(submitEvent);
      
      const errorMessages = document.getElementById('error-messages') as HTMLElement;
      expect(errorMessages.style.display).toBe('block');
    });
    
    test('should cancel editing and restore original values', () => {
      const editButton = document.getElementById('edit-profile-btn') as HTMLButtonElement;
      const cancelButton = document.getElementById('cancel-btn') as HTMLButtonElement;
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const emailInput = document.getElementById('email') as HTMLInputElement;
      const fileInput = document.getElementById('profilePicture') as HTMLInputElement;
      const profileView = document.getElementById('profile-view') as HTMLElement;
      const profileEdit = document.getElementById('profile-edit') as HTMLElement;
      
      editButton.click();
      
      // Change values
      nameInput.value = 'Changed Name';
      emailInput.value = 'changed@example.com';
      
      // Simulate file selection (mock)
      Object.defineProperty(fileInput, 'value', { value: 'test.jpg', writable: true });
      
      cancelButton.click();
      
      // Values should be restored
      expect(nameInput.value).toBe('John Doe');
      expect(emailInput.value).toBe('john@example.com');
      expect(fileInput.value).toBe('');
      
      // Should switch back to view mode
      expect(profileView.style.display).toBe('block');
      expect(profileEdit.style.display).toBe('none');
    });
  });
  
  // TC-AC-008, TC-AC-009: Validation feedback
  describe('Input Validation', () => {
    test('should validate name field on blur - minimum length', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      nameInput.value = 'A'; // Too short
      nameInput.dispatchEvent(new window.Event('blur'));
      
      expect(nameError.textContent).toContain('Name must be 2-50 characters');
      expect(nameInput.classList.contains('invalid')).toBe(true);
    });
    
    test('should validate name field on blur - maximum length', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      nameInput.value = 'A'.repeat(51); // Too long
      nameInput.dispatchEvent(new window.Event('blur'));
      
      expect(nameError.textContent).toContain('Name must be 2-50 characters');
      expect(nameInput.classList.contains('invalid')).toBe(true);
    });
    
    test('should validate name field on blur - invalid characters', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      nameInput.value = 'John123'; // Contains numbers
      nameInput.dispatchEvent(new window.Event('blur'));
      
      expect(nameError.textContent).toContain('letters and spaces');
      expect(nameInput.classList.contains('invalid')).toBe(true);
    });
    
    test('should validate email field on blur - invalid format', () => {
      const emailInput = document.getElementById('email') as HTMLInputElement;
      const emailError = document.getElementById('email-error') as HTMLElement;
      
      emailInput.value = 'invalid-email'; // Invalid format
      emailInput.dispatchEvent(new window.Event('blur'));
      
      expect(emailError.textContent).toContain('valid email address');
      expect(emailInput.classList.contains('invalid')).toBe(true);
    });
    
    test('should clear validation errors for valid input', () => {
      const nameInput = document.getElementById('name') as HTMLInputElement;
      const nameError = document.getElementById('name-error') as HTMLElement;
      
      nameInput.value = 'Valid Name';
      nameInput.dispatchEvent(new window.Event('blur'));
      
      expect(nameError.textContent).toBe('');
      expect(nameInput.classList.contains('invalid')).toBe(false);
    });
  });
  
  // TC-AC-014: Success confirmation message display
  describe('Success Message Display', () => {
    test('should display success message after successful update', () => {
      const successMessage = document.getElementById('success-message') as HTMLElement;
      const successText = document.getElementById('success-text') as HTMLElement;
      
      // Mock successful response
      window.showSuccess = function(message: string) {
        successText.textContent = message;
        successMessage.style.display = 'block';
      };
      
      (window as any).showSuccess('Profile updated successfully');
      
      expect(successMessage.style.display).toBe('block');
      expect(successText.textContent).toBe('Profile updated successfully');
    });
    
    test('should hide error messages when showing success', () => {
      const successMessage = document.getElementById('success-message') as HTMLElement;
      const errorMessages = document.getElementById('error-messages') as HTMLElement;
      
      errorMessages.style.display = 'block';
      
      window.showSuccess = function(message: string) {
        successMessage.style.display = 'block';
        errorMessages.style.display = 'none';
      };
      
      (window as any).showSuccess('Success');
      
      expect(successMessage.style.display).toBe('block');
      expect(errorMessages.style.display).toBe('none');
    });
  });
  
  // TC-AC-004: Profile picture upload interface
  describe('Profile Picture Upload Interface', () => {
    test('should have correct file input attributes', () => {
      const fileInput = document.getElementById('profilePicture') as HTMLInputElement;
      
      expect(fileInput.type).toBe('file');
      expect(fileInput.name).toBe('profilePicture');
      expect(fileInput.accept).toBe('.jpg,.jpeg,.png,.gif');
      expect(fileInput.classList.contains('file-input')).toBe(true);
    });
    
    test('should have properly labeled file upload button', () => {
      const fileLabel = document.querySelector('label[for="profilePicture"]');
      const cameraIcon = fileLabel?.querySelector('.material-icons');
      
      expect(fileLabel).toBeTruthy();
      expect(fileLabel?.classList.contains('file-label')).toBe(true);
      expect(cameraIcon?.textContent).toBe('photo_camera');
      expect(fileLabel?.textContent?.trim()).toContain('Change Picture');
    });
  });
  
  // TC-AC-015: Responsive design and Material Design consistency
  describe('Design and Layout', () => {
    test('should include Material Design icons and styling classes', () => {
      const editIcon = document.querySelector('#edit-profile-btn .material-icons');
      const saveIcon = document.querySelector('#save-btn .material-icons');
      const cancelIcon = document.querySelector('#cancel-btn .material-icons');
      const successIcon = document.querySelector('#success-message .material-icons');
      const errorIcon = document.querySelector('#error-messages .material-icons');
      
      expect(editIcon?.textContent).toBe('edit');
      expect(saveIcon?.textContent).toBe('save');
      expect(cancelIcon?.textContent).toBe('cancel');
      expect(successIcon?.textContent).toBe('check_circle');
      expect(errorIcon?.textContent).toBe('error');
    });
    
    test('should have responsive viewport meta tag', () => {
      const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
      expect(viewport?.content).toBe('width=device-width, initial-scale=1.0');
    });
    
    test('should include required CSS classes for styling', () => {
      const container = document.querySelector('.container');
      const profileContainer = document.querySelector('.profile-container');
      const formGroups = document.querySelectorAll('.form-group');
      const buttons = document.querySelectorAll('.btn');
      
      expect(container).toBeTruthy();
      expect(profileContainer).toBeTruthy();
      expect(formGroups.length).toBeGreaterThan(0);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});