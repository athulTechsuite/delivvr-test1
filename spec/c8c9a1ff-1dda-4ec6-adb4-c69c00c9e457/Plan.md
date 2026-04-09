# Plan for c8c9a1ff-1dda-4ec6-adb4-c69c00c9e457

## Feature
Add side navigation layout to dashboard with Profile and Settings pages

## Context
Extend the existing views/layout.ejs template to include side navigation and replace views/dashboard.ejs with a new layout that incorporates side navigation with Dashboard, Profile, Settings, and Logout menu items. Create two new static pages (Profile and Settings) that require authenticateToken middleware protection like the current dashboard. Add new routes in app.js or a dedicated routes file to handle /profile and /settings endpoints. All pages will be static/dummy pages with no functional changes to authentication logic, user data, or database operations. The side navigation should be responsive using Bootstrap classes and maintain the existing authentication patterns including JWT token validation and user context passing through req.user.

## Inputs
- Approved spec: `spec/c8c9a1ff-1dda-4ec6-adb4-c69c00c9e457/spec.md`

## Execution Steps
- Implement feature according to approved story and acceptance criteria.
- Add/adjust tests for each acceptance criterion.
- Run build and validations.
- Open/update PR from the same feature branch.
