# Plan for a4bc21dd-016f-47a6-8d54-2126d9dee790

## Feature
Implement Dark Mode / Light Mode Theme Toggle

## Context
Add a dark/light mode theme toggle feature with a Material Design switch component in the header navigation bar across all pages (index, login, signup, dashboard, profile). The system will default to light mode on first visit and store user preferences in browser localStorage. Implementation requires creating separate dark-theme CSS class overrides in public/css/style.css, updating all 6 EJS templates to include the toggle switch in their md-navbar sections, and adding client-side JavaScript for theme persistence and switching. The toggle will be positioned in the md-navbar-nav section next to existing navigation links, using Material Design switch styling consistent with current form inputs. All existing md-* CSS classes will receive dark theme counterparts, ensuring proper text and card alignment in both modes while maintaining responsive design and accessibility standards.

## Inputs
- Approved spec: `spec/a4bc21dd-016f-47a6-8d54-2126d9dee790/spec.md`

## Execution Steps
- Implement feature according to approved story and acceptance criteria.
- Add/adjust tests for each acceptance criterion.
- Run build and validations.
- Open/update PR from the same feature branch.
