import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '../.local/node_modules/@electric-sql/pglite/dist/index.js';
import { createHandler } from '../supabase/functions/usage-summary/handler.mjs';
import { renderNewProfileMail } from '../supabase/functions/_shared/new-profile-mail.mjs';
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
