import {fixtureProfile} from './fixtures.ts';
import type {Summary} from '../site/src/types.js';
import {browserContext} from './browser_context.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {siteFunction} from '../scripts/site_source.ts';
const functions = ['syncSummaryReminderState','persistProfile','isSummaryDue','updateSummaryReminderUi','runSubmissionDialogSend','submitAdoptionSummary'].map(siteFunction).join('\n');
const now = Date.parse('2026-10-03T12:00:00Z'), day = 86400000;
function environment(store = new Map<string,string>(), cookie = 'profile-one') {
  const base=fixtureProfile();
  const profile = {...base,magicCookie:cookie,publishPreference:{...base.publishPreference,enabled:true,intervalDays:7},usage:{...base.usage,useCount:2,pendingSummaries:{} as Record<string,{summary: Summary;useCount:number}>}};
  const ui = {summaryInboxBtn:{style:{display:''}},summaryInboxDot:{style:{display:''}},submitSend:{},submitClose:{}};
  const ctx = browserContext({profile,ui,connected:true,PROFILE_KEY:'profile',USAGE_ENDPOINT_STORAGE_KEY:'endpoint',submissionInProgress:false,
    localStorage:{getItem:(key: string)=>store.get(key)??null,setItem:(key: string,value: string)=>store.set(key,value)},
    Date:class extends Date {static now(){return now;}}, nowIso:()=>new Date(now).toISOString(), migrateUsageSettings(){},
    window:{setTimeout:()=>1,clearTimeout(){}}, setSubmissionDialogStatus(){}, copySummaryToClipboard:async()=>true,
    fetchUsageStats:async()=>null,formatStatsLine:()=>'',recordSubmitStatus(){},asText:(v: unknown)=>String(v??'')});
  vm.runInContext(functions,ctx);
  return {ctx,profile,ui,store};
}
for (const event of ['manual','periodic','adoption']) for (const accepted of [true,false]) {
  test(`${event} ${accepted?'receipt':'failure'} updates the reminder only on acceptance`,async()=>{
    const {ctx,profile,ui,store}=environment();
    const summary: Summary={event_type:event,submission_id:'receipt',use_count_since_last_push:2,submitted_at_utc:new Date(now).toISOString(),magic_cookie:profile.magicCookie,visited_site_count:0,client_version:'test'};
    profile.usage.pendingSummaries[event]={summary,useCount:2};
    ctx.pendingSummaryDialog={summary};ctx.buildUsageSummary=()=>summary;
    ctx.submitUsageSummary=async()=>({ok:accepted});
    ctx.updateSummaryReminderUi();assert.equal(ui.summaryInboxBtn.style.display,'inline-flex');
    await (event==='adoption'?ctx.submitAdoptionSummary():ctx.runSubmissionDialogSend());
    assert.equal(ui.summaryInboxBtn.style.display,accepted?'none':'inline-flex');
    assert.equal(ctx.isSummaryDue(),!accepted);
    if(accepted){
      const reloaded=environment(store);reloaded.ctx.profile=JSON.parse(store.get('profile') || 'null');
      assert.equal(reloaded.ctx.isSummaryDue(),false);
      reloaded.ctx.profile.publishPreference.intervalDays=0;
      assert.equal(reloaded.ctx.isSummaryDue(),false);
    }
  });
}
test('another tab sees a receipt and cannot overwrite its reminder time with a stale profile',()=>{
  const store=new Map<string,string>(), older=environment(store), sender=environment(store);
  sender.profile.publishPreference.lastPromptAt=new Date(now).toISOString();sender.ctx.persistProfile();
  older.ctx.updateSummaryReminderUi();assert.equal(older.ui.summaryInboxBtn.style.display,'none');
  older.profile.publishPreference.lastPromptAt=null;older.ctx.persistProfile();
  assert.equal(JSON.parse(store.get('profile') || 'null').publishPreference.lastPromptAt,new Date(now).toISOString());
});
test('receipt from a different profile does not suppress a reminder; interval boundary is respected',()=>{
  const store=new Map<string,string>(), other=environment(store,'other');other.profile.publishPreference.lastPromptAt=new Date(now).toISOString();other.ctx.persistProfile();
  const own=environment(store);assert.equal(own.ctx.isSummaryDue(),true);
  own.profile.publishPreference.lastPromptAt=new Date(now-7*day+1).toISOString();assert.equal(own.ctx.isSummaryDue(),false);
  own.profile.publishPreference.lastPromptAt=new Date(now-7*day).toISOString();assert.equal(own.ctx.isSummaryDue(),true);
});
