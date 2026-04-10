import { describe, it, before, after, beforeEach } from 'mocha';
import { expect } from 'chai';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Mock DOM environment for testing inline editing functionality
const mockProfileHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile - Test</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
</head>
<body class="bg-dark text-light">
    <div class="container mt-4">
        <div class="card shadow-sm">
            <div class="card-body p-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5 class="card-title mb-0">Profile Information</h5>
                    <button id="edit-profile-btn" class="btn btn-primary" type="button">
                        <i class="bi bi-pencil me-1"></i>
                        Edit Profile
                    </button>
                </div>

                <div id="loading-state" class="d-none text-center py-3">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Updating...</span>
                    </div>
                </div>

                <form id="profile-form" action="/dashboard/profile" method="POST">
                    <input type="hidden" name="_method" value="PUT">
                    
                    <!-- Name field -->
                    <div class="row mb-3">
                        <div class="col-sm-3">
                            <label for="name" class="form-label text-muted">
                                <i class="bi bi-person me-1"></i>
                                Full Name <span class="text-danger">*</span>
                            </label>
                        </div>
                        <div class="col-sm-9">
                            <div id="name-display" class="form-control-plaintext">John Doe</div>
                            <input type="text" class="form-control d-none" id="name" name="name" 
                                   value="John Doe" minlength="2" maxlength="50" required>
                            <div class="invalid-feedback">Name must be between 2 and 50 characters.</div>
                        </div>
                    </div>

                    <!-- Email field -->
                    <div class="row mb-3">
                        <div class="col-sm-3">
                            <label for="email" class="form-label text-muted">
                                <i class="bi bi-envelope me-1"></i>
                                Email Address <span class="text-danger">*</span>
                            </label>
                        </div>
                        <div class="col-sm-9">
                            <div id="email-display" class="form-control-plaintext">john@example.com</div>
                            <input type="email" class="form-control d-none" id="email" name="email" 
                                   value="john@example.com" required>
                            <div class="invalid-feedback">Please provide a valid email address.</div>
                        </div>
                    </div>

                    <!-- Phone field -->
                    <div class="row mb-3">
                        <div class="col-sm-3">
                            <label for="phone" class="form-label text-muted">
                                <i class="bi bi-phone me-1"></i>
                                Phone Number
                            </label>
                        </div>
                        <div class="col-sm-9">
                            <div id="phone-display" class="form-control-plaintext">Not provided</div>
                            <input type="tel" class="form-control d-none" id="phone" name="phone" 
                                   value="" maxlength="20" pattern="[\\d\\s\\-\\(\\)]+">
                            <div class="invalid-feedback">Please enter a valid phone number.</div>
                        </div>
                    </div>

                    <!-- Bio field -->
                    <div class="row mb-3">
                        <div class="col-sm-3">
                            <label for="bio" class="form-label text-muted">
                                <i class="bi bi-file-text me-1"></i>
                                Bio
                            </label>
                        </div>
                        <div class="col-sm-9">
                            <div id="bio-display" class="form-control-plaintext">No bio provided</div>
                            <textarea class="form-control d-none" id="bio" name="bio" 
                                      rows="3" maxlength="500"></textarea>
                            <div class="invalid-feedback">Bio must not exceed 500 characters.</div>
                            <div class="form-text d-none" id="bio-counter">0/500 characters</div>
                        </div>
                    </div>

                    <!-- Action buttons -->
                    <div class="d-flex gap-2 mt-4">
                        <button type="submit" id="save-btn" class="btn btn-success d-none">
                            <i class="bi bi-check me-1"></i>
                            Save Changes
                        </button>
                        <button type="button" id="cancel-btn" class="btn btn-outline-secondary d-none">
                            <i class="bi bi-x me-1"></i>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <script>
        // Profile editing functionality
        const VALIDATION_CONSTANTS = {
            NAME_MIN_LENGTH: 2,
            NAME_MAX_LENGTH: 50,
            BIO_MAX_LENGTH: 500,
            EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            PHONE_REGEX: /^[\d\s\-\(\)]*$/
        };

        let isEditMode = false;
        let originalData = {};

        // DOM elements
        const elements = {
            editBtn: document.getElementById('edit-profile-btn'),
            saveBtn: document.getElementById('save-btn'),
            cancelBtn: document.getElementById('cancel-btn'),
            nameDisplay: document.getElementById('name-display'),
            emailDisplay: document.getElementById('email-display'),
            phoneDisplay: document.getElementById('phone-display'),
            bioDisplay: document.getElementById('bio-display'),
            nameInput: document.getElementById('name'),
            emailInput: document.getElementById('email'),
            phoneInput: document.getElementById('phone'),
            bioInput: document.getElementById('bio'),
            bioCounter: document.getElementById('bio-counter'),
            profileForm: document.getElementById('profile-form'),
            loadingState: document.getElementById('loading-state')
        };

        // Initialize
        function init() {
            storeOriginalData();
            bindEventListeners();
            updateBioCounter();
        }

        function storeOriginalData() {
            originalData = {
                name: elements.nameDisplay.textContent.trim(),
                email: elements.emailDisplay.textContent.trim(), 
                phone: elements.phoneDisplay.textContent.trim() === 'Not provided' ? '' : elements.phoneDisplay.textContent.trim(),
                bio: elements.bioDisplay.textContent.trim() === 'No bio provided' ? '' : elements.bioDisplay.textContent.trim()
            };
        }

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
            }

            if (elements.profileForm) {
                elements.profileForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    saveProfile();
                });
            }
        }

        function toggleEditMode() {
            if (isEditMode) {
                exitEditMode();
            } else {
                enterEditMode();
            }
        }

        function enterEditMode() {
            isEditMode = true;
            
            // Hide display elements, show input elements
            elements.nameDisplay.classList.add('d-none');
            elements.emailDisplay.classList.add('d-none');
            elements.phoneDisplay.classList.add('d-none');
            elements.bioDisplay.classList.add('d-none');
            elements.editBtn.classList.add('d-none');
            
            elements.nameInput.classList.remove('d-none');
            elements.emailInput.classList.remove('d-none');
            elements.phoneInput.classList.remove('d-none');
            elements.bioInput.classList.remove('d-none');
            elements.saveBtn.classList.remove('d-none');
            elements.cancelBtn.classList.remove('d-none');
            elements.bioCounter.classList.remove('d-none');
            
            // Populate input fields
            populateInputFields();
            
            // Focus first input
            elements.nameInput.focus();
            
            // Update bio counter
            updateBioCounter();
        }

        function populateInputFields() {
            elements.nameInput.value = originalData.name;
            elements.emailInput.value = originalData.email;
            elements.phoneInput.value = originalData.phone;
            elements.bioInput.value = originalData.bio;
        }

        function exitEditMode() {
            isEditMode = false;
            
            // Show display elements, hide input elements
            elements.nameDisplay.classList.remove('d-none');
            elements.emailDisplay.classList.remove('d-none');
            elements.phoneDisplay.classList.remove('d-none');
            elements.bioDisplay.classList.remove('d-none');
            elements.editBtn.classList.remove('d-none');
            
            elements.nameInput.classList.add('d-none');
            elements.emailInput.classList.add('d-none');
            elements.phoneInput.classList.add('d-none');
            elements.bioInput.classList.add('d-none');
            elements.saveBtn.classList.add('d-none');
            elements.cancelBtn.classList.add('d-none');
            elements.bioCounter.classList.add('d-none');
            
            // Clear validation classes
            clearValidationStates();
        }

        function cancelEdit() {
            // Revert to original data
            populateInputFields();
            exitEditMode();
        }

        function validateForm() {
            let isValid = true;
            clearValidationStates();
            
            // Validate name
            const name = elements.nameInput.value.trim();
            if (!name || name.length < VALIDATION_CONSTANTS.NAME_MIN_LENGTH || name.length > VALIDATION_CONSTANTS.NAME_MAX_LENGTH) {
                setFieldError(elements.nameInput, 'Name must be between 2 and 50 characters');
                isValid = false;
            }
            
            // Validate email
            const email = elements.emailInput.value.trim();
            if (!email || !VALIDATION_CONSTANTS.EMAIL_REGEX.test(email)) {
                setFieldError(elements.emailInput, 'Please provide a valid email address');
                isValid = false;
            }
            
            // Validate phone (optional)
            const phone = elements.phoneInput.value.trim();
            if (phone && !VALIDATION_CONSTANTS.PHONE_REGEX.test(phone)) {
                setFieldError(elements.phoneInput, 'Phone number can only contain digits, spaces, dashes, and parentheses');
                isValid = false;
            }
            
            // Validate bio (optional)
            const bio = elements.bioInput.value.trim();
            if (bio && bio.length > VALIDATION_CONSTANTS.BIO_MAX_LENGTH) {
                setFieldError(elements.bioInput, 'Bio must not exceed 500 characters');
                isValid = false;
            }
            
            return isValid;
        }

        function setFieldError(field, message) {
            field.classList.add('is-invalid');
            const feedback = field.parentElement.querySelector('.invalid-feedback');
            if (feedback) {
                feedback.textContent = message;
            }
        }

        function clearValidationStates() {
            [elements.nameInput, elements.emailInput, elements.phoneInput, elements.bioInput].forEach(field => {
                field.classList.remove('is-invalid', 'is-valid');
            });
        }

        function updateBioCounter() {
            const bioLength = elements.bioInput.value.length;
            elements.bioCounter.textContent = `${bioLength}/${VALIDATION_CONSTANTS.BIO_MAX_LENGTH} characters`;
            
            if (bioLength > VALIDATION_CONSTANTS.BIO_MAX_LENGTH) {
                elements.bioCounter.classList.add('text-danger');
                elements.bioCounter.classList.remove('text-muted');
            } else {
                elements.bioCounter.classList.add('text-muted');
                elements.bioCounter.classList.remove('text-danger');
            }
        }

        function saveProfile() {
            if (!validateForm()) {
                return;
            }
            
            // Show loading state
            elements.loadingState.classList.remove('d-none');
            
            // Simulate form submission (in real app, this would submit the form)
            setTimeout(() => {
                // Update original data with new values
                originalData.name = elements.nameInput.value.trim();
                originalData.email = elements.emailInput.value.trim();
                originalData.phone = elements.phoneInput.value.trim();
                originalData.bio = elements.bioInput.value.trim();
                
                // Update display elements
                updateDisplayElements();
                
                // Hide loading state
                elements.loadingState.classList.add('d-none');
                
                // Exit edit mode
                exitEditMode();
                
                // In real app, form would be submitted here
            }, 1000);
        }

        function updateDisplayElements() {
            elements.nameDisplay.textContent = originalData.name || 'Not provided';
            elements.emailDisplay.textContent = originalData.email || 'Not provided';
            elements.phoneDisplay.textContent = originalData.phone || 'Not provided';
            elements.bioDisplay.textContent = originalData.bio || 'No bio provided';
        }

        // Initialize when DOM is loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        // Expose functions for testing
        window.profileEditor = {
            toggleEditMode,
            enterEditMode,
            exitEditMode,
            cancelEdit,
            saveProfile,
            validateForm,
            updateBioCounter,
            isEditMode: () => isEditMode,
            getOriginalData: () => originalData,
            elements
        };
    </script>
</body>
</html>
`;

describe('Inline Editing Functionality Tests', () => {
    let dom: JSDOM;
    let document: Document;
    let window: any;
    let profileEditor: any;

    beforeEach(() => {
        // Create DOM environment
        dom = new JSDOM(mockProfileHTML, {
            runScripts: 'dangerously',
            resources: 'usable'
        });
        
        document = dom.window.document;
        window = dom.window;
        
        // Wait for script to initialize
        setTimeout(() => {
            profileEditor = window.profileEditor;
        }, 100);
    });

    after(() => {
        if (dom) {
            dom.window.close();
        }
    });

    describe('Edit Mode Toggle', () => {
        // TC-AC-003
        it('should convert all profile fields to editable input/textarea elements when Edit Profile is clicked', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const nameDisplay = document.getElementById('name-display');
                const nameInput = document.getElementById('name');
                const emailDisplay = document.getElementById('email-display');
                const emailInput = document.getElementById('email');
                const phoneDisplay = document.getElementById('phone-display');
                const phoneInput = document.getElementById('phone');
                const bioDisplay = document.getElementById('bio-display');
                const bioInput = document.getElementById('bio');
                const saveBtn = document.getElementById('save-btn');
                const cancelBtn = document.getElementById('cancel-btn');

                // Initially should be in display mode
                expect(nameDisplay?.classList.contains('d-none')).to.be.false;
                expect(nameInput?.classList.contains('d-none')).to.be.true;
                expect(emailDisplay?.classList.contains('d-none')).to.be.false;
                expect(emailInput?.classList.contains('d-none')).to.be.true;
                expect(saveBtn?.classList.contains('d-none')).to.be.true;
                expect(cancelBtn?.classList.contains('d-none')).to.be.true;

                // Click edit button
                editBtn?.click();

                // Should now be in edit mode
                expect(nameDisplay?.classList.contains('d-none')).to.be.true;
                expect(nameInput?.classList.contains('d-none')).to.be.false;
                expect(emailDisplay?.classList.contains('d-none')).to.be.true;
                expect(emailInput?.classList.contains('d-none')).to.be.false;
                expect(phoneDisplay?.classList.contains('d-none')).to.be.true;
                expect(phoneInput?.classList.contains('d-none')).to.be.false;
                expect(bioDisplay?.classList.contains('d-none')).to.be.true;
                expect(bioInput?.classList.contains('d-none')).to.be.false;
                expect(saveBtn?.classList.contains('d-none')).to.be.false;
                expect(cancelBtn?.classList.contains('d-none')).to.be.false;
                expect(editBtn?.classList.contains('d-none')).to.be.true;

                done();
            }, 200);
        });

        // TC-AC-022
        it('should show save and cancel buttons with appropriate colors when inline editing is active', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const saveBtn = document.getElementById('save-btn');
                const cancelBtn = document.getElementById('cancel-btn');

                // Enter edit mode
                editBtn?.click();

                // Check button visibility and classes
                expect(saveBtn?.classList.contains('d-none')).to.be.false;
                expect(cancelBtn?.classList.contains('d-none')).to.be.false;
                expect(saveBtn?.classList.contains('btn-success')).to.be.true;
                expect(cancelBtn?.classList.contains('btn-outline-secondary')).to.be.true;

                done();
            }, 200);
        });
    });

    describe('Cancel Functionality', () => {
        // TC-AC-004
        it('should revert all changes and return to read-only mode when Cancel is clicked', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const cancelBtn = document.getElementById('cancel-btn');
                const nameInput = document.getElementById('name') as HTMLInputElement;
                const emailInput = document.getElementById('email') as HTMLInputElement;
                const phoneInput = document.getElementById('phone') as HTMLInputElement;
                const bioInput = document.getElementById('bio') as HTMLTextAreaElement;
                const nameDisplay = document.getElementById('name-display');
                const emailDisplay = document.getElementById('email-display');

                // Enter edit mode
                editBtn?.click();

                // Make some changes
                if (nameInput) nameInput.value = 'Modified Name';
                if (emailInput) emailInput.value = 'modified@example.com';
                if (phoneInput) phoneInput.value = '(555) 999-9999';
                if (bioInput) bioInput.value = 'Modified bio content';

                // Click cancel
                cancelBtn?.click();

                // Should be back in display mode
                expect(nameDisplay?.classList.contains('d-none')).to.be.false;
                expect(nameInput?.classList.contains('d-none')).to.be.true;
                expect(emailDisplay?.classList.contains('d-none')).to.be.false;
                expect(emailInput?.classList.contains('d-none')).to.be.true;

                // Values should be reverted to original
                expect(nameInput?.value).to.equal('John Doe');
                expect(emailInput?.value).to.equal('john@example.com');
                expect(phoneInput?.value).to.equal('');
                expect(bioInput?.value).to.equal('');

                done();
            }, 200);
        });
    });

    describe('Form Validation in Edit Mode', () => {
        // TC-AC-006
        it('should validate required fields before allowing form submission', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const saveBtn = document.getElementById('save-btn');
                const nameInput = document.getElementById('name') as HTMLInputElement;
                const emailInput = document.getElementById('email') as HTMLInputElement;

                // Enter edit mode
                editBtn?.click();

                // Clear required fields
                if (nameInput) nameInput.value = '';
                if (emailInput) emailInput.value = '';

                // Try to save
                saveBtn?.click();

                // Should show validation errors
                expect(nameInput?.classList.contains('is-invalid')).to.be.true;
                expect(emailInput?.classList.contains('is-invalid')).to.be.true;

                // Should still be in edit mode
                expect(profileEditor?.isEditMode()).to.be.true;

                done();
            }, 200);
        });

        // TC-AC-007
        it('should validate email format and show format error', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const saveBtn = document.getElementById('save-btn');
                const emailInput = document.getElementById('email') as HTMLInputElement;

                // Enter edit mode
                editBtn?.click();

                // Set invalid email
                if (emailInput) emailInput.value = 'invalid-email-format';

                // Try to save
                saveBtn?.click();

                // Should show email validation error
                expect(emailInput?.classList.contains('is-invalid')).to.be.true;
                
                const feedback = emailInput?.parentElement?.querySelector('.invalid-feedback');
                expect(feedback?.textContent).to.include('valid email');

                done();
            }, 200);
        });

        // TC-AC-008
        it('should validate phone number format and show format error for invalid characters', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const saveBtn = document.getElementById('save-btn');
                const phoneInput = document.getElementById('phone') as HTMLInputElement;

                // Enter edit mode
                editBtn?.click();

                // Set invalid phone
                if (phoneInput) phoneInput.value = 'abc-123-xyz';

                // Try to save
                saveBtn?.click();

                // Should show phone validation error
                expect(phoneInput?.classList.contains('is-invalid')).to.be.true;
                
                const feedback = phoneInput?.parentElement?.querySelector('.invalid-feedback');
                expect(feedback?.textContent).to.include('phone');

                done();
            }, 200);
        });

        // TC-AC-009
        it('should prevent submission when bio exceeds 500 characters and show character limit error', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const saveBtn = document.getElementById('save-btn');
                const bioInput = document.getElementById('bio') as HTMLTextAreaElement;
                const bioCounter = document.getElementById('bio-counter');

                // Enter edit mode
                editBtn?.click();

                // Set bio that exceeds limit
                const longBio = 'A'.repeat(501);
                if (bioInput) bioInput.value = longBio;
                
                // Trigger bio counter update
                profileEditor?.updateBioCounter();

                // Bio counter should show limit exceeded
                expect(bioCounter?.textContent).to.include('501/500');
                expect(bioCounter?.classList.contains('text-danger')).to.be.true;

                // Try to save
                saveBtn?.click();

                // Should show bio validation error
                expect(bioInput?.classList.contains('is-invalid')).to.be.true;
                
                const feedback = bioInput?.parentElement?.querySelector('.invalid-feedback');
                expect(feedback?.textContent).to.include('500');

                done();
            }, 200);
        });
    });

    describe('Bio Character Counter', () => {
        it('should update bio character counter in real-time during editing', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const bioInput = document.getElementById('bio') as HTMLTextAreaElement;
                const bioCounter = document.getElementById('bio-counter');

                // Enter edit mode
                editBtn?.click();

                // Initially should show 0/500
                expect(bioCounter?.textContent).to.equal('0/500 characters');

                // Add some text
                if (bioInput) {
                    bioInput.value = 'This is a test bio';
                    bioInput.dispatchEvent(new dom.window.Event('input'));
                }

                // Counter should update
                setTimeout(() => {
                    expect(bioCounter?.textContent).to.equal('18/500 characters');
                    expect(bioCounter?.classList.contains('text-muted')).to.be.true;
                    
                    // Test approaching limit
                    if (bioInput) {
                        bioInput.value = 'A'.repeat(490);
                        bioInput.dispatchEvent(new dom.window.Event('input'));
                    }
                    
                    setTimeout(() => {
                        expect(bioCounter?.textContent).to.equal('490/500 characters');
                        
                        // Test exceeding limit
                        if (bioInput) {
                            bioInput.value = 'A'.repeat(501);
                            bioInput.dispatchEvent(new dom.window.Event('input'));
                        }
                        
                        setTimeout(() => {
                            expect(bioCounter?.textContent).to.equal('501/500 characters');
                            expect(bioCounter?.classList.contains('text-danger')).to.be.true;
                            done();
                        }, 50);
                    }, 50);
                }, 50);
            }, 200);
        });
    });

    describe('Successful Profile Save', () => {
        it('should update display elements with new data after successful save', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const saveBtn = document.getElementById('save-btn');
                const nameInput = document.getElementById('name') as HTMLInputElement;
                const emailInput = document.getElementById('email') as HTMLInputElement;
                const phoneInput = document.getElementById('phone') as HTMLInputElement;
                const bioInput = document.getElementById('bio') as HTMLTextAreaElement;
                const nameDisplay = document.getElementById('name-display');
                const emailDisplay = document.getElementById('email-display');
                const phoneDisplay = document.getElementById('phone-display');
                const bioDisplay = document.getElementById('bio-display');

                // Enter edit mode
                editBtn?.click();

                // Update fields with valid data
                if (nameInput) nameInput.value = 'Updated Name';
                if (emailInput) emailInput.value = 'updated@example.com';
                if (phoneInput) phoneInput.value = '(555) 123-9999';
                if (bioInput) bioInput.value = 'Updated bio content';

                // Save changes
                saveBtn?.click();

                // Wait for save simulation to complete
                setTimeout(() => {
                    // Should be back in display mode
                    expect(nameDisplay?.classList.contains('d-none')).to.be.false;
                    expect(nameInput?.classList.contains('d-none')).to.be.true;

                    // Display elements should show updated data
                    expect(nameDisplay?.textContent).to.equal('Updated Name');
                    expect(emailDisplay?.textContent).to.equal('updated@example.com');
                    expect(phoneDisplay?.textContent).to.equal('(555) 123-9999');
                    expect(bioDisplay?.textContent).to.equal('Updated bio content');

                    done();
                }, 1100);
            }, 200);
        });

        it('should show loading state during profile update', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const saveBtn = document.getElementById('save-btn');
                const loadingState = document.getElementById('loading-state');
                const nameInput = document.getElementById('name') as HTMLInputElement;

                // Enter edit mode
                editBtn?.click();

                // Update with valid data
                if (nameInput) nameInput.value = 'Test Name';

                // Save changes
                saveBtn?.click();

                // Loading state should be visible immediately
                expect(loadingState?.classList.contains('d-none')).to.be.false;

                // Wait for save to complete
                setTimeout(() => {
                    // Loading state should be hidden
                    expect(loadingState?.classList.contains('d-none')).to.be.true;
                    done();
                }, 1100);
            }, 200);
        });
    });

    describe('Accessibility and UX', () => {
        it('should focus on first input field when entering edit mode', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const nameInput = document.getElementById('name');

                // Enter edit mode
                editBtn?.click();

                // First input should have focus
                expect(document.activeElement).to.equal(nameInput);

                done();
            }, 200);
        });

        it('should clear validation states when exiting edit mode', (done) => {
            setTimeout(() => {
                const editBtn = document.getElementById('edit-profile-btn');
                const cancelBtn = document.getElementById('cancel-btn');
                const nameInput = document.getElementById('name') as HTMLInputElement;

                // Enter edit mode
                editBtn?.click();

                // Trigger validation error
                if (nameInput) nameInput.value = '';
                profileEditor?.validateForm();

                expect(nameInput?.classList.contains('is-invalid')).to.be.true;

                // Cancel edit
                cancelBtn?.click();

                // Re-enter edit mode to check if validation is cleared
                editBtn?.click();
                expect(nameInput?.classList.contains('is-invalid')).to.be.false;

                done();
            }, 200);
        });
    });
});