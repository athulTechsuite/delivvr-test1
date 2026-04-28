# Fix: Order Page Card Text Alignment to Match Unified md-card Style

## Summary
The My Orders list page (`views/orders-list.ejs`) and Order detail page (`views/orders-detail.ejs`) render their primary content inside `md-card` components whose internal text is visually inconsistent with the rest of the Delivvr app. The card header forces `md-display-flex md-justify-content-space-between` while the global stylesheet (`public/css/style.css` lines 706-715 and 2183-2188) hard-codes `text-align: center` on `.md-card-header h1-h6`, producing a centered-then-shoved title plus a status chip whose vertical center does not align with the heading baseline. Inside `md-card-content`, every field uses an `md-display-flex` icon+label row followed by a value indented with `md-padding-left-lg`, but the icon/label row itself is not indented — so labels and values render at two different left edges, and the vertical rhythm between rows differs from the `dashboard.ejs` and `profile.ejs` cards (which use `md-profile-info-item` with `md-profile-info-label`/`md-profile-info-value` siblings sharing the same indent). This PRD specifies the markup and CSS updates required to make the Orders cards visually identical to the rest of the app while reusing existing utility classes and spacing tokens — no new design system work.

## Objective
- Eliminate the visual regression where `md-card-header` titles on the Orders pages render off-center (centered by global rule, then forced to flex-start by `space-between`), so all `md-card-header` titles across the app render at a single, consistent horizontal alignment.
- Achieve a single left-edge for both label rows and value rows inside Orders cards (currently labels start at the card padding edge and values are pushed in by `md-padding-left-lg` — ~24px gap).
- Reduce vertical-spacing variance between order field rows from the current mix (`md-margin-bottom-md` on three rows, none on the last) to a single, uniform rhythm matching `dashboard.ejs` profile-info rows (`md-margin-bottom-md` on every non-last row, none on last).
- Zero new CSS classes added — all changes use existing `md-*` utilities and `--md-spacing-*` tokens defined in `public/css/style.css`.

## Mandatory Codebase Review
Before changing anything, the implementer MUST read:
1. **`public/css/style.css` lines 696-756** — the `md-card`, `md-card-header`, and `md-card-content` definitions, including the `text-align: center` rule on header headings (lines 706-715) and the duplicate header heading rule at lines 2183-2188. This is the rule the Orders pages are unintentionally fighting.
2. **`public/css/style.css` lines 1636-1668** — the `md-profile-info-item` / `md-profile-info-label` / `md-profile-info-value` pattern that dashboard/profile cards rely on. The Orders cards should mirror this label-above-value indentation pattern.
3. **`views/dashboard.ejs` lines 109-157** — the canonical Profile Information card. Note: header is NOT `md-display-flex md-justify-content-space-between`; it is plain `md-card-header md-bg-primary md-padding-md` with a single `h2.md-card-title`. Each row is `md-profile-info-item md-margin-bottom-md` with label and value sharing left padding via `md-padding-left-lg` on BOTH siblings (label uses flex with icon, value uses `md-padding-left-lg`).
4. **`views/profile.ejs`** — verify the same pattern is repeated for cross-page consistency.
5. **`views/orders-list.ejs` lines 130-186** — the broken order-card markup that must be repaired (header + 4 field rows: Pickup, Delivery, Description, Placed).
6. **`views/orders-detail.ejs` lines 105-171** — the broken order-detail card (header + 5 field rows: Order ID, Pickup, Delivery, Description, Placed).

## Business Logic

### Card Header Layout
- Rule: `md-card-header` titles must visually align with the header content; when a status chip co-exists with a title, BOTH are placed on a single row with the title left-aligned and the chip right-aligned.
- Rule: The global `.md-card-header h1-h6 { text-align: center }` rule (style.css:714) MUST be overridden when the header uses a flex layout — overriding via `text-align: left` inline on the title element is forbidden; instead use a scoped class `md-card-header--split` that resets `text-align` to `inherit` and applies `display: flex; justify-content: space-between; align-items: center;`.
- Rule: Status chip vertical-center must align with title cap-height; this requires `align-items: center` on the flex container (already present, must be preserved).

### Field Row Alignment Inside md-card-content
- Rule: Label icon row and value row MUST share the same horizontal left edge. Either (a) remove `md-padding-left-lg` from values OR (b) add equivalent padding to labels. Decision: keep `md-padding-left-lg` on values AND add `md-padding-left-lg` on labels — matching `dashboard.ejs:120` which uses `md-display-flex md-align-items-center md-margin-bottom-xs` directly without extra indentation, with the icon serving as the visual anchor. To match the dashboard exactly, REMOVE `md-padding-left-lg` from value `<div>` and let the icon (`md-icon-small md-margin-right-sm`) on the label row provide the natural visual indent.
- Rule: Vertical spacing between field rows must be `var(--md-spacing-md)` (i.e. `md-margin-bottom-md`) on every row except the last, which has no bottom margin. The current code on `orders-list.ejs:176` uses `<div>` with no margin class on the last row — this is correct and must be preserved; the bug is that intermediate rows are correct but the last row's omission of margin is inconsistent in detail page where it also lacks margin (correct) but the visual rhythm above it is uneven due to label/value indent mismatch.

### Typography
- Rule: Label uses `md-body-medium md-text-secondary md-font-weight-medium` (existing — preserve).
- Rule: Value uses `md-body-large md-text-primary` (existing — preserve), except the timestamp `Placed` row which uses `md-body-medium md-text-primary` (existing — preserve).

### Theme Compatibility
- Rule: Changes MUST work in both light and dark themes. The dark-theme overrides in `style.css:743-759` apply to `md-card-header` regardless of new modifier class — verify the new `md-card-header--split` modifier inherits `background-color: var(--md-surface-4dp)` under `.dark-theme`.

## Required Code Changes

### CSS — Add header split modifier
**Files:** `public/css/style.css`
**What:** Add a single new modifier class `.md-card-header--split` that overrides the centered-heading rule when a header contains both a title and a trailing element (e.g. status chip). Place it immediately after the existing `.md-card-header h1-h6` block (after line 716) so cascade order is correct.
**Before (lines 706-716):**
```css
.md-card-header h1,
.md-card-header h2,
.md-card-header h3,
.md-card-header h4,
.md-card-header h5,
.md-card-header h6 {
  color: var(--md-text-primary-on-primary);
  margin: 0;
  text-align: center;
  font-weight: var(--md-font-weight-medium);
}
```
**After (append new rule, do not modify the rule above):**
```css
.md-card-header h1,
.md-card-header h2,
.md-card-header h3,
.md-card-header h4,
.md-card-header h5,
.md-card-header h6 {
  color: var(--md-text-primary-on-primary);
  margin: 0;
  text-align: center;
  font-weight: var(--md-font-weight-medium);
}

/* Split header: title left, trailing element (e.g. status chip) right */
.md-card-header--split {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--md-spacing-md);
}
.md-card-header--split h1,
.md-card-header--split h2,
.md-card-header--split h3,
.md-card-header--split h4,
.md-card-header--split h5,
.md-card-header--split h6 {
  text-align: left;
  flex: 1 1 auto;
  min-width: 0;
}
```

### CSS — Defensive duplicate-rule cleanup
**Files:** `public/css/style.css`
**What:** The duplicate `.md-card-header h1, h2, h3` block at lines 2183-2188 (added in a prior fix) sets color but does not reset `text-align`. To prevent regression, leave the duplicate rule untouched (it does not specify text-align so it does not interfere). Verify no other rule sets `text-align` on `.md-card-header--split` descendants.
**Before (lines 2183-2188):**
```css
.md-card-header h1,
.md-card-header h2,
.md-card-header h3 {
  color: var(--md-on-primary, #fff);
  margin: 0;
}
```
**After:** No change — verify only.

### Markup — orders-list.ejs card header
**Files:** `views/orders-list.ejs`
**What:** Replace the inline flex utilities on `md-card-header` (line 131) with the new modifier class so the global centered-heading rule is correctly overridden.
**Before (line 131):**
```html
<div class="md-card-header md-padding-md md-display-flex md-justify-content-space-between md-align-items-center">
    <h3 class="md-card-title md-headline-small md-margin-none md-text-on-primary">
        <i class="bi bi-hash" aria-hidden="true"></i>
        Order <%= order.id %>
    </h3>
    <span class="<%= chipClass %>" aria-label="Status: <%= statusLabel %>">
```
**After:**
```html
<div class="md-card-header md-card-header--split md-padding-md">
    <h3 class="md-card-title md-headline-small md-margin-none md-text-on-primary">
        <i class="bi bi-hash" aria-hidden="true"></i>
        Order <%= order.id %>
    </h3>
    <span class="<%= chipClass %>" aria-label="Status: <%= statusLabel %>">
```

### Markup — orders-list.ejs field rows (remove value indent mismatch)
**Files:** `views/orders-list.ejs`
**What:** Remove `md-padding-left-lg` from each value `<div>` (lines 147, 157, 167, 181) so values share the same left edge as the icon-prefixed label row. The icon's `md-margin-right-sm` plus its width acts as a natural ~24px visual indent — value text begins at the card-content left padding edge, just like `dashboard.ejs:125` (`<span class="md-body-large md-text-primary">` with no left padding). Result: cleaner, single-edge column matching profile/dashboard cards.
**Before (representative — line 147):**
```html
<div class="md-body-large md-text-primary md-padding-left-lg">
    <%= order.pickup_address %>
</div>
```
**After:**
```html
<div class="md-body-large md-text-primary">
    <%= order.pickup_address %>
</div>
```
Apply identical removal to lines 157 (delivery_address), 167-173 (description block), and 181 (createdLabel — note this row uses `md-body-medium`, preserve that).

### Markup — orders-detail.ejs card header
**Files:** `views/orders-detail.ejs`
**What:** Same modifier-class swap as orders-list.
**Before (line 106):**
```html
<div class="md-card-header md-padding-md md-display-flex md-justify-content-space-between md-align-items-center">
    <h3 class="md-card-title md-headline-small md-margin-none md-text-on-primary">
        <i class="bi bi-receipt" aria-hidden="true"></i>
        Order #<%= order.id %>
    </h3>
```
**After:**
```html
<div class="md-card-header md-card-header--split md-padding-md">
    <h3 class="md-card-title md-headline-small md-margin-none md-text-on-primary">
        <i class="bi bi-receipt" aria-hidden="true"></i>
        Order #<%= order.id %>
    </h3>
```

### Markup — orders-detail.ejs field rows
**Files:** `views/orders-detail.ejs`
**What:** Remove `md-padding-left-lg` from each value `<div>` for the 5 fields: Order ID (line 122), Pickup (132), Delivery (142), Description (152), Placed (166).
**Before (representative — line 122):**
```html
<div class="md-body-large md-text-primary md-padding-left-lg">
    <%= order.id %>
</div>
```
**After:**
```html
<div class="md-body-large md-text-primary">
    <%= order.id %>
</div>
```

## Acceptance Criteria
- [ ] Given the My Orders page renders 1+ orders, When inspecting any order card header, Then the order-id title is left-aligned within the header and the status chip is right-aligned within the header, with both vertically centered on the same row.
- [ ] Given any `md-card-header` elsewhere in the app (dashboard.ejs Profile Information card, profile.ejs cards), When the page is rendered, Then those headers continue to use centered text (no regression from the new modifier class).
- [ ] Given an order card on `/orders` is inspected via DevTools, When measuring the left edge of the "Pickup" label `<span>` and the left edge of the pickup-address value `<div>` text, Then the difference equals only the icon width plus `--md-spacing-sm` margin (i.e. label icon offset), not an additional `--md-spacing-lg` indent.
- [ ] Given the Order Detail page at `/orders/:id`, When viewing all 5 field rows (Order ID, Pickup, Delivery, Description, Placed), Then every value row begins at the same horizontal X coordinate (within 1px tolerance).
- [ ] Given vertical spacing between consecutive field rows on `/orders/:id`, When measuring margin between row N's value and row N+1's icon, Then the gap equals `var(--md-spacing-md)` (16px at default scale) on every non-last row.
- [ ] Given the dark theme is active (body has `.dark-theme`), When viewing an order card header, Then the new `md-card-header--split` background is `var(--md-surface-4dp)` and title color is `var(--md-text-primary-on-primary)` — no contrast regression.
- [ ] Given a status of `pending`, `delivered`, `cancelled`, or any other value, When rendering the chip in the split header, Then the chip remains right-aligned with no overlap of the title even at the longest status label "In Transit".
- [ ] Given the My Orders empty state (`orders.length === 0`), When rendered, Then no visual change occurs (the empty-state card uses `md-text-center md-padding-xl` and is not affected by these changes).
- [ ] Given the description field is empty, When rendered, Then the em-dash placeholder `—` appears at the same left edge as other values (no `md-padding-left-lg` indent).
- [ ] Given a screen-reader user navigates an order card, When focus enters the header, Then the heading text and `aria-label="Status: <label>"` are announced in DOM order (title first, chip second) — DOM order MUST NOT change.
- [ ] Given any user clicks an order card on `/orders`, When the click fires, Then navigation to `/orders/:id` still works (the wrapping `<a class="md-order-card-link">` remains untouched).
- [ ] Given the page is loaded at viewport widths 320px, 768px, 1024px, 1440px, When the order card renders, Then header title and chip remain on a single row at all widths (chip may wrap below title only if container width < 280px, which is below the supported minimum).

## Test Cases

### Functional (TC-F-XXX)
- **TC-F-001** Header alignment on list: Render `/orders` with 3 orders → inspect `.md-card-header--split` → title `<h3>` has computed `text-align: left` and chip `<span>` has computed `margin-left: auto` via `justify-content: space-between`.
- **TC-F-002** Header alignment on detail: Render `/orders/:id` for an existing order → inspect single `.md-card-header--split` → title `Order #<id>` left-aligned, chip right-aligned, both vertically centered (DevTools box model shows shared center-Y).
- **TC-F-003** Value left-edge consistency on list: Render `/orders` with at least one order → for each of the 4 fields (Pickup, Delivery, Description, Placed) measure `.md-body-large.md-text-primary` (or `.md-body-medium.md-text-primary` for Placed) `getBoundingClientRect().left` → all 4 left values are equal.
- **TC-F-004** Value left-edge consistency on detail: Render `/orders/:id` → measure left edge of all 5 value `<div>` elements → all 5 are equal.
- **TC-F-005** Vertical rhythm on detail: Render `/orders/:id` → measure margin-bottom on each `md-margin-bottom-md` field wrapper → equals `var(--md-spacing-md)` (16px); last field wrapper (the one without `md-margin-bottom-md` class) has margin-bottom 0.
- **TC-F-006** Dashboard regression: Render `/dashboard` → Profile Information card header `<h2>` retains computed `text-align: center` (the global rule still applies because the header does NOT have `md-card-header--split`).
- **TC-F-007** Profile page regression: Render `/profile` → all `md-card-header` titles retain `text-align: center`.

### Edge Cases (TC-E-XXX)
- **TC-E-001** Long status label: Inject an order with `status = 'in_transit'` → `statusLabel = "In Transit"` → render → title `Order <id>` does not wrap and does not overlap chip; total header height remains single-line at 1024px viewport.
- **TC-E-002** Empty description: Render an order with `package_description = null` → description value renders the em-dash inside `<span class="md-text-secondary">—</span>` at the same left edge as other values (no `md-padding-left-lg`).
- **TC-E-003** Very long pickup address: Render an order with a 200-character `pickup_address` → text wraps inside the value `<div>` at the card-content right edge; subsequent lines wrap to the same left edge as line 1 (no hanging indent).
- **TC-E-004** Dark theme: Add `.dark-theme` class to body → reload `/orders` → header background is `var(--md-surface-4dp)`, title color readable, chip readable; no contrast violations against WCAG AA.
- **TC-E-005** Single order in list: Render `/orders` with exactly one order → card occupies `md-col-md-6 md-col-lg-4` width; header layout still split correctly with no flex collapse.

### Regression (TC-R-XXX)
- **TC-R-001** Dashboard Profile card unchanged: Visual diff `/dashboard` Profile Information card before vs after CSS change → pixel-identical (no `md-card-header--split` applied there, so global centered rule still fires).
- **TC-R-002** Order card link still navigates: Click an order card on `/orders` → browser navigates to `/orders/<id>` (the wrapping `<a class="md-order-card-link">` is preserved).
- **TC-R-003** Empty-orders state unchanged: Render `/orders` for a user with zero orders → empty-state card with "No orders yet" renders identically to current production (untouched markup).
- **TC-R-004** Status chip classes preserved: Render orders with each of `pending`, `delivered`, `cancelled`, and other statuses → chip receives correct `md-chip-pending` / `md-chip-delivered` / `md-chip-cancelled` / `md-chip-active` class as before.

## Risk and Deployment
**Risk Level:** LOW — pure presentational change, no data, controller, or route changes; affects only two view files plus an additive CSS rule.
**Deployment Order:**
1. Merge the CSS addition (`public/css/style.css` new `.md-card-header--split` rule).
2. Merge the EJS markup updates (`views/orders-list.ejs`, `views/orders-detail.ejs`) in the same release — they depend on the new CSS class.
3. Deploy as a single atomic release; do not stagger CSS vs views.
4. Smoke-test `/orders`, `/orders/:id`, `/dashboard`, `/profile` in both light and dark themes.
**Rollback Plan:** Single `git revert` of the merge commit restores all three files. No data migrations, no feature flags. Rollback recovery time: < 2 minutes.
**Key Risks:**
- Risk: New CSS rule unintentionally cascades to `md-card-header` instances in future pages — Mitigation: rule is scoped to `.md-card-header--split` modifier, opt-in only.
- Risk: Removing `md-padding-left-lg` from values breaks visual hierarchy on narrow viewports — Mitigation: TC-F-003/TC-F-004 verify alignment at all supported widths; pattern matches `dashboard.ejs` already in production.
- Risk: Dark-theme contrast regression on the new split header — Mitigation: TC-E-004 explicitly verifies dark theme.
- Risk: A future contributor adds another `md-card-header` with chip and forgets the modifier — Mitigation: documented in the PRD acceptance criteria; consider a follow-up to add a CSS lint rule.

## Definition of Done
- [ ] CSS rule `.md-card-header--split` added to `public/css/style.css` immediately after line 716, with the heading override block, and verified to compile (no syntax errors).
- [ ] `views/orders-list.ejs` line 131 updated to use `md-card-header md-card-header--split md-padding-md` (no `md-display-flex md-justify-content-space-between md-align-items-center`).
- [ ] `views/orders-list.ejs` lines 147, 157, 167, 181 — `md-padding-left-lg` removed from value `<div>` elements.
- [ ] `views/orders-detail.ejs` line 106 updated to use the new modifier class.
- [ ] `views/orders-detail.ejs` lines 122, 132, 142, 152, 166 — `md-padding-left-lg` removed from value `<div>` elements.
- [ ] All 7 functional, 5 edge-case, and 4 regression test cases pass in manual QA on Chrome, Firefox, and Safari.
- [ ] Visual diff screenshots of `/orders`, `/orders/:id`, `/dashboard`, `/profile` in both light and dark themes attached to the PR.
- [ ] No new browser console errors or warnings on any of the four pages.
- [ ] Lighthouse accessibility score on `/orders` and `/orders/:id` is unchanged or higher.
- [ ] PR reviewed and approved by a frontend owner familiar with the `md-*` design system.

## Scope Boundaries
**In Scope:**
- `public/css/style.css` — add `.md-card-header--split` modifier rule (additive, ~12 lines).
- `views/orders-list.ejs` — header markup swap + 4 value-div class trims.
- `views/orders-detail.ejs` — header markup swap + 5 value-div class trims.

**Out of Scope:**
- Refactoring `md-profile-info-item` / `md-profile-info-label` / `md-profile-info-value` to be reusable on Orders pages (deferred — would be a larger design-system unification effort).
- Removing the duplicate `.md-card-header h1, h2, h3` rule at `style.css:2183-2188` (kept untouched to avoid scope creep).
- Changes to `views/orders-new.ejs` (the New Order form does not use `md-card-header` with a chip).
- Status chip color/typography changes.
- Dashboard or Profile page markup changes.
- Mobile-specific media-query tuning beyond verifying TC-F-003/TC-F-004 at 320/768/1024/1440px.
- Adding automated visual regression tests (separate ticket).

**Assumptions:**
- The existing `md-display-flex md-justify-content-space-between md-align-items-center` utility classes will continue to be available for other components — they are not being deleted, only unused on these two card headers.
- `var(--md-spacing-md)` resolves to 16px (verify in `:root` — confirmed by grep of style.css spacing tokens).
- All consumers of `md-card-header` outside `views/orders-*.ejs` rely on the global centered-heading rule and DO want centered titles (confirmed for `dashboard.ejs` and `profile.ejs`).
- No third-party CSS overrides `.md-card-header h1-h6` text-align after style.css loads.

## Estimates
**Story Points:** 2
**Complexity:** S
