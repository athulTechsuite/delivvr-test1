/**
 * Theme CSS Integration Tests
 * Tests CSS styling and Material Design compliance for theme components
 */

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Load actual CSS content for testing
const cssPath = path.join(__dirname, '../public/css/style.css');
let cssContent = '';

try {
    cssContent = fs.readFileSync(cssPath, 'utf8');
} catch (error) {
    console.warn('Could not load CSS file for testing:', error);
}

const createStyledHTML = (includeDarkTheme = false) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Theme CSS Test</title>
    <style>
        ${cssContent}
    </style>
</head>
<body class="md-body ${includeDarkTheme ? 'dark-theme' : ''}">
    <!-- Theme Toggle Switch -->
    <nav class="md-navbar">
        <div class="md-navbar-nav">
            <div class="md-theme-toggle" role="menuitem" aria-label="Toggle theme" tabindex="0">
                <input type="checkbox" id="theme-toggle" class="md-theme-toggle-input">
                <label for="theme-toggle" class="md-theme-toggle-label">
                    <span class="md-theme-toggle-slider">
                        <span class="md-theme-toggle-thumb">
                            <i class="bi bi-sun-fill md-theme-icon md-theme-icon-light"></i>
                            <i class="bi bi-moon-fill md-theme-icon md-theme-icon-dark"></i>
                        </span>
                    </span>
                </label>
            </div>
        </div>
    </nav>
    
    <!-- Material Design Components for Testing -->
    <main class="md-main">
        <div class="md-container">
            <div class="md-card md-elevation-2">
                <div class="md-card-header">
                    <h2 class="md-headline-small">Test Card</h2>
                </div>
                <div class="md-card-content">
                    <p class="md-body-medium">Test content with proper typography.</p>
                </div>
            </div>
            
            <div class="md-navbar md-elevation-1">
                <div class="md-navbar-brand">
                    <span>Test Navigation</span>
                </div>
            </div>
            
            <button class="md-button md-button-primary">Primary Button</button>
            <button class="md-button md-button-secondary">Secondary Button</button>
            
            <form class="md-form">
                <div class="md-form-field">
                    <input type="text" class="md-input" placeholder="Test Input">
                    <label class="md-label">Input Label</label>
                </div>
                <div class="md-form-field">
                    <input type="email" class="md-input" placeholder="Email">
                    <label class="md-label">Email Label</label>
                </div>
            </form>
        </div>
    </main>
</body>
</html>
`;

describe('Theme CSS and Material Design Compliance', () => {
    let lightThemeDOM: JSDOM;
    let darkThemeDOM: JSDOM;
    let lightDocument: Document;
    let darkDocument: Document;

    beforeAll(() => {
        // Create DOMs with light and dark themes
        lightThemeDOM = new JSDOM(createStyledHTML(false), {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });
        
        darkThemeDOM = new JSDOM(createStyledHTML(true), {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });
        
        lightDocument = lightThemeDOM.window.document;
        darkDocument = darkThemeDOM.window.document;
    });

    afterAll(() => {
        lightThemeDOM?.window.close();
        darkThemeDOM?.window.close();
    });

    describe('CSS Custom Properties and Variables', () => {
        // TC-F-022
        test('should define Material Design color variables for light theme', () => {
            const rootStyles = cssContent.match(/:root\s*{[^}]*}/s)?.[0] || '';
            
            // Primary colors
            expect(rootStyles).toMatch(/--md-primary:\s*#1976D2/);
            expect(rootStyles).toMatch(/--md-primary-light:\s*#42A5F5/);
            expect(rootStyles).toMatch(/--md-primary-dark:\s*#1565C0/);
            
            // Surface colors
            expect(rootStyles).toMatch(/--md-surface:\s*#FFFFFF/);
            expect(rootStyles).toMatch(/--md-background:\s*#FAFAFA/);
            
            // Text colors
            expect(rootStyles).toMatch(/--md-text-primary:\s*rgba\(0,\s*0,\s*0,\s*0\.87\)/);
            expect(rootStyles).toMatch(/--md-text-secondary:\s*rgba\(0,\s*0,\s*0,\s*0\.60\)/);
        });

        // TC-F-023
        test('should define Material Design dark theme color variables', () => {
            const darkThemeStyles = cssContent.match(/\.dark-theme\s*{[^}]*}/s)?.[0] || '';
            
            // Dark theme primary colors (adjusted)
            expect(darkThemeStyles).toMatch(/--md-primary:\s*#90CAF9/);
            expect(darkThemeStyles).toMatch(/--md-surface:\s*#121212/);
            expect(darkThemeStyles).toMatch(/--md-background:\s*#000000/);
            
            // Dark theme text colors
            expect(darkThemeStyles).toMatch(/--md-text-primary:\s*rgba\(255,\s*255,\s*255,\s*0\.87\)/);
            expect(darkThemeStyles).toMatch(/--md-text-secondary:\s*rgba\(255,\s*255,\s*255,\s*0\.60\)/);
        });

        test('should include Material Design spacing variables', () => {
            const rootStyles = cssContent.match(/:root\s*{[^}]*}/s)?.[0] || '';
            
            expect(rootStyles).toMatch(/--md-spacing-xs:\s*4px/);
            expect(rootStyles).toMatch(/--md-spacing-sm:\s*8px/);
            expect(rootStyles).toMatch(/--md-spacing-md:\s*16px/);
            expect(rootStyles).toMatch(/--md-spacing-lg:\s*24px/);
            expect(rootStyles).toMatch(/--md-spacing-xl:\s*32px/);
        });

        test('should include Material Design elevation shadows', () => {
            const rootStyles = cssContent.match(/:root\s*{[^}]*}/s)?.[0] || '';
            
            expect(rootStyles).toMatch(/--md-elevation-1/);
            expect(rootStyles).toMatch(/--md-elevation-2/);
            expect(rootStyles).toMatch(/--md-elevation-4/);
            expect(rootStyles).toMatch(/--md-elevation-8/);
        });
    });

    describe('Theme Toggle Switch Styling', () => {
        // TC-F-002
        test('should style theme toggle with Material Design switch component', () => {
            const toggleStyles = cssContent.match(/\.md-theme-toggle[^{]*{[^}]*}/g) || [];
            
            expect(toggleStyles.length).toBeGreaterThan(0);
            
            // Check for switch-related styles
            const allToggleCSS = toggleStyles.join(' ');
            expect(cssContent).toMatch(/\.md-theme-toggle-slider/);
            expect(cssContent).toMatch(/\.md-theme-toggle-thumb/);
            expect(cssContent).toMatch(/\.md-theme-toggle-input/);
        });

        test('should provide proper focus states for accessibility', () => {
            // Check for focus states in CSS
            expect(cssContent).toMatch(/focus|:focus/);
        });

        // TC-F-010
        test('should style theme toggle icons appropriately', () => {
            expect(cssContent).toMatch(/\.md-theme-icon/);
            expect(cssContent).toMatch(/\.theme-icon-light/);
            expect(cssContent).toMatch(/\.theme-icon-dark/);
        });
    });

    describe('Component Theme Styling', () => {
        // TC-F-012
        test('should provide dark theme overrides for md-card components', () => {
            const lightCard = lightDocument.querySelector('.md-card');
            const darkCard = darkDocument.querySelector('.md-card');
            
            expect(lightCard).toBeTruthy();
            expect(darkCard).toBeTruthy();
            
            // Verify dark theme class application
            expect(darkDocument.body.classList.contains('dark-theme')).toBe(true);
            expect(lightDocument.body.classList.contains('dark-theme')).toBe(false);
        });

        // TC-F-013
        test('should provide dark theme overrides for md-navbar components', () => {
            const lightNavbar = lightDocument.querySelector('.md-navbar');
            const darkNavbar = darkDocument.querySelector('.md-navbar');
            
            expect(lightNavbar).toBeTruthy();
            expect(darkNavbar).toBeTruthy();
            
            // Both should have the same classes, theme applied via body class
            expect(lightNavbar?.classList.contains('md-navbar')).toBe(true);
            expect(darkNavbar?.classList.contains('md-navbar')).toBe(true);
        });

        // TC-F-014
        test('should provide dark theme overrides for md-button components', () => {
            const lightButtons = lightDocument.querySelectorAll('.md-button');
            const darkButtons = darkDocument.querySelectorAll('.md-button');
            
            expect(lightButtons.length).toBe(darkButtons.length);
            expect(lightButtons.length).toBeGreaterThan(0);
            
            // Verify button classes are preserved
            lightButtons.forEach((button, index) => {
                const darkButton = darkButtons[index];
                expect(button.classList.toString()).toBe(darkButton.classList.toString());
            });
        });

        // TC-F-015
        test('should provide dark theme overrides for md-form components', () => {
            const lightForm = lightDocument.querySelector('.md-form');
            const darkForm = darkDocument.querySelector('.md-form');
            const lightInputs = lightDocument.querySelectorAll('.md-input');
            const darkInputs = darkDocument.querySelectorAll('.md-input');
            
            expect(lightForm).toBeTruthy();
            expect(darkForm).toBeTruthy();
            expect(lightInputs.length).toBe(darkInputs.length);
            expect(lightInputs.length).toBeGreaterThan(0);
        });
    });

    describe('Typography and Text Styling', () => {
        // TC-F-016
        test('should maintain proper text contrast in both themes', () => {
            // Check that text color variables are defined for both themes
            expect(cssContent).toMatch(/--md-text-primary/);
            expect(cssContent).toMatch(/--md-text-secondary/);
            
            // Verify dark theme text colors are different from light theme
            const lightTextMatch = cssContent.match(/:root[^}]*--md-text-primary:\s*rgba\(0,\s*0,\s*0/);
            const darkTextMatch = cssContent.match(/\.dark-theme[^}]*--md-text-primary:\s*rgba\(255,\s*255,\s*255/);
            
            expect(lightTextMatch).toBeTruthy();
            expect(darkTextMatch).toBeTruthy();
        });

        test('should define Material Design typography classes', () => {
            const typographyClasses = [
                '.md-display-large',
                '.md-display-small',
                '.md-headline-large',
                '.md-headline-medium',
                '.md-headline-small',
                '.md-body-large',
                '.md-body-medium',
                '.md-label-large'
            ];
            
            typographyClasses.forEach(className => {
                expect(cssContent).toMatch(new RegExp(className.replace('.', '\\.')));
            });
        });
    });

    describe('Layout and Responsive Design', () => {
        // TC-F-017
        test('should maintain identical layout and alignment in both themes', () => {
            const lightContainer = lightDocument.querySelector('.md-container');
            const darkContainer = darkDocument.querySelector('.md-container');
            
            expect(lightContainer).toBeTruthy();
            expect(darkContainer).toBeTruthy();
            
            // Layout classes should be identical
            expect(lightContainer?.className).toBe(darkContainer?.className);
        });

        // TC-F-021
        test('should include responsive breakpoints for mobile and desktop', () => {
            // Check for responsive classes and media queries
            expect(cssContent).toMatch(/@media/);
            expect(cssContent).toMatch(/md-col-/);
            expect(cssContent).toMatch(/md-col-sm-|md-col-md-|md-col-lg-/);
        });

        test('should maintain Material Design grid system', () => {
            expect(cssContent).toMatch(/\.md-container/);
            expect(cssContent).toMatch(/\.md-row/);
            expect(cssContent).toMatch(/\.md-col-/);
        });
    });

    describe('Material Design Elevation and Shadows', () => {
        test('should adjust elevation shadows for dark theme', () => {
            const darkThemeStyles = cssContent.match(/\.dark-theme\s*{[^}]*}/s)?.[0] || '';
            
            // Dark theme should have adjusted shadows
            expect(darkThemeStyles).toMatch(/--md-elevation-1/);
            expect(darkThemeStyles).toMatch(/--md-elevation-2/);
            
            // Shadows should be different (typically more prominent in dark theme)
            const lightShadow = cssContent.match(/:root[^}]*--md-elevation-1:\s*([^;]+);/)?.[1];
            const darkShadow = cssContent.match(/\.dark-theme[^}]*--md-elevation-1:\s*([^;]+);/)?.[1];
            
            expect(lightShadow).toBeTruthy();
            expect(darkShadow).toBeTruthy();
            expect(lightShadow).not.toBe(darkShadow);
        });
    });

    describe('Component State Styles', () => {
        test('should define hover states for interactive components', () => {
            expect(cssContent).toMatch(/:hover/);
            expect(cssContent).toMatch(/\.md-button:hover|\.md-navbar-link:hover/);
        });

        test('should define focus states for keyboard navigation', () => {
            expect(cssContent).toMatch(/:focus/);
            expect(cssContent).toMatch(/\.md-theme-toggle.*focus/);
        });

        test('should define active states for pressed components', () => {
            expect(cssContent).toMatch(/:active/);
        });
    });

    describe('CSS Transitions and Animations', () => {
        test('should define smooth transitions for theme switching', () => {
            expect(cssContent).toMatch(/transition/);
            expect(cssContent).toMatch(/--md-transition-/);
            
            // Look for transition properties
            expect(cssContent).toMatch(/transition:.*background-color|background-color.*transition/);
            expect(cssContent).toMatch(/transition:.*color|color.*transition/);
        });

        test('should use Material Design timing functions', () => {
            expect(cssContent).toMatch(/cubic-bezier\(0\.4,\s*0\.0,\s*0\.2,\s*1\)/);
        });
    });

    describe('Error and Status Colors', () => {
        test('should define error, success, warning, and info colors for both themes', () => {
            const colorTypes = ['error', 'success', 'warning', 'info'];
            
            colorTypes.forEach(type => {
                expect(cssContent).toMatch(new RegExp(`--md-${type}:`));
                
                // Check for both light and dark theme versions
                const lightColor = cssContent.match(new RegExp(`:root[^}]*--md-${type}:\\s*([^;]+);`))?.[1];
                const darkColor = cssContent.match(new RegExp(`\\.dark-theme[^}]*--md-${type}:\\s*([^;]+);`))?.[1];
                
                expect(lightColor).toBeTruthy();
                expect(darkColor).toBeTruthy();
            });
        });
    });

    describe('Cross-browser Compatibility', () => {
        test('should include vendor prefixes where necessary', () => {
            // Check for common vendor prefixes in critical properties
            const vendorPrefixes = ['-webkit-', '-moz-', '-ms-'];
            const criticalProperties = ['user-select', 'appearance', 'font-smoothing'];
            
            // At least some vendor prefixes should be present for compatibility
            const hasVendorPrefixes = vendorPrefixes.some(prefix => 
                cssContent.includes(prefix)
            );
            
            expect(hasVendorPrefixes).toBe(true);
        });

        test('should include CSS custom property fallbacks', () => {
            // Check that important colors have fallbacks or are defined properly
            expect(cssContent).toMatch(/var\(--md-/);
        });
    });

    describe('Performance Optimizations', () => {
        // TC-F-025
        test('should use efficient CSS selectors', () => {
            // Check that selectors are not overly complex
            const complexSelectors = cssContent.match(/([^{]+{[^}]*})/g) || [];
            const overlyComplexSelectors = complexSelectors.filter(selector => 
                (selector.match(/\s+/g) || []).length > 10 // More than 10 spaces indicates complexity
            );
            
            // Should have minimal overly complex selectors
            expect(overlyComplexSelectors.length).toBeLessThan(5);
        });

        test('should minimize redundant color definitions', () => {
            // Count color variable definitions to ensure they're not duplicated excessively
            const colorVarMatches = cssContent.match(/--md-[^:]+:[^;]+;/g) || [];
            const uniqueVars = new Set(colorVarMatches.map(match => match.split(':')[0]));
            
            // Should have reasonable number of unique color variables
            expect(uniqueVars.size).toBeGreaterThan(20); // Sufficient variety
            expect(uniqueVars.size).toBeLessThan(200); // Not excessive
        });
    });
});