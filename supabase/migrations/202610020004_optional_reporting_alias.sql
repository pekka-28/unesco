-- An explicitly supplied reporting alias is separate from the local profile name.
alter table public.usage_submissions add column reporting_alias text not null default ''
  check (char_length(reporting_alias) <= 80 and reporting_alias !~ '[[:cntrl:]]');
alter table public.known_usage_profiles add column reporting_alias text not null default ''
  check (char_length(reporting_alias) <= 80 and reporting_alias !~ '[[:cntrl:]]');
alter table public.new_profile_notifications add column reporting_alias text not null default ''
  check (char_length(reporting_alias) <= 80 and reporting_alias !~ '[[:cntrl:]]');

create or replace function public.accept_usage(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare existing jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p->>'magic_cookie', 0));
  select payload into existing from public.usage_submissions where submission_id=p->>'submission_id';
  if found then
    if existing <> p then raise exception 'Submission ID reused with different content'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'submission_id',p->>'submission_id');
  end if;
  if exists(select 1 from public.usage_submissions where magic_cookie=p->>'magic_cookie' and received_at>now()-interval '30 seconds')
    or (select count(*) from public.usage_submissions where magic_cookie=p->>'magic_cookie' and received_at>now()-interval '1 hour')>=12 then
    raise exception 'Rate limited';
  end if;
  insert into public.usage_submissions
    (submission_id,submitted_at,magic_cookie,use_count,visited_count,event_type,client_version,payload,reporting_alias)
  values(p->>'submission_id',(p->>'submitted_at_utc')::timestamptz,p->>'magic_cookie',
    (p->>'use_count_since_last_push')::integer,(p->>'visited_site_count')::integer,
    p->>'event_type',p->>'client_version',p,coalesce(p->>'reporting_alias',''));
  return jsonb_build_object('ok',true,'duplicate',false,'submission_id',p->>'submission_id');
end $$;

create or replace function public.enqueue_new_profile_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.known_usage_profiles(magic_cookie,first_received_at,reporting_alias)
    values(lower(new.magic_cookie),new.received_at,new.reporting_alias) on conflict do nothing;
  if found then
    insert into public.new_profile_notifications
      (magic_cookie,submission_id,first_received_at,event_type,visited_count,reporting_alias)
    values(lower(new.magic_cookie),new.submission_id,new.received_at,new.event_type,new.visited_count,new.reporting_alias);
  elsif new.reporting_alias <> '' then
    update public.known_usage_profiles set reporting_alias=new.reporting_alias where magic_cookie=lower(new.magic_cookie);
  end if;
  return new;
end $$;
