import test from 'node:test';
import assert from 'node:assert/strict';
import { probeDatabase } from '../scripts/probe_supabase.ts';

test('probe requests database-backed stats with no admin credentials', async () => {
  let calls = 0;
  assert.equal(await probeDatabase('https://project.supabase.co', async (url, options) => {
    calls++;
    assert.equal(url.search, '?stats=1');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers, undefined);
    assert.equal(options.body, undefined);
    assert.equal(options.cache, 'no-store');
    return Response.json({ ok: true, stats: { active_datasets: 0, average_visited_sites: 0, window_days: 14 } });
  }), true);
  assert.equal(calls, 1);
});
test('static health, invalid content and database errors cannot pass the probe', async () => {
  for (const response of [Response.json({ ok: true }), new Response('<html>login</html>'),
    Response.json({ ok: false }, { status: 503 }), Response.json({ ok: true, stats: { active_datasets: -1, average_visited_sites: 0, window_days: 14 } })]) {
    await assert.rejects(probeDatabase('https://project.supabase.co', async () => response));
  }
});
test('missing or unsafe configuration fails before any request', async () => {
  for (const url of ['', 'http://project.supabase.co', 'https://user:password@project.supabase.co', 'https://project.supabase.co?token=secret']) {
    await assert.rejects(probeDatabase(url, () => assert.fail('Must not send request')));
  }
});
