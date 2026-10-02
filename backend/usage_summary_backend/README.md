<!-- README.md -->
# Usage summary backend

The application submits exclusively to `https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/usage-summary`. Supabase stores pseudonymous summaries and sends email through Exchange Online. The owner confirmed the initial-profile alert and monthly delivery check on 2 October 2026. Automatic monthly scheduling remains inactive.

# Browser cutover

Open [My World Heritage](https://pekka-28.github.io/unesco/site/?submit=1) in your usual browser and reload with Ctrl+F5. The preview address remains available and shares the same browser storage.

The application updates `mwh_usage_summary_endpoint` and the profile's `settings.usageSummaryEndpoint` automatically, clears obsolete tokens and forces requests to Supabase during the transition. Imported profiles are updated when saved. Identity, visits, notes, publication counters and pending receipt IDs are preserved. Settings show the server address as read-only. Use the user menu's Submit action; no manual server edit is required.

Close or reload older tabs before submitting. Previously loaded JavaScript cannot be updated until reloaded. The forcing guard can be removed later if configurable servers are reintroduced; retain the settings migration.

# Historical Google Sheets records

The Apps Script implementation is removed from the current tree; Git retains its history. A read-only export attempt on 2 October 2026 returned HTTP 401. No historical rows have been imported.

Open [the historical usage workbook](https://docs.google.com/spreadsheets/d/1b8hW31Cxd-HBGY1T27cnTeFwvmp5w-mHCSNqpk3SvGQ/edit), select the `submissions` tab, and download it as CSV. Supply the export privately with the spreadsheet's configured time zone so displayed timestamps can be interpreted correctly. Do not commit the raw export.

Before importing, validate timestamps, profile keys, event types and counts; strip user-agent, token and other non-reporting columns. Preserve original receipt dates and use deterministic identifiers so rerunning cannot duplicate rows. Baseline historical profiles in `known_usage_profiles` in the same transaction before inserting submissions, preventing retrospective new-user emails. Reconcile already-present submissions and report imported, duplicate and rejected counts. Retain the original sheet as evidence.

In the bound Apps Script project, disable the old digest trigger and archive its web-app deployment after cutover. This requires the owner's Google access; it has not been performed by the repository change.

# Implementation

The active service lives under `supabase/`. See [deployment instructions](../../supabase/DEPLOYMENT.txt) and [Exchange setup](../../supabase/EXCHANGE_SETUP.md). `usage_summary.schema.json` describes the submission contract.
