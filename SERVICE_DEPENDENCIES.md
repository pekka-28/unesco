<!-- SERVICE_DEPENDENCIES.md -->
# My World Heritage service dependencies and configuration

3 October 2026

This document supports the components in [Architecture](ARCHITECTURE.md), sequences in [System behaviour](SYSTEM_BEHAVIOUR.md), and credential custody in [Security policy](SECURITY.md). It identifies partner dependencies so a maintainer can diagnose an unavailable service, change incidental deployment details, or replace a provider without reconstructing the design from source. It is also the starting point for component handover. The inventory describes the source at the Issue 54 correction; provider configuration observations retain their original dates in the linked security and deployment records. This review does not constitute a fresh provider readback or a rehearsed migration.

# Configuration authority

Provider administrators manage settings, credentials and grants through the provider's administration system. Application administration and repository tooling must not create, rotate or overwrite those provider settings. Tooling may validate documented expectations, produce a non-secret change checklist and perform authorised read-only diagnostics. Local configuration may identify credential names and stores; it must not contain credential values or acquire an alternative management credential to administer those stores.

GitHub remains the release authority for application source, schema and deployed functions. A schema migration is a release change, not an owner-administration operation. Provider-managed settings, including Secrets and Vault values, remain separate from schema migrations. Changing a mail recipient, endpoint or accepted owner identity requires controlled configuration integrity even when the value is public.

Some provider operations do not have a documented dashboard equivalent: Microsoft currently documents application-RBAC administration through Exchange Online PowerShell. The approved provider-administrator procedure must be agreed where that conflicts with the desired interface boundary; see [Exchange setup](supabase/EXCHANGE_SETUP.md#provider-administration). The project must not silently substitute its own automation.

The setup scripts that register Microsoft applications, grant Exchange roles or write Supabase settings are historical provisioning material. They are not the current handover procedure. No script or provider setting is changed by this documentation release. See [Retired code](RETIRED_CODE.md) and [Exchange setup](supabase/EXCHANGE_SETUP.md) for the retained history and current provider responsibilities.

# Service dependencies

The *Table Service dependencies* identifies the purpose, information boundary, failure effect and replacement contract. An address change is sufficient only when the replacement satisfies that contract. Credentials and policies remain subject to the authority inventory below.

*Table Service dependencies*

| Id | Service and purpose | Information crossing the interface | Failure and replacement obligations |
| --- | --- | --- | --- |
| D1 | GitHub Pages publishes visitor and owner clients | Public HTML, generated JavaScript, assets and catalogue; ordinary browser request metadata | Hosting failure prevents loading. Preserve the relative `site/`, `admin/`, `data/` layout, HTTPS and links. A new origin does not inherit browser storage |
| D2 | Supabase functions and Postgres accept reports, aggregate usage and expose owner operations | Optional Name, profile cookie, receipt, counts and event metadata; private owner query results | Monitoring failure must not destroy local profiles or falsely acknowledge a submission. Preserve the [API and entity contracts](supabase/SCHEMA.md), idempotency, grants, pending work and classifications. A generic database URL is not an API-compatible replacement |
| D3 | Supabase Auth establishes the owner identity | One-use sign-in proof, confirmed account and bearer token | Private operations fail without a verified configured owner. Re-establish the account binding and provider policies; never copy an active browser session as migration data |
| D4 | Microsoft identity and Graph/Exchange deliver owner mail | Application authentication, short-lived access token, destination, subject and message body | Queue failures remain visible; uncertain delivery can duplicate mail on retry. Replacement must preserve scoped sending, acceptance/error handling and reconciliation. Graph is a protocol dependency, not an interchangeable SMTP hostname |
| D5 | GitHub API and raw content provide workflow status and monthly register comparison | Public repository identity, commit queries, workflow results and catalogue snapshots | Missing/private/rate-limited history makes the comparison unavailable, not zero. Preserve history and catalogue path; current readers use unauthenticated public GETs. Do not add runtime GitHub mutation authority |
| D6 | Native Supabase GitHub integration releases backend changes | Provider-managed repository grant, source and migration history | A broken integration blocks backend release independently of Pages. Provider administrators reconnect the intended repository/project; the application cannot alter the grant |
| D7 | UNESCO data service supplies the catalogue | Downloaded register records and source metadata | Validate replacement structure, stable identifiers, provenance and source completeness before accepting changes. Do not infer mass retirement from a failed/incomplete source |
| D8 | Nominatim resolves entered place searches | Search text, request metadata and returned coordinates/bounds | Geographic searches fail independently of local catalogue search. A replacement needs request/response adaptation and appropriate usage terms; do not send full profiles |
| D9 | OpenStreetMap tiles provide the interactive basemap; Esri tiles provide the exported report map | Requested tile coordinates and network metadata | Tiles can be unavailable while records remain local. Preserve attribution, coordinate/tile conventions and cross-origin image compatibility for export. These are two separate configured services |
| D10 | unpkg and jsDelivr distribute Leaflet and html2canvas | Third-party executable scripts/styles loaded by the browser | CDN failure can break startup or report rendering. Versions, integrity, API compatibility and licensing need review for substitution/self-hosting. Leaflet has integrity attributes; the current html2canvas script has no integrity attribute |
| D11 | GitHub Actions, npm and test/runtime packages build and verify releases | Repository source, dependency metadata, build artefacts and job-scoped tokens | Preserve pinned actions, lockfile and checks; review workflow permissions and runners. Test dependencies are not browser distribution files |

# Settings inventory

The *Table Routing and identity settings* distinguishes application constants from provider-managed values. The current central configuration manifest does not exist. These locations are the actual maintenance points until Issue 57 is implemented; source changes use the reviewed release process, while provider changes use their own administration systems.

*Table Routing and identity settings*

| Setting and current value | Authoritative location and consumers | Purpose and change checks |
| --- | --- | --- |
| Visitor address `https://pekka-28.github.io/unesco/site/` | GitHub Pages hosting plus constants in [app.ts](site/src/app.ts) `exportVisitedSummaryReport`, [site template](site/index.html) invitation and documentation/symbol links | Canonical navigation and exported/invited links. Update links together; preserve distribution layout |
| Owner page `https://pekka-28.github.io/unesco/admin/` | [owner handler](supabase/functions/owner-admin/handler.ts) `PAGE`; [fault reporter](supabase/functions/_shared/security-monitor.ts) mail link | Sign-in proof destination and fault follow-up. Verify the fixed HTTPS destination before sending sign-in links |
| Monitoring project `https://fjqhgcegnphavatrchjb.supabase.co` | [app.ts](site/src/app.ts) `USAGE_SUMMARY_ENDPOINTS.current`; [admin.ts](site/src/admin.ts) `endpoint`; [build helper](scripts/site_source.ts) admin CSP; GitHub Actions secret `SUPABASE_URL` for [probe](.github/workflows/supabase-probe.yml) | Reporting, histogram/statistics, owner API and probe must identify the intended project. The URL is non-secret despite its current GitHub secret-store location. CSP must agree with the owner API address |
| Previous reporting address | `USAGE_SUMMARY_ENDPOINTS.previous` in app.ts, retaining the exact former Google deployment URL solely as a migration marker | Blank/currently recognised previous settings move to the current default. Explicit custom overrides survive. Only one previous address is supported today |
| Allowed visitor origin | Supabase function setting `MWH_ALLOWED_ORIGIN`; fallback `https://pekka-28.github.io` in [usage handler](supabase/functions/usage-summary/handler.ts) | Browser CORS/origin policy, not user authentication. A stale configured value overrides the fallback |
| Allowed owner origin | Fixed `ORIGIN` in owner handler | Separate check from visitor origin. Updating only `MWH_ALLOWED_ORIGIN` does not update administration |
| Notification recipient `pekka@data.co.za` | [new-user mail](supabase/functions/_shared/new-profile-mail.ts) `renderNewProfileMail`, [monthly handler](supabase/functions/monthly-report/handler.ts), [fault reporter](supabase/functions/_shared/security-monitor.ts), [delivery test](supabase/functions/new-profile-notifications/index.ts) | Four duplicated constants, not a Postgres mailbox setting. Change all reporting recipients consistently; do not implicitly change the authenticated owner |
| Authenticated owner email `pekka@data.co.za` | `OWNER` in owner handler | Sign-in destination and identity check. Distinct purpose from reporting recipient, even though addresses currently match |
| `MWH_ADMIN_USER_ID` | Supabase function setting; owner handler checks it against Auth and confirmed email | Non-secret pinned identity. Record the intended account in provider administration; changing the email alone cannot authorise a new owner |
| `MWH_MS_MAIL_FROM` | Supabase function setting; mail adapter falls back to `pekka@data.co.za` | Sender mailbox. Must match the Exchange application sending scope |
| Repository `pekka-28/unesco`, branch `main`, catalogue path `data/current/unesco_official_sites.json` | Owner handler workflow lookup; [register report](supabase/functions/_shared/register-report.ts); Pages workflow; native integration configuration | Preserve catalogue history and review all consumers. Repository transfer alone does not constitute a hosting or integration cutover |
| UNESCO source URL | [refresh workflow](.github/workflows/update-unesco-data.yml): dispatch input, then `UNESCO_SOURCE_URL` repository variable, then `https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/exports/json` | Replacement must satisfy the extractor contract. [Local-name maintenance](.github/workflows/local-name-maintenance.yml) has its own input/default and does not share that variable |
| Nominatim search URL | app.ts home search, enrolment search and geographic search use `https://nominatim.openstreetmap.org/search` | All three consumers require consistent request/response changes |
| Tile templates | app.ts interactive `L.tileLayer` uses OpenStreetMap; `REPORT_TILE_URL` uses Esri World Physical Map | Treat map display and exported-image rendering separately |
| Browser dependencies | site/index.html: Leaflet 1.9.4 from unpkg; html2canvas 1.4.1 from jsDelivr | Preserve integrity/CORS attributes where present and exercise map and export after changes |
| Public information links | Site template colophon/symbol links; app.ts `CRITERIA_URL` and catalogue-provided UNESCO/Wikipedia links | Navigation only; external catalogue links accept HTTP/HTTPS. References to this repository in documentation are provenance, not all executable dependencies |

The *Table Credential references and provider authority* identifies store names without disclosing values. Provider storage limits copies but does not imply that consuming application code cannot extract a credential.

*Table Credential references and provider authority*

| Reference | Store and consumer | Provider authority and replacement condition |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase hosted function environment; [database adapter](supabase/functions/_shared/new-profile-mail.ts), usage and owner handlers | Project provider supplies routing/key material. The service key is secret and broad; replacing the project requires corresponding grants and schemas, not copying the old key |
| `MWH_MS_TENANT_ID`, `MWH_MS_CLIENT_ID` | Supabase function settings; `createMailSender` | Non-secret references to Microsoft tenant/application. Microsoft administrators own registration and Exchange scope; Supabase administrators maintain the configured references |
| `MWH_MS_CLIENT_SECRET` | Supabase Secrets; `createMailSender` reads it into the token request | Microsoft issues/revokes the application credential; authorised provider administrators install its consuming copy. It is readable by the function, not use-only. Do not put it in Git, generated SQL, browser configuration or logs |
| Microsoft Graph access token | Function process memory until expiry; Graph send request | Acquired from `login.microsoftonline.com` using client credentials and `https://graph.microsoft.com/.default`; Graph `v1.0/users/{sender}/sendMail` consumes it. No persistent application store or browser exposure |
| `MWH_NOTIFICATION_TOKEN` | Supabase Secrets; notification/monthly workers and owner dispatcher | Separate worker invocation credential. It does not grant direct Microsoft access |
| `mwh_notification_token` | Supabase Vault; privileged SQL dispatchers | Matching copy of the worker token. Provider administrators reconcile both copies together; changing only one interrupts scheduled work |
| `mwh_notification_url` | Supabase Vault; SQL notification dispatcher; monthly dispatcher derives `/monthly-report` | Non-secret route stored alongside the worker token. It is sensitive configuration because dispatch attaches a credential. Validate the trusted destination before enabling schedules |
| `MWH_INGEST_TOKEN` | Optional Supabase setting read by usage handler; not configured at the last recorded inspection | Legacy optional gate, not an identity proof. Do not provision automatically during handover |
| Supabase Auth owner account, signing and session policies | Supabase Auth administration; owner API validates returned user | Re-establish the pinned Id and confirmed email. Signup, link/session expiry and audit settings need provider review; a public manifest cannot configure them |
| Native integration grant, GitHub job tokens and Pages OIDC | Provider integration stores and job runtime | User-mediated provider administration controls grants. Runtime mail/admin functions have no repository mutation credential. Inspect permissions separately from whether the connection works |

# Mail path and operational settings

Postgres contains usage records, queue state and scheduler configuration. It does not contain the destination mailbox as a configured value and does not authenticate to Microsoft. Its scheduled dispatcher reads the worker URL/token from Vault and invokes a Supabase function. The function selects the recipient, reads the Microsoft application references/secret from its environment, obtains a short-lived token and sends through Graph. Immediate accepted submissions can invoke the same delivery adapter without waiting for Cron. [System behaviour](SYSTEM_BEHAVIOUR.md) contains the canonical message sequences; [Exchange setup](supabase/EXCHANGE_SETUP.md) describes provider responsibilities.

The *Table Timing and retained state* identifies settings that affect continuity rather than just routing.

*Table Timing and retained state*

| Item | Current mechanism and location | Handover implication |
| --- | --- | --- |
| Retry scheduler | `mwh-new-profile-retry`, every minute; [schedule migration](supabase/migrations/202610020002_notification_retry_schedule.sql); [current dispatcher](supabase/migrations/202610030004_monitor_dispatch.sql) | Preserve notification attempts, availability and lease state. Never run two migrated workers against independently copied queues without reconciliation |
| Monthly scheduler | `mwh-monthly-report`, `0 6 1 * *` UTC in [monthly migration](supabase/migrations/202610020008_monthly_reporting_schedule.sql) | 08:00 Johannesburg on the first. Reporting boundaries use Johannesburg in [report calculation](supabase/functions/_shared/monthly-report.ts); changing the schedule alone does not change the reporting calendar |
| Probe | GitHub variable `MWH_SUPABASE_PROBE_ENABLED`; schedule `17 2,10,19 * * *` with 0–90 second jitter | Enable only after the intended project's database-backed read is verified. Its URL currently comes from a separate GitHub secret-store entry |
| Catalogue refresh | Monthly `17 3 1 * *`; dispatch retry interval defaults to 30 days | Preserve last successful catalogue/provenance and distinguish extraction failure from valid source change |
| Visitor storage | `mwh_profile`, `mwh_usage_summary_endpoint`, `mwh_census`, `mwh_map_view`, `mwh_usage_submit_status`, `mwh_flag_` settings | Origin-scoped. Profile export/import preserves profile content, not every independent browser key. Keep pending receipts and counters coherent; do not assume a new hostname has old history |
| Owner storage | `mwh_admin_session` in tab session storage | Contains bearer/expiry. Do not migrate; authenticate afresh at the destination |
| Report acknowledgements | Local pending summaries plus database receipt Ids; mail action ledger and notification completion | Retain deduplication state. A lost acknowledgement is not proof that no message/submission was accepted |

# Component replacement and handover

The *Table Component continuity* specifies what to carry, reconstruct or deliberately retire. [Schema](supabase/SCHEMA.md) provides SQL names and migration traceability; [Security policy](SECURITY.md) provides credential custody and impact analysis.

*Table Component continuity*

| Architectural component | Preserve or transfer | Re-establish and verify |
| --- | --- | --- |
| Catalogue/publication | Current JSON/GeoJSON, mappings, source provenance, Git commits/tags and release revision | Source contract, stable site identifiers, pipeline permissions and paired output validation |
| Visitor client | Build source/assets and user-exported `.profile` files | Relative directory layout, canonical links, reporting migration and browser-origin implications; no automatic cross-origin storage transfer |
| Monitoring store | Submissions, Profiles, Notifications; `admin_operations`, `admin_login_gate`, `security_monitor_state`; relevant Auth/audit records; schema migration history | Schema/grants/RLS, owner binding, provider logging/retention, extensions and schedules. Preserve classifications, receipt identities and queue completion. Decide whether old logs are migrated or retained as a separately protected archive |
| Reporting and mail | Pending/uncertain work, completion ledger and message correlation evidence | Provider-side sending grant, secret references, Vault endpoint/token consistency and delivery tests; do not assume copied ciphertext works in a new project |
| Owner administration | Source, query contracts and relevant action history | Fixed identity checks, CORS/CSP, fresh sign-in and rejected anonymous/wrong-owner requests; no transfer of active sessions |
| Release services | Repository history, Issues, review/deployment evidence and lockfile | Provider-owned integration authorisation, branch/environment policy, Pages and backend release status; verify both deployments independently |

A maintainer should execute the following sequence, recording the responsible person and evidence at each step:

1. Identify the failed or replaced dependency by Id. Record the reason, target contract, affected consumers, information transferred and acceptable interruption. Take a non-secret snapshot of expected configuration and current release/schema versions.
2. Have authorised provider administrators establish the destination settings, owner identity, credentials and grants. Record references and expiry/rotation responsibilities, not credential values. Verify the account and resource before enabling workers.
3. Prepare the application changes in a reviewed PR. Today this means the source locations in the inventory; centralisation remains proposed under Issue 57. Validate the alternate addresses, contracts and security checks without sending production data to an unverified destination.
4. For a store replacement, select and rehearse a protected backup/restore process. Stop or coordinate writes and old/new schedulers through their authorised provider/release controls. Account for the final records accepted before cutover. Record counts, classifications, receipt Ids, queue/lease state and audit retention. No tested universal data-transfer script is supplied by this project.
5. Release compatible server changes before directing clients to them. Verify public statistics and receipt matching, owner rejection/acceptance, database grants, scheduled execution and one deliberate mail test. Record inbox receipt separately from Graph acceptance. Pages and Supabase deployments are independent, not an atomic switch.
6. Reconcile pending and uncertain work before retiring the old service. Keep the old data read-only or archived under an explicit retention decision. Provider administrators revoke superseded grants/credentials after validation; the application cannot do this.
7. If reverting, stop conflicting workers first and reconcile all destination-side writes. Reverting a web address does not restore lost data; reverting Git does not undo an applied SQL migration. Define the corrective migration/data reconciliation before declaring rollback complete.

# Proposed central configuration

[Issue 57](https://github.com/pekka-28/unesco/issues/57) tracks an unimplemented proposal. A version-controlled non-secret manifest would identify service addresses, repository/canonical links, notification recipient, separately bound owner identity, previous default endpoints and credential-store reference names. Provider configuration would remain authoritative for actual values/grants held there; the manifest would describe expectations and dependencies, not administer them.

The web build could generate typed public constants, invitation/report links and administration CSP from that manifest. Server packages could consume the relevant non-secret subset. CI could validate internal consistency and report required provider changes. Secrets would never be embedded, and the browser could not select its own owner authorisation policy.

SQL would not read a Git file at runtime. Existing procedures would continue reading their named Vault entries, configured by the provider administrator. A changed schema or function contract would require a new reviewed SQL migration; existing applied migrations would remain immutable. A routing-only change must not generate a migration that overwrites provider-managed Vault values. A change checklist would identify the expected Vault URL, its consuming procedures and the paired worker-token references. This replaces the earlier suggestion to manage those values through generated SQL.

A list of former default reporting endpoints could let clients migrate normal stored settings while retaining deliberate overrides. This does not move records, provider permissions or browser storage, and it cannot make an incompatible replacement API work merely by changing its address.

# Implementation languages and assurance boundary

All active first-party browser, Supabase and Node implementations and tests are TypeScript. `npm run typecheck` checks all three configurations with strict and unused-declaration checks. `npm run verify` also runs the Node/browser/database regressions, PowerShell syntax and catalogue tests, and documentation link checks. `npm ci` installs the locked database test engine and declarations; no separate `.local` dependency installation is needed.

*Table Type-check coverage*

| Layer | Source and checks | Limitation |
| --- | --- | --- |
| Visitor, administration and compatibility redirect | `site/src/**/*.ts`; [browser configuration](tsconfig.json) and [source gate](scripts/check_site_types.ts) | Published JavaScript is compiler output. Types do not validate external JSON |
| Supabase functions | `supabase/functions/**/*.ts`; [server configuration](tsconfig.supabase.json) and [source gate](scripts/check_server_types.ts) | Provider configuration and runtime payloads still require validation; compilation does not establish deployment state |
| Node scripts and tests, including Playwright | `scripts/**/*.ts`, `tests/**/*.ts`; [tooling configuration](tsconfig.tooling.json) and [source gate](scripts/check_tooling_types.ts) | The gate rejects JavaScript files, explicit `any`, detected untyped declarations/collections and type suppressions. VM fixtures supply narrow test dependencies; database queries declare their projected row types. Runtime tests verify those boundaries |
| PowerShell catalogue and maintenance scripts | `scripts/*.ps1`, `tests/catalogue.tests.ps1`; [parser check](scripts/check_powershell.ps1) and catalogue regression, run with `npm run test:powershell` | PowerShell has no equivalent TypeScript compiler gate. These are syntax and behavioural checks, not static typechecking |
| SQL migrations | Ordered files in `supabase/migrations/`, executed in PGlite regression tests | PostgreSQL checks SQL when executed. Historical migrations remain required deployment history |
| Third-party and generated code | Leaflet, html2canvas, Mermaid, downloaded `data/staging/map_bundle.js`, installed dependencies and generated browser output | Not first-party implementations; upstream code is not converted by this migration |

`tsx` executes TypeScript but does not typecheck it. The separate compiler gate runs before tests in CI. Both the Pages and regression workflows check types; scheduled report/probe workflows install the lockfile before executing their typed scripts.

## Completed tooling and retirement audit (2026-10-07)

The former nine `.mjs` scripts and nineteen `.mjs` tests are now `.ts` and checked. This includes `startup-help.test.ts`, both typecheck gate implementations, the source compiler helper, reports, probes and ingestion audit. Playwright includes the visitor regression, synthetic screenshot capture, administration regression and diagram renderer. Capture uses `npm run capture:guide`; `MWH_CHROME_PATH` optionally selects a browser and `MWH_GUIDE_OUTPUT` redirects review captures. `npm run render:diagrams -- file.md` renders Mermaid figures to `.local/diagrams` (defaults: schema and architecture documents).

All sixteen former `.local/*.cjs` utilities were assessed and removed. Admin rendering/sign-in/export checks were retained in `tests/admin-browser.test.ts`; both diagram utilities were replaced by `scripts/render_diagrams.ts`. Other local scripts depended on retired previews, specific saved browser state, removed alias fields, or one-time source/data patches already superseded by maintained code and tests. The additional top-level local Python drafting/commissioning helpers and old import check were also removed; the public deployment smoke check moved to `scripts/verify_monitoring_http.ts`. No saved profile, audit evidence or screenshot artifacts were removed.

The two retired Overpass pipeline scripts, five historical provider-provisioning/mail-commissioning scripts and stale importer bytecode were removed. Archived data was retained: local-name tooling still references the Overpass data cache. Provider configuration remains an administrator task. See [retirements](RETIRED_CODE.md).

There are no remaining active first-party JavaScript scripts or tests outside the typecheck configurations. Inline workflow shell commands, PowerShell and SQL retain the language-specific limits above. Local build/dependency output and historical evidence are not active source.
