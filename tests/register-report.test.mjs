import test from 'node:test';
import assert from 'node:assert/strict';
import {registerChanges,monthlyRegisterReport} from '../supabase/functions/_shared/register-report.ts';
test('register report detects lifecycle and nested attribute changes, ignoring metadata',()=>{
 const before={metadata:{generated:1},sites:[{site_id:'a',status:'active',native_names:{x:'old'}},{site_id:'b',status:'active'},{site_id:'c',status:'retired'},{site_id:'d'}]};
 const after={metadata:{generated:2},sites:[{site_id:'a',status:'active',native_names:{x:'new'}},{site_id:'b',status:'retired'},{site_id:'c',status:'active'},{site_id:'e'}]};
 assert.deepEqual(registerChanges(before,after),{added:['e'],retired:['b'],reactivated:['c'],changed:['a'],removed:['d']});
 assert.deepEqual(registerChanges(before,{...before,metadata:{generated:3}}),{added:[],retired:[],reactivated:[],changed:[],removed:[]});
});
test('monthly register selects commits strictly before calendar boundaries',async()=>{
 const calls=[];let n=0;
 const result=await monthlyRegisterReport({start_at:'2026-08-31T22:00:00Z',end_at:'2026-09-30T22:00:00Z',label:'2026-09'},async url=>{
  calls.push(url);n++;return Response.json(n%2 ? [{sha:String(n).repeat(40)}] : {sites:[]});
 });
 assert.match(calls[0],/until=2026-08-31T21%3A59%3A59.999Z/);
 assert.match(calls[2],/until=2026-09-30T21%3A59%3A59.999Z/);
 assert.match(result,/Added: 0/);assert.match(result,/Git comparison:/);
});
