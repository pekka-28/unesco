<!-- README.md -->
# Usage summary backend

The application submits exclusively to `https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/usage-summary`. Supabase stores pseudonymous summaries and sends email through Exchange Online. The owner confirmed the initial-profile alert and monthly delivery check on 2 October 2026. Automatic monthly scheduling remains inactive.

# Browser cutover

Open [My World Heritage](https://pekka-28.github.io/unesco/site/?submit=1) in your usual browser and reload with Ctrl+F5. The preview address remains available and shares the same browser storage.

The application updates `mwh_usage_summary_endpoint` and the profile's `settings.usageSummaryEndpoint` automatically, clears obsolete tokens and forces requests to Supabase during the transition. Imported profiles are updated when saved. Identity, visits, notes, publication counters and pending receipt IDs are preserved. Settings show the server address as read-only. Use the user menu's Submit action; no manual server edit is required.

Close or reload older tabs before submitting. Previously loaded JavaScript cannot be updated until reloaded. The forcing guard can be removed later if configurable servers are reintroduced; retain the settings migration.

# Historical Google Sheets records

The Apps Script implementation is removed from the current tree; Git retains its history. On 2 October 2026, all 42 rows from the supplied workbook were imported: 26 activity, 3 test and 13 synthetic records. Original receipt times use the confirmed Africa/Johannesburg time zone. Test and synthetic records remain distinguishable and are excluded from activity statistics. Historical profiles were baselined before insertion; no retrospective notification was created.

The original workbook and import audit remain private and excluded from Git. Optional aliases were retained where supplied. The browser now provides a separate optional reporting alias, included in future first-profile notifications. See the [schema and DDL traceability](../../supabase/SCHEMA.md) and `scripts/prepare_legacy_usage_import.py` for the import rules.

In the bound Apps Script project, disable the old digest trigger and archive its web-app deployment after cutover. This requires the owner's Google access; it has not been performed by the repository change.

# Implementation

The active service lives under `supabase/`. See [deployment instructions](../../supabase/DEPLOYMENT.txt) and [Exchange setup](../../supabase/EXCHANGE_SETUP.md). `usage_summary.schema.json` describes the submission contract.
