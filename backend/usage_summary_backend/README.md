<!-- README.md -->
# Usage summary backend

The default reporting destination is `https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/usage-summary`. Supabase stores pseudonymous summaries and sends email through Exchange Online. The owner confirmed the initial-profile alert and monthly delivery check on 2 October 2026. Automatic monthly scheduling remains inactive.

# Browser cutover

Open [My World Heritage](https://pekka-28.github.io/unesco/site/?submit=1) in your usual browser and reload with Ctrl+F5. The retired preview address redirects to this canonical application, preserving query parameters and fragments. Browser storage stays on the same origin, retaining identity and visit history.

At startup the client resolves `mwh_usage_summary_endpoint` from local storage, falling back to the profile setting only when the browser key is absent. An empty value or an exact match for the previous standard address becomes the current address. The result is saved in both local storage and the profile. Other addresses are retained as custom overrides. Identity, visits, notes, publication counters and pending receipt IDs are preserved.

In Settings, edit **Usage summary endpoint URL** to override the server. Clear the field and save to restore the current default. The Submit dialog shows the resolved URL. Custom servers must implement the same reporting and histogram contract; no legacy Google submission adapter is retained. Profile imports preserve a custom endpoint and synchronise it to local storage.

For the next standard-server move, set `USAGE_SUMMARY_ENDPOINTS.previous` to the outgoing `current` value and set `current` to the new URL in `site/index.html`. Exact matching migrates regular configurations while preserving overrides. The previous Google address is retained only as a migration marker. Close or reload older tabs before changing settings so stale application versions do not overwrite them.

# Historical Google Sheets records

The Apps Script implementation is removed from the current tree; Git retains its history. On 2 October 2026, all 42 rows from the supplied workbook were imported: 26 activity, 3 test and 13 synthetic records. Original receipt times use the confirmed Africa/Johannesburg time zone. Test and synthetic records remain distinguishable and are excluded from activity statistics. Historical profiles were baselined before insertion; no retrospective notification was created.

The original workbook and import audit remain private and excluded from Git. Optional aliases were retained where supplied. The browser now provides a separate optional reporting alias, included in future first-profile notifications. See the [entity model and schema maintenance](../../supabase/SCHEMA.md) and `scripts/prepare_legacy_usage_import.py` for the import rules.

In the bound Apps Script project, disable the old digest trigger and archive its web-app deployment after cutover. This requires the owner's Google access; it has not been performed by the repository change.

# Implementation

The active service lives under `supabase/`. See [deployment instructions](../../supabase/DEPLOYMENT.txt) and [Exchange setup](../../supabase/EXCHANGE_SETUP.md). `usage_summary.schema.json` describes the submission contract.
