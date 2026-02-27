

## Plan: Add Button Next to Duplicates + Visible Stat Card Borders

### Changes to `src/components/FilterSidebar.tsx`

1. **Visible borders on all stat cards**: Add `border border-border` to each `StatCard`'s className so they have visible borders.

2. **Button next to Duplicates**: Change the Duplicates row from a single `col-span-2` StatCard to a flex row with:
   - The Duplicates StatCard (taking most width)
   - A small "Clear" or "View" button on the right side (icon button)
   - Since I don't know the intended action, I'll add a "Clear duplicates" button that resets `duplicate_count` to 0 for all links

3. **Update `StatCard` component**: Add `border border-border` to the base styles.

### Files to Edit
- `src/components/FilterSidebar.tsx` — add border classes to StatCard, restructure Duplicates row with an action button

