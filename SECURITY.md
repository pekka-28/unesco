<!-- SECURITY.md -->
# My World Heritage security policy

3 October 2026

This policy governs the visitor application, owner administration, Supabase monitoring store, mail services and GitHub release process described in [Requirements](Requirements.md) and [Architecture](ARCHITECTURE.md). [Issue 25](https://github.com/pekka-28/unesco/issues/25) tracks removal of administration release authority and verification of this policy. Statements distinguish implemented controls, verified configuration and residual risks; the document is not a security certification.

# Policy

Assume that every URL, source file, schema, operation name and non-secret identifier is known to an attacker. Obscurity must provide no access control. Public source and documentation must contain no credentials. A hidden button, an unlisted page, CORS, a robots directive or a private repository must never confer authority.

Each component performing an operation must authenticate its immediate caller and authorise the requested operation. The owner API verifies the owner identity before using delegated service credentials. PostgreSQL, the mail functions, Microsoft and GitHub enforce their own service permissions. Authentication alone does not authorise arbitrary operations, and downstream components do not independently identify the owner when they receive a service credential.

The administration site may inspect bounded read models, export those results and request the three named owner-mail operations. It must not dispatch or rerun workflows, publish a site, refresh or edit the catalogue, change reporting records, run arbitrary SQL, import data, change a schema, manage accounts or permissions, modify configuration, or read/write secrets. These restrictions apply to authenticated direct API calls as well as the UI. No GitHub mutation credential or Supabase Management API token belongs in its runtime configuration.

Production code, catalogue and schema changes originate in the GitHub maintenance/release process. The configured native Supabase–GitHub integration applies backend releases; GitHub Pages publishes browser code and catalogue files. Catalogue automation remains in GitHub. The administration site cannot trigger any part of that change path. Security credential provisioning and emergency revocation remain separate provider-administrator responsibilities, not administration-site features; they do not constitute an alternative application deployment mechanism.

Permitted mail operations necessarily update delivery leases, attempts, completion state and the administration ledger. Sign-in also updates Supabase Auth state and the sign-in throttle. These operational writes do not authorise changes to site content, reporting history or release configuration. The public submission endpoint independently accepts voluntary reports under its documented contract.

# Security assurance

Authentication at the executing component and freedom from obscurity are necessary, but **not sufficient to assure security, even assuming no implementation errors**. They establish who may request an operation and which operations the interface exposes. They do not prove the caller's device is uncompromised, that a mailbox or bearer credential has not been stolen, that an authorised maintainer or dependency is trustworthy, or that a provider remains available.

The narrower claim is conditional: with trustworthy providers and release inputs, correctly configured grants, confidential credentials and an uncompromised owner mailbox/device, the intended interfaces deny unauthorised private access and expose no administration operation that changes the site. Tests substantiate particular boundaries; they are not a proof that all attacks are impossible.

This release does not establish capability isolation of the administration server from the database. Supabase supplies project-wide privileged runtime credentials. The service role bypasses row-level security, though it still needs SQL object grants; this release reduces those grants. The database connection credential carries broader database authority. Their absence from browser output and the server operation allowlist protect the intended interface; they do not eliminate damage after server or credential compromise. Stronger isolation requires a separately scoped service identity or broker and a review of provider-injected credentials. [Supabase API-key documentation](https://supabase.com/docs/guides/getting-started/api-keys) describes the service-role boundary.

# Executing components and authority

*Table Enforcement boundaries* identifies the checks at each executing component. Public operations are explicit exceptions to owner authentication, not accidental bypasses.

*Table Enforcement boundaries*

| Component | Authentication and authorisation | Permitted effect |
| --- | --- | --- |
| Owner API | Supabase Auth validates the access token; API checks the configured owner UUID, exact confirmed mailbox and operation allowlist | Bounded reads and named mail requests |
| Database | PostgREST authenticates the service role; PostgreSQL grants deny anonymous and ordinary authenticated access to private tables/RPCs | Fixed read models and operational state changes |
| Mail workers | Each function rejects requests without the configured worker bearer credential | Fixed-recipient owner reporting and queued notification delivery |
| Microsoft Graph/Exchange | OAuth authenticates the notifier application; Exchange limits Application Mail.Send to the sender mailbox | Send mail; no requested mailbox-reading role |
| GitHub inspection | Public, fixed-path GET after owner authentication | Read workflow status; no GitHub credential or write method |
| Release services | GitHub workflow permissions and native Supabase GitHub authorisation | Apply the repository's authorised release |
| Public usage endpoint | No person authentication; bounded payload validation, accepted-event allowlist, receipt deduplication and per-cookie limits | Accept a record in Submissions and return selected aggregates |
| Sign-in initiation | Public request, fixed recipient, database-enforced five-minute reservation | Deliver an owner challenge; no owner session until verification |

`verify_jwt = false` in the Edge Function configuration means the gateway does not supply the application authentication decision. Private functions perform their own checks before protected work. The visitor API intentionally accepts anonymous reports. The owner API does not accept a reporting cookie as an authentication credential.

# Credentials and security configuration

*Table Credential inventory* records project security items without their values. Treat passwords, bearer tokens, private signing keys and generated sign-in links as credentials even when held only briefly. Public identifiers do not acquire security from being stored in a secret manager.

*Table Credential inventory*

| Item | Protection and use | Exposure/recovery consequence |
| --- | --- | --- |
| Owner mailbox and Microsoft session | Exchange account controls protect receipt of single-use links | Mailbox compromise can grant owner administration access; recover mailbox and disable owner API |
| Magic-link token/hash | Supabase generates/verifies it; Exchange sends only to the fixed owner; browser removes the URL fragment before processing; server never returns it from the login request | Possession permits sign-in before use/expiry; do not forward, log or persist it |
| Owner access token | HTTPS, server validation on every private request, session storage, no retained refresh token, no-store API responses | Bearer theft permits owner operations until rejected/expired; remove owner configuration for emergency denial |
| `MWH_ADMIN_USER_ID` and fixed owner email | Server-controlled exact identity checks, independent of client metadata | Identifiers are not secrets, but configuration integrity is critical |
| `SUPABASE_SERVICE_ROLE_KEY` and provider secret keys | Hosted server environment only; fixed Data/Auth API calls; excluded from Pages, exports and logs | Broad project authority; rotate through provider controls if exposed |
| `SUPABASE_DB_URL` | Provider-injected server connection credential; application handlers do not use or expose it | Potential direct database authority; absence from handler code is not isolation |
| `MWH_NOTIFICATION_TOKEN` | Supabase Secrets; workers verify it before work; matching Vault value used by postgres-owned Cron dispatchers | Can invoke mail workers; rotate Secrets and Vault together |
| `MWH_MS_CLIENT_SECRET` | Supabase Secrets; used server-side to obtain short-lived Graph tokens | Application mail authority; rotate in Microsoft and update Supabase |
| Graph access token | Server memory cache with expiry; never returned to browser | Mail-sending authority within Exchange scope until expiry/revocation |
| `MWH_MS_TENANT_ID`, `MWH_MS_CLIENT_ID`, `MWH_MS_MAIL_FROM` | Controlled server configuration; identifiers/sender, not passwords | Changing them can disrupt or redirect the configured mail identity |
| Vault notifier URL/token | Managed Vault storage; decrypted access confined to privileged dispatch functions; no browser/API secret reader | Database superusers remain trusted; rotate leaked token and validate dispatcher destination |
| Supabase signing keys and Auth internals | Provider-managed signing and verification; no application export endpoint | Provider key security is a trust assumption; use provider rotation procedures |
| `SUPABASE_JWKS`, anon/publishable keys and project URL | Public verification/routing/client identifiers; database grants remain the access boundary | Knowing these must not unlock private tables or RPCs |
| `MWH_ALLOWED_ORIGIN` | Controlled browser-origin policy | CORS limits browsers, not a caller able to forge headers; never authenticates a user |
| `MWH_INGEST_TOKEN` | Optional legacy server gate; not configured in the inspected production secret list | A browser-shared value would not identify a person or prevent determined abuse |
| Native Supabase GitHub App authorisation | Provider-managed integration restricted to the connected repository/project | Release authority; review installation access and revoke through provider controls |
| GitHub `GITHUB_TOKEN` and Pages OIDC token | Ephemeral workflow credentials with job permissions; not available to administration | A compromised release workflow can exercise its granted permissions |
| Local GitHub/Supabase/operator credentials | OS credential store or approved local environment; excluded from Git and browser distribution | Separate maintenance authority; revoke at the provider and remove local copies if compromised |
| Former `MWH_ADMIN_GITHUB_TOKEN` | No runtime reader, no setup instruction and no secret present during inspection | Do not provision it; revoke/delete any later-discovered copy |

Inspection on 3 October 2026 found access-token and email-link lifetimes of 3,600 seconds. Public Auth signup remained enabled; signup cannot satisfy the pinned owner UUID but can consume resources. The Auth site URL retained its localhost default with no additional redirect allowlist. The administration mail path constructs a fixed HTTPS fragment link and explicitly verifies it, so it does not use that default redirect. These facts are configuration observations, not endorsements of the defaults. Shorter lifetimes and disabling unused signup need a deliberate provider-configuration change.

# Data and distribution

*Table Data protection* records what is public, what is private and the limits of protection. Optional names remain identifying data regardless of whether a user chose to submit them.

*Table Data protection*

| Asset | Protection | Limitation |
| --- | --- | --- |
| Personal profile, home location and visit history | Browser storage and user-controlled exports; submission allowlist excludes locations and individual visits | Device access, same-origin scripts and exported files are outside server access controls |
| Profiles, Submissions and Notifications | Private tables/RPCs; owner-only bounded views; historical test/noise classifications retained | Owner/service operators can read names and pseudonymous identifiers; these are not anonymous data |
| Historical workbook and private working files | Git ignores private paths; explicit Pages allowlist excludes them | `.gitignore` is not encryption or protection against local users/backups |
| Public activity aggregates and histogram | Response allowlist excludes row identifiers, names and raw payloads; chart omits count labels | No minimum-population threshold by owner decision; repeated/small-population observations can support inference; not differential privacy |
| Owner-mail contents | Fixed recipient, HTTPS to Graph, mailbox controls; routine reports avoid individual visit details | Copies persist in sent/received mail; forwarding and retention remain mailbox responsibilities |
| Admin query downloads | Explicit authenticated export of the current result page | Downloaded JSON is unencrypted private data and must be protected by its recipient |
| Admin operation ledger | Server-derived actor, unique request ID, completion state; ordinary clients cannot write it | Service/database administrators can alter it; it is not tamper-evident forensic storage |
| Notification leases and receipt IDs | Database transactions, unique constraints, worker ownership checks and receipt matching | Interrupted provider acknowledgements can cause duplicate mail; IDs are not person authentication |
| Catalogue, source code and documentation | Public Git history and ingestion tags; validation and stable-ID reconciliation | Git integrity does not authenticate UNESCO source truth or prevent an authorised malicious change |
| Browser distribution | Explicit build allowlist, strict TypeScript checks; no backend source, credentials or private data in Pages output | Type checking does not prove runtime security |
| Administration HTML/script | Build-generated script hash CSP, no third-party scripts, text-only result rendering, no-referrer links | CSP does not make sibling paths a separate security origin or constrain a compromised release |
| Provider logs, workflow artifacts and backups | Provider access controls and retention; handlers avoid secrets/provider bodies in client errors | GitHub artifacts may be public; no secrets/private rows belong in them; backup/restore assurance needs separate verification |

`/admin/` and `/site/` share the `pekka-28.github.io` origin. Paths are not a browser security boundary, and session storage is origin- and tab-scoped. Other applications published on that origin and their scripts therefore belong in the trust assessment. A separate administration origin would strengthen isolation. See [MDN same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) and [session storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).

# Release integrity and availability

Repository inspection on 3 October 2026 found no protection on `main` and no repository rulesets. Pull requests and checks are used operationally, but a credential permitted to push can bypass that convention. Do not claim enforced independent review, protected releases or immutable audit history. Before treating review as a security boundary, establish protections that require the relevant checks, restrict direct writes and force-pushes, and accommodate the authorised catalogue workflow without granting administration-site access.

Build dependencies, GitHub Actions, browser libraries, the UNESCO source, provider control planes and the maintainer's device are trusted inputs. This release pins Actions to full upstream commit identifiers, disables persisted checkout credentials in read-only jobs and adds weekly Dependabot updates. Lockfiles, tests, dataset validation and restricted workflow permissions reduce mistakes; proposed dependency updates and browser third-party code still require review. No dependency audit or provider certification is implied by this document.

Per-cookie submission limits do not prevent an attacker creating new cookies, generating misleading statistics or exhausting notification resources. The global sign-in throttle can itself delay an owner who requests a link during the reservation interval. The database probe is a best-effort check, not an availability guarantee. Availability and resource-abuse protection require provider quotas/monitoring and, if needed, additional rate controls. These risks remain even with correct authentication code.

# Recovery and verification

If owner credentials are compromised, use separately authenticated provider administration to remove `MWH_ADMIN_USER_ID`, revoke Auth sessions and recover the mailbox. Do not rely solely on clearing browser storage: access-token expiry/revocation semantics are provider-controlled. [Supabase sign-out guidance](https://supabase.com/docs/guides/auth/signout) documents the remaining token lifetime. Rotating a worker credential requires coordinated Secrets/Vault changes; rotating Microsoft credentials requires both Microsoft and Supabase updates. A release compromise also requires reviewing deployed code, migrations, workflow changes and issued credentials before restoring access.

Database recovery uses forward corrective migrations through GitHub and the native integration. A Git revert alone does not reverse an applied database migration. Keep recoverable private backups under appropriate controls and verify restore procedures separately; this review has not proved restoration capability. Any exceptional recovery outside the normal release path requires explicit owner authorisation and recorded evidence.

Release checks must verify private endpoints reject missing/invalid credentials, wrong/unconfirmed users cannot access owner operations, direct database calls lack ordinary-client grants, authenticated owner requests cannot invoke forbidden mutations, GitHub inspection sends only a credential-free GET, and the published page has no mutation controls. Preserve evidence in the issue. Do not put credentials or private row contents in test output.

The remaining hardening decisions are branch protection compatible with catalogue automation, narrower server privileges, stronger browser-origin isolation, Auth defaults, dependency integrity, account MFA verification, abuse controls and tested recovery. None is silently claimed complete. Security defects belong in GitHub Issues; do not publish exploit secrets or private data when reporting them.

# Positive authorisation by operation

*Table Positive authorisations* lists the affirmative grant or validated capability required before each operation. Possession of an identifier, knowledge of a URL or a successful login alone is insufficient. Operation arguments do not select a different repository, recipient, endpoint or SQL statement.

*Table Positive authorisations*

| Operation | Positive authorisation | Least permitted effect |
| --- | --- | --- |
| Request sign-in link | Public challenge policy plus successful atomic `admin_reserve_login()` reservation | Fixed owner recipient once per five minutes |
| Verify sign-in | Supabase single-use token verification plus exact configured UUID and confirmed email | Issue owner access token |
| Owner database status, schema and entity queries | Valid owner token at owner API; service-role EXECUTE on `admin_read` | Fixed read models; at most 100 entity rows |
| Download query results | Successful authorised read already completed | Export current page in the owner's browser |
| Read workflow status | Valid owner token; public GitHub GET needs no GitHub credential | Fixed repository's latest production runs |
| Send test/monthly mail or retry notifications | Owner token, allowed command, explicit confirmation, fresh UUID; worker verifies separate bearer credential | Fixed owner mail and delivery-state updates |
| Record operation start | Service role INSERT on ledger `id`, `actor`, `action` only | Server-validated owner and command; timestamps/default state set by database |
| Finish operation | Service role UPDATE on ledger `status`, `finished_at` only | Cannot rewrite actor, command, start time or delete records |
| Accept voluntary report | Public reporting contract and validation; service-role EXECUTE on `accept_usage`; SELECT and listed-column INSERT on Submissions | New immutable receipt/report; no caller-set class, legacy source or server receipt time |
| Register profile/notification | Database trigger on accepted insert; postgres-owned function | Create first-profile records or maintain submitted Name |
| Claim/finish notification | Service-role EXECUTE on claim/finish functions; SELECT and UPDATE on delivery columns only | Lease ownership, attempts, retry time and send status; no notification identity/name edits |
| Scheduled mail dispatch | Supabase Cron executes postgres-owned dispatcher; Vault access; worker bearer credential | Invoke configured worker; no public/ordinary-client EXECUTE grant |
| Send through Exchange | Valid notifier client credential and mailbox-scoped Application Mail.Send assignment | Send from authorised mailbox; application fixes recipient |
| Build/test/probe in GitHub | Workflow event and job `contents: read`; public database probe contract | Read repository or aggregate data, without deployment authority |
| Commit refreshed catalogue/name data | GitHub maintenance event and job `contents: write` | Intended staged dataset paths and ingestion tag; provider grant is wider than these paths |
| Deploy Pages | `pages: write`, `id-token: write`, production environment and `main` job condition | Publish approved build artifact |
| Deploy backend/migrations | Connected Supabase GitHub App, production `main` and provider integration authority | Apply reviewed repository changes; unavailable from administration |
| Create/update an issue | Separate operator repository Issues write permission | Track findings; no deployment permission implied |
| Prepare/merge release PR | Separate operator Contents/ Pull requests write permissions and release process | Publish reviewed changes through GitHub |
| Alter repository security | Separate repository Administration write permission | Apply/review repository settings; no application runtime grant |
| Inspect Supabase management data | Separate project-scoped token with only the endpoint's read permission | Prefer the published read-only query endpoint for diagnostics |
| Rotate secrets/change identity settings | Separately authenticated provider administrator with the corresponding project/account write permission | Time-bounded maintenance; never an administration-site API |

[Least-privilege maintenance](supabase/migrations/202610030002_least_privilege.sql) first revokes all default table privileges, then grants the listed table/column rights. Runtime roles cannot truncate tables, create triggers, delete reporting/audit rows, edit accepted submissions, rewrite notification names or create public-schema objects. Profiles and the login gate have no direct runtime table grants; fixed definer functions mediate access. New postgres-owned public tables/sequences need explicit grants. PostgreSQL's global default PUBLIC EXECUTE must be revoked globally because a schema-local revoke cannot subtract it; existing explicit provider-schema grants remain unchanged. Future functions therefore require a deliberate EXECUTE grant.

# GitHub repository security

*Table Repository controls* distinguishes the inspected baseline, changes delivered with this policy and suggested next controls. The declarative baseline is [GitHub security configuration](security/github-baseline.json); its provider application and verification are recorded in Issue 25. A checked-in JSON file alone does not enforce a provider setting.

*Table Repository controls*

| Control | Observed baseline on 3 October 2026 | Target and disposition |
| --- | --- | --- |
| Default workflow token | Read-only; Actions cannot approve PRs | Retain both restrictions |
| Allowed Actions | All actions allowed; no SHA requirement | Baseline restricts named official Actions and requires immutable SHA references |
| Workflow dependencies | Mutable version tags | Commit-pinned Actions and weekly reviewed Dependabot PRs delivered |
| Checkout credentials | Persisted by default | Disabled in build/test/probe jobs; retained only where current maintenance jobs push |
| Shell inputs | Workflow environment expressions embedded in PowerShell strings | Runtime environment-variable reads delivered, avoiding source-code interpolation |
| Main history | No branch protection/rulesets | Baseline prevents deletion and non-fast-forward updates, with no bypass actors |
| Ingestion history | Tags mutable by repository writers | Baseline prevents changing/deleting existing ingestion tags; new tags remain permitted |
| Required PR/checks | Convention only | Recommended after adapting direct-push maintenance; do not claim enforced review yet |
| Independent approval | Owner operates and merges changes | Add a second trusted reviewer for sensitive paths if independent review is required; self-review is not independence |
| Pages environment | `main` and legacy `gh-pages` branches allowed | Restrict to `main`; keep deployment privileges confined to deploy job |
| Secret scanning | Provider-pattern scanning and push protection enabled | Retain; consider non-provider patterns/validity checks where available |
| Dependency updates | Security updates disabled | Add dependency-update configuration; enable repository alerts/security updates and review resulting PRs |
| Code scanning | Not verified | Recommend CodeQL for JavaScript/TypeScript and workflow checks with minimal read/security-events permissions |
| Account protection | MFA/recovery controls not verified | Verify MFA/passkeys and recovery for repository owner, Supabase and Microsoft; review collaborators/App installations |
| Integration scope | Configured repository/project connection | Verify selected-repository installation scope; no administration-site PAT |
| Operational tokens | Local operator session has broad maintenance authority | Replace with expiring, repository/project-scoped credentials per task; do not reuse them in hosted applications |

The next release-process improvement is to separate generation from publication: a read-only job creates a bounded artifact, a small writer job validates the allowed paths and opens a PR, and protected `main` accepts only required checks plus authorised approval. A dedicated repository-scoped GitHub App can provide this automation without a general owner token. Define how unattended catalogue updates should be approved before enforcing a required-PR rule; otherwise that rule will stop the current updater. Avoid a general Actions/admin bypass, which would defeat the intended boundary.

# Permission granularity and unwanted authority

*Table Permission gaps* records authority the platform grant still conveys beyond the narrow operation. Naming or hiding the extra capability does not remove it.

*Table Permission gaps*

| Grant/boundary | Unwanted authority or exposure | Mitigation and remaining work |
| --- | --- | --- |
| Shared Supabase service role | Combines ingestion, aggregate/owner reads and delivery permissions; any holder can use any granted RPC, including Auth administration | Reduced table/column grants limit routine damage; separate runtime identities/broker needed for component isolation |
| Auth admin/service credential | Can generate owner links or manage Auth accounts, beyond requesting a fixed-recipient challenge | Keep server-only; a holder is trusted to impersonate the owner; isolate challenge service for stronger assurance |
| Project-wide Edge secrets/default credentials | Functions may receive secrets they do not use, including DB connection and Microsoft credentials | No claim of per-function secret isolation; separate projects/services or a restricted broker if that boundary is required |
| Database owner/direct connection | Can bypass runtime grants and alter schema/data | Never expose through administration; retain only release/recovery authority and prefer scoped Management API read-only diagnostics |
| Security-definer RPC | Executes with owner authority beyond caller grants | Fixed SQL, empty search path, explicit EXECUTE allowlist; review every newly granted function |
| GitHub Contents write | Repository content/tag writes cannot be limited to catalogue file paths by that permission alone | Path checks and history rules; move to isolated writer and protected PRs; current writer job remains broad |
| GitHub Actions write | Can dispatch/rerun/cancel workflows beyond a single named action | Removed entirely from administration; use only separate maintenance identities when explicitly needed |
| Job token scope | Every step/action in a write-authorised job shares its effective authority | Read-only jobs reduced; split fetch/convert from mutation jobs to narrow remaining exposure |
| Native deployment integration | Can apply arbitrary code and migrations present in an authorised release | Trust release review and provider identity; integration permission is not a safe subset of SQL operations |
| Mailbox-scoped Application Mail.Send | Restricts sender mailbox, not recipient or permitted message content | Fixed recipient/content policy in workers; compromised credential could send other mail from that mailbox |
| Shared worker token | Authorises both monthly and notification workers, not one named owner command | Private server storage; split worker credentials if independent component compromise must be contained |
| Owner bearer token | Authorises all allowed owner reads/mail operations until expiry/rejection | Narrow operation set, short-lived provider token, no refresh persistence; no per-operation MFA or cryptographic transaction approval |
| Shared Pages origin | Other same-origin code can interact with browser storage/windows despite different paths | Admin CSP reduces loaded code; separate origin is the stronger isolation option |
| Public submission cookie | Caller chooses identity and counts; cookie quota is not a unique-person limit | Treat statistics as voluntary reports; abuse controls and monitoring needed for stronger integrity/availability |
| Public histogram/aggregates | Small cohorts and repeated queries may reveal trends | Explicitly accepted public output; no anonymity or differential-privacy guarantee |
| Audit update rights | Delivery/result status can be changed by trusted service/database operators | Actor/action columns protected from runtime edits; external append-only audit required for tamper evidence |

Scoped [Supabase personal access tokens](https://supabase.com/docs/guides/platform/personal-access-tokens) support project/permission restrictions; legacy tokens inherit user authority. Use the [read-only database-query API](https://supabase.com/docs/reference/api/v1-read-only-query) for investigations and inspect each endpoint's required permission. A database password used for a direct connection is not constrained by a Management API token's scope. [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) explains immutable Action pins and workflow trust, and [repository rules](https://docs.github.com/en/rest/repos/rules) define protection/bypass authorisation.
