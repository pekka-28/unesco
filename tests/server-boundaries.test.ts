import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/usage-summary/handler.ts';
import {deliverNewProfiles} from '../supabase/functions/_shared/new-profile-mail.ts';
import {createMonthlyHandler} from '../supabase/functions/monthly-report/handler.ts';
import {reportSecurityFaults} from '../supabase/functions/_shared/security-monitor.ts';
const noEffect=()=>assert.fail('Malformed data must not cause effects');

test('unknown request JSON is rejected before database access',async()=>{
 const handler=createHandler({env:()=>undefined,fetch:noEffect});
 for(const value of [null,[],42,'text',{magic_cookie:1234567890123456},{event_type:{}}]) {
  const response=await handler(new Request('https://test',{method:'POST',body:JSON.stringify(value)}));
  assert.equal(response.status,400);
 }
});

test('malformed notification RPC data cannot send or mark completion',async()=>{
 for(const rows of [{},[null],[{id:'id',lease_token:42,first_received_at:'2026-10-03',event_type:'adoption',visited_count:0}]]) {
  await assert.rejects(deliverNewProfiles({rpc:async name=>{assert.equal(name,'claim_new_profile_notifications');return rows;},send:noEffect}),/Invalid service/);
 }
});

test('malformed reporting RPC data fails without sending a misleading report',async()=>{
 const handler=createMonthlyHandler({env:()=> 'worker',rpc:async()=>({submissions:'invented'}),send:noEffect});
 assert.equal((await handler(new Request('https://test',{method:'POST',headers:{Authorization:'Bearer worker'}}))).status,503);
 const usage=createHandler({env:()=> 'configured',fetch:async()=>Response.json({buckets:[{lower_bound:0,upper_bound:10,height:'invalid'}]})});
 assert.equal((await usage(new Request('https://test?histogram=1'))).status,503);
});

test('invalid monitor recovery flag cannot produce a recovery message',async()=>{
 await assert.rejects(reportSecurityFaults({rpc:async()=>({faults:{failed:1},recovery:'false'}),send:noEffect}),/Invalid monitor/);
});
