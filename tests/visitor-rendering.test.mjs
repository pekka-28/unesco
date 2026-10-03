import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {siteFunction} from '../scripts/site_source.mjs';

// Real compiled renderers in a real browser, with inert fixtures and no network.
const code = ['escapeHtml','safeExternalUrl','element','verifyProfile','getSiteVisits','normalizeDateOnly','renderDetail','renderSiteList','runSearch'].map(siteFunction).join('\n');
const payloads = ['<img src=x onerror="document.body.dataset.injected=1">', '" autofocus onfocus="document.body.dataset.injected=1" x="', '<svg onload="document.body.dataset.injected=1"></svg>', 'Text & "quotes" <tags> \'apostrophe\' 日本語\nsecond line', 'Long note '.repeat(30)+'"><img src=x onerror="document.body.dataset.injected=1">'];
const chrome = process.env.MWH_CHROME_PATH || (process.platform==='win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);

test('imported notes remain literal text in display, tooltip and editor; edit/delete keep exact identifiers', async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chrome});
 try {
  const page=await browser.newPage();
  await page.route('**/*',route=>route.abort());
  await page.setContent('<body><div id="detail-pane"></div><div id="search-results"></div></body>');
  await page.evaluate(()=>{
   Object.assign(window, {ui:{detailPane:document.querySelector('#detail-pane'),searchResults:document.querySelector('#search-results'),searchInput:{value:'test'},siteListMode:{value:'all'}},connected:true,selectedSiteId:'',PROFILE_SCHEMA_VERSION:1,componentCountByRootId:new Map(),listSortBy:'name',listSortDir:'asc',searchFocusBySiteId:new Map(),explicitVisibleSiteIds:new Set(),lastSearchedSiteIds:[]});
   Object.assign(window, {asText:v=>String(v??''),displayName:p=>p.name,getVisitStatus:()=> 'visited',detectNativeScriptName:p=>p.native_display||'',siteIdCaption:()=> 'WHS 1',criteriaHtml:()=>'',formatVisitDateForDisplay:v=>v,formatStatusLabel:v=>v,truncateText:(v,n)=>v.slice(0,n),defaultVisitDateValue:()=> '2025-01-01',ensureVisitStructures:()=>{},persistProfile:()=>{},assertValidSiteId:id=>id,errorMessage:e=>e.message,refreshMarkers:()=>{},isHighVolumeComponent:()=>false,latestVisitDate:()=> '2025-01-01',dateSortKey:v=>v,showLoading:()=>{},hideLoading:()=>{},map:{setView:()=>{}}});
   window.saveSiteVisit=(siteId,visit)=>{window.saved=visit;profile.siteVisits[siteId]=[visit];};
   window.deleteSiteVisit=(siteId,id)=>{window.deleted=id;profile.siteVisits[siteId]=[];};
  });
  await page.addScriptTag({content:code});
  for(const note of payloads){
   const id='visit " data-extra="<bad>&';
   await page.evaluate(({note,id})=>{
    window.profile=JSON.parse(JSON.stringify({schemaVersion:1,inspectedSiteIds:['WHS 1'],usage:{},siteVisits:{'WHS 1':[{id,date:'2025-01-01',status:'visited',note}]}}));
    if(!verifyProfile(profile).ok)throw new Error('Fixture must pass the import validator');
    window.feature={properties:{site_id:'WHS 1',name:'Example site',unesco_url:'https://example.invalid/site'}};
    renderDetail(feature);
   },{note,id});
   assert.equal(await page.locator('.visit-note-clip').textContent(),note.slice(0,72));
   assert.equal(await page.locator('.visit-note-clip').getAttribute('title'),note);
   assert.equal(await page.locator('.visit-edit').getAttribute('data-visit-id'),id);
   assert.equal(await page.locator('#detail-pane img, #detail-pane svg, #detail-pane [onfocus], #detail-pane [onerror]').count(),0);
   await page.locator('.visit-edit').click();
   assert.equal(await page.locator('#visit-note').inputValue(),note);
   await page.locator('#visit-save').click();
   assert.equal(await page.evaluate(()=>saved.note),note);
   assert.equal(await page.evaluate(()=>saved.id),id);
   await page.locator('.visit-delete').click();
   assert.equal(await page.evaluate(()=>deleted),id);
  }
  // Catalogue and remote search fields use the same trust boundary.
  const text=payloads[0];
  await page.evaluate(text=>{
   feature.properties={site_id:'WHS 1',name:text,native_display:text,note:text,inscription_date:text,unesco_url:'javascript:document.body.dataset.injected=1',wikipedia:'en:Example" onclick="bad'};
   renderDetail(feature);
  },text);
  assert.equal(await page.locator('h3').textContent(),text);
  assert.equal(await page.locator('h3 a').count(),0);
  assert.equal(await page.locator('#detail-pane img, #detail-pane [onclick]').count(),0);
  await page.evaluate(()=>{window.whsData={features:[feature]};renderSiteList('all');});
  assert.equal(await page.locator('.site-pick').getAttribute('title'),text);
  assert.equal(await page.locator('.site-name-clip').textContent(),text);
  await page.evaluate(text=>{window.buildWhsSearchResults=()=>[];window.buildGeoSearchResults=async()=>[{type:'geo',title:text,subtitle:text,lat:0,lon:0}];return runSearch();},text);
  assert.equal(await page.locator('.result-row strong').textContent(),text);
  assert.equal(await page.locator('.result-meta').textContent(),text);
  assert.equal(await page.locator('img, svg, [onerror], [onload], [onclick]').count(),0);
  assert.equal(await page.evaluate(()=>document.body.dataset.injected),undefined);
  for(const url of ['javascript:alert(1)','JaVaScRiPt:alert(1)','data:text/html,test','file:///tmp/test','//example.invalid','bad'])assert.equal(await page.evaluate(url=>safeExternalUrl(url),url),'');
  assert.equal(await page.evaluate(()=>safeExternalUrl('https://example.invalid/path?q=a&b=c')),'https://example.invalid/path?q=a&b=c');
 } finally {await browser.close();}
});

