import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {siteFunction} from '../scripts/site_source.mjs';
const functions = ['syncSummaryReminderState','persistProfile','isSummaryDue','updateSummaryReminderUi','runSubmissionDialogSend','submitAdoptionSummary'].map(siteFunction).join('\n');
const now = Date.parse('2026-10-03T12:00:00Z'), day = 86400000;
function environment(store = new Map(), cookie = 'profile-one') {
  const profile = {magicCookie:cookie, settings:{}, publishPreference:{enabled:true, intervalDays:7, lastPromptAt:null}, usage:{useCount:2,publishedUseCount:0,pendingSummaries:{}}};
  const ui = {summaryInboxBtn:{style:{}},summaryInboxDot:{style:{}},submitSend:{},submitClose:{}};
  const ctx = vm.createContext({profile,ui,connected:true,PROFILE_KEY:'profile',USAGE_ENDPOINT_STORAGE_KEY:'endpoint',submissionInProgress:false,
    localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)},
    Date:class extends Date {static now(){return now;}}, nowIso:()=>new Date(now).toISOString(), migrateUsageSettings(){},
    window:{setTimeout:()=>1,clearTimeout(){}}, setSubmissionDialogStatus(){}, copySummaryToClipboard:async()=>true,
    fetchUsageStats:async()=>null,formatStatsLine:()=>'',recordSubmitStatus(){},asText:v=>String(v??'')});
  vm.runInContext(functions,ctx);
  return {ctx,profile,ui,store};
}
for (const event of ['manual','periodic','adoption']) for (const accepted of [true,false]) {
  test(`${event} ${accepted?'receipt':'failure'} updates the reminder only on acceptance`,async()=>{
    const {ctx,profile,ui,store}=environment();
    const summary={event_type:event,submission_id:'receipt',use_count_since_last_push:2};
    profile.usage.pendingSummaries[event]={summary,useCount:2};
    ctx.pendingSummaryDialog={summary};ctx.buildUsageSummary=()=>summary;
    ctx.submitUsageSummary=async()=>({ok:accepted});
    ctx.updateSummaryReminderUi();assert.equal(ui.summaryInboxBtn.style.display,'inline-flex');
    await (event==='adoption'?ctx.submitAdoptionSummary():ctx.runSubmissionDialogSend());
    assert.equal(ui.summaryInboxBtn.style.display,accepted?'none':'inline-flex');
    assert.equal(ctx.isSummaryDue(),!accepted);
    if(accepted){
      const reloaded=environment(store);reloaded.ctx.profile=JSON.parse(store.get('profile'));
      assert.equal(reloaded.ctx.isSummaryDue(),false);
      reloaded.ctx.profile.publishPreference.intervalDays=0;
      assert.equal(reloaded.ctx.isSummaryDue(),false);
    }
  });
}
test('another tab sees a receipt and cannot overwrite its reminder time with a stale profile',()=>{
  const store=new Map(), older=environment(store), sender=environment(store);
  sender.profile.publishPreference.lastPromptAt=new Date(now).toISOString();sender.ctx.persistProfile();
  older.ctx.updateSummaryReminderUi();assert.equal(older.ui.summaryInboxBtn.style.display,'none');
  older.profile.publishPreference.lastPromptAt=null;older.ctx.persistProfile();
  assert.equal(JSON.parse(store.get('profile')).publishPreference.lastPromptAt,new Date(now).toISOString());
});
test('receipt from a different profile does not suppress a reminder; interval boundary is respected',()=>{
  const store=new Map(), other=environment(store,'other');other.profile.publishPreference.lastPromptAt=new Date(now).toISOString();other.ctx.persistProfile();
  const own=environment(store);assert.equal(own.ctx.isSummaryDue(),true);
  own.profile.publishPreference.lastPromptAt=new Date(now-7*day+1).toISOString();assert.equal(own.ctx.isSummaryDue(),false);
  own.profile.publishPreference.lastPromptAt=new Date(now-7*day).toISOString();assert.equal(own.ctx.isSummaryDue(),true);
});
