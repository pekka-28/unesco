<!-- RETIRED_CODE.md -->
# Retired code and distribution

[Issue #5](https://github.com/pekka-28/unesco/issues/5) tracks consolidation on 2 October 2026. The only active browser application is [My World Heritage](https://pekka-28.github.io/unesco/site/), sourced from `site/index.html`, with Supabase reporting.

# Retired components

The following components are retired:

- **Supabase preview application and duplicate assets:** removed from `site-supabase/`. Its `index.html` is an active compatibility redirect, preserving query parameters and fragments. It contains no profile, mapping or submission logic.
- **Preview generator:** `scripts/build_supabase_preview.mjs` removed. The canonical source already contained the same application logic; comparison confirmed only preview branding and self-links differed.
- **Google Sheets backend:** `backend/usage_summary_backend/google_apps_script/` was removed in PR #3. The client has no Google submission path. Browser endpoint migration remains active to handle returning users. The separately hosted Apps Script deployment and digest require the owner's Google access to disable; their remote retirement has not been verified.
- **Overpass pipeline:** `archive/overpass_legacy/` is explicitly historical and excluded from the web distribution. Its README records the replacement by the official UNESCO pipeline on 28 March 2026.
- **Unused site-number helper:** `extractWhsNumberFromSiteId` removed after confirming it has no references in the application.

Git history preserves removed code. Database migrations remain ordered deployment history; superseded migration definitions are not alternative application implementations. Maintenance and diagnostic scripts remain repository tools and are not shipped to browsers.

# Distribution checks

`Publish canonical application` builds a fresh directory from the explicit twelve-file allowlist in `scripts/build_pages.mjs`. It publishes one application HTML file, eight referenced icon/manifest files, two current catalogue files and one compatibility redirect. No repository-wide copy or Jekyll build is used.

The distribution excludes backend source, migrations, credentials, tests, build scripts, archived implementations, staging inputs and historical snapshots. Documentation remains in the GitHub repository. Automated tests check the exact output file list, refusal to reuse an existing output directory, the Supabase endpoint and redirect behaviour. Browser validation checks retained profile/history, map loading, histogram rendering and both entry URLs.

The inventory and reference checks confirm removal of known retired and unreferenced application code. They do not constitute a formal proof that every branch of live application code is reachable.

# Publication

GitHub Pages uses the Actions publishing source. The workflow deploys after pushes to `main` and after successful catalogue-maintenance workflows, including updates committed by `GITHUB_TOKEN`. Pull requests validate the distribution without deploying it. The setup follows [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
