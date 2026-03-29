# Integration test plan

Version scope: `0.1.3`

This plan validates backend ingest, frontend submit flow, and workbook outputs for all supported `event_type` values.

## 1. Configuration checks

1. Confirm web app endpoint URL in app settings matches deployed Apps Script URL (`.../exec`).
2. In Apps Script Script properties, confirm:
- `MWH_ALLOWED_SPREADSHEET_ID` matches workbook id.
- `MWH_ALLOWED_SPREADSHEET_NAME` matches workbook name (if used).
- `MWH_INGEST_TOKEN` is either unset, or matches frontend token.
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

1. In browser devtools console, force next startup prompt eligibility:

```js
const p = JSON.parse(localStorage.getItem("mwh_profile"));
p.publishPreference = p.publishPreference || {};
p.publishPreference.enabled = true;
p.publishPreference.intervalDays = 7;
p.publishPreference.lastPromptAt = "2000-01-01T00:00:00Z";
localStorage.setItem("mwh_profile", JSON.stringify(p));
location.reload();
```

2. On reload, accept the periodic summary prompt.
3. Expected:
- One new row with `event_type=periodic`.

## 5. Workbook inspection checklist

For each new row, inspect:

1. `received_at_utc` and `submitted_at_utc` are datetime values.
2. `magic_cookie` is stable per dataset/profile.
3. `token_used`:
- `yes` when request included token.
- `no` when no token was sent.
4. `event_type` is one of `adoption`, `manual`, `periodic`.
5. `source` is expected (`my-world-heritage` or `backend-self-test`).

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
