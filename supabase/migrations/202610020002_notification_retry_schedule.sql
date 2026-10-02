create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Only postgres-owned scheduled work can read the worker credential from Vault.
create function public.dispatch_new_profile_notifications() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  endpoint text;
  credential text;
begin
  if not exists (select 1 from public.new_profile_notifications
      where sent_at is null and available_at <= now()
        and (lease_until is null or lease_until < now())) then
    return null;
  end if;
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'mwh_notification_url';
  select decrypted_secret into credential from vault.decrypted_secrets where name = 'mwh_notification_token';
  if endpoint is null or credential is null then return null; end if;
  return net.http_post(url := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || credential),
    body := '{}'::jsonb, timeout_milliseconds := 10000);
end $$;
revoke all on function public.dispatch_new_profile_notifications() from public, anon, authenticated, service_role;
select cron.schedule('mwh-new-profile-retry', '* * * * *', 'select public.dispatch_new_profile_notifications()');
