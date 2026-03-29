<!-- README.md 0.1.4 -->
# Usage summary backend

This backend accepts pseudonymised usage summaries from the web app and sends periodic email digests.

## Backend model

- Ingest endpoint: Google Apps Script web app (`doPost`).
- Storage: Google Sheet tab `submissions`.
- Digest email: Apps Script trigger calling `sendPeriodicDigest`.

## Setup

1. Create a new Google Sheet for telemetry.
2. Open Extensions > Apps Script.
3. Paste `google_apps_script/Code.gs`.
4. Set script properties:
- `MWH_REPORT_EMAIL`: destination email address.
- `MWH_REPORT_DAYS`: digest window in days (for example `7`).
- `MWH_ALLOWED_SPREADSHEET_ID`: allowed workbook id.
- `MWH_ALLOWED_SPREADSHEET_NAME`: optional exact workbook name check.
- `MWH_INGEST_TOKEN`: optional shared token required for ingest.
- `MWH_MIN_INTERVAL_SECONDS`: optional minimum interval per dataset cookie (default `30`).
- `MWH_MAX_SUBMISSIONS_PER_COOKIE_PER_HOUR`: optional per-cookie hourly cap (default `12`).
- `MWH_MAX_PAYLOAD_BYTES`: optional payload-size cap (default `4096`).
- `MWH_DUPLICATE_TTL_SECONDS`: optional duplicate suppression window (default `3600`).
- `MWH_STATS_WINDOW_DAYS`: optional stats/encouragement window in days (default `14`).

Script-managed property:

- `MWH_LAST_DIGEST_AT`: maintained automatically by `sendPeriodicDigest`.

For your workbook:

- `MWH_ALLOWED_SPREADSHEET_ID=1b8hW31Cxd-HBGY1T27cnTeFwvmp5w-mHCSNqpk3SvGQ`
- `MWH_ALLOWED_SPREADSHEET_NAME=My World Heritage usage`
5. Deploy as web app:
- Execute as: `Me`.
- Who has access: `Anyone`.
6. Run `installDailyDigestTrigger` once.
7. Copy the deployed web app URL.

## OAuth scope tightening

Enable the manifest in Apps Script and set scopes from `google_apps_script/appsscript.json`:

- `https://www.googleapis.com/auth/spreadsheets.currentonly`
- `https://www.googleapis.com/auth/script.send_mail`
- `https://www.googleapis.com/auth/script.scriptapp`

This narrows spreadsheet access to the current bound sheet context.

## Payload contract

Use `usage_summary.schema.json` as the contract for submissions.

Current primary fields:

- `submitted_at_utc` (ISO 8601 timestamp, UTC)
- `magic_cookie` (pseudonymous dataset key)
- `use_count_since_last_push`
- `visited_site_count`
- `event_type` (`periodic`, `manual`, `adoption`)

## App integration

Set the endpoint URL in the application Settings field `Usage summary endpoint URL`.
If `MWH_INGEST_TOKEN` is set, also configure `Usage summary token` in application Settings.
When a user approves a summary prompt:

- If endpoint submission succeeds, the summary is sent directly.
- If endpoint submission fails or is missing, the app falls back to clipboard copy.
- App can request encouraging aggregate stats via `GET /exec?stats=1`.
- Stats window is backend-controlled via `MWH_STATS_WINDOW_DAYS` (not client-supplied).

Stats query response (`doGet`):

- `window_days`
- `submissions`
- `active_datasets` (unique magic cookies in window)
- `unique_datasets` (same as `active_datasets`)

## Backend self-tests

These functions are for Apps Script editor runs only and are not exposed through the web app endpoint (`doGet`/`doPost`):

- `backendSelfTestDryRun`: validates workbook binding, payload shape, and token configuration without writing a row.
- `backendSelfTestAppend`: runs dry-run checks and appends one test row (`source=backend-self-test`).

Use these before frontend tests to confirm backend readiness.

## Accessing collected data

- Open the Google Sheet used by the Apps Script project.
- Read collected submissions in the `submissions` worksheet.
- Filter by `received_at_utc`, `submitted_at_utc`, or `magic_cookie` for trend analysis.
- Use File > Download to export as CSV/XLSX for local analysis.
- Owner digest emails are sent to `MWH_REPORT_EMAIL` by `sendPeriodicDigest`.

`token_used` values:

- `yes`: request included a token field.
- `no`: request did not include a token field.


