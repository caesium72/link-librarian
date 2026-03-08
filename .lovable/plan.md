

## Auto-Refresh & Local Cache for Trending Tab

### Changes to `src/pages/Knowledge.tsx`

**1. Local Cache with localStorage**
- On successful fetch, store `trendingData`, `trendingTimeRange`, `trendingCategory`, and a timestamp in `localStorage` under a key like `trending-cache`
- On component mount, read from cache. If valid cache exists (< 5 min old), use it immediately and skip the "Fetch Trending" prompt
- If cache exists but is stale (> 5 min), still show cached data but auto-trigger a refresh

**2. Auto-Refresh Interval**
- After initial fetch (or cache load), start a 5-minute `setInterval` that calls `fetchTrendingData`
- Clear interval on unmount and when switching away from the "global" trending view
- Show a subtle "Last updated X min ago" timestamp next to the Refresh button
- During auto-refresh, show a small spinner on the refresh icon instead of the full skeleton loading state (differentiate manual vs auto refresh)

**3. Cache Invalidation on Filter Change**
- When `trendingTimeRange` or `trendingCategory` changes, check cache for matching params. If match found and fresh, use cache; otherwise fetch new data
- Cache key includes time range + category so different filter combos are cached independently

### Implementation Details
- Cache structure: `Record<string, { data, timestamp }>` keyed by `${timeRange}-${category}`
- Add a `lastFetchedAt` state to track when data was last refreshed for the "updated ago" display
- Use `useEffect` with interval cleanup for the auto-refresh loop
- Add `isAutoRefresh` flag to skip full skeleton loading during background refreshes

