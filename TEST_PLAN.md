<!-- TEST_PLAN.md 0.1.8 -->
# Integration test plan

Version scope: `0.1.8`

This plan validates backend ingest, frontend submit flow, and workbook outputs for all supported `event_type` values.

## 0. Deployment update steps

1. Open the bound Apps Script project from workbook `My World Heritage usage`.
2. Replace `Code.gs` with the current repository version.
3. Save script changes.
4. Deploy a new web app version:
- Deploy -> Manage deployments -> Edit deployment.
- Select `New version`.
- Execute as: `Me`.
- Who has access: `Anyone`.
5. Copy the `/exec` URL and confirm it matches app settings endpoint.
6. Open the `/exec` URL in normal and private windows to confirm JSON health response.

## 1. Configuration checks

1. Confirm web app endpoint URL in app settings matches deployed Apps Script URL (`.../exec`).
2. In Apps Script Script properties, confirm:
- `MWH_ALLOWED_SPREADSHEET_ID` matches workbook id.
- `MWH_ALLOWED_SPREADSHEET_NAME` matches workbook name (if used).
- `MWH_INGEST_TOKEN` is either unset, or matches frontend token.
- `MWH_STATS_WINDOW_DAYS` is set to intended encouragement window (for example `14` or `30`).
- `MWH_REPORT_DAYS` is set, and `MWH_STATS_WINDOW_DAYS` is approximately `2 x MWH_REPORT_DAYS`.
3. In the workbook, confirm target sheet is `submissions`.
4. Version checks:
- Site help dialog version equals current release version (`0.1.5`).
- Site help dialog version equals current release version (`0.1.6`).
- `site/index.html` and backend `Code.gs` header comments carry the same release version tag.

## 2. Backend self-test (editor only)

These functions are not client-routable; only `doGet` and `doPost` are web-exposed.

1. Run `backendSelfTestDryRun`.
- Expected: return object with `ok: true` and `endpoint_ready: true`.
- No row added.
2. Run `backendSelfTestAppend`.
- Expected: return object with `ok: true`, `appended: true`.
- One row added in `submissions` with `source=backend-self-test`.

## 3. Frontend setup

1. Open app with submit menu enabled:
- `https://pekka-28.github.io/unesco/site/?submit=1`
2. Open Settings and verify endpoint (and token if required), then Save.
3. Keep workbook open on `submissions`.

## 4. Event type tests

## 4.1 Adoption event

1. Trigger new enrolment flow (new profile/reset).
2. Complete enrolment and save.
3. Expected:
- One new row with `event_type=adoption`.
- `source=my-world-heritage`.

## 4.2 Manual event

1. Open user menu -> `Submit`.
2. Confirm prompt.
3. Expected:
- One new row with `event_type=manual`.
- `use_count_since_last_push` equals current uses delta.
- `visited_site_count` equals current visited sites.

## 4.3 Periodic event (no week wait)

1. Open Settings and set:
- `Opt in to periodic usage summary` = enabled
- `Reminder interval (days)` = `0.0002` (about 17 seconds)
2. Save settings, reload app, and wait 20 seconds.
3. Accept the periodic summary prompt.
4. Expected:
- One new row with `event_type=periodic`.
5. Set interval back to your normal value (for example `7`).

## 5. Workbook inspection checklist

For each new row, inspect:

1. `received_at_utc` and `submitted_at_utc` are datetime values.
2. `magic_cookie` is stable per dataset/profile.
3. `token_used`:
- `yes` when request included token.
- `no` when no token was sent.
4. `event_type` is one of `adoption`, `manual`, `periodic`.
5. `source` is expected (`my-world-heritage` or `backend-self-test`).
6. `client_version` is present and matches deployed app version for frontend rows.
7. Optional encouraging stats check:
- `GET /exec?stats=1` returns `ok: true` and non-negative `active_datasets`.
- `average_visited_sites` is present and non-negative.
- Returned `window_days` matches backend property `MWH_STATS_WINDOW_DAYS` (or default `14`).

## 6. Endpoint and deployment verification

1. `GET /exec` returns JSON health payload.
2. Apps Script Executions shows recent `doPost` runs for frontend tests.
3. If no row appears but execution completed:
- inspect execution logs and script properties.

## 7. Pass criteria

1. Backend dry-run passes.
2. Backend append test inserts row.
3. Frontend creates rows for all three event types.
4. Workbook row values match expected fields and typing.

## 8. Dataset refresh CI alert checks

1. Configure repository secrets for refresh-failure email alerts:
- `MWH_ALERT_SMTP_SERVER`
- `MWH_ALERT_SMTP_PORT`
- `MWH_ALERT_SMTP_USERNAME`
- `MWH_ALERT_SMTP_PASSWORD`
- `MWH_ALERT_MAIL_TO`
- `MWH_ALERT_MAIL_FROM`
2. Run workflow `Update UNESCO Data` manually with an intentionally invalid `source_url` (for example `https://example.invalid/whc.json`) to force fetch failure.
3. Confirm outcomes:
- workflow run is marked failed,
- alert email is received with failed step list and run URL,
- if extract-status update succeeded, repository commit may still occur for updated failure metadata.
4. Re-run workflow with the correct source URL and confirm:
- workflow succeeds,
- no failure email is sent.


