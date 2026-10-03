import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '../.local/node_modules/@electric-sql/pglite/dist/index.js';
import { createHandler } from '../supabase/functions/usage-summary/handler.ts';
import { renderNewProfileMail } from '../supabase/functions/_shared/new-profile-mail.ts';
const migrations=['202610010001_usage_summary.sql','202610020001_new_profile_notifications.sql','202610020003_historical_report_classes.sql','202610020004_optional_reporting_alias.sql','202610020007_profile_name.sql'];
const payload={submission_id:'12345678-1234-1234-1234-123456789abc',submitted_at_utc:'2026-10-02T00:00:00Z',magic_cookie:'0123456789abcdef',use_count_since_last_push:0,visited_site_count:2,event_type:'adoption',client_version:'0.2.2'};
test('profile Name reaches the queue and adoption mail; classifications keep noise out of stats',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const file of migrations) await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec('set role service_role');
  const p={...payload,name:'Visitor A'};
  await db.query('select public.accept_usage($1)',[p]);
  const row=(await db.query('select * from public.new_profile_notifications')).rows[0];
  assert.equal(row.name,'Visitor A');assert.match(renderNewProfileMail(row).text,/Name: Visitor A/);
  assert.doesNotMatch(renderNewProfileMail({...row,name:''}).text,/Name:/);
  const stats=()=>db.query("select public.usage_stats('2020-01-01','2100-01-01') as s");
  assert.equal((await stats()).rows[0].s.submissions,1);
  await db.exec('reset role');
  await db.exec("update public.usage_submissions set record_class='synthetic',event_type='patch',use_count=null,visited_count=null");
  assert.equal((await stats()).rows[0].s.submissions,0);
  await assert.rejects(db.exec("update public.usage_submissions set record_class='activity'"),/usage_activity_counts_required/);
 }finally{await db.close();}
});
test('API accepts Name and ignores the removed alias attribute',async()=>{
 let clean;
 const handler=createHandler({env:k=>({SUPABASE_URL:'https://test',SUPABASE_SERVICE_ROLE_KEY:'test'})[k],fetch:async(_,o)=>{clean=JSON.parse(o.body).p;return Response.json({ok:true,submission_id:clean.submission_id});}});
 const request=p=>new Request('https://test',{method:'POST',body:JSON.stringify(p)});
 assert.equal((await handler(request({...payload,name:' Visitor A ',reporting_alias:'Ignored'}))).status,200);
 assert.equal(clean.name,'Visitor A');assert.equal(clean.reporting_alias,undefined);
 for(const name of ['x'.repeat(81),'bad\nline',42]) assert.equal((await handler(request({...payload,name}))).status,400);
 assert.equal((await handler(request({...payload,reporting_alias:'Ignored'}))).status,200);assert.equal(clean.name,undefined);
});


test('queued summaries with an outdated Name are rebuilt without reusing the receipt',async()=>{
 const {siteFunction}=await import('../scripts/site_source.mjs');
 const vm=await import('node:vm');
 const context={profile:{name:'Current name',magicCookie:'aabbccdd',siteVisits:{},usage:{useCount:5,publishedUseCount:1,pendingSummaries:{manual:{summary:{submission_id:'old',event_type:'manual'},useCount:4}}}},
 asText:v=>String(v??''),crypto:{randomUUID:()=> 'new-receipt'},nowIso:()=> '2026-10-03T00:00:00.123Z',APP_VERSION:'test',persistProfile:()=>{},getVisitStatus:()=> 'not_visited'};
 vm.createContext(context);vm.runInContext(siteFunction('buildUsageSummary')+';result=buildUsageSummary("manual");',context);
 assert.equal(context.result.name,'Current name');assert.equal(context.result.submission_id,'new-receipt');
 vm.runInContext('again=buildUsageSummary("manual");',context);assert.equal(context.again,context.result);
});


test('source rename preserves imported provenance and assigns native source without trusting payload',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const file of [...migrations,'202610030001_owner_administration.sql','202610030002_least_privilege.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.query('select public.accept_usage($1)',[payload]);
  await db.exec("update public.usage_submissions set legacy_source='historical-test-source'");
  const existingNative={...payload,submission_id:'32345678-1234-1234-1234-123456789abc',magic_cookie:'2123456789abcdef'};
  await db.query('select public.accept_usage($1)',[existingNative]);
  await db.exec(readFileSync(new URL('../supabase/migrations/202610030005_submission_source.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('select source from public.usage_submissions where submission_id=$1',[existingNative.submission_id])).rows[0].source,'my-world-heritage');
  await db.exec('set role service_role');
  assert((await db.query("select public.admin_read('submissions') as r")).rows[0].r.some(r=>r.source==='historical-test-source'));
  const next={...payload,submission_id:'22345678-1234-1234-1234-123456789abc',magic_cookie:'1123456789abcdef',source:'forged-source'};
  await db.query('select public.accept_usage($1)',[next]);
  assert.equal((await db.query('select source from public.usage_submissions where submission_id=$1',[next.submission_id])).rows[0].source,'my-world-heritage');
  await assert.rejects(db.exec("update public.usage_submissions set source='forged'"),/permission denied/);
 }finally{await db.close();}
});
