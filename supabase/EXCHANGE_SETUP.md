<!-- EXCHANGE_SETUP.md -->
# Exchange delivery for Supabase alerts

The Supabase notifier sends new-profile alerts from and to `pekka@data.co.za` through Microsoft Graph. The owner confirmed receipt of the interactive Exchange test on 2 October 2026. The dedicated application credential and mailbox-scoped Exchange authorisation are configured and verified. On 2 October 2026, Exchange accepted both the unattended Supabase delivery test and the new-profile alert from the browser test. The earlier `403 ErrorAccessDenied` has cleared. The owner confirmed inbox receipt of both messages on 2 October 2026.

The owner also confirmed receipt of the monthly delivery check on 2 October 2026. Both mail paths are confirmed working. The temporary delivery-test helper stopped after acceptance; real notification retries run independently inside Supabase. Supabase schedules the combined monthly report at 08:00 Africa/Johannesburg on the first.

# Provider administration

Provider administrators configure this integration through Microsoft Entra, Exchange and Supabase administration systems. The application and repository tooling do not administer those settings. The earlier registration/configuration scripts are historical provisioning material, retained outside the web distribution; do not use them as the current setup or handover procedure. [Service dependencies and configuration](../SERVICE_DEPENDENCIES.md) records the complete setting inventory, mail path and authority boundaries.

Microsoft's published application-RBAC procedure uses Exchange Online PowerShell for service-principal pointers, role assignments and authorisation tests [1]. This document does not claim those operations all have dashboard equivalents. Where a required operation is unavailable in the approved provider administration interface, record that limitation and agree the provider-administrator procedure before proceeding; do not silently fall back to the project's provisioning scripts. Supabase supports managing function secrets through its dashboard [5].

The responsible administrators establish and verify the following:

1. In Microsoft Entra administration, identify the dedicated single-tenant notifier application and record its tenant/application identifiers. Create or replace the application credential through the provider's credential controls. Record expiry and the responsible owner without storing its value in project material.
2. In Exchange administration, establish the corresponding service principal and mailbox-scoped `Application Mail.Send` authorisation for the intended sender. Do not substitute mailbox-reading permissions or an unrestricted tenant-wide sending grant. Verify both allowed sending and exclusion of other mailboxes using the provider's supported administration facilities [1].
3. In Supabase project administration, install the consuming credential and references in function Secrets/settings. The configured sender must agree with the Exchange grant. Changing the application notification recipient is separate from changing its authenticated owner.
4. Maintain the worker token in Supabase Secrets and its matching Vault entry through provider administration. Maintain the trusted worker URL in Vault. The database worker credential is separate from the Microsoft credential; Postgres does not send through Microsoft directly.
5. Verify the integration before revoking a superseded credential. The recorded current credential expires on 2 October 2027 in Africa/Johannesburg; the exact UTC expiry remains in the private registration record. Recheck the provider's current record rather than assuming the historical date remains authoritative.

The *Table Exchange settings* identifies the configured references and their purposes. Actual credential values remain with the providers and their authorised consuming store.

*Table Exchange settings*

| Setting | Purpose and location |
| --- | --- |
| `MWH_MS_TENANT_ID` | Microsoft tenant identifier in Supabase function settings |
| `MWH_MS_CLIENT_ID` | Dedicated notifier application identifier in Supabase function settings |
| `MWH_MS_CLIENT_SECRET` | Microsoft-issued application credential in Supabase Secrets; readable by the mail adapter |
| `MWH_MS_MAIL_FROM` | Sender mailbox in Supabase function settings, with the existing code fallback `pekka@data.co.za` |
| `MWH_NOTIFICATION_TOKEN` | Private worker invocation credential in Supabase Secrets |
| `mwh_notification_token` | Matching worker credential in Supabase Vault, used by SQL dispatchers |
| `mwh_notification_url` | Trusted worker endpoint in Supabase Vault; not a Microsoft endpoint or mail destination |

# Delivery verification

After provider configuration, sign in to the owner administration page and select **Send test email**. This is a permitted operational command, not a configuration operation. Inspect Action history and confirm receipt of **My World Heritage - Supabase delivery test**. The test creates no usage or new-user record. Microsoft Graph acceptance is not proof of inbox receipt [2]. Newly assigned permissions may require propagation before a successful test [1].

The destination mailbox is currently hardcoded in the application handlers, including the test. It is not a Postgres setting. Changing the reporting recipient requires a reviewed source release until the proposed central configuration is implemented. The Microsoft application credential remains server-side; the adapter obtains short-lived Graph access tokens in memory.

# Notification behaviour

The private `monthly-report` Edge Function also uses this Exchange authorisation. Run `supabase/test_monthly_report.sql` in the Supabase dashboard SQL editor to send one monthly delivery check. It includes the regular previous calendar month in Africa/Johannesburg and a separately labelled current-month snapshot for verification. It reads aggregate statistics only and creates no new-user event. Re-running sends another message. The monthly cron job runs inside Supabase. The report combines user activity with catalogue changes derived from GitHub history.

The first accepted report from a previously unseen profile creates one durable queue item in the same transaction. Any first event type qualifies. Existing profiles at migration time produce no retrospective alerts. The Edge Function begins delivery immediately after acceptance without delaying the browser acknowledgement.

Supabase Cron checks pending work each minute. Failed deliveries back off, and a five-minute lease prevents another worker claiming the same item during delivery. Sent Items retains a copy. If Exchange accepts the message but the acknowledgement is lost, a retry can send a duplicate; the tracing header does not provide exactly-once delivery. Microsoft application authentication uses the client-credentials flow [3].

GitHub is not involved in immediate alert delivery. The monthly and catalogue reports retain their separate workflows. Supabase's built-in Auth sender does not provide a general application-mail relay [4].

# References

1. [Role Based Access Control for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac), Microsoft, accessed 3 October 2026.
2. [User: sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail), Microsoft, recorded 2 October 2026.
3. [Get access without a user](https://learn.microsoft.com/en-us/graph/auth-v2-service), Microsoft, recorded 2 October 2026.
4. [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), Supabase, recorded 2 October 2026.
5. [Environment variables](https://supabase.com/docs/guides/functions/secrets), Supabase, accessed 3 October 2026.
