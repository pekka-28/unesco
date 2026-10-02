import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Install this test-only PostgreSQL runtime with the command documented in TEST_PLAN.
import { PGlite } from '../.local/node_modules/@electric-sql/pglite/dist/index.js';

test('Postgres migration: private access, atomic receipt, retries and reporting', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(readFileSync(new URL('../supabase/migrations/202610010001_usage_summary.sql', import.meta.url), 'utf8'));
    const p = { submission_id: 'receipt-1', submitted_at_utc: '2026-10-01T00:00:00Z', magic_cookie: '0123456789abcdef',
      use_count_since_last_push: 5, visited_site_count: 8, event_type: 'manual', client_version: 'test' };
    const accept = async value => (await db.query('select public.accept_usage($1::jsonb) as result', [JSON.stringify(value)])).rows[0].result;
    assert.equal((await accept(p)).duplicate, false);
    assert.equal((await accept(p)).duplicate, true);
    await db.exec('set role service_role');
    assert.equal((await accept(p)).duplicate, true);
    await db.exec('reset role');
    await assert.rejects(accept({ ...p, visited_site_count: 99 }), /different content/);
    await assert.rejects(accept({ ...p, submission_id: 'receipt-2' }), /Rate limited/);
    assert.equal((await db.query('select count(*)::int as n from public.usage_submissions')).rows[0].n, 1);
    await db.exec("create function public.reject_test_write() returns trigger language plpgsql as $$ begin raise exception 'simulated write failure'; end $$; create trigger fail_write before insert on public.usage_submissions for each row execute function public.reject_test_write();");
    const second = { ...p, submission_id: 'receipt-3', magic_cookie: 'aaaaaaaaaaaaaaaa' };
    await assert.rejects(accept(second), /simulated write failure/);
    await db.exec('drop trigger fail_write on public.usage_submissions');
    assert.equal((await accept(second)).duplicate, false);
    const s = (await db.query("select public.usage_stats(now() - interval '1 day', now() + interval '1 day') as s")).rows[0].s;
    assert.equal(s.submissions, 2); assert.equal(s.active_datasets, 2); assert.equal(s.reported_uses, 10);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.usage_submissions'), /permission denied/);
      await assert.rejects(accept(p), /permission denied/);
      await assert.rejects(db.query('select public.usage_stats(now(), now())'), /permission denied/);
      await db.exec('reset role');
    }
  } finally { await db.close(); }
});
