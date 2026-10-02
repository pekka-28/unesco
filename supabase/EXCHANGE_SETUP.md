<!-- EXCHANGE_SETUP.md -->
# Exchange delivery for Supabase alerts

The Supabase notifier sends new-profile alerts from and to `pekka@data.co.za` through Microsoft Graph. The owner confirmed receipt of the interactive Exchange test on 2 October 2026. The dedicated application credential and mailbox-scoped Exchange authorisation are configured and verified. On 2 October 2026, Exchange accepted both the unattended Supabase delivery test and the new-profile alert from the browser test. The earlier `403 ErrorAccessDenied` has cleared. The owner confirmed inbox receipt of both messages on 2 October 2026.

The owner also confirmed receipt of the monthly delivery check on 2 October 2026. Both mail paths are confirmed working. The temporary delivery-test helper stopped after acceptance; real notification retries run independently inside Supabase. Supabase schedules the combined monthly report at 08:00 Africa/Johannesburg on the first.

# Administrator setup

Run the prepared script from the repository in an interactive PowerShell window:

```powershell
./scripts/authorise_exchange_notifier.ps1
```

Sign in with an administrator who can register Microsoft Entra applications and assign Exchange application roles. The script creates a dedicated single-tenant application and Exchange service principal, limits `Application Mail.Send` to `pekka@data.co.za`, verifies the scope, and places the application credential in Supabase Secrets. It does not request mailbox-reading permissions or a tenant-wide Entra `Mail.Send` grant. Exchange application RBAC provides the mailbox restriction [1].

Registration and Exchange permission assignment run in separate PowerShell processes because the installed modules use conflicting authentication-library versions. If registration succeeds but Exchange permission assignment fails, resume only that phase with `./scripts/authorise_exchange_notifier.ps1 -Phase Grant`; this avoids creating another credential.

The script needs `Application.ReadWrite.All` for the administrator's interactive registration session. That permission belongs to the setup session, not to the deployed notifier. The notifier uses only its own application credential and scoped Exchange permission. The current application's credential expires on 2 October 2027 in Africa/Johannesburg; the exact UTC expiry is recorded locally with the registration IDs.

If an administrator prepares the application separately, enter its IDs and secret through the local hidden prompt:

```powershell
./scripts/configure_supabase_mail.ps1
```

Do not enter the mailbox password. *Table Exchange settings* lists the required Supabase settings. The automatic setup script creates a credential valid for one year and records its expiry in `.local/exchange-authorisation-result.json`; rotate it before expiry. Rerunning setup creates a replacement credential without deleting existing ones. An administrator can remove superseded credentials after verification.

*Table Exchange settings*

| Setting | Purpose |
| --- | --- |
| `MWH_MS_TENANT_ID` | Microsoft tenant containing the mailbox |
| `MWH_MS_CLIENT_ID` | Dedicated notifier application ID |
| `MWH_MS_CLIENT_SECRET` | Application credential held only in Supabase Secrets |
| `MWH_MS_MAIL_FROM` | Sender mailbox, defaulting to `pekka@data.co.za` |
| `MWH_NOTIFICATION_TOKEN` | Separate private worker credential, mirrored in Supabase Vault |

# Delivery verification

After authorisation, request one test through the deployed Supabase function:

```powershell
npx.cmd --yes supabase db query --linked --file supabase/test_notification_delivery.sql
```

The command returns a request ID. Inspect its HTTP result in `net._http_response`, then confirm receipt of **My World Heritage - Supabase delivery test**. This route uses the same sender as real alerts but creates no usage or new-profile record. A Graph `202` response confirms acceptance, not inbox delivery [2]. Newly assigned Exchange permissions can take time to propagate [1].

# Notification behaviour

The private `monthly-report` Edge Function also uses this Exchange authorisation. Run `supabase/test_monthly_report.sql` in the Supabase dashboard SQL editor to send one monthly delivery check. It includes the regular previous calendar month in Africa/Johannesburg and a separately labelled current-month snapshot for verification. It reads aggregate statistics only and creates no new-user event. Re-running sends another message. The monthly cron job runs inside Supabase. The report combines user activity with catalogue changes derived from GitHub history.

The first accepted report from a previously unseen profile creates one durable queue item in the same transaction. Any first event type qualifies. Existing profiles at migration time produce no retrospective alerts. The Edge Function begins delivery immediately after acceptance without delaying the browser acknowledgement.

Supabase Cron checks pending work each minute. Failed deliveries back off, and a five-minute lease prevents another worker claiming the same item during delivery. Sent Items retains a copy. If Exchange accepts the message but the acknowledgement is lost, a retry can send a duplicate; the tracing header does not provide exactly-once delivery. Microsoft application authentication uses the client-credentials flow [3].

GitHub is not involved in immediate alert delivery. The monthly and catalogue reports retain their separate workflows. Supabase's built-in Auth sender does not provide a general application-mail relay [4].

# References

Sources for this configuration are:

1. Role Based Access Control for Applications in Exchange Online (Exchange application RBAC), https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac, Microsoft, 2 October 2026.
2. User sendMail (Graph sendMail), https://learn.microsoft.com/en-us/graph/api/user-sendmail, Microsoft, 2 October 2026.
3. Get access without a user (Graph application authentication), https://learn.microsoft.com/en-us/graph/auth-v2-service, Microsoft, 2 October 2026.
4. Send emails with custom SMTP (Supabase Auth email), https://supabase.com/docs/guides/auth/auth-smtp, Supabase, 2 October 2026.
