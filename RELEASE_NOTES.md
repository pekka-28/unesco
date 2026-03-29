<!-- RELEASE_NOTES.md 0.1.4 -->
# Release notes

This file tracks published updates with version numbers.

## Version 0.1.4 (2026-03-29)

- Moved encouragement window control fully to backend configuration (`MWH_STATS_WINDOW_DAYS`).
- Frontend now requests stats via `GET /exec?stats=1` without client-supplied day parameter.
- Backend now returns an `encouragement` message in stats payload; frontend displays backend-provided wording.
- Documented all script properties, including script-managed `MWH_LAST_DIGEST_AT`.
- Simplified periodic-event integration test to use fractional reminder interval from Settings (no localStorage edits).
- Added file header comments (`File: <path>`) across comment-capable source/docs/scripts, with version tags on key operational files.
- Bumped app version to `0.1.4`.

## Version 0.1.3 (2026-03-29)

- Changed usage summary payload date from `date` to `submitted_at_utc` (ISO UTC timestamp).
- Added `event_type` to usage summary payload (`periodic`, `manual`, `adoption`).
- Added automatic `adoption` submission on enrolment.
- Updated backend append format to write parsed datetime values into sheet cells (not plain text timestamps).
- Existing sheet headers are left unchanged (no automatic header rewrites).
- Added backend editor-only self-test functions (`backendSelfTestDryRun`, `backendSelfTestAppend`).
- Added integration test plan document (`TEST_PLAN.md`) covering endpoint matching, workbook inspection, and all `event_type` flows.
- Added backend stats query (`GET /exec?stats=1&days=14`) and frontend encouragement message based on active datasets in recent window.
- Reminder interval now accepts fractional day values to support fast periodic-event testing.
- Bumped app version to `0.1.3`.

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


