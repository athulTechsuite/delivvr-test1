/**
 * Profile Inline Editing Module
 * Handles inline editing functionality for profile fields, file uploads, and form validation
 */

class ProfileInlineEditor {
    constructor() {
        this.CONSTANTS = {
            MAX_FILE_SIZE: 2097152, // 2MB in bytes
            ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png'],
            ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png'],
            MIN_NAME_LENGTH: 2,
            MAX_NAME_LENGTH: 50,
            MIN_PASSWORD_LENGTH: 6,
            MAX_PASSWORD_LENGTH: 128,
            SUCCESS_MESSAGE_TIMEOUT: 3000,
            NAME_PATTERN: /^[a-zA-Z\s]+$/,
            PASSWORD_PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,128}$/,
            EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        };

        this.currentEditField = null;
        this.originalValues = {};
        this.isUploading = false;

        this.init();
    }

    init() {
        this.bindEvents();
        this.setupDragAndDrop();
        this.storeOriginalValues();
    }

    storeOriginalValues() {
        const nameElement = document.getElementById('user-name');
        const emailElement = document.getElementById('user-email');

        if (nameElement) {
            this.originalValues.name = nameElement.textContent.trim();
        }
        if (emailElement) {
            this.originalValues.email = emailElement.textContent.trim();
        }
    }

    bindEvents() {
        // Name field editing
        const nameField = document.getElementById('user-name');
        if (nameField) {
            nameField.addEventListener('click', (e) => this.enterEditMode('name', e.target));
        }

        // Email field editing
        const emailField = document.getElementById('user-email');
        if (emailField) {
            emailField.addEventListener('click', (e) => this.enterEditMode('email', e.target));
        }

        // Profile picture upload
        const profilePicInput = document.getElementById('profile-picture-input');
        if (profilePicInput) {
            profilePicInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        const profilePicContainer = document.querySelector('.profile-picture-container');
        if (profilePicContainer) {
            profilePicContainer.addEventListener('click', () => this.triggerFileUpload());
        }

        // Password form submission
        const passwordForm = document.getElementById('password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordSubmit(e));
        }

        // Global escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentEditField) {
                this.cancelEdit();
            }
        });
    }

    enterEditMode(fieldType, element) {
        if (this.currentEditField && this.currentEditField !== fieldType) {
            this.cancelEdit();
        }

        if (this.currentEditField === fieldType) {
            return;
        }

        this.currentEditField = fieldType;
        const originalValue = this.originalValues[fieldType];

        const inputHtml = `
            <div class="inline-edit-container">
                <div class="input-field">
                    <input type="${fieldType === 'email' ? 'email' : 'text'}" 
                           id="edit-${fieldType}" 
                           value="${this.escapeHtml(originalValue)}"
                           class="validate">
                    <label for="edit-${fieldType}" class="active">${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)}</label>
                </div>
                <div class="inline-edit-actions">
                    <button type="button" class="btn-small green save-btn" onclick="profileEditor.saveField('${fieldType}')" disabled>
                        <i class="material-icons left">check</i>Save
                    </button>
                    <button type="button" class="btn-small red cancel-btn" onclick="profileEditor.cancelEdit()">
                        <i class="material-icons left">close</i>Cancel
                    </button>
                </div>
                <div class="error-message" id="error-${fieldType}"></div>
            </div>
        `;

        element.innerHTML = inputHtml;
        
        const input = document.getElementById(`edit-${fieldType}`);
        if (input) {
            input.focus();
            input.select();
            input.addEventListener('input', () => this.validateFieldAndToggleSave(fieldType));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveField(fieldType);
                }
            });
        }
    }

    validateFieldAndToggleSave(fieldType) {
        const input = document.getElementById(`edit-${fieldType}`);
        const saveBtn = document.querySelector('.save-btn');
        const errorDiv = document.getElementById(`error-${fieldType}`);

        if (!input || !saveBtn) return;

        const currentValue = input.value.trim();
        const originalValue = this.originalValues[fieldType];
        const isChanged = currentValue !== originalValue;
        const isValid = this.validateField(fieldType, currentValue, errorDiv);

        saveBtn.disabled = !isChanged || !isValid;
    }

    validateField(fieldType, value, errorDiv) {
        let isValid = true;
        let errorMessage = '';

        if (fieldType === 'name') {
            if (value.length < this.CONSTANTS.MIN_NAME_LENGTH || value.length > this.CONSTANTS.MAX_NAME_LENGTH) {
                errorMessage = `Name must be between ${this.CONSTANTS.MIN_NAME_LENGTH} and ${this.CONSTANTS.MAX_NAME_LENGTH} characters`;
                isValid = false;
            } else if (!this.CONSTANTS.NAME_PATTERN.test(value)) {
                errorMessage = 'Name can only contain letters and spaces';
                isValid = false;
            }
        } else if (fieldType === 'email') {
            if (!this.CONSTANTS.EMAIL_PATTERN.test(value)) {
                errorMessage = 'Please enter a valid email address';
                isValid = false;
            }
        }

        if (errorDiv) {
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = errorMessage ? 'block' : 'none';
        }

        return isValid;
    }

    async saveField(fieldType) {
        const input = document.getElementById(`edit-${fieldType}`);
        if (!input) return;

        const value = input.value.trim();
        const errorDiv = document.getElementById(`error-${fieldType}`);

        if (!this.validateField(fieldType, value, errorDiv)) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append(fieldType, value);

            const response = await fetch('/profile', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.originalValues[fieldType] = value;
                this.exitEditMode(fieldType, value);
                this.showSuccessMessage(result.message || 'Profile updated successfully');
            } else {
                this.showErrorMessage(result.message || 'Failed to update profile');
                if (result.message && result.message.includes('email')) {
                    errorDiv.textContent = result.message;
                    errorDiv.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error saving field:', error);
            this.showErrorMessage('Unable to update profile. Please try again.');
        }
    }

    cancelEdit() {
        if (!this.currentEditField) return;

        const originalValue = this.originalValues[this.currentEditField];
        this.exitEditMode(this.currentEditField, originalValue);
    }

    exitEditMode(fieldType, displayValue) {
        const element = document.getElementById(`user-${fieldType}`);
        if (element) {
            element.innerHTML = this.escapeHtml(displayValue);
        }
        this.currentEditField = null;
    }

    triggerFileUpload() {
        if (this.isUploading) return;

        const fileInput = document.getElementById('profile-picture-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!this.validateFile(file)) {
            event.target.value = '';
            return;
        }

        this.previewAndUploadFile(file);
    }

    validateFile(file) {
        // Check file size
        if (file.size > this.CONSTANTS.MAX_FILE_SIZE) {
            this.showErrorMessage('File too large (max 2MB)');
            return false;
        }

        // Check MIME type
        if (!this.CONSTANTS.ALLOWED_MIME_TYPES.includes(file.type)) {
            this.showErrorMessage('Invalid file type (JPG/PNG only)');
            return false;
        }

        // Check file extension
        const fileName = file.name.toLowerCase();
        const hasValidExtension = this.CONSTANTS.ALLOWED_EXTENSIONS.some(ext => 
            fileName.endsWith(ext)
        );

        if (!hasValidExtension) {
            this.showErrorMessage('Invalid file type (JPG/PNG only)');
            return false;
        }

        return true;
    }

    previewAndUploadFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Show preview
            const profileImg = document.querySelector('.profile-picture img, .profile-picture i');
            if (profileImg) {
                if (profileImg.tagName === 'IMG') {
                    profileImg.src = e.target.result;
                } else {
                    // Replace icon with image
                    const imgElement = document.createElement('img');
                    imgElement.src = e.target.result;
                    imgElement.alt = 'Profile Picture';
                    profileImg.parentNode.replaceChild(imgElement, profileImg);
                }
            }

            // Upload file
            this.uploadFile(file);
        };
        reader.readAsDataURL(file);
    }

    async uploadFile(file) {
        if (this.isUploading) return;

        this.isUploading = true;
        this.showLoadingState();

        try {
            const formData = new FormData();
            formData.append('profile_picture', file);

            const response = await fetch('/profile', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.showSuccessMessage(result.message || 'Profile picture updated successfully');
            } else {
                this.showErrorMessage(result.message || 'Failed to upload profile picture');
                this.revertProfilePicture();
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            this.showErrorMessage('Unable to upload profile picture. Please try again.');
            this.revertProfilePicture();
        } finally {
            this.isUploading = false;
            this.hideLoadingState();
            // Clear the file input
            const fileInput = document.getElementById('profile-picture-input');
            if (fileInput) {
                fileInput.value = '';
            }
        }
    }

    revertProfilePicture() {
        // Reload the page to revert to original profile picture
        window.location.reload();
    }

    setupDragAndDrop() {
        const dropZone = document.querySelector('.profile-picture-container');
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                if (!this.isUploading) {
                    dropZone.classList.add('drag-over');
                }
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            if (this.isUploading) return;

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (this.validateFile(file)) {
                    this.previewAndUploadFile(file);
                }
            }
        });
    }

    async handlePasswordSubmit(event) {
        event.preventDefault();

        const form = event.target;
        const currentPassword = form.querySelector('#current-password').value;
        const newPassword = form.querySelector('#new-password').value;
        const confirmPassword = form.querySelector('#confirm-password').value;

        // Clear previous errors
        this.clearPasswordErrors();

        // Validate inputs
        if (!this.validatePasswordForm(currentPassword, newPassword, confirmPassword)) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('current_password', currentPassword);
            formData.append('new_password', newPassword);
            formData.append('confirm_password', confirmPassword);

            const response = await fetch('/profile/password', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                form.reset();
                this.showSuccessMessage('Password updated successfully');
            } else {
                if (result.message && result.message.includes('Current password')) {
                    this.showPasswordError('current-password', result.message);
                } else {
                    this.showErrorMessage(result.message || 'Failed to update password');
                }
            }
        } catch (error) {
            console.error('Error updating password:', error);
            this.showErrorMessage('Unable to update password. Please try again.');
        }
    }

    validatePasswordForm(currentPassword, newPassword, confirmPassword) {
        let isValid = true;

        if (!currentPassword.trim()) {
            this.showPasswordError('current-password', 'Current password is required');
            isValid = false;
        }

        if (!newPassword || newPassword.length < this.CONSTANTS.MIN_PASSWORD_LENGTH || 
            newPassword.length > this.CONSTANTS.MAX_PASSWORD_LENGTH) {
            this.showPasswordError('new-password', 
                `Password must be between ${this.CONSTANTS.MIN_PASSWORD_LENGTH} and ${this.CONSTANTS.MAX_PASSWORD_LENGTH} characters`);
            isValid = false;
        } else if (!this.CONSTANTS.PASSWORD_PATTERN.test(newPassword)) {
            this.showPasswordError('new-password', 
                'Password must contain at least one uppercase letter, one lowercase letter, and one number');
            isValid = false;
        }

        if (newPassword !== confirmPassword) {
            this.showPasswordError('confirm-password', 'Passwords do not match');
            isValid = false;
        }

        return isValid;
    }

    showPasswordError(fieldId, message) {
        const errorDiv = document.getElementById(`error-${fieldId}`);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    clearPasswordErrors() {
        ['current-password', 'new-password', 'confirm-password'].forEach(fieldId => {
            const errorDiv = document.getElementById(`error-${fieldId}`);
            if (errorDiv) {
                errorDiv.style.display = 'none';
                errorDiv.textContent = '';
            }
        });
    }

    showLoadingState() {
        const container = document.querySelector('.profile-picture-container');
        if (container) {
            container.classList.add('uploading');
        }
    }

    hideLoadingState() {
        const container = document.querySelector('.profile-picture-container');
        if (container) {
            container.classList.remove('uploading');
        }
    }

    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    showErrorMessage(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type) {
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll('.toast-message');
        existingToasts.forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = `toast-message ${type}`;
        toast.innerHTML = `
            <i class="material-icons">${type === 'success' ? 'check_circle' : 'error'}</i>
            <span>${this.escapeHtml(message)}</span>
        `;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto-hide after timeout
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, this.CONSTANTS.SUCCESS_MESSAGE_TIMEOUT);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the profile editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.profileEditor = new ProfileInlineEditor();
});

// Global functions for inline button clicks
window.profileEditor = null;