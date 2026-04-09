# Plan for a3535fef-4b05-4b3e-bfe8-be086af2260b

## Feature
Replace navbar with side navigation layout

## Context
Replace the existing top navbar in views/layout.ejs with a fixed side navigation menu containing Dashboard and Logout links. Create two new static routes /static/dashboard and /static/logout that render dummy pages with no authentication logic or functionality. The side navigation will be always visible and fixed position, using existing Bootstrap classes where possible. New static routes will be completely separate from the existing authentication system in routes/auth.js and routes/dashboard.js, serving purely as layout demonstrations. All authentication middleware and database interactions will be removed from the static pages to focus solely on visual layout structure. The implementation requires modifying the main layout template, adding new route handlers in app.js, creating new EJS templates, and updating CSS styling for the side navigation component.

## Inputs
- Approved spec: `spec/a3535fef-4b05-4b3e-bfe8-be086af2260b/spec.md`

## Execution Steps
- Implement feature according to approved story and acceptance criteria.
- Add/adjust tests for each acceptance criterion.
- Run build and validations.
- Open/update PR from the same feature branch.
