<!-- README.md 0.2.0 -->
# My World Heritage

My World Heritage is a public, user-controlled map companion for UNESCO World Heritage sites.

It exists to make site tracking practical without paywalls, advertising pressure, or forced social publishing.

Browser source version: `0.2.6`; use the Git revision and deployment record to distinguish maintenance changes.

## What it does

- Shows a maintained UNESCO site catalogue in a custom map viewer.
- Lets users record personal visits and travel notes locally.
- Keeps personal data under user control (export/import supported).
- Preserves historical continuity (retired sites are marked, not deleted).

## File types

- User profile export/import: `.profile` (JSON payload with My World Heritage profile schema).
- Canonical UNESCO dataset: `.json` (`data/current/unesco_official_sites.json`).
- Map dataset for viewer: `.geojson` (`data/current/unesco_official_sites.geojson`).

## Product position

- Canonical application: Supabase client in `site/index.html`. The retired `site-supabase/` preview redirects here; there is only one application build.
- Historical and rejected design approaches are documented in [Requirements.md](Requirements.md).

## Entry points

- Application: [My World Heritage](https://pekka-28.github.io/unesco/site/)
- Owner operation: [Administration guide](https://pekka-28.github.io/unesco/admin/guide.html)
- Client behaviour: [User guide](https://pekka-28.github.io/unesco/site/user-guide.html)
- Component design: [Architecture](ARCHITECTURE.md)
- Documentation and evidence map: [Traceability](TRACEABILITY.md)
- Interaction design: [System behaviour](SYSTEM_BEHAVIOUR.md)
- Source entry file: [site/index.html](site/index.html)
- Requirements and design decisions: [Requirements.md](Requirements.md)
- Release notes: [RELEASE_NOTES.md](RELEASE_NOTES.md)
- Integration test plan: [TEST_PLAN.md](TEST_PLAN.md)

## Project detail

[Requirements](Requirements.md) defines product intent and constraints. [Architecture](ARCHITECTURE.md) describes components; [System behaviour](SYSTEM_BEHAVIOUR.md) describes their message sequences and timer behaviour.



Retired implementations and distribution checks are recorded in [Retired code](RETIRED_CODE.md).

Backend release procedure: [Supabase GitHub deployment](supabase/GITHUB_DEPLOYMENT.md), with deployment verification tracked in Issue #6.

# Site development

First-party browser code lives in `site/src/*.ts`. `site/index.html` and the compatibility redirect are templates; build them before serving. Run `npm ci`, `npm run typecheck` and `node scripts/build_pages.mjs .local/pages-review`. Serve that output directory to preview the application. The compiler uses strict checking and rejects unused declarations; Pages publishes only compiled runtime files. See [verification instructions](TEST_PLAN.md).

The owner interface is published at `/admin/`. Its operations, authentication boundaries and server configuration are documented in [Administration](ADMINISTRATION.md). The static sign-in page contains no private data or credentials; the owner API enforces access.

The [security policy](SECURITY.md) inventories credentials, data and trust boundaries, and states the limits of security assurance. Administration cannot change the site; releases remain in GitHub and its native Supabase integration.
