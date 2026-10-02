-- Administrative delivery test. Uses the same deployed sender as real alerts.
-- This sends one test email to the configured owner; it creates no usage record.
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'mwh_notification_url'),
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mwh_notification_token'),
    'x-mwh-delivery-test', 'true'),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
) as request_id;
