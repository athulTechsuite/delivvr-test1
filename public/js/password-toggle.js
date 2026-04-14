/**
 * Password Toggle Module
 * Provides show/hide password functionality for form fields with accessibility support
 * @fileoverview Handles password visibility toggle with Bootstrap Icons, ARIA labels, and screen reader support
 */

// Module constants
const SELECTORS = {
    PASSWORD_TOGGLE_BUTTON: '[data-password-toggle]',
    PASSWORD_INPUT: 'input[type="password"], input[type="text"][data-password-field]',
    TOGGLE_CONTAINER: '.password-input-container'
};

const ICONS = {
    SHOW: 'bi-eye',
    HIDE: 'bi-eye-slash'
};

const INPUT_TYPES = {
    PASSWORD: 'password',
    TEXT: 'text'
};

const ARIA_LABELS = {
    SHOW_PASSWORD: 'Show password',
    HIDE_PASSWORD: 'Hide password'
};

const SCREEN_READER_MESSAGES = {
    PASSWORD_VISIBLE: 'Password visible',
    PASSWORD_HIDDEN: 'Password hidden'
};

const KEYBOARD_KEYS = {
    ENTER: 'Enter',
    SPACE: ' '
};

const ANIMATION_DURATION = 300;

/**
 * Initialize password toggle functionality
 * Sets up event listeners and prepares toggle buttons
 */
function initPasswordToggle() {
    try {
        // Handle both document ready states
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupToggleListeners);
        } else {
            setupToggleListeners();
        }

        // Handle page navigation events (for SPAs or dynamic content)
        window.addEventListener('pageshow', setupToggleListeners);
        
    } catch (error) {
        console.error('Failed to initialize password toggle:', error);
    }
}

/**
 * Set up event listeners for all password toggle buttons
 * Finds toggle buttons and attaches appropriate event handlers
 */
function setupToggleListeners() {
    try {
        const toggleButtons = document.querySelectorAll(SELECTORS.PASSWORD_TOGGLE_BUTTON);
        
        if (!toggleButtons.length) {
            return; // No toggle buttons found, exit gracefully
        }

        toggleButtons.forEach((button) => {
            if (!button || button.hasAttribute('data-toggle-initialized')) {
                return; // Skip if button is invalid or already initialized
            }

            // Validate associated password input exists
            const inputId = button.getAttribute('data-password-toggle');
            const passwordInput = inputId ? document.getElementById(inputId) : null;
            
            if (!passwordInput) {
                console.warn(`Password input not found for toggle button with target: ${inputId}`);
                return;
            }

            // Set up initial state
            initializeToggleButton(button, passwordInput);

            // Attach event listeners
            button.addEventListener('click', (event) => handleToggleClick(event, button, passwordInput));
            button.addEventListener('keydown', (event) => handleToggleKeydown(event, button, passwordInput));

            // Mark as initialized to prevent duplicate event listeners
            button.setAttribute('data-toggle-initialized', 'true');
        });

    } catch (error) {
        console.error('Failed to setup toggle listeners:', error);
    }
}

/**
 * Initialize toggle button with proper attributes and state
 * @param {HTMLElement} button - Toggle button element
 * @param {HTMLInputElement} passwordInput - Associated password input element
 */
function initializeToggleButton(button, passwordInput) {
    try {
        if (!button || !passwordInput) {
            throw new Error('Invalid button or password input element');
        }

        // Ensure password field starts in hidden state
        passwordInput.type = INPUT_TYPES.PASSWORD;
        passwordInput.setAttribute('data-password-field', 'true');

        // Set initial ARIA attributes
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');
        button.setAttribute('aria-label', ARIA_LABELS.SHOW_PASSWORD);
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-describedby', `${passwordInput.id}-toggle-desc`);

        // Set initial icon
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = `bi ${ICONS.SHOW}`;
        }

        // Create hidden description for screen readers
        createToggleDescription(button, passwordInput);

    } catch (error) {
        console.error('Failed to initialize toggle button:', error);
    }
}

/**
 * Create hidden description element for screen reader support
 * @param {HTMLElement} button - Toggle button element
 * @param {HTMLInputElement} passwordInput - Associated password input element
 */
function createToggleDescription(button, passwordInput) {
    try {
        const descId = `${passwordInput.id}-toggle-desc`;
        let description = document.getElementById(descId);
        
        if (!description) {
            description = document.createElement('span');
            description.id = descId;
            description.className = 'sr-only';
            description.textContent = 'Toggle password visibility';
            
            // Insert description near the button
            button.parentNode.insertBefore(description, button.nextSibling);
        }

    } catch (error) {
        console.error('Failed to create toggle description:', error);
    }
}

/**
 * Handle toggle button click events
 * @param {Event} event - Click event
 * @param {HTMLElement} button - Toggle button element
 * @param {HTMLInputElement} passwordInput - Associated password input element
 */
function handleToggleClick(event, button, passwordInput) {
    try {
        event.preventDefault();
        event.stopPropagation();

        if (!button || !passwordInput) {
            throw new Error('Invalid button or password input element');
        }

        togglePasswordVisibility(button, passwordInput);

    } catch (error) {
        console.error('Failed to handle toggle click:', error);
    }
}

/**
 * Handle toggle button keyboard events
 * @param {KeyboardEvent} event - Keyboard event
 * @param {HTMLElement} button - Toggle button element
 * @param {HTMLInputElement} passwordInput - Associated password input element
 */
function handleToggleKeydown(event, button, passwordInput) {
    try {
        if (!event || !button || !passwordInput) {
            return;
        }

        const { key } = event;
        
        if (key === KEYBOARD_KEYS.ENTER || key === KEYBOARD_KEYS.SPACE) {
            event.preventDefault();
            event.stopPropagation();
            
            togglePasswordVisibility(button, passwordInput);
        }

    } catch (error) {
        console.error('Failed to handle toggle keydown:', error);
    }
}

/**
 * Toggle password visibility between hidden and visible states
 * @param {HTMLElement} button - Toggle button element
 * @param {HTMLInputElement} passwordInput - Associated password input element
 */
function togglePasswordVisibility(button, passwordInput) {
    try {
        if (!button || !passwordInput) {
            throw new Error('Invalid button or password input element');
        }

        const isCurrentlyHidden = passwordInput.type === INPUT_TYPES.PASSWORD;
        const newType = isCurrentlyHidden ? INPUT_TYPES.TEXT : INPUT_TYPES.PASSWORD;
        
        // Update input type
        passwordInput.type = newType;
        
        // Update toggle state
        updateToggleState(button, passwordInput, !isCurrentlyHidden);
        
        // Announce change to screen readers
        const message = isCurrentlyHidden ? SCREEN_READER_MESSAGES.PASSWORD_VISIBLE : SCREEN_READER_MESSAGES.PASSWORD_HIDDEN;
        announceToScreenReader(message);
        
        // Maintain focus on password input if it was focused
        if (document.activeElement === passwordInput) {
            // Preserve cursor position
            const selectionStart = passwordInput.selectionStart;
            const selectionEnd = passwordInput.selectionEnd;
            
            setTimeout(() => {
                passwordInput.focus();
                passwordInput.setSelectionRange(selectionStart, selectionEnd);
            }, 10);
        }

    } catch (error) {
        console.error('Failed to toggle password visibility:', error);
    }
}

/**
 * Update toggle button state (icon, ARIA attributes)
 * @param {HTMLElement} button - Toggle button element
 * @param {HTMLInputElement} passwordInput - Associated password input element
 * @param {boolean} isVisible - Whether password is currently visible
 */
function updateToggleState(button, passwordInput, isVisible) {
    try {
        if (!button || !passwordInput) {
            throw new Error('Invalid button or password input element');
        }

        const icon = button.querySelector('i');
        if (!icon) {
            throw new Error('Toggle button icon not found');
        }

        // Update icon
        icon.className = `bi ${isVisible ? ICONS.HIDE : ICONS.SHOW}`;
        
        // Update ARIA attributes
        button.setAttribute('aria-label', isVisible ? ARIA_LABELS.HIDE_PASSWORD : ARIA_LABELS.SHOW_PASSWORD);
        button.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
        
        // Add visual feedback
        button.style.opacity = '0.7';
        setTimeout(() => {
            if (button) {
                button.style.opacity = '';
            }
        }, ANIMATION_DURATION);

    } catch (error) {
        console.error('Failed to update toggle state:', error);
    }
}

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 */
function announceToScreenReader(message) {
    try {
        if (!message || typeof message !== 'string') {
            return;
        }

        // Create or update live region for announcements
        let liveRegion = document.getElementById('password-toggle-announcer');
        
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'password-toggle-announcer';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
        }

        // Clear previous message and set new one
        liveRegion.textContent = '';
        
        setTimeout(() => {
            if (liveRegion) {
                liveRegion.textContent = message;
            }
        }, 100);

        // Clear message after announcement
        setTimeout(() => {
            if (liveRegion) {
                liveRegion.textContent = '';
            }
        }, 2000);

    } catch (error) {
        console.error('Failed to announce to screen reader:', error);
    }
}

/**
 * Get all password toggle buttons
 * @returns {NodeList} List of toggle button elements
 */
function getToggleButtons() {
    try {
        return document.querySelectorAll(SELECTORS.PASSWORD_TOGGLE_BUTTON);
    } catch (error) {
        console.error('Failed to get toggle buttons:', error);
        return [];
    }
}

/**
 * Reset all password toggles to hidden state
 * Useful for form resets or page cleanup
 */
function resetPasswordToggles() {
    try {
        const toggleButtons = getToggleButtons();
        
        toggleButtons.forEach((button) => {
            const inputId = button.getAttribute('data-password-toggle');
            const passwordInput = inputId ? document.getElementById(inputId) : null;
            
            if (passwordInput) {
                passwordInput.type = INPUT_TYPES.PASSWORD;
                updateToggleState(button, passwordInput, false);
            }
        });

    } catch (error) {
        console.error('Failed to reset password toggles:', error);
    }
}

/**
 * Clean up password toggle functionality
 * Removes event listeners and resets state
 */
function cleanupPasswordToggle() {
    try {
        const toggleButtons = getToggleButtons();
        
        toggleButtons.forEach((button) => {
            button.removeAttribute('data-toggle-initialized');
        });

        // Remove live region announcer
        const liveRegion = document.getElementById('password-toggle-announcer');
        if (liveRegion) {
            liveRegion.remove();
        }

    } catch (error) {
        console.error('Failed to cleanup password toggle:', error);
    }
}

// Initialize on module load
initPasswordToggle();

// Export functions for testing and external usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initPasswordToggle,
        setupToggleListeners,
        togglePasswordVisibility,
        updateToggleState,
        announceToScreenReader,
        resetPasswordToggles,
        cleanupPasswordToggle,
        getToggleButtons,
        SELECTORS,
        ICONS,
        ARIA_LABELS,
        SCREEN_READER_MESSAGES
    };
}