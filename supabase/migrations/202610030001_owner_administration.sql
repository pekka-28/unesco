-- Owner administration: bounded read models and a durable operation ledger.
create table public.admin_operations (
  id uuid primary key,
  actor uuid not null,
  action text not null,
  requested_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'started' check (status in ('started','succeeded','uncertain'))
);
create table public.admin_login_gate (
  singleton boolean primary key default true check (singleton),
  next_allowed_at timestamptz not null
);
alter table public.admin_operations enable row level security;
alter table public.admin_login_gate enable row level security;
revoke all on public.admin_operations, public.admin_login_gate from public, anon, authenticated;
grant select, insert, update on public.admin_operations to service_role;

create function public.admin_reserve_login() returns boolean
language plpgsql security definer set search_path = '' as $$
declare reserved boolean;
begin
  insert into public.admin_login_gate values (true, now() + interval '5 minutes')
  on conflict (singleton) do update set next_allowed_at = excluded.next_allowed_at
  where public.admin_login_gate.next_allowed_at <= now()
  returning true into reserved;
  return coalesce(reserved, false);
end $$;

create function public.admin_read(p_entity text, p_offset integer default 0,
  p_profile text default null, p_class text default null,
  p_from timestamptz default null, p_until timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_offset < 0 or p_offset > 100000 then raise exception 'Invalid offset'; end if;
  if p_class is not null and p_class not in ('activity','test','synthetic') then raise exception 'Invalid class'; end if;
  if p_entity = 'submissions' then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]') into result from (
      select submission_id, received_at, submitted_at, magic_cookie, name, event_type,
        visited_count, use_count, client_version, record_class, legacy_source
      from public.usage_submissions
      where (p_profile is null or magic_cookie = p_profile)
        and (p_class is null or record_class = p_class)
        and (p_from is null or received_at >= p_from) and (p_until is null or received_at < p_until)
      order by received_at desc, submission_id limit 100 offset p_offset
    ) r;
  elsif p_entity = 'profiles' then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]') into result from (
      select p.magic_cookie, p.name, p.first_received_at,
        s.received_at as last_received_at, s.visited_count, s.event_type
      from public.known_usage_profiles p left join lateral (
        select received_at, visited_count, event_type from public.usage_submissions
        where magic_cookie = p.magic_cookie and record_class = 'activity'
        order by received_at desc, submission_id desc limit 1
      ) s on true
      where (p_profile is null or p.magic_cookie = p_profile)
      order by p.first_received_at desc, p.magic_cookie limit 100 offset p_offset
    ) r;
  elsif p_entity = 'notifications' then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]') into result from (
      select id, magic_cookie, submission_id, name, first_received_at, event_type,
        visited_count, attempts, available_at, lease_until, sent_at,
        case when sent_at is not null then 'sent' when lease_until > now() then 'leased' else 'pending' end as status
      from public.new_profile_notifications where p_profile is null or magic_cookie = p_profile
      order by first_received_at desc, id limit 100 offset p_offset
    ) r;
  elsif p_entity = 'operations' then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]') into result from (
      select * from public.admin_operations order by requested_at desc, id limit 100 offset p_offset
    ) r;
  elsif p_entity = 'schema' then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]') into result from (
      select table_name, column_name, data_type, is_nullable from information_schema.columns
      where table_schema = 'public' and table_name in
        ('usage_submissions','known_usage_profiles','new_profile_notifications','admin_operations')
      order by table_name, ordinal_position
    ) r;
  elsif p_entity = 'status' then
    select jsonb_build_object('checked_at', now(), 'database_size', pg_size_pretty(pg_database_size(current_database())),
      'submissions', (select count(*) from public.usage_submissions),
      'profiles', (select count(*) from public.known_usage_profiles),
      'pending_notifications', (select count(*) from public.new_profile_notifications where sent_at is null),
      'latest_submission', (select max(received_at) from public.usage_submissions),
      'schedules', (select coalesce(jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'active',active)), '[]') from cron.job),
      'migrations', (select coalesce(jsonb_agg(version order by version), '[]') from supabase_migrations.schema_migrations)
    ) into result;
  else raise exception 'Unknown read model';
  end if;
  return result;
end $$;
revoke all on function public.admin_reserve_login() from public, anon, authenticated;
revoke all on function public.admin_read(text,integer,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_reserve_login() to service_role;
grant execute on function public.admin_read(text,integer,text,text,timestamptz,timestamptz) to service_role;
