const fs = require('fs');
const path = require('path');
const css = require('css');

describe('CSS Styling Tests', () => {
  let cssContent;
  let parsedCSS;

  beforeAll(() => {
    const cssPath = path.join(__dirname, '../public/css/style.css');
    
    try {
      cssContent = fs.readFileSync(cssPath, 'utf8');
      parsedCSS = css.parse(cssContent);
    } catch (error) {
      console.error('Error reading CSS file:', error);
      cssContent = '';
      parsedCSS = { stylesheet: { rules: [] } };
    }
  });

  describe('Side Navigation Styling', () => {
    // TC-AC-07: Side navigation has dark background matching original navbar theme
    test('AC-07: should have dark theme styling for sidebar', () => {
      expect(cssContent).toContain('.sidebar');
      expect(cssContent).toContain('background-color: #343a40');
      
      // Verify sidebar has proper positioning and dimensions
      expect(cssContent).toContain('position: fixed');
      expect(cssContent).toContain('width: 250px');
      expect(cssContent).toContain('height: 100vh');
      expect(cssContent).toContain('z-index: 1050');
    });

    // TC-AC-24: Navigation styling matches existing dark theme color scheme
    test('AC-24: should maintain consistent dark theme colors', () => {
      // Check for dark background colors
      expect(cssContent).toContain('#343a40'); // Main dark color
      expect(cssContent).toContain('#212529'); // Darker variant
      
      // Check for white text colors
      expect(cssContent).toContain('color: #ffffff');
      expect(cssContent).toContain('color: #ffffff !important');
      
      // Check for hover states
      expect(cssContent).toContain('rgba(255, 255, 255, 0.1)'); // Hover background
    });

    test('should have proper sidebar brand styling', () => {
      expect(cssContent).toContain('.sidebar-brand');
      expect(cssContent).toContain('padding: 1rem 1.5rem');
      expect(cssContent).toContain('border-bottom: 1px solid rgba(255, 255, 255, 0.1)');
      expect(cssContent).toContain('background-color: #212529');
    });

    test('should have navigation link styling with icons', () => {
      expect(cssContent).toContain('.sidebar-nav .nav-link');
      expect(cssContent).toContain('padding: 0.75rem 1.5rem');
      expect(cssContent).toContain('display: flex');
      expect(cssContent).toContain('align-items: center');
      expect(cssContent).toContain('gap: 0.75rem');
      
      // Icon styling
      expect(cssContent).toContain('.sidebar-nav .nav-link i');
      expect(cssContent).toContain('width: 20px');
      expect(cssContent).toContain('font-size: 1.1rem');
    });

    test('should have active link styling', () => {
      expect(cssContent).toContain('.sidebar-nav .nav-link.active');
      expect(cssContent).toContain('background-color: #007bff');
      expect(cssContent).toContain('border-left: 4px solid #0056b3');
      expect(cssContent).toContain('font-weight: bold');
    });

    test('should have hover effects for navigation links', () => {
      expect(cssContent).toContain('.sidebar-nav .nav-link:hover');
      expect(cssContent).toContain('background-color: rgba(255, 255, 255, 0.1)');
      expect(cssContent).toContain('transform: translateX(5px)');
      expect(cssContent).toContain('transition: all 0.2s ease-in-out');
    });
  });

  describe('Hamburger Menu Styling', () => {
    // TC-AC-02: Hamburger menu button appears on mobile devices (viewport < 992px)
    test('AC-02: should have hamburger toggle button styling', () => {
      expect(cssContent).toContain('.sidebar-toggle');
      expect(cssContent).toContain('position: fixed');
      expect(cssContent).toContain('top: 15px');
      expect(cssContent).toContain('right: 15px');
      expect(cssContent).toContain('z-index: 1100');
      expect(cssContent).toContain('width: 44px');
      expect(cssContent).toContain('height: 44px');
    });

    test('should have hamburger button hover and focus states', () => {
      expect(cssContent).toContain('.sidebar-toggle:hover');
      expect(cssContent).toContain('background-color: #495057');
      expect(cssContent).toContain('transform: scale(1.05)');
      
      expect(cssContent).toContain('.sidebar-toggle:focus');
      expect(cssContent).toContain('box-shadow: 0 0 0 0.2rem rgba(52, 58, 64, 0.5)');
      expect(cssContent).toContain('outline: none');
    });
  });

  describe('Main Content Layout', () => {
    // TC-AC-15: Main content area adjusts to accommodate side navigation layout
    test('AC-15: should have main content wrapper with proper margins', () => {
      expect(cssContent).toContain('.main-content');
      expect(cssContent).toContain('margin-left: 250px');
      expect(cssContent).toContain('min-height: 100vh');
      expect(cssContent).toContain('transition: all 0.3s ease-in-out');
    });

    test('should have sidebar overlay for mobile', () => {
      expect(cssContent).toContain('.sidebar-overlay');
      expect(cssContent).toContain('position: fixed');
      expect(cssContent).toContain('background-color: rgba(0, 0, 0, 0.5)');
      expect(cssContent).toContain('z-index: 1040');
      expect(cssContent).toContain('opacity: 0');
      expect(cssContent).toContain('visibility: hidden');
    });
  });

  describe('Responsive Design', () => {
    // TC-AC-22: Side navigation is responsive across desktop, tablet, and mobile viewports
    test('AC-22: should have responsive breakpoints for different viewports', () => {
      // Desktop breakpoint (992px+)
      expect(cssContent).toContain('@media (min-width: 992px)');
      expect(cssContent).toContain('display: none'); // Hide toggle on desktop
      
      // Mobile/tablet breakpoint (991.98px and below)
      expect(cssContent).toContain('@media (max-width: 991.98px)');
      expect(cssContent).toContain('transform: translateX(-100%)'); // Hide sidebar on mobile
      expect(cssContent).toContain('margin-left: 0'); // Reset main content margin
      
      // Small mobile breakpoint
      expect(cssContent).toContain('@media (max-width: 767.98px)');
      expect(cssContent).toContain('width: 100%'); // Full width sidebar on small screens
    });

    test('should handle sidebar show state on mobile', () => {
      expect(cssContent).toContain('.sidebar.show');
      expect(cssContent).toContain('transform: translateX(0)');
    });

    test('should show hamburger toggle only on mobile', () => {
      // Should be hidden on desktop
      expect(cssContent).toMatch(/@media \(min-width: 992px\)[^}]*\.sidebar-toggle[^}]*display: none/);
      
      // Should be visible on mobile
      expect(cssContent).toMatch(/@media \(max-width: 991\.98px\)[^}]*\.sidebar-toggle[^}]*display: flex/);
    });
  });

  describe('Transitions and Animations', () => {
    test('should have smooth transitions for sidebar', () => {
      expect(cssContent).toContain('transition: all 0.3s ease-in-out');
    });

    test('should have hover transitions for interactive elements', () => {
      expect(cssContent).toContain('transition: all 0.2s ease-in-out');
    });

    test('should have transform animations', () => {
      expect(cssContent).toContain('transform: translateX');
      expect(cssContent).toContain('transform: scale(1.05)');
    });
  });

  describe('Accessibility and Focus States', () => {
    test('should have focus styles for keyboard navigation', () => {
      expect(cssContent).toContain(':focus');
      expect(cssContent).toContain('box-shadow: 0 0 0');
      expect(cssContent).toContain('outline: none');
    });

    test('should have proper color contrast for text', () => {
      // White text on dark backgrounds for good contrast
      expect(cssContent).toContain('color: #ffffff');
      expect(cssContent).toContain('background-color: #343a40');
    });
  });

  describe('Legacy CSS Compatibility', () => {
    test('should preserve existing form and card styling', () => {
      // Check that existing styles are preserved
      expect(cssContent).toContain('.card');
      expect(cssContent).toContain('.form-control');
      expect(cssContent).toContain('.btn-primary');
      expect(cssContent).toContain('.hero-section');
    });

    test('should maintain existing color schemes', () => {
      expect(cssContent).toContain('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
      expect(cssContent).toContain('#007bff');
    });

    test('should preserve footer styling', () => {
      expect(cssContent).toContain('.footer');
      expect(cssContent).toContain('background: #343a40');
    });
  });

  describe('Custom Scrollbar Styling', () => {
    test('should have custom scrollbar for webkit browsers', () => {
      expect(cssContent).toContain('::-webkit-scrollbar');
      expect(cssContent).toContain('::-webkit-scrollbar-track');
      expect(cssContent).toContain('::-webkit-scrollbar-thumb');
      expect(cssContent).toContain('width: 8px');
    });
  });

  describe('Loading and Animation Classes', () => {
    test('should have loading animation styles', () => {
      expect(cssContent).toContain('.loading');
      expect(cssContent).toContain('@keyframes spin');
      expect(cssContent).toContain('animation: spin 1s ease-in-out infinite');
    });
  });

  describe('CSS Validation and Structure', () => {
    test('should have valid CSS structure', () => {
      // Basic validation that CSS can be parsed
      expect(parsedCSS).toBeDefined();
      expect(parsedCSS.stylesheet).toBeDefined();
      expect(parsedCSS.stylesheet.rules).toBeDefined();
      expect(Array.isArray(parsedCSS.stylesheet.rules)).toBe(true);
    });

    test('should have proper media queries', () => {
      const mediaQueries = parsedCSS.stylesheet.rules.filter(rule => rule.type === 'media');
      expect(mediaQueries.length).toBeGreaterThan(0);
      
      // Check for responsive breakpoints
      const mediaTexts = mediaQueries.map(mq => mq.media);
      expect(mediaTexts.some(text => text.includes('991.98px'))).toBe(true);
      expect(mediaTexts.some(text => text.includes('992px'))).toBe(true);
      expect(mediaTexts.some(text => text.includes('767.98px'))).toBe(true);
    });

    test('should have proper rule declarations', () => {
      const rules = parsedCSS.stylesheet.rules.filter(rule => rule.type === 'rule');
      expect(rules.length).toBeGreaterThan(0);
      
      // Check for key selectors
      const selectors = rules.map(rule => rule.selectors).flat();
      expect(selectors).toContain('.sidebar');
      expect(selectors).toContain('.sidebar-toggle');
      expect(selectors).toContain('.main-content');
      expect(selectors.some(sel => sel.includes('.sidebar-nav'))).toBe(true);
    });
  });

  describe('Z-Index Management', () => {
    test('should have proper z-index layering', () => {
      expect(cssContent).toContain('z-index: 1050'); // Sidebar
      expect(cssContent).toContain('z-index: 1100'); // Toggle button
      expect(cssContent).toContain('z-index: 1040'); // Overlay
      
      // Ensure proper stacking order
      const sidebarZIndex = parseInt(cssContent.match(/\.sidebar[^}]*z-index:\s*(\d+)/)?.[1] || '0');
      const toggleZIndex = parseInt(cssContent.match(/\.sidebar-toggle[^}]*z-index:\s*(\d+)/)?.[1] || '0');
      const overlayZIndex = parseInt(cssContent.match(/\.sidebar-overlay[^}]*z-index:\s*(\d+)/)?.[1] || '0');
      
      expect(toggleZIndex).toBeGreaterThan(sidebarZIndex);
      expect(sidebarZIndex).toBeGreaterThan(overlayZIndex);
    });
  });

  describe('Browser Compatibility', () => {
    test('should use vendor prefixes where needed', () => {
      expect(cssContent).toContain('-webkit-scrollbar');
    });

    test('should have fallbacks for modern CSS features', () => {
      // Check for proper fallbacks in flexbox usage
      expect(cssContent).toContain('display: flex');
      expect(cssContent).toContain('align-items: center');
      expect(cssContent).toContain('justify-content: center');
    });
  });
});