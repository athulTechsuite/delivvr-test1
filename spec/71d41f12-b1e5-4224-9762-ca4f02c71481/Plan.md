# Plan for 71d41f12-b1e5-4224-9762-ca4f02c71481

## Feature
Replace top navbar with collapsible side navigation

## Context
Replace the existing Bootstrap top navbar in views/layout.ejs with a collapsible side navigation containing hamburger menu functionality. The side navigation will include Dashboard and Logout links for authenticated users, maintaining the current authentication flow through existing middleware/auth.js. Create empty static Dashboard and Logout pages with titles only, using the same EJS template structure. The implementation will use Bootstrap 5 components with responsive design, maintaining the existing JWT cookie-based authentication system. No business logic or database changes required - purely a UI layout restructuring that preserves all current authentication routes and user session management.

## Inputs
- Approved spec: `spec/71d41f12-b1e5-4224-9762-ca4f02c71481/spec.md`

## Execution Steps
- Implement feature according to approved story and acceptance criteria.
- Add/adjust tests for each acceptance criterion.
- Run build and validations.
- Open/update PR from the same feature branch.
