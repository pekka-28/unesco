-- Run the monitor even when no first-profile notification is pending.
create or replace function public.dispatch_new_profile_notifications() returns bigint
language plpgsql security definer set search_path = '' as $$
declare endpoint text; credential text;
begin
  if not exists (select 1 from public.new_profile_notifications
      where sent_at is null and available_at <= now()
        and (lease_until is null or lease_until < now()))
    and exists (select 1 from public.security_monitor_state
      where singleton and checked_at > now()-interval '5 minutes') then
    return null;
  end if;
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='mwh_notification_url';
  select decrypted_secret into credential from vault.decrypted_secrets where name='mwh_notification_token';
  if endpoint is null or credential is null then raise exception 'Notification dispatcher configuration unavailable'; end if;
  return net.http_post(url := endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),
    body := '{}'::jsonb,timeout_milliseconds := 10000);
end $$;
revoke all on function public.dispatch_new_profile_notifications() from public,anon,authenticated,service_role;
