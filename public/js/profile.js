/**
 * Profile page inline editing functionality
 * Handles toggle between read-only and edit modes, form validation, and profile updates
 * Includes avatar upload, XSS prevention, and mobile responsive design
 */

// Constants for validation
const VALIDATION_CONSTANTS = {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 50,
    BIO_MAX_LENGTH: 500,
    PHONE_MAX_LENGTH: 20,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_REGEX: /^[\d\s\-\(\)]*$/,
    AVATAR_MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
};

// State management
let isEditMode = false;
let originalData = {};
let avatarPreview = null;

// DOM elements
let elements = {};

/**
 * Initialize profile page functionality when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    bindEventListeners();
    storeOriginalData();
    initializeBioCounter();
    initializeAvatarUpload();
    setupMobileResponsive();
    initializeAccessibility();
});

/**
 * Initialize DOM element references
 */
function initializeElements() {
    elements = {
        // Buttons
        editBtn: document.getElementById('editBtn'),
        saveBtn: document.getElementById('saveBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        
        // Display elements
        nameDisplay: document.getElementById('nameDisplay'),
        emailDisplay: document.getElementById('emailDisplay'),
        phoneDisplay: document.getElementById('phoneDisplay'),
        bioDisplay: document.getElementById('bioDisplay'),
        avatarDisplay: document.getElementById('avatarDisplay'),
        
        // Input elements
        nameInput: document.getElementById('nameInput'),
        emailInput: document.getElementById('emailInput'),
        phoneInput: document.getElementById('phoneInput'),
        bioInput: document.getElementById('bioInput'),
        avatarInput: document.getElementById('avatarInput'),
        
        // Avatar elements
        avatarPreviewContainer: document.getElementById('avatarPreviewContainer'),
        avatarPreviewImg: document.getElementById('avatarPreviewImg'),
        avatarUploadBtn: document.getElementById('avatarUploadBtn'),
        avatarRemoveBtn: document.getElementById('avatarRemoveBtn'),
        avatarProgressBar: document.getElementById('avatarProgressBar'),
        
        // Form and messages
        profileForm: document.getElementById('profileForm'),
        errorMessage: document.getElementById('errorMessage'),
        successMessage: document.getElementById('successMessage'),
        bioCounter: document.getElementById('bioCounter'),
        loadingSpinner: document.getElementById('loadingSpinner'),
        
        // Mobile elements
        mobileMenuToggle: document.getElementById('mobileMenuToggle'),
        sidebarCollapse: document.getElementById('sidebarCollapse')
    };
}

/**
 * Bind event listeners to interactive elements
 */
function bindEventListeners() {
    if (elements.editBtn) {
        elements.editBtn.addEventListener('click', toggleEditMode);
    }
    
    if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', saveProfile);
    }
    
    if (elements.cancelBtn) {
        elements.cancelBtn.addEventListener('click', cancelEdit);
    }
    
    if (elements.bioInput) {
        elements.bioInput.addEventListener('input', updateBioCounter);
        elements.bioInput.addEventListener('keyup', updateBioCounter);
    }
    
    if (elements.profileForm) {
        elements.profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveProfile();
        });
    }
    
    // Real-time validation
    if (elements.nameInput) {
        elements.nameInput.addEventListener('blur', validateNameField);
        elements.nameInput.addEventListener('input', clearFieldError);
    }
    
    if (elements.emailInput) {
        elements.emailInput.addEventListener('blur', validateEmailField);
        elements.emailInput.addEventListener('input', clearFieldError);
    }
    
    if (elements.phoneInput) {
        elements.phoneInput.addEventListener('blur', validatePhoneField);
        elements.phoneInput.addEventListener('input', clearFieldError);
    }
    
    // Avatar upload events
    if (elements.avatarInput) {
        elements.avatarInput.addEventListener('change', handleAvatarSelect);
    }
    
    if (elements.avatarUploadBtn) {
        elements.avatarUploadBtn.addEventListener('click', () => {
            if (elements.avatarInput) {
                elements.avatarInput.click();
            }
        });
    }
    
    if (elements.avatarRemoveBtn) {
        elements.avatarRemoveBtn.addEventListener('click', removeAvatar);
    }
    
    // Mobile responsive events
    if (elements.mobileMenuToggle) {
        elements.mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
    
    // Window resize for responsive design
    window.addEventListener('resize', debounce(handleWindowResize, 250));
}

/**
 * Store original data for cancel functionality
 */
function storeOriginalData() {
    originalData = {
        name: elements.nameDisplay ? sanitizeForDisplay(elements.nameDisplay.textContent) : '',
        email: elements.emailDisplay ? sanitizeForDisplay(elements.emailDisplay.textContent) : '',
        phone: elements.phoneDisplay ? sanitizeForDisplay(elements.phoneDisplay.textContent) : '',
        bio: elements.bioDisplay ? sanitizeForDisplay(elements.bioDisplay.textContent) : '',
        avatar_url: elements.avatarDisplay ? elements.avatarDisplay.getAttribute('data-avatar-url') : null
    };
    
    // Handle "Not provided" and "No bio provided" placeholder text
    if (originalData.phone === 'Not provided') {
        originalData.phone = '';
    }
    if (originalData.bio === 'No bio provided') {
        originalData.bio = '';
    }
}

/**
 * Toggle between display and edit modes
 */
function toggleEditMode() {
    if (isEditMode) {
        exitEditMode();
    } else {
        enterEditMode();
    }
}

/**
 * Enter edit mode - show input fields, hide display elements
 */
function enterEditMode() {
    isEditMode = true;
    
    // Hide display elements and show input elements
    hideElement(elements.nameDisplay);
    hideElement(elements.emailDisplay);
    hideElement(elements.phoneDisplay);
    hideElement(elements.bioDisplay);
    hideElement(elements.editBtn);
    
    showElement(elements.nameInput);
    showElement(elements.emailInput);
    showElement(elements.phoneInput);
    showElement(elements.bioInput);
    showElement(elements.saveBtn);
    showElement(elements.cancelBtn);
    
    if (elements.bioCounter) {
        showElement(elements.bioCounter);
    }
    
    // Show avatar upload controls
    if (elements.avatarUploadBtn) {
        showElement(elements.avatarUploadBtn);
    }
    if (elements.avatarRemoveBtn) {
        showElement(elements.avatarRemoveBtn);
    }
    
    // Populate input fields with current data
    populateInputFields();
    
    // Clear any existing messages
    clearMessages();
    
    // Update bio counter
    updateBioCounter();
    
    // Focus on first input with accessibility consideration
    if (elements.nameInput) {
        elements.nameInput.focus();
        elements.nameInput.setAttribute('tabindex', '0');
    }
    
    // Add edit mode class for styling
    document.body.classList.add('profile-edit-mode');
}

/**
 * Populate input fields with current data - COMPLETED FUNCTION
 */
function populateInputFields() {
    if (elements.nameInput) {
        elements.nameInput.value = originalData.name || '';
    }
    if (elements.emailInput) {
        elements.emailInput.value = originalData.email || '';
    }
    if (elements.phoneInput) {
        elements.phoneInput.value = originalData.phone || '';
    }
    if (elements.bioInput) {
        elements.bioInput.value = originalData.bio || '';
    }
    
    // Set avatar preview if exists
    if (originalData.avatar_url && elements.avatarPreviewImg) {
        elements.avatarPreviewImg.src = originalData.avatar_url;
        elements.avatarPreviewImg.style.display = 'block';
        if (elements.avatarPreviewContainer) {
            elements.avatarPreviewContainer.style.display = 'block';
        }
    }
}

/**
 * Exit edit mode - show display elements, hide input elements
 */
function exitEditMode() {
    isEditMode = false;
    
    // Show display elements and hide input elements
    showElement(elements.nameDisplay);
    showElement(elements.emailDisplay);
    showElement(elements.phoneDisplay);
    showElement(elements.bioDisplay);
    showElement(elements.editBtn);
    
    hideElement(elements.nameInput);
    hideElement(elements.emailInput);
    hideElement(elements.phoneInput);
    hideElement(elements.bioInput);
    hideElement(elements.saveBtn);
    hideElement(elements.cancelBtn);
    
    if (elements.bioCounter) {
        hideElement(elements.bioCounter);
    }
    
    // Hide avatar upload controls
    if (elements.avatarUploadBtn) {
        hideElement(elements.avatarUploadBtn);
    }
    if (elements.avatarRemoveBtn) {
        hideElement(elements.avatarRemoveBtn);
    }
    
    // Clear avatar preview if it's different from original
    resetAvatarPreview();
    
    // Clear form validation classes
    clearAllValidationStates();
    
    // Remove edit mode class
    document.body.classList.remove('profile-edit-mode');
}

/**
 * Cancel edit mode and revert changes
 */
function cancelEdit() {
    // Revert input values to original data
    populateInputFields();
    
    // Reset avatar preview
    resetAvatarPreview();
    
    // Clear any error messages
    clearMessages();
    
    // Exit edit mode
    exitEditMode();
}

/**
 * Save profile changes with validation
 */
async function saveProfile() {
    if (!validateForm()) {
        return;
    }
    
    try {
        showLoadingState();
        
        // Create FormData for file upload support
        const formData = new FormData();
        const profileData = getFormData();
        
        // Append text data
        Object.keys(profileData).forEach(key => {
            if (profileData[key] !== null && profileData[key] !== undefined) {
                formData.append(key, profileData[key]);
            }
        });
        
        // Append avatar file if selected
        if (elements.avatarInput && elements.avatarInput.files && elements.avatarInput.files[0]) {
            formData.append('avatar', elements.avatarInput.files[0]);
        }
        
        const response = await fetch('/dashboard/profile', {
            method: 'PUT',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-Token': getCsrfToken()
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Update display elements with new data
            updateDisplayElements(result.data || profileData);
            
            // Update stored original data
            originalData = { ...profileData, ...result.data };
            
            // Show success message
            showSuccessMessage('Profile updated successfully!');
            
            // Exit edit mode
            exitEditMode();
            
            // Trigger custom event for other components
            document.dispatchEvent(new CustomEvent('profileUpdated', {
                detail: result.data
            }));
        } else {
            // Show error message with validation details
            const errorMessage = result.message || 'Failed to update profile. Please try again.';
            if (result.errors && Array.isArray(result.errors)) {
                showValidationErrors(result.errors);
            } else {
                showErrorMessage(errorMessage);
            }
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showErrorMessage('Network error. Please check your connection and try again.');
    } finally {
        hideLoadingState();
    }
}

/**
 * Avatar upload functionality
 */
function initializeAvatarUpload() {
    // Create hidden file input if not exists
    if (!elements.avatarInput) {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'avatarInput';
        input.accept = VALIDATION_CONSTANTS.ALLOWED_IMAGE_TYPES.join(',');
        input.style.display = 'none';
        document.body.appendChild(input);
        elements.avatarInput = input;
        elements.avatarInput.addEventListener('change', handleAvatarSelect);
    }
}

function handleAvatarSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!validateAvatarFile(file)) {
        elements.avatarInput.value = ''; // Clear selection
        return;
    }
    
    // Show preview
    showAvatarPreview(file);
}

function validateAvatarFile(file) {
    // Check file type
    if (!VALIDATION_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showErrorMessage('Please select a valid image file (JPEG, PNG, GIF, or WebP).');
        return false;
    }
    
    // Check file size
    if (file.size > VALIDATION_CONSTANTS.AVATAR_MAX_SIZE) {
        showErrorMessage('Image file must be less than 5MB.');
        return false;
    }
    
    return true;
}

function showAvatarPreview(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        if (elements.avatarPreviewImg) {
            elements.avatarPreviewImg.src = e.target.result;
            elements.avatarPreviewImg.style.display = 'block';
        }
        if (elements.avatarPreviewContainer) {
            elements.avatarPreviewContainer.style.display = 'block';
        }
        avatarPreview = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeAvatar() {
    if (elements.avatarInput) {
        elements.avatarInput.value = '';
    }
    resetAvatarPreview();
    avatarPreview = null;
    
    // Mark for removal on server
    if (elements.profileForm) {
        let removeInput = document.getElementById('removeAvatar');
        if (!removeInput) {
            removeInput = document.createElement('input');
            removeInput.type = 'hidden';
            removeInput.id = 'removeAvatar';
            removeInput.name = 'removeAvatar';
            elements.profileForm.appendChild(removeInput);
        }
        removeInput.value = 'true';
    }
}

function resetAvatarPreview() {
    if (elements.avatarPreviewImg) {
        if (originalData.avatar_url) {
            elements.avatarPreviewImg.src = originalData.avatar_url;
        } else {
            elements.avatarPreviewImg.style.display = 'none';
        }
    }
    
    if (elements.avatarPreviewContainer) {
        if (originalData.avatar_url) {
            elements.avatarPreviewContainer.style.display = 'block';
        } else {
            elements.avatarPreviewContainer.style.display = 'none';
        }
    }
}

/**
 * Mobile responsive functionality
 */
function setupMobileResponsive() {
    // Set initial responsive state
    handleWindowResize();
    
    // Add touch event listeners for mobile
    if ('ontouchstart' in window) {
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
    }
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('mobile-open');
    }
}

function handleWindowResize() {
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 992;
    
    // Update CSS classes based on screen size
    document.body.classList.toggle('mobile-view', isMobile);
    document.body.classList.toggle('tablet-view', isTablet);
    
    // Adjust form layout for mobile
    if (isMobile) {
        adjustMobileLayout();
    } else {
        resetDesktopLayout();
    }
}

function adjustMobileLayout() {
    // Stack form elements vertically on mobile
    const formGroups = document.querySelectorAll('.form-group, .mb-3');
    formGroups.forEach(group => {
        group.classList.add('mobile-stacked');
    });
    
    // Make buttons full width on mobile
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        btn.classList.add('btn-mobile');
    });
}

function resetDesktopLayout() {
    // Remove mobile classes
    const formGroups = document.querySelectorAll('.mobile-stacked');
    formGroups.forEach(group => {
        group.classList.remove('mobile-stacked');
    });
    
    const buttons = document.querySelectorAll('.btn-mobile');
    buttons.forEach(btn => {
        btn.classList.remove('btn-mobile');
    });
}

let touchStartX = 0;
let touchStartY = 0;

function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}

function handleTouchMove(e) {
    if (!touchStartX || !touchStartY) return;
    
    const touchEndX = e.touches[0].clientX;
    const touchEndY = e.touches[0].clientY;
    
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    
    // Swipe right to open mobile menu
    if (Math.abs(diffX) > Math.abs(diffY) && diffX < -50) {
        if (window.innerWidth < 768) {
            toggleMobileMenu();
        }
    }
    
    touchStartX = 0;
    touchStartY = 0;
}

/**
 * Accessibility improvements
 */
function initializeAccessibility() {
    // Add ARIA labels and roles
    if (elements.editBtn) {
        elements.editBtn.setAttribute('aria-label', 'Edit profile information');
    }
    
    if (elements.saveBtn) {
        elements.saveBtn.setAttribute('aria-label', 'Save profile changes');
    }
    
    if (elements.cancelBtn) {
        elements.cancelBtn.setAttribute('aria-label', 'Cancel profile editing');
    }
    
    // Add form descriptions for screen readers
    const form = elements.profileForm;
    if (form) {
        form.setAttribute('aria-labelledby', 'profile-form-title');
        form.setAttribute('aria-describedby', 'profile-form-description');
    }
}

function handleKeyboardNavigation(e) {
    // Escape key to cancel edit mode
    if (e.key === 'Escape' && isEditMode) {
        e.preventDefault();
        cancelEdit();
    }
    
    // Enter key to save (when not in textarea)
    if (e.key === 'Enter' && isEditMode && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        saveProfile();
    }
    
    // Tab navigation improvements
    if (e.key === 'Tab') {
        handleTabNavigation(e);
    }
}

function handleTabNavigation(e) {
    if (!isEditMode) return;
    
    const focusableElements = document.querySelectorAll(
        'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
    }
}

/**
 * Validate the entire form
 */
function validateForm() {
    let isValid = true;
    
    // Clear previous messages
    clearMessages();
    
    // Validate name
    if (!validateNameField()) {
        isValid = false;
    }
    
    // Validate email
    if (!validateEmailField()) {
        isValid = false;
    }
    
    // Validate phone (optional)
    if (!validatePhoneField()) {
        isValid = false;
    }
    
    // Validate bio (optional)
    if (!validateBioField()) {
        isValid = false;
    }
    
    // Validate avatar if selected
    if (elements.avatarInput && elements.avatarInput.files && elements.avatarInput.files[0]) {
        if (!validateAvatarFile(elements.avatarInput.files[0])) {
            isValid = false;
        }
    }
    
    return isValid;
}

/**
 * Validate name field
 */
function validateNameField() {
    if (!elements.nameInput) return true;
    
    const name = sanitizeInput(elements.nameInput.value.trim());
    const nameGroup = elements.nameInput.closest('.mb-3, .form-group');
    
    if (!name) {
        setFieldError(nameGroup, 'Name is required');
        return false;
    }
    
    if (name.length < VALIDATION_CONSTANTS.NAME_MIN_LENGTH || name.length > VALIDATION_CONSTANTS.NAME_MAX_LENGTH) {
        setFieldError(nameGroup, `Name must be between ${VALIDATION_CONSTANTS.NAME_MIN_LENGTH} and ${VALIDATION_CONSTANTS.NAME_MAX_LENGTH} characters`);
        return false;
    }
    
    setFieldSuccess(nameGroup);
    return true;
}

/**
 * Validate email field
 */
function validateEmailField() {
    if (!elements.emailInput) return true;
    
    const email = sanitizeInput(elements.emailInput.value.trim());
    const emailGroup = elements.emailInput.closest('.mb-3, .form-group');
    
    if (!email) {
        setFieldError(emailGroup, 'Email is required');
        return false;
    }
    
    if (!VALIDATION_CONSTANTS.EMAIL_REGEX.test(email)) {
        setFieldError(emailGroup, 'Please provide a valid email address');
        return false;
    }
    
    setFieldSuccess(emailGroup);
    return true;
}

/**
 * Validate phone field (optional)
 */
function validatePhoneField() {
    if (!elements.phoneInput) return true;
    
    const phone = sanitizeInput(elements.phoneInput.value.trim());
    const phoneGroup = elements.phoneInput.closest('.mb-3, .form-group');
    
    // Phone is optional, so empty is valid
    if (!phone) {
        clearFieldValidation(phoneGroup);
        return true;
    }
    
    if (phone.length > VALIDATION_CONSTANTS.PHONE_MAX_LENGTH) {
        setFieldError(phoneGroup, `Phone number must not exceed ${VALIDATION_CONSTANTS.PHONE_MAX_LENGTH} characters`);
        return false;
    }
    
    if (!VALIDATION_CONSTANTS.PHONE_REGEX.test(phone)) {
        setFieldError(phoneGroup, 'Phone number can only contain digits, spaces, dashes, and parentheses');
        return false;
    }
    
    setFieldSuccess(phoneGroup);
    return true;
}

/**
 * Validate bio field (optional)
 */
function validateBioField() {
    if (!elements.bioInput) return true;
    
    const bio = sanitizeInput(elements.bioInput.value.trim());
    const bioGroup = elements.bioInput.closest('.mb-3, .form-group');
    
    // Bio is optional, so empty is valid
    if (!bio) {
        clearFieldValidation(bioGroup);
        return true;
    }
    
    if (bio.length > VALIDATION_CONSTANTS.BIO_MAX_LENGTH) {
        setFieldError(bioGroup, `Bio must not exceed ${VALIDATION_CONSTANTS.BIO_MAX_LENGTH} characters`);
        return false;
    }
    
    setFieldSuccess(bioGroup);
    return true;
}

/**
 * Get form data with sanitization
 */
function getFormData() {
    return {
        name: sanitizeInput(elements.nameInput ? elements.nameInput.value.trim() : ''),
        email: sanitizeInput(elements.emailInput ? elements.emailInput.value.trim() : ''),
        phone: sanitizeInput(elements.phoneInput ? elements.phoneInput.value.trim() : '') || null,
        bio: sanitizeInput(elements.bioInput ? elements.bioInput.value.trim() : '') || null
    };
}

/**
 * Update display elements with new data
 */
function updateDisplayElements(data) {
    if (elements.nameDisplay && data.name) {
        elements.nameDisplay.textContent = sanitizeForDisplay(data.name);
    }
    if (elements.emailDisplay && data.email) {
        elements.emailDisplay.textContent = sanitizeForDisplay(data.email);
    }
    if (elements.phoneDisplay) {
        elements.phoneDisplay.textContent = data.phone ? sanitizeForDisplay(data.phone) : 'Not provided';
    }
    if (elements.bioDisplay) {
        elements.bioDisplay.textContent = data.bio ? sanitizeForDisplay(data.bio) : 'No bio provided';
    }
    if (elements.avatarDisplay && data.avatar_url) {
        elements.avatarDisplay.src = data.avatar_url;
        elements.avatarDisplay.setAttribute('data-avatar-url', data.avatar_url);
    }
}

/**
 * Initialize and update bio character counter
 */
function initializeBioCounter() {
    updateBioCounter();
}

function updateBioCounter() {
    if (!elements.bioInput || !elements.bioCounter) return;
    
    const currentLength = elements.bioInput.value.length;
    const remaining = VALIDATION_CONSTANTS.BIO_MAX_LENGTH - currentLength;
    
    elements.bioCounter.textContent = `${currentLength}/${VALIDATION_CONSTANTS.BIO_MAX_LENGTH}`;
    
    // Update counter color based on remaining characters
    elements.bioCounter.classList.remove('text-danger', 'text-warning', 'text-muted');
    
    if (remaining < 0) {
        elements.bioCounter.classList.add('text-danger');
    } else if (remaining < 50) {
        elements.bioCounter.classList.add('text-warning');
    } else {
        elements.bioCounter.classList.add('text-muted');
    }
}

/**
 * Field validation UI helpers
 */
function setFieldError(fieldGroup, message) {
    if (!fieldGroup) return;
    
    const input = fieldGroup.querySelector('input, textarea');
    const feedback = fieldGroup.querySelector('.invalid-feedback') || createFeedbackElement(fieldGroup, 'invalid-feedback');
    
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
    feedback.textContent = sanitizeForDisplay(message);
    
    // Add ARIA attributes for accessibility
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', feedback.id || 'error-' + input.id);
}

function setFieldSuccess(fieldGroup) {
    if (!fieldGroup) return;
    
    const input = fieldGroup.querySelector('input, textarea');
    const invalidFeedback = fieldGroup.querySelector('.invalid-feedback');
    
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    
    if (invalidFeedback) {
        invalidFeedback.textContent = '';
    }
    
    // Remove ARIA error attributes
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
}

function clearFieldValidation(fieldGroup) {
    if (!fieldGroup) return;
    
    const input = fieldGroup.querySelector('input, textarea');
    const invalidFeedback = fieldGroup.querySelector('.invalid-feedback');
    
    input.classList.remove('is-invalid', 'is-valid');
    
    if (invalidFeedback) {
        invalidFeedback.textContent = '';
    }
    
    // Remove ARIA attributes
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
}

function clearFieldError(event) {
    const fieldGroup = event.target.closest('.mb-3, .form-group');
    if (fieldGroup) {
        const input = fieldGroup.querySelector('input, textarea');
        const invalidFeedback = fieldGroup.querySelector('.invalid-feedback');
        
        input.classList.remove('is-invalid');
        
        if (invalidFeedback) {
            invalidFeedback.textContent = '';
        }
        
        input.removeAttribute('aria-invalid');
    }
}

function clearAllValidationStates() {
    const inputs = document.querySelectorAll('.form-control');
    inputs.forEach(input => {
        input.classList.remove('is-valid', 'is-invalid');
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
    });
    
    const feedbacks = document.querySelectorAll('.invalid-feedback');
    feedbacks.forEach(feedback => {
        feedback.textContent = '';
    });
}

function createFeedbackElement(fieldGroup, className) {
    const feedback = document.createElement('div');
    feedback.className = className;
    feedback.id = 'feedback-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    fieldGroup.appendChild(feedback);
    return feedback;
}

/**
 * Message display helpers
 */
function showSuccessMessage(message) {
    if (elements.successMessage) {
        elements.successMessage.textContent = sanitizeForDisplay(message);
        elements.successMessage.style.display = 'block';
        elements.successMessage.setAttribute('role', 'alert');
        elements.successMessage.setAttribute('aria-live', 'polite');
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
            hideElement(elements.successMessage);
        }, 5000);
        
        // Announce to screen readers
        announceToScreenReader(message);
    }
}

function showErrorMessage(message) {
    if (elements.errorMessage) {
        elements.errorMessage.textContent = sanitizeForDisplay(message);
        elements.errorMessage.style.display = 'block';
        elements.errorMessage.setAttribute('role', 'alert');
        elements.errorMessage.setAttribute('aria-live', 'assertive');
        
        // Announce to screen readers
        announceToScreenReader(message);
    }
}

function showValidationErrors(errors) {
    const errorList = errors.map(error => sanitizeForDisplay(error.msg)).join('\n');
    showErrorMessage(`Please correct the following errors:\n${errorList}`);
    
    // Also show individual field errors
    errors.forEach(error => {
        const field = document.querySelector(`[name="${error.param}"]`);
        if (field) {
            const fieldGroup = field.closest('.mb-3, .form-group');
            setFieldError(fieldGroup, error.msg);
        }
    });
}

function clearMessages() {
    if (elements.successMessage) {
        elements.successMessage.textContent = '';
        hideElement(elements.successMessage);
        elements.successMessage.removeAttribute('role');
        elements.successMessage.removeAttribute('aria-live');
    }
    if (elements.errorMessage) {
        elements.errorMessage.textContent = '';
        hideElement(elements.errorMessage);
        elements.errorMessage.removeAttribute('role');
        elements.errorMessage.removeAttribute('aria-live');
    }
}

/**
 * Loading state helpers
 */
function showLoadingState() {
    if (elements.saveBtn) {
        elements.saveBtn.disabled = true;
        elements.saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Saving...';
        elements.saveBtn.setAttribute('aria-label', 'Saving profile changes');
    }
    if (elements.cancelBtn) {
        elements.cancelBtn.disabled = true;
    }
    
    // Show progress for avatar upload
    if (elements.avatarProgressBar) {
        elements.avatarProgressBar.style.display = 'block';
    }
}

function hideLoadingState() {
    if (elements.saveBtn) {
        elements.saveBtn.disabled = false;
        elements.saveBtn.innerHTML = '<i class="bi bi-check"></i> Save Changes';
        elements.saveBtn.setAttribute('aria-label', 'Save profile changes');
    }
    if (elements.cancelBtn) {
        elements.cancelBtn.disabled = false;
    }
    
    // Hide progress bar
    if (elements.avatarProgressBar) {
        elements.avatarProgressBar.style.display = 'none';
    }
}

/**
 * DOM utility helpers
 */
function showElement(element) {
    if (element) {
        element.style.display = 'block';
        element.setAttribute('aria-hidden', 'false');
    }
}

function hideElement(element) {
    if (element) {
        element.style.display = 'none';
        element.setAttribute('aria-hidden', 'true');
    }
}

/**
 * Security helpers for XSS prevention - Enhanced
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    // Enhanced HTML entity encoding to prevent XSS
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .replace(/\\/g, '&#x5C;')
        .replace(/`/g, '&#x60;')
        .replace(/=/g, '&#x3D;');
}

function sanitizeForDisplay(text) {
    if (typeof text !== 'string') {
        return '';
    }
    
    // Reverse HTML entity encoding for display purposes
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#x5C;/g, '\\')
        .replace(/&#x60;/g, '`')
        .replace(/&#x3D;/g, '=')
        .replace(/&amp;/g, '&');
}

/**
 * CSRF token helper
 */
function getCsrfToken() {
    const token = document.querySelector('meta[name="csrf-token"]');
    return token ? token.getAttribute('content') : '';
}

/**
 * Utility functions
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = sanitizeForDisplay(message);
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

/**
 * Error handling for uncaught errors
 */
window.addEventListener('error', (event) => {
    console.error('Profile page error:', event.error);
    showErrorMessage('An unexpected error occurred. Please refresh the page and try again.');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Profile page promise rejection:', event.reason);
    showErrorMessage('An unexpected error occurred. Please refresh the page and try again.');
    event.preventDefault();
});

// Export functions for testing (if in Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sanitizeInput,
        sanitizeForDisplay,
        validateForm,
        validateNameField,
        validateEmailField,
        validatePhoneField,
        validateBioField,
        VALIDATION_CONSTANTS
    };
}