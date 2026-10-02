import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const endpoint = 'https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/usage-summary';
function environment(raw) {
  const stored = new Map([['mwh_profile', raw], ['mwh_usage_summary_endpoint','https://old.example/exec'], ['mwh_usage_summary_token','old-token']]);
  const ctx = vm.createContext({ DEFAULT_USAGE_SUMMARY_ENDPOINT:endpoint, PROFILE_KEY:'mwh_profile',
    localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
    nowIso:()=> '2026-10-02T00:00:00Z', randomCookie:()=> '0123456789abcdef', PROFILE_SCHEMA_VERSION:1 });
  vm.runInContext(html.slice(html.indexOf('    function getUsageSummaryEndpoint()'),html.indexOf('    async function fetchUsageStats()')),ctx);
  return {stored,ctx};
}
test('cutover preserves visits, identity and pending receipt while migrating settings',()=>{
  const old={name:'Test',magicCookie:'0123456789abcdef',homeLat:1,settings:{dateFormat:'y-m-d',usageSummaryEndpoint:'https://old.example/exec',usageSummaryToken:'old-token'},siteVisits:{a:[{date:'2020',note:'keep'}]},usage:{pendingSummaries:{manual:{summary:{submission_id:'pending-id'},useCount:3}}}};
  const {stored,ctx}=environment(JSON.stringify(old)); ctx.migrateStoredUsageSettings();
  const expected=structuredClone(old); expected.settings.usageSummaryEndpoint=endpoint; expected.settings.usageSummaryToken='';
  assert.deepEqual(JSON.parse(stored.get('mwh_profile')),expected);
  assert.equal(stored.get('mwh_usage_summary_endpoint'),endpoint); assert.equal(stored.has('mwh_usage_summary_token'),false);
  stored.set('mwh_usage_summary_endpoint','https://old.example/again');
  assert.equal(ctx.getUsageSummaryEndpoint(),endpoint); assert.equal(ctx.getUsageSummaryToken(),'');
  ctx.migrateStoredUsageSettings(); assert.deepEqual(JSON.parse(stored.get('mwh_profile')),expected);
});
test('unreadable profile is preserved and new profiles default to Supabase',()=>{
  const {stored,ctx}=environment('{unreadable'); ctx.migrateStoredUsageSettings();
  assert.equal(stored.get('mwh_profile'),'{unreadable');
  vm.runInContext(html.slice(html.indexOf('    function defaultProfile()'),html.indexOf('    function incrementCensusUse()')),ctx);
  assert.equal(ctx.defaultProfile().settings.usageSummaryEndpoint,endpoint);
});
test('saving imported profiles also migrates the destination',()=>{
  const {stored,ctx}=environment('{}');
  ctx.profile={settings:{usageSummaryEndpoint:'https://old.example/import',usageSummaryToken:'old'},magicCookie:'unchanged',siteVisits:{a:[]}};
  const start=html.indexOf('    function persistProfile()'); vm.runInContext(html.slice(start,html.indexOf('\n',start)),ctx);
  ctx.persistProfile(); const saved=JSON.parse(stored.get('mwh_profile'));
  assert.equal(saved.settings.usageSummaryEndpoint,endpoint); assert.equal(saved.settings.usageSummaryToken,'');
  assert.equal(saved.magicCookie,'unchanged'); assert.deepEqual(saved.siteVisits,{a:[]});
  assert.doesNotMatch(html,/script\.google\.com|no-cors|sendBeacon/);
});
