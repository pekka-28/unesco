# Release notes

This file tracks published updates with version numbers.

## Version 0.1.2 (2026-03-29)

- Added submission transport fallback for browser CORS-blocked environments:
- if normal JSON fetch fails, try `sendBeacon` with JSON payload as `text/plain`.
- if beacon is unavailable/fails, try `fetch(..., mode: "no-cors")` as final fallback.
- Added explicit submission status `submitted_unverified` when transport succeeds but response cannot be read due CORS.
- Bumped app version to `0.1.2`.

## Version 0.1.1 (2026-03-29)

- Updated default usage summary endpoint URL to deployment `AKfycbzPtSZnPoymM9sw2NV2GpSXVsDKAps9txWh_oSmCUw2PvkCjzuM_KHfhVd4MC5Y7BbF`.
- Bumped app version to `0.1.1`.

## Version 0.1.0 (2026-03-29)

- Added formal versioning baseline for the project.
- Added app version display in the help dialog.
- Added compact settings row layout for shorter values.
- Added usage summary submission diagnostics.
- Treat endpoint response as success only when payload returns `ok: true`.
- Record and show last submission status in settings.
- Added clearer submit/fallback outcome alerts.
- Updated usage summary UX wording to `periodic` and `pseudonomous`.
- Removed `Copy current list`.
- Replaced photorealistic-style search/snapshot icons with standard web-style line icons.
- Switched summary payload from total site count to visited site count.
- Updated backend ingest + schema to accept `visited_site_count` (legacy `total_site_count` still accepted).
- Settings now prefills usage summary endpoint/token from effective values.

## Earlier work

Before versioned notes were introduced, changes were tracked in commit history and issue discussion.
