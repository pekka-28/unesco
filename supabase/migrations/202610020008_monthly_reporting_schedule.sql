-- Owner requested monthly reporting; Exchange delivery was confirmed on 2 October 2026.
create function public.dispatch_monthly_report() returns bigint
language plpgsql security definer set search_path = '' as $$
declare endpoint text; credential text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='mwh_notification_url';
  select decrypted_secret into credential from vault.decrypted_secrets where name='mwh_notification_token';
  if endpoint is null or credential is null then raise exception 'Monthly reporting credentials are not configured'; end if;
  endpoint := regexp_replace(endpoint, '/new-profile-notifications/?$', '/monthly-report');
  if endpoint not like '%/functions/v1/monthly-report' then raise exception 'Unexpected notification endpoint'; end if;
  return net.http_post(url := endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || credential),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
end $$;
revoke all on function public.dispatch_monthly_report() from public, anon, authenticated, service_role;
-- pg_cron uses UTC: 06:00 UTC is 08:00 Africa/Johannesburg.
select cron.schedule('mwh-monthly-report', '0 6 1 * *', 'select public.dispatch_monthly_report()');
