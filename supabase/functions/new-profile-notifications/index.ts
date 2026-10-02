import { createRpc, createMailSender, mailConfigured, deliverNewProfiles } from '../_shared/new-profile-mail.mjs';

const env = (name: string) => Deno.env.get(name);
Deno.serve(async (req) => {
  const token = env('MWH_NOTIFICATION_TOKEN');
  if (!token || req.headers.get('authorization') !== `Bearer ${token}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (req.method !== 'POST') return Response.json({ ok: false }, { status: 405 });
  if (!mailConfigured(env)) return Response.json({ ok: false, error: 'Owner email is not configured' }, { status: 503 });
  try {
    if (req.headers.get('x-mwh-delivery-test') === 'true') {
      await createMailSender(env)({ to: 'pekka@data.co.za', subject: 'My World Heritage - Supabase delivery test',
        text: 'This test was sent by the deployed Supabase notification function through Exchange 365, using its unattended application authorisation.\n\nPlease confirm receipt in the chat. No new-user event was created.' }, crypto.randomUUID());
      return Response.json({ ok: true, test: true, accepted: true }, { status: 202 });
    }
    const result = await deliverNewProfiles({ rpc: createRpc(env), send: createMailSender(env) });
    return Response.json({ ok: result.failed === 0, ...result }, { status: result.failed ? 503 : 200 });
  } catch (error) {
    // Our adapters report only operation names/status codes, never provider bodies or credentials.
    const detail = error instanceof Error ? error.message : 'Delivery failed';
    console.error('New-profile delivery failed; pending notifications retained:', detail);
    return Response.json({ ok: false, error: detail }, { status: 503 });
  }
});
