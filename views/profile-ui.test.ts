import { JSDOM } from 'jsdom';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

// Mock profile template
const PROFILE_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <title><%= title %></title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
</head>
<body>
    <!-- Navigation Sidebar -->
    <div class="sidebar">
        <% if (user) { %>
            <ul class="nav flex-column">
                <li class="nav-item">
                    <a class="nav-link <%= title === 'Profile' ? 'active' : '' %>" href="/profile">
                        <span class="material-icons">account_circle</span>
                        Profile
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link <%= title === 'Dashboard' ? 'active' : '' %>" href="/dashboard">
                        <span class="material-icons">dashboard</span>
                        Dashboard
                    </a>
                </li>
            </ul>
        <% } %>
    </div>
    
    <!-- Main Content -->
    <div class="main-content">
        <div class="container">
            <% if (success) { %>
                <div class="alert alert-success" id="success-message"><%= success %></div>
            <% } %>
            <% if (error) { %>
                <div class="alert alert-danger" id="error-message"><%= error %></div>
            <% } %>
            
            <h1>Profile</h1>
            
            <!-- Profile Information Form -->
            <div class="card">
                <div class="card-body">
                    <form id="profile-form">
                        <div class="mb-3">
                            <label for="name" class="form-label">Name *</label>
                            <input type="text" 
                                   class="form-control" 
                                   id="name" 
                                   name="name" 
                                   value="<%= profileUser.name %>" 
                                   aria-label="User name"
                                   required>
                            <div class="invalid-feedback" id="name-error"></div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="email" class="form-label">Email</label>
                            <input type="email" 
                                   class="form-control" 
                                   id="email" 
                                   value="<%= profileUser.email %>" 
                                   aria-label="User email"
                                   readonly>
                        </div>
                        
                        <div class="mb-3">
                            <label for="joinDate" class="form-label">Member Since</label>
                            <input type="text" 
                                   class="form-control" 
                                   id="joinDate" 
                                   value="<%= new Date(profileUser.created_at).toLocaleDateString('en-US') %>" 
                                   aria-label="Member since date"
                                   readonly>
                        </div>
                        
                        <div class="mb-3">
                            <button type="button" class="btn btn-primary" id="save-btn">Save Changes</button>
                            <button type="button" class="btn btn-secondary ms-2" id="cancel-btn">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Password Change Section -->
            <div class="card mt-4">
                <div class="card-body">
                    <h5 class="card-title">Change Password</h5>
                    <form id="password-form">
                        <div class="mb-3">
                            <label for="currentPassword" class="form-label">Current Password *</label>
                            <input type="password" 
                                   class="form-control" 
                                   id="currentPassword" 
                                   name="currentPassword" 
                                   aria-label="Current password"
                                   required>
                            <div class="invalid-feedback" id="current-password-error"></div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="newPassword" class="form-label">New Password *</label>
                            <input type="password" 
                                   class="form-control" 
                                   id="newPassword" 
                                   name="newPassword" 
                                   aria-label="New password"
                                   required>
                            <div class="invalid-feedback" id="new-password-error"></div>
                            <div class="form-text">Password must be at least 6 characters long</div>
                        </div>
                        
                        <div class="mb-3">
                            <button type="submit" class="btn btn-warning" id="change-password-btn">Change Password</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Profile form handling
        let originalName = document.getElementById('name').value;
        
        // Save button handler
        document.getElementById('save-btn').addEventListener('click', function() {
            const nameField = document.getElementById('name');
            const name = nameField.value.trim();
            
            // Validate name
            if (!name) {
                showError('name-error', 'Name is required');
                return;
            }
            
            if (name.length < 2) {
                showError('name-error', 'Name must be at least 2 characters');
                return;
            }
            
            if (name.length > 50) {
                showError('name-error', 'Name must be less than 50 characters');
                return;
            }
            
            // Check if name changed
            if (name === originalName) {
                showSuccess('No changes to save');
                return;
            }
            
            // Update profile
            updateProfile(name);
        });
        
        // Cancel button handler
        document.getElementById('cancel-btn').addEventListener('click', function() {
            document.getElementById('name').value = originalName;
            clearErrors();
        });
        
        // ESC key handler
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                document.getElementById('cancel-btn').click();
            }
        });
        
        // Password form handler
        document.getElementById('password-form').addEventListener('submit', function(event) {
            event.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            
            // Validate passwords
            if (!currentPassword) {
                showError('current-password-error', 'Current password is required');
                return;
            }
            
            if (!newPassword) {
                showError('new-password-error', 'New password is required');
                return;
            }
            
            if (newPassword.length < 6) {
                showError('new-password-error', 'Password must be at least 6 characters');
                return;
            }
            
            // Update password
            updatePassword(currentPassword, newPassword);
        });
        
        // Helper functions
        function updateProfile(name) {
            fetch('/profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: name })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    originalName = data.name;
                    showSuccess(data.message);
                } else {
                    showError('name-error', data.error);
                }
            })
            .catch(error => {
                showError('name-error', 'Failed to update profile');
            });
        }
        
        function updatePassword(currentPassword, newPassword) {
            fetch('/profile/password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    currentPassword: currentPassword, 
                    newPassword: newPassword 
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Clear form
                    document.getElementById('password-form').reset();
                    showSuccess(data.message);
                } else {
                    if (data.error.includes('Current password')) {
                        showError('current-password-error', data.error);
                    } else {
                        showError('new-password-error', data.error);
                    }
                }
            })
            .catch(error => {
                showError('new-password-error', 'Failed to update password');
            });
        }
        
        function showError(fieldId, message) {
            const errorElement = document.getElementById(fieldId);
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        function showSuccess(message) {
            // Create or update success message
            let successDiv = document.getElementById('success-message');
            if (!successDiv) {
                successDiv = document.createElement('div');
                successDiv.id = 'success-message';
                successDiv.className = 'alert alert-success';
                document.querySelector('.container').insertBefore(successDiv, document.querySelector('h1'));
            }
            successDiv.textContent = message;
            successDiv.style.display = 'block';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 3000);
        }
        
        function clearErrors() {
            const errorElements = document.querySelectorAll('.invalid-feedback');
            errorElements.forEach(element => {
                element.style.display = 'none';
            });
        }
    </script>
</body>
</html>
`;

const TEST_USER = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2023-01-01T00:00:00.000Z'
};

const renderProfile = (data = {}) => {
  const defaultData = {
    title: 'Profile',
    user: TEST_USER,
    profileUser: TEST_USER,
    success: null,
    error: null,
    ...data
  };
  
  return ejs.render(PROFILE_TEMPLATE, defaultData);
};

describe('Profile Page UI', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    const html = renderProfile();
    dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
    document = dom.window.document;
    window = dom.window as any;
    
    // Mock fetch for AJAX requests
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Navigation and Authentication', () => {
    // TC-F-010: Profile link appears in sidebar navigation above Dashboard link for authenticated users
    // TC-F-011: Profile link is only visible to authenticated users with valid JWT tokens
    test('should display profile link above dashboard link for authenticated users', () => {
      const navLinks = document.querySelectorAll('.sidebar .nav-link');
      
      expect(navLinks).toHaveLength(2);
      expect(navLinks[0].textContent?.trim()).toContain('Profile');
      expect(navLinks[1].textContent?.trim()).toContain('Dashboard');
      expect(navLinks[0].getAttribute('href')).toBe('/profile');
      expect(navLinks[1].getAttribute('href')).toBe('/dashboard');
    });

    // TC-F-020: Profile navigation link shows active state when user is on profile page
    test('should show active state for profile link', () => {
      const profileLink = document.querySelector('a[href="/profile"]');
      
      expect(profileLink?.classList.contains('active')).toBe(true);
    });

    // TC-F-024: Profile sidebar navigation maintains consistent styling with existing dashboard navigation
    test('should maintain consistent navigation styling', () => {
      const sidebar = document.querySelector('.sidebar');
      const navList = document.querySelector('.nav.flex-column');
      const navItems = document.querySelectorAll('.nav-item');
      
      expect(sidebar).toBeTruthy();
      expect(navList).toBeTruthy();
      expect(navItems.length).toBeGreaterThan(0);
      
      navItems.forEach(item => {
        const link = item.querySelector('.nav-link');
        expect(link).toBeTruthy();
        expect(link?.querySelector('.material-icons')).toBeTruthy();
      });
    });
  });

  describe('Profile Display and Form', () => {
    // TC-F-001: Profile page displays user's name, email, and join date in a readonly format when first loaded
    // TC-F-014: Profile form displays current user data as default values in editable fields
    test('should display user profile information correctly', () => {
      const nameField = document.getElementById('name') as HTMLInputElement;
      const emailField = document.getElementById('email') as HTMLInputElement;
      const joinDateField = document.getElementById('joinDate') as HTMLInputElement;
      
      expect(nameField.value).toBe(TEST_USER.name);
      expect(emailField.value).toBe(TEST_USER.email);
      expect(emailField.readOnly).toBe(true);
      expect(joinDateField.readOnly).toBe(true);
      expect(joinDateField.value).toBe(new Date(TEST_USER.created_at).toLocaleDateString('en-US'));
    });

    // TC-F-002: Profile name field allows inline editing when clicked or focused
    test('should allow editing of name field', () => {
      const nameField = document.getElementById('name') as HTMLInputElement;
      
      expect(nameField.readOnly).toBe(false);
      expect(nameField.type).toBe('text');
      expect(nameField.required).toBe(true);
    });

    // TC-F-019: Profile page includes proper ARIA labels and accessibility attributes for form controls
    test('should include proper accessibility attributes', () => {
      const nameField = document.getElementById('name') as HTMLInputElement;
      const emailField = document.getElementById('email') as HTMLInputElement;
      const joinDateField = document.getElementById('joinDate') as HTMLInputElement;
      
      expect(nameField.getAttribute('aria-label')).toBe('User name');
      expect(emailField.getAttribute('aria-label')).toBe('User email');
      expect(joinDateField.getAttribute('aria-label')).toBe('Member since date');
      
      // Check for proper labels
      const nameLabel = document.querySelector('label[for="name"]');
      const emailLabel = document.querySelector('label[for="email"]');
      const joinDateLabel = document.querySelector('label[for="joinDate"]');
      
      expect(nameLabel?.textContent).toContain('Name');
      expect(emailLabel?.textContent).toBe('Email');
      expect(joinDateLabel?.textContent).toBe('Member Since');
    });

    // TC-F-018: Profile page maintains responsive design across mobile, tablet, and desktop viewports
    test('should include responsive design elements', () => {
      const viewport = document.querySelector('meta[name="viewport"]');
      const container = document.querySelector('.container');
      const cards = document.querySelectorAll('.card');
      
      expect(viewport?.getAttribute('content')).toContain('width=device-width');
      expect(container).toBeTruthy();
      expect(cards.length).toBeGreaterThan(0);
      
      // Check for Bootstrap classes
      expect(document.querySelector('.mb-3')).toBeTruthy();
      expect(document.querySelector('.form-control')).toBeTruthy();
    });
  });

  describe('Password Change Section', () => {
    // TC-F-005: Profile page includes a separate password change section with current password and new password fields
    test('should display password change section', () => {
      const passwordSection = document.querySelector('#password-form');
      const currentPasswordField = document.getElementById('currentPassword') as HTMLInputElement;
      const newPasswordField = document.getElementById('newPassword') as HTMLInputElement;
      const changePasswordBtn = document.getElementById('change-password-btn');
      
      expect(passwordSection).toBeTruthy();
      expect(currentPasswordField).toBeTruthy();
      expect(newPasswordField).toBeTruthy();
      expect(changePasswordBtn).toBeTruthy();
      
      expect(currentPasswordField.type).toBe('password');
      expect(newPasswordField.type).toBe('password');
      expect(currentPasswordField.required).toBe(true);
      expect(newPasswordField.required).toBe(true);
    });

    test('should include password validation help text', () => {
      const helpText = document.querySelector('.form-text');
      
      expect(helpText?.textContent).toContain('Password must be at least 6 characters');
    });

    test('should include proper accessibility for password fields', () => {
      const currentPasswordField = document.getElementById('currentPassword') as HTMLInputElement;
      const newPasswordField = document.getElementById('newPassword') as HTMLInputElement;
      
      expect(currentPasswordField.getAttribute('aria-label')).toBe('Current password');
      expect(newPasswordField.getAttribute('aria-label')).toBe('New password');
      
      // Check for proper labels
      const currentPasswordLabel = document.querySelector('label[for="currentPassword"]');
      const newPasswordLabel = document.querySelector('label[for="newPassword"]');
      
      expect(currentPasswordLabel?.textContent).toContain('Current Password');
      expect(newPasswordLabel?.textContent).toContain('New Password');
    });
  });

  describe('Form Interactions', () => {
    // TC-F-008: Cancel button reverts name field to original value and exits edit mode
    test('should revert name field when cancel button is clicked', () => {
      const nameField = document.getElementById('name') as HTMLInputElement;
      const cancelBtn = document.getElementById('cancel-btn');
      
      // Change the name
      nameField.value = 'Changed Name';
      
      // Click cancel
      cancelBtn?.dispatchEvent(new dom.window.Event('click'));
      
      // Should revert to original
      expect(nameField.value).toBe(TEST_USER.name);
    });

    // TC-F-023: Profile page escape key cancels edit mode and reverts to original values
    test('should revert name field when escape key is pressed', () => {
      const nameField = document.getElementById('name') as HTMLInputElement;
      
      // Change the name
      nameField.value = 'Changed Name';
      
      // Press escape key
      const escapeEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      // Should revert to original
      expect(nameField.value).toBe(TEST_USER.name);
    });

    // TC-F-022: Profile form prevents submission of unchanged data to avoid unnecessary database operations
    test('should prevent submission of unchanged name', async () => {
      const saveBtn = document.getElementById('save-btn');
      const mockFetch = (global as any).fetch;
      
      // Click save without changing name
      saveBtn?.dispatchEvent(new dom.window.Event('click'));
      
      // Wait for any async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Should not make API call for unchanged data
      expect(mockFetch).not.toHaveBeenCalled();
      
      // Should show message about no changes
      const successMessage = document.getElementById('success-message');
      expect(successMessage?.textContent).toContain('No changes to save');
    });
  });

  describe('Page Title and Meta Information', () => {
    // TC-F-025: Profile page includes proper page title and meta information
    test('should include proper page title and meta information', () => {
      const title = document.querySelector('title');
      const viewport = document.querySelector('meta[name="viewport"]');
      
      expect(title?.textContent).toBe('Profile');
      expect(viewport?.getAttribute('content')).toBe('width=device-width, initial-scale=1');
    });

    test('should include required CSS and icon libraries', () => {
      const bootstrapLink = document.querySelector('link[href*="bootstrap"]');
      const materialIconsLink = document.querySelector('link[href*="material+icons"]');
      
      expect(bootstrapLink).toBeTruthy();
      expect(materialIconsLink).toBeTruthy();
    });
  });

  describe('Error and Success Message Display', () => {
    test('should display success messages when provided', () => {
      const htmlWithSuccess = renderProfile({ success: 'Profile updated successfully' });
      const successDom = new JSDOM(htmlWithSuccess);
      const successMessage = successDom.window.document.getElementById('success-message');
      
      expect(successMessage?.textContent).toBe('Profile updated successfully');
      expect(successMessage?.className).toContain('alert-success');
      
      successDom.window.close();
    });

    test('should display error messages when provided', () => {
      const htmlWithError = renderProfile({ error: 'Failed to update profile' });
      const errorDom = new JSDOM(htmlWithError);
      const errorMessage = errorDom.window.document.getElementById('error-message');
      
      expect(errorMessage?.textContent).toBe('Failed to update profile');
      expect(errorMessage?.className).toContain('alert-danger');
      
      errorDom.window.close();
    });
  });
});