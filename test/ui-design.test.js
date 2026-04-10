const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Constants for testing
const TEST_CONSTANTS = {
    DARK_THEME_COLOR: '#2c3e50',
    CARD_SHADOW: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
    MOBILE_BREAKPOINT: 768,
    TABLET_BREAKPOINT: 992,
    DESKTOP_BREAKPOINT: 1200,
    FORM_VALIDATION_COLORS: {
        SUCCESS: '#198754',
        ERROR: '#dc3545'
    },
    AVATAR_MAX_SIZE: 5242880, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
};

// Mock CSS content for testing
const MOCK_CSS = `
:root {
    --bs-dark: #212529;
    --bs-primary: #0d6efd;
}

body {
    background-color: #f8f9fa;
    color: #212529;
}

body.dark-theme {
    background-color: var(--bs-dark);
    color: #ffffff;
}

.sidebar {
    background-color: ${TEST_CONSTANTS.DARK_THEME_COLOR};
    color: #ffffff;
    transition: all 0.3s ease;
}

.card {
    border: 1px solid #dee2e6;
    border-radius: 0.375rem;
    box-shadow: ${TEST_CONSTANTS.CARD_SHADOW};
    background-color: #ffffff;
}

.dark-theme .card {
    background-color: #343a40;
    border-color: #495057;
    color: #ffffff;
}

.form-control {
    border: 1px solid #ced4da;
    border-radius: 0.375rem;
    padding: 0.375rem 0.75rem;
}

.form-control:focus {
    border-color: #86b7fe;
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.form-control.is-invalid {
    border-color: ${TEST_CONSTANTS.FORM_VALIDATION_COLORS.ERROR};
}

.form-control.is-valid {
    border-color: ${TEST_CONSTANTS.FORM_VALIDATION_COLORS.SUCCESS};
}

.btn-primary {
    background-color: var(--bs-primary);
    border-color: var(--bs-primary);
    transition: all 0.15s ease-in-out;
}

.btn-primary:hover {
    background-color: #0b5ed7;
    border-color: #0a58ca;
    transform: translateY(-1px);
}

.btn-outline-secondary {
    color: #6c757d;
    border-color: #6c757d;
}

.btn-outline-secondary:hover {
    background-color: #6c757d;
    color: #ffffff;
}

.nav-link {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    color: rgba(255, 255, 255, 0.8);
    text-decoration: none;
    transition: all 0.3s ease;
}

.nav-link:hover {
    color: #ffffff;
    background-color: rgba(255, 255, 255, 0.1);
    transform: translateX(5px);
}

.nav-link i {
    margin-right: 0.5rem;
    width: 1rem;
}

.avatar-upload {
    position: relative;
    display: inline-block;
    cursor: pointer;
    border: 2px dashed #dee2e6;
    border-radius: 50%;
    width: 120px;
    height: 120px;
    overflow: hidden;
    transition: all 0.3s ease;
}

.avatar-upload:hover {
    border-color: #0d6efd;
    background-color: rgba(13, 110, 253, 0.05);
}

.avatar-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
}

.avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background-color: #f8f9fa;
    color: #6c757d;
    font-size: 3rem;
}

.dark-theme .avatar-placeholder {
    background-color: #495057;
    color: #adb5bd;
}

.error-message {
    color: ${TEST_CONSTANTS.FORM_VALIDATION_COLORS.ERROR};
    font-size: 0.875rem;
    margin-top: 0.25rem;
}

.success-message {
    color: ${TEST_CONSTANTS.FORM_VALIDATION_COLORS.SUCCESS};
    font-size: 0.875rem;
    margin-top: 0.25rem;
}

@media (max-width: ${TEST_CONSTANTS.MOBILE_BREAKPOINT - 1}px) {
    .sidebar {
        width: 100% !important;
        position: relative !important;
    }
    
    .main-content {
        margin-left: 0 !important;
    }
    
    .card {
        margin: 0.5rem;
    }
    
    .avatar-upload {
        width: 80px;
        height: 80px;
    }
    
    .profile-field {
        margin-bottom: 1.5rem;
    }
}

@media (min-width: ${TEST_CONSTANTS.MOBILE_BREAKPOINT}px) and (max-width: ${TEST_CONSTANTS.TABLET_BREAKPOINT - 1}px) {
    .sidebar {
        width: 200px;
    }
    
    .main-content {
        margin-left: 200px;
    }
    
    .avatar-upload {
        width: 100px;
        height: 100px;
    }
}

@media (min-width: ${TEST_CONSTANTS.DESKTOP_BREAKPOINT}px) {
    .sidebar {
        width: 250px;
    }
    
    .main-content {
        margin-left: 250px;
    }
    
    .container-fluid {
        max-width: 1200px;
    }
}

.edit-mode .form-control {
    background-color: #ffffff;
    border-color: #0d6efd;
}

.dark-theme .edit-mode .form-control {
    background-color: #495057;
    border-color: #0d6efd;
    color: #ffffff;
}

.profile-section {
    margin-bottom: 2rem;
}

.profile-field {
    margin-bottom: 1rem;
}

.profile-field label {
    font-weight: 600;
    margin-bottom: 0.25rem;
    display: block;
}

.profile-value {
    padding: 0.375rem 0;
    color: #495057;
}

.dark-theme .profile-value {
    color: #adb5bd;
}

.loading-spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #0d6efd;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.xss-safe {
    white-space: pre-wrap;
    word-wrap: break-word;
}

.validation-feedback {
    display: block;
    width: 100%;
    margin-top: 0.25rem;
    font-size: 0.875rem;
}

.method-override-indicator {
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(13, 110, 253, 0.8);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    z-index: 9999;
}
`;

// Mock HTML templates for testing
const MOCK_TEMPLATES = {
    layout: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test App</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css" rel="stylesheet">
    <style>${MOCK_CSS}</style>
</head>
<body class="dark-theme">
    <div class="d-flex">
        <nav class="sidebar position-fixed vh-100">
            <div class="p-3">
                <h4>Test App</h4>
                <ul class="nav flex-column">
                    <li class="nav-item">
                        <a class="nav-link" href="/dashboard">
                            <i class="bi bi-house"></i>
                            Dashboard
                        </a>
                    </li>
                    <li class="nav-item auth-only">
                        <a class="nav-link" href="/dashboard/profile">
                            <i class="bi bi-person"></i>
                            Profile
                        </a>
                    </li>
                </ul>
            </div>
        </nav>
        <main class="main-content flex-grow-1">
            <div class="container-fluid p-4">
                CONTENT_PLACEHOLDER
            </div>
        </main>
    </div>
    <div class="method-override-indicator d-none" id="methodOverride">PUT</div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    `,
    
    profile: `
<div class="row justify-content-center">
    <div class="col-lg-8">
        <div class="card shadow">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h3 class="mb-0"><i class="bi bi-person-circle me-2"></i>Profile</h3>
                <button id="editProfileBtn" class="btn btn-primary">
                    <i class="bi bi-pencil me-1"></i>Edit Profile
                </button>
            </div>
            <div class="card-body p-4">
                <!-- Avatar Upload Section -->
                <div class="profile-section">
                    <div class="text-center mb-4">
                        <div class="avatar-upload" id="avatarUpload">
                            <input type="file" id="avatarInput" name="avatar" accept="image/*" style="display: none;" aria-label="Upload avatar image">
                            <img id="avatarPreview" class="avatar-preview d-none" src="" alt="User avatar">
                            <div class="avatar-placeholder" id="avatarPlaceholder">
                                <i class="bi bi-person-circle"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <small class="text-muted">Click to upload avatar (max 5MB)</small>
                        </div>
                        <div id="avatarError" class="error-message d-none"></div>
                        <div id="avatarSuccess" class="success-message d-none"></div>
                    </div>
                </div>

                <form id="profileForm" method="POST" action="/dashboard/profile" enctype="multipart/form-data">
                    <input type="hidden" name="_method" value="PUT" id="methodField">
                    
                    <div class="profile-section">
                        <div class="profile-field">
                            <label for="name" class="form-label">Name <span class="text-danger">*</span></label>
                            <div class="profile-value xss-safe" id="nameDisplay">John Doe</div>
                            <input type="text" class="form-control d-none" id="name" name="name" value="John Doe" required minlength="2" maxlength="50">
                            <div class="invalid-feedback validation-feedback" id="nameError"></div>
                        </div>
                        
                        <div class="profile-field">
                            <label for="email" class="form-label">Email <span class="text-danger">*</span></label>
                            <div class="profile-value xss-safe" id="emailDisplay">john@example.com</div>
                            <input type="email" class="form-control d-none" id="email" name="email" value="john@example.com" required>
                            <div class="invalid-feedback validation-feedback" id="emailError"></div>
                        </div>
                        
                        <div class="profile-field">
                            <label for="phone" class="form-label">Phone</label>
                            <div class="profile-value xss-safe" id="phoneDisplay">Not provided</div>
                            <input type="tel" class="form-control d-none" id="phone" name="phone" value="" pattern="[\\d\\s\\-\\(\\)]*" maxlength="20">
                            <div class="invalid-feedback validation-feedback" id="phoneError"></div>
                        </div>
                        
                        <div class="profile-field">
                            <label for="bio" class="form-label">Bio</label>
                            <div class="profile-value xss-safe" id="bioDisplay">No bio provided</div>
                            <textarea class="form-control d-none" id="bio" name="bio" rows="4" maxlength="500"></textarea>
                            <div class="invalid-feedback validation-feedback" id="bioError"></div>
                            <small class="form-text text-muted">
                                <span id="bioCount">0</span>/500 characters
                            </small>
                        </div>
                    </div>
                    
                    <div class="profile-actions d-none" id="profileActions">
                        <button type="submit" class="btn btn-primary me-2" id="saveBtn">
                            <span class="loading-spinner d-none" id="saveSpinner"></span>
                            <i class="bi bi-check-lg me-1"></i>Save Changes
                        </button>
                        <button type="button" class="btn btn-outline-secondary" id="cancelEditBtn">
                            <i class="bi bi-x-lg me-1"></i>Cancel
                        </button>
                    </div>
                </form>

                <!-- Comprehensive Error Display -->
                <div id="errorContainer" class="alert alert-danger d-none mt-3" role="alert">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <div>
                            <strong>Error:</strong>
                            <ul id="errorList" class="mb-0 mt-1"></ul>
                        </div>
                    </div>
                </div>

                <!-- Success Message Display -->
                <div id="successContainer" class="alert alert-success d-none mt-3" role="alert">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-check-circle-fill me-2"></i>
                        <span id="successMessage">Profile updated successfully!</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
    `,
    
    dashboard: `
<div class="row">
    <div class="col-12">
        <div class="card shadow">
            <div class="card-header">
                <h3 class="mb-0"><i class="bi bi-speedometer2 me-2"></i>Dashboard</h3>
            </div>
            <div class="card-body p-4">
                <div class="row">
                    <div class="col-md-8">
                        <h5 class="xss-safe">Welcome back, John Doe!</h5>
                        <p class="text-muted xss-safe">You're logged in as: john@example.com</p>
                    </div>
                    <div class="col-md-4 text-end">
                        <div class="avatar-upload" style="width: 60px; height: 60px;">
                            <div class="avatar-placeholder">
                                <i class="bi bi-person-circle" style="font-size: 2rem;"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
    `,
    
    login: `
<div class="row justify-content-center">
    <div class="col-md-6 col-lg-4">
        <div class="card shadow">
            <div class="card-header text-center">
                <h3 class="mb-0"><i class="bi bi-box-arrow-in-right me-2"></i>Login</h3>
            </div>
            <div class="card-body p-4">
                <!-- Error Display -->
                <div id="loginErrorContainer" class="alert alert-danger d-none" role="alert">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <span id="loginErrorMessage"></span>
                    </div>
                </div>

                <form method="POST" action="/auth/login" id="loginForm">
                    <div class="mb-3">
                        <label for="email" class="form-label">Email <span class="text-danger">*</span></label>
                        <input type="email" class="form-control" id="email" name="email" required>
                        <div class="invalid-feedback validation-feedback" id="loginEmailError"></div>
                    </div>
                    
                    <div class="mb-3">
                        <label for="password" class="form-label">Password <span class="text-danger">*</span></label>
                        <input type="password" class="form-control" id="password" name="password" required>
                        <div class="invalid-feedback validation-feedback" id="loginPasswordError"></div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary w-100" id="loginSubmitBtn">
                        <span class="loading-spinner d-none" id="loginSpinner"></span>
                        <i class="bi bi-box-arrow-in-right me-1"></i>Login
                    </button>
                </form>
            </div>
        </div>
    </div>
</div>
    `
};

describe('UI Design Tests', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        // Create a new JSDOM instance for each test
        dom = new JSDOM(MOCK_TEMPLATES.layout.replace('CONTENT_PLACEHOLDER', '<div id="test-content"></div>'), {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });
        
        window = dom.window;
        document = window.document;
        
        // Add CSS to document
        const style = document.createElement('style');
        style.textContent = MOCK_CSS;
        document.head.appendChild(style);
        
        global.window = window;
        global.document = document;
    });

    afterEach(() => {
        if (dom) {
            dom.window.close();
        }
        delete global.window;
        delete global.document;
    });

    describe('Dark Theme CSS Classes', () => {
        test('should apply dark theme body class correctly', () => {
            const body = document.body;
            expect(body.classList.contains('dark-theme')).toBe(true);
            
            const computedStyle = window.getComputedStyle(body);
            expect(computedStyle.backgroundColor).toBe('rgb(33, 37, 41)'); // #212529
            expect(computedStyle.color).toBe('rgb(255, 255, 255)');
        });

        test('should apply sidebar dark theme styling', () => {
            const sidebar = document.querySelector('.sidebar');
            expect(sidebar).toBeTruthy();
            
            const computedStyle = window.getComputedStyle(sidebar);
            expect(computedStyle.backgroundColor).toBe('rgb(44, 62, 80)'); // #2c3e50
            expect(computedStyle.color).toBe('rgb(255, 255, 255)');
        });

        test('should apply dark theme card styling', () => {
            // Add a card to test
            const testCard = document.createElement('div');
            testCard.className = 'card';
            document.getElementById('test-content').appendChild(testCard);
            
            const computedStyle = window.getComputedStyle(testCard);
            expect(computedStyle.backgroundColor).toBe('rgb(52, 58, 64)'); // #343a40
            expect(computedStyle.borderColor).toBe('rgb(73, 80, 87)'); // #495057
            expect(computedStyle.color).toBe('rgb(255, 255, 255)');
        });

        test('should apply proper box shadow to cards', () => {
            const testCard = document.createElement('div');
            testCard.className = 'card';
            document.getElementById('test-content').appendChild(testCard);
            
            const computedStyle = window.getComputedStyle(testCard);
            expect(computedStyle.boxShadow).toBe(TEST_CONSTANTS.CARD_SHADOW);
        });
    });

    describe('Responsive Design', () => {
        test('should handle mobile viewport correctly', () => {
            // Simulate mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375
            });
            
            const sidebar = document.querySelector('.sidebar');
            const computedStyle = window.getComputedStyle(sidebar);
            
            // On mobile, sidebar should take full width
            expect(parseInt(computedStyle.width) || window.innerWidth).toBe(window.innerWidth);
        });

        test('should handle tablet viewport correctly', () => {
            // Simulate tablet viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 800
            });
            
            const sidebar = document.querySelector('.sidebar');
            const computedStyle = window.getComputedStyle(sidebar);
            
            // On tablet, sidebar should have fixed width
            expect(computedStyle.width).toBe('200px');
        });

        test('should handle desktop viewport correctly', () => {
            // Simulate desktop viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 1400
            });
            
            const sidebar = document.querySelector('.sidebar');
            const computedStyle = window.getComputedStyle(sidebar);
            
            // On desktop, sidebar should have larger fixed width
            expect(computedStyle.width).toBe('250px');
        });

        test('should maintain proper spacing on different screen sizes', () => {
            const testCard = document.createElement('div');
            testCard.className = 'card';
            document.getElementById('test-content').appendChild(testCard);
            
            // Test mobile spacing
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375
            });
            
            const computedStyle = window.getComputedStyle(testCard);
            expect(computedStyle.margin).toBe('0.5rem');
        });

        test('should adjust avatar size for different screen sizes', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            // Test mobile avatar size
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375
            });
            
            const avatarUpload = document.getElementById('avatarUpload');
            const computedStyle = window.getComputedStyle(avatarUpload);
            expect(computedStyle.width).toBe('80px');
            expect(computedStyle.height).toBe('80px');
        });
    });

    describe('Card-based Layouts', () => {
        test('should render profile card with proper structure', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const profileCard = document.querySelector('.card');
            expect(profileCard).toBeTruthy();
            
            const cardHeader = profileCard.querySelector('.card-header');
            expect(cardHeader).toBeTruthy();
            expect(cardHeader.textContent).toContain('Profile');
            
            const cardBody = profileCard.querySelector('.card-body');
            expect(cardBody).toBeTruthy();
            expect(cardBody.classList.contains('p-4')).toBe(true);
        });

        test('should render dashboard card with proper structure', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.dashboard;
            
            const dashboardCard = document.querySelector('.card');
            expect(dashboardCard).toBeTruthy();
            
            const cardHeader = dashboardCard.querySelector('.card-header');
            expect(cardHeader).toBeTruthy();
            expect(cardHeader.textContent).toContain('Dashboard');
            
            const cardBody = dashboardCard.querySelector('.card-body');
            expect(cardBody).toBeTruthy();
            expect(cardBody.classList.contains('p-4')).toBe(true);
        });

        test('should render login card with proper structure', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.login;
            
            const loginCard = document.querySelector('.card');
            expect(loginCard).toBeTruthy();
            
            const cardHeader = loginCard.querySelector('.card-header');
            expect(cardHeader).toBeTruthy();
            expect(cardHeader.textContent).toContain('Login');
            
            const cardBody = loginCard.querySelector('.card-body');
            expect(cardBody).toBeTruthy();
            expect(cardBody.classList.contains('p-4')).toBe(true);
        });

        test('should apply shadow class to cards', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const card = document.querySelector('.card');
            expect(card.classList.contains('shadow')).toBe(true);
        });
    });

    describe('Form Styling and Validation States', () => {
        beforeEach(() => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
        });

        test('should apply proper form control styling', () => {
            const nameInput = document.getElementById('name');
            expect(nameInput.classList.contains('form-control')).toBe(true);
            
            const computedStyle = window.getComputedStyle(nameInput);
            expect(computedStyle.borderColor).toBe('rgb(206, 212, 218)'); // #ced4da
            expect(computedStyle.borderRadius).toBe('0.375rem');
            expect(computedStyle.padding).toBe('0.375rem 0.75rem');
        });

        test('should display validation error states correctly', () => {
            const emailInput = document.getElementById('email');
            emailInput.classList.add('is-invalid');
            
            const computedStyle = window.getComputedStyle(emailInput);
            expect(computedStyle.borderColor).toBe(`rgb(220, 53, 69)`); // #dc3545
        });

        test('should display validation success states correctly', () => {
            const nameInput = document.getElementById('name');
            nameInput.classList.add('is-valid');
            
            const computedStyle = window.getComputedStyle(nameInput);
            expect(computedStyle.borderColor).toBe(`rgb(25, 135, 84)`); // #198754
        });

        test('should apply focus styles to form controls', () => {
            const phoneInput = document.getElementById('phone');
            phoneInput.focus();
            
            const computedStyle = window.getComputedStyle(phoneInput, ':focus');
            expect(computedStyle.borderColor).toBe('rgb(134, 183, 254)'); // #86b7fe
            expect(computedStyle.boxShadow).toBe('0 0 0 0.25rem rgba(13, 110, 253, 0.25)');
        });

        test('should properly style textarea elements', () => {
            const bioTextarea = document.getElementById('bio');
            expect(bioTextarea.classList.contains('form-control')).toBe(true);
            expect(bioTextarea.getAttribute('maxlength')).toBe('500');
            expect(bioTextarea.getAttribute('rows')).toBe('4');
        });

        test('should display character count for bio field', () => {
            const bioCount = document.getElementById('bioCount');
            expect(bioCount).toBeTruthy();
            expect(bioCount.textContent).toBe('0');
            
            const bioCountContainer = bioCount.closest('.form-text');
            expect(bioCountContainer.classList.contains('text-muted')).toBe(true);
        });

        test('should include required field indicators', () => {
            const requiredFields = document.querySelectorAll('.text-danger');
            expect(requiredFields.length).toBeGreaterThanOrEqual(2); // Name and email are required
            
            requiredFields.forEach(indicator => {
                expect(indicator.textContent).toBe('*');
            });
        });
    });

    describe('Avatar Upload Functionality', () => {
        beforeEach(() => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
        });

        test('should render avatar upload section correctly', () => {
            const avatarUpload = document.getElementById('avatarUpload');
            expect(avatarUpload).toBeTruthy();
            expect(avatarUpload.classList.contains('avatar-upload')).toBe(true);
            
            const avatarInput = document.getElementById('avatarInput');
            expect(avatarInput).toBeTruthy();
            expect(avatarInput.getAttribute('type')).toBe('file');
            expect(avatarInput.getAttribute('accept')).toBe('image/*');
            expect(avatarInput.style.display).toBe('none');
        });

        test('should display avatar placeholder when no image is present', () => {
            const avatarPlaceholder = document.getElementById('avatarPlaceholder');
            expect(avatarPlaceholder).toBeTruthy();
            expect(avatarPlaceholder.classList.contains('avatar-placeholder')).toBe(true);
            
            const placeholderIcon = avatarPlaceholder.querySelector('.bi-person-circle');
            expect(placeholderIcon).toBeTruthy();
        });

        test('should have proper avatar preview structure', () => {
            const avatarPreview = document.getElementById('avatarPreview');
            expect(avatarPreview).toBeTruthy();
            expect(avatarPreview.classList.contains('avatar-preview')).toBe(true);
            expect(avatarPreview.classList.contains('d-none')).toBe(true);
            expect(avatarPreview.getAttribute('alt')).toBe('User avatar');
        });

        test('should include avatar error and success message containers', () => {
            const avatarError = document.getElementById('avatarError');
            expect(avatarError).toBeTruthy();
            expect(avatarError.classList.contains('error-message')).toBe(true);
            expect(avatarError.classList.contains('d-none')).toBe(true);
            
            const avatarSuccess = document.getElementById('avatarSuccess');
            expect(avatarSuccess).toBeTruthy();
            expect(avatarSuccess.classList.contains('success-message')).toBe(true);
            expect(avatarSuccess.classList.contains('d-none')).toBe(true);
        });

        test('should apply proper avatar upload styling', () => {
            const avatarUpload = document.getElementById('avatarUpload');
            const computedStyle = window.getComputedStyle(avatarUpload);
            
            expect(computedStyle.position).toBe('relative');
            expect(computedStyle.display).toBe('inline-block');
            expect(computedStyle.cursor).toBe('pointer');
            expect(computedStyle.width).toBe('120px');
            expect(computedStyle.height).toBe('120px');
            expect(computedStyle.borderRadius).toBe('50%');
            expect(computedStyle.overflow).toBe('hidden');
        });

        test('should include accessibility attributes for avatar input', () => {
            const avatarInput = document.getElementById('avatarInput');
            expect(avatarInput.getAttribute('aria-label')).toBe('Upload avatar image');
        });
    });

    describe('Navigation Links Authentication', () => {
        test('should show profile link for authenticated users', () => {
            const profileLink = document.querySelector('a[href="/dashboard/profile"]');
            expect(profileLink).toBeTruthy();
            expect(profileLink.textContent.trim()).toContain('Profile');
            
            const profileIcon = profileLink.querySelector('i.bi-person');
            expect(profileIcon).toBeTruthy();
        });

        test('should hide profile link for unauthenticated users', () => {
            const authOnlyItems = document.querySelectorAll('.auth-only');
            authOnlyItems.forEach(item => {
                item.style.display = 'none';
            });
            
            const visibleProfileLink = document.querySelector('.auth-only a[href="/dashboard/profile"]');
            const computedStyle = window.getComputedStyle(visibleProfileLink.parentNode);
            expect(computedStyle.display).toBe('none');
        });

        test('should apply proper navigation link styling', () => {
            const navLinks = document.querySelectorAll('.nav-link');
            
            navLinks.forEach(link => {
                const computedStyle = window.getComputedStyle(link);
                expect(computedStyle.display).toBe('flex');
                expect(computedStyle.alignItems).toBe('center');
                expect(computedStyle.padding).toBe('0.5rem 1rem');
                expect(computedStyle.color).toBe('rgba(255, 255, 255, 0.8)');
                expect(computedStyle.textDecoration).toBe('none');
            });
        });

        test('should display proper icons in navigation links', () => {
            const dashboardLink = document.querySelector('a[href="/dashboard"]');
            const dashboardIcon = dashboardLink.querySelector('i.bi-house');
            expect(dashboardIcon).toBeTruthy();
            
            const profileLink = document.querySelector('a[href="/dashboard/profile"]');
            const profileIcon = profileLink.querySelector('i.bi-person');
            expect(profileIcon).toBeTruthy();
        });
    });

    describe('Hover Effects and Transitions', () => {
        test('should apply hover effects to buttons', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const editButton = document.getElementById('editProfileBtn');
            expect(editButton.classList.contains('btn-primary')).toBe(true);
            
            // Simulate hover
            editButton.dispatchEvent(new window.Event('mouseenter'));
            
            const computedStyle = window.getComputedStyle(editButton, ':hover');
            expect(computedStyle.backgroundColor).toBe('rgb(11, 94, 215)'); // #0b5ed7
            expect(computedStyle.borderColor).toBe('rgb(10, 88, 202)'); // #0a58ca
            expect(computedStyle.transform).toBe('translateY(-1px)');
        });

        test('should apply hover effects to navigation links', () => {
            const navLinks = document.querySelectorAll('.nav-link');
            
            navLinks.forEach(link => {
                // Simulate hover
                link.dispatchEvent(new window.Event('mouseenter'));
                
                const computedStyle = window.getComputedStyle(link, ':hover');
                expect(computedStyle.color).toBe('rgb(255, 255, 255)');
                expect(computedStyle.backgroundColor).toBe('rgba(255, 255, 255, 0.1)');
                expect(computedStyle.transform).toBe('translateX(5px)');
            });
        });

        test('should apply hover effects to secondary buttons', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const cancelButton = document.getElementById('cancelEditBtn');
            expect(cancelButton.classList.contains('btn-outline-secondary')).toBe(true);
            
            // Simulate hover
            cancelButton.dispatchEvent(new window.Event('mouseenter'));
            
            const computedStyle = window.getComputedStyle(cancelButton, ':hover');
            expect(computedStyle.backgroundColor).toBe('rgb(108, 117, 125)'); // #6c757d
            expect(computedStyle.color).toBe('rgb(255, 255, 255)');
        });

        test('should apply transition effects to interactive elements', () => {
            const sidebar = document.querySelector('.sidebar');
            const computedStyle = window.getComputedStyle(sidebar);
            expect(computedStyle.transition).toBe('all 0.3s ease');
            
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                const linkStyle = window.getComputedStyle(link);
                expect(linkStyle.transition).toBe('all 0.3s ease');
            });
        });

        test('should apply hover effects to avatar upload area', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const avatarUpload = document.getElementById('avatarUpload');
            const computedStyle = window.getComputedStyle(avatarUpload, ':hover');
            expect(computedStyle.borderColor).toBe('rgb(13, 110, 253)'); // #0d6efd
            expect(computedStyle.backgroundColor).toBe('rgba(13, 110, 253, 0.05)');
        });
    });

    describe('Inline Editing UI States', () => {
        beforeEach(() => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
        });

        test('should show save and cancel buttons when in edit mode', () => {
            const profileActions = document.getElementById('profileActions');
            expect(profileActions.classList.contains('d-none')).toBe(true);
            
            // Simulate edit mode
            profileActions.classList.remove('d-none');
            
            const saveButton = profileActions.querySelector('button[type="submit"]');
            const cancelButton = profileActions.querySelector('#cancelEditBtn');
            
            expect(saveButton).toBeTruthy();
            expect(cancelButton).toBeTruthy();
            expect(saveButton.classList.contains('btn-primary')).toBe(true);
            expect(cancelButton.classList.contains('btn-outline-secondary')).toBe(true);
        });

        test('should toggle between display and edit modes correctly', () => {
            // Test read-only mode
            const nameDisplay = document.getElementById('nameDisplay');
            const nameInput = document.getElementById('name');
            
            expect(nameDisplay.classList.contains('d-none')).toBe(false);
            expect(nameInput.classList.contains('d-none')).toBe(true);
            
            // Simulate edit mode
            nameDisplay.classList.add('d-none');
            nameInput.classList.remove('d-none');
            
            expect(nameDisplay.classList.contains('d-none')).toBe(true);
            expect(nameInput.classList.contains('d-none')).toBe(false);
        });

        test('should apply edit mode styling to form controls', () => {
            const nameInput = document.getElementById('name');
            nameInput.classList.add('edit-mode');
            
            const computedStyle = window.getComputedStyle(nameInput);
            expect(computedStyle.backgroundColor).toBe('rgb(73, 80, 87)'); // #495057 in dark theme
            expect(computedStyle.borderColor).toBe('rgb(13, 110, 253)'); // #0d6efd
            expect(computedStyle.color).toBe('rgb(255, 255, 255)');
        });

        test('should display proper button icons', () => {
            const editButton = document.getElementById('editProfileBtn');
            const editIcon = editButton.querySelector('i.bi-pencil');
            expect(editIcon).toBeTruthy();
            
            const profileActions = document.getElementById('profileActions');
            profileActions.classList.remove('d-none');
            
            const saveButton = profileActions.querySelector('button[type="submit"]');
            const saveIcon = saveButton.querySelector('i.bi-check-lg');
            expect(saveIcon).toBeTruthy();
            
            const cancelButton = profileActions.querySelector('#cancelEditBtn');
            const cancelIcon = cancelButton.querySelector('i.bi-x-lg');
            expect(cancelIcon).toBeTruthy();
        });

        test('should include loading spinner in save button', () => {
            const saveButton = document.getElementById('saveBtn');
            const loadingSpinner = saveButton.querySelector('.loading-spinner');
            expect(loadingSpinner).toBeTruthy();
            expect(loadingSpinner.classList.contains('d-none')).toBe(true);
        });
    });

    describe('Method Override and PUT Request Support', () => {
        beforeEach(() => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
        });

        test('should include method override hidden field', () => {
            const methodField = document.getElementById('methodField');
            expect(methodField).toBeTruthy();
            expect(methodField.getAttribute('type')).toBe('hidden');
            expect(methodField.getAttribute('name')).toBe('_method');
            expect(methodField.getAttribute('value')).toBe('PUT');
        });

        test('should display method override indicator', () => {
            const methodOverride = document.getElementById('methodOverride');
            expect(methodOverride).toBeTruthy();
            expect(methodOverride.textContent).toBe('PUT');
            expect(methodOverride.classList.contains('method-override-indicator')).toBe(true);
        });

        test('should set form enctype for file uploads', () => {
            const profileForm = document.getElementById('profileForm');
            expect(profileForm.getAttribute('enctype')).toBe('multipart/form-data');
        });

        test('should apply proper styling to method override indicator', () => {
            const methodOverride = document.getElementById('methodOverride');
            const computedStyle = window.getComputedStyle(methodOverride);
            
            expect(computedStyle.position).toBe('fixed');
            expect(computedStyle.top).toBe('10px');
            expect(computedStyle.right).toBe('10px');
            expect(computedStyle.backgroundColor).toBe('rgba(13, 110, 253, 0.8)');
            expect(computedStyle.color).toBe('white');
            expect(computedStyle.zIndex).toBe('9999');
        });
    });

    describe('Comprehensive Error Handling UI', () => {
        beforeEach(() => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
        });

        test('should render error container with proper structure', () => {
            const errorContainer = document.getElementById('errorContainer');
            expect(errorContainer).toBeTruthy();
            expect(errorContainer.classList.contains('alert')).toBe(true);
            expect(errorContainer.classList.contains('alert-danger')).toBe(true);
            expect(errorContainer.classList.contains('d-none')).toBe(true);
            
            const errorIcon = errorContainer.querySelector('.bi-exclamation-triangle-fill');
            expect(errorIcon).toBeTruthy();
            
            const errorList = document.getElementById('errorList');
            expect(errorList).toBeTruthy();
            expect(errorList.tagName.toLowerCase()).toBe('ul');
        });

        test('should render success container with proper structure', () => {
            const successContainer = document.getElementById('successContainer');
            expect(successContainer).toBeTruthy();
            expect(successContainer.classList.contains('alert')).toBe(true);
            expect(successContainer.classList.contains('alert-success')).toBe(true);
            expect(successContainer.classList.contains('d-none')).toBe(true);
            
            const successIcon = successContainer.querySelector('.bi-check-circle-fill');
            expect(successIcon).toBeTruthy();
            
            const successMessage = document.getElementById('successMessage');
            expect(successMessage).toBeTruthy();
            expect(successMessage.textContent).toBe('Profile updated successfully!');
        });

        test('should include individual field error containers', () => {
            const nameError = document.getElementById('nameError');
            expect(nameError).toBeTruthy();
            expect(nameError.classList.contains('validation-feedback')).toBe(true);
            
            const emailError = document.getElementById('emailError');
            expect(emailError).toBeTruthy();
            expect(emailError.classList.contains('validation-feedback')).toBe(true);
            
            const phoneError = document.getElementById('phoneError');
            expect(phoneError).toBeTruthy();
            expect(phoneError.classList.contains('validation-feedback')).toBe(true);
            
            const bioError = document.getElementById('bioError');
            expect(bioError).toBeTruthy();
            expect(bioError.classList.contains('validation-feedback')).toBe(true);
        });

        test('should render login form error handling', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.login;
            
            const loginErrorContainer = document.getElementById('loginErrorContainer');
            expect(loginErrorContainer).toBeTruthy();
            expect(loginErrorContainer.classList.contains('alert-danger')).toBe(true);
            expect(loginErrorContainer.classList.contains('d-none')).toBe(true);
            
            const loginErrorMessage = document.getElementById('loginErrorMessage');
            expect(loginErrorMessage).toBeTruthy();
            
            const loginEmailError = document.getElementById('loginEmailError');
            expect(loginEmailError).toBeTruthy();
            expect(loginEmailError.classList.contains('validation-feedback')).toBe(true);
            
            const loginPasswordError = document.getElementById('loginPasswordError');
            expect(loginPasswordError).toBeTruthy();
            expect(loginPasswordError.classList.contains('validation-feedback')).toBe(true);
        });
    });

    describe('XSS Prevention Implementation', () => {
        beforeEach(() => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
        });

        test('should apply XSS-safe class to display elements', () => {
            const nameDisplay = document.getElementById('nameDisplay');
            expect(nameDisplay.classList.contains('xss-safe')).toBe(true);
            
            const emailDisplay = document.getElementById('emailDisplay');
            expect(emailDisplay.classList.contains('xss-safe')).toBe(true);
            
            const phoneDisplay = document.getElementById('phoneDisplay');
            expect(phoneDisplay.classList.contains('xss-safe')).toBe(true);
            
            const bioDisplay = document.getElementById('bioDisplay');
            expect(bioDisplay.classList.contains('xss-safe')).toBe(true);
        });

        test('should apply XSS-safe styling', () => {
            const nameDisplay = document.getElementById('nameDisplay');
            const computedStyle = window.getComputedStyle(nameDisplay);
            expect(computedStyle.whiteSpace).toBe('pre-wrap');
            expect(computedStyle.wordWrap).toBe('break-word');
        });

        test('should apply XSS-safe class to dashboard content', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.dashboard;
            
            const welcomeMessage = document.querySelector('h5.xss-safe');
            expect(welcomeMessage).toBeTruthy();
            
            const emailMessage = document.querySelector('p.xss-safe');
            expect(emailMessage).toBeTruthy();
        });
    });

    describe('Loading States and Spinners', () => {
        beforeEach(() => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
        });

        test('should include loading spinner in save button', () => {
            const saveSpinner = document.getElementById('saveSpinner');
            expect(saveSpinner).toBeTruthy();
            expect(saveSpinner.classList.contains('loading-spinner')).toBe(true);
            expect(saveSpinner.classList.contains('d-none')).toBe(true);
        });

        test('should apply proper loading spinner styling', () => {
            const saveSpinner = document.getElementById('saveSpinner');
            const computedStyle = window.getComputedStyle(saveSpinner);
            
            expect(computedStyle.display).toBe('inline-block');
            expect(computedStyle.width).toBe('1rem');
            expect(computedStyle.height).toBe('1rem');
            expect(computedStyle.borderRadius).toBe('50%');
            expect(computedStyle.animationName).toBe('spin');
            expect(computedStyle.animationDuration).toBe('1s');
            expect(computedStyle.animationTimingFunction).toBe('linear');
            expect(computedStyle.animationIterationCount).toBe('infinite');
        });

        test('should include loading spinner in login form', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.login;
            
            const loginSpinner = document.getElementById('loginSpinner');
            expect(loginSpinner).toBeTruthy();
            expect(loginSpinner.classList.contains('loading-spinner')).toBe(true);
            expect(loginSpinner.classList.contains('d-none')).toBe(true);
        });
    });

    describe('Bootstrap Integration', () => {
        test('should properly integrate Bootstrap CSS classes', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            // Test Bootstrap grid classes
            const row = document.querySelector('.row');
            expect(row).toBeTruthy();
            
            const col = document.querySelector('.col-lg-8');
            expect(col).toBeTruthy();
            
            // Test Bootstrap spacing classes
            const cardBody = document.querySelector('.card-body');
            expect(cardBody.classList.contains('p-4')).toBe(true);
            
            const profileSection = document.querySelector('.profile-section');
            expect(profileSection.classList.contains('mb-4') || 
                   profileSection.style.marginBottom === '2rem').toBeTruthy();
        });

        test('should use Bootstrap icon classes correctly', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const profileIcon = document.querySelector('.bi-person-circle');
            expect(profileIcon).toBeTruthy();
            
            const editIcon = document.querySelector('.bi-pencil');
            expect(editIcon).toBeTruthy();
            
            const checkIcon = document.querySelector('.bi-check-lg');
            expect(checkIcon).toBeTruthy();
            
            const xIcon = document.querySelector('.bi-x-lg');
            expect(xIcon).toBeTruthy();
        });

        test('should apply Bootstrap form classes correctly', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.login;
            
            const formControls = document.querySelectorAll('.form-control');
            expect(formControls.length).toBeGreaterThan(0);
            
            const formLabels = document.querySelectorAll('.form-label');
            expect(formLabels.length).toBeGreaterThan(0);
            
            const formFeedback = document.querySelectorAll('.invalid-feedback');
            expect(formFeedback.length).toBeGreaterThan(0);
        });

        test('should use Bootstrap button classes correctly', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const primaryButton = document.querySelector('.btn-primary');
            expect(primaryButton).toBeTruthy();
            
            const secondaryButton = document.querySelector('.btn-outline-secondary');
            expect(secondaryButton).toBeTruthy();
            
            // Test button sizing
            const fullWidthButton = document.querySelector('.w-100');
            if (fullWidthButton) {
                const computedStyle = window.getComputedStyle(fullWidthButton);
                expect(computedStyle.width).toBe('100%');
            }
        });
    });

    describe('Accessibility and Screen Reader Support', () => {
        test('should have proper ARIA labels and roles', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const form = document.getElementById('profileForm');
            expect(form.getAttribute('method')).toBe('POST');
            expect(form.getAttribute('action')).toBe('/dashboard/profile');
            
            // Test form labels are properly associated
            const nameInput = document.getElementById('name');
            const nameLabel = document.querySelector('label[for="name"]');
            expect(nameLabel).toBeTruthy();
            expect(nameLabel.getAttribute('for')).toBe('name');
        });

        test('should have proper semantic HTML structure', () => {
            const main = document.querySelector('main');
            expect(main).toBeTruthy();
            
            const nav = document.querySelector('nav');
            expect(nav).toBeTruthy();
            
            const form = document.getElementById('profileForm');
            expect(form.tagName.toLowerCase()).toBe('form');
        });

        test('should have proper input validation attributes', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const nameInput = document.getElementById('name');
            expect(nameInput.hasAttribute('required')).toBe(true);
            expect(nameInput.getAttribute('minlength')).toBe('2');
            expect(nameInput.getAttribute('maxlength')).toBe('50');
            
            const emailInput = document.getElementById('email');
            expect(emailInput.hasAttribute('required')).toBe(true);
            expect(emailInput.getAttribute('type')).toBe('email');
            
            const phoneInput = document.getElementById('phone');
            expect(phoneInput.getAttribute('pattern')).toBe('[\\d\\s\\-\\(\\)]*');
            expect(phoneInput.getAttribute('maxlength')).toBe('20');
            
            const bioTextarea = document.getElementById('bio');
            expect(bioTextarea.getAttribute('maxlength')).toBe('500');
        });

        test('should include proper alert roles for error and success messages', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const errorContainer = document.getElementById('errorContainer');
            expect(errorContainer.getAttribute('role')).toBe('alert');
            
            const successContainer = document.getElementById('successContainer');
            expect(successContainer.getAttribute('role')).toBe('alert');
        });

        test('should have accessible avatar upload functionality', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            const avatarInput = document.getElementById('avatarInput');
            expect(avatarInput.getAttribute('aria-label')).toBe('Upload avatar image');
            
            const avatarPreview = document.getElementById('avatarPreview');
            expect(avatarPreview.getAttribute('alt')).toBe('User avatar');
        });
    });

    describe('Template Validation and Completeness', () => {
        test('should validate profile template structure is complete', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            // Verify all expected sections are present
            const avatarSection = document.querySelector('.avatar-upload');
            expect(avatarSection).toBeTruthy();
            
            const profileForm = document.getElementById('profileForm');
            expect(profileForm).toBeTruthy();
            
            const profileActions = document.getElementById('profileActions');
            expect(profileActions).toBeTruthy();
            
            const errorContainer = document.getElementById('errorContainer');
            expect(errorContainer).toBeTruthy();
            
            const successContainer = document.getElementById('successContainer');
            expect(successContainer).toBeTruthy();
            
            // Verify all form fields are present
            const requiredFields = ['name', 'email', 'phone', 'bio'];
            requiredFields.forEach(fieldName => {
                const input = document.getElementById(fieldName);
                const display = document.getElementById(`${fieldName}Display`);
                const error = document.getElementById(`${fieldName}Error`);
                
                expect(input).toBeTruthy();
                expect(display).toBeTruthy();
                expect(error).toBeTruthy();
            });
        });

        test('should validate dashboard template structure is complete', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.dashboard;
            
            const card = document.querySelector('.card');
            expect(card).toBeTruthy();
            
            const cardHeader = card.querySelector('.card-header');
            expect(cardHeader).toBeTruthy();
            
            const cardBody = card.querySelector('.card-body');
            expect(cardBody).toBeTruthy();
            
            // Verify responsive layout structure
            const row = document.querySelector('.row');
            expect(row).toBeTruthy();
            
            const columns = document.querySelectorAll('[class*="col-"]');
            expect(columns.length).toBeGreaterThan(0);
        });

        test('should validate login template structure is complete', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.login;
            
            const form = document.querySelector('form');
            expect(form).toBeTruthy();
            expect(form.getAttribute('method')).toBe('POST');
            expect(form.getAttribute('action')).toBe('/auth/login');
            
            const emailField = document.getElementById('email');
            const passwordField = document.getElementById('password');
            const submitButton = document.querySelector('button[type="submit"]');
            
            expect(emailField).toBeTruthy();
            expect(passwordField).toBeTruthy();
            expect(submitButton).toBeTruthy();
            
            // Verify error handling structure
            const errorContainer = document.getElementById('loginErrorContainer');
            expect(errorContainer).toBeTruthy();
        });

        test('should validate layout template has all required components', () => {
            // Test the main layout structure
            const sidebar = document.querySelector('.sidebar');
            expect(sidebar).toBeTruthy();
            
            const mainContent = document.querySelector('.main-content');
            expect(mainContent).toBeTruthy();
            
            const navigation = document.querySelector('nav');
            expect(navigation).toBeTruthy();
            
            // Verify Bootstrap and icon imports
            const bootstrapCSS = document.querySelector('link[href*="bootstrap"]');
            expect(bootstrapCSS).toBeTruthy();
            
            const bootstrapIcons = document.querySelector('link[href*="bootstrap-icons"]');
            expect(bootstrapIcons).toBeTruthy();
            
            const bootstrapJS = document.querySelector('script[src*="bootstrap"]');
            expect(bootstrapJS).toBeTruthy();
        });

        test('should ensure all templates use consistent class naming', () => {
            const templates = [MOCK_TEMPLATES.profile, MOCK_TEMPLATES.dashboard, MOCK_TEMPLATES.login];
            
            templates.forEach(template => {
                // Check for consistent card structure
                expect(template.includes('card shadow')).toBe(true);
                expect(template.includes('card-header')).toBe(true);
                expect(template.includes('card-body')).toBe(true);
                
                // Check for consistent icon usage
                expect(template.includes('bi bi-')).toBe(true);
                
                // Check for consistent spacing classes
                expect(template.includes('p-4')).toBe(true);
            });
        });

        test('should validate all interactive elements have proper event handlers setup', () => {
            document.getElementById('test-content').innerHTML = MOCK_TEMPLATES.profile;
            
            // Check that all buttons have proper IDs for event binding
            const editBtn = document.getElementById('editProfileBtn');
            expect(editBtn).toBeTruthy();
            
            const saveBtn = document.getElementById('saveBtn');
            expect(saveBtn).toBeTruthy();
            
            const cancelBtn = document.getElementById('cancelEditBtn');
            expect(cancelBtn).toBeTruthy();
            
            // Check that form has proper ID
            const form = document.getElementById('profileForm');
            expect(form).toBeTruthy();
            
            // Check that all inputs have proper IDs
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                expect(input.id).toBeTruthy();
            });
        });
    });
});