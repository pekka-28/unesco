import {browserContext} from './browser_context.ts';
import {siteHtml} from '../scripts/site_source.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

test('selection reveals an unvisited marker through zoom, until the next redraw', () => {
  const html = siteHtml();
  const shown = new Set<CircleMarker>();
  class CircleMarker {
    feature: {properties:{site_id:string}};
    constructor(id: string) { this.feature={properties:{site_id:id}}; }
    setStyle() {} addTo() {shown.add(this);} getLatLng() {return {lat:1,lng:2};}
  }
  const marker = (id: string) => new CircleMarker(id);
  const markers = new Map(['selected','other','visited'].map(id=>[id,marker(id)]));
  const ctx = browserContext({L:{CircleMarker},connected:true,profile:{settings:{visitedOnly:true}},
    asText:String,isVisited:(id: string)=>id==='visited',isHighVolumeComponent:()=>false,
    explicitVisibleSiteIds:new Set(['other']),lastSearchedSiteIds:['other'],selectedSiteId:null,
    markerStyle:()=>({}),markersBySiteId:markers,searchFocusBySiteId:new Map(),
    layer:{eachLayer:(fn: (marker: CircleMarker)=>void)=>markers.forEach(fn)},
    map:{hasLayer:(m: CircleMarker)=>shown.has(m),removeLayer:(m: CircleMarker)=>shown.delete(m),setView(){
      assert(shown.has(markers.get('selected')!), 'selection must be visible before zoom');
    }},renderDetail(){}});
  vm.runInContext(html.slice(html.indexOf('    function shouldShowSite('),html.indexOf('    const markerStyle')),ctx);
  vm.runInContext(html.slice(html.indexOf('    let temporarilyVisibleSiteId'),html.indexOf('    function canonicalPlaceName')),ctx);
  ctx.refreshMarkers(); assert.equal(shown.size,1);
  ctx.zoomToSite('selected'); assert.equal(shown.size,2);
  assert(!shown.has(markers.get('other')!), 'unselected search hits remain filtered');
  ctx.refreshMarkers(); assert.equal(shown.size,1); assert(shown.has(markers.get('visited')!));
});
