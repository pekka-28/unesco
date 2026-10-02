<!-- ADMINISTRATION.md -->
# My World Heritage administration

3 October 2026

The administration site implements the owner operations defined in [Requirements](Requirements.md). [Issue 23](https://github.com/pekka-28/unesco/issues/23) tracks delivery. Open [Administration](https://pekka-28.github.io/unesco/admin/) and request a sign-in link. Exchange sends it only to `pekka@data.co.za`; click **Continue with this sign-in link** on arrival.

# Authentication at each boundary

The design assumes that an attacker knows every URL, schema, operation name and source file. Hidden controls, CORS, unlisted URLs and repository visibility provide no authority. Each component performing an operation checks the credential of its immediate caller. *Table Authentication boundaries* identifies those checks and the delegated identities.

*Table Authentication boundaries*

| Component | Required identity or authority |
| --- | --- |
| Owner administration API | Supabase Auth validates the access token; the API compares the user ID with the configured owner UUID and checks the confirmed owner email |
| Database read RPCs and administration tables | PostgREST validates the server credential; PostgreSQL grants allow only the service role, with no ordinary authenticated or anonymous access |
| Notification and monthly-report functions | Each function checks its worker bearer credential before querying data or requesting mail |
| Exchange sender | Microsoft validates the notifier application credential; Exchange restricts its send permission to the owner mailbox |
| GitHub workflow dispatch | GitHub validates the repository Actions credential and its permission to dispatch the named workflow |
| Production deployment | GitHub workflow permissions and the native Supabase integration authenticate the release services |

Downstream services authenticate a delegated service identity, not the browser user's token. The administration API checks the owner before using that authority. Its service credentials stay in Supabase Secrets. The database grants do not independently identify the owner; they authorise the trusted server. Compromise of a server credential therefore requires credential revocation, regardless of the browser controls.

The sign-in page and link-request operation are intentionally public. Link requests can only generate mail to the fixed owner address and are limited to once every five minutes by a database reservation. They cannot select a recipient or run an administration command. The ordinary pseudonymous usage-submission API also remains intentionally public; it does not grant access to administrative queries or commands.

Supabase generates and verifies the single-use magic link. The browser removes its token from the address bar before processing and stores the resulting access token in session storage until expiry or sign-out. It retains no refresh token. Mailbox access grants owner access. The owner UUID is pinned in server configuration; neither a matching mailbox domain nor client-supplied metadata grants access.

# Operation inventory

*Table Owner operations* maps the manual maintenance operations to published APIs and delivered controls. Provider consoles retain their own authentication; a console link does not itself execute an operation.

*Table Owner operations*

| Operation | Published interface | Administration control |
| --- | --- | --- |
| Refresh UNESCO catalogue | GitHub workflow dispatch | Refresh catalogue on `main` |
| Rebuild and publish the website | GitHub workflow dispatch | Publish site on `main` |
| Run the scheduled database probe | GitHub workflow dispatch | Run scheduled probe |
| Check the database immediately | Supabase Data API RPC | Database status/probe |
| Inspect pipeline and deployment status | GitHub Actions REST API | Latest 20 production runs |
| Read workflow logs, artifacts and rerun failed jobs | GitHub Actions REST API | Workflow console link |
| Query Profiles and latest activity | Supabase Data API RPC | Profiles query |
| Query a record in Submissions | Supabase Data API RPC | Query by profile, class and UTC receipt dates |
| Inspect Notifications and leases | Supabase Data API RPC | Notifications query |
| Query schema columns | Supabase Data API RPC | Schema columns query |
| Inspect applied migrations and schedules | Supabase Data API RPC | Database status |
| Inspect database size and latest receipt | Supabase Data API RPC | Database status |
| Export selected records | Authenticated query result | Download current results as JSON |
| Retry pending notification delivery | Notification Edge Function | Retry pending notifications |
| Test unattended Exchange delivery | Notification Edge Function | Send test email |
| Send the monthly report and current-month check | Monthly-report Edge Function | Send monthly report check |
| Investigate manual operations | Supabase Data API | Action history |
| Run arbitrary SQL and inspect provider logs | Supabase Management API/SQL editor | Authenticated provider console links |
| Review/apply schema changes | GitHub pull requests/native Supabase integration | Reviewed migration process |
| Import/correct historical records | Supabase Data/Management APIs | Reviewed maintenance change with reconciliation |
| Change schedules, secrets or deployment configuration | Supabase Management API/GitHub REST API | Provider consoles and reviewed configuration |
| Manage Microsoft mail permissions and credentials | Microsoft Graph/Exchange APIs | Existing restricted administrator setup |
| Track and resolve anomalies | GitHub Issues REST API | Issues link |
| Compact Git history, inspect files, compile and test | Local Git/compiler/test tools | Local development; no hosted API equivalent |

The site exposes named operational commands rather than a general shell. Destructive SQL, permission grants, secret rotation, forced Git changes and migration repair remain reviewed maintenance work. Routine administration credentials do not authorise those operations.

# Queries and action records

Queries return at most 100 rows, ordered consistently and paged by offset. **Profiles** shows the latest activity regardless of age. **Submissions** can include activity, test and synthetic records. UTC date boundaries apply to receipt times and the end is exclusive. Read models omit raw historical payloads and notification lease tokens. Live inserts can shift offset pagination; a download represents the current page, not a transactional backup.

State-changing controls require confirmation and a fresh request ID. **Admin operations** records the actor, command, start time and completion state. Reusing an ID cannot repeat the operation. If a provider accepts work but the response fails, completion remains uncertain. Inspect workflow status or delivered mail before submitting a new request. Successful dispatch or Graph acceptance does not prove downstream completion.

**Admin login gate** reserves the next permitted sign-in email time. It stores no link or session token. [Owner administration maintenance](supabase/migrations/202610030001_owner_administration.sql) creates both operational entities and the bounded read API. Supabase Auth owns administrator accounts separately from pseudonymous reporting **Profiles**.

# Configuration

The native GitHub integration deploys the migration and `owner-admin` function. The existing project URL, service-role credential, notification token and restricted Exchange sender are reused. *Table Administration configuration* lists the additional server settings; neither belongs in browser storage or Git.

*Table Administration configuration*

| Setting | Purpose |
| --- | --- |
| `MWH_ADMIN_USER_ID` | Exact Supabase Auth owner UUID, also checked against the confirmed owner email |
| `MWH_ADMIN_GITHUB_TOKEN` | Fine-grained GitHub credential restricted to `pekka-28/unesco` with Actions read/write |

The deployment integration does not expose its GitHub App credential to Edge Functions. Enable the three workflow controls by creating a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new), selecting only `pekka-28/unesco`, granting repository **Actions: read and write**, and setting an expiry. Save it as `MWH_ADMIN_GITHUB_TOKEN` in [Edge Function secrets](https://supabase.com/dashboard/project/fjqhgcegnphavatrchjb/functions/secrets). Do not grant Contents write, Administration or access to other repositories. Do not paste the token into chat. Without this setting, dispatch is denied; workflow status and owner database/mail controls still work.

Replacing the owner requires an authenticated Supabase administrator to identify the exact Auth account and update `MWH_ADMIN_USER_ID`. Remove that setting to disable all owner API access and revoke the owner's Auth sessions. The API checks the configured UUID on every request; existing access tokens otherwise retain the provider's expiry semantics.

# Validation

Tests cover anonymous and wrong-owner rejection, unconfirmed email rejection, forged origins, link throttling, invalid filters, denied direct database access, confirmation, duplicate operation IDs, uncertain mail completion and missing GitHub permission. Strict TypeScript checks cover the browser source. Distribution tests ensure no backend source or secrets are published.

Production validation must also check deployed anonymous denial, owner sign-in, read results and operational permissions. Mock tests cannot confirm real email receipt or the user's mailbox session.

# References

The implementation uses the published [Supabase generateLink API](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [Supabase verifyOtp API](https://supabase.com/docs/reference/javascript/auth-verifyotp), [Supabase Management API](https://supabase.com/docs/reference/api/introduction) and [GitHub workflow API](https://docs.github.com/en/rest/actions/workflows). Release instructions are in [GitHub deployment](supabase/GITHUB_DEPLOYMENT.md).
