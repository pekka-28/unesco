<!-- SECURITY_CONCERNS.md -->
# My World Heritage remaining security concerns

3 October 2026

This review accompanies the [security policy](SECURITY.md), [architecture](ARCHITECTURE.md) and [implementation traceability](TRACEABILITY.md). It separates delivered feature maturity from security assurance. The application provides substantial value with a frozen feature set; remedial security work remains.

# Administration access

The administration HTML and source are public. The `owner-admin` function verifies a bearer token through Supabase Auth and checks the configured owner account Id, confirmed email and fixed owner address before every protected query or command. The browser does not grant authority. Public login and verification routes are necessary exceptions: login sends only to the fixed owner with throttling; verification exchanges a valid one-use proof and checks the owner. CORS is not authentication.

Source inspection and ten live negative checks on 3 October 2026 found that missing and invalid bearer tokens were denied for queries, workflow inspection and all three mail commands before effects. Ten automated tests also passed, covering wrong-owner and unconfirmed accounts, bounded queries, command deduplication and denial of release operations. No unauthenticated administration privilege bypass was demonstrated. These checks are not an exhaustive penetration test.

# Confirmed rendering defect

[Issue 54](https://github.com/pekka-28/unesco/issues/54) tracks unescaped visitor detail rendering in `site/src/app.ts`, including visit notes inserted into HTML text and attributes. An isolated browser reproduction using the actual renderer and a synthetic note executed an inert DOM marker. Network access was blocked and no production record or credential was used.

A malicious imported profile can supply note content; the victim must import it and display the affected detail. Script execution can expose or alter visitor data accessible to that page. No administration session compromise was demonstrated. Other catalogue text, link and attribute insertions require review as part of the same correction. Replace unsafe interpolation with text nodes and validated attributes, and add regression tests for the affected input paths. This is a confirmed remedial priority, not merely a hypothetical concern inferred from public source.

# Remaining exposures and verification

The *Table Remaining concerns* records conditions and consequences without treating untested paths as demonstrated exploits.

*Table Remaining concerns*

| Concern | Conditions and impact | Remaining action |
|---|---|---|
| Shared visitor and administration origin | Paths do not isolate scripts. Visitor script execution can create additional exposure under browser window and storage rules; session storage is tab-scoped, so access to every owner session is not established. | Fix Issue 54 and assess separate administration hosting under [Issue 33](https://github.com/pekka-28/unesco/issues/33). |
| Hosted runtime authority | A server-function compromise could use broader provider-injected project credentials than the named application operations require. An API allowlist does not contain arbitrary server execution. | Complete runtime isolation and grant review in Issue 33. |
| Release authority | Repository writers and deployment integrations can change executable code and migrations. Account MFA is not renewed for every authorised API action. | Verify branch protection, independent review and automation permissions; retain the absence of deployment authority from administration. |
| Unverified public reports | Reporting profiles do not prove unique people. An attacker could submit invented profiles or counts and potentially amplify owner notifications or resource use. | Assess global quotas and abuse monitoring without interpreting profile counts as verified users. No load attack was performed. |
| Public sign-in requests | Requests can consume the fixed owner's rate-limited mail opportunity, without acquiring private data or a session. | Monitor abuse and review throttling. A timing disclosure of private mailbox activity has not been demonstrated. |
| Aggregate disclosure | Always-visible distribution, dynamic bounds and successive summaries can reveal changes to a small population. Wider bounds reduce precision but retain the same qualitative information. | Retain the documented owner acceptance; evaluate joint outputs and repeated observations as collection grows. Aggregation alone does not guarantee anonymity. |
| Audit coverage | Selected stored events and health checks do not establish complete logging, retention, independent alerting or tamper resistance. | Complete [Issue 36](https://github.com/pekka-28/unesco/issues/36), including current provider configuration readback and failure propagation. This review did not reverify every provider logging setting. |
| Local files and reporting destination | Imported profiles, local browser data, exported results and an overridden reporting endpoint cross separate trust boundaries. Exports retain information beyond the application's control. | Keep these interfaces in the security inventory; validate untrusted content and ensure destination changes remain explicit. |
| Mail acknowledgement | A timeout can leave delivery uncertain. Repeating with a new operation Id can duplicate a message. | Inspect the action ledger before retries; preserve deduplication and uncertain-delivery handling. |
| Integration credentials | The intended use-only GitHub integration boundary relies on provider enforcement of user-mediated reconfiguration. Application code cannot establish the provider's full administrative policy. | Retain credential custody and modification authority in the inventory; verify provider configuration and revocation procedures. |
| Recovery and dependencies | This review does not establish successful disaster recovery, complete dependency safety or safe handling of every catalogue URL and renderer. | Exercise restoration and review dependency and remaining input paths before claiming those assurances. |

# Review outcome

Inspection found an actionable visitor rendering defect. Public knowledge of URLs and operation names did not bypass the checked administration boundary, but it would be incorrect to state that the site has no exploitable paths. Correct Issue 54 before treating security remediation as complete. The broader runtime, release and audit work remains separate from that implementation defect.

Credential or mailbox theft prevention remains outside application delivery scope by owner decision. Possession of those credentials, delegated authority and resulting impacts remain within the assessment; exclusion of prevention does not erase their consequences.
