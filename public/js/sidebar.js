/**
 * Sidebar Navigation Controller
 * Handles responsive sidebar behavior, mobile menu toggle, and active navigation states
 */

// Constants for responsive breakpoints and animation timing
const MOBILE_BREAKPOINT = 768;
const ANIMATION_DURATION = 300;
const STORAGE_KEY = 'sidebar-state';

// CSS class constants
const CSS_CLASSES = {
    SIDEBAR: 'sidebar',
    SIDEBAR_OPEN: 'sidebar-open',
    SIDEBAR_CLOSED: 'sidebar-closed',
    HAMBURGER_MENU: 'hamburger-menu',
    HAMBURGER_ACTIVE: 'hamburger-active',
    NAV_ITEM: 'nav-item',
    NAV_ITEM_ACTIVE: 'nav-item-active',
    MAIN_CONTENT: 'main-content',
    MAIN_CONTENT_SHIFTED: 'main-content-shifted',
    OVERLAY: 'sidebar-overlay',
    OVERLAY_VISIBLE: 'overlay-visible'
};

// Navigation items configuration
const NAV_ITEMS = [
    { id: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'profile', href: '/profile', label: 'Profile', icon: 'person' },
    { id: 'settings', href: '/settings', label: 'Settings', icon: 'settings' },
    { id: 'logout', href: '/logout', label: 'Logout', icon: 'exit_to_app' }
];

class SidebarController {
    constructor() {
        this.sidebar = null;
        this.hamburgerBtn = null;
        this.mainContent = null;
        this.overlay = null;
        this.isInitialized = false;
        this.isMobile = false;
        this.isOpen = false;
        
        // Bind methods to preserve context
        this.handleResize = this.handleResize.bind(this);
        this.toggleSidebar = this.toggleSidebar.bind(this);
        this.closeSidebar = this.closeSidebar.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleNavigation = this.handleNavigation.bind(this);
        this.handleOverlayClick = this.handleOverlayClick.bind(this);
    }

    /**
     * Initialize the sidebar controller
     * Sets up DOM references, event listeners, and initial state
     */
    init() {
        try {
            if (this.isInitialized) {
                console.warn('SidebarController already initialized');
                return;
            }

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
                return;
            }

            this.setupDOMReferences();
            this.setupEventListeners();
            this.checkMobileState();
            this.restoreState();
            this.setActiveNavItem();
            
            this.isInitialized = true;
            console.log('SidebarController initialized successfully');
        } catch (error) {
            console.error('Failed to initialize SidebarController:', error);
            this.handleError(error);
        }
    }

    /**
     * Set up DOM element references with validation
     */
    setupDOMReferences() {
        this.sidebar = document.querySelector(`.${CSS_CLASSES.SIDEBAR}`);
        this.hamburgerBtn = document.querySelector(`.${CSS_CLASSES.HAMBURGER_MENU}`);
        this.mainContent = document.querySelector(`.${CSS_CLASSES.MAIN_CONTENT}`);
        this.overlay = document.querySelector(`.${CSS_CLASSES.OVERLAY}`);

        // Validate required elements
        if (!this.sidebar) {
            throw new Error('Sidebar element not found');
        }
        if (!this.hamburgerBtn) {
            throw new Error('Hamburger menu button not found');
        }
        if (!this.mainContent) {
            throw new Error('Main content element not found');
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        try {
            // Window resize listener for responsive behavior
            window.addEventListener('resize', this.debounce(this.handleResize, 250));

            // Hamburger menu click listener
            this.hamburgerBtn.addEventListener('click', this.toggleSidebar);

            // Overlay click listener for mobile
            if (this.overlay) {
                this.overlay.addEventListener('click', this.handleOverlayClick);
            }

            // Keyboard navigation
            document.addEventListener('keydown', this.handleKeydown);

            // Navigation item click listeners
            const navItems = this.sidebar.querySelectorAll(`.${CSS_CLASSES.NAV_ITEM} a`);
            navItems.forEach(item => {
                item.addEventListener('click', this.handleNavigation);
            });

            // Handle browser back/forward navigation
            window.addEventListener('popstate', () => {
                this.setActiveNavItem();
            });

        } catch (error) {
            console.error('Error setting up event listeners:', error);
            throw error;
        }
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        try {
            const wasMobile = this.isMobile;
            this.checkMobileState();
            
            // If switching from mobile to desktop, ensure proper state
            if (wasMobile && !this.isMobile) {
                this.showSidebar();
                this.hideOverlay();
                this.updateHamburgerState(false);
            }
            // If switching from desktop to mobile, close sidebar
            else if (!wasMobile && this.isMobile && this.isOpen) {
                this.closeSidebar();
            }
        } catch (error) {
            console.error('Error handling resize:', error);
        }
    }

    /**
     * Check if current viewport is mobile
     */
    checkMobileState() {
        this.isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
        document.body.classList.toggle('mobile-view', this.isMobile);
        document.body.classList.toggle('desktop-view', !this.isMobile);
    }

    /**
     * Toggle sidebar open/closed state
     */
    toggleSidebar(event) {
        try {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            if (this.isOpen) {
                this.closeSidebar();
            } else {
                this.openSidebar();
            }
        } catch (error) {
            console.error('Error toggling sidebar:', error);
            this.handleError(error);
        }
    }

    /**
     * Open the sidebar
     */
    openSidebar() {
        try {
            this.isOpen = true;
            this.showSidebar();
            this.updateHamburgerState(true);
            
            if (this.isMobile) {
                this.showOverlay();
                // Prevent body scroll on mobile when sidebar is open
                document.body.style.overflow = 'hidden';
            } else {
                this.shiftMainContent(true);
            }
            
            this.saveState();
            this.focusFirstNavItem();
        } catch (error) {
            console.error('Error opening sidebar:', error);
            this.handleError(error);
        }
    }

    /**
     * Close the sidebar
     */
    closeSidebar() {
        try {
            this.isOpen = false;
            
            if (this.isMobile) {
                this.hideSidebar();
                this.hideOverlay();
                // Restore body scroll
                document.body.style.overflow = '';
            } else {
                this.shiftMainContent(false);
            }
            
            this.updateHamburgerState(false);
            this.saveState();
        } catch (error) {
            console.error('Error closing sidebar:', error);
            this.handleError(error);
        }
    }

    /**
     * Show sidebar with animation
     */
    showSidebar() {
        if (!this.sidebar) return;
        
        this.sidebar.classList.remove(CSS_CLASSES.SIDEBAR_CLOSED);
        this.sidebar.classList.add(CSS_CLASSES.SIDEBAR_OPEN);
        this.sidebar.setAttribute('aria-hidden', 'false');
    }

    /**
     * Hide sidebar with animation
     */
    hideSidebar() {
        if (!this.sidebar) return;
        
        this.sidebar.classList.remove(CSS_CLASSES.SIDEBAR_OPEN);
        this.sidebar.classList.add(CSS_CLASSES.SIDEBAR_CLOSED);
        this.sidebar.setAttribute('aria-hidden', 'true');
    }

    /**
     * Show overlay for mobile
     */
    showOverlay() {
        if (!this.overlay) return;
        
        this.overlay.classList.add(CSS_CLASSES.OVERLAY_VISIBLE);
        this.overlay.setAttribute('aria-hidden', 'false');
    }

    /**
     * Hide overlay
     */
    hideOverlay() {
        if (!this.overlay) return;
        
        this.overlay.classList.remove(CSS_CLASSES.OVERLAY_VISIBLE);
        this.overlay.setAttribute('aria-hidden', 'true');
    }

    /**
     * Shift main content to accommodate sidebar
     */
    shiftMainContent(shift) {
        if (!this.mainContent) return;
        
        if (shift) {
            this.mainContent.classList.add(CSS_CLASSES.MAIN_CONTENT_SHIFTED);
        } else {
            this.mainContent.classList.remove(CSS_CLASSES.MAIN_CONTENT_SHIFTED);
        }
    }

    /**
     * Update hamburger menu visual state
     */
    updateHamburgerState(active) {
        if (!this.hamburgerBtn) return;
        
        this.hamburgerBtn.classList.toggle(CSS_CLASSES.HAMBURGER_ACTIVE, active);
        this.hamburgerBtn.setAttribute('aria-expanded', active.toString());
    }

    /**
     * Handle overlay click to close sidebar
     */
    handleOverlayClick(event) {
        if (event.target === this.overlay) {
            this.closeSidebar();
        }
    }

    /**
     * Handle keyboard navigation
     */
    handleKeydown(event) {
        try {
            // ESC key closes sidebar
            if (event.key === 'Escape' && this.isOpen) {
                this.closeSidebar();
                this.hamburgerBtn.focus();
                return;
            }

            // Only handle navigation keys when sidebar is focused
            if (!this.sidebar.contains(document.activeElement)) {
                return;
            }

            const navItems = Array.from(this.sidebar.querySelectorAll(`.${CSS_CLASSES.NAV_ITEM} a`));
            const currentIndex = navItems.indexOf(document.activeElement);

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    const nextIndex = (currentIndex + 1) % navItems.length;
                    navItems[nextIndex].focus();
                    break;
                    
                case 'ArrowUp':
                    event.preventDefault();
                    const prevIndex = currentIndex === 0 ? navItems.length - 1 : currentIndex - 1;
                    navItems[prevIndex].focus();
                    break;
                    
                case 'Home':
                    event.preventDefault();
                    navItems[0].focus();
                    break;
                    
                case 'End':
                    event.preventDefault();
                    navItems[navItems.length - 1].focus();
                    break;
            }
        } catch (error) {
            console.error('Error handling keydown:', error);
        }
    }

    /**
     * Handle navigation item clicks
     */
    handleNavigation(event) {
        try {
            const link = event.currentTarget;
            const href = link.getAttribute('href');
            
            // Validate href
            if (!href || !this.isValidNavigation(href)) {
                console.error('Invalid navigation href:', href);
                event.preventDefault();
                return;
            }

            // Update active state
            this.setActiveNavItem(href);
            
            // Close sidebar on mobile after navigation
            if (this.isMobile) {
                setTimeout(() => this.closeSidebar(), 150);
            }
            
        } catch (error) {
            console.error('Error handling navigation:', error);
            this.handleError(error);
        }
    }

    /**
     * Validate navigation URLs
     */
    isValidNavigation(href) {
        if (!href || typeof href !== 'string') {
            return false;
        }

        // Check against allowed navigation items
        return NAV_ITEMS.some(item => item.href === href);
    }

    /**
     * Set active navigation item
     */
    setActiveNavItem(href = null) {
        try {
            const currentPath = href || window.location.pathname;
            const navItems = this.sidebar.querySelectorAll(`.${CSS_CLASSES.NAV_ITEM} a`);
            
            navItems.forEach(item => {
                const itemHref = item.getAttribute('href');
                const isActive = itemHref === currentPath;
                
                const navItem = item.closest(`.${CSS_CLASSES.NAV_ITEM}`);
                if (navItem) {
                    navItem.classList.toggle(CSS_CLASSES.NAV_ITEM_ACTIVE, isActive);
                }
                
                item.setAttribute('aria-current', isActive ? 'page' : 'false');
            });
        } catch (error) {
            console.error('Error setting active nav item:', error);
        }
    }

    /**
     * Focus first navigation item
     */
    focusFirstNavItem() {
        try {
            const firstNavItem = this.sidebar.querySelector(`.${CSS_CLASSES.NAV_ITEM} a`);
            if (firstNavItem) {
                firstNavItem.focus();
            }
        } catch (error) {
            console.error('Error focusing first nav item:', error);
        }
    }

    /**
     * Save sidebar state to localStorage
     */
    saveState() {
        try {
            const state = {
                isOpen: this.isOpen,
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save sidebar state:', error);
        }
    }

    /**
     * Restore sidebar state from localStorage
     */
    restoreState() {
        try {
            const savedState = localStorage.getItem(STORAGE_KEY);
            if (!savedState) {
                // Default to open on desktop, closed on mobile
                this.isOpen = !this.isMobile;
            } else {
                const state = JSON.parse(savedState);
                // Only restore if saved within last 24 hours
                const isRecent = Date.now() - state.timestamp < 24 * 60 * 60 * 1000;
                this.isOpen = isRecent ? state.isOpen : !this.isMobile;
            }

            // Apply initial state
            if (this.isOpen) {
                this.openSidebar();
            } else {
                this.closeSidebar();
            }
        } catch (error) {
            console.warn('Failed to restore sidebar state:', error);
            this.isOpen = !this.isMobile;
        }
    }

    /**
     * Utility function to debounce function calls
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Handle errors gracefully
     */
    handleError(error) {
        console.error('SidebarController error:', error);
        
        // Reset to safe state
        try {
            this.isOpen = false;
            document.body.style.overflow = '';
            if (this.overlay) {
                this.hideOverlay();
            }
            this.updateHamburgerState(false);
        } catch (resetError) {
            console.error('Failed to reset sidebar state:', resetError);
        }
    }

    /**
     * Destroy the sidebar controller and clean up
     */
    destroy() {
        try {
            // Remove event listeners
            window.removeEventListener('resize', this.handleResize);
            document.removeEventListener('keydown', this.handleKeydown);
            
            if (this.hamburgerBtn) {
                this.hamburgerBtn.removeEventListener('click', this.toggleSidebar);
            }
            
            if (this.overlay) {
                this.overlay.removeEventListener('click', this.handleOverlayClick);
            }

            // Reset state
            this.isInitialized = false;
            this.isOpen = false;
            document.body.style.overflow = '';
            
            console.log('SidebarController destroyed');
        } catch (error) {
            console.error('Error destroying SidebarController:', error);
        }
    }
}

// Initialize sidebar when DOM is ready
let sidebarInstance = null;

function initSidebar() {
    if (!sidebarInstance) {
        sidebarInstance = new SidebarController();
        sidebarInstance.init();
    }
    return sidebarInstance;
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
} else {
    initSidebar();
}

// Export for module systems and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SidebarController, initSidebar };
} else {
    window.SidebarController = SidebarController;
    window.initSidebar = initSidebar;
}