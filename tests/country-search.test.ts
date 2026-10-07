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
