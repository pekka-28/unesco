-- Remember existing profiles without sending retrospective new-user alerts.
create table public.known_usage_profiles (
  magic_cookie text primary key,
  first_received_at timestamptz not null
);
insert into public.known_usage_profiles
select lower(magic_cookie), min(received_at) from public.usage_submissions group by lower(magic_cookie);

create table public.new_profile_notifications (
  id uuid primary key default gen_random_uuid(),
  magic_cookie text not null unique references public.known_usage_profiles,
  submission_id text not null,
  first_received_at timestamptz not null,
  event_type text not null,
  visited_count integer not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  last_error text
);
create index new_profile_notifications_pending on public.new_profile_notifications (available_at)
where sent_at is null;
alter table public.known_usage_profiles enable row level security;
alter table public.new_profile_notifications enable row level security;
revoke all on public.known_usage_profiles, public.new_profile_notifications from public, anon, authenticated;
grant select, insert on public.known_usage_profiles to service_role;
grant select, insert, update on public.new_profile_notifications to service_role;

create function public.enqueue_new_profile_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.known_usage_profiles values (lower(new.magic_cookie), new.received_at)
  on conflict do nothing;
  if found then
    insert into public.new_profile_notifications
      (magic_cookie, submission_id, first_received_at, event_type, visited_count)
    values (lower(new.magic_cookie), new.submission_id, new.received_at, new.event_type, new.visited_count);
  end if;
  return new;
end $$;
revoke all on function public.enqueue_new_profile_notification() from public, anon, authenticated;
create trigger usage_new_profile after insert on public.usage_submissions
for each row execute function public.enqueue_new_profile_notification();

create function public.claim_new_profile_notifications(p_submission_id text default null, p_limit integer default 10)
returns setof public.new_profile_notifications
language sql set search_path = '' as $$
  with candidates as (
    select id from public.new_profile_notifications
    where sent_at is null and available_at <= now()
      and (lease_until is null or lease_until < now())
      and (p_submission_id is null or submission_id = p_submission_id)
    order by available_at, id limit least(greatest(p_limit, 1), 10)
    for update skip locked
  )
  update public.new_profile_notifications n
  set lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes', attempts = attempts + 1
  from candidates c where n.id = c.id returning n.*;
$$;

create function public.finish_new_profile_notification(p_id uuid, p_lease_token uuid, p_success boolean)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.new_profile_notifications
  set sent_at = case when p_success then now() else null end,
      last_error = case when p_success then null else 'Email delivery failed; retry scheduled' end,
      available_at = now() + make_interval(secs => least(3600, 60 * (2 ^ least(attempts, 6)))::integer),
      lease_token = null, lease_until = null
  where id = p_id and lease_token = p_lease_token and sent_at is null;
  return found;
end $$;
revoke all on function public.claim_new_profile_notifications(text, integer) from public, anon, authenticated;
revoke all on function public.finish_new_profile_notification(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_new_profile_notifications(text, integer) to service_role;
grant execute on function public.finish_new_profile_notification(uuid, uuid, boolean) to service_role;
