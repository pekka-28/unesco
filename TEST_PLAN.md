<!-- TEST_PLAN.md -->
# Application verification

The canonical application uses Supabase for monitoring and Exchange 365 for owner mail. The former Google Sheets procedure is retired; Git history preserves it.

# Automated checks

Run the following checks before publication:

1. `npm ci` installs the locked compiler and library declarations.
2. `npm run typecheck` checks all first-party site code with strict types, unused-declaration checks and a prohibition on `any` declarations and type suppressions.
3. `npm install --prefix .local --no-save --package-lock=false @electric-sql/pglite@0.5.8` installs the isolated database test engine.
4. `npm test` verifies receipts, profile Name, queue isolation, histogram, country search, reporting periods, settings migration, startup help and the exact twelve-file distribution.
5. Run `tests/catalogue.tests.ps1` in PowerShell to verify stable component IDs, active/retired retention and source-loss rejection.
6. `node scripts/build_pages.mjs .local/pages-review` builds a fresh distribution. Existing output directories are rejected.

# Browser verification

Serve the built distribution. Confirm map loading, enrolment, settings, profile import/export, site selection, visit history, histogram, the colophon and its links. Submit through a mocked receipt endpoint when checking UI behaviour without creating real activity or email.

Verify that the existing Name appears in the submission and that there is no separate alias control. Check that Slovakia excludes Carnuntum and Austria includes it. The results count catalogue records, including parent properties and components, rather than unique UNESCO inscriptions.

Check missing and previous reporting addresses, preserved custom overrides and clear-to-default. Retain the existing browser storage keys. Verify the one-minute startup prompt and cancellation by interaction. Test the old `/site-supabase/` address as a redirect, including query strings and fragments.

# Production verification

Merge only after GitHub checks pass. Confirm Pages deployment and the native Supabase integration check; then verify the canonical page and public histogram. Confirm that the profile-name migration applied and the monthly cron job is active without displaying Vault secrets. Inspect `cron.job_run_details` and `net._http_response` for dispatch failures.

The owner confirmed immediate and monthly Exchange delivery on 2 October 2026. Sending another delivery check requires an intentional invocation of `supabase/test_monthly_report.sql` in the dashboard SQL editor; it sends mail but creates no new-user event. Confirm that the report includes a site-register comparison or an explicit comparison failure.