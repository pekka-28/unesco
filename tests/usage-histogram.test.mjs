import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '../.local/node_modules/@electric-sql/pglite/dist/index.js';
import {createHandler} from '../supabase/functions/usage-summary/handler.mjs';
test('histogram uses latest activity per profile, always visible and no raw counts',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const name of ['202610010001_usage_summary.sql','202610020003_historical_report_classes.sql','202610020005_usage_histogram.sql','202610020006_always_show_histogram.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  const insert=(id,cookie,visited,received,kind='activity')=>db.query("insert into public.usage_submissions(submission_id,received_at,submitted_at,magic_cookie,use_count,visited_count,event_type,client_version,payload,record_class) values($1,$2,$2,$3,0,$4,'manual','test','{}',$5)",[id,received,cookie,visited,kind]);
  const query=async ()=>(await db.query("select public.usage_histogram() as h")).rows[0].h;
  const empty=await query(); assert.equal(empty.visible,true); assert.equal(empty.buckets.length,10); assert(empty.buckets.every(b=>b.height===0));
  await insert('old','a',5,'2026-10-01T01:00:00Z');await insert('new','a',23,'2026-10-01T02:00:00Z');
  await insert('zero','b',0,'2026-03-01T02:00:00Z');await insert('noise','c',90,'2026-10-01T02:00:00Z','synthetic');

  const visible=await query();assert.equal(visible.visible,true);
  assert.equal(visible.buckets.length,10);assert.deepEqual(visible.buckets[0],{lower_bound:0,upper_bound:2.4,height:1});
  assert.deepEqual(visible.buckets[9],{lower_bound:21.6,upper_bound:24,height:1});
  assert(visible.buckets.slice(1,9).every(b=>b.height===0));
  assert.doesNotMatch(JSON.stringify(visible),/magic_cookie|reporting_alias|count|population/);
  await insert('huge','d',2147483647,'2026-10-01T02:00:00Z');
  const capped=await query();assert.equal(capped.buckets.length,10);assert.equal(capped.buckets.at(-1).upper_bound,2147483648);
  await db.exec('set role anon');await assert.rejects(query(),/permission denied/);
 }finally{await db.close();}
});
test('public histogram has no population threshold or age filter',async()=>{
 let parameters;
 const h=createHandler({env:k=>({SUPABASE_URL:'https://test',SUPABASE_SERVICE_ROLE_KEY:'secret'})[k],now:()=>new Date('2026-10-02T00:00:00Z'),fetch:async(_,o)=>{parameters=JSON.parse(o.body);return Response.json({visible:true,buckets:[]});}});
 const response=await h(new Request('https://test?histogram=1&min_profiles=0&start_at=1900'));
 assert.equal(response.status,200);assert.deepEqual(parameters,{});
 assert.deepEqual((await response.json()).histogram,{visible:true,buckets:[],population:'latest_per_profile',bucket_count:10});
});
