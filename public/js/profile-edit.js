// Profile editing functionality with inline validation and file upload
class ProfileEditor {
    constructor() {
        this.isEditMode = false;
        this.originalData = {};
        this.currentFile = null;
        this.validationRules = {
            name: {
                minLength: 2,
                maxLength: 50,
                pattern: /^[a-zA-Z\s]+$/,
                errorMessage: 'Name must be 2-50 characters and contain only letters and spaces'
            },
            email: {
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                errorMessage: 'Please enter a valid email address'
            }
        };
        this.fileValidation = {
            maxSize: 5242880, // 5MB
            allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
            allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif']
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.storeOriginalData();
        this.setupKeyboardShortcuts();
    }

    bindEvents() {
        // Edit button event
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.toggleEditMode());
        }

        // Save button event
        const saveBtn = document.getElementById('saveProfileBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => this.handleFormSubmit(e));
        }

        // Cancel button event
        const cancelBtn = document.getElementById('cancelProfileBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelEdit());
        }

        // File input event
        const fileInput = document.getElementById('profilePictureInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.previewProfilePicture(e));
        }

        // Real-time validation events
        const nameInput = document.getElementById('nameInput');
        const emailInput = document.getElementById('emailInput');

        if (nameInput) {
            nameInput.addEventListener('blur', () => this.validateField('name', nameInput.value));
            nameInput.addEventListener('input', () => this.clearFieldError('name'));
        }

        if (emailInput) {
            emailInput.addEventListener('blur', () => this.validateField('email', emailInput.value));
            emailInput.addEventListener('input', () => this.clearFieldError('email'));
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.isEditMode) return;

            // ESC to cancel
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelEdit();
            }

            // Ctrl+S to save
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.handleFormSubmit(e);
            }
        });
    }

    storeOriginalData() {
        const nameElement = document.getElementById('profileName');
        const emailElement = document.getElementById('profileEmail');
        const pictureElement = document.getElementById('profilePicture');

        this.originalData = {
            name: nameElement ? nameElement.textContent.trim() : '',
            email: emailElement ? emailElement.textContent.trim() : '',
            profilePicture: pictureElement ? pictureElement.src : null
        };
    }

    toggleEditMode() {
        this.isEditMode = !this.isEditMode;
        
        if (this.isEditMode) {
            this.enterEditMode();
        } else {
            this.exitEditMode();
        }
    }

    enterEditMode() {
        // Show/hide appropriate elements
        this.setElementDisplay('profileViewMode', 'none');
        this.setElementDisplay('profileEditMode', 'block');
        this.setElementDisplay('editProfileBtn', 'none');
        this.setElementDisplay('profileEditButtons', 'block');

        // Populate form fields with current values
        this.populateFormFields();
        
        // Clear any existing messages
        this.clearAllMessages();
        
        // Focus on first input
        const nameInput = document.getElementById('nameInput');
        if (nameInput) {
            nameInput.focus();
        }
    }

    exitEditMode() {
        // Show/hide appropriate elements
        this.setElementDisplay('profileViewMode', 'block');
        this.setElementDisplay('profileEditMode', 'none');
        this.setElementDisplay('editProfileBtn', 'block');
        this.setElementDisplay('profileEditButtons', 'none');

        // Clear form state
        this.clearFormState();
    }

    populateFormFields() {
        const nameInput = document.getElementById('nameInput');
        const emailInput = document.getElementById('emailInput');

        if (nameInput) {
            nameInput.value = this.originalData.name;
        }
        
        if (emailInput) {
            emailInput.value = this.originalData.email;
        }
    }

    validateField(fieldName, value) {
        const rules = this.validationRules[fieldName];
        if (!rules) return true;

        let isValid = true;
        let errorMessage = '';

        switch (fieldName) {
            case 'name':
                if (!value || value.trim().length < rules.minLength) {
                    isValid = false;
                    errorMessage = `Name must be at least ${rules.minLength} characters`;
                } else if (value.length > rules.maxLength) {
                    isValid = false;
                    errorMessage = `Name must not exceed ${rules.maxLength} characters`;
                } else if (!rules.pattern.test(value)) {
                    isValid = false;
                    errorMessage = rules.errorMessage;
                }
                break;

            case 'email':
                if (!value || !rules.pattern.test(value)) {
                    isValid = false;
                    errorMessage = rules.errorMessage;
                }
                break;
        }

        this.displayFieldValidation(fieldName, isValid, errorMessage);
        return isValid;
    }

    validateFile(file) {
        if (!file) return true; // File is optional

        const errors = [];

        // Check file size
        if (file.size > this.fileValidation.maxSize) {
            errors.push(`File size must not exceed ${this.fileValidation.maxSize / 1024 / 1024}MB`);
        }

        // Check file type
        if (!this.fileValidation.allowedTypes.includes(file.type)) {
            errors.push('Only JPG, JPEG, PNG, and GIF files are allowed');
        }

        // Check file extension
        const fileName = file.name.toLowerCase();
        const hasValidExtension = this.fileValidation.allowedExtensions.some(ext => 
            fileName.endsWith(ext)
        );

        if (!hasValidExtension) {
            errors.push('Invalid file extension. Use JPG, JPEG, PNG, or GIF');
        }

        if (errors.length > 0) {
            this.displayFieldValidation('profilePicture', false, errors.join('. '));
            return false;
        }

        this.clearFieldError('profilePicture');
        return true;
    }

    previewProfilePicture(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('profilePicturePreview');
        
        if (!file) {
            this.currentFile = null;
            if (preview) {
                preview.style.display = 'none';
            }
            return;
        }

        // Validate file before preview
        if (!this.validateFile(file)) {
            event.target.value = ''; // Clear invalid file
            this.currentFile = null;
            return;
        }

        this.currentFile = file;

        // Show preview
        if (preview && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();

        // Get form values
        const nameInput = document.getElementById('nameInput');
        const emailInput = document.getElementById('emailInput');
        const fileInput = document.getElementById('profilePictureInput');

        const formData = {
            name: nameInput ? nameInput.value.trim() : '',
            email: emailInput ? emailInput.value.trim() : '',
            file: fileInput ? fileInput.files[0] : null
        };

        // Validate all fields
        const nameValid = this.validateField('name', formData.name);
        const emailValid = this.validateField('email', formData.email);
        const fileValid = this.validateFile(formData.file);

        if (!nameValid || !emailValid || !fileValid) {
            this.showMessage('Please fix the validation errors above', 'error');
            return;
        }

        // Show loading state
        this.setLoadingState(true);

        try {
            // Create FormData for file upload
            const submitData = new FormData();
            submitData.append('name', formData.name);
            submitData.append('email', formData.email);
            
            if (formData.file) {
                submitData.append('profilePicture', formData.file);
            }

            const response = await fetch('/profile', {
                method: 'POST',
                body: submitData,
                credentials: 'same-origin'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }

            const result = await response.json();

            // Update the display with new data
            this.updateProfileDisplay(result.user);
            
            // Store new original data
            this.originalData = {
                name: formData.name,
                email: formData.email,
                profilePicture: result.user.profilePicture || this.originalData.profilePicture
            };

            // Show success message and exit edit mode
            this.showMessage('Profile updated successfully', 'success');
            
            // Exit edit mode after a short delay
            setTimeout(() => {
                this.isEditMode = false;
                this.exitEditMode();
            }, 1500);

        } catch (error) {
            console.error('Profile update error:', error);
            this.showMessage(error.message || 'Failed to update profile. Please try again.', 'error');
        } finally {
            this.setLoadingState(false);
        }
    }

    cancelEdit() {
        // Reset form to original values
        this.populateFormFields();
        
        // Clear file input
        const fileInput = document.getElementById('profilePictureInput');
        if (fileInput) {
            fileInput.value = '';
        }

        // Clear preview
        const preview = document.getElementById('profilePicturePreview');
        if (preview) {
            preview.style.display = 'none';
        }

        // Clear validation messages
        this.clearAllMessages();
        
        // Exit edit mode
        this.isEditMode = false;
        this.exitEditMode();
    }

    updateProfileDisplay(userData) {
        // Update name display
        const nameElement = document.getElementById('profileName');
        if (nameElement && userData.name) {
            nameElement.textContent = userData.name;
        }

        // Update email display
        const emailElement = document.getElementById('profileEmail');
        if (emailElement && userData.email) {
            emailElement.textContent = userData.email;
        }

        // Update profile picture
        const pictureElement = document.getElementById('profilePicture');
        if (pictureElement && userData.profilePicture) {
            pictureElement.src = '/' + userData.profilePicture;
        }
    }

    displayFieldValidation(fieldName, isValid, message) {
        const input = document.getElementById(`${fieldName}Input`) || 
                     document.getElementById('profilePictureInput');
        const errorElement = document.getElementById(`${fieldName}Error`);

        if (input) {
            input.classList.toggle('error', !isValid);
            input.classList.toggle('valid', isValid);
        }

        if (errorElement) {
            errorElement.textContent = isValid ? '' : message;
            errorElement.style.display = isValid ? 'none' : 'block';
        }
    }

    clearFieldError(fieldName) {
        this.displayFieldValidation(fieldName, true, '');
    }

    clearAllMessages() {
        // Clear field validation messages
        Object.keys(this.validationRules).forEach(field => {
            this.clearFieldError(field);
        });
        this.clearFieldError('profilePicture');

        // Clear general messages
        const messageContainer = document.getElementById('profileMessage');
        if (messageContainer) {
            messageContainer.style.display = 'none';
            messageContainer.textContent = '';
        }
    }

    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('profileMessage');
        if (!messageContainer) return;

        messageContainer.textContent = message;
        messageContainer.className = `message ${type}`;
        messageContainer.style.display = 'block';

        // Auto-hide after 3 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                messageContainer.style.display = 'none';
            }, 3000);
        }
    }

    setLoadingState(isLoading) {
        const saveBtn = document.getElementById('saveProfileBtn');
        const cancelBtn = document.getElementById('cancelProfileBtn');
        const inputs = document.querySelectorAll('#profileEditMode input');

        if (saveBtn) {
            saveBtn.disabled = isLoading;
            saveBtn.textContent = isLoading ? 'Saving...' : 'Save Changes';
        }

        if (cancelBtn) {
            cancelBtn.disabled = isLoading;
        }

        inputs.forEach(input => {
            input.disabled = isLoading;
        });
    }

    clearFormState() {
        // Clear validation states
        this.clearAllMessages();
        
        // Reset file input
        const fileInput = document.getElementById('profilePictureInput');
        if (fileInput) {
            fileInput.value = '';
        }

        // Clear preview
        const preview = document.getElementById('profilePicturePreview');
        if (preview) {
            preview.style.display = 'none';
        }

        // Reset current file
        this.currentFile = null;
    }

    setElementDisplay(elementId, displayValue) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = displayValue;
        }
    }
}

// Initialize profile editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProfileEditor();
});

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileEditor;
}