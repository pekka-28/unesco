import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyMonitoringHttp} from '../scripts/verify_monitoring_http.ts';
test('deployment smoke check uses no credentials or valid submissions',async()=>{
 const seen: string[]=[];
 await verifyMonitoringHttp('https://project.example',async(input,options)=>{
  const url=new URL(String(input));seen.push(url.pathname+url.search);
  assert.equal(new Headers(options?.headers).get('authorization'),null);
  assert.equal(new Headers(options?.headers).get('apikey'),null);
  if(url.search==='?stats=1')return Response.json({ok:true,stats:{active_datasets:0,average_visited_sites:0,window_days:14}});
  if(url.pathname.endsWith('usage-summary')) {
   if(options?.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'https://pekka-28.github.io'}});
   assert.equal(options?.body,'{}');return new Response(null,{status:400});
  }
  assert.equal(options?.body,undefined);return new Response(null,{status:401});
 });
 assert.equal(seen.length,6);
});
test('deployment smoke check fails when a private endpoint accepts an anonymous caller',async()=>{
 await assert.rejects(verifyMonitoringHttp('https://project.example',async input=>String(input).includes('?stats=1')?
  Response.json({ok:true,stats:{active_datasets:0,average_visited_sites:0,window_days:14}}):new Response(null,{status:202})),/must reject unauthenticated callers/);
});
