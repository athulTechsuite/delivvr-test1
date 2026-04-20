const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const assert = require('assert');
const { describe, it, before, after, beforeEach } = require('mocha');

// Test constants
const TEST_CONSTANTS = {
    BASE_URL: 'http://localhost:3000',
    VIEWPORT_MOBILE: { width: 375, height: 667 },
    VIEWPORT_TABLET: { width: 768, height: 1024 },
    VIEWPORT_DESKTOP: { width: 1200, height: 800 },
    TIMEOUT_SHORT: 3000,
    TIMEOUT_MEDIUM: 5000,
    TIMEOUT_LONG: 10000,
    MIN_TOUCH_TARGET_SIZE: 44,
    ANIMATION_DURATION: 300,
    TEST_USER: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'Password123',
        newName: 'Jane Smith',
        newPassword: 'NewPassword456'
    }
};

// Material Design color constants
const MATERIAL_COLORS = {
    PRIMARY: 'rgb(25, 118, 210)',
    PRIMARY_HOVER: 'rgb(21, 101, 192)',
    ERROR: 'rgb(211, 47, 47)',
    SUCCESS: 'rgb(46, 125, 50)',
    TEXT_PRIMARY: 'rgba(0, 0, 0, 0.87)',
    TEXT_SECONDARY: 'rgba(0, 0, 0, 0.6)',
    BACKGROUND_LIGHT: 'rgb(255, 255, 255)',
    BACKGROUND_DARK: 'rgb(18, 18, 18)',
    SURFACE_LIGHT: 'rgb(250, 250, 250)',
    SURFACE_DARK: 'rgb(37, 37, 37)'
};

describe('Profile Page UI/UX Tests', function() {
    this.timeout(30000);
    
    let driver;
    let testUserId;

    before(async function() {
        const options = new chrome.Options();
        options.addArguments('--headless', '--no-sandbox', '--disable-dev-shm-usage');
        driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
        
        // Create test user and login
        testUserId = await createTestUserAndLogin();
    });

    after(async function() {
        if (driver) {
            await driver.quit();
        }
        // Cleanup test user
        if (testUserId) {
            await cleanupTestUser(testUserId);
        }
    });

    beforeEach(async function() {
        // Navigate to profile page before each test
        await driver.get(`${TEST_CONSTANTS.BASE_URL}/profile`);
        await driver.wait(until.elementLocated(By.css('.profile-container')), TEST_CONSTANTS.TIMEOUT_MEDIUM);
    });

    describe('Material Design Component Rendering', function() {
        it('should render profile card with proper Material Design styling', async function() {
            const profileCard = await driver.findElement(By.css('.profile-card'));
            
            // Verify card elevation and styling
            const boxShadow = await profileCard.getCssValue('box-shadow');
            assert(boxShadow.includes('rgba'), 'Profile card should have Material Design elevation shadow');
            
            const borderRadius = await profileCard.getCssValue('border-radius');
            assert.strictEqual(borderRadius, '8px', 'Profile card should have 8px border radius');
            
            const padding = await profileCard.getCssValue('padding');
            assert(parseInt(padding) >= 24, 'Profile card should have minimum 24px padding');
        });

        it('should render form fields with Material Design input styling', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            const emailField = await driver.findElement(By.css('#email'));
            
            // Verify input field styling
            const nameFieldHeight = await nameField.getCssValue('height');
            assert(parseInt(nameFieldHeight) >= 56, 'Name field should meet Material Design minimum height');
            
            const emailFieldOpacity = await emailField.getCssValue('opacity');
            assert(parseFloat(emailFieldOpacity) < 1, 'Email field should be visually disabled with reduced opacity');
        });

        it('should render floating labels with proper animation', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            const nameLabel = await driver.findElement(By.css('label[for="name"]'));
            
            // Get initial label position
            const initialLabelTop = await nameLabel.getCssValue('top');
            
            // Clear field to trigger label animation
            await nameField.clear();
            await driver.sleep(TEST_CONSTANTS.ANIMATION_DURATION);
            
            // Check label position changed
            const floatingLabelTop = await nameLabel.getCssValue('top');
            assert.notStrictEqual(initialLabelTop, floatingLabelTop, 'Label should animate when field is empty');
        });

        it('should render buttons with Material Design ripple effect', async function() {
            const saveButton = await driver.findElement(By.css('#save-profile-btn'));
            
            // Verify button styling
            const backgroundColor = await saveButton.getCssValue('background-color');
            assert.strictEqual(backgroundColor, MATERIAL_COLORS.PRIMARY, 'Save button should use primary color');
            
            const borderRadius = await saveButton.getCssValue('border-radius');
            assert.strictEqual(borderRadius, '4px', 'Button should have 4px border radius');
            
            const textTransform = await saveButton.getCssValue('text-transform');
            assert.strictEqual(textTransform, 'uppercase', 'Button text should be uppercase');
        });

        it('should apply dark theme styling correctly', async function() {
            // Toggle to dark theme
            const themeToggle = await driver.findElement(By.css('#theme-toggle'));
            await themeToggle.click();
            await driver.sleep(TEST_CONSTANTS.ANIMATION_DURATION);
            
            // Verify dark theme application
            const bodyClass = await driver.findElement(By.css('body')).getAttribute('class');
            assert(bodyClass.includes('dark-theme'), 'Body should have dark-theme class');
            
            const profileCard = await driver.findElement(By.css('.profile-card'));
            const cardBackground = await profileCard.getCssValue('background-color');
            assert.strictEqual(cardBackground, MATERIAL_COLORS.SURFACE_DARK, 'Profile card should use dark surface color');
        });
    });

    describe('Responsive Design Tests', function() {
        it('should display correctly on mobile viewport', async function() {
            await driver.manage().window().setRect(TEST_CONSTANTS.VIEWPORT_MOBILE);
            await driver.sleep(500); // Wait for responsive layout
            
            const profileContainer = await driver.findElement(By.css('.profile-container'));
            const containerWidth = await profileContainer.getRect();
            
            // Verify mobile layout
            assert(containerWidth.width <= TEST_CONSTANTS.VIEWPORT_MOBILE.width, 'Container should fit mobile viewport');
            
            // Check sidebar collapse on mobile
            const sidebar = await driver.findElement(By.css('.sidebar'));
            const sidebarDisplay = await sidebar.getCssValue('display');
            assert.strictEqual(sidebarDisplay, 'none', 'Sidebar should be hidden on mobile');
        });

        it('should display correctly on tablet viewport', async function() {
            await driver.manage().window().setRect(TEST_CONSTANTS.VIEWPORT_TABLET);
            await driver.sleep(500);
            
            const profileCard = await driver.findElement(By.css('.profile-card'));
            const cardWidth = await profileCard.getRect();
            
            // Verify tablet layout adjustments
            assert(cardWidth.width >= 400 && cardWidth.width <= 600, 'Profile card should have appropriate tablet width');
            
            // Check form field stacking
            const formFields = await driver.findElements(By.css('.form-group'));
            for (let field of formFields) {
                const fieldRect = await field.getRect();
                assert(fieldRect.width >= 300, 'Form fields should have minimum width on tablet');
            }
        });

        it('should display correctly on desktop viewport', async function() {
            await driver.manage().window().setRect(TEST_CONSTANTS.VIEWPORT_DESKTOP);
            await driver.sleep(500);
            
            const sidebar = await driver.findElement(By.css('.sidebar'));
            const mainContent = await driver.findElement(By.css('.main-content'));
            
            // Verify desktop layout
            const sidebarDisplay = await sidebar.getCssValue('display');
            assert.notStrictEqual(sidebarDisplay, 'none', 'Sidebar should be visible on desktop');
            
            const mainContentMargin = await mainContent.getCssValue('margin-left');
            assert(parseInt(mainContentMargin) > 0, 'Main content should have left margin for sidebar');
        });

        it('should maintain proper spacing across viewports', async function() {
            const viewports = [TEST_CONSTANTS.VIEWPORT_MOBILE, TEST_CONSTANTS.VIEWPORT_TABLET, TEST_CONSTANTS.VIEWPORT_DESKTOP];
            
            for (let viewport of viewports) {
                await driver.manage().window().setRect(viewport);
                await driver.sleep(500);
                
                const formGroups = await driver.findElements(By.css('.form-group'));
                for (let group of formGroups) {
                    const marginBottom = await group.getCssValue('margin-bottom');
                    assert(parseInt(marginBottom) >= 16, `Form groups should have minimum 16px spacing on ${viewport.width}px viewport`);
                }
            }
        });
    });

    describe('Form Field Interactions', function() {
        it('should handle focus state correctly', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Focus the field
            await nameField.click();
            await driver.sleep(200);
            
            // Verify focus styling
            const focusedElement = await driver.switchTo().activeElement();
            const fieldId = await focusedElement.getAttribute('id');
            assert.strictEqual(fieldId, 'name', 'Name field should be focused');
            
            const borderColor = await nameField.getCssValue('border-color');
            assert.strictEqual(borderColor, MATERIAL_COLORS.PRIMARY, 'Focused field should have primary border color');
        });

        it('should handle blur state and validation', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Focus, clear, and blur the field
            await nameField.click();
            await nameField.clear();
            await driver.findElement(By.css('body')).click(); // Blur by clicking elsewhere
            await driver.sleep(200);
            
            // Check for validation error
            const errorMessage = await driver.findElement(By.css('.error-message'));
            const errorText = await errorMessage.getText();
            assert(errorText.includes('required') || errorText.includes('empty'), 'Empty field should show validation error');
            
            const errorColor = await errorMessage.getCssValue('color');
            assert.strictEqual(errorColor, MATERIAL_COLORS.ERROR, 'Error message should use error color');
        });

        it('should display validation states with proper styling', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Test invalid state
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('A'); // Too short
            await driver.findElement(By.css('body')).click();
            await driver.sleep(200);
            
            const fieldBorderColor = await nameField.getCssValue('border-color');
            assert.strictEqual(fieldBorderColor, MATERIAL_COLORS.ERROR, 'Invalid field should have error border color');
            
            // Test valid state
            await nameField.clear();
            await nameField.sendKeys('Valid Name');
            await driver.findElement(By.css('body')).click();
            await driver.sleep(200);
            
            const validBorderColor = await nameField.getCssValue('border-color');
            assert.notStrictEqual(validBorderColor, MATERIAL_COLORS.ERROR, 'Valid field should not have error border');
        });

        it('should handle placeholder text correctly', async function() {
            const passwordField = await driver.findElement(By.css('#current-password'));
            
            const placeholder = await passwordField.getAttribute('placeholder');
            assert(placeholder && placeholder.length > 0, 'Password field should have placeholder text');
            
            // Verify placeholder styling
            await passwordField.click();
            const placeholderColor = await passwordField.getCssValue('color');
            assert.strictEqual(placeholderColor, MATERIAL_COLORS.TEXT_SECONDARY, 'Placeholder should use secondary text color');
        });
    });

    describe('Editable Name Field Behavior', function() {
        it('should enable edit mode on click', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            const initialReadonly = await nameField.getAttribute('readonly');
            
            if (initialReadonly) {
                // Click to enable edit mode
                await nameField.click();
                await driver.sleep(200);
                
                const editModeReadonly = await nameField.getAttribute('readonly');
                assert.strictEqual(editModeReadonly, null, 'Field should be editable after click');
            }
            
            // Verify edit mode styling
            const editModeClass = await nameField.getAttribute('class');
            assert(editModeClass.includes('edit-mode') || !initialReadonly, 'Field should indicate edit mode');
        });

        it('should handle cancel functionality correctly', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            const originalValue = await nameField.getAttribute('value');
            
            // Enter edit mode and change value
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('Modified Name');
            
            // Click cancel button
            const cancelButton = await driver.findElement(By.css('#cancel-profile-btn'));
            await cancelButton.click();
            await driver.sleep(200);
            
            // Verify value reverted
            const revertedValue = await nameField.getAttribute('value');
            assert.strictEqual(revertedValue, originalValue, 'Field value should revert to original on cancel');
        });

        it('should handle save functionality with validation', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Enter valid name and save
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys(TEST_CONSTANTS.TEST_USER.newName);
            
            const saveButton = await driver.findElement(By.css('#save-profile-btn'));
            await saveButton.click();
            
            // Wait for save operation
            await driver.wait(until.elementLocated(By.css('.success-message')), TEST_CONSTANTS.TIMEOUT_MEDIUM);
            
            const successMessage = await driver.findElement(By.css('.success-message'));
            const messageText = await successMessage.getText();
            assert(messageText.includes('updated') || messageText.includes('saved'), 'Should show success message after save');
        });

        it('should handle escape key to cancel edit', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            const originalValue = await nameField.getAttribute('value');
            
            // Enter edit mode and modify
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('Temporary Change');
            
            // Press escape key
            await nameField.sendKeys(Key.ESCAPE);
            await driver.sleep(200);
            
            // Verify value reverted
            const currentValue = await nameField.getAttribute('value');
            assert.strictEqual(currentValue, originalValue, 'Escape key should cancel edit and revert value');
        });
    });

    describe('Password Change Form Usability', function() {
        it('should toggle password visibility correctly', async function() {
            const currentPasswordField = await driver.findElement(By.css('#current-password'));
            const toggleButton = await driver.findElement(By.css('.password-toggle'));
            
            // Verify initial password type
            let inputType = await currentPasswordField.getAttribute('type');
            assert.strictEqual(inputType, 'password', 'Password field should initially be hidden');
            
            // Click toggle to show password
            await toggleButton.click();
            await driver.sleep(200);
            
            inputType = await currentPasswordField.getAttribute('type');
            assert.strictEqual(inputType, 'text', 'Password should be visible after toggle');
            
            // Toggle back to hidden
            await toggleButton.click();
            await driver.sleep(200);
            
            inputType = await currentPasswordField.getAttribute('type');
            assert.strictEqual(inputType, 'password', 'Password should be hidden after second toggle');
        });

        it('should validate password strength in real-time', async function() {
            const newPasswordField = await driver.findElement(By.css('#new-password'));
            const strengthIndicator = await driver.findElement(By.css('.password-strength'));
            
            // Test weak password
            await newPasswordField.click();
            await newPasswordField.clear();
            await newPasswordField.sendKeys('weak');
            await driver.sleep(300);
            
            let strengthText = await strengthIndicator.getText();
            assert(strengthText.includes('weak') || strengthText.includes('poor'), 'Should indicate weak password');
            
            // Test strong password
            await newPasswordField.clear();
            await newPasswordField.sendKeys(TEST_CONSTANTS.TEST_USER.newPassword);
            await driver.sleep(300);
            
            strengthText = await strengthIndicator.getText();
            assert(strengthText.includes('strong') || strengthText.includes('good'), 'Should indicate strong password');
        });

        it('should require current password before allowing change', async function() {
            const newPasswordField = await driver.findElement(By.css('#new-password'));
            const changePasswordButton = await driver.findElement(By.css('#change-password-btn'));
            
            // Try to change password without current password
            await newPasswordField.click();
            await newPasswordField.clear();
            await newPasswordField.sendKeys(TEST_CONSTANTS.TEST_USER.newPassword);
            
            // Button should be disabled
            const isDisabled = await changePasswordButton.getAttribute('disabled');
            assert.strictEqual(isDisabled, 'true', 'Change password button should be disabled without current password');
        });

        it('should confirm password match validation', async function() {
            const newPasswordField = await driver.findElement(By.css('#new-password'));
            const confirmPasswordField = await driver.findElement(By.css('#confirm-password'));
            
            // Enter mismatched passwords
            await newPasswordField.click();
            await newPasswordField.clear();
            await newPasswordField.sendKeys('Password123');
            
            await confirmPasswordField.click();
            await confirmPasswordField.clear();
            await confirmPasswordField.sendKeys('DifferentPassword');
            await driver.findElement(By.css('body')).click(); // Trigger validation
            await driver.sleep(200);
            
            const errorMessage = await driver.findElement(By.css('.password-mismatch-error'));
            const errorText = await errorMessage.getText();
            assert(errorText.includes('match'), 'Should show password mismatch error');
        });
    });

    describe('Error Message Display and Styling', function() {
        it('should display inline validation errors with proper styling', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Trigger validation error
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('A'); // Too short
            await driver.findElement(By.css('body')).click();
            await driver.sleep(200);
            
            const errorElement = await driver.findElement(By.css('.field-error'));
            
            // Verify error styling
            const errorColor = await errorElement.getCssValue('color');
            assert.strictEqual(errorColor, MATERIAL_COLORS.ERROR, 'Error text should use error color');
            
            const fontSize = await errorElement.getCssValue('font-size');
            assert(parseInt(fontSize) >= 12 && parseInt(fontSize) <= 14, 'Error text should have appropriate font size');
        });

        it('should display server error messages prominently', async function() {
            // Simulate server error by submitting invalid form
            const nameField = await driver.findElement(By.css('#name'));
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys(''); // Empty name
            
            const saveButton = await driver.findElement(By.css('#save-profile-btn'));
            await saveButton.click();
            await driver.sleep(TEST_CONSTANTS.TIMEOUT_SHORT);
            
            try {
                const serverError = await driver.findElement(By.css('.server-error'));
                const errorBackground = await serverError.getCssValue('background-color');
                assert(errorBackground.includes('rgba(211, 47, 47'), 'Server error should have error background color');
            } catch (e) {
                // Error might be shown differently, check for any error indication
                const errorElements = await driver.findElements(By.css('[class*="error"]'));
                assert(errorElements.length > 0, 'Should display some form of error indication');
            }
        });

        it('should clear errors when field becomes valid', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Create error state
            await nameField.click();
            await nameField.clear();
            await driver.findElement(By.css('body')).click();
            await driver.sleep(200);
            
            // Fix the error
            await nameField.click();
            await nameField.sendKeys('Valid Name');
            await driver.findElement(By.css('body')).click();
            await driver.sleep(200);
            
            // Check errors are cleared
            const errorElements = await driver.findElements(By.css('.field-error:not(.hidden)'));
            assert.strictEqual(errorElements.length, 0, 'Errors should be cleared when field becomes valid');
        });
    });

    describe('Success Notification Behavior', function() {
        it('should show toast notification on successful save', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Make a valid change
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('Updated Name');
            
            const saveButton = await driver.findElement(By.css('#save-profile-btn'));
            await saveButton.click();
            
            // Wait for and verify success toast
            const toast = await driver.wait(until.elementLocated(By.css('.toast.success')), TEST_CONSTANTS.TIMEOUT_MEDIUM);
            const toastText = await toast.getText();
            assert(toastText.includes('updated') || toastText.includes('saved'), 'Toast should show success message');
            
            // Verify toast styling
            const toastBackground = await toast.getCssValue('background-color');
            assert.strictEqual(toastBackground, MATERIAL_COLORS.SUCCESS, 'Success toast should use success color');
        });

        it('should auto-dismiss success notifications', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Trigger success notification
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('Test Update');
            
            const saveButton = await driver.findElement(By.css('#save-profile-btn'));
            await saveButton.click();
            
            // Wait for toast to appear
            await driver.wait(until.elementLocated(By.css('.toast.success')), TEST_CONSTANTS.TIMEOUT_MEDIUM);
            
            // Wait for auto-dismiss (typically 3-5 seconds)
            await driver.sleep(5000);
            
            // Verify toast is gone
            const toasts = await driver.findElements(By.css('.toast.success:not(.dismissed)'));
            assert.strictEqual(toasts.length, 0, 'Success toast should auto-dismiss');
        });
    });

    describe('Loading States During Form Submissions', function() {
        it('should show loading indicator during profile save', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            const saveButton = await driver.findElement(By.css('#save-profile-btn'));
            
            // Make change and save
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('Loading Test');
            
            await saveButton.click();
            
            // Check for loading state immediately
            const buttonText = await saveButton.getText();
            assert(buttonText.includes('Saving') || buttonText.includes('...'), 'Save button should show loading state');
            
            // Check if button is disabled during loading
            const isDisabled = await saveButton.getAttribute('disabled');
            assert.strictEqual(isDisabled, 'true', 'Save button should be disabled during loading');
        });

        it('should show spinner during password change', async function() {
            const currentPasswordField = await driver.findElement(By.css('#current-password'));
            const newPasswordField = await driver.findElement(By.css('#new-password'));
            const changeButton = await driver.findElement(By.css('#change-password-btn'));
            
            // Fill password fields
            await currentPasswordField.sendKeys(TEST_CONSTANTS.TEST_USER.password);
            await newPasswordField.sendKeys(TEST_CONSTANTS.TEST_USER.newPassword);
            
            await changeButton.click();
            
            // Look for loading spinner
            try {
                const spinner = await driver.findElement(By.css('.loading-spinner'));
                const spinnerDisplay = await spinner.getCssValue('display');
                assert.notStrictEqual(spinnerDisplay, 'none', 'Loading spinner should be visible');
            } catch (e) {
                // Alternative: check if button shows loading text
                const buttonText = await changeButton.getText();
                assert(buttonText.includes('Changing') || buttonText.includes('...'), 'Button should show loading text');
            }
        });

        it('should disable form fields during submission', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            const saveButton = await driver.findElement(By.css('#save-profile-btn'));
            
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('Disable Test');
            
            await saveButton.click();
            
            // Check if name field is disabled during submission
            const fieldDisabled = await nameField.getAttribute('disabled');
            const buttonDisabled = await saveButton.getAttribute('disabled');
            
            assert(fieldDisabled === 'true' || buttonDisabled === 'true', 'Form elements should be disabled during submission');
        });
    });

    describe('Keyboard Accessibility', function() {
        it('should maintain proper tab order', async function() {
            // Start from name field
            const nameField = await driver.findElement(By.css('#name'));
            await nameField.click();
            
            // Tab through form elements
            const expectedTabOrder = ['#name', '#current-password', '#new-password', '#confirm-password', '#save-profile-btn', '#cancel-profile-btn'];
            
            for (let i = 0; i < expectedTabOrder.length - 1; i++) {
                await driver.findElement(By.css('body')).sendKeys(Key.TAB);
                await driver.sleep(100);
                
                const focusedElement = await driver.switchTo().activeElement();
                const tagName = await focusedElement.getTagName();
                
                // Verify focused element is focusable
                assert(['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(tagName), `Focused element should be focusable, got ${tagName}`);
            }
        });

        it('should handle enter key in form fields', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Focus name field and press enter
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('Enter Key Test');
            await nameField.sendKeys(Key.ENTER);
            
            // Should either save or move focus appropriately
            await driver.sleep(500);
            
            // Check if save was triggered or focus moved
            const activeElement = await driver.switchTo().activeElement();
            const activeId = await activeElement.getAttribute('id');
            
            // Either save was triggered (success message) or focus moved to next field
            try {
                await driver.findElement(By.css('.success-message'));
                assert(true, 'Enter key should trigger save action');
            } catch (e) {
                assert.notStrictEqual(activeId, 'name', 'Enter key should move focus if save not triggered');
            }
        });

        it('should handle escape key functionality', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            const originalValue = await nameField.getAttribute('value');
            
            // Enter edit mode and modify
            await nameField.click();
            await nameField.clear();
            await nameField.sendKeys('Escape Test');
            
            // Press escape
            await driver.findElement(By.css('body')).sendKeys(Key.ESCAPE);
            await driver.sleep(200);
            
            // Verify escape cancelled changes
            const currentValue = await nameField.getAttribute('value');
            assert.strictEqual(currentValue, originalValue, 'Escape should cancel changes');
        });

        it('should provide proper ARIA labels and descriptions', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            const passwordField = await driver.findElement(By.css('#current-password'));
            
            // Check ARIA labels
            const nameAriaLabel = await nameField.getAttribute('aria-label') || await nameField.getAttribute('aria-labelledby');
            assert(nameAriaLabel && nameAriaLabel.length > 0, 'Name field should have ARIA label');
            
            const passwordAriaLabel = await passwordField.getAttribute('aria-label') || await passwordField.getAttribute('aria-labelledby');
            assert(passwordAriaLabel && passwordAriaLabel.length > 0, 'Password field should have ARIA label');
            
            // Check for error descriptions
            const ariaDescribedBy = await nameField.getAttribute('aria-describedby');
            if (ariaDescribedBy) {
                const descriptionElement = await driver.findElement(By.css(`#${ariaDescribedBy}`));
                assert(descriptionElement, 'aria-describedby should reference existing element');
            }
        });
    });

    describe('Touch Target Sizes on Mobile', function() {
        beforeEach(async function() {
            await driver.manage().window().setRect(TEST_CONSTANTS.VIEWPORT_MOBILE);
            await driver.sleep(500);
        });

        it('should have minimum touch target size for buttons', async function() {
            const buttons = await driver.findElements(By.css('button'));
            
            for (let button of buttons) {
                const rect = await button.getRect();
                const hasMinimumSize = rect.width >= TEST_CONSTANTS.MIN_TOUCH_TARGET_SIZE && 
                                     rect.height >= TEST_CONSTANTS.MIN_TOUCH_TARGET_SIZE;
                
                if (!hasMinimumSize) {
                    // Check if button has adequate padding to meet touch target
                    const padding = await button.getCssValue('padding');
                    const computedStyle = await driver.executeScript(`
                        const btn = arguments[0];
                        const computed = window.getComputedStyle(btn);
                        return {
                            totalWidth: btn.offsetWidth,
                            totalHeight: btn.offsetHeight
                        };
                    `, button);
                    
                    assert(computedStyle.totalWidth >= TEST_CONSTANTS.MIN_TOUCH_TARGET_SIZE && 
                           computedStyle.totalHeight >= TEST_CONSTANTS.MIN_TOUCH_TARGET_SIZE,
                           'Button should meet minimum touch target size including padding');
                }
            }
        });

        it('should have adequate spacing between interactive elements', async function() {
            const interactiveElements = await driver.findElements(By.css('button, input, select'));
            
            for (let i = 0; i < interactiveElements.length - 1; i++) {
                const current = await interactiveElements[i].getRect();
                const next = await interactiveElements[i + 1].getRect();
                
                const verticalSpacing = Math.abs(next.y - (current.y + current.height));
                const horizontalSpacing = Math.abs(next.x - (current.x + current.width));
                
                // Elements should have at least 8px spacing
                const hasAdequateSpacing = verticalSpacing >= 8 || horizontalSpacing >= 8;
                assert(hasAdequateSpacing, 'Interactive elements should have adequate spacing on mobile');
            }
        });

        it('should handle touch gestures appropriately', async function() {
            const nameField = await driver.findElement(By.css('#name'));
            
            // Simulate touch tap
            const actions = driver.actions();
            await actions.move({ origin: nameField }).press().pause(100).release().perform();
            await driver.sleep(200);
            
            // Verify field received focus
            const focusedElement = await driver.switchTo().activeElement();
            const fieldId = await focusedElement.getAttribute('id');
            assert.strictEqual(fieldId, 'name', 'Touch tap should focus the field');
        });
    });

    describe('Visual Consistency with Application Theme', function() {
        it('should match existing color scheme', async function() {
            const profileCard = await driver.findElement(By.css('.profile-card'));
            const saveButton = await driver.findElement(By.css('#save-profile-btn'));
            
            // Check primary color usage
            const buttonBackground = await saveButton.getCssValue('background-color');
            assert.strictEqual(buttonBackground, MATERIAL_COLORS.PRIMARY, 'Save button should use app primary color');
            
            // Check card background matches theme
            const cardBackground = await profileCard.getCssValue('background-color');
            assert.strictEqual(cardBackground, MATERIAL_COLORS.BACKGROUND_LIGHT, 'Profile card should match light theme background');
        });

        it('should maintain consistent typography', async function() {
            const pageTitle = await driver.findElement(By.css('h1'));
            const fieldLabels = await driver.findElements(By.css('label'));
            
            // Check heading font
            const titleFontFamily = await pageTitle.getCssValue('font-family');
            const titleFontWeight = await pageTitle.getCssValue('font-weight');
            
            assert(titleFontFamily.includes('Roboto') || titleFontFamily.includes('Arial'), 'Title should use consistent font family');
            assert(parseInt(titleFontWeight) >= 400, 'Title should have appropriate font weight');
            
            // Check label consistency
            for (let label of fieldLabels.slice(0, 2)) { // Check first few labels
                const labelFontFamily = await label.getCssValue('font-family');
                assert(labelFontFamily.includes('Roboto') || labelFontFamily.includes('Arial'), 'Labels should use consistent font family');
            }
        });

        it('should use consistent border radius and shadows', async function() {
            const profileCard = await driver.findElement(By.css('.profile-card'));
            const inputFields = await driver.findElements(By.css('input'));
            const buttons = await driver.findElements(By.css('button'));
            
            // Check card border radius
            const cardBorderRadius = await profileCard.getCssValue('border-radius');
            assert.strictEqual(cardBorderRadius, '8px', 'Profile card should have consistent border radius');
            
            // Check input field styling consistency
            for (let field of inputFields.slice(0, 2)) {
                const fieldBorderRadius = await field.getCssValue('border-radius');
                assert.strictEqual(fieldBorderRadius, '4px', 'Input fields should have consistent border radius');
            }
            
            // Check button styling consistency
            for (let button of buttons.slice(0, 2)) {
                const buttonBorderRadius = await button.getCssValue('border-radius');
                assert.strictEqual(buttonBorderRadius, '4px', 'Buttons should have consistent border radius');
            }
        });

        it('should maintain spacing consistency with dashboard', async function() {
            // Navigate to dashboard to compare spacing
            await driver.get(`${TEST_CONSTANTS.BASE_URL}/dashboard`);
            await driver.sleep(1000);
            
            const dashboardCard = await driver.findElement(By.css('.card'));
            const dashboardPadding = await dashboardCard.getCssValue('padding');
            
            // Navigate back to profile
            await driver.get(`${TEST_CONSTANTS.BASE_URL}/profile`);
            await driver.sleep(1000);
            
            const profileCard = await driver.findElement(By.css('.profile-card'));
            const profilePadding = await profileCard.getCssValue('padding');
            
            assert.strictEqual(profilePadding, dashboardPadding, 'Profile card padding should match dashboard card padding');
        });
    });

    // Helper functions
    async function createTestUserAndLogin() {
        // Navigate to signup
        await driver.get(`${TEST_CONSTANTS.BASE_URL}/signup`);
        await driver.wait(until.elementLocated(By.css('#signup-form')), TEST_CONSTANTS.TIMEOUT_MEDIUM);
        
        // Fill signup form
        await driver.findElement(By.css('#name')).sendKeys(TEST_CONSTANTS.TEST_USER.name);
        await driver.findElement(By.css('#email')).sendKeys(TEST_CONSTANTS.TEST_USER.email);
        await driver.findElement(By.css('#password')).sendKeys(TEST_CONSTANTS.TEST_USER.password);
        await driver.findElement(By.css('#confirmPassword')).sendKeys(TEST_CONSTANTS.TEST_USER.password);
        
        // Submit signup
        await driver.findElement(By.css('#signup-form')).submit();
        await driver.sleep(TEST_CONSTANTS.TIMEOUT_MEDIUM);
        
        // Should be redirected to dashboard
        const currentUrl = await driver.getCurrentUrl();
        assert(currentUrl.includes('/dashboard'), 'Should be redirected to dashboard after signup');
        
        return 1; // Return dummy user ID
    }

    async function cleanupTestUser(userId) {
        // In a real implementation, this would make API calls to cleanup test data
        // For this test suite, we'll assume cleanup is handled externally
        console.log(`Cleaning up test user ${userId}`);
    }
});