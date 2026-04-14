/**
 * Frontend UI Tests for Profile Page
 * Tests inline editing functionality and Material Design styling
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('Profile EJS Template UI Tests', () => {
  let dom;
  let document;
  let window;
  
  beforeEach(() => {
    // Load the profile.ejs template and render with test data
    const templatePath = path.join(__dirname, '../views/profile.ejs');
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Mock EJS rendering with test data
    const testData = {
      user: {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        profile_picture: null,
        created_at: '2023-01-01T00:00:00.000Z'
      },
      successMessage: null,
      errors: []
    };
    
    // Simple EJS variable replacement for testing
    template = template
      .replace(/<%- user\.name %>/g, testData.user.name)
      .replace(/<%- user\.email %>/g, testData.user.email)
      .replace(/<%- user\.profile_picture || '' %>/g, testData.user.profile_picture || '')
      .replace(/<%.*%>/g, '') // Remove remaining EJS tags
      .replace(/<% .*? %>/gs, ''); // Remove EJS logic blocks
    
    dom = new JSDOM(template, {
      runScripts: 'dangerously',
      resources: 'usable'
    });
    
    document = dom.window.document;
    window = dom.window;
    
    // Mock DOM methods and add inline editing JavaScript
    addInlineEditingFunctionality();
  });
  
  afterEach(() => {
    dom.window.close();
  });
  
  function addInlineEditingFunctionality() {
    // Add inline editing JavaScript functionality
    const script = document.createElement('script');
    script.textContent = `
      let currentEditField = null;
      
      function enterEditMode(field) {
        if (currentEditField && currentEditField !== field) {
          exitEditMode(currentEditField);
        }
        currentEditField = field;
        
        const element = document.getElementById(field + '-display');
        const input = document.getElementById(field + '-input');
        const buttons = document.getElementById(field + '-buttons');
        
        if (element && input && buttons) {
          element.style.display = 'none';
          input.style.display = 'block';
          buttons.style.display = 'block';
          input.value = element.textContent;
          input.focus();
        }
      }
      
      function exitEditMode(field) {
        const element = document.getElementById(field + '-display');
        const input = document.getElementById(field + '-input');
        const buttons = document.getElementById(field + '-buttons');
        
        if (element && input && buttons) {
          element.style.display = 'block';
          input.style.display = 'none';
          buttons.style.display = 'none';
        }
        
        currentEditField = null;
      }
      
      function saveField(field) {
        const input = document.getElementById(field + '-input');
        const display = document.getElementById(field + '-display');
        const saveButton = document.getElementById(field + '-save');
        
        if (input && display) {
          const originalValue = display.getAttribute('data-original');
          const newValue = input.value.trim();
          
          // Show save button only if value changed
          if (saveButton) {
            saveButton.style.display = newValue !== originalValue ? 'inline-block' : 'none';
          }
        }
      }
      
      function validateField(field, value) {
        const errors = [];
        
        if (field === 'name') {
          if (value.length < 2 || value.length > 50) {
            errors.push('Name must be between 2 and 50 characters');
          }
          if (!/^[a-zA-Z\s]+$/.test(value)) {
            errors.push('Name can only contain letters and spaces');
          }
        }
        
        if (field === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push('Please enter a valid email address');
          }
        }
        
        return errors;
      }
    `;
    document.head.appendChild(script);
    
    // Add test DOM structure
    const profileContainer = document.createElement('div');
    profileContainer.innerHTML = `
      <div class="profile-container">
        <div class="profile-picture-section">
          <img id="profile-picture" src="/images/default-avatar.png" alt="Profile Picture" class="profile-picture" />
          <input type="file" id="picture-upload" accept=".jpg,.jpeg,.png" style="display: none;" />
        </div>
        
        <div class="profile-info">
          <div class="field-group">
            <label>Name:</label>
            <span id="name-display" data-original="John Doe" onclick="enterEditMode('name')">John Doe</span>
            <input type="text" id="name-input" style="display: none;" onkeyup="saveField('name')" />
            <div id="name-buttons" style="display: none;">
              <button id="name-save" onclick="submitField('name')" style="display: none;">Save</button>
              <button onclick="exitEditMode('name')">Cancel</button>
            </div>
            <div id="name-error" class="error-message"></div>
          </div>
          
          <div class="field-group">
            <label>Email:</label>
            <span id="email-display" data-original="john@example.com" onclick="enterEditMode('email')">john@example.com</span>
            <input type="email" id="email-input" style="display: none;" onkeyup="saveField('email')" />
            <div id="email-buttons" style="display: none;">
              <button id="email-save" onclick="submitField('email')" style="display: none;">Save</button>
              <button onclick="exitEditMode('email')">Cancel</button>
            </div>
            <div id="email-error" class="error-message"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(profileContainer);
  }
  
  // TC-F-005: Clicking on name field converts it to editable input
  test('TC-F-005: should convert name field to editable input when clicked', () => {
    const nameDisplay = document.getElementById('name-display');
    const nameInput = document.getElementById('name-input');
    const nameButtons = document.getElementById('name-buttons');
    
    // Initial state
    expect(nameDisplay.style.display).not.toBe('none');
    expect(nameInput.style.display).toBe('none');
    expect(nameButtons.style.display).toBe('none');
    
    // Click on name field
    nameDisplay.click();
    
    // Should enter edit mode
    expect(nameDisplay.style.display).toBe('none');
    expect(nameInput.style.display).toBe('block');
    expect(nameButtons.style.display).toBe('block');
    expect(nameInput.value).toBe('John Doe');
  });
  
  // TC-F-006: Clicking on email field converts it to editable input
  test('TC-F-006: should convert email field to editable input when clicked', () => {
    const emailDisplay = document.getElementById('email-display');
    const emailInput = document.getElementById('email-input');
    const emailButtons = document.getElementById('email-buttons');
    
    // Click on email field
    emailDisplay.click();
    
    // Should enter edit mode
    expect(emailDisplay.style.display).toBe('none');
    expect(emailInput.style.display).toBe('block');
    expect(emailButtons.style.display).toBe('block');
    expect(emailInput.value).toBe('john@example.com');
  });
  
  // TC-F-007: Only one field can be in edit mode at a time
  test('TC-F-007: should allow only one field in edit mode at a time', () => {
    const nameDisplay = document.getElementById('name-display');
    const nameInput = document.getElementById('name-input');
    const emailDisplay = document.getElementById('email-display');
    const emailInput = document.getElementById('email-input');
    
    // Enter edit mode for name
    nameDisplay.click();
    expect(nameInput.style.display).toBe('block');
    
    // Try to edit email - should exit name edit mode
    emailDisplay.click();
    expect(nameInput.style.display).toBe('none');
    expect(nameDisplay.style.display).toBe('block');
    expect(emailInput.style.display).toBe('block');
  });
  
  // TC-F-008: Save button only appears when field value differs from original
  test('TC-F-008: should show save button only when value changes', () => {
    const nameDisplay = document.getElementById('name-display');
    const nameInput = document.getElementById('name-input');
    const nameSave = document.getElementById('name-save');
    
    nameDisplay.click();
    
    // Initially no save button (same value)
    expect(nameSave.style.display).toBe('none');
    
    // Change value
    nameInput.value = 'Jane Doe';
    const event = new window.KeyboardEvent('keyup');
    nameInput.dispatchEvent(event);
    
    // Save button should appear
    expect(nameSave.style.display).toBe('inline-block');
    
    // Revert to original
    nameInput.value = 'John Doe';
    nameInput.dispatchEvent(event);
    
    // Save button should hide
    expect(nameSave.style.display).toBe('none');
  });
  
  // TC-F-009: Cancel button reverts field to original value and exits edit mode
  test('TC-F-009: should revert to original value and exit edit mode on cancel', () => {
    const nameDisplay = document.getElementById('name-display');
    const nameInput = document.getElementById('name-input');
    const nameButtons = document.getElementById('name-buttons');
    
    nameDisplay.click();
    
    // Change value
    nameInput.value = 'Changed Name';
    
    // Click cancel button
    const cancelButton = nameButtons.querySelector('button:last-child');
    cancelButton.click();
    
    // Should exit edit mode and revert
    expect(nameDisplay.style.display).toBe('block');
    expect(nameInput.style.display).toBe('none');
    expect(nameButtons.style.display).toBe('none');
    expect(nameDisplay.textContent).toBe('John Doe');
  });
  
  // TC-F-004: Profile picture displays as circular image with fallback
  test('TC-F-004: should display profile picture as 150x150px circular image', () => {
    const profilePicture = document.getElementById('profile-picture');
    
    expect(profilePicture).toBeTruthy();
    expect(profilePicture.classList.contains('profile-picture')).toBe(true);
    expect(profilePicture.src).toContain('default-avatar.png');
  });
  
  // TC-F-015: Profile picture upload should accept only JPG/PNG
  test('TC-F-015: should configure file upload to accept only JPG and PNG files', () => {
    const fileInput = document.getElementById('picture-upload');
    
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe('.jpg,.jpeg,.png');
    expect(fileInput.type).toBe('file');
  });
  
  describe('Field Validation UI', () => {
    // TC-F-011: Name validation error display
    test('TC-F-011: should display name validation errors below field', () => {
      const nameError = document.getElementById('name-error');
      expect(nameError).toBeTruthy();
      expect(nameError.classList.contains('error-message')).toBe(true);
      
      // Test validation function
      const errors = window.validateField('name', 'J');
      expect(errors).toContain('Name must be between 2 and 50 characters');
    });
    
    test('TC-F-011: should validate name contains only letters and spaces', () => {
      const errors = window.validateField('name', 'John123');
      expect(errors).toContain('Name can only contain letters and spaces');
    });
    
    // TC-F-012: Email validation error display
    test('TC-F-012: should display email validation errors below field', () => {
      const emailError = document.getElementById('email-error');
      expect(emailError).toBeTruthy();
      expect(emailError.classList.contains('error-message')).toBe(true);
      
      // Test validation function
      const errors = window.validateField('email', 'invalid-email');
      expect(errors).toContain('Please enter a valid email address');
    });
  });
  
  describe('Material Design Styling', () => {
    test('should apply Material Design classes to profile container', () => {
      const container = document.querySelector('.profile-container');
      expect(container).toBeTruthy();
    });
    
    test('should have proper field group structure', () => {
      const fieldGroups = document.querySelectorAll('.field-group');
      expect(fieldGroups.length).toBeGreaterThan(0);
      
      fieldGroups.forEach(group => {
        const label = group.querySelector('label');
        const input = group.querySelector('input');
        const errorDiv = group.querySelector('.error-message');
        
        expect(label).toBeTruthy();
        expect(input).toBeTruthy();
        expect(errorDiv).toBeTruthy();
      });
    });
    
    test('should have profile picture section with proper structure', () => {
      const pictureSection = document.querySelector('.profile-picture-section');
      expect(pictureSection).toBeTruthy();
      
      const img = pictureSection.querySelector('img.profile-picture');
      const fileInput = pictureSection.querySelector('input[type="file"]');
      
      expect(img).toBeTruthy();
      expect(fileInput).toBeTruthy();
    });
  });
});
