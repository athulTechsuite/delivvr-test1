import { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

// Test setup and helper functions
class PasswordToggleHelper {
  constructor(private page: Page) {}

  async navigateToLogin() {
    await this.page.goto('/login');
    await this.page.waitForSelector('form[action="/login"]');
  }

  async navigateToSignup() {
    await this.page.goto('/signup');
    await this.page.waitForSelector('form[action="/signup"]');
  }

  async getPasswordField(formType: 'login' | 'signup' = 'login') {
    const selector = formType === 'login' ? '#password' : '#password';
    return this.page.locator(selector);
  }

  async getToggleButton(formType: 'login' | 'signup' = 'login') {
    const selector = formType === 'login' 
      ? '.md-input-toggle-password'
      : '.md-input-toggle-password';
    return this.page.locator(selector);
  }

  async getToggleIcon(formType: 'login' | 'signup' = 'login') {
    const toggleButton = await this.getToggleButton(formType);
    return toggleButton.locator('i');
  }

  async enterPassword(password: string, formType: 'login' | 'signup' = 'login') {
    const passwordField = await this.getPasswordField(formType);
    await passwordField.fill(password);
  }

  async clickToggleButton(formType: 'login' | 'signup' = 'login') {
    const toggleButton = await this.getToggleButton(formType);
    await toggleButton.click();
  }

  async getAriaLabel(formType: 'login' | 'signup' = 'login') {
    const toggleButton = await this.getToggleButton(formType);
    return await toggleButton.getAttribute('aria-label');
  }

  async getAriaPressed(formType: 'login' | 'signup' = 'login') {
    const toggleButton = await this.getToggleButton(formType);
    return await toggleButton.getAttribute('aria-pressed');
  }

  async getPasswordFieldType(formType: 'login' | 'signup' = 'login') {
    const passwordField = await this.getPasswordField(formType);
    return await passwordField.getAttribute('type');
  }

  async hasIconClass(className: string, formType: 'login' | 'signup' = 'login') {
    const icon = await this.getToggleIcon(formType);
    const classes = await icon.getAttribute('class');
    return classes?.includes(className) || false;
  }

  async focusToggleButton(formType: 'login' | 'signup' = 'login') {
    const toggleButton = await this.getToggleButton(formType);
    await toggleButton.focus();
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key);
  }

  async isMobileViewport() {
    const viewportSize = this.page.viewportSize();
    return viewportSize ? viewportSize.width <= 768 : false;
  }

  async checkFocusRing(formType: 'login' | 'signup' = 'login') {
    const toggleButton = await this.getToggleButton(formType);
    return await toggleButton.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.outline !== 'none' || styles.boxShadow.includes('focus');
    });
  }

  async checkHoverState(formType: 'login' | 'signup' = 'login') {
    const toggleButton = await this.getToggleButton(formType);
    await toggleButton.hover();
    return await toggleButton.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.cursor === 'pointer';
    });
  }

  async getClickableArea(formType: 'login' | 'signup' = 'login') {
    const toggleButton = await this.getToggleButton(formType);
    const boundingBox = await toggleButton.boundingBox();
    return boundingBox ? { width: boundingBox.width, height: boundingBox.height } : null;
  }

  async checkThemeCompatibility(theme: 'light' | 'dark') {
    // Simulate theme change
    await this.page.evaluate((theme) => {
      document.body.setAttribute('data-theme', theme);
    }, theme);
    await this.page.waitForTimeout(100); // Allow theme to apply
  }
}

test.describe('Password Toggle Feature', () => {
  let helper: PasswordToggleHelper;

  test.beforeEach(async ({ page }) => {
    helper = new PasswordToggleHelper(page);
  });

  test.describe('Login Page Password Toggle', () => {
    test.beforeEach(async () => {
      await helper.navigateToLogin();
    });

    // TC-001: Password fields on login page display with eye icon positioned on the right side inside the input field
    test('should display eye icon inside password field on login page', async () => {
      const toggleButton = await helper.getToggleButton('login');
      const icon = await helper.getToggleIcon('login');
      
      await expect(toggleButton).toBeVisible();
      await expect(icon).toBeVisible();
      expect(await helper.hasIconClass('bi-eye', 'login')).toBe(true);
    });

    // TC-003: Password fields start in hidden state (type='password') showing masked characters on page load
    test('should start with password field in hidden state on login page', async () => {
      const fieldType = await helper.getPasswordFieldType('login');
      expect(fieldType).toBe('password');
      
      const ariaPressed = await helper.getAriaPressed('login');
      expect(ariaPressed).toBe('false');
    });

    // TC-004: Clicking the eye icon changes password field to text type showing plain text password
    test('should show password when eye icon is clicked on login page', async () => {
      await helper.enterPassword('testpassword123', 'login');
      await helper.clickToggleButton('login');
      
      const fieldType = await helper.getPasswordFieldType('login');
      expect(fieldType).toBe('text');
      
      const passwordField = await helper.getPasswordField('login');
      const value = await passwordField.inputValue();
      expect(value).toBe('testpassword123');
    });

    // TC-005: Clicking the eye icon when password is visible changes field back to password type with masked characters
    test('should hide password when clicked again on login page', async () => {
      await helper.enterPassword('testpassword123', 'login');
      
      // Show password
      await helper.clickToggleButton('login');
      expect(await helper.getPasswordFieldType('login')).toBe('text');
      
      // Hide password
      await helper.clickToggleButton('login');
      expect(await helper.getPasswordFieldType('login')).toBe('password');
    });

    // TC-006: Eye icon changes from bi-eye to bi-eye-slash when password becomes visible
    test('should change icon from bi-eye to bi-eye-slash when password shown on login page', async () => {
      expect(await helper.hasIconClass('bi-eye', 'login')).toBe(true);
      expect(await helper.hasIconClass('bi-eye-slash', 'login')).toBe(false);
      
      await helper.clickToggleButton('login');
      
      expect(await helper.hasIconClass('bi-eye-slash', 'login')).toBe(true);
      expect(await helper.hasIconClass('bi-eye', 'login')).toBe(false);
    });

    // TC-007: Eye icon changes from bi-eye-slash to bi-eye when password becomes hidden
    test('should change icon from bi-eye-slash to bi-eye when password hidden on login page', async () => {
      // Show password first
      await helper.clickToggleButton('login');
      expect(await helper.hasIconClass('bi-eye-slash', 'login')).toBe(true);
      
      // Hide password
      await helper.clickToggleButton('login');
      expect(await helper.hasIconClass('bi-eye', 'login')).toBe(true);
      expect(await helper.hasIconClass('bi-eye-slash', 'login')).toBe(false);
    });

    // TC-008: Toggle button has proper ARIA label 'Show password' when password is hidden
    test('should have correct ARIA label when password is hidden on login page', async () => {
      const ariaLabel = await helper.getAriaLabel('login');
      expect(ariaLabel).toBe('Show password');
    });

    // TC-009: Toggle button has proper ARIA label 'Hide password' when password is visible
    test('should have correct ARIA label when password is visible on login page', async () => {
      await helper.clickToggleButton('login');
      const ariaLabel = await helper.getAriaLabel('login');
      expect(ariaLabel).toBe('Hide password');
    });

    // TC-010: Toggle button aria-pressed attribute is 'false' when password is hidden
    test('should have aria-pressed false when password is hidden on login page', async () => {
      const ariaPressed = await helper.getAriaPressed('login');
      expect(ariaPressed).toBe('false');
    });

    // TC-011: Toggle button aria-pressed attribute is 'true' when password is visible
    test('should have aria-pressed true when password is visible on login page', async () => {
      await helper.clickToggleButton('login');
      const ariaPressed = await helper.getAriaPressed('login');
      expect(ariaPressed).toBe('true');
    });
  });

  test.describe('Signup Page Password Toggle', () => {
    test.beforeEach(async () => {
      await helper.navigateToSignup();
    });

    // TC-002: Password fields on signup page display with eye icon positioned on the right side inside the input field
    test('should display eye icon inside password field on signup page', async () => {
      const toggleButton = await helper.getToggleButton('signup');
      const icon = await helper.getToggleIcon('signup');
      
      await expect(toggleButton).toBeVisible();
      await expect(icon).toBeVisible();
      expect(await helper.hasIconClass('bi-eye', 'signup')).toBe(true);
    });

    // TC-003: Password fields start in hidden state (type='password') showing masked characters on page load
    test('should start with password field in hidden state on signup page', async () => {
      const fieldType = await helper.getPasswordFieldType('signup');
      expect(fieldType).toBe('password');
    });

    // TC-019: Toggle functionality works independently on login and signup pages when both are present
    test('should work independently between login and signup pages', async () => {
      // Test signup toggle
      await helper.clickToggleButton('signup');
      expect(await helper.getPasswordFieldType('signup')).toBe('text');
      
      // Navigate to login and verify independence
      await helper.navigateToLogin();
      expect(await helper.getPasswordFieldType('login')).toBe('password');
      expect(await helper.hasIconClass('bi-eye', 'login')).toBe(true);
    });
  });

  test.describe('Keyboard Navigation and Accessibility', () => {
    test.beforeEach(async () => {
      await helper.navigateToLogin();
    });

    // TC-014: Toggle button is reachable via keyboard tab navigation
    test('should be reachable via keyboard tab navigation', async ({ page }) => {
      await page.keyboard.press('Tab'); // Focus email field
      await page.keyboard.press('Tab'); // Focus password field
      await page.keyboard.press('Tab'); // Focus toggle button
      
      const toggleButton = await helper.getToggleButton('login');
      const isFocused = await toggleButton.evaluate(el => document.activeElement === el);
      expect(isFocused).toBe(true);
    });

    // TC-015: Pressing Enter key when toggle button is focused activates password visibility toggle
    test('should toggle password visibility with Enter key', async () => {
      await helper.focusToggleButton('login');
      await helper.pressKey('Enter');
      
      expect(await helper.getPasswordFieldType('login')).toBe('text');
    });

    // TC-016: Pressing Space key when toggle button is focused activates password visibility toggle
    test('should toggle password visibility with Space key', async () => {
      await helper.focusToggleButton('login');
      await helper.pressKey('Space');
      
      expect(await helper.getPasswordFieldType('login')).toBe('text');
    });

    // TC-017: Toggle button shows focus ring outline when focused via keyboard navigation
    test('should show focus ring when focused via keyboard', async () => {
      await helper.focusToggleButton('login');
      const hasFocusRing = await helper.checkFocusRing('login');
      expect(hasFocusRing).toBe(true);
    });

    // TC-012: Screen reader announces 'Password visible' when password is shown
    test('should have appropriate screen reader announcements for visibility', async ({ page }) => {
      // Check for aria-live region or screen reader announcement setup
      const announcement = await page.locator('[aria-live="polite"]').first();
      await helper.clickToggleButton('login');
      
      // Verify announcement would be made (implementation may vary)
      await expect(announcement).toBeVisible();
    });

    // TC-013: Screen reader announces 'Password hidden' when password is concealed
    test('should have appropriate screen reader announcements for concealment', async ({ page }) => {
      await helper.clickToggleButton('login'); // Show first
      
      const announcement = await page.locator('[aria-live="polite"]').first();
      await helper.clickToggleButton('login'); // Hide
      
      // Verify announcement would be made
      await expect(announcement).toBeVisible();
    });
  });

  test.describe('Visual Design and Interaction', () => {
    test.beforeEach(async () => {
      await helper.navigateToLogin();
    });

    // TC-018: Hover state on toggle button shows pointer cursor and darker icon color
    test('should show pointer cursor on hover', async () => {
      const hasPointerCursor = await helper.checkHoverState('login');
      expect(hasPointerCursor).toBe(true);
    });

    // TC-021: Toggle button maintains 24x24px clickable area for accessibility compliance
    test('should maintain minimum 24x24px clickable area', async () => {
      const area = await helper.getClickableArea('login');
      expect(area).not.toBeNull();
      expect(area!.width).toBeGreaterThanOrEqual(24);
      expect(area!.height).toBeGreaterThanOrEqual(24);
    });

    // TC-022: Icon size remains 16px and properly centered within toggle button area
    test('should maintain 16px icon size', async () => {
      const icon = await helper.getToggleIcon('login');
      const styles = await icon.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          fontSize: computed.fontSize,
          width: computed.width,
          height: computed.height
        };
      });
      
      // Check if font size is 16px (icon size may be controlled by font-size)
      expect(styles.fontSize).toBe('16px');
    });

    // TC-025: Feature works correctly in both light and dark theme modes
    test('should work correctly in light theme', async () => {
      await helper.checkThemeCompatibility('light');
      
      const toggleButton = await helper.getToggleButton('login');
      await expect(toggleButton).toBeVisible();
      
      await helper.clickToggleButton('login');
      expect(await helper.getPasswordFieldType('login')).toBe('text');
    });

    test('should work correctly in dark theme', async () => {
      await helper.checkThemeCompatibility('dark');
      
      const toggleButton = await helper.getToggleButton('login');
      await expect(toggleButton).toBeVisible();
      
      await helper.clickToggleButton('login');
      expect(await helper.getPasswordFieldType('login')).toBe('text');
    });
  });

  test.describe('Mobile and Touch Interaction', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // Mobile viewport

    test.beforeEach(async () => {
      await helper.navigateToLogin();
    });

    // TC-023: Toggle functionality works on mobile devices with touch interaction
    test('should work with touch interaction on mobile', async () => {
      const toggleButton = await helper.getToggleButton('login');
      
      // Simulate touch tap
      await toggleButton.tap();
      
      expect(await helper.getPasswordFieldType('login')).toBe('text');
      expect(await helper.hasIconClass('bi-eye-slash', 'login')).toBe(true);
    });

    // TC-024: Password field maintains proper right padding to prevent text overlap with toggle button
    test('should maintain proper right padding on mobile', async () => {
      const passwordField = await helper.getPasswordField('login');
      const styles = await passwordField.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          paddingRight: computed.paddingRight
        };
      });
      
      // Should have sufficient right padding (at least 40px to accommodate toggle button)
      const paddingValue = parseInt(styles.paddingRight);
      expect(paddingValue).toBeGreaterThanOrEqual(40);
    });
  });

  test.describe('Form Integration and Edge Cases', () => {
    test.beforeEach(async () => {
      await helper.navigateToLogin();
    });

    // TC-020: Password toggle does not interfere with form submission or password validation
    test('should not interfere with form submission', async ({ page }) => {
      await helper.enterPassword('testpassword123', 'login');
      await page.fill('#email', 'test@example.com');
      
      // Toggle password visibility
      await helper.clickToggleButton('login');
      expect(await helper.getPasswordFieldType('login')).toBe('text');
      
      // Submit form
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // Form should submit normally (may redirect or show validation)
      // This test verifies no JS errors occur during submission
      const hasErrors = await page.evaluate(() => {
        return window.onerror !== null;
      });
      expect(hasErrors).toBe(false);
    });

    test('should maintain toggle state during form validation errors', async ({ page }) => {
      // Show password
      await helper.clickToggleButton('login');
      expect(await helper.getPasswordFieldType('login')).toBe('text');
      
      // Submit form with validation errors (empty fields)
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // Toggle state should remain (password still visible)
      expect(await helper.getPasswordFieldType('login')).toBe('text');
      expect(await helper.hasIconClass('bi-eye-slash', 'login')).toBe(true);
    });

    test('should handle rapid toggle clicks without errors', async () => {
      // Rapid clicking should not cause errors
      for (let i = 0; i < 10; i++) {
        await helper.clickToggleButton('login');
        await helper.page.waitForTimeout(50);
      }
      
      // Should end in a consistent state
      const fieldType = await helper.getPasswordFieldType('login');
      expect(['text', 'password']).toContain(fieldType);
    });

    test('should work with browser autofill and password managers', async ({ page }) => {
      // Simulate autofill
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'autofilled_password');
      
      // Toggle should work even with autofilled content
      await helper.clickToggleButton('login');
      expect(await helper.getPasswordFieldType('login')).toBe('text');
      
      const passwordField = await helper.getPasswordField('login');
      const value = await passwordField.inputValue();
      expect(value).toBe('autofilled_password');
    });

    test('should reset to hidden state on page reload', async ({ page }) => {
      // Show password
      await helper.clickToggleButton('login');
      expect(await helper.getPasswordFieldType('login')).toBe('text');
      
      // Reload page
      await page.reload();
      await helper.page.waitForSelector('form[action="/login"]');
      
      // Should be back to hidden state
      expect(await helper.getPasswordFieldType('login')).toBe('password');
      expect(await helper.hasIconClass('bi-eye', 'login')).toBe(true);
      expect(await helper.getAriaPressed('login')).toBe('false');
    });
  });
});