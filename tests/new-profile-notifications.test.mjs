import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '../.local/node_modules/@electric-sql/pglite/dist/index.js';
import { createHandler } from '../supabase/functions/usage-summary/handler.mjs';
import { deliverNewProfiles, renderNewProfileMail, createMailSender } from '../supabase/functions/_shared/new-profile-mail.mjs';

test('new profiles queue once; old profiles, retries, failed writes and concurrent claims do not duplicate alerts', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(readFileSync(new URL('../supabase/migrations/202610010001_usage_summary.sql', import.meta.url), 'utf8'));
    const make = (id, cookie) => ({ submission_id: id, magic_cookie: cookie, submitted_at_utc: '2026-10-02T00:00:00Z',
      use_count_since_last_push: 0, visited_site_count: 4, event_type: 'manual', client_version: 'test' });
    const accept = async p => (await db.query('select public.accept_usage($1) as result', [p])).rows[0].result;
    await accept(make('old', 'aaaaaaaaaaaaaaaa'));
    await db.exec(readFileSync(new URL('../supabase/migrations/202610020001_new_profile_notifications.sql', import.meta.url), 'utf8'));
    const count = async () => (await db.query('select count(*)::int as n from public.new_profile_notifications')).rows[0].n;
    assert.equal(await count(), 0, 'No retrospective email');
    await accept(make('new', 'bbbbbbbbbbbbbbbb'));
    await accept(make('new', 'bbbbbbbbbbbbbbbb'));
    assert.equal(await count(), 1);
    await assert.rejects(accept(make('limited', 'bbbbbbbbbbbbbbbb')), /Rate limited/);
    await db.exec("update public.usage_submissions set received_at = now() - interval '1 minute'");
    await accept({ ...make('later', 'bbbbbbbbbbbbbbbb'), event_type: 'adoption' });
    await accept(make('old-later', 'aaaaaaaaaaaaaaaa'));
    assert.equal(await count(), 1, 'Only first accepted profile, regardless of event type');
    await db.exec('begin');
    await accept(make('rolled-back', 'cccccccccccccccc'));
    await db.exec('rollback');
    assert.equal(await count(), 1, 'Queue shares submission transaction');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.new_profile_notifications'), /permission denied/);
      await assert.rejects(db.query('select public.claim_new_profile_notifications()'), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const claim = async () => (await db.query('select * from public.claim_new_profile_notifications()')).rows;
    const [row] = await claim();
    assert.equal((await claim()).length, 0, 'Another worker cannot claim a live lease');
    const finish = async (token, ok) => (await db.query('select public.finish_new_profile_notification($1,$2,$3) as ok', [row.id, token, ok])).rows[0].ok;
    assert.equal(await finish('00000000-0000-0000-0000-000000000000', true), false);
    assert.equal(await finish(row.lease_token, false), true);
    assert.equal((await claim()).length, 0, 'Failure waits for retry');
    await db.exec("update public.new_profile_notifications set available_at = now() - interval '1 minute'");
    const [retry] = await claim();
    assert.equal(retry.attempts, 2);
    assert.equal(await finish(row.lease_token, true), false, 'Expired worker cannot acknowledge a new lease');
    assert.equal(await finish(retry.lease_token, true), true);
    assert.equal((await claim()).length, 0, 'Successful notification stays sent');
  } finally { await db.close(); }
});

test('mail targets only owner; failures return to queue and successful sends are acknowledged', async () => {
  const row = { id: 'alert-1', lease_token: 'lease-1', magic_cookie: 'private-cookie', submission_id: 'private-id',
    first_received_at: '2026-10-02T10:00:00Z', event_type: 'manual', visited_count: 4 };
  const mail = renderNewProfileMail(row);
  assert.equal(mail.to, 'pekka@data.co.za');
  assert.doesNotMatch(JSON.stringify(mail), /private-cookie|private-id/);
  for (const fail of [false, true]) {
    const calls = [];
    const result = await deliverNewProfiles({ rpc: async (name, body) => {
      calls.push([name, body]); return name.startsWith('claim') ? [row] : true;
    }, send: async () => { if (fail) throw new Error('Sensitive provider failure'); } });
    assert.equal(result.sent, fail ? 0 : 1);
    assert.equal(calls[1][1].p_success, !fail);
    assert.doesNotMatch(JSON.stringify(calls), /Sensitive/);
  }
});

test('email dispatch failure cannot undo an accepted submission; rejected writes never dispatch', async () => {
  const p = { submission_id: '12345678-1234-1234-1234-123456789abc', magic_cookie: '0123456789abcdef',
    submitted_at_utc: '2026-10-02T00:00:00Z', use_count_since_last_push: 0, visited_site_count: 0, event_type: 'adoption', client_version: 'test' };
  for (const accepted of [true, false]) {
    let calls = 0;
    const h = createHandler({ env: () => 'test', fetch: async () => accepted ? Response.json({ ok: true }) : Response.json({}, { status: 500 }),
      onAccepted: () => { calls++; throw new Error('Email failed'); } });
    const r = await h(new Request('https://test', { method: 'POST', body: JSON.stringify({ ...p, token: 'test' }) }));
    assert.equal(r.status, accepted ? 200 : 503);
    assert.equal(calls, accepted ? 1 : 0);
  }
});

test('Exchange uses application OAuth, fixed recipient and Sent Items', async () => {
  const env = name => ({ MWH_MS_TENANT_ID: 'tenant', MWH_MS_CLIENT_ID: 'app', MWH_MS_CLIENT_SECRET: 'secret' })[name];
  let tokens = 0, messages = 0;
  const sender = createMailSender(env, async (url, options) => {
    if (url.includes('login.microsoftonline.com')) {
      tokens++;
      assert.equal(options.body.get('grant_type'), 'client_credentials');
      assert.equal(options.body.get('scope'), 'https://graph.microsoft.com/.default');
      return Response.json({ access_token: 'access', expires_in: 3600 });
    }
    messages++;
    assert.equal(url, 'https://graph.microsoft.com/v1.0/users/pekka%40data.co.za/sendMail');
    const body = JSON.parse(options.body);
    assert.equal(body.saveToSentItems, true);
    assert.equal(body.message.toRecipients[0].emailAddress.address, 'pekka@data.co.za');
    assert.equal(options.headers.Authorization, 'Bearer access');
    return new Response(null, { status: 202 });
  });
  await sender(renderNewProfileMail({}), 'one');
  await sender(renderNewProfileMail({}), 'two');
  assert.equal(tokens, 1); assert.equal(messages, 2);
});

test('Exchange rejection and invalid token cannot acknowledge an email', async () => {
  const env = name => ({ MWH_MS_TENANT_ID: 'tenant', MWH_MS_CLIENT_ID: 'app', MWH_MS_CLIENT_SECRET: 'secret' })[name];
  for (const status of [401, 403, 429, 500, 200]) {
    const sender = createMailSender(env, async url => url.includes('login.microsoftonline.com')
      ? Response.json({ access_token: 'access', expires_in: 3600 }) : new Response(null, { status }));
    await assert.rejects(sender(renderNewProfileMail({}), 'one'), /Exchange rejected/);
  }
  await assert.rejects(createMailSender(env, async () => Response.json({}))(renderNewProfileMail({}), 'one'), /invalid access token/);
});
