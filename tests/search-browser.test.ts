import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import type {BrowserAutomation} from '../site/src/app.js';
import type {Catalogue, Site, LocationMatch} from '../site/src/types.js';
import {siteHtml} from '../scripts/site_source.ts';

declare const map: BrowserAutomation['map'];
declare const ui: BrowserAutomation['ui'];
declare const whsData: BrowserAutomation['whsData'];
declare const markersBySiteId: BrowserAutomation['markersBySiteId'];
declare const defaultProfile: BrowserAutomation['defaultProfile'];
declare let profile: BrowserAutomation['profile'];
declare let connected: boolean;
declare const runSearch: BrowserAutomation['runSearch'];
declare const refreshMarkers: BrowserAutomation['refreshMarkers'];
declare const closeTransientUi: BrowserAutomation['closeTransientUi'];

const chrome = process.env.MWH_CHROME_PATH || (process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
function site(id: string, name: string, country: string, lon: number, lat: number, component = false): Site {
  return {type: 'Feature', geometry: {type: 'Point', coordinates: [lon, lat]}, properties: {
    site_id: id, name, name_en: name, country, site_scope: component ? 'component' : 'whs',
    parent_site_id: component ? 'WHS 1' : '', component_count: component ? 1 : 20, aliases: []
  }};
}
const catalogue: Catalogue = {type: 'FeatureCollection', features: [
  site('WHS 1', 'Turkish fixture', 'Türkiye', 32, 39),
  site('MWH 1-001', 'Turkish component', 'Türkiye', 32.01, 39.01, true),
  site('WHS 2', 'Nearby fixture', 'Türkiye', 32.02, 39.02),
  site('WHS 21', 'Ancient City of Aleppo', 'Syrian Arab Republic', 37.1627777778, 36.1991666667),
  site('WHS 3', 'Neighbour inside region rectangle', 'Syrian Arab Republic', 32.03, 39.03),
  site('WHS 4', 'Shared parent', 'Türkiye, Syrian Arab Republic', 32.04, 39.04)
]};
const turkey: LocationMatch = {lat: '39', lon: '35', display_name: 'Türkiye', addresstype: 'country',
  address: {country: 'Türkiye'}, namedetails: {name: 'Türkiye', 'name:en': 'Turkey', alt_name: 'Turkiye;Türkiye'},
  boundingbox: ['35.8', '42.2', '25.6', '44.8']};

test('search uses country names, frames regions, and reveals sites only until the next real map movement', async () => {
  const browser = await chromium.launch({headless: true, executablePath: chrome});
  try {
    const page = await browser.newPage({viewport: {width: 1100, height: 800}});
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.abort());
    await page.route('https://unpkg.com/leaflet@1.9.4/dist/*', route => {
      const css = route.request().url().endsWith('.css');
      return route.fulfill({body: readFileSync(new URL(`../node_modules/leaflet/dist/leaflet.${css ? 'css' : 'js'}`, import.meta.url)),
        contentType: css ? 'text/css' : 'application/javascript', headers: {'Access-Control-Allow-Origin': '*'}});
    });
    await page.route('https://pekka-28.github.io/unesco/site/', route => route.fulfill({body: siteHtml(), contentType: 'text/html'}));
    await page.route('**/data/current/*.json', route => route.fulfill({json: {metadata: {}}}));
    await page.route('**/data/current/*.geojson', route => route.fulfill({json: catalogue}));
    await page.route('https://nominatim.openstreetmap.org/search?*', route => {
      const url = new URL(route.request().url());
      assert.equal(url.searchParams.get('addressdetails'), '1');
      assert.equal(url.searchParams.get('namedetails'), '1');
      const q = url.searchParams.get('q');
      const region: LocationMatch = {lat: '39', lon: '32', display_name: 'Region, Türkiye', addresstype: 'state',
        address: {country: 'Türkiye'}, boundingbox: ['38.9', '39.1', '31.9', '32.1']};
      const json = ['Turkey', 'Türkiye', 'Turkiye'].includes(q || '') ? [turkey] : q === 'Region' ? [region, turkey]
        : q === 'Unknownland' ? [{...turkey, display_name: 'Unknownland', address: {country: 'Unknownland'}, namedetails: {name: 'Unknownland'}}] : [];
      return route.fulfill({json, headers: {'Access-Control-Allow-Origin': '*'}});
    });
    await page.goto('https://pekka-28.github.io/unesco/site/');
    await page.waitForFunction(() => whsData?.features.length === 6 && markersBySiteId.size === 6);
    await page.evaluate(() => {
      closeTransientUi();
      profile = defaultProfile(); profile.settings.visitedOnly = true;
      profile.publishPreference.enabled = false; connected = true;
      refreshMarkers();
    });
    const saved = await page.evaluate(() => JSON.stringify({settings: profile?.settings, visits: profile?.siteVisits}));
    const visible = () => page.evaluate(() => [...markersBySiteId].filter(([, marker]) => map.hasLayer(marker)).map(([id]) => id).sort());
    const search = (query: string) => page.evaluate(async query => {ui.searchInput.value = query; await runSearch();}, query);
    assert.deepEqual(await visible(), []);
    for (const query of ['Turkey', 'Türkiye', 'Turkiye']) {
      await search(query);
      assert.deepEqual(await visible(), ['MWH 1-001', 'WHS 1', 'WHS 2', 'WHS 4']);
      assert(!await page.locator('#detail-pane').innerText().then(text => text.includes('Aleppo')));
      assert(await page.evaluate(() => map.getBounds().contains([[35.8, 25.6], [42.2, 44.8]])));
      await page.evaluate(() => map.panBy([30, 0], {animate: false}));
      assert.deepEqual(await visible(), [], 'pan must restore visited-only');
    }
    await search('Region');
    assert.deepEqual(await visible(), ['MWH 1-001', 'WHS 1', 'WHS 2', 'WHS 4']);
    assert(await page.evaluate(() => map.getBounds().contains([[38.9, 31.9], [39.1, 32.1]])));
    // Selecting the alternative geographic suggestion updates the list AND map.
    await page.locator('.result-row').filter({has: page.locator('strong', {hasText: /^Türkiye$/})}).click();
    assert(await page.evaluate(() => map.getBounds().contains([[35.8, 25.6], [42.2, 44.8]])));
    assert.deepEqual(await visible(), ['MWH 1-001', 'WHS 1', 'WHS 2', 'WHS 4']);
    await page.evaluate(() => map.setZoom(map.getZoom() + 1, {animate: false}));
    assert.deepEqual(await visible(), [], 'zoom must restore visited-only');

    await search('WHS 1');
    assert((await visible()).includes('MWH 1-001'));
    assert((await visible()).includes('WHS 2'), 'unmatched sites in the framed viewport are temporarily active');
    await search('');
    assert.deepEqual(await visible(), []);
    await search('Unknownland');
    assert.deepEqual(await visible(), []);
    assert.match(await page.locator('#detail-pane').innerText(), /country could not be matched/);
    await search('Turkey');
    await page.locator('.result-row strong').filter({hasText: /^Turkish fixture$/}).click();
    assert.deepEqual(await visible(), ['WHS 1'], 'individual selection retains the original one-site activation');
    await page.evaluate(() => map.panBy([30, 0], {animate: false}));
    assert.deepEqual(await visible(), []);
    assert.equal(await page.evaluate(() => JSON.stringify({settings: profile?.settings, visits: profile?.siteVisits})), saved);

    // Component suppression also returns on movement without visited-only.
    await page.evaluate(() => {if (profile) profile.settings.visitedOnly = false; refreshMarkers();});
    assert(!(await visible()).includes('MWH 1-001'));
    await search('Turkey');
    assert((await visible()).includes('MWH 1-001'));
    await page.evaluate(() => map.panBy([30, 0], {animate: false}));
    assert(!(await visible()).includes('MWH 1-001'));

    // A late response from a replaced search must not move the map or replace
    // the newest list. Exercise the real asynchronous fetch path.
    let release = () => {};
    let arrived = () => {};
    const held = new Promise<void>(resolve => {release = resolve;});
    const requested = new Promise<void>(resolve => {arrived = resolve;});
    await page.route('**/search?**q=Delayed', async route => {
      arrived(); await held;
      await route.fulfill({json: [turkey], headers: {'Access-Control-Allow-Origin': '*'}});
    });
    const pending = search('Delayed');
    try {
      await requested;
      await search('Region');
    } finally {release();}
    await pending;
    assert(await page.evaluate(() => map.getBounds().getEast() < 34));

    // Canonical register names and site IDs remain usable without the service.
    await page.route('https://nominatim.openstreetmap.org/search?*', route => route.fulfill({status: 503, body: ''}));
    await page.evaluate(() => {if (profile) profile.settings.visitedOnly = true; refreshMarkers();});
    await search('Türkiye');
    assert.deepEqual(await visible(), ['MWH 1-001', 'WHS 1', 'WHS 2', 'WHS 4']);
    await search('21');
    assert((await visible()).includes('WHS 21'));
    await search('No matching site');
    assert.deepEqual(await visible(), []);
    assert.deepEqual(errors, []);
  } finally {await browser.close();}
});
