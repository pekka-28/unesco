import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {siteHtml} from '../scripts/site_source.ts';
import {object} from './fixtures.ts';

const chrome=process.env.MWH_CHROME_PATH || (process.platform==='win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
test('admin sign-in, safe rendering, schema order, export precision, mail command and logout',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:chrome});
 try {
  const context=await browser.newContext();
  const page=await context.newPage(),calls: Record<string,unknown>[]=[],errors: string[]=[],dialogs: string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
  await context.route('**/*',route=>route.abort());
  await context.route('https://pekka-28.github.io/unesco/admin/',route=>route.fulfill({body:siteHtml('admin'),contentType:'text/html'}));
  await context.route('https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/owner-admin',async route=>{
   const headers={'Access-Control-Allow-Origin':'https://pekka-28.github.io','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   const body=object(route.request().postDataJSON());calls.push(body);
   const json=body.action==='verify'?{access_token:'synthetic-token',expires_in:900}:
    body.action==='runs'?{data:[{name:'Deploy',created_at:'2026-10-03T01:02:03.456Z'}]}:
    body.action==='read'?{data:body.entity==='schema'?[{data_type:'text',is_nullable:'YES',column_name:'name',table_name:'usage_submissions'}]:
     body.entity==='status'?{checked_at:'2026-10-03T01:02:03.123456+00:00'}:[{name:'<img src=x onerror=alert(1)>',received_at:'2026-10-03T01:02:03.123456+00:00'}]}:{accepted:true,id:body.id};
   await route.fulfill({json,headers});
  });
  await page.goto('https://pekka-28.github.io/unesco/admin/#token_hash='+'a'.repeat(64));
  assert(!page.url().includes('token_hash'));
  assert.equal(await page.locator('#workspace').isVisible(),false);assert.equal(calls.length,0);
  await page.locator('#verify').click();await page.locator('#workspace').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#result')?.textContent?.includes('checked_at'));
  assert(!(await page.locator('#result').innerText()).includes('.123456'));
  assert.equal(await page.locator('[data-action="refresh"],[data-action="publish"],[data-action="probe"],#github-note,#runs,#health').count(),0);
  await page.selectOption('#entity','submissions');await page.locator('#query button').click();
  await page.waitForFunction(()=>document.querySelector('#result')?.textContent?.includes('<img'));
  assert.match(await page.locator('#result').innerText(),/<img src=x onerror=alert\(1\)>/);assert.equal(await page.locator('#result img').count(),0);
  await page.selectOption('#entity','schema');await page.locator('#query button').click();
  await page.waitForFunction(()=>document.querySelector('#result')?.textContent?.includes('column_name'));
  assert.deepEqual(await page.locator('#result th').allTextContents(),['table_name','column_name','data_type','is_nullable']);
  await page.selectOption('#entity','workflow-status');await page.locator('#query button').click();
  await page.waitForFunction(()=>document.querySelector('#result')?.textContent?.includes('Deploy'));
  assert(!(await page.locator('#result').innerText()).includes('.456'));
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
  const file=await download.path();assert(file);assert.match(await readFile(file,'utf8'),/\.456Z/);
  await page.locator('[data-action="monthly-mail"]').click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Operation accepted'));
  assert.equal(calls.filter(call=>call.action==='monthly-mail').length,1);
  await page.locator('#logout').click();await page.locator('#signin').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('mwh_admin_session')),null);
  assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);
 } finally {await browser.close();}
});
