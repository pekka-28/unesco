import test from 'node:test';
import assert from 'node:assert/strict';
import { createMonthlyHandler } from '../supabase/functions/monthly-report/handler.ts';

const stats = { submissions: 4, active_datasets: 2, adoption: 1, manual: 2, periodic: 1, reported_uses: 4, average_visited_sites: 38.5 };
function setup() {
  const queries = [], messages = [];
  const handler = createMonthlyHandler({ env: () => 'private-test-token',
    register: async () => '\nSite register changes\nAdded: 1\n',
    rpc: async (name, body) => { queries.push({name, body}); return stats; },
    send: async mail => { messages.push(mail); },
    now: () => new Date('2026-10-02T02:30:00Z'), id: () => 'test-id' });
  return { handler, queries, messages };
}
test('monthly report requires private authorisation before querying or sending', async () => {
  const {handler,queries,messages}=setup();
  assert.equal((await handler(new Request('https://example.test',{method:'POST'}))).status,401);
  assert.equal(queries.length,0); assert.equal(messages.length,0);
});
test('regular report uses the previous Johannesburg month and fixed owner', async () => {
  const {handler,queries,messages}=setup();
  const response=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer private-test-token'}}));
  assert.equal(response.status,202);
  assert.deepEqual(queries,[{name:'usage_stats',body:{start_at:'2026-08-31T22:00:00.000Z',end_at:'2026-09-30T22:00:00.000Z'}}]);
  assert.equal(messages[0].to,'pekka@data.co.za');
  assert.match(messages[0].text,/Site register changes/);
  assert.match(messages[0].text,/2026-09/); assert.doesNotMatch(messages[0].text,/current month to date/);
});
test('manual check adds a separately labelled current-month snapshot without writes', async () => {
  const {handler,queries,messages}=setup();
  const response=await handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer private-test-token','x-mwh-report-test':'true'}}));
  assert.equal(response.status,202);
  assert.deepEqual(queries[1],{name:'usage_stats',body:{start_at:'2026-09-30T22:00:00.000Z',end_at:'2026-10-02T02:30:00.000Z'}});
  assert.equal(messages.length,1); assert.match(messages[0].text,/Manual delivery check/);
  assert.match(messages[0].text,/38.5/);
});
