-- Only the server role can request distributions or choose the population floor.
create function public.usage_histogram(start_at timestamptz, end_at timestamptz, min_profiles integer default 1)
returns jsonb language sql stable set search_path = '' as $$
  with latest as (
    select distinct on (magic_cookie) visited_count
    from public.usage_submissions
    where received_at >= start_at and received_at < end_at and record_class='activity'
    order by magic_cookie,received_at desc,submission_id desc
  ), population as (select count(*) as n from latest),
  bounds as (
    select coalesce(min(visited_count),0)::numeric as lo,
      (coalesce(max(visited_count),0)::numeric-coalesce(min(visited_count),0)+1)/10 as width from latest
  ), counts as (
    select floor((visited_count-lo)/width)::integer as bucket,count(*) as n from latest cross join bounds group by 1
  ), bins as (
    select generate_series(0,9) as bucket
  ), heights as (
    select bins.bucket,round(coalesce(counts.n,0)::numeric/nullif((select max(n) from counts),0),4) as height
    from bins left join counts using(bucket)
  ) select case when (select n from population) < greatest(coalesce(min_profiles,1),1)
    then jsonb_build_object('visible',false,'buckets','[]'::jsonb)
    else jsonb_build_object('visible',true,'buckets',
      (select jsonb_agg(jsonb_build_object('lower_bound',lo+bucket*width,
        'upper_bound',lo+(bucket+1)*width,'height',height) order by bucket) from heights cross join bounds))
    end;
$$;
revoke all on function public.usage_histogram(timestamptz,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.usage_histogram(timestamptz,timestamptz,integer) to service_role;
