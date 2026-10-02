-- Supabase defaults can leave TRUNCATE/TRIGGER/REFERENCES after narrower GRANTs.
-- Revoke first, then grant only operations required by current handlers/RPCs.
revoke all on table public.usage_submissions, public.known_usage_profiles,
  public.new_profile_notifications, public.admin_operations, public.admin_login_gate
  from public, anon, authenticated, service_role;

grant select on public.usage_submissions to service_role;
grant insert (submission_id, submitted_at, magic_cookie, use_count, visited_count,
  event_type, client_version, payload, name) on public.usage_submissions to service_role;

-- The postgres-owned ingestion trigger alone registers profiles/notifications.
-- Workers can lease and finish existing notifications, not create/delete them.
grant select on public.new_profile_notifications to service_role;
grant update (lease_token, lease_until, attempts, sent_at, last_error, available_at)
  on public.new_profile_notifications to service_role;

grant select on public.admin_operations to service_role;
grant insert (id, actor, action) on public.admin_operations to service_role;
grant update (status, finished_at) on public.admin_operations to service_role;

-- The login gate and Profiles are accessible only through fixed definer code.
revoke all on function public.enqueue_new_profile_notification() from service_role;
revoke create on schema public from public, anon, authenticated, service_role;

-- Future postgres-owned application objects require explicit runtime grants.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
-- PostgreSQL's built-in PUBLIC EXECUTE is global; a schema-local REVOKE
-- cannot subtract it. Explicit per-schema provider grants remain unchanged.
alter default privileges for role postgres revoke execute on functions from public;
