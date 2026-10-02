import {siteHtml, siteFunction} from '../scripts/site_source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=siteHtml();
const key='mwh_usage_summary_endpoint';
const current='https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/usage-summary';
const previous=html.match(/previous: "([^"]+)"/)[1];
function environment(raw, saved=null, endpoints={current,previous}) {
 const stored=new Map([['mwh_profile',raw],['mwh_usage_summary_token','old-token']]);
 if(saved!==null) stored.set(key,saved);
 const ctx=vm.createContext({USAGE_SUMMARY_ENDPOINTS:endpoints,DEFAULT_USAGE_SUMMARY_ENDPOINT:endpoints.current,
  USAGE_ENDPOINT_STORAGE_KEY:key,PROFILE_KEY:'mwh_profile',profile:null,
  localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
  nowIso:()=> '2026-10-02T00:00:00Z', randomCookie:()=> '0123456789abcdef',PROFILE_SCHEMA_VERSION:1});
 vm.runInContext(html.slice(html.indexOf('    function getUsageSummaryEndpoint()'),html.indexOf('    async function fetchUsageStats()')),ctx);
 return {stored,ctx};
}
const makeProfile=endpoint=>({magicCookie:'unchanged',settings:{usageSummaryEndpoint:endpoint,usageSummaryToken:'obsolete'},siteVisits:{a:[{date:'2020',note:'keep'}]},usage:{pendingSummaries:{manual:{summary:{submission_id:'pending'}}}}});

test('startup fills missing/empty settings and migrates only the exact previous endpoint',()=>{
 for(const saved of [null,'','  ',previous]){
  const old=makeProfile(previous),{stored,ctx}=environment(JSON.stringify(old),saved);
  ctx.migrateStoredUsageSettings();
  const expected=structuredClone(old);expected.settings.usageSummaryEndpoint=current;expected.settings.usageSummaryToken='';
  assert.deepEqual(JSON.parse(stored.get('mwh_profile')),expected);
  assert.equal(stored.get(key),current);assert.equal(ctx.getUsageSummaryEndpoint(),current);
  assert.equal(stored.has('mwh_usage_summary_token'),false);
 }
});
test('custom settings survive startup and reload; clearing local storage restores current',()=>{
 const custom='https://custom.example/report';
 for(const saved of [null,custom]){
  const {stored,ctx}=environment(JSON.stringify(makeProfile(custom)),saved);
  ctx.migrateStoredUsageSettings();ctx.migrateStoredUsageSettings();
  assert.equal(ctx.getUsageSummaryEndpoint(),custom);assert.equal(stored.get(key),custom);
  assert.equal(JSON.parse(stored.get('mwh_profile')).settings.usageSummaryEndpoint,custom);
  stored.set(key,'');ctx.migrateStoredUsageSettings();assert.equal(ctx.getUsageSummaryEndpoint(),current);
 }
});
test('a future release migrates regular settings and preserves overrides',()=>{
 const next={current:'https://next.example/usage',previous:current};
 for(const saved of [current,'https://custom.example/usage']){
  const {stored,ctx}=environment(JSON.stringify(makeProfile(saved)),saved,next);
  ctx.migrateStoredUsageSettings();
  assert.equal(stored.get(key),saved===current?next.current:saved);
 }
});
test('unreadable profiles are preserved; a new profile inherits the browser endpoint',()=>{
 const {stored,ctx}=environment('{unreadable','https://custom.example/usage');ctx.migrateStoredUsageSettings();
 assert.equal(stored.get('mwh_profile'),'{unreadable');
 vm.runInContext(html.slice(html.indexOf('    function defaultProfile()'),html.indexOf('    function incrementCensusUse()')),ctx);
 assert.equal(ctx.defaultProfile().settings.usageSummaryEndpoint,'https://custom.example/usage');
});
test('saving or importing a profile persists its override; blank/previous reset to current',()=>{
 for(const value of ['',previous,'https://custom.example/import']){
  const {stored,ctx}=environment('{}',current);ctx.profile=makeProfile(value);
  vm.runInContext(siteFunction('persistProfile'),ctx);
  ctx.persistProfile();const saved=JSON.parse(stored.get('mwh_profile'));
  assert.equal(saved.settings.usageSummaryEndpoint,value===''||value===previous?current:value);
  assert.equal(stored.get(key),saved.settings.usageSummaryEndpoint);
  assert.equal(saved.magicCookie,'unchanged');assert.deepEqual(saved.siteVisits,makeProfile(value).siteVisits);
  assert.equal(saved.usage.pendingSummaries.manual.summary.submission_id,'pending');
 }
 assert.doesNotMatch(html,/no-cors|sendBeacon/);
});
