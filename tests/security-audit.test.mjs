import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '../.local/node_modules/@electric-sql/pglite/dist/index.js';
import {reportSecurityFaults} from '../supabase/functions/_shared/security-monitor.ts';

test('audit reads redact payloads; ordinary callers cannot read; monitor leases and throttles fault mail',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.audit_log_entries(id uuid,created_at timestamptz,payload jsonb);
    insert into auth.audit_log_entries values('11111111-1111-4111-8111-111111111111',now(),'{"action":"login","actor_id":"owner","secret":"must-not-leak","email":"private"}');
    create schema cron;create table cron.job(jobid bigint,active boolean);create table cron.job_run_details(jobid bigint,runid bigint,status text,start_time timestamptz);
    create table public.new_profile_notifications(sent_at timestamptz,attempts integer,first_received_at timestamptz);
    create table public.admin_operations(status text,requested_at timestamptz);
    insert into public.admin_operations values('uncertain',now());`);
  await db.exec(readFileSync(new URL('../supabase/migrations/202610030003_security_audit.sql',import.meta.url),'utf8'));
  await db.exec('set role anon');
  await assert.rejects(db.exec("select public.security_audit_read('auth-audit')"),/permission denied/);
  await assert.rejects(db.exec('select public.security_monitor_claim()'),/permission denied/);
  await db.exec('reset role;set role service_role');
  await assert.rejects(db.exec('delete from public.security_monitor_state'),/permission denied/);
  const rows=(await db.query("select public.security_audit_read('auth-audit') as r")).rows[0].r;
  assert.equal(rows[0].action,'login');assert(!JSON.stringify(rows).includes('must-not-leak'));assert(!JSON.stringify(rows).includes('private'));
  const claim=(await db.query('select public.security_monitor_claim() as r')).rows[0].r;
  assert.equal(claim.faults.uncertain_operations,1);
  assert.equal((await db.query('select public.security_monitor_claim() as r')).rows[0].r,null);
  assert.equal((await db.query('select public.security_monitor_finish($1,$2,true) as r',[claim.lease,claim.faults])).rows[0].r,true);
  assert.equal((await db.query('select public.security_monitor_claim() as r')).rows[0].r,null);
  await db.exec("reset role;update public.security_monitor_state set reported_at=now()-interval '2 hours';delete from public.admin_operations;set role service_role");
  const recovery=(await db.query('select public.security_monitor_claim() as r')).rows[0].r;
  assert.equal(recovery.recovery,true);
  assert.equal((await db.query("select public.security_monitor_finish('22222222-2222-4222-8222-222222222222','{}',true) as r")).rows[0].r,false);
  await db.query('select public.security_monitor_finish($1,$2,false)',[recovery.lease,recovery.faults]);
  assert.equal((await db.query("select public.security_audit_read('security-health') as r")).rows[0].r.last_delivery_failed,true);
 }finally{await db.close();}
});

test('fault reporter sends only counts to fixed owner and records failed delivery without recursion',async()=>{
 const calls=[],mail=[];const claim={lease:'lease',faults:{failed_notifications:2},checked_at:'2026-10-03',recovery:false};
 const rpc=async(name,args)=>{calls.push({name,args});return name==='security_monitor_claim'?claim:true;};
 await reportSecurityFaults({rpc,send:async m=>mail.push(m)});
 assert.equal(mail[0].to,'pekka@data.co.za');assert.match(mail[0].text,/failed_notifications: 2/);
 assert.equal(calls.at(-1).args.p_sent,true);
 await assert.rejects(reportSecurityFaults({rpc,send:async()=>{throw Error('secret provider body');}}),/Security fault reporting failed/);
 assert.equal(calls.at(-1).args.p_sent,false);
});


test('dispatcher invokes monitoring with no notifications, then suppresses fresh healthy polls',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table public.new_profile_notifications(sent_at timestamptz,available_at timestamptz,lease_until timestamptz);
   create table public.security_monitor_state(singleton boolean,checked_at timestamptz);
   insert into public.security_monitor_state values(true,null);
   create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
   insert into vault.decrypted_secrets values('mwh_notification_url','https://worker.test'),('mwh_notification_token','test-only');
   create schema net;create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$ select 42::bigint $$;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/202610030004_monitor_dispatch.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('select public.dispatch_new_profile_notifications() as r')).rows[0].r,42);
  await db.exec('update public.security_monitor_state set checked_at=now()');
  assert.equal((await db.query('select public.dispatch_new_profile_notifications() as r')).rows[0].r,null);
  await db.exec('insert into public.new_profile_notifications values(null,now(),null)');
  assert.equal((await db.query('select public.dispatch_new_profile_notifications() as r')).rows[0].r,42);
  await db.exec('set role service_role');
  await assert.rejects(db.exec('select public.dispatch_new_profile_notifications()'),/permission denied/);
 }finally{await db.close();}
});
