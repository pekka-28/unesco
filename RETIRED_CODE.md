<!-- RETIRED_CODE.md -->
# Retired code and distribution

[Issue #5](https://github.com/pekka-28/unesco/issues/5) tracks consolidation on 2 October 2026. The only active browser application is [My World Heritage](https://pekka-28.github.io/unesco/site/), compiled from `site/src/app.ts` into the `site/index.html` template, with Supabase reporting.

# Retired components

The following components are retired:

- **Supabase preview application and duplicate assets:** removed from `site-supabase/`. Its `index.html` is an active compatibility redirect, preserving query parameters and fragments. It contains no profile, mapping or submission logic.
- **Historical sheet preparation utility:** `scripts/prepare_legacy_usage_import.py` was removed after the one-time import; [the historical implementation](https://github.com/pekka-28/unesco/blob/6ae16d8/scripts/prepare_legacy_usage_import.py) remains traceable in Git. It is not a current import API.
- **Preview generator:** `scripts/build_supabase_preview.mjs` removed. The canonical source already contained the same application logic; comparison confirmed only preview branding and self-links differed.
- **Google Sheets backend:** `backend/usage_summary_backend/google_apps_script/` was removed in PR #3. The client has no Google submission path. The unconditional endpoint override is retired. Browser endpoint migration remains active for empty settings and the exact previous standard address; custom overrides are preserved. The former Google URL is retained solely as a migration marker. The separately hosted Apps Script deployment and digest require the owner's Google access to disable; their remote retirement has not been verified.
- **Overpass pipeline:** The two scripts under `archive/overpass_legacy/scripts/` were removed on 7 October 2026. Archived data remains available for provenance and local-name cache use. The official UNESCO pipeline replaced execution on 28 March 2026.
- **Unused site-number helper:** `extractWhsNumberFromSiteId` removed after confirming it has no references in the application.

Git history preserves removed code. Database migrations remain ordered deployment history; superseded migration definitions are not alternative application implementations. Maintenance and diagnostic scripts remain repository tools and are not shipped to browsers.

# Deployment tooling

Routine CLI deployment is retired as the chosen release process under [Issue #6](https://github.com/pekka-28/unesco/issues/6). The native integration connection is verified; release instructions are in [GitHub deployment](supabase/GITHUB_DEPLOYMENT.md). Setup and diagnostic scripts remain repository-only historical/recovery tools; none is included in the browser distribution.

# Distribution checks

`Publish canonical application` builds a fresh directory from the explicit 29-file allowlist in `scripts/build_pages.ts`. It publishes the visitor and administration pages, user guides and screenshots, icons/manifest, two current catalogue files and one compatibility redirect. No repository-wide copy or Jekyll build is used.

The distribution excludes backend source, migrations, credentials, tests, build scripts, archived implementations, staging inputs and historical snapshots. Design and maintenance documentation remain in the GitHub repository; the client user guide and its screenshots are explicitly included in Pages. Automated tests check the exact output file list, refusal to reuse an existing output directory, the Supabase endpoint and redirect behaviour. Browser validation checks retained profile/history, map loading, histogram rendering and both entry URLs.

The inventory and reference checks confirm removal of known retired and unreferenced application code. They do not constitute a formal proof that every branch of live application code is reachable.

# Publication

GitHub Pages uses the Actions publishing source. The workflow deploys after pushes to `main` and after successful catalogue-maintenance workflows, including updates committed by `GITHUB_TOKEN`. Pull requests validate the distribution without deploying it. The setup follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

# Audit retirements

The strict TypeScript build rejects unused local declarations and parameters. The audit removed the unused default-endpoint constant, empty token accessor and unreachable unverified-submission branches. There are no intentionally unused site functions. Leaflet and html2canvas remain third-party JavaScript libraries with TypeScript declarations; first-party browser code, including the redirect, is TypeScript.

Full-clone catalogue snapshots and `backup_current_whs.ps1` are removed from the current tree. Annotated ingestion tags and Git history retain forensic versions without rewriting commits. The historical workbook importer is retired after the confirmed 42-row import. Routine SMTP owner reporting is replaced by Supabase/Exchange delivery. Maintenance scripts such as the catalogue comparator and probe are active repository tools, not browser code.

# Administration release controls

Issue 25 retires the administration refresh, publish and scheduled-probe buttons, their server dispatch paths and the GitHub token configuration. Authenticated owner calls cannot invoke those operations. The remaining GitHub client performs one fixed, credential-free status GET. Immediate database inspection and named owner-mail operations remain active.

# Historical provider provisioning

The historical `authorise_exchange_notifier.ps1`, `configure_supabase_mail.ps1`, `configure_notification_worker.ps1`, `send_exchange_test.ps1` and `retry_exchange_delivery_test.ps1` scripts were removed on 7 October 2026. They were one-time provisioning/commissioning tools, not part of current maintenance or CI. Current owner mail commands and provider administration replace them. No provider settings or mail were changed by removal.


# Supabase JavaScript implementation

The `.mjs` handlers and shared modules under `supabase/functions` are replaced by `.ts` implementations under [Issue 59](https://github.com/pekka-28/unesco/issues/59). There are no parallel active JavaScript copies. All entrypoints and their imports are checked by `npm run typecheck:server`; tests execute the same TypeScript modules through `tsx`. Node maintenance scripts and tests have since been converted to TypeScript and are checked by `npm run typecheck:tooling`. The retained monthly-report diagnostic now needs `node --import tsx scripts/monthly_usage_report.ts` because it imports the typed shared formatter; this is not a provider-configuration tool.

# Local CommonJS retirement

All sixteen `.local/*.cjs` utilities were removed after review on 7 October 2026. The useful administration checks moved into `tests/admin-browser.test.ts`; diagram rendering moved into `scripts/render_diagrams.ts`. Retired preview/live-state checks, completed TypeScript conversion patches and one-time country patches were not retained as executable alternatives. Saved browser state, data and screenshots remain untouched. `scripts/__pycache__/prepare_legacy_usage_import.cpython-312.pyc` was removed with the already-retired importer's stale bytecode.

# Local drafting and commissioning helpers

The remaining top-level `.local` Python helpers and legacy-import JavaScript were one-time assessment drafting, source synchronization, workbook-import or provider commissioning/audit scripts. They had no current package, workflow or runbook entrypoint; several recreated already-retired previews or patched other scratch helpers. Their outputs and saved evidence remain in place. Private provider verification remains a provider-administrator procedure, not a replay of old bootstrap scripts. The public HTTP smoke check was retained as `scripts/verify_monitoring_http.ts`, configured by `SUPABASE_URL` and covered by mocked regressions.

Removed local source: `aggregation-analysis.py`, `apply-github-security.py`, `audit-db-grants.py`, `bootstrap-admin.py`, `check-assessment-docs.py`, `check-legacy-source.py`, `check-monitor-schedule.py`, `complete-assessment-flows.py`, `enable-auth-audit.py`, `extend-assessment.py`, `finish-assessment.py`, `fix-assessment-notes.py`, `fix-source-verification.py`, `harden-actions.py`, `inspect-audit-availability.py`, `inspect_supabase_integration.py`, `inspect_workbook.py`, `prepare-audit-verification.py`, `prepare-live-presentation.py`, `prepare-source-owner.py`, `record-audit-evidence.py`, `record-histogram-direction.py`, `revise-assessment.py`, `revise-preparation.py`, `revise-presentation.py`, `revise-security-docs.py`, `revise-study.py`, `revise-template.py`, `revise_architecture.py`, `security-config-audit.py`, `sync-reviewed-source.py`, `tidy-assessment.py`, `tidy-process-names.py`, `update-doc-check.py`, `verify-admin-audit-live.py`, `verify-admin-live.py`, `verify-audit-grants.py`, `verify-audit-store.py`, `verify-least-privilege-live.py`, `verify-source-owner.py`, `verify-source.py`, `test-legacy-import.mjs`, `verify_monitoring_http.mjs`.
