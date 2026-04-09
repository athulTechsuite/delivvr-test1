const request = require('supertest');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const app = require('../app');

// Test constants
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
const TEST_USER = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2023-01-01 12:00:00'
};

// Mock sqlite3 database
let mockDb;

// Helper function to create valid JWT token
function createValidToken() {
    return jwt.sign(
        { id: TEST_USER.id, email: TEST_USER.email },
        TEST_JWT_SECRET,
        { expiresIn: '1h' }
    );
}

// Helper function to create expired JWT token
function createExpiredToken() {
    return jwt.sign(
        { id: TEST_USER.id, email: TEST_USER.email },
        TEST_JWT_SECRET,
        { expiresIn: '-1h' }
    );
}

// Helper function to create invalid JWT token
function createInvalidToken() {
    return jwt.sign(
        { id: TEST_USER.id, email: TEST_USER.email },
        'wrong-secret',
        { expiresIn: '1h' }
    );
}

describe('Side Navigation Layout Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mock database
        mockDb = {
            get: jest.fn(),
            run: jest.fn(),
            serialize: jest.fn((callback) => callback()),
            close: jest.fn()
        };
        
        // Mock successful user lookup by default
        mockDb.get.mockImplementation((sql, params, callback) => {
            callback(null, TEST_USER);
        });
        
        // Mock the Database constructor
        sqlite3.Database = jest.fn(() => mockDb);
    });

    describe('TC-01: Side Navigation Visibility on Authenticated Pages', () => {
        test('should display side navigation on dashboard when user is authenticated', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-1: Side navigation appears on dashboard page when user is authenticated
            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('Profile');
            expect(response.text).toContain('Settings');
            expect(response.text).toContain('Logout');
        });

        test('should display side navigation on profile page when user is authenticated', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('Profile');
            expect(response.text).toContain('Settings');
            expect(response.text).toContain('Logout');
        });

        test('should display side navigation on settings page when user is authenticated', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('sidebar');
            expect(response.text).toContain('Dashboard');
            expect(response.text).toContain('Profile');
            expect(response.text).toContain('Settings');
            expect(response.text).toContain('Logout');
        });
    });

    describe('TC-02: Side Navigation Menu Items', () => {
        test('should contain exactly 4 navigation items in correct order', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-2: Side navigation contains exactly 4 items: Dashboard, Profile, Settings, Logout
            const navigationItems = response.text.match(/<a[^>]*nav-link[^>]*>(.*?)<\/a>/g) || [];
            const menuItems = navigationItems
                .map(item => item.replace(/<[^>]*>/g, '').trim())
                .filter(item => ['Dashboard', 'Profile', 'Settings', 'Logout'].includes(item));
            
            expect(menuItems).toHaveLength(4);
            expect(menuItems[0]).toContain('Dashboard');
            expect(menuItems[1]).toContain('Profile');
            expect(menuItems[2]).toContain('Settings');
            expect(menuItems[3]).toContain('Logout');
        });
    });

    describe('TC-03: Active Navigation State Highlighting', () => {
        test('should highlight Dashboard navigation item when viewing /dashboard', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-3: Dashboard navigation item is active/highlighted when viewing /dashboard
            // AC-19: Active navigation item has distinct visual styling
            expect(response.text).toMatch(/nav-link[^>]*active[^>]*.*Dashboard|Dashboard.*nav-link[^>]*active/);
        });

        test('should highlight Profile navigation item when viewing /profile', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-4: Profile navigation item is active/highlighted when viewing /profile
            expect(response.text).toMatch(/nav-link[^>]*active[^>]*.*Profile|Profile.*nav-link[^>]*active/);
        });

        test('should highlight Settings navigation item when viewing /settings', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-5: Settings navigation item is active/highlighted when viewing /settings
            expect(response.text).toMatch(/nav-link[^>]*active[^>]*.*Settings|Settings.*nav-link[^>]*active/);
        });
    });

    describe('TC-04: Navigation Link Functionality', () => {
        test('should provide correct href for Dashboard navigation item', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-6: Clicking Dashboard nav item navigates to /dashboard page
            expect(response.text).toMatch(/href="\/dashboard"[^>]*>.*Dashboard|>.*Dashboard.*href="\/dashboard"/);
        });

        test('should provide correct href for Profile navigation item', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/profile')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-7: Clicking Profile nav item navigates to /profile page
            expect(response.text).toMatch(/href="\/profile"[^>]*>.*Profile|>.*Profile.*href="\/profile"/);
        });

        test('should provide correct href for Settings navigation item', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/settings')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-8: Clicking Settings nav item navigates to /settings page
            expect(response.text).toMatch(/href="\/settings"[^>]*>.*Settings|>.*Settings.*href="\/settings"/);
        });

        test('should provide correct href for Logout navigation item', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-9: Clicking Logout nav item logs out user and redirects to login
            expect(response.text).toMatch(/href="\/logout"[^>]*>.*Logout|>.*Logout.*href="\/logout"/);
        });
    });

    describe('TC-05: Responsive Navigation Behavior', () => {
        test('should include Bootstrap responsive classes for mobile collapse', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-10: Side navigation is responsive and collapses on mobile devices
            // AC-20: Navigation maintains existing Bootstrap responsive behavior
            expect(response.text).toContain('d-md-block');
            expect(response.text).toContain('d-lg-none');
            expect(response.text).toContain('offcanvas');
            expect(response.text).toContain('navbar-toggler');
        });

        test('should include mobile offcanvas sidebar for small screens', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('offcanvas-start');
            expect(response.text).toContain('sidebarOffcanvas');
            expect(response.text).toContain('data-bs-toggle="offcanvas"');
        });
    });

    describe('TC-06: Bootstrap Icons Integration', () => {
        test('should include Bootstrap icons for menu items', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-18: Side navigation uses Bootstrap icons for menu items
            expect(response.text).toContain('bi-house'); // Dashboard icon
            expect(response.text).toContain('bi-person'); // Profile icon
            expect(response.text).toContain('bi-gear'); // Settings icon
            expect(response.text).toContain('bi-box-arrow-right'); // Logout icon
        });

        test('should load Bootstrap icons CSS library', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            expect(response.text).toContain('bootstrap-icons');
        });
    });

    describe('TC-07: Unauthenticated User Experience', () => {
        test('should not display side navigation on public pages', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            // AC-17: Unauthenticated users do not see side navigation on public pages
            // AC-24: Side navigation does not appear on login/signup pages
            expect(response.text).not.toContain('sidebar');
        });

        test('should not display side navigation on login page', async () => {
            const response = await request(app)
                .get('/login')
                .expect(200);

            expect(response.text).not.toContain('sidebar');
        });

        test('should not display side navigation on signup page', async () => {
            const response = await request(app)
                .get('/signup')
                .expect(200);

            expect(response.text).not.toContain('sidebar');
        });
    });

    describe('TC-08: Template State Handling', () => {
        test('should handle authenticated state in layout template', async () => {
            const token = createValidToken();
            
            const response = await request(app)
                .get('/dashboard')
                .set('Cookie', [`token=${token}`])
                .expect(200);

            // AC-25: Layout template properly handles both authenticated and unauthenticated states
            expect(response.text).toContain('sidebar');
            expect(response.text).not.toContain('Login');
            expect(response.text).not.toContain('Sign Up');
        });

        test('should handle unauthenticated state in layout template', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.text).not.toContain('sidebar');
            expect(response.text).toContain('Login');
            expect(response.text).toContain('Sign Up');
        });
    });
});