<!-- TEST_PLAN.md -->
# Application verification

The canonical application uses Supabase for monitoring and Exchange 365 for owner mail. The former Google Sheets procedure is retired; Git history preserves it.

# Automated checks

Run the following checks before publication:

1. `npm ci` installs the locked compiler and library declarations.
2. `npm run typecheck` checks all first-party site code with strict types, unused-declaration checks and a prohibition on `any` declarations and type suppressions.
3. `npm install --prefix .local --no-save --package-lock=false @electric-sql/pglite@0.5.8` installs the isolated database test engine.
4. `npm test` verifies receipts, profile Name, queue isolation, histogram, country search, reporting periods, settings migration, startup help and the explicit distribution allowlist, including the user guide and its screenshots.
5. Run `tests/catalogue.tests.ps1` in PowerShell to verify stable component IDs, active/retired retention and source-loss rejection.
6. `node scripts/build_pages.mjs .local/pages-review` builds a fresh distribution. Existing output directories are rejected.

# Browser verification

Serve the built distribution. Confirm map loading, enrolment, settings, profile import/export, site selection, visit history, histogram, the colophon and its links. Submit through a mocked receipt endpoint when checking UI behaviour without creating real activity or email.

Verify that the existing Name appears in the submission and that there is no separate alias control. Check that Slovakia excludes Carnuntum and Austria includes it. The results count catalogue records, including parent properties and components, rather than unique UNESCO inscriptions.

Check missing and previous reporting addresses, preserved custom overrides and clear-to-default. Retain the existing browser storage keys. Verify the one-minute startup prompt and cancellation by interaction. Test the old `/site-supabase/` address as a redirect, including query strings and fragments.

# Production verification

Merge only after GitHub checks pass. Confirm Pages deployment and the native Supabase integration check; then verify the canonical page and public histogram. Confirm that the profile-name migration applied and the monthly cron job is active without displaying Vault secrets. Inspect `cron.job_run_details` and `net._http_response` for dispatch failures.

The owner confirmed immediate and monthly Exchange delivery on 2 October 2026. An authenticated owner can select Send monthly report check in administration; the dashboard script `supabase/test_monthly_report.sql` is also an explicit operator path. Either invocation sends mail but creates no new-user event. Confirm that the report includes a site-register comparison or an explicit comparison failure.
# Administration security regression

Verify forbidden operations fail even for the owner and even when an obsolete GitHub token appears in a mocked environment. Verify GitHub status requests use only a fixed GET with no bearer credential. Preserve tests for wrong/anonymous identities and direct database permission denial. Check the published UI contains no refresh, publication, dispatch or SQL controls. The production verification records outcomes without printing tokens or private rows.

# Documentation and screenshot verification

[Traceability](TRACEABILITY.md) identifies the requirement/design/source/evidence chains and separates documented coverage from verified security claims. The [capture script](scripts/capture_user_guide.mjs) renders synthetic profiles and mocked monitoring responses; it never uses owner sessions or real reporting data. Install Playwright separately and set `MWH_PLAYWRIGHT_PATH` if necessary, then run `node scripts/capture_user_guide.mjs`. `MWH_CHROME_PATH` selects the Chrome executable. Public map tiles and catalogue content are used; no production mail or submissions are sent.

Check the screenshot inventory against every application-owned page/dialog and the control tables. Browser/OS-owned prompts are listed separately because their appearance varies. Inspect screenshots, check guide anchors and images, and run the distribution test after changing the explicit image allowlist. The guide excludes its own recursive screenshot. Captures establish displayed behaviour with fixtures, not provider permission enforcement.

# Untrusted visitor rendering

`tests/visitor-rendering.test.mjs` runs the compiled visitor renderers in Chromium with network access blocked. It checks imported profile notes, full tooltips, quoted visit identifiers, Unicode and long notes; edit/save/delete preserve the text and identifier. Catalogue detail/list/search values remain text, and non-HTTP/HTTPS external links are rejected. The regression fails against the original Issue 54 implementation. CI installs Chromium using `npx playwright install --with-deps chromium`; local Windows checks may use installed Chrome or `MWH_CHROME_PATH`.
