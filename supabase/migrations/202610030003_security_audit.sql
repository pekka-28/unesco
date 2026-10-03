-- Bounded forensic reads and operational fault reporting. No runtime table grants.
create table public.security_monitor_state (
  singleton boolean primary key default true check (singleton),
  checked_at timestamptz,
  faults jsonb not null default '{}'::jsonb,
  reported_faults jsonb not null default '{}'::jsonb,
  reported_at timestamptz,
  lease uuid,
  lease_until timestamptz,
  last_delivery_failed boolean not null default false
);
alter table public.security_monitor_state enable row level security;
revoke all on public.security_monitor_state from public, anon, authenticated, service_role;
insert into public.security_monitor_state(singleton) values(true);

create function public.security_audit_read(p_entity text, p_offset integer default 0,
  p_from timestamptz default null, p_until timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_offset < 0 or p_offset > 100000 then raise exception 'Invalid offset'; end if;
  if p_entity = 'auth-audit' then
    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into result from (
      select id, created_at, left(payload->>'action',80) as action,
        left(payload->>'actor_id',80) as actor_id,
        left(payload->>'actor_via_sso',10) as actor_via_sso
      from auth.audit_log_entries
      where (p_from is null or created_at >= p_from) and (p_until is null or created_at < p_until)
      order by created_at desc,id limit 100 offset p_offset
    ) r;
  elsif p_entity = 'security-health' then
    select jsonb_build_object('checked_at',checked_at,'faults',faults,
      'last_reported_at',reported_at,'last_delivery_failed',last_delivery_failed,
      'monitor_stale',checked_at is null or checked_at < now()-interval '15 minutes',
      'auth_audit_rows',(select count(*) from auth.audit_log_entries),
      'latest_auth_event',(select max(created_at) from auth.audit_log_entries),
      'auth_coverage','Only events stored by Auth are available. An empty or quiet table does not prove recording is enabled; configuration needs separate verification.',
      'coverage','Auth database events and selected operational faults; platform and database statement auditing are separate')
      into result from public.security_monitor_state where singleton;
  else raise exception 'Unknown audit model'; end if;
  return result;
end $$;

create function public.security_monitor_claim() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_faults jsonb; state public.security_monitor_state%rowtype; claim uuid;
begin
  select * into state from public.security_monitor_state where singleton for update;
  select jsonb_build_object(
    'failed_notifications',(select count(*) from public.new_profile_notifications
      where sent_at is null and attempts > 0 and first_received_at < now()-interval '10 minutes'),
    'uncertain_operations',(select count(*) from public.admin_operations where status='uncertain'
      or (status='started' and requested_at < now()-interval '15 minutes')),
    'failed_schedules',(select count(*) from (
      select distinct on (d.jobid) d.status from cron.job_run_details d
      join cron.job j on j.jobid=d.jobid and j.active
      where d.start_time > now()-interval '24 hours'
      order by d.jobid,d.start_time desc,d.runid desc
    ) latest where status='failed')
  ) into current_faults;
  -- Empty object is the healthy state; return only counts, never report contents.
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into current_faults
    from jsonb_each(current_faults) where value <> '0'::jsonb;
  update public.security_monitor_state set checked_at=now(),faults=current_faults where singleton;
  if state.lease_until > now() then return null; end if;
  if current_faults='{}'::jsonb and state.reported_faults='{}'::jsonb then return null; end if;
  if state.reported_at > now()-interval '1 hour' then return null; end if;
  claim := gen_random_uuid();
  update public.security_monitor_state set lease=claim,lease_until=now()+interval '5 minutes' where singleton;
  return jsonb_build_object('lease',claim,'faults',current_faults,'checked_at',now(),
    'recovery',current_faults='{}'::jsonb);
end $$;

create function public.security_monitor_finish(p_lease uuid,p_faults jsonb,p_sent boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare finished boolean;
begin
  update public.security_monitor_state set
    reported_faults=case when p_sent then p_faults else reported_faults end,
    reported_at=now(),last_delivery_failed=not p_sent,lease=null,lease_until=null
    where singleton and lease=p_lease and lease_until>now() returning true into finished;
  return coalesce(finished,false);
end $$;

revoke all on function public.security_audit_read(text,integer,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.security_monitor_claim() from public,anon,authenticated;
revoke all on function public.security_monitor_finish(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.security_audit_read(text,integer,timestamptz,timestamptz) to service_role;
grant execute on function public.security_monitor_claim() to service_role;
grant execute on function public.security_monitor_finish(uuid,jsonb,boolean) to service_role;
