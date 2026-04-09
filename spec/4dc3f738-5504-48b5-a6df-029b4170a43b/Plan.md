# Plan for 4dc3f738-5504-48b5-a6df-029b4170a43b

## Feature
Replace top navbar with collapsible side navigation layout

## Context
Replace the existing top navigation in layout.ejs with a collapsible side navigation layout that includes Dashboard, Profile, Settings, and Logout menu items. The implementation requires completely replacing the current dashboard.ejs file with a new side navigation structure that includes a hamburger menu for mobile responsiveness. The side navigation will be persistent on desktop with a collapsible hamburger menu for mobile devices. This involves updating the main layout template, creating dummy static pages for Profile and Settings routes, updating CSS styles for the new navigation structure, and extending the dashboard route handler to support the additional navigation items. The changes maintain the existing Bootstrap 5 framework, JWT authentication middleware patterns, and EJS templating structure while providing a modern sidebar layout with responsive design capabilities.

## Inputs
- Approved spec: `spec/4dc3f738-5504-48b5-a6df-029b4170a43b/spec.md`

## Execution Steps
- Implement feature according to approved story and acceptance criteria.
- Add/adjust tests for each acceptance criterion.
- Run build and validations.
- Open/update PR from the same feature branch.
