/**
 * Theme Toggle JavaScript
 * Handles switching between light and dark mode themes
 * Persists user preference in localStorage
 */

class ThemeToggle {
    constructor() {
        this.themeKey = 'app-theme';
        this.defaultTheme = 'light';
        this.currentTheme = this.getStoredTheme() || this.defaultTheme;
        
        this.init();
    }

    init() {
        // Apply the current theme on page load
        this.applyTheme(this.currentTheme);
        
        // Set up toggle button event listener
        this.setupToggleButton();
        
        // Update toggle button state
        this.updateToggleButton();
    }

    getStoredTheme() {
        try {
            return localStorage.getItem(this.themeKey);
        } catch (error) {
            console.warn('localStorage not available:', error);
            return null;
        }
    }

    setStoredTheme(theme) {
        try {
            localStorage.setItem(this.themeKey, theme);
        } catch (error) {
            console.warn('Could not save theme to localStorage:', error);
        }
    }

    applyTheme(theme) {
        // Remove existing theme classes
        document.documentElement.classList.remove('light-theme', 'dark-theme');
        document.body.classList.remove('light-theme', 'dark-theme');
        
        // Add new theme class
        document.documentElement.classList.add(`${theme}-theme`);
        document.body.classList.add(`${theme}-theme`);
        
        // Set data attribute for CSS targeting
        document.documentElement.setAttribute('data-theme', theme);
        
        this.currentTheme = theme;
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        this.setStoredTheme(newTheme);
        this.updateToggleButton();
        
        // Dispatch custom event for other components to listen to
        const themeChangeEvent = new CustomEvent('themeChanged', {
            detail: { theme: newTheme }
        });
        document.dispatchEvent(themeChangeEvent);
    }

    setupToggleButton() {
        const toggleButton = document.getElementById('theme-toggle');
        const toggleSlider = document.querySelector('.theme-toggle-slider');
        
        if (toggleButton) {
            toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleTheme();
            });
        }
        
        if (toggleSlider) {
            toggleSlider.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleTheme();
            });
        }
    }

    updateToggleButton() {
        const toggleButton = document.getElementById('theme-toggle');
        const toggleSlider = document.querySelector('.theme-toggle-slider');
        const lightIcon = document.querySelector('.theme-toggle .bi-sun');
        const darkIcon = document.querySelector('.theme-toggle .bi-moon');
        
        if (toggleButton) {
            toggleButton.setAttribute('aria-label', 
                `Switch to ${this.currentTheme === 'light' ? 'dark' : 'light'} mode`);
        }
        
        if (toggleSlider) {
            if (this.currentTheme === 'dark') {
                toggleSlider.classList.add('dark');
            } else {
                toggleSlider.classList.remove('dark');
            }
        }
        
        // Update icon visibility
        if (lightIcon && darkIcon) {
            if (this.currentTheme === 'dark') {
                lightIcon.style.opacity = '0.5';
                darkIcon.style.opacity = '1';
            } else {
                lightIcon.style.opacity = '1';
                darkIcon.style.opacity = '0.5';
            }
        }
    }

    // Public method to get current theme
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Public method to set theme programmatically
    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.applyTheme(theme);
            this.setStoredTheme(theme);
            this.updateToggleButton();
        }
    }
}

// Initialize theme toggle when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeToggle = new ThemeToggle();
});

// Handle page visibility change to sync theme across tabs
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.themeToggle) {
        const storedTheme = window.themeToggle.getStoredTheme();
        if (storedTheme && storedTheme !== window.themeToggle.getCurrentTheme()) {
            window.themeToggle.setTheme(storedTheme);
        }
    }
});

// Listen for storage events to sync theme across tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'app-theme' && window.themeToggle) {
        const newTheme = e.newValue;
        if (newTheme && newTheme !== window.themeToggle.getCurrentTheme()) {
            window.themeToggle.setTheme(newTheme);
        }
    }
});

// Expose theme toggle functionality globally
window.toggleTheme = () => {
    if (window.themeToggle) {
        window.themeToggle.toggleTheme();
    }
};

window.setTheme = (theme) => {
    if (window.themeToggle) {
        window.themeToggle.setTheme(theme);
    }
};

window.getCurrentTheme = () => {
    return window.themeToggle ? window.themeToggle.getCurrentTheme() : 'light';
};