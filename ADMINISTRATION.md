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
| GitHub inspection | Fixed public GET reads workflow status; no credential or mutation operation |
| Production deployment | GitHub workflow permissions and the native Supabase integration authenticate the release services |

Downstream services authenticate a delegated service identity, not the browser user's token. The administration API checks the owner before using that authority. Its service credentials stay in Supabase Secrets. The database grants do not independently identify the owner; they authorise the trusted server. Compromise of a server credential therefore requires credential revocation, regardless of the browser controls.

The sign-in page and link-request operation are intentionally public. Link requests can only generate mail to the fixed owner address and are limited to once every five minutes by a database reservation. They cannot select a recipient or run an administration command. The ordinary pseudonymous usage-submission API also remains intentionally public; it does not grant access to administrative queries or commands.

Supabase generates and verifies the single-use magic link. The browser removes its token from the address bar before processing and stores the resulting access token in session storage until expiry or sign-out. It retains no refresh token. Mailbox access grants owner access. The owner UUID is pinned in server configuration; neither a matching mailbox domain nor client-supplied metadata grants access.

# Operation inventory

*Table Owner operations* maps the manual maintenance operations to published APIs and delivered controls. Provider consoles retain their own authentication; a console link does not itself execute an operation.

*Table Owner operations*

| Operation | Published interface | Administration control |
| --- | --- | --- |
| Refresh UNESCO catalogue | GitHub workflow dispatch | Excluded; GitHub maintenance only |
| Rebuild and publish the website | GitHub workflow dispatch | Excluded; GitHub release only |
| Run the scheduled database probe | GitHub workflow dispatch | Excluded; use the immediate read-only database probe here |
| Check the database immediately | Supabase Data API RPC | Database status/probe |
| Inspect pipeline and deployment status | GitHub Actions REST API | Latest 20 production runs |
| Read workflow logs/artifacts or rerun failed jobs | GitHub Actions REST API | Separate GitHub maintenance; no administration dispatch/rerun |
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
| Run arbitrary SQL or inspect provider logs | Supabase Management API/SQL editor | Excluded from this interface |
| Review/apply schema changes | GitHub pull requests/native Supabase integration | Reviewed migration process |
| Import/correct historical records | Supabase Data/Management APIs | Reviewed maintenance change with reconciliation |
| Change schedules, secrets or deployment configuration | Supabase Management API/GitHub REST API | Provider consoles and reviewed configuration |
| Manage Microsoft mail permissions and credentials | Microsoft Graph/Exchange APIs | Existing restricted administrator setup |
| Track and resolve anomalies | GitHub Issues REST API | Issues link |
| Compact Git history, inspect files, compile and test | Local Git/compiler/test tools | Local development; no hosted API equivalent |

The site permits bounded reads and three named mail commands only. Its API rejects changes to site content, catalogue, database schema, reporting history, accounts, secrets or release configuration. Backend releases proceed through GitHub and the native Supabase integration; GitHub Pages publishes the site. Irreversible maintenance is confined to that separate change process. Mailbox and credential theft are outside the assessment; no additional application second factor is required for the allowed operations. See [Security policy](SECURITY.md) for enforcement, the complete asset inventory and assurance limits. The server environment still carries broad database/Auth authority, so containment after server compromise is not yet assured even though the exposed operations are restricted.

# Queries and action records

Queries return at most 100 rows, ordered consistently and paged by offset. **Profiles** shows the latest activity regardless of age. **Submissions** can include activity, test and synthetic records. UTC date boundaries apply to receipt times and the end is exclusive. Read models omit raw historical payloads and notification lease tokens. Live inserts can shift offset pagination; a download represents the current page, not a transactional backup.

State-changing controls require confirmation and a fresh request ID. **Admin operations** records the actor, command, start time and completion state. Reusing an ID cannot repeat the operation. If a provider accepts work but the response fails, completion remains uncertain. Inspect delivered mail before submitting a new request. Graph acceptance does not prove inbox delivery.

**Admin login gate** reserves the next permitted sign-in email time. It stores no link or session token. [Owner administration maintenance](supabase/migrations/202610030001_owner_administration.sql) creates both operational entities and the bounded read API. Supabase Auth owns administrator accounts separately from pseudonymous reporting **Profiles**.

# Configuration

The native GitHub integration deploys the migration and `owner-admin` function. The existing project URL, service-role credential, notification token and restricted Exchange sender are reused. `MWH_ADMIN_USER_ID` pins the exact Supabase Auth owner UUID; the API also checks the confirmed owner email.

No GitHub credential is required or permitted for this interface. Workflow status uses a public read-only endpoint. The former `MWH_ADMIN_GITHUB_TOKEN` setting and dispatch support are retired; do not configure that token. Existing bookmark or console access does not grant release authority through this application.

Replacing the owner requires an authenticated Supabase administrator to identify the exact Auth account and update `MWH_ADMIN_USER_ID`. Remove that setting to disable all owner API access and revoke the owner's Auth sessions. The API checks the configured UUID on every request; existing access tokens otherwise retain the provider's expiry semantics.

# Validation

Tests cover anonymous and wrong-owner rejection, unconfirmed email rejection, forged origins, link throttling, invalid filters, denied direct database access, confirmation, duplicate operation IDs, uncertain mail completion, forbidden owner mutations and credential-free read-only GitHub inspection. Strict TypeScript checks cover the browser source. Distribution tests ensure no backend source or secrets are published.

Production validation must also check deployed anonymous denial, owner sign-in, read results and operational permissions. Mock tests cannot confirm real email receipt or the user's mailbox session.

# References

The implementation uses the published [Supabase generateLink API](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [Supabase verifyOtp API](https://supabase.com/docs/reference/javascript/auth-verifyotp), [Supabase Management API](https://supabase.com/docs/reference/api/introduction) and [GitHub workflow API](https://docs.github.com/en/rest/actions/workflows). Release instructions are in [GitHub deployment](supabase/GITHUB_DEPLOYMENT.md).
