<!-- TRACEABILITY.md -->
# My World Heritage — documentation traceability

3 October 2026

This review connects the product overview, requirements, component and interaction design, implementation and supporting analyses. It checks content against the source baseline [9504978](https://github.com/pekka-28/unesco/tree/9504978), with this change adding documentation and screenshot tooling. Traceability means a reader can follow the reason, mechanism and evidence; it does not imply that every control is verified or every deferred requirement implemented. Individual facts need not be repeated in References.

# Document stack

*Table Document stack* gives each document a distinct responsibility. Requirements describe intended behaviour; the design locates and sequences it; source and migrations implement it; tests and readbacks support bounded claims.

*Table Document stack*

| Level | Canonical material | Content responsibility |
| --- | --- | --- |
| Overview | [README](README.md) | Product purpose and entry points |
| Required behaviour | [Requirements](Requirements.md) | Features, boundaries, deferred scope and acceptance |
| User operation | [User guide](site/user-guide.html), [administration guide](admin/guide.html) | Separate visitor and owner controls, screenshots and outcomes |
| Component design | [Architecture](ARCHITECTURE.md) | Applications, stores, dependencies and responsibility |
| Interaction design | [System behaviour](SYSTEM_BEHAVIOUR.md) | Canonical MSCs, triggers, state transitions, failures and hand-offs |
| Data/API design | [Schema](supabase/SCHEMA.md) | Entities, API contracts, invariants and ordered migration definitions |
| Operational design | [Administration](ADMINISTRATION.md), [deployment](supabase/GITHUB_DEPLOYMENT.md), [mail setup](supabase/EXCHANGE_SETUP.md) | Permitted operations and separately authorised configuration |
| Service configuration and continuity | [Service dependencies](SERVICE_DEPENDENCIES.md) | Partner purposes, setting/store locations, provider authority, component replacement and typing limits |
| Security profile | [Security](SECURITY.md) | Domains, proof/grant boundaries, custody, compromise consequences and residual gaps |
| Implementation | [Client](site/src/app.ts), [administration client](site/src/admin.ts), [functions](supabase/functions), [migrations](supabase/migrations), [workflows](.github/workflows) | Executable mechanisms and configuration |
| Verification | [Test plan](TEST_PLAN.md), [tests](tests), GitHub PR/check/deployment records | Reproducible checks and revision-specific outcomes |
| Retirement and provenance | [Retired code](RETIRED_CODE.md), [source snapshots and mapping reports](data/staging), [symbol](My%20World%20Heritage.md) | Supersession, forensic records and asset provenance |

The reusable guidance, preparation guide, assessment template, application assurance assessment and synthetic aggregation analysis remain local by owner instruction. Their local Traceability review links back to this product stack and identifies their evidence limits. Publishing them is a separate decision after hardening; they are not implied to be part of the web distribution.

# Content coverage

*Table Content coverage* maps feature families rather than repeating a citation for every sentence. Function names identify the enforcing source where a whole-file link would otherwise be ambiguous.

*Table Content coverage*

| Requirement or concern | Design and analysis | Implementation | Evidence and limitation |
| --- | --- | --- | --- |
| Current catalogue, stable identity and retired sites | Architecture catalogue/data ownership; Requirements dataset quality; local recovery audit (not published baseline evidence) | [Refresh workflow](.github/workflows/update-unesco-data.yml), [catalogue tooling](scripts) and current JSON/GeoJSON | [Catalogue tests](tests/catalogue.tests.ps1); recorded source exceptions remain separate from deployment completion |
| Search, map filters and explicit selection | Requirements mapping/search; System behaviour Visitor resources; user-guide map/detail controls | `buildWhsSearchResults`, `refreshMarkers`, `renderDetail` in [client](site/src/app.ts) | [Country search](tests/country-search.test.mjs), [selection](tests/site-selection.test.mjs); catalogue records are not unique inscriptions |
| Local profiles, visits, import/export and Summary | System behaviour Local profile operations/Local output; security interface register | `persistProfile`, `importProfileFile`, `exportProfile`, `exportVisitedSummaryReport` in [client](site/src/app.ts) | Browser checks; complete quota-failure recovery and concurrent-edit assurance remain open |
| Name-only submission, receipts and reminder | Requirements usage; System behaviour Accepted report/timers; Schema Submissions | `buildUsageSummary`, `runSubmissionDialogSend`, `isSummaryDue`; [usage handler](supabase/functions/usage-summary/handler.mjs) and ordered [migrations](supabase/migrations) | [Name](tests/profile-name.test.mjs), [receipt](tests/usage-summary.test.mjs), [reminder](tests/summary-reminder.test.mjs) tests |
| Reporting destination migration | Requirements cutover; guide Settings; security egress analysis | `resolveUsageEndpoint`, `migrateStoredUsageSettings` in client | [Cutover tests](tests/supabase-cutover.test.mjs); custom destinations remain deliberate overrides |
| First-profile and monthly mail | Requirements owner reports; System behaviour delivery/monthly flows; Schema leases | [Notification worker](supabase/functions/new-profile-notifications), [monthly worker](supabase/functions/monthly-report), [mail adapter](supabase/functions/_shared/new-profile-mail.mjs) and schedule migrations | [Notification](tests/new-profile-notifications.test.mjs), [monthly](tests/monthly-report.test.mjs), [register](tests/register-report.test.mjs) tests and recorded owner receipt; not exactly-once external delivery |
| Histogram | Requirements histogram; Schema histogram; local aggregation analysis | `loadUsageHistogram`; [histogram replacement](supabase/migrations/202610020006_always_show_histogram.sql) | [Histogram tests](tests/usage-histogram.test.mjs); exact moving extrema remain exposed, no anonymity guarantee |
| Owner client and fixed operations | Requirements owner administration; System behaviour administration sequences; Administration operation inventory | [Admin client](site/src/admin.ts), [owner service](supabase/functions/owner-admin/handler.mjs) and administration/least-privilege migrations | [Owner API](tests/owner-admin.test.mjs), [grants](tests/least-privilege.test.mjs); UI hiding is not the authorisation boundary |
| Auth audit and fault mail | Requirements audit; Security audit policy; Schema audit monitoring | [Security monitor](supabase/functions/_shared/security-monitor.mjs), audit/dispatch migrations | [Audit tests](tests/security-audit.test.mjs); Issue 36 retains provider activation, retention and detection gaps |
| Release separation and credential custody | Security release/grant/custody tables; System behaviour Release; deployment instructions | [Pages workflow](.github/workflows/pages.yml), native integration, job permissions and secret configuration | Recorded grant/rule evidence; Issue 33 retains independent approval and runtime-isolation gaps |
| Availability probe | Requirements probe; Architecture schedules | [Probe workflow](.github/workflows/supabase-probe.yml) | [Probe tests](tests/supabase-probe.test.mjs); best-effort check, not a provider availability guarantee |
| Help, invitations and public guide | Requirements startup help; System behaviour timers; illustrated guide | `scheduleStartupHelp`, [HTML dialog](site/index.html), [capture script](scripts/capture_user_guide.mjs), [Pages allowlist](scripts/build_pages.mjs) | [Startup tests](tests/startup-help.test.mjs), [distribution test](tests/pages-distribution.test.mjs), synthetic screenshot/link review |
| Symbol, asset sources and retirement | Requirements source/licensing; symbol document; Retired code | [Public-domain SVG](site/icons/mwh-temple.svg), [redirect](site/src/redirect.ts), explicit distribution allowlist | Asset declaration and hash; redirect/distribution checks |

# Unexpected and indirect paths

*Table Indirect traceability* gives explicit source locations where a visible action does not explain the resulting authority or side effect.

*Table Indirect traceability*

| Path | Explicit trace and reason | Assurance consequence |
| --- | --- | --- |
| Submission creates owner mail | `accept_usage` inserts a record in Submissions; the `usage_new_profile` trigger creates Profiles/Notifications; `onAccepted` starts delivery; Cron retries separately | Database commit, client receipt and mail acceptance are three different outcomes |
| Profile creation submits adoption | `saveEnrolment` calls `submitAdoptionSummary` even though periodic opt-in defaults off | Initial adoption is distinct from periodic prompting; the guide must say so |
| Reminder after browsing | `isSummaryDue` compares elapsed time; the watch runs every 15 seconds | No catalogue/visit change is required; 0.0002 days means 17.28 seconds |
| Import changes future egress | `importProfileFile` loads settings and `migrateUsageSettings` preserves custom endpoints | Import is not merely visit-data loading; subsequent reports may go to an imported server |
| A saved session shows the admin workspace | Client local expiry permits a status request; service verifies identity again | Session restoration is not proof of authority; the service remains the enforcement point |
| Download after a query | Admin `lastData` serialises locally without another API request | Exports retain full values and timestamp precision; separate retention and same-origin risks apply |
| New command after uncertain mail | Admin client creates a fresh UUID on each click; service deduplicates only the supplied operation Id | Another click is a new command, not an exactly-once retry; inspect history first |
| Credential use versus modification | Security custody C11/C15 concerns the native integration consumer; installation/project administration controls new trust and grant changes | Use-only means the consumer cannot cross into independently authenticated user-mediated configuration; extraction is a separate property and provider enforcement still needs evidence |
| Code deployment exposes runtime secrets | Runtime/environment readers can be changed by deployment authority | A secret UI that cannot display a value does not establish an extraction barrier |
| Catalogue update and monthly register mail | Refresh workflow commits/tags and writes artifacts; monthly worker later compares period-boundary commits | Refresh success itself does not send the monthly report; earlier architecture text suggesting per-refresh mail was corrected |
| Foreign-key-looking entity links | Schema relationships for Profiles/Submissions and first submission/Notifications depend partly on trigger/import code, not declared foreign keys | Consult Schema maintenance enforcement column and ordered SQL; a diagram edge is not a SQL constraint |
| Older migration definitions | Alias and initial histogram migrations remain for reproducible history; later Name, always-visible and source migrations replace them | Review ordered migration state, not only the first CREATE definition |

# Review conclusion

The reviewed document stack now provides explicit content paths from overview and requirements to design, implementation and evidence for the delivered feature families and the local analyses. Stale alias, import-pending, per-refresh mail and distribution-count statements were corrected. MSCs remain solely in product design; security analyses reference them.

This confirms traceability of the reviewed content, not complete implementation or completed security assurance. Provider grant-change barriers, runtime isolation, audit activation/coverage, complete browser recovery and aggregate-disclosure limits remain explicitly open. Deferred requirements remain deferred; historical evidence retains its original date and scope. A future code or policy change must update the affected chain, screenshot/control inventory and evidence rather than treating this review as permanent certification.

# Visitor rendering correction

[Issue 54](https://github.com/pekka-28/unesco/issues/54) connects the confirmed note-injection finding in the [security review](SECURITY_CONCERNS.md) to HTML-context escaping and external-link validation in [the visitor client](site/src/app.ts). The [browser regression](tests/visitor-rendering.test.mjs) verifies imported note display, tooltips, editing, related catalogue/search fields and URL schemes; CI executes it as part of the full suite. This explicitly covers browser rendering across the local-profile and catalogue trust boundaries, independently of server authentication.
