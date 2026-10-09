import type {Catalogue, SiteProperties} from '../site/src/types.js';
import {browserContext} from './browser_context.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {siteFunction} from '../scripts/site_source.ts';
const data: Catalogue=JSON.parse(readFileSync(new URL('../data/current/unesco_official_sites.geojson',import.meta.url),'utf8').replace(/^\uFEFF/,''));
test('Slovakia search excludes Austrian Carnuntum while retaining the shared parent and Slovak components',()=>{
  const ctx=browserContext({whsData:data,asText:(v: unknown)=>String(v??''),displayName:(p: SiteProperties)=>p.name_en||p.name,
    WHS_ID_RE:/^WHS\s+(\d{1,6})$/,MWH_ID_RE:/^MWH\s+(\d{1,6})-(\d{3})$/});
  for(const f of ['parseWhsKeyQuery','rootWhsIdForProps','buildWhsSearchResults'])vm.runInContext(siteFunction(f),ctx);
  const rows=ctx.buildWhsSearchResults('Slovakia');
  assert(rows.length<196);assert(rows.some(r=>r.feature.properties.site_id==='WHS 1608'));
  assert(!rows.some(r=>r.title.includes('Carnuntum')));
  assert(rows.some(r=>r.feature.properties.component_ref==='725ter-007'));
  const austria=ctx.buildWhsSearchResults('Austria');assert(austria.some(r=>r.title.includes('Carnuntum')));
  for(const f of data.features.filter(f=>f.properties.site_scope==='component'))
    assert(f.properties.country,'All current components have an attributed country');
});

test('geographic country filtering uses actual register membership and handles dateline bounds', () => {
  const ctx = browserContext({whsData:data, asText:(v: unknown)=>String(v??'')});
  for (const f of ['normalizedCountryName','countryMemberships','resolveRegisterCountries','sitesInCountries','validSearchBounds','findSitesInBBox','geographicSearchSites']) vm.runInContext(siteFunction(f),ctx);
  const turkey = ctx.geographicSearchSites({type:'geo',title:'Turkey',subtitle:'Türkiye',lat:39,lon:35,
    bbox:[35.8,42.2,25.6,44.8],isCountry:true,countryNames:['Turkey','Türkiye']});
  assert(turkey.length > 20);
  assert(turkey.every(f=>f.properties.country?.includes('Türkiye')));
  assert(!turkey.some(f=>f.properties.site_id==='WHS 21'));
  assert(ctx.findSitesInBBox([35.8,42.2,25.6,44.8]).some(f=>f.properties.site_id==='WHS 21'), 'fixture reproduces the old rectangular false match');
  const slovakia = ctx.geographicSearchSites({type:'geo',title:'Slovakia',subtitle:'Slovakia',lat:48,lon:19,
    bbox:null,isCountry:true,countryNames:['Slovakia']});
  assert(!slovakia.some(f=>f.properties.site_id==='WHS 1608'), 'local components replace the shared parent in country results');
  assert(!slovakia.some(f=>f.properties.name_en?.includes('Carnuntum')));
  const sweden = ctx.geographicSearchSites({type:'geo',title:'Sweden',subtitle:'Sweden',lat:62,lon:15,
    bbox:[55,69,10,25],isCountry:true,countryNames:['Sweden']});
  assert(!sweden.some(f=>f.properties.site_id==='WHS 1187'), 'the Estonian representative marker must not be a Swedish search result');
  const struve = sweden.filter(f=>f.properties.parent_site_id==='WHS 1187');
  assert.equal(struve.length,4);
  assert(struve.every(f=>f.properties.country==='Sweden'));
  assert(sweden.some(f=>f.properties.site_id==='WHS 555'), 'single-country parent properties remain searchable');
  assert.deepEqual(Array.from(ctx.sitesInCountries(ctx.resolveRegisterCountries(['Sweden'])), f=>f.properties.site_id),
    Array.from(sweden, f=>f.properties.site_id), 'offline country matching follows the same component rule');
  assert.equal(ctx.geographicSearchSites({type:'geo',title:'Unknown',subtitle:'Unknown',lat:0,lon:0,
    bbox:[-90,90,-180,180],isCountry:true,countryNames:['Unknown']}).length,0);
  assert.equal(ctx.findSitesInBBox([90,-90,0,10]).length,0);
  assert.equal(ctx.findSitesInBBox([0,10,0,Infinity]).length,0);
  ctx.whsData = {type:'FeatureCollection', features: [-179,179,0].map((lon,i)=>({type:'Feature',geometry:{type:'Point',coordinates:[lon,0]},properties:{site_id:`WHS ${i+1}`}}))};
  assert.deepEqual(Array.from(ctx.findSitesInBBox([-10,10,170,-170]),f=>f.properties.site_id), ['WHS 1','WHS 2']);
});
