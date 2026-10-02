-- Browser clients have no direct table or RPC access. The Edge Function holds
-- the service role key and validates the public, pseudonymous submission API.
create table public.usage_submissions (
  submission_id text primary key,
  received_at timestamptz not null default now(),
  submitted_at timestamptz not null,
  magic_cookie text not null,
  use_count integer not null check (use_count >= 0),
  visited_count integer not null check (visited_count >= 0),
  event_type text not null check (event_type in ('adoption', 'manual', 'periodic')),
  client_version text not null,
  payload jsonb not null
);
create index usage_submissions_cookie_time on public.usage_submissions (magic_cookie, received_at desc);
create index usage_submissions_time on public.usage_submissions (received_at);
alter table public.usage_submissions enable row level security;
revoke all on public.usage_submissions from anon, authenticated;
grant select, insert on public.usage_submissions to service_role;

create function public.accept_usage(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  existing jsonb;
begin
  -- Serialize submissions for this cookie; failures roll back both the insert
  -- and rate-limit accounting. A duplicate is checked before rate limiting.
  perform pg_advisory_xact_lock(hashtextextended(p->>'magic_cookie', 0));
  select payload into existing from public.usage_submissions
    where submission_id = p->>'submission_id';
  if found then
    if existing <> p then raise exception 'Submission ID reused with different content'; end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'submission_id', p->>'submission_id');
  end if;
  if exists (select 1 from public.usage_submissions where magic_cookie = p->>'magic_cookie'
      and received_at > now() - interval '30 seconds')
    or (select count(*) from public.usage_submissions where magic_cookie = p->>'magic_cookie'
      and received_at > now() - interval '1 hour') >= 12 then
    raise exception 'Rate limited';
  end if;
  insert into public.usage_submissions
    (submission_id, submitted_at, magic_cookie, use_count, visited_count, event_type, client_version, payload)
  values (p->>'submission_id', (p->>'submitted_at_utc')::timestamptz, p->>'magic_cookie',
    (p->>'use_count_since_last_push')::integer, (p->>'visited_site_count')::integer,
    p->>'event_type', p->>'client_version', p);
  return jsonb_build_object('ok', true, 'duplicate', false, 'submission_id', p->>'submission_id');
end $$;

create function public.usage_stats(start_at timestamptz, end_at timestamptz)
returns jsonb language sql stable set search_path = '' as $$
  with period as (
    select * from public.usage_submissions where received_at >= start_at and received_at < end_at
  ), latest as (
    select distinct on (magic_cookie) visited_count from period order by magic_cookie, received_at desc
  ) select jsonb_build_object(
    'submissions', (select count(*) from period),
    'active_datasets', (select count(*) from latest),
    'average_visited_sites', (select coalesce(avg(visited_count), 0) from latest),
    'reported_uses', (select coalesce(sum(use_count) filter (where event_type <> 'adoption'), 0) from period),
    'adoption', (select count(*) from period where event_type = 'adoption'),
    'manual', (select count(*) from period where event_type = 'manual'),
    'periodic', (select count(*) from period where event_type = 'periodic')
  );
$$;
revoke all on function public.accept_usage(jsonb) from public, anon, authenticated;
revoke all on function public.usage_stats(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.accept_usage(jsonb) to service_role;
grant execute on function public.usage_stats(timestamptz, timestamptz) to service_role;
