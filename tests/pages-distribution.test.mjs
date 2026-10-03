import {siteHtml} from '../scripts/site_source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readdir, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {buildPages, files} from '../scripts/build_pages.mjs';

test('distribution contains only the canonical runtime, user guide, current data and compatibility redirect', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'mwh-pages-'));
  const destination = path.join(parent, 'dist');
  await buildPages(destination);
  const actual = (await readdir(destination, {recursive:true, withFileTypes:true}))
    .filter(e=>e.isFile()).map(e=>path.relative(destination,path.join(e.parentPath,e.name)).replaceAll('\\','/'));
  assert.deepEqual(actual.sort(), [...files].sort());
  assert.equal(actual.length,28);
  assert(actual.every(f=>!f.startsWith('archive/') && !f.startsWith('scripts/') && !f.startsWith('supabase/') && !f.startsWith('data/history/')));
  assert.deepEqual(actual.filter(f=>f.startsWith('site-supabase/')),['site-supabase/index.html']);
  const html = await readFile(path.join(destination,'site/index.html'),'utf8');
  assert.match(html,/fjqhgcegnphavatrchjb\.supabase\.co\/functions\/v1\/usage-summary/);
  assert.doesNotMatch(html,/Supabase preview|extractWhsNumberFromSiteId/);
  const admin = await readFile(path.join(destination,'admin/index.html'),'utf8');
  assert.doesNotMatch(admin,/data-action="(?:refresh|publish|probe|deploy|sql)"|github-note|MWH_ADMIN_GITHUB_TOKEN/);
  await assert.rejects(buildPages(destination),/EEXIST/);
});

test('retired preview redirects without touching storage, retaining query and fragment', async () => {
  const html = siteHtml('redirect');
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let target;
  vm.runInNewContext(code,{URL,window:{location:{href:'https://pekka-28.github.io/unesco/site-supabase/index.html?submit=1#saved',search:'?submit=1',hash:'#saved',replace:value=>target=value}}});
  assert.equal(target,'https://pekka-28.github.io/unesco/site/?submit=1#saved');
  assert.doesNotMatch(html,/localStorage|fetch\(|DEFAULT_USAGE_SUMMARY_ENDPOINT/);
});
