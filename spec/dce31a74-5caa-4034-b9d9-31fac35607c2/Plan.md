# Plan for dce31a74-5caa-4034-b9d9-31fac35607c2

## Feature
Update application design and add profile page with inline editing

## Context
This feature enhancement updates the visual design across all application pages to create a modern, dark-themed UI using Bootstrap components and custom CSS. The task includes creating a new profile page at `/dashboard/profile` with inline editing capabilities for user information (name, email, phone, bio). The database schema will be extended with additional User model fields (phone, bio, avatar_url) while maintaining backward compatibility. The profile page will feature toggle-based inline editing with save/cancel actions, following the existing authentication middleware patterns. All existing templates (index.ejs, login.ejs, signup.ejs, dashboard.ejs, layout.ejs) will receive design updates with consistent dark theme, improved typography, and modern card-based layouts. The sidebar navigation will be updated to include a profile link accessible only to authenticated users.

## Inputs
- Approved spec: `spec/dce31a74-5caa-4034-b9d9-31fac35607c2/spec.md`

## Execution Steps
- Implement feature according to approved story and acceptance criteria.
- Add/adjust tests for each acceptance criterion.
- Run build and validations.
- Open/update PR from the same feature branch.
