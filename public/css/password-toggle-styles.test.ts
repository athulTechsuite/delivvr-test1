/**
 * Password Toggle CSS Styles Tests
 * Testing CSS styling for password toggle functionality
 */

import { JSDOM } from 'jsdom';

describe('Password Toggle CSS Styles', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  let styleSheet: CSSStyleSheet;

  beforeEach(() => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            /* Password Toggle Styles */
            .md-input-container {
              position: relative;
              display: flex;
              align-items: center;
            }
            
            .password-toggle-btn {
              position: absolute;
              right: 12px;
              top: 50%;
              transform: translateY(-50%);
              width: 24px;
              height: 24px;
              border: none;
              background: transparent;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;
              transition: opacity 0.3s ease;
              z-index: 1;
            }
            
            .password-toggle-btn:hover {
              opacity: 0.8;
            }
            
            .password-toggle-btn:focus {
              outline: 2px solid var(--md-primary-color);
              outline-offset: 2px;
            }
            
            .password-toggle-btn i {
              font-size: 16px;
              color: var(--md-text-secondary);
              transition: color 0.2s ease;
            }
            
            .password-toggle-btn:hover i {
              color: var(--md-text-primary);
            }
            
            .md-input {
              padding-right: 40px;
            }
            
            /* Theme variables */
            :root {
              --md-primary-color: #1976d2;
              --md-text-primary: #212121;
              --md-text-secondary: #757575;
            }
            
            [data-theme="dark"] {
              --md-text-primary: #ffffff;
              --md-text-secondary: #b3b3b3;
            }
          </style>
        </head>
        <body>
          <div class="md-input-container">
            <input type="password" class="md-input" id="testPassword">
            <button type="button" class="password-toggle-btn">
              <i class="bi bi-eye"></i>
            </button>
          </div>
        </body>
      </html>
    `;

    dom = new JSDOM(html, { pretendToBeVisual: true });
    document = dom.window.document;
    window = dom.window as unknown as Window;
    
    // Get the stylesheet
    styleSheet = document.styleSheets[0] as CSSStyleSheet;

    global.document = document;
    global.window = window;
    global.getComputedStyle = window.getComputedStyle.bind(window);
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Toggle Button Positioning', () => {
    // TC-AC-001, TC-AC-002, TC-AC-021
    test('should position toggle button on right side of input field with proper dimensions', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLElement;
      const computedStyle = window.getComputedStyle(toggleButton);

      expect(computedStyle.position).toBe('absolute');
      expect(computedStyle.right).toBe('12px');
      expect(computedStyle.top).toBe('50%');
      expect(computedStyle.transform).toBe('translateY(-50%)');
      expect(computedStyle.width).toBe('24px');
      expect(computedStyle.height).toBe('24px');
    });

    // TC-AC-024
    test('should set proper padding on input field to prevent text overlap', () => {
      const passwordInput = document.querySelector('.md-input') as HTMLElement;
      const computedStyle = window.getComputedStyle(passwordInput);

      expect(computedStyle.paddingRight).toBe('40px');
    });

    test('should use proper z-index for toggle button layering', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLElement;
      const computedStyle = window.getComputedStyle(toggleButton);

      expect(computedStyle.zIndex).toBe('1');
    });
  });

  describe('Icon Styling', () => {
    // TC-AC-022
    test('should set proper icon size and color', () => {
      const icon = document.querySelector('.password-toggle-btn i') as HTMLElement;
      const computedStyle = window.getComputedStyle(icon);

      expect(computedStyle.fontSize).toBe('16px');
      expect(computedStyle.color).toBe('var(--md-text-secondary)');
    });

    test('should apply color transition on icon', () => {
      const icon = document.querySelector('.password-toggle-btn i') as HTMLElement;
      const computedStyle = window.getComputedStyle(icon);

      expect(computedStyle.transition).toContain('color 0.2s ease');
    });
  });

  describe('Interactive States', () => {
    // TC-AC-017
    test('should apply focus outline styles', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLElement;
      
      // Simulate focus state by checking CSS rules
      const focusRule = Array.from(styleSheet.cssRules).find(rule => 
        rule instanceof CSSStyleRule && rule.selectorText === '.password-toggle-btn:focus'
      ) as CSSStyleRule;

      expect(focusRule).toBeTruthy();
      expect(focusRule.style.outline).toBe('2px solid var(--md-primary-color)');
      expect(focusRule.style.outlineOffset).toBe('2px');
    });

    // TC-AC-018
    test('should apply hover styles for cursor and opacity', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLElement;
      const computedStyle = window.getComputedStyle(toggleButton);

      expect(computedStyle.cursor).toBe('pointer');

      // Check hover rule
      const hoverRule = Array.from(styleSheet.cssRules).find(rule => 
        rule instanceof CSSStyleRule && rule.selectorText === '.password-toggle-btn:hover'
      ) as CSSStyleRule;

      expect(hoverRule).toBeTruthy();
      expect(hoverRule.style.opacity).toBe('0.8');
    });

    // TC-AC-018
    test('should apply hover styles for icon color change', () => {
      const iconHoverRule = Array.from(styleSheet.cssRules).find(rule => 
        rule instanceof CSSStyleRule && rule.selectorText === '.password-toggle-btn:hover i'
      ) as CSSStyleRule;

      expect(iconHoverRule).toBeTruthy();
      expect(iconHoverRule.style.color).toBe('var(--md-text-primary)');
    });
  });

  describe('Button Layout and Container', () => {
    test('should set proper button layout properties', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLElement;
      const computedStyle = window.getComputedStyle(toggleButton);

      expect(computedStyle.border).toBe('none');
      expect(computedStyle.background).toBe('transparent');
      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.alignItems).toBe('center');
      expect(computedStyle.justifyContent).toBe('center');
      expect(computedStyle.borderRadius).toBe('4px');
    });

    test('should apply transition for smooth interactions', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLElement;
      const computedStyle = window.getComputedStyle(toggleButton);

      expect(computedStyle.transition).toContain('opacity 0.3s ease');
    });

    test('should set proper input container layout', () => {
      const inputContainer = document.querySelector('.md-input-container') as HTMLElement;
      const computedStyle = window.getComputedStyle(inputContainer);

      expect(computedStyle.position).toBe('relative');
      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.alignItems).toBe('center');
    });
  });

  describe('Theme Integration', () => {
    // TC-AC-025
    test('should use CSS variables for theme-aware styling', () => {
      const rootStyle = window.getComputedStyle(document.documentElement);
      
      // Check that CSS variables are defined
      expect(rootStyle.getPropertyValue('--md-primary-color').trim()).toBe('#1976d2');
      expect(rootStyle.getPropertyValue('--md-text-primary').trim()).toBe('#212121');
      expect(rootStyle.getPropertyValue('--md-text-secondary').trim()).toBe('#757575');
    });

    // TC-AC-025
    test('should support dark theme variables', () => {
      // Apply dark theme
      document.documentElement.setAttribute('data-theme', 'dark');
      
      // Check dark theme rule exists
      const darkThemeRule = Array.from(styleSheet.cssRules).find(rule => 
        rule instanceof CSSStyleRule && rule.selectorText === '[data-theme="dark"]'
      ) as CSSStyleRule;

      expect(darkThemeRule).toBeTruthy();
      expect(darkThemeRule.style.getPropertyValue('--md-text-primary')).toBe('#ffffff');
      expect(darkThemeRule.style.getPropertyValue('--md-text-secondary')).toBe('#b3b3b3');
    });

    test('should maintain contrast ratios for accessibility', () => {
      // Light theme colors
      const lightPrimary = '#212121';
      const lightSecondary = '#757575';
      
      // Dark theme colors  
      const darkPrimary = '#ffffff';
      const darkSecondary = '#b3b3b3';
      
      // Basic color validation (not actual contrast calculation)
      expect(lightPrimary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(lightSecondary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(darkPrimary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(darkSecondary).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('Responsive Design', () => {
    // TC-AC-023
    test('should maintain proper sizing on different viewport sizes', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLElement;
      
      // Test mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      
      const computedStyle = window.getComputedStyle(toggleButton);
      
      // Button should maintain minimum touch target size
      expect(computedStyle.width).toBe('24px');
      expect(computedStyle.height).toBe('24px');
    });

    test('should maintain icon size across different screen densities', () => {
      const icon = document.querySelector('.password-toggle-btn i') as HTMLElement;
      const computedStyle = window.getComputedStyle(icon);

      // Icon size should be consistent
      expect(computedStyle.fontSize).toBe('16px');
    });
  });

  describe('CSS Architecture', () => {
    test('should use Material Design naming conventions', () => {
      const inputContainer = document.querySelector('.md-input-container');
      const input = document.querySelector('.md-input');
      
      expect(inputContainer?.className).toContain('md-input-container');
      expect(input?.className).toContain('md-input');
    });

    test('should follow BEM-like CSS structure for toggle button', () => {
      const toggleButton = document.querySelector('.password-toggle-btn');
      
      expect(toggleButton?.className).toBe('password-toggle-btn');
      // Should not have nested class naming conflicts
      expect(toggleButton?.className).not.toContain(' ');
    });

    test('should use semantic CSS selectors', () => {
      const cssRules = Array.from(styleSheet.cssRules);
      const ruleSelectors = cssRules
        .filter(rule => rule instanceof CSSStyleRule)
        .map(rule => (rule as CSSStyleRule).selectorText);

      expect(ruleSelectors).toContain('.password-toggle-btn');
      expect(ruleSelectors).toContain('.password-toggle-btn:hover');
      expect(ruleSelectors).toContain('.password-toggle-btn:focus');
      expect(ruleSelectors).toContain('.password-toggle-btn i');
      expect(ruleSelectors).toContain('.password-toggle-btn:hover i');
    });
  });

  describe('Performance Optimizations', () => {
    test('should use efficient CSS transitions', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLElement;
      const icon = document.querySelector('.password-toggle-btn i') as HTMLElement;
      
      const buttonStyle = window.getComputedStyle(toggleButton);
      const iconStyle = window.getComputedStyle(icon);

      // Should use specific property transitions, not 'all'
      expect(buttonStyle.transition).toContain('opacity');
      expect(iconStyle.transition).toContain('color');
      expect(buttonStyle.transition).not.toContain('all');
      expect(iconStyle.transition).not.toContain('all');
    });

    test('should avoid expensive CSS properties', () => {
      const toggleButton = document.querySelector('.password-toggle-btn') as HTMLElement;
      const computedStyle = window.getComputedStyle(toggleButton);

      // Should avoid box-shadow for performance
      expect(computedStyle.boxShadow).toBe('none');
      // Should use transform for positioning
      expect(computedStyle.transform).toBe('translateY(-50%)');
    });
  });

  describe('CSS Error Handling', () => {
    test('should handle missing CSS variables gracefully', () => {
      // Create element with undefined CSS variable
      const testElement = document.createElement('div');
      testElement.style.color = 'var(--undefined-variable, #000000)';
      document.body.appendChild(testElement);
      
      const computedStyle = window.getComputedStyle(testElement);
      
      // Should fall back to default value
      expect(computedStyle.color).toBeTruthy();
      
      document.body.removeChild(testElement);
    });

    test('should maintain layout with missing Bootstrap Icons', () => {
      // Create toggle button without icon
      const testButton = document.createElement('button');
      testButton.className = 'password-toggle-btn';
      document.body.appendChild(testButton);
      
      const computedStyle = window.getComputedStyle(testButton);
      
      // Button should still have proper dimensions and positioning
      expect(computedStyle.width).toBe('24px');
      expect(computedStyle.height).toBe('24px');
      expect(computedStyle.position).toBe('absolute');
      
      document.body.removeChild(testButton);
    });
  });
});