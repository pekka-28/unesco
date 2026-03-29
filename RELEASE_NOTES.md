# Release notes

This file tracks published updates with version numbers.

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
