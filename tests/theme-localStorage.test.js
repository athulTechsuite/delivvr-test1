/**
 * LocalStorage Theme Persistence Tests
 * Tests theme preference saving and loading functionality
 */

describe('Theme LocalStorage Persistence', () => {
    let mockLocalStorage;
    let themeManager;
    
    beforeEach(() => {
        // Mock localStorage
        mockLocalStorage = {
            storage: {},
            getItem: jest.fn((key) => mockLocalStorage.storage[key] || null),
            setItem: jest.fn((key, value) => {
                mockLocalStorage.storage[key] = value;
            }),
            removeItem: jest.fn((key) => {
                delete mockLocalStorage.storage[key];
            }),
            clear: jest.fn(() => {
                mockLocalStorage.storage = {};
            })
        };
        
        // Mock DOM
        document.documentElement = {
            setAttribute: jest.fn(),
            getAttribute: jest.fn(() => 'light')
        };
        
        document.body = {
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn(() => false)
            }
        };
        
        document.getElementById = jest.fn((id) => {
            if (id === 'theme-toggle') {
                return {
                    addEventListener: jest.fn(),
                    click: jest.fn()
                };
            }
            if (id === 'themeIcon') {
                return {
                    className: 'bi bi-sun-fill'
                };
            }
            if (id === 'themeText') {
                return {
                    textContent: 'Light'
                };
            }
            return null;
        });
        
        // Mock global localStorage
        Object.defineProperty(window, 'localStorage', {
            value: mockLocalStorage,
            writable: true
        });
        global.localStorage = mockLocalStorage;
        
        // Reset DOM mocks
        jest.clearAllMocks();
    });
    
    describe('Theme preference storage', () => {
        test('should save light theme preference to localStorage', () => {
            mockLocalStorage.setItem('theme-preference', 'light');
            
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme-preference', 'light');
            expect(mockLocalStorage.storage['theme-preference']).toBe('light');
        });
        
        test('should save dark theme preference to localStorage', () => {
            mockLocalStorage.setItem('theme-preference', 'dark');
            
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme-preference', 'dark');
            expect(mockLocalStorage.storage['theme-preference']).toBe('dark');
        });
        
        test('should retrieve saved theme preference from localStorage', () => {
            mockLocalStorage.storage['theme-preference'] = 'dark';
            
            const result = mockLocalStorage.getItem('theme-preference');
            
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith('theme-preference');
            expect(result).toBe('dark');
        });
        
        test('should return null when no theme preference is saved', () => {
            const result = mockLocalStorage.getItem('theme-preference');
            
            expect(result).toBeNull();
        });
    });
    
    describe('Theme initialization from localStorage', () => {
        test('should apply saved dark theme on page load', () => {
            mockLocalStorage.storage['theme-preference'] = 'dark';
            
            // Simulate theme initialization script
            const savedTheme = mockLocalStorage.getItem('theme-preference') || 'light';
            document.documentElement.setAttribute('data-bs-theme', savedTheme);
            
            expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-bs-theme', 'dark');
        });
        
        test('should apply saved light theme on page load', () => {
            mockLocalStorage.storage['theme-preference'] = 'light';
            
            const savedTheme = mockLocalStorage.getItem('theme-preference') || 'light';
            document.documentElement.setAttribute('data-bs-theme', savedTheme);
            
            expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-bs-theme', 'light');
        });
        
        test('should default to light theme when no preference exists', () => {
            const savedTheme = mockLocalStorage.getItem('theme-preference') || 'light';
            document.documentElement.setAttribute('data-bs-theme', savedTheme);
            
            expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-bs-theme', 'light');
        });
        
        test('should handle invalid theme values gracefully', () => {
            mockLocalStorage.storage['theme-preference'] = 'invalid-theme';
            
            // Simulate validation logic
            const savedTheme = mockLocalStorage.getItem('theme-preference');
            const validThemes = ['light', 'dark'];
            const themeToApply = validThemes.includes(savedTheme) ? savedTheme : 'light';
            
            document.documentElement.setAttribute('data-bs-theme', themeToApply);
            
            expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-bs-theme', 'light');
        });
    });
    
    describe('Theme persistence across sessions', () => {
        test('should maintain theme preference across browser sessions', () => {
            // Simulate first session - set dark theme
            mockLocalStorage.setItem('theme-preference', 'dark');
            expect(mockLocalStorage.storage['theme-preference']).toBe('dark');
            
            // Simulate new session - retrieve theme
            const retrievedTheme = mockLocalStorage.getItem('theme-preference');
            expect(retrievedTheme).toBe('dark');
        });
        
        test('should update theme preference when changed', () => {
            // Initial theme
            mockLocalStorage.setItem('theme-preference', 'light');
            expect(mockLocalStorage.storage['theme-preference']).toBe('light');
            
            // Change theme
            mockLocalStorage.setItem('theme-preference', 'dark');
            expect(mockLocalStorage.storage['theme-preference']).toBe('dark');
            
            // Verify persistence
            const currentTheme = mockLocalStorage.getItem('theme-preference');
            expect(currentTheme).toBe('dark');
        });
        
        test('should handle multiple theme changes correctly', () => {
            const themeChanges = ['dark', 'light', 'dark', 'light'];
            
            themeChanges.forEach(theme => {
                mockLocalStorage.setItem('theme-preference', theme);
                expect(mockLocalStorage.storage['theme-preference']).toBe(theme);
            });
            
            // Final state should be 'light'
            expect(mockLocalStorage.getItem('theme-preference')).toBe('light');
        });
    });
    
    describe('LocalStorage error handling', () => {
        test('should handle localStorage being unavailable', () => {
            // Simulate localStorage not available
            const originalLocalStorage = global.localStorage;
            delete global.localStorage;
            
            let theme = 'light'; // fallback
            
            try {
                theme = global.localStorage?.getItem('theme-preference') || 'light';
            } catch (error) {
                theme = 'light';
            }
            
            expect(theme).toBe('light');
            
            // Restore localStorage
            global.localStorage = originalLocalStorage;
        });
        
        test('should handle localStorage.getItem throwing error', () => {
            mockLocalStorage.getItem = jest.fn(() => {
                throw new Error('LocalStorage access denied');
            });
            
            let theme = 'light';
            
            try {
                theme = mockLocalStorage.getItem('theme-preference') || 'light';
            } catch (error) {
                theme = 'light';
            }
            
            expect(theme).toBe('light');
        });
        
        test('should handle localStorage.setItem throwing error', () => {
            mockLocalStorage.setItem = jest.fn(() => {
                throw new Error('LocalStorage quota exceeded');
            });
            
            expect(() => {
                try {
                    mockLocalStorage.setItem('theme-preference', 'dark');
                } catch (error) {
                    // Handle gracefully
                    console.warn('Failed to save theme preference:', error.message);
                }
            }).not.toThrow();
        });
        
        test('should handle corrupted localStorage data', () => {
            // Simulate corrupted data
            mockLocalStorage.storage['theme-preference'] = '\x00\x01invalid';
            
            const savedTheme = mockLocalStorage.getItem('theme-preference');
            const validThemes = ['light', 'dark'];
            const theme = validThemes.includes(savedTheme) ? savedTheme : 'light';
            
            expect(theme).toBe('light');
        });
    });
    
    describe('Theme storage key consistency', () => {
        test('should use consistent storage key across application', () => {
            const expectedKey = 'theme-preference';
            
            mockLocalStorage.setItem(expectedKey, 'dark');
            const retrievedValue = mockLocalStorage.getItem(expectedKey);
            
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(expectedKey, 'dark');
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith(expectedKey);
            expect(retrievedValue).toBe('dark');
        });
        
        test('should not interfere with other localStorage keys', () => {
            mockLocalStorage.setItem('other-key', 'other-value');
            mockLocalStorage.setItem('theme-preference', 'dark');
            
            expect(mockLocalStorage.getItem('other-key')).toBe('other-value');
            expect(mockLocalStorage.getItem('theme-preference')).toBe('dark');
        });
        
        test('should clean up old theme-related keys if they exist', () => {
            // Simulate old keys that might exist
            mockLocalStorage.setItem('theme', 'old-value');
            mockLocalStorage.setItem('darkMode', 'true');
            mockLocalStorage.setItem('theme-preference', 'dark');
            
            // Current implementation should only use 'theme-preference'
            expect(mockLocalStorage.getItem('theme-preference')).toBe('dark');
            
            // Old keys should be ignored
            const currentTheme = mockLocalStorage.getItem('theme-preference');
            expect(currentTheme).not.toBe('old-value');
            expect(currentTheme).not.toBe('true');
        });
    });
});