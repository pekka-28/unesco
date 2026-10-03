import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '../.local/node_modules/@electric-sql/pglite/dist/index.js';
import {createAdminHandler} from '../supabase/functions/owner-admin/handler.mjs';
const owner={id:'11111111-1111-4111-8111-111111111111',email:'pekka@data.co.za',email_confirmed_at:'2026-10-03'};
const operation='22222222-2222-4222-8222-222222222222';
function harness(overrides={}) {
 const calls=[],mail=[],records=new Map();
 const settings={SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'private-key',MWH_ADMIN_USER_ID:owner.id,MWH_NOTIFICATION_TOKEN:'worker-key',MWH_ADMIN_GITHUB_TOKEN:'github-key',...overrides.settings};
 let reserved=false;
 const handler=createAdminHandler({env:k=>settings[k],rpc:async(name,args)=>{
   calls.push({name,args});if(name==='admin_reserve_login'){const ok=!reserved;reserved=true;return ok;}return {rows:[]};
 },send:async m=>mail.push(m),request:async(url,options)=>{
   calls.push({url,options});
   if(url.endsWith('/auth/v1/user'))return Response.json(overrides.user||owner);
   if(url.endsWith('/auth/v1/admin/generate_link'))return Response.json({...owner,hashed_token:'a'.repeat(64)});
   if(url.endsWith('/auth/v1/verify'))return Response.json({user:overrides.user||owner,access_token:'session',expires_in:3600});
   if(url.includes('/rest/v1/admin_operations')){
     if(options.method==='GET')return Response.json(records.has(operation)?[{id:operation,status:records.get(operation).status}]:[]);
     const data=JSON.parse(options.body);
     if(options.method==='POST') {if(records.has(data.id))return Response.json({}, {status:409});records.set(data.id,data);}
     else records.set(operation,{...records.get(operation),...data});
     return new Response(null,{status:204});
   }
   if(url.includes('/functions/v1/'))return overrides.workerFailure?Response.json({}, {status:503}):Response.json({accepted:true});
   if(url.includes('/actions/runs?'))return Response.json({workflow_runs:[]});
   throw new Error('Unexpected request');
 }});
 const request=(body,token='owner-token',origin='https://pekka-28.github.io')=>handler(new Request('https://db.test/functions/v1/owner-admin',{method:'POST',headers:{origin,...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)}));
 return {request,calls,mail,records};
}
test('admin rejects anonymous, wrong-owner and unconfirmed accounts before database access',async()=>{
 for(const options of [{},{user:{...owner,id:'another'}},{user:{...owner,email_confirmed_at:null}}]){
  const h=harness(options);const response=await h.request({action:'read',entity:'submissions'},options.user?'token':'');
  assert([401,403].includes(response.status));assert(!h.calls.some(c=>c.name==='admin_read'));
 }
 const h=harness({settings:{MWH_ADMIN_USER_ID:''}});assert.equal((await h.request({action:'read',entity:'status'})).status,503);
});
test('sign-in sends only to fixed owner, throttles requests and never returns the link',async()=>{
 const h=harness();for(let i=0;i<2;i++){
  const r=await h.request({action:'login',email:'attacker@example.com'},'');assert.equal(r.status,202);assert(!JSON.stringify(await r.json()).includes('token_hash'));
 }
 assert.equal(h.mail.length,1);assert.equal(h.mail[0].to,owner.email);assert.match(h.mail[0].text,/admin\/#token_hash=/);
 assert.equal((await h.request({action:'login'},'','https://other.test')).status,403);
});
test('sign-in verification cannot authorise another Supabase user',async()=>{
 const h=harness({user:{...owner,id:'another'}});
 assert.equal((await h.request({action:'verify',token_hash:'a'.repeat(64)},'')).status,403);
});
test('read queries are bounded and cannot choose arbitrary SQL, entities or filters',async()=>{
 const h=harness();for(const body of [{entity:'vault'},{entity:'submissions',offset:-1},{entity:'submissions',profile:"x' or true"},{entity:'submissions',record_class:'other'},{entity:'submissions',from:'now()'}]){
  assert.equal((await h.request({action:'read',...body})).status,400);
 }
 assert.equal((await h.request({action:'sql',query:'select * from vault.decrypted_secrets'})).status,400);
 assert.equal((await h.request({action:'read',entity:'submissions',record_class:'test',offset:100})).status,200);
 assert.equal(h.calls.filter(c=>c.name==='admin_read').length,1);
});
test('mail commands require an operation Id and duplicate Ids never send twice',async()=>{
 const h=harness();assert.equal((await h.request({action:'test-mail'})).status,400);
 assert.equal((await h.request({action:'test-mail',id:operation})).status,200);
 assert.equal((await h.request({action:'test-mail',id:operation})).status,409);
 assert.equal(h.calls.filter(c=>c.url?.includes('/functions/v1/')).length,1);
 assert.equal(h.records.get(operation).status,'succeeded');
});
test('uncertain delivery remains in the ledger and does not automatically resend',async()=>{
 const h=harness({workerFailure:true});const r=await h.request({action:'monthly-mail',id:operation});
 assert.equal(r.status,503);assert.equal(h.records.get(operation).status,'uncertain');
 assert.equal((await h.request({action:'monthly-mail',id:operation})).status,409);
 assert.equal(h.calls.filter(c=>c.url?.includes('/functions/v1/')).length,1);
});
test('even the owner cannot invoke site mutations, with or without a legacy GitHub credential',async()=>{
 const h=harness();
 for(const action of ['refresh','publish','probe','deploy','rerun','sql','import','update','delete','set-secret','set-owner']) {
  assert.equal((await h.request({action,id:operation,query:'select 1'})).status,400);
 }
 assert.equal(h.records.size,0);
 assert(!h.calls.some(c=>c.url?.includes('api.github.com')||c.url?.includes('/functions/v1/')));
});
test('GitHub inspection only performs an unauthenticated GET of fixed workflow status',async()=>{
 const h=harness();assert.equal((await h.request({action:'runs',path:'/dispatches',method:'POST'})).status,200);
 const calls=h.calls.filter(c=>c.url?.includes('api.github.com'));
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');
 assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[0].options.body,undefined);
 assert.equal(calls[0].url,'https://api.github.com/repos/pekka-28/unesco/actions/runs?branch=main&per_page=20');
});
test('database administration reads preserve table permissions and classify historical records',async()=>{
 const db=new PGlite();try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const file of ['202610010001_usage_summary.sql','202610020001_new_profile_notifications.sql','202610020003_historical_report_classes.sql','202610020004_optional_reporting_alias.sql','202610020007_profile_name.sql','202610030001_owner_administration.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec("insert into public.usage_submissions(submission_id,submitted_at,magic_cookie,use_count,visited_count,event_type,client_version,payload,record_class) values ('record',now(),'aabbccddeeff0011',1,3,'manual','test','{}','test')");
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   await assert.rejects(db.query("select public.admin_read('submissions')"),/permission denied/);
   await assert.rejects(db.query('select * from public.admin_operations'),/permission denied/);
   await assert.rejects(db.query('select public.admin_reserve_login()'),/permission denied/);
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const r=await db.query("select public.admin_read('submissions',0,null,'test') as result");assert.equal(r.rows[0].result.length,1);
  assert.equal(r.rows[0].result[0].record_class,'test');assert.equal(r.rows[0].result[0].payload,undefined);
  await assert.rejects(db.query("select public.admin_read('vault')"),/Unknown read model/);
  await assert.rejects(db.query("select public.admin_read('submissions',-1)"),/Invalid offset/);
  assert.equal((await db.query('select public.admin_reserve_login() as ok')).rows[0].ok,true);
  assert.equal((await db.query('select public.admin_reserve_login() as ok')).rows[0].ok,false);
 }finally{await db.close();}
});
