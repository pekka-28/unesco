-- Preserve historical test/noise reports without inflating normal activity totals.
alter table public.usage_submissions
  add column record_class text not null default 'activity'
    check (record_class in ('activity', 'test', 'synthetic')),
  add column legacy_source text;

-- Blank historical diagnostic counts mean unknown, not zero. Production reports
-- remain required to carry both counts and the public API validates them.
alter table public.usage_submissions alter column use_count drop not null;
alter table public.usage_submissions alter column visited_count drop not null;
alter table public.usage_submissions add constraint usage_activity_counts_required
  check (record_class <> 'activity' or (use_count is not null and visited_count is not null));

-- 'patch' is a historical synthetic event. The public ingest API still accepts
-- only adoption/manual/periodic and does not allow clients to set record_class.
alter table public.usage_submissions drop constraint usage_submissions_event_type_check;
alter table public.usage_submissions add constraint usage_submissions_event_type_check
  check (event_type in ('adoption', 'manual', 'periodic', 'patch'));

create or replace function public.usage_stats(start_at timestamptz, end_at timestamptz)
returns jsonb language sql stable set search_path = '' as $$
  with period as (
    select * from public.usage_submissions
    where received_at >= start_at and received_at < end_at and record_class = 'activity'
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
-- CREATE OR REPLACE retains the existing restricted execute grants.
