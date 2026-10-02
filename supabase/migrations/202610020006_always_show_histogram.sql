-- Always return ten buckets, including an empty population.
drop function public.usage_histogram(timestamptz,timestamptz,integer);
create function public.usage_histogram()
returns jsonb language sql stable set search_path = '' as $$
  with latest as (
    select distinct on (magic_cookie) visited_count
    from public.usage_submissions
    where record_class='activity'
    order by magic_cookie,received_at desc,submission_id desc
  ),
  bounds as (
    select coalesce(min(visited_count),0)::numeric as lo,
      (coalesce(max(visited_count),0)::numeric-coalesce(min(visited_count),0)+1)/10 as width from latest
  ), counts as (
    select floor((visited_count-lo)/width)::integer as bucket,count(*) as n from latest cross join bounds group by 1
  ), bins as (
    select generate_series(0,9) as bucket
  ), heights as (
    select bins.bucket,coalesce(round(coalesce(counts.n,0)::numeric/nullif((select max(n) from counts),0),4),0) as height
    from bins left join counts using(bucket)
  ) select jsonb_build_object('visible',true,'buckets',
      (select jsonb_agg(jsonb_build_object('lower_bound',lo+bucket*width,
        'upper_bound',lo+(bucket+1)*width,'height',height) order by bucket) from heights cross join bounds))
    ;
$$;
revoke all on function public.usage_histogram() from public,anon,authenticated;
grant execute on function public.usage_histogram() to service_role;
