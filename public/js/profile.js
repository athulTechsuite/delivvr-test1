/**
 * Profile Page JavaScript Module
 * Handles profile name editing and password change functionality
 */

class EditableNameField {
    constructor(fieldElement, originalValue) {
        this.fieldElement = fieldElement;
        this.originalValue = originalValue;
        this.isEditing = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Click to edit functionality
        this.fieldElement.addEventListener('click', (e) => {
            if (!this.isEditing) {
                this.enterEditMode();
            }
        });

        // Focus to edit functionality
        this.fieldElement.addEventListener('focus', (e) => {
            if (!this.isEditing) {
                this.enterEditMode();
            }
        });

        // Handle input validation on change
        this.fieldElement.addEventListener('input', (e) => {
            this.validateInput();
        });

        // Handle keyboard shortcuts
        this.fieldElement.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cancelEdit();
                e.preventDefault();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.isValid()) {
                    this.saveChanges();
                }
            }
        });

        // Handle blur to exit edit mode
        this.fieldElement.addEventListener('blur', (e) => {
            // Delay to allow save button click
            setTimeout(() => {
                if (this.isEditing && !document.activeElement?.closest('.profile-actions')) {
                    this.exitEditMode(false);
                }
            }, 150);
        });
    }

    enterEditMode() {
        this.isEditing = true;
        this.fieldElement.removeAttribute('readonly');
        this.fieldElement.classList.add('editing');
        this.fieldElement.select();
        this.showEditActions();
        this.addFloatingLabel();
    }

    exitEditMode(saved = false) {
        this.isEditing = false;
        this.fieldElement.setAttribute('readonly', 'true');
        this.fieldElement.classList.remove('editing', 'error');
        this.hideEditActions();
        this.removeFloatingLabel();
        this.clearValidationMessages();
    }

    cancelEdit() {
        this.fieldElement.value = this.originalValue;
        this.exitEditMode(false);
    }

    validateInput() {
        const value = this.fieldElement.value.trim();
        const namePattern = /^[a-zA-Z\s]+$/;
        const isValid = value.length >= 2 && value.length <= 50 && namePattern.test(value);
        
        this.fieldElement.classList.toggle('error', !isValid);
        
        if (!isValid) {
            this.showValidationError('Name must be 2-50 characters and contain only letters and spaces');
        } else {
            this.clearValidationMessages();
        }
        
        return isValid;
    }

    isValid() {
        return this.validateInput();
    }

    showValidationError(message) {
        this.clearValidationMessages();
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-error';
        errorElement.textContent = message;
        errorElement.setAttribute('role', 'alert');
        this.fieldElement.parentNode.appendChild(errorElement);
    }

    clearValidationMessages() {
        const existingError = this.fieldElement.parentNode.querySelector('.validation-error');
        if (existingError) {
            existingError.remove();
        }
    }

    showEditActions() {
        const actionsContainer = document.querySelector('.profile-actions');
        if (actionsContainer) {
            actionsContainer.style.display = 'flex';
        }
    }

    hideEditActions() {
        const actionsContainer = document.querySelector('.profile-actions');
        if (actionsContainer) {
            actionsContainer.style.display = 'none';
        }
    }

    addFloatingLabel() {
        const formGroup = this.fieldElement.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('focused');
        }
    }

    removeFloatingLabel() {
        const formGroup = this.fieldElement.closest('.form-group');
        if (formGroup && !this.fieldElement.value) {
            formGroup.classList.remove('focused');
        }
    }

    async saveChanges() {
        if (!this.isValid()) {
            return false;
        }

        const newValue = this.fieldElement.value.trim();
        if (newValue === this.originalValue) {
            this.exitEditMode(true);
            return true;
        }

        try {
            const saveButton = document.querySelector('.save-btn');
            const originalText = saveButton.textContent;
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';

            const response = await fetch('/profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    name: newValue
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.originalValue = newValue;
                this.exitEditMode(true);
                profilePageManager.showSuccessMessage('Name updated successfully');
                return true;
            } else {
                throw new Error(result.message || 'Failed to update name');
            }
        } catch (error) {
            console.error('Error updating name:', error);
            profilePageManager.showErrorMessage(error.message || 'Failed to update name');
            return false;
        } finally {
            const saveButton = document.querySelector('.save-btn');
            saveButton.disabled = false;
            saveButton.textContent = 'Save';
        }
    }
}

class PasswordChangeForm {
    constructor(formElement) {
        this.formElement = formElement;
        this.currentPasswordField = formElement.querySelector('#currentPassword');
        this.newPasswordField = formElement.querySelector('#newPassword');
        this.submitButton = formElement.querySelector('.password-submit-btn');
        this.setupEventListeners();
        this.setupValidation();
    }

    setupEventListeners() {
        this.formElement.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Real-time validation
        this.currentPasswordField.addEventListener('input', () => {
            this.validateCurrentPassword();
            this.updateSubmitButtonState();
        });

        this.newPasswordField.addEventListener('input', () => {
            this.validateNewPassword();
            this.updateSubmitButtonState();
        });

        // Handle floating labels
        [this.currentPasswordField, this.newPasswordField].forEach(field => {
            field.addEventListener('focus', (e) => {
                e.target.closest('.form-group').classList.add('focused');
            });

            field.addEventListener('blur', (e) => {
                if (!e.target.value) {
                    e.target.closest('.form-group').classList.remove('focused');
                }
            });
        });
    }

    setupValidation() {
        // Initialize form groups if fields have values
        [this.currentPasswordField, this.newPasswordField].forEach(field => {
            if (field.value) {
                field.closest('.form-group').classList.add('focused');
            }
        });
    }

    validateCurrentPassword() {
        const value = this.currentPasswordField.value;
        const isValid = value.length > 0;
        
        this.currentPasswordField.classList.toggle('error', !isValid);
        this.clearFieldError(this.currentPasswordField);
        
        if (!isValid && value.length > 0) {
            this.showFieldError(this.currentPasswordField, 'Current password is required');
        }
        
        return isValid;
    }

    validateNewPassword() {
        const value = this.newPasswordField.value;
        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        const isValid = passwordPattern.test(value);
        
        this.newPasswordField.classList.toggle('error', !isValid);
        this.clearFieldError(this.newPasswordField);
        
        if (!isValid && value.length > 0) {
            this.showFieldError(this.newPasswordField, 
                'Password must be at least 6 characters with uppercase, lowercase, and number');
        }
        
        return isValid;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-error';
        errorElement.textContent = message;
        errorElement.setAttribute('role', 'alert');
        field.closest('.form-group').appendChild(errorElement);
    }

    clearFieldError(field) {
        const existingError = field.closest('.form-group').querySelector('.validation-error');
        if (existingError) {
            existingError.remove();
        }
    }

    updateSubmitButtonState() {
        const currentPasswordValid = this.currentPasswordField.value.length > 0;
        const newPasswordValid = this.validateNewPassword();
        const allValid = currentPasswordValid && newPasswordValid;
        
        this.submitButton.disabled = !allValid;
    }

    async handleSubmit() {
        // Validate all fields
        const currentPasswordValid = this.validateCurrentPassword();
        const newPasswordValid = this.validateNewPassword();
        
        if (!currentPasswordValid || !newPasswordValid) {
            return;
        }

        const currentPassword = this.currentPasswordField.value;
        const newPassword = this.newPasswordField.value;

        if (currentPassword === newPassword) {
            this.showFieldError(this.newPasswordField, 'New password must be different from current password');
            return;
        }

        try {
            const originalText = this.submitButton.textContent;
            this.submitButton.disabled = true;
            this.submitButton.textContent = 'Changing Password...';

            const response = await fetch('/profile/password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    currentPassword: currentPassword,
                    newPassword: newPassword
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.resetForm();
                profilePageManager.showSuccessMessage('Password changed successfully');
            } else if (response.status === 401) {
                this.showFieldError(this.currentPasswordField, 'Current password is incorrect');
            } else {
                throw new Error(result.message || 'Failed to change password');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            profilePageManager.showErrorMessage(error.message || 'Failed to change password');
        } finally {
            this.submitButton.disabled = false;
            this.submitButton.textContent = 'Change Password';
        }
    }

    resetForm() {
        this.formElement.reset();
        [this.currentPasswordField, this.newPasswordField].forEach(field => {
            field.classList.remove('error');
            field.closest('.form-group').classList.remove('focused');
            this.clearFieldError(field);
        });
        this.updateSubmitButtonState();
    }
}

class ProfilePageManager {
    constructor() {
        this.editableNameField = null;
        this.passwordChangeForm = null;
        this.notificationContainer = null;
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupNotificationContainer();
            this.initializeEditableNameField();
            this.initializePasswordForm();
            this.setupNavigationActions();
            this.setupCancelButton();
            this.setupSaveButton();
            this.updateActiveNavigation();
        });
    }

    setupNotificationContainer() {
        // Create notification container if it doesn't exist
        this.notificationContainer = document.querySelector('.notification-container');
        if (!this.notificationContainer) {
            this.notificationContainer = document.createElement('div');
            this.notificationContainer.className = 'notification-container';
            this.notificationContainer.setAttribute('aria-live', 'polite');
            document.body.appendChild(this.notificationContainer);
        }
    }

    initializeEditableNameField() {
        const nameField = document.querySelector('#profileName');
        if (nameField) {
            const originalValue = nameField.value;
            this.editableNameField = new EditableNameField(nameField, originalValue);
        }
    }

    initializePasswordForm() {
        const passwordForm = document.querySelector('#passwordChangeForm');
        if (passwordForm) {
            this.passwordChangeForm = new PasswordChangeForm(passwordForm);
        }
    }

    setupNavigationActions() {
        // Handle profile navigation active state
        const profileLink = document.querySelector('a[href="/profile"]');
        if (profileLink) {
            profileLink.classList.add('active');
        }
    }

    setupCancelButton() {
        const cancelButton = document.querySelector('.cancel-btn');
        if (cancelButton) {
            cancelButton.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.editableNameField) {
                    this.editableNameField.cancelEdit();
                }
            });
        }
    }

    setupSaveButton() {
        const saveButton = document.querySelector('.save-btn');
        if (saveButton) {
            saveButton.addEventListener('click', async (e) => {
                e.preventDefault();
                if (this.editableNameField) {
                    await this.editableNameField.saveChanges();
                }
            });
        }
    }

    updateActiveNavigation() {
        // Remove active class from all nav links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));
        
        // Add active class to profile link
        const profileLink = document.querySelector('a[href="/profile"]');
        if (profileLink) {
            profileLink.classList.add('active');
        }
    }

    showSuccessMessage(message) {
        this.showNotification(message, 'success');
    }

    showErrorMessage(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = this.notificationContainer.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.setAttribute('role', 'alert');
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        notification.appendChild(messageSpan);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'notification-close';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', 'Close notification');
        closeButton.addEventListener('click', () => {
            notification.remove();
        });
        notification.appendChild(closeButton);
        
        this.notificationContainer.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
    }

    handleError(error) {
        console.error('Profile page error:', error);
        
        if (error.message && error.message.includes('Authentication')) {
            // Redirect to login on authentication errors
            window.location.href = '/login';
        } else {
            this.showErrorMessage(error.message || 'An unexpected error occurred');
        }
    }
}

// Global error handler for profile page
window.addEventListener('error', (event) => {
    console.error('Global error on profile page:', event.error);
    if (window.profilePageManager) {
        window.profilePageManager.handleError(event.error);
    }
});

// Initialize profile page manager
window.profilePageManager = new ProfilePageManager();

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EditableNameField,
        PasswordChangeForm,
        ProfilePageManager
    };
}