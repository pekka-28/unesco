-- Sends one owner report through Supabase/Exchange, with a current-month check.
-- No usage or new-profile rows are created. Re-running sends another email.
select net.http_post(
  url := 'https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/monthly-report',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mwh_notification_token'),
    'x-mwh-report-test', 'true'),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
) as request_id;
