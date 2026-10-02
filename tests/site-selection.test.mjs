import {siteHtml, siteFunction} from '../scripts/site_source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('selection reveals an unvisited marker through zoom, until the next redraw', () => {
  const html = siteHtml();
  const shown = new Set();
  class CircleMarker {
    constructor(id) { this.feature={properties:{site_id:id}}; }
    setStyle() {} addTo() {shown.add(this);} getLatLng() {return {lat:1,lng:2};}
  }
  const marker = id => new CircleMarker(id);
  const markers = new Map(['selected','other','visited'].map(id=>[id,marker(id)]));
  const ctx = vm.createContext({L:{CircleMarker},connected:true,profile:{settings:{visitedOnly:true}},
    asText:String,isVisited:id=>id==='visited',isHighVolumeComponent:()=>false,
    explicitVisibleSiteIds:new Set(['other']),lastSearchedSiteIds:['other'],selectedSiteId:null,
    markerStyle:()=>({}),markersBySiteId:markers,searchFocusBySiteId:new Map(),
    layer:{eachLayer:fn=>markers.forEach(fn)},
    map:{hasLayer:m=>shown.has(m),removeLayer:m=>shown.delete(m),setView(){
      assert(shown.has(markers.get('selected')), 'selection must be visible before zoom');
    }},renderDetail(){}});
  vm.runInContext(html.slice(html.indexOf('    function shouldShowSite('),html.indexOf('    const markerStyle')),ctx);
  vm.runInContext(html.slice(html.indexOf('    let temporarilyVisibleSiteId'),html.indexOf('    function canonicalPlaceName')),ctx);
  ctx.refreshMarkers(); assert.equal(shown.size,1);
  ctx.zoomToSite('selected'); assert.equal(shown.size,2);
  assert(!shown.has(markers.get('other')), 'unselected search hits remain filtered');
  ctx.refreshMarkers(); assert.equal(shown.size,1); assert(shown.has(markers.get('visited')));
});
