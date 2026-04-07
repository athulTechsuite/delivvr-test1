/**
 * Theme Toggle Manager
 * Handles dark/light mode switching with localStorage persistence
 */

class ThemeManager {
    constructor() {
        this.storageKey = 'theme-preference';
        this.themes = {
            LIGHT: 'light',
            DARK: 'dark'
        };
        
        // Initialize theme on page load
        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        // Apply saved theme or default to light
        const savedTheme = this.getSavedTheme();
        this.applyTheme(savedTheme);
        
        // Set up toggle button event listener
        this.setupToggleButton();
        
        // Update toggle button state
        this.updateToggleButton(savedTheme);
    }

    /**
     * Get saved theme from localStorage or return default
     */
    getSavedTheme() {
        const saved = localStorage.getItem(this.storageKey);
        return saved && Object.values(this.themes).includes(saved) 
            ? saved 
            : this.themes.LIGHT;
    }

    /**
     * Save theme preference to localStorage
     */
    saveTheme(theme) {
        localStorage.setItem(this.storageKey, theme);
    }

    /**
     * Apply theme to the document
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        
        // Update body class for additional styling if needed
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = this.getCurrentTheme();
        const newTheme = currentTheme === this.themes.LIGHT 
            ? this.themes.DARK 
            : this.themes.LIGHT;
        
        this.applyTheme(newTheme);
        this.saveTheme(newTheme);
        this.updateToggleButton(newTheme);
    }

    /**
     * Get current theme from document attribute
     */
    getCurrentTheme() {
        return document.documentElement.getAttribute('data-bs-theme') || this.themes.LIGHT;
    }

    /**
     * Set up theme toggle button event listener
     */
    setupToggleButton() {
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }

    /**
     * Update toggle button appearance and accessibility attributes
     */
    updateToggleButton(theme) {
        const toggleButton = document.getElementById('theme-toggle');
        const toggleIcon = document.getElementById('theme-toggle-icon');
        
        if (!toggleButton || !toggleIcon) return;

        const isDark = theme === this.themes.DARK;
        
        // Update icon
        toggleIcon.className = isDark 
            ? 'bi bi-sun-fill' 
            : 'bi bi-moon-fill';
        
        // Update button text and aria-label for accessibility
        const buttonText = isDark ? 'Light Mode' : 'Dark Mode';
        toggleButton.setAttribute('aria-label', `Switch to ${buttonText}`);
        toggleButton.setAttribute('title', `Switch to ${buttonText}`);
        
        // Update button text if it has a text element
        const buttonTextElement = toggleButton.querySelector('.theme-toggle-text');
        if (buttonTextElement) {
            buttonTextElement.textContent = buttonText;
        }
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.themeManager) {
            window.themeManager = new ThemeManager();
        }
    });
} else {
    window.themeManager = new ThemeManager();
}