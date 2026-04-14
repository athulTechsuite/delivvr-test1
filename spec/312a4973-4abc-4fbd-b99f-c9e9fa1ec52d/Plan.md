# Plan for 312a4973-4abc-4fbd-b99f-c9e9fa1ec52d

## Feature
Implement Persistent User Login with Refresh Token Pattern

## Context
This ticket implements persistent user sessions with a "Remember me" checkbox on the login form. When checked, the system generates a 7-day JWT access token paired with a refresh token stored in the database. The authenticateToken middleware automatically refreshes tokens 1 hour before expiry, enabling seamless cross-session authentication. Users who don't check "Remember me" maintain the existing 24-hour session behavior. The refresh token pattern requires adding refresh_token and token_expires_at columns to the users table. Logout functionality clears both access tokens from cookies and refresh tokens from the database, revoking all active sessions. This enhances user experience by eliminating repeated login requirements while maintaining security through token rotation and revocation capabilities.

## Inputs
- Approved spec: `spec/312a4973-4abc-4fbd-b99f-c9e9fa1ec52d/spec.md`

## Execution Steps
- Implement feature according to approved story and acceptance criteria.
- Add/adjust tests for each acceptance criterion.
- Run build and validations.
- Open/update PR from the same feature branch.
