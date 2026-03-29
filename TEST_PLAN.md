# Integration test plan

Version scope: `0.1.3`

This plan validates backend ingest, frontend submit flow, and workbook outputs for all supported `event_type` values.

## 1. Configuration checks

1. Confirm web app endpoint URL in app settings matches deployed Apps Script URL (`.../exec`).
2. In Apps Script Script properties, confirm:
- `MWH_ALLOWED_SPREADSHEET_ID` matches workbook id.
- `MWH_ALLOWED_SPREADSHEET_NAME` matches workbook name (if used).
- `MWH_INGEST_TOKEN` is either unset, or matches frontend token.
- `MWH_STATS_WINDOW_DAYS` is set to intended encouragement window (for example `14` or `30`).
3. In the workbook, confirm target sheet is `submissions`.

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
6. Optional encouraging stats check:
- `GET /exec?stats=1` returns `ok: true` and non-negative `active_datasets`.
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
