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

Prevention of mailbox and credential theft is outside application delivery scope by owner decision. The assessment still models credential possession, impersonation, delegated authority, material impacts and recovery responsibilities. Their prevention, account recovery and general account MFA are provider/account responsibilities, not additional application requirements. The inventory below retains credential locations and authority so that permissions can be reviewed; it does not expand this scope. No additional application second factor is required for the current bounded read and mail operations.

The assessment covers positive authorisation, least privilege and the material damage one compromised application component could cause. Reading private reporting records, destroying or rewriting history, changing deployed code or schema, and unrestricted sending are material effects. A component's available runtime authority remains in scope even when implementing credential-theft prevention belongs to another owner.

Authentication at the executing component and freedom from obscurity are necessary, but **not sufficient to assure containment, even assuming correct implementation**. Shared authority can exceed a component's purpose by design. With trustworthy providers and release inputs and correctly configured grants, the intended interfaces deny unauthorised private access and expose no administration operation that changes the site. That interface guarantee is narrower than containment after arbitrary code execution in a server function.

This release does not establish capability isolation of the administration server from the database. Supabase supplies project-wide privileged runtime credentials. The service role bypasses row-level security, though it still needs SQL object grants; this release reduces those grants. The database connection credential carries broader database authority. Their absence from browser output and the server operation allowlist protect the intended interface; they do not eliminate damage after server compromise. Stronger isolation requires a separately scoped service identity or broker that cannot access the wider provider-injected credentials. [Supabase API-key documentation](https://supabase.com/docs/guides/getting-started/api-keys) describes the service-role boundary.

# Independent change boundary

Irreversible maintenance operations must be available only through the separate GitHub change process and its authorised deployment integration, never through the administration application. This includes destructive schema/data migrations and changes that expand runtime permissions. Catalogue and site releases use the same maintenance boundary even when reversible. Exceptional provider recovery remains separately authorised and recorded; routine operation must not gain a second deployment path.

GitHub applies its account controls and prompts for renewed authentication for selected high-impact web actions, including changing repository rulesets. Its [sudo-mode documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/sudo-mode) does not establish a fresh second-factor check for every push, merge, deployment or authorised API call. The independent barrier here is the absence of GitHub mutation authority from the application, together with repository release controls. A confirmation button or a second request using the same application identity would not supply that independence.

*Table Material impact boundaries* distinguishes restrictions already enforced from the remaining containment work.

*Table Material impact boundaries*

| Entry point | Maximum intended effect | Independent barrier and remaining gap |
| --- | --- | --- |
| Public visitor/reporting API | Read public assets/aggregates and append validated voluntary reports | Private reads and destructive SQL rights denied; fabricated reports and resource abuse still need containment |
| Authenticated administration API | Read bounded private views; send the three named owner-mail requests | Forbidden mutations rejected at the executing API; no GitHub mutation or Management API token; no release trigger |
| Compromised Edge Function runtime | Should remain confined to its own reads and operational writes | Not yet assured: project-wide Auth, database and mail authority can exceed that purpose; runtime separation is a priority |
| Catalogue generation in GitHub | Produce validated catalogue data | Current write-authorised job is too broad; isolate generation from publication before treating it as confined |
| GitHub release and native Supabase integration | Publish code/data and apply reviewed migrations, including destructive changes | Separate from application login; history rules enforced, but mandatory PR checks/review still require implementation |

A Pages environment approval would gate Pages publication only. It would not gate migrations applied by the native Supabase integration. Required checks and change approval must therefore protect the production branch consumed by both release services. Do not claim an independent human approval where the proposer and approver are the same identity. Additional application MFA should be reconsidered only if a future proposal introduces dangerous operations; this policy currently prohibits those operations altogether.

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

# Credential custody by security domain

Every retained credential copy forms part of its domain's security profile. *Table Credential locations* identifies holders; *Table Credential authority* distinguishes store access, extraction, use and modification. The preceding inventory defines their purpose and compromise consequences. Readability includes indirect access through deployed code or a restored copy. Use-only describes the consuming application: it can exercise an existing grant but cannot change its issuer-backed credentials, grant or trust configuration. Those changes require a separately authenticated, user-mediated administrative session outside that application. Non-extractability is a separate property, recorded in the extraction column. Masking a secret proves neither property.

The following records derive from the reviewed browser, mail, worker and setup code and the earlier inventory. They are not a fresh provider-role readback. Provider-internal storage, backup access and exact administrative role assignments remain unverified where stated. Domain administrators are roles requiring verification, not a claim that every account in a domain holds that authority.

*Table Credential locations*

| Custody Id | Credential/copy | Security domain | Holder/store and retention |
| --- | --- | --- | --- |
| C1 | Owner sign-in challenge | Monitoring | Auth service and administration-service memory during generation/verification; issuer expiry |
| C2 | Owner sign-in link | Mail | Exchange message and any mailbox/client/archive copies; retention follows those stores |
| C3 | Captured sign-in challenge | Browser/device | URL fragment until client captures/removes it, then administration-client memory; copied links may survive elsewhere |
| C4 | Owner access token | Browser/device | Administration memory and tab sessionStorage with local expiry; no retained refresh token |
| C5 | Service-role key and injected database credential | Monitoring | Hosted function environment and process memory; retained until provider/configuration rotation |
| C6 | Worker bearer token | Monitoring | Function secret/environment and process memory |
| C7 | Worker bearer token copy | Monitoring | Vault and privileged dispatch execution; must match C6 |
| C8 | Microsoft application secret | Monitoring | Function secret/environment and mail-adapter memory; setup copy is C16 |
| C9 | Graph access token | Monitoring | Mail-adapter memory cache until expiry/replacement; sent to Microsoft over HTTPS |
| C10 | Auth signing material | Monitoring | Provider-managed issuer; internal holders, exportability and backup copies not inspected |
| C11 | Native integration installation authority | Release | GitHub provider-managed installation; underlying proof custody not inspected |
| C12 | Workflow token and Pages OIDC proof | Release | Job/runner environment or issuance channel; job-scoped lifetime |
| C13 | Operator credentials and owner mail/browser sessions | Browser/device | OS credential store and tool/browser sessions; inventory of all copies remains incomplete |
| C14 | Owner Microsoft authentication material | Mail | Identity provider; exact factors and issuer custody not inspected; client copies are C13 |
| C15 | Native integration installation authority copy | Monitoring | Supabase integration provider; retained proof and internal storage not inspected |
| C16 | Microsoft application secret setup copy | Browser/device | Authorised setup process receives generated secret and writes function configuration; memory lifetime and diagnostic/backup copies need review |

*Table Credential authority*

| Custody Id | Locate/access metadata or store | Read/extract material | Use and enforced limits | Modify or replace credential/policy |
| --- | --- | --- | --- | --- |
| C1 | Auth and administration service | Service receives usable challenge; Auth administrators may mint equivalent challenges | Auth verifies one-use proof; administration pins owner identity | Issuer controls challenge lifetime/invalidation; service deployment can alter challenge handling |
| C2 | Mailbox principals and authorised mail clients | Any principal able to read the message can obtain its sign-in proof | Link possession enables verification before use/expiry | Mailbox/message writers can change or delete a copy, but cannot thereby issue a valid replacement; issuer authority is C1 |
| C3 | User/browser and executing same-context code | Client JavaScript can read the fragment and captured memory; same-origin interaction paths require review | Client forwards challenge to fixed verifier; issuer grant changes are separately controlled | Browser code/user can replace local bytes; only issuer can establish accepted replacement authority |
| C4 | Administration tab and same-origin code with access to that tab | Token is readable JavaScript data, not a non-exportable credential | Bearer permits bounded owner operations after server checks | Client removes/replaces local copy; Auth issues sessions; owner configuration/deployment can change acceptance |
| C5 | Hosted runtime; configured project/deployment authorities | Runtime code can read injected values; deployable code creates an indirect extraction path | Data/Auth or direct database authority; SQL restrictions do not prove runtime isolation | Provider/project credential managers rotate proofs; deployment can change consumers; exact role assignments need readback |
| C6 | Hosted runtime and secret configuration authorities | Runtime code reads raw token; extraction and grant modification are separate questions | Bearer invokes allowed workers | Secret managers replace copy; deployment changes checks; coordinated C7 rotation required |
| C7 | Privileged database/Vault administration | Dispatch function obtains decrypted token; trusted database administration can access or change the path | Permitted dispatcher callers invoke constrained work without a token-return API; broader privileged bypasses remain | Privileged database operators change Vault value, dispatcher destination/code or grants |
| C8 | Hosted runtime and Microsoft/setup authorities | Mail adapter and setup process receive secret bytes; deployed code can extract them | Obtains application Graph tokens within issuer/grant constraints | Microsoft application credential managers issue/revoke; function secret managers replace stored copy; Exchange administrators change send scope |
| C9 | Mail runtime | Mail runtime reads cached token; issuer-backed grant modification is separately controlled | Microsoft enforces application mail grant | Issuer creates tokens; runtime replaces cache; application/grant administrators control future issuance and scope |
| C10 | Provider issuer and authorised project controls | Not verified; no claim of non-exportability | Application asks Auth to issue/verify sessions; this is not evidence that issuer keys are use-only | Provider/project key-management authority; exact permissions and recovery paths require readback |
| C11 | Integration providers and installation/configuration administrators | Application has no reader; provider-side extraction/export rules are unknown | Connected repository/project deployment under installation grants | Repository/installation/project authorities configure or revoke trust; release writers can change deployed consumers |
| C12 | Permitted workflow jobs and runner code | Job code can obtain usable token/proof; masking logs does not prevent extraction | Repository job permissions and OIDC relying-party checks constrain use | GitHub issues credentials; authorised workflow/repository/environment administrators alter requesting code or policy |
| C13 | Local OS account and authorised tools | Credential-consuming tools can retrieve usable values; exact OS/account isolation and backup access unverified | Provider verifies scoped maintenance authority | Local account can replace/remove copies; provider credential/account administrators issue/revoke and alter grants |
| C14 | Provider identity controls | Exact read-versus-use boundaries for factors not verified | Identity provider enforces sign-in and account rights | Account recovery/factor administrators and provider controls; possession consequences remain in scope |
| C15 | Monitoring integration/configuration administrators | Provider-side read/export boundaries unknown; no application reader | Backend deployment under connected installation and project trust | Provider/project authorities configure or revoke integration; release writers change deployed consumers |
| C16 | Authorised setup process and local OS account | Setup code receives usable secret bytes and intentionally configures credentials | Writes a credential copy into authorised monitoring configuration | Local process can replace bytes; Microsoft credential managers create/revoke valid secrets; secret managers control destination copy |

Public verification keys, project URLs, owner UUID/email, tenant/application identifiers, sender and allowed-origin settings are configuration rather than secret proof. Their values may be public, but authorised repository/project/issuer administrators control the accepted values. The protected effect depends on this integrity as well as secret custody. Changing a local string does not make a verifier trust it; changing the verifier, trust mapping or release can.

The optional ingest token and former administration GitHub token are not required credentials in the inspected deployment. Any discovered retained copy must receive its own domain/custody record and revocation decision. Exports, support bundles, logs and backups must be checked for additional copies; absence from application output is not proof that provider or operator copies do not exist.

For the native Supabase-to-GitHub integration, the intended use-only consumer is the configured integration, not the installation administrator. The existing connection permits its configured operations. Establishing or changing that connection requires an independently authenticated user-mediated GitHub/Supabase administrative path. Compromising the application must not give it that administrative session or permit it to widen the installation grant. Misuse of existing release permissions remains a separate consequence. The exact provider mutation endpoints, administrative role assignments and alternate credential paths require readback before this intended barrier is recorded as verified. See the explicit [traceability review](TRACEABILITY.md#unexpected-and-indirect-paths).

Credential lifecycle review must cover creation, rotation, expiry, revocation, deletion, policy edits and the administrators able to perform them. [Issue 33](https://github.com/pekka-28/unesco/issues/33) retains effective runtime/deployment isolation work. This custody inventory establishes review scope; unresolved provider readback and recovery paths prevent a verified use-only grant-change barrier or non-extraction assurance claim.

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

The initial repository inspection on 3 October 2026 found no protection on `main` and no repository rulesets. The applied baseline now prevents deletion/non-fast-forward updates to `main` and changes/deletion of ingestion tags. Pull requests and checks remain an operational convention: a credential permitted to push can still bypass review with an ordinary fast-forward update. Do not claim enforced independent review or immutable audit storage. Before treating review as a security boundary, require relevant checks, restrict direct writes and accommodate authorised catalogue automation without granting administration-site access.

Build dependencies, GitHub Actions, browser libraries, the UNESCO source, provider control planes and the maintainer's device are trusted inputs. This release pins Actions to full upstream commit identifiers, disables persisted checkout credentials in read-only jobs and adds weekly Dependabot updates. Lockfiles, tests, dataset validation and restricted workflow permissions reduce mistakes; proposed dependency updates and browser third-party code still require review. No dependency audit or provider certification is implied by this document.

Per-cookie submission limits do not prevent an attacker creating new cookies, generating misleading statistics or exhausting notification resources. The global sign-in throttle can itself delay an owner who requests a link during the reservation interval. The database probe is a best-effort check, not an availability guarantee. Availability and resource-abuse protection require provider quotas/monitoring and, if needed, additional rate controls. These risks remain even with correct authentication code.

# Recovery and verification

If owner credentials are compromised, use separately authenticated provider administration to remove `MWH_ADMIN_USER_ID`, revoke Auth sessions and recover the mailbox. Do not rely solely on clearing browser storage: access-token expiry/revocation semantics are provider-controlled. [Supabase sign-out guidance](https://supabase.com/docs/guides/auth/signout) documents the remaining token lifetime. Rotating a worker credential requires coordinated Secrets/Vault changes; rotating Microsoft credentials requires both Microsoft and Supabase updates. A release compromise also requires reviewing deployed code, migrations, workflow changes and issued credentials before restoring access.

Database recovery uses forward corrective migrations through GitHub and the native integration. A Git revert alone does not reverse an applied database migration. Keep recoverable private backups under appropriate controls and verify restore procedures separately; this review has not proved restoration capability. Any exceptional recovery outside the normal release path requires explicit owner authorisation and recorded evidence.

Release checks must verify private endpoints reject missing/invalid credentials, wrong/unconfirmed users cannot access owner operations, direct database calls lack ordinary-client grants, authenticated owner requests cannot invoke forbidden mutations, GitHub inspection sends only a credential-free GET, and the published page has no mutation controls. Preserve evidence in the issue. Do not put credentials or private row contents in test output.

The remaining hardening decisions are branch protection compatible with catalogue automation, narrower server privileges, stronger browser-origin isolation, unused Auth capabilities, dependency integrity, abuse controls and tested recovery. Prioritise restrictions that prevent one application compromise from causing material damage. Account MFA verification and credential-theft prevention are outside application delivery; possession impacts remain part of this assessment. None of the remaining controls is silently claimed complete. Security defects belong in GitHub Issues; do not publish exploit secrets or private data when reporting them.

# Positive authorisation by operation

*Table Positive authorisations* lists the affirmative grant or validated capability required before each operation. Possession of an identifier, knowledge of a URL or a successful login alone is insufficient. Operation arguments do not select a different repository, recipient, endpoint or SQL statement.

*Table Positive authorisations*

| Operation | Positive authorisation | Least permitted effect |
| --- | --- | --- |
| Request sign-in link | Public challenge policy, service-role EXECUTE on `admin_reserve_login`, Auth-admin credential to generate the link, and Exchange sender authorisation | Fixed owner recipient once per five minutes |
| Verify sign-in | Supabase single-use token verification plus exact configured UUID and confirmed email | Issue owner access token |
| Sign out | Valid owner token at the API and Supabase Auth logout | Revoke the provider session and clear local administration state, subject to token-expiry semantics |
| Read published site/catalogue | Explicit public-publication policy; no person credential | Download only allowlisted public assets/data |
| Read public statistics/histogram | Explicit public aggregate contract; service-role EXECUTE on fixed statistics RPCs | Selected aggregate fields, without private records |
| Edit/export a visitor profile locally | Control of the browser/device and its local profile | Local data only; visitor profile selection/Name is not server authentication |
| Owner database status, schema and entity queries | Valid owner token at owner API; service-role EXECUTE on `admin_read` | Fixed read models; at most 100 entity rows |
| Download query results | Successful authorised read already completed | Export current page in the owner's browser |
| Read workflow status | Valid owner token; public GitHub GET needs no GitHub credential | Fixed repository's latest production runs |
| Send test/monthly mail or retry notifications | Owner token, allowed command, fresh UUID; worker verifies separate bearer credential | Fixed owner mail and delivery-state updates |
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
| Prepare/merge release PR | Separate operator Contents/Pull requests write permissions and release process | Publish reviewed changes through GitHub |
| Alter repository security | Separate repository Administration write permission | Apply/review repository settings; no application runtime grant |
| Inspect Supabase management data | Project-scoped token with `database_read` for read-only SQL, or the relevant endpoint-specific read permission | Use the read-only query endpoint; do not grant database writes or API-key-secret reads for ordinary inspection |
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
| Account protection | GitHub/provider account controls remain separate | Theft prevention and general MFA verification are externally owned; possession consequences remain assessed; retain provider protections without claiming per-operation step-up |
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
| Mailbox-scoped Application Mail.Send | Restricts sender mailbox, not recipient or permitted message content | Fixed recipient/content policy in workers; compromised sending runtime could send other mail from that mailbox |
| Shared worker token | Authorises both monthly and notification workers, not one named owner command | Private server storage; split worker credentials if independent component compromise must be contained |
| Owner bearer token | Authorises all allowed owner reads/mail operations until expiry/rejection | Narrow operation set, short-lived provider token, no refresh persistence; no per-operation MFA or cryptographic transaction approval |
| Shared Pages origin | Other same-origin code can interact with browser storage/windows despite different paths | Admin CSP reduces loaded code; separate origin is the stronger isolation option |
| Public submission cookie | Caller chooses identity and counts; cookie quota is not a unique-person limit | Treat statistics as voluntary reports; abuse controls and monitoring needed for stronger integrity/availability |
| Public histogram/aggregates | Small cohorts and repeated queries may reveal trends | Explicitly accepted public output; no anonymity or differential-privacy guarantee |
| Audit update rights | Delivery/result status can be changed by trusted service/database operators | Actor/action columns protected from runtime edits; external append-only audit required for tamper evidence |

Scoped [Supabase personal access tokens](https://supabase.com/docs/guides/platform/personal-access-tokens) support project/permission restrictions; legacy tokens inherit user authority. Use the [read-only database-query API](https://supabase.com/docs/reference/api/v1-read-only-query) for investigations and inspect each endpoint's required permission. A database password used for a direct connection is not constrained by a Management API token's scope. [GitHub secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) explains immutable Action pins and workflow trust, and [repository rules](https://docs.github.com/en/rest/repos/rules) define protection/bypass authorisation.

# Verified delivery

[PR 26](https://github.com/pekka-28/unesco/pull/26) delivered the policy, removed administration mutation paths and applied migration `202610030002` through the native integration. On 3 October 2026, 49 automated tests passed. Live owner/anonymous checks confirmed all removed mutation commands are rejected, private read models still work and ordinary authenticated users cannot invoke administrative database RPCs. Read-only Management API inspection confirmed destructive table rights, submission edits, notification-name edits, actor edits and schema CREATE are denied while required delivery/status columns remain writable.

The GitHub baseline was applied and read back: only the six named official Actions are allowed, full SHA pinning is required, the main-history and ingestion-tag rulesets are active without bypass actors, and Pages allows only `main`. Default workflow authority remains read-only and workflow PR approval remains disabled. Secret scanning/push protection remain enabled; dependency security updates are now enabled. Mandatory PR checks/independent review are not yet enforced. [Issue 33](https://github.com/pekka-28/unesco/issues/33) tracks the remaining release, identity and runtime-isolation work.

The authorised catalogue updater completed successfully under these restrictions in [run 37076676255](https://github.com/pekka-28/unesco/actions/runs/37076676255). This verifies compatibility of the current workflow with the baseline; it does not prove that repository-wide write permission is path-scoped.

# Audit policy and response

The owner API authenticates every audit query and returns only fixed event fields through `security_audit_read`. Ordinary users cannot call the RPC; the service role has no direct rights on the monitor table. Native Auth events retain provider semantics: an actor field does not necessarily identify the human behind a delegated service operation. Database administrators can alter local audit storage, so independent forensic integrity is not claimed.

Operational monitoring uses a singleton state record and a five-minute delivery lease. A completed or failed attempt limits subsequent mail for one hour. Counts and timestamps, not report content, enter fault mail. An uncertain external acknowledgement can still duplicate mail after a retry. Failures of monitoring do not prevent normal notification delivery.

The owner reviews reported faults within one working day, records material anomalies as Issues, applies corrective changes through the release process and verifies closure. A recovery message reports an observed condition, not completion of investigation. Repeated denials and all runtime errors are not yet centrally detected; platform audit and independent monitoring remain coverage gaps tracked in Issue 36.

Auth events follow configured provider retention; this release does not delete Auth rows or promise an unverified retention period. The monitor retains its current/last-reported state, not an append-only incident history. The administration operation ledger and GitHub Issues provide separate action records. Retention, independent archival, incident acknowledgement and monitoring-failure escalation require explicit follow-up before claiming a complete forensic service.

# Design traceability

[System behaviour](SYSTEM_BEHAVIOUR.md) is the canonical source for use-case message sequences, including authentication and authorisation before protected effects. This policy supplies the authority constraints; the assessment references the design and records evidence, compromise consequences and residual decisions. A normal sequence belongs in the design once. A separate assessment diagram is appropriate only when it describes a distinct attack or counterexample.

The documented controls do not establish completed hardening. Shared runtime authority and release enforcement remain in [Issue 33](https://github.com/pekka-28/unesco/issues/33); audit activation, coverage and fault escalation remain in [Issue 36](https://github.com/pekka-28/unesco/issues/36). Current API restrictions are useful controls, but do not prove containment of arbitrary code running with shared credentials. Browser isolation, recovery and aggregate-disclosure experiments still need evidence or explicit residual-risk decisions before a complete assurance claim.

# Remaining concerns

The [security concerns review](SECURITY_CONCERNS.md) records the visitor rendering correction, remaining exposures and the scope of the administration authentication checks.
