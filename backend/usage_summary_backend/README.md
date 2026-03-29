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

## App integration

Set the endpoint URL in the application Settings field `Usage summary endpoint URL`.
If `MWH_INGEST_TOKEN` is set, also configure `Usage summary token` in application Settings.
When a user approves a summary prompt:

- If endpoint submission succeeds, the summary is sent directly.
- If endpoint submission fails or is missing, the app falls back to clipboard copy.

## Accessing collected data

- Open the Google Sheet used by the Apps Script project.
- Read collected submissions in the `submissions` worksheet.
- Filter by `received_at_utc`, `date`, or `magic_cookie` for trend analysis.
- Use File > Download to export as CSV/XLSX for local analysis.
- Owner digest emails are sent to `MWH_REPORT_EMAIL` by `sendPeriodicDigest`.
