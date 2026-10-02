import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '../.local/node_modules/@electric-sql/pglite/dist/index.js';
test('least grants retain ingestion and delivery while denying destructive and unrelated writes',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const file of ['202610010001_usage_summary.sql','202610020001_new_profile_notifications.sql','202610020003_historical_report_classes.sql','202610020004_optional_reporting_alias.sql','202610020007_profile_name.sql','202610030001_owner_administration.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  // Reproduce the provider's broad default grants observed in production.
  await db.exec('grant all on all tables in schema public to service_role;');
  await db.exec(readFileSync(new URL('../supabase/migrations/202610030002_least_privilege.sql',import.meta.url),'utf8'));
  await db.exec('set role service_role');
  const payload={submission_id:'22222222-2222-4222-8222-222222222222',submitted_at_utc:new Date().toISOString(),magic_cookie:'aabbccddeeff0011',name:'Test name',use_count_since_last_push:1,visited_site_count:4,event_type:'manual',client_version:'test'};
  assert.equal((await db.query('select public.accept_usage($1) as r',[payload])).rows[0].r.ok,true);
  assert.equal((await db.query("select public.admin_read('profiles') as r")).rows[0].r[0].name,'Test name');
  const lease=(await db.query('select * from public.claim_new_profile_notifications()')).rows[0];
  assert(lease.lease_token);
  assert.equal((await db.query('select public.finish_new_profile_notification($1,$2,true) as ok',[lease.id,lease.lease_token])).rows[0].ok,true);
  await db.query("insert into public.admin_operations(id,actor,action) values ($1,$1,'test-mail')",[payload.submission_id]);
  await db.exec("update public.admin_operations set status='succeeded',finished_at=now()");
  assert.equal((await db.query('select public.admin_reserve_login() as ok')).rows[0].ok,true);
  for(const sql of [
   'truncate public.usage_submissions cascade','delete from public.usage_submissions',
   "update public.usage_submissions set name='changed'",'select * from public.known_usage_profiles',
   'delete from public.new_profile_notifications',"update public.new_profile_notifications set name='changed'",
   "update public.admin_operations set actor='33333333-3333-4333-8333-333333333333'",'delete from public.admin_operations',
   'select * from public.admin_login_gate','create table public.unapproved(id int)'
  ])await assert.rejects(db.exec(sql),/permission denied/);
  await db.exec('reset role; create table public.future_private(id int); create function public.future_private_fn() returns integer language sql as $$select 1$$;');
  await db.exec('set role service_role');
  await assert.rejects(db.exec('select * from public.future_private'),/permission denied/);
  await assert.rejects(db.exec('select public.future_private_fn()'),/permission denied/);
 }finally{await db.close();}
});
