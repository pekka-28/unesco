import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/usage-summary/handler.mjs';
import { previousMonth, renderReport } from '../scripts/monthly_usage_report.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const payload = { submission_id: '12345678-1234-1234-1234-123456789abc', submitted_at_utc: '2026-10-01T00:00:00Z',
  magic_cookie: '0123456789abcdef', use_count_since_last_push: 4, visited_site_count: 12, event_type: 'manual', client_version: '0.2.0' };
const makeRequest = p => new Request('https://test/usage-summary', { method: 'POST', headers: { Origin: 'https://pekka-28.github.io' }, body: JSON.stringify(p) });
function handler(rpc, extra = {}) { return createHandler({ env: k => ({ SUPABASE_URL: 'https://db', SUPABASE_SERVICE_ROLE_KEY: 'server-only', ...extra })[k], fetch: rpc }); }

test('CORS preflight works and disallowed origins cannot submit', async () => {
  const h = handler(() => assert.fail('No DB call expected'));
  assert.equal((await h(new Request('https://test', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await h(new Request('https://test', { method: 'POST', headers: { Origin: 'https://other' } }))).status, 403);
});
test('acknowledgement follows database acceptance and private fields are removed', async () => {
  const h = handler(async (url, options) => {
    assert.match(url, /accept_usage$/);
    const { p } = JSON.parse(options.body);
    assert.equal(p.token, undefined); assert.equal(p.user_agent, undefined);
    assert.equal(p.submission_id, payload.submission_id);
    return Response.json({ ok: true, submission_id: p.submission_id });
  });
  assert.equal((await (await h(makeRequest({ ...payload, token: 'secret', user_agent: 'private' }))).json()).ok, true);
});
test('write failures and rate limits cannot be reported as success', async () => {
  for (const message of ['Write failed', 'Rate limited']) {
    const response = await handler(async () => Response.json({ message }, { status: 400 }))(makeRequest(payload));
    assert.equal(response.status, message === 'Rate limited' ? 429 : 503);
    assert.equal((await response.json()).ok, false);
  }
});
test('token, counts and UTF-8 byte limits enforced before writes', async () => {
  const h = handler(() => assert.fail('Invalid input reached DB'), { MWH_INGEST_TOKEN: 'required' });
  assert.equal((await h(makeRequest(payload))).status, 401);
  assert.equal((await h(makeRequest({ ...payload, token: 'required', visited_site_count: -1 }))).status, 400);
  assert.equal((await h(makeRequest({ ...payload, token: 'required', extra: '界'.repeat(1500) }))).status, 413);
});
test('legacy payload has deterministic identity across retries', async () => {
  const ids = [];
  const h = handler(async (_, o) => { ids.push(JSON.parse(o.body).p.submission_id); return Response.json({ ok: true }); });
  const p = { ...payload }; delete p.submission_id;
  await h(makeRequest(p)); await h(makeRequest(p));
  assert.equal(ids[0], ids[1]); assert.equal(ids[0].length, 64);
});
test('monthly boundaries follow Johannesburg including year rollover', () => {
  assert.deepEqual(previousMonth(new Date('2026-01-01T06:00:00Z')), {
    start_at: '2025-11-30T22:00:00.000Z', end_at: '2025-12-31T22:00:00.000Z', label: '2025-12'
  });
  const text = renderReport({ label: '2026-09' }, { submissions: 0, active_datasets: 0, adoption: 0, manual: 0, periodic: 0, reported_uses: 0, average_visited_sites: 0 });
  assert.match(text, /Accepted submissions: 0/);
});

const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
function extract(start, end) { return html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start))); }
test('frontend rejects HTML and mismatched acknowledgement; never dispatches opaque fallback', async () => {
  const code = extract('    async function submitUsageSummary(summary)', '    async function copySummaryToClipboard');
  for (const reply of ['<html>login</html>', JSON.stringify({ ok: true }), JSON.stringify({ ok: true, submission_id: 'wrong' }), JSON.stringify({ ok: false })]) {
    let calls = 0;
    const ctx = vm.createContext({ getUsageSummaryEndpoint: () => 'https://test', getUsageSummaryToken: () => '', asText: x => String(x ?? ''), navigator: { userAgent: '' }, AbortSignal,
      fetch: async () => { calls++; return new Response(reply); } });
    vm.runInContext(code, ctx);
    assert.equal((await ctx.submitUsageSummary(payload)).ok, false);
    assert.equal(calls, 1);
  }
});
test('pending frontend submission is reused and usage snapshot stays fixed', () => {
  const code = extract('    function buildUsageSummary(', '    function isSummaryDue(');
  const profile = { usage: { useCount: 10, publishedUseCount: 3 }, magicCookie: payload.magic_cookie, siteVisits: {} };
  const ctx = vm.createContext({ profile, crypto, nowIso: () => payload.submitted_at_utc, asText: x => String(x ?? ''), APP_VERSION: 'test', persistProfile() {} });
  vm.runInContext(code, ctx);
  const first = ctx.buildUsageSummary('manual');
  profile.usage.useCount++;
  const retry = ctx.buildUsageSummary('periodic');
  assert.equal(first.submission_id, retry.submission_id);
  assert.equal(retry.use_count_since_last_push, 7);
  assert.equal(profile.usage.pendingSummaries.manual.useCount, 10);
});

test('frontend advances counters only for acknowledged snapshot, never clipboard copies', async () => {
  // Extract the function by its next sibling; avoid including unrelated UI handlers.
  const start = html.indexOf('    async function runSubmissionDialogSend()');
  // Use the known sibling boundary below rather than parsing JavaScript braces.
  const next = html.indexOf('\n    function ', start + 5);
  const functionCode = html.slice(start, next);
  for (const accepted of [false, true]) {
    const summary = { ...payload };
    const profile = { usage: { useCount: 12, publishedUseCount: 3, pendingSummaries: { manual: { summary, useCount: 10 } } }, publishPreference: {} };
    const ctx = vm.createContext({ profile, pendingSummaryDialog: { summary }, submissionInProgress: false,
      ui: { submitSend: {}, submitClose: {} }, window: { setTimeout: () => 1, clearTimeout() {} },
      setSubmissionDialogStatus() {}, submitUsageSummary: async () => ({ ok: accepted }),
      copySummaryToClipboard: async () => true, nowIso: () => payload.submitted_at_utc,
      persistProfile() {}, updateSummaryReminderUi() {}, fetchUsageStats: async () => null,
      formatStatsLine: () => '', recordSubmitStatus() {}, asText: x => String(x ?? '') });
    vm.runInContext(functionCode, ctx);
    await ctx.runSubmissionDialogSend();
    assert.equal(profile.usage.publishedUseCount, accepted ? 10 : 3);
  }
});
