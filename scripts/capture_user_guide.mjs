// capture_user_guide.mjs: synthetic browser screenshots; all monitoring requests are mocked.
// Set MWH_PLAYWRIGHT_PATH to an installed Playwright package if it is not on Node's module path.
import {createRequire} from 'node:module';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {siteHtml} from './site_source.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MWH_PLAYWRIGHT_PATH||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'site/guide');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.MWH_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const shots=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:1200,height:1050},deviceScaleFactor:1});
 await context.route('https://pekka-28.github.io/**',async r=>{const rel=new URL(r.request().url()).pathname.replace(/^\/unesco\//,'');const file=path.resolve(root,rel||'site/index.html');if(!file.startsWith(root))return r.abort();const actual=rel==='site/'?'site/index.html':rel==='admin/'?'admin/index.html':rel;const body=actual==='site/index.html'?siteHtml():actual==='admin/index.html'?siteHtml('admin'):await readFile(path.join(root,actual));const ext=path.extname(actual);await r.fulfill({body,contentType:({'.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.geojson':'application/json','.png':'image/png'})[ext]||'text/plain'});});
 await context.route('https://*.supabase.co/**',async r=>{const headers={'Access-Control-Allow-Origin':'https://pekka-28.github.io','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,GET,OPTIONS'};if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});let json;
 if(r.request().url().includes('/owner-admin')){const b=r.request().postDataJSON();json=b.action==='verify'?{access_token:'synthetic-guide-token',expires_in:900}:b.action==='read'?{data:b.entity==='status'?[{database:'Available',checked_at:'2026-10-03T08:00:00Z'}]:[{received_at:'2026-10-03T08:00:00Z',name:'Example visitor',event_type:'manual',visited_count:12,source:'my-world-heritage'}]}:{accepted:true,message:'Example sign-in request accepted',id:'example-operation'};}
 else if(r.request().url().includes('histogram'))json={ok:true,histogram:{buckets:Array.from({length:10},(_,i)=>({lower_bound:i*10,upper_bound:(i+1)*10,height:[.5,1,.8,.6,.4,.3,.2,.15,.1,.05][i]}))}};
 else if(r.request().method()==='POST')json={ok:true,submission_id:r.request().postDataJSON().submission_id};else json={ok:true,stats:{active_datasets:10,average_visited_sites:12}};
 await r.fulfill({json,headers});});
 await context.route('https://nominatim.openstreetmap.org/**',r=>r.fulfill({json:[{lat:'51.48',lon:'0',display_name:'Greenwich, London, United Kingdom'}]}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function shot(name,selector){await page.waitForTimeout(250);const target=selector?page.locator(selector):page;await target.screenshot({path:path.join(out,name+'.png'),...(selector?{}:{fullPage:true})});shots.push(name+'.png');}
 await page.goto('https://pekka-28.github.io/unesco/site/');await page.waitForFunction(()=>whsData&&markersBySiteId.size>0);await page.evaluate(()=>{document.dispatchEvent(new Event('pointerdown'));ui.enrolUserName.value='Example visitor';setEnrolHome(51.48,0,'Greenwich, London');renderEnrolNearby(51.48,0);});await shot('enrolment','#enrol-overlay .modal');
 await page.evaluate(()=>{profile=defaultProfile();profile.name='Example visitor';profile.homeLat=51.48;profile.homeLon=0;profile.homeLabel='Greenwich, London';profile.publishPreference={enabled:true,intervalDays:15,lastPromptAt:new Date().toISOString(),consentAskedAtStartup:true};persistProfile();ui.enrolOverlay.style.display='none';connectSilently();map.setView([51.48,0],6);});
 await page.evaluate(()=>renderSiteList('all'));await page.waitForTimeout(1000);await shot('map');
 await page.locator('#user-menu-toggle').click();await shot('user-menu','#user-menu');await page.locator('#user-menu-toggle').click();
 await page.locator('#search-input').fill('Greenwich');await page.locator('#search-btn').click();await page.locator('#search-results').waitFor({state:'visible'});await shot('search');
 await page.evaluate(()=>{ui.searchResults.style.display='none';const f=whsData.features.find(f=>String(f.properties.name_en||f.properties.name).includes('Greenwich'))||whsData.features[0];saveSiteVisit(f.properties.site_id,{id:'',date:'2025-06-12',status:'visited',note:'Example visit note'});renderDetail(f);});await shot('site-details','#detail-pane');await page.locator('.visit-edit').first().click();await shot('visit-edit','#detail-pane');
 await page.evaluate(()=>{closeTransientUi();openSettings();});await page.locator('#share-info-link').click();await shot('settings','#settings-overlay .modal');
 await page.evaluate(()=>{closeTransientUi();openSubmissionDialog(buildUsageSummary('manual'));});await shot('usage-summary','#submit-overlay .modal');await page.locator('#submit-send').click();await page.waitForFunction(()=>!submissionInProgress);await shot('usage-receipt','#submit-overlay .modal');
 await page.evaluate(()=>{closeTransientUi();openAppDialog();});await page.locator('#usage-histogram svg').waitFor();await page.setViewportSize({width:1200,height:1600});await shot('application','#help-overlay .modal');await page.setViewportSize({width:1200,height:1050});await page.evaluate(()=>closeTransientUi());
 await page.locator('#brand-mark-btn').hover();await shot('symbol','.brand-tooltip');
 const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>exportVisitedSummaryReport());const download=await downloadPromise;const report=await readFile(await download.path(),'utf8');await page.setContent(report);await shot('personal-summary');
 await page.goto('https://pekka-28.github.io/unesco/admin/#token_hash='+'a'.repeat(64));await shot('admin-sign-in');await page.locator('#verify').click();await page.locator('#workspace').waitFor({state:'visible'});await page.selectOption('#entity','submissions');await page.locator('#query button').click();await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('Example visitor'));await shot('administration');
 if(errors.length)throw new Error(errors.join('\n'));
 await writeFile(path.join(out,'capture.json'),JSON.stringify({source:'scripts/capture_user_guide.mjs',data:'Synthetic profile and monitoring responses; public catalogue and map tiles',screenshots:shots},null,2)+'\n');console.log('Captured '+shots.length+' synthetic screenshots');
}finally{await browser.close();}
