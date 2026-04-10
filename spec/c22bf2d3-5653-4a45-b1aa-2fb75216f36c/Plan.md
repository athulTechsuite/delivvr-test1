# Plan for c22bf2d3-5653-4a45-b1aa-2fb75216f36c

## Feature
Replace top navbar with Bootstrap sidebar layout

## Context
Replace the existing top navbar in layout.ejs with a Bootstrap 5.3.0 sidebar navigation component that maintains all current authentication functionality. The sidebar will use Bootstrap's offcanvas component for mobile responsiveness, collapsing on screens below 992px and remaining fixed on desktop. All navigation links (Home, Dashboard, Login, Signup, Logout) will be preserved with identical routing behavior, including the existing POST /auth/logout endpoint. The dashboard.ejs template will be updated to remove its duplicate navbar implementation and rely on the inherited sidebar layout. User authentication state will continue to determine which navigation options are visible, and the user context variable will remain available in templates. CSS styling will be added to ensure proper responsive behavior and visual consistency with the existing Bootstrap theme.

## Inputs
- Approved spec: `spec/c22bf2d3-5653-4a45-b1aa-2fb75216f36c/spec.md`

## Execution Steps
- Implement feature according to approved story and acceptance criteria.
- Add/adjust tests for each acceptance criterion.
- Run build and validations.
- Open/update PR from the same feature branch.
