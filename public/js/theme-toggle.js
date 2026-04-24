/**
 * Theme Toggle Module
 * Handles dark/light mode theme switching with localStorage persistence
 */

// Theme configuration constants
const THEME_KEY = 'theme-mode';
const VALID_THEMES = ['light', 'dark'];
const DEFAULT_THEME = 'light';
const DARK_THEME_CLASS = 'dark-theme';

/**
 * Gets stored theme from localStorage with validation and fallback
 * @returns {string} Valid theme value ('light' or 'dark')
 */
function getStoredTheme() {
    try {
        const storedTheme = localStorage.getItem(THEME_KEY);
        
        // Validate stored theme
        if (storedTheme && VALID_THEMES.includes(storedTheme)) {
            return storedTheme;
        }
        
        // Fallback to default if invalid or missing
        return DEFAULT_THEME;
    } catch (error) {
        console.warn('Failed to read theme from localStorage:', error);
        return DEFAULT_THEME;
    }
}

/**
 * Stores theme preference in localStorage with validation
 * @param {string} theme - Theme to store ('light' or 'dark')
 * @returns {boolean} Success status
 */
function setStoredTheme(theme) {
    // Validate input theme
    if (!theme || !VALID_THEMES.includes(theme)) {
        console.warn('Invalid theme provided:', theme);
        return false;
    }
    
    try {
        localStorage.setItem(THEME_KEY, theme);
        return true;
    } catch (error) {
        console.warn('Failed to store theme in localStorage:', error);
        return false;
    }
}

/**
 * Applies theme to document and updates toggle UI state
 * @param {string} theme - Theme to apply ('light' or 'dark')
 */
function applyTheme(theme) {
    // Validate theme input
    if (!theme || !VALID_THEMES.includes(theme)) {
        console.warn('Invalid theme for application:', theme);
        theme = DEFAULT_THEME;
    }
    
    try {
        const body = document.body;
        if (!body) {
            console.error('Document body not available');
            return;
        }
        
        // Apply or remove dark theme class
        if (theme === 'dark') {
            body.classList.add(DARK_THEME_CLASS);
        } else {
            body.classList.remove(DARK_THEME_CLASS);
        }
        
        // Update all toggle switches to reflect current theme
        updateToggleStates(theme);
        
    } catch (error) {
        console.error('Failed to apply theme:', error);
    }
}

/**
 * Updates all theme toggle switches to reflect current theme state
 * @param {string} theme - Current theme ('light' or 'dark')
 */
function updateToggleStates(theme) {
    try {
        // Support both id="theme-toggle" and class=".theme-toggle"
        const toggleById = document.getElementById('theme-toggle');
        const togglesByClass = document.querySelectorAll('.theme-toggle');

        // Build a deduplicated list of toggle elements
        const toggleSet = new Set();
        if (toggleById) toggleSet.add(toggleById);
        togglesByClass.forEach(t => toggleSet.add(t));
        const toggles = Array.from(toggleSet);

        toggles.forEach(toggle => {
            try {
                const input = toggle.querySelector('input[type="checkbox"]');
                const iconLight = toggle.querySelector('.theme-icon-light');
                const iconDark = toggle.querySelector('.theme-icon-dark');

                if (input) {
                    input.checked = (theme === 'dark');
                }

                // Update icon visibility
                if (iconLight && iconDark) {
                    if (theme === 'dark') {
                        iconLight.style.display = 'none';
                        iconDark.style.display = 'inline';
                    } else {
                        iconLight.style.display = 'inline';
                        iconDark.style.display = 'none';
                    }
                }

                // Update ARIA label
                const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
                toggle.setAttribute('aria-label', label);

            } catch (error) {
                console.warn('Failed to update individual toggle state:', error);
            }
        });
    } catch (error) {
        console.error('Failed to update toggle states:', error);
    }
}

/**
 * Initializes theme system on page load
 */
function initializeTheme() {
    try {
        const storedTheme = getStoredTheme();
        applyTheme(storedTheme);
    } catch (error) {
        console.error('Failed to initialize theme:', error);
        // Fallback to default theme
        applyTheme(DEFAULT_THEME);
    }
}

/**
 * Sets up event listeners for all theme toggle elements
 */
function setupToggleListeners() {
    try {
        // Support both id="theme-toggle" and class=".theme-toggle"
        const toggleById = document.getElementById('theme-toggle');
        const togglesByClass = document.querySelectorAll('.theme-toggle');

        // Build a deduplicated list of toggle elements
        const toggleSet = new Set();
        if (toggleById) toggleSet.add(toggleById);
        togglesByClass.forEach(t => toggleSet.add(t));
        const toggles = Array.from(toggleSet);

        if (toggles.length === 0) {
            console.info('No theme toggle elements found');
            return;
        }

        toggles.forEach(toggle => {
            try {
                // Remove existing listeners to prevent duplicates
                toggle.removeEventListener('click', handleToggleClick);

                // Add click listener
                toggle.addEventListener('click', handleToggleClick);

                // Add keyboard accessibility
                toggle.addEventListener('keydown', handleToggleKeydown);

                // Ensure toggle is focusable
                if (!toggle.hasAttribute('tabindex')) {
                    toggle.setAttribute('tabindex', '0');
                }

            } catch (error) {
                console.warn('Failed to setup listener for toggle:', error);
            }
        });

    } catch (error) {
        console.error('Failed to setup toggle listeners:', error);
    }
}

/**
 * Handles theme toggle click events
 * @param {Event} event - Click event
 */
function handleToggleClick(event) {
    try {
        event.preventDefault();
        event.stopPropagation();
        
        const currentTheme = getStoredTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // Validate new theme
        if (!VALID_THEMES.includes(newTheme)) {
            console.error('Invalid new theme calculated:', newTheme);
            return;
        }
        
        // Apply and store new theme
        applyTheme(newTheme);
        setStoredTheme(newTheme);
        
    } catch (error) {
        console.error('Failed to handle toggle click:', error);
    }
}

/**
 * Handles keyboard navigation for theme toggle
 * @param {KeyboardEvent} event - Keydown event
 */
function handleToggleKeydown(event) {
    try {
        // Handle Enter and Space keys
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToggleClick(event);
        }
    } catch (error) {
        console.error('Failed to handle toggle keydown:', error);
    }
}

/**
 * Main initialization function
 */
function initThemeToggle() {
    try {
        // Initialize theme immediately if DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                initializeTheme();
                setupToggleListeners();
            });
        } else {
            initializeTheme();
            setupToggleListeners();
        }
        
        // Re-setup listeners when navigating between pages
        window.addEventListener('pageshow', function() {
            setupToggleListeners();
        });
        
    } catch (error) {
        console.error('Failed to initialize theme toggle system:', error);
    }
}

// Initialize theme toggle system
initThemeToggle();

// Export functions for external use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getStoredTheme,
        setStoredTheme,
        applyTheme,
        initializeTheme,
        setupToggleListeners
    };
}