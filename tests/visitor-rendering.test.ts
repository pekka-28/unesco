import type {BrowserAutomation} from '../site/src/app.js';
import type {Site, Profile, Visit, GeoResult} from '../site/src/types.js';
// Only these fixture globals exist in the isolated renderer page.
declare const window: Window & {
 profile: Profile; feature: Site; saved: Partial<Visit>; deleted: string;
 whsData: {features: Site[]};
 saveSiteVisit: BrowserAutomation['saveSiteVisit'];
 deleteSiteVisit: (siteId: string, id: string) => void;
 buildWhsSearchResults: () => never[];
 buildGeoSearchResults: () => Promise<GeoResult[]>;
};
declare const verifyProfile: BrowserAutomation['verifyProfile'];
declare const renderDetail: BrowserAutomation['renderDetail'];
declare const renderSiteList: BrowserAutomation['renderSiteList'];
declare const runSearch: BrowserAutomation['runSearch'];
declare const safeExternalUrl: BrowserAutomation['safeExternalUrl'];

import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {siteFunction} from '../scripts/site_source.ts';

// Real compiled renderers in a real browser, with inert fixtures and no network.
const code = ['escapeHtml','safeExternalUrl','element','verifyProfile','getSiteVisits','normalizeDateOnly','renderDetail','renderSiteList','parseWhsKeyQuery','normalizedCountryName','countryMemberships','resolveRegisterCountries','sitesInCountries','validSearchBounds','findSitesInBBox','geographicSearchSites','showSearchSites','runSearch'].map(siteFunction).join('\n');
const payloads = ['<img src=x onerror="document.body.dataset.injected=1">', '" autofocus onfocus="document.body.dataset.injected=1" x="', '<svg onload="document.body.dataset.injected=1"></svg>', 'Text & "quotes" <tags> \'apostrophe\' 日本語\nsecond line', 'Long note '.repeat(30)+'"><img src=x onerror="document.body.dataset.injected=1">'];
const chrome = process.env.MWH_CHROME_PATH || (process.platform==='win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);

test('imported notes remain literal text in display, tooltip and editor; edit/delete keep exact identifiers', async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chrome});
 try {
  const page=await browser.newPage();
  await page.route('**/*',route=>route.abort());
  await page.setContent('<body><div id="detail-pane"></div><div id="search-results"></div></body>');
  await page.evaluate(()=>{
   Object.assign(window, {searchRequestId:0,ui:{detailPane:document.querySelector('#detail-pane'),searchResults:document.querySelector('#search-results'),searchInput:{value:'test'},siteListMode:{value:'all'}},connected:true,selectedSiteId:'',PROFILE_SCHEMA_VERSION:1,componentCountByRootId:new Map(),listSortBy:'name',listSortDir:'asc',searchFocusBySiteId:new Map(),explicitVisibleSiteIds:new Set(),lastSearchedSiteIds:[]});
   Object.assign(window, {
    asText(v: unknown){return String(v??'');}, displayName(p: Site['properties']){return p.name;},
    getVisitStatus(){return 'visited';}, detectNativeScriptName(p: Site['properties']){return p.native_display||'';},
    siteIdCaption(){return 'WHS 1';}, criteriaHtml(){return '';}, formatVisitDateForDisplay(v: string){return v;},
    formatStatusLabel(v: string){return v;}, truncateText(v: string,n: number){return v.slice(0,n);},
    defaultVisitDateValue(){return '2025-01-01';}, ensureVisitStructures(){}, persistProfile(){},
    assertValidSiteId(id: string){return id;}, errorMessage(e: unknown){return e instanceof Error?e.message:String(e);},
    refreshMarkers(){}, isHighVolumeComponent(){return false;}, latestVisitDate(){return '2025-01-01';},
    dateSortKey(v: string){return v;}, showLoading(){}, hideLoading(){}, map:{setView(){},stop(){},getBounds(){return {contains(){return true;}};}},
    saveSiteVisit(siteId: string,visit: Partial<Visit>){window.saved=visit;window.profile.siteVisits[siteId]=[{id:'',date:'',status:'',note:'',createdAt:'',updatedAt:'',...visit}];},
    deleteSiteVisit(siteId: string,id: string){window.deleted=id;window.profile.siteVisits[siteId]=[];}
   });
  });
  await page.addScriptTag({content:code});
  for(const note of payloads){
   const id='visit " data-extra="<bad>&';
   await page.evaluate(({note,id})=>{
    window.profile={schemaVersion:1,name:'',homeLat:null,homeLon:null,homeLabel:'',magicCookie:'fixture',updatedAt:'',
     settings:{visitedOnly:false,dateFormat:'',lengthUnits:'',multipleThreshold:10,usageSummaryEndpoint:'',usageSummaryToken:''},
     publishPreference:{enabled:false,intervalDays:null,lastPromptAt:null,consentAskedAtStartup:false},
     inspectedSiteIds:['WHS 1'],usage:{firstUseAt:'',lastUseAt:'',useCount:0,inspectCount:0,publishedUseCount:0},
     siteVisits:{'WHS 1':[{id,date:'2025-01-01',status:'visited',note,createdAt:'',updatedAt:''}]}};
    if(!verifyProfile(window.profile).ok)throw new Error('Fixture must pass the import validator');
    window.feature={type:'Feature',geometry:{type:'Point',coordinates:[0,0]},properties:{site_id:'WHS 1',name:'Example site',unesco_url:'https://example.invalid/site'}};
    renderDetail(window.feature);
   },{note,id});
   assert.equal(await page.locator('.visit-note-clip').textContent(),note.slice(0,72));
   assert.equal(await page.locator('.visit-note-clip').getAttribute('title'),note);
   assert.equal(await page.locator('.visit-edit').getAttribute('data-visit-id'),id);
   assert.equal(await page.locator('#detail-pane img, #detail-pane svg, #detail-pane [onfocus], #detail-pane [onerror]').count(),0);
   await page.locator('.visit-edit').click();
   assert.equal(await page.locator('#visit-note').inputValue(),note);
   await page.locator('#visit-save').click();
   assert.equal(await page.evaluate(()=>window.saved.note),note);
   assert.equal(await page.evaluate(()=>window.saved.id),id);
   await page.locator('.visit-delete').click();
   assert.equal(await page.evaluate(()=>window.deleted),id);
  }
  // Catalogue and remote search fields use the same trust boundary.
  const text=payloads[0];
  await page.evaluate(text=>{
   window.feature.properties={site_id:'WHS 1',name:text,native_display:text,note:text,inscription_date:text,unesco_url:'javascript:document.body.dataset.injected=1',wikipedia:'en:Example" onclick="bad'};
   renderDetail(window.feature);
  },text);
  assert.equal(await page.locator('h3').textContent(),text);
  assert.equal(await page.locator('h3 a').count(),0);
  assert.equal(await page.locator('#detail-pane img, #detail-pane [onclick]').count(),0);
  await page.evaluate(()=>{window.whsData={features:[window.feature]};renderSiteList('all');});
  assert.equal(await page.locator('.site-pick').getAttribute('title'),text);
  assert.equal(await page.locator('.site-name-clip').textContent(),text);
  await page.evaluate(text=>{Object.assign(window,{buildWhsSearchResults(){return [];},async buildGeoSearchResults(): Promise<GeoResult[]>{return [{type:'geo',title:text,subtitle:text,lat:0,lon:0,bbox:null}];}});return runSearch();},text);
  assert.equal(await page.locator('.result-row strong').textContent(),text);
  assert.equal(await page.locator('.result-meta').textContent(),text);
  assert.equal(await page.locator('img, svg, [onerror], [onload], [onclick]').count(),0);
  assert.equal(await page.evaluate(()=>document.body.dataset.injected),undefined);
  for(const url of ['javascript:alert(1)','JaVaScRiPt:alert(1)','data:text/html,test','file:///tmp/test','//example.invalid','bad'])assert.equal(await page.evaluate(url=>safeExternalUrl(url),url),'');
  assert.equal(await page.evaluate(()=>safeExternalUrl('https://example.invalid/path?q=a&b=c')),'https://example.invalid/path?q=a&b=c');
 } finally {await browser.close();}
});

