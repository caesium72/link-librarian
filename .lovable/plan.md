

## Plan: Failed Link Review, Duplicate Counter, and Clickable Overview Stats

### 1. Database Migration
- Add `duplicate_count` column to `links` table (integer, default 0) to track how many times a duplicate was attempted
- Update the `save-link` edge function and `addLink` client function to increment `duplicate_count` on the existing link when a duplicate is detected
- Backfill existing links: set `duplicate_count = save_count - 1` for links with `save_count > 1`

### 2. Failed Link Review Dialog
- Create a new component `FailedLinkReviewDialog` that opens when clicking a failed link or a "Review" button on failed cards
- Shows the link URL, error context, and options:
  - **Retry Analysis** - re-trigger the analyze-link function
  - **Edit & Resolve** - manually set title/tags/summary and mark as "ready"
  - **Delete** - remove the link entirely
- Add a "Review" button to `LinkCard` and `LinkGridCard` for failed links (alongside existing retry)

### 3. Duplicate Count in Overview Stats
- Add a 5th stat card "Duplicates" in `FilterSidebar` overview grid showing total duplicate attempts
- Pass `duplicateCount` as a new prop from `Index.tsx` (sum of `duplicate_count` across all links)
- Change the grid from 2x2 to a layout that fits 5 items

### 4. Clickable Overview Stats
- Make each overview stat card (Total, Ready, Pending, Failed, Duplicates) clickable
- Clicking "Ready" sets `statusFilter` to "ready", "Pending" to "pending", "Failed" to "failed", "Total" resets to "all"
- Clicking "Duplicates" filters to show only links where `duplicate_count > 0`
- Pass `setStatusFilter` and a new `setDuplicateFilter` callback to `FilterSidebar`
- Add visual hover/active states to indicate clickability

### 5. Update Edge Function & Client API
- `save-link` edge function: when duplicate detected, increment `duplicate_count` on existing link via `UPDATE links SET duplicate_count = duplicate_count + 1`
- `addLink` in `links.ts`: on duplicate, also increment `duplicate_count`
- `fetchLinks`: add support for filtering by `duplicate_count > 0`

### Files to Create/Modify
- **New migration**: add `duplicate_count` column + backfill
- **New component**: `src/components/FailedLinkReviewDialog.tsx`
- **Edit**: `src/components/FilterSidebar.tsx` - add duplicate stat, make stats clickable
- **Edit**: `src/pages/Index.tsx` - compute duplicateCount, pass new props, add duplicate filter state
- **Edit**: `src/components/LinkCard.tsx` - add Review button for failed links
- **Edit**: `src/components/LinkGridCard.tsx` - add Review button for failed links
- **Edit**: `src/lib/api/links.ts` - increment duplicate_count, add duplicate filter
- **Edit**: `supabase/functions/save-link/index.ts` - increment duplicate_count on duplicate

