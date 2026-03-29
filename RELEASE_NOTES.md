<!-- RELEASE_NOTES.md 0.1.11 -->
# Release notes

This file tracks published updates with version numbers.

## Version 0.1.11 (2026-03-29)

- Home-location selection now uses the same search control (input + suggestion list) rather than a separate match selector.
- Home/enrolment location flows now require selecting a suggestion in the search field and confirming with Search for multi-match results.
- Removed startup consent popup for usage summary opt-in; startup no longer raises unsolicited confirm dialogs.
- Startup periodic-summary auto-open dialog removed; due reminders are surfaced via the mailbox icon instead.
- Usage summary dialog timestamp now renders in human-readable UTC format (`d Mmm YYYY hh:mm UTC`) instead of raw ISO text.

## Version 0.1.10 (2026-03-29)

- Updated summary report layout and formatting:
- title now `My World Heritage – <User>` (en dash),
- top metadata row now shows local generated timestamp and visited count on same line as prepared-by link,
- prepared-by line is right-aligned below heading,
- prepared-by link now includes printable URL text and both name/URL are hyperlinks,
- removed `Visited sites map` heading,
- added table column guide block at end,
- tuned table sizing so `Site` collapses and `Country` is constrained (`max-width: 25em`),
- added non-breaking spaces in site ids for stable one-line rendering.
- Changed report visit-date rendering to `d Mmm YYYY` style for full dates (`Mmm YYYY` for year-month, `YYYY` for year).
- Changed profile export filename to `My World Heritage - <user>.profile`.
- Improved fallback summary-map rendering with simplified landmasses for clearer non-blurry output.
- Updated enrolment/home location matching flow:
- location search results are now dropdown-style selectors (not multi-line list boxes),
- multi-match searches no longer overwrite input text automatically,
- nearby seeding list is shown only after a single concrete location is selected,
- nearby seeding is sorted by distance, capped at first 10 entries, with a 500 km cutoff.
- empty nearby result text is now unit-neutral (`No nearby sites found.`).

## Version 0.1.9 (2026-03-29)

- Fixed published app/data mismatch that caused `Invalid lookup site id: 99` on load.
- Published canonical dataset files with `WHS/MWH` identifiers.
- Added one-time local profile id migration (`99` -> `WHS 99`, legacy `MWH` normalisation) to preserve existing user data.
- Removed runtime throw-on-lookup for non-canonical ids in feature lookup helpers to avoid hard load failures.
- Changed dataset fetches to `cache: no-store` so browser cache does not pin stale site-id shapes across deployments.
- Bumped app version to `0.1.9`.

## Version 0.1.8 (2026-03-29)

- Refined summary report presentation:
- removed map mode helper sentence,
- switched to a single-wrap deterministic world map render (no ellipse clipping or tile-wrap artefacts),
- renamed section heading to `Visited sites`,
- improved table wrapping/column sizing for long country values.
- Added `Prepared with My World Heritage` link in exported summary report.
- Updated report table fields:
- removed separate `WHS id` column,
- `Site id` renamed to `Site`,
- numeric root keys rendered as `WHS <id>`,
- `Latest visit` renamed to `Visited`,
- MWH keys rendered with non-breaking hyphen in report output.
- Added runtime canonical key normalisation so root keys are treated as `WHS <id>` across loaded dataset/profile usage (not only report formatting).
- Updated conversion script to emit canonical `WHS <id>` root keys for newly generated datasets.

## Version 0.1.7 (2026-03-29)

- Restored component site identifier visibility in site detail captions to make visit-record keys explicit.
- Extended search so UNESCO-key queries such as `WHS 500` return all matching records (root plus component sites).
- Added `Summary` action to the user menu.
- Added export of a self-contained HTML summary report including:
- a full-world clipped map image with visited markers (terrain tile mode with fallback rendering),
- and a visited-sites table suitable for mailing as attachment.
- Report map rendering includes a robust fallback when terrain tile capture is not available.

## Version 0.1.6 (2026-03-29)

- Updated usage-summary result messaging for cleaner multi-line feedback and reduced technical noise.
- Fixed usage-summary dialog close behaviour after submit; close and Escape now work once submission processing is complete.
- Kept Submit inactive after a send attempt to avoid accidental duplicate sends from the same dialog instance.
- Removed day-window text from encouragement display and rounded average visited sites to integer presentation.
- Added `client_version` to usage summary payload/backend storage/schema for client divergence tracking.
- Added site-name sanitisation to remove stray backslashes from component names.
- Suppressed duplicate local-name rendering when local and English forms are equivalent.
- Improved component caption text to identify parent WHS more clearly.
- Updated help dialog text/order and wording for periodic opt-in telemetry and multiple-site visibility.
- Added localisation investigation output to pending requirements, including a concrete implementation exercise and suggested PR scope.
- Added backend settings guidance documenting soft property dependencies and hard deployment dependencies.

## Version 0.1.5 (2026-03-29)

- Added structured usage-summary submission dialog (payload preview, live status area, submit/close controls).
- Added due-reminder mailbox icon for periodic summaries during active use; startup prompt remains one-time.
- Removed submission-count wording from encouragement text shown to users.
- Backend stats now report active users and average visited sites (`average_visited_sites`) for the configured window.
- Simplified sort direction indicators in site list headers to avoid mojibake rendering.
- Added specification coverage in `Requirements.md` for both site and backend, including captioned UI/interface tables.
- Updated test plan and backend README for the new aggregate metrics and version checks.
- Bumped app version to `0.1.5`.

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



