import {array, object, text, number, required} from './contracts.ts';
import type {Environment, Requester, Rpc, SendMail, Mail, Worker} from './contracts.ts';
import { reportTime } from './report-time.ts';
interface Notification {id: string; lease_token: string; name?: string; first_received_at: string; event_type: string; visited_count: number}
function notification(value: unknown): Notification {
  const row = object(value);
  return {id:text(row.id),lease_token:text(row.lease_token),
    ...(row.name == null ? {} : {name:text(row.name)}),first_received_at:text(row.first_received_at),
    event_type:text(row.event_type),visited_count:number(row.visited_count)};
}
export function renderNewProfileMail(row: Omit<Notification, 'id' | 'lease_token'>): Mail {
  return {
    to: 'pekka@data.co.za',
    subject: 'My World Heritage - new user report',
    text: `A new pseudonymous profile has reported to My World Heritage.\n\n` +
      (row.name ? `Name: ${row.name}\n` : '') +
      `First received: ${reportTime(row.first_received_at)}\n` +
      `First report type: ${row.event_type}\nVisited sites reported: ${row.visited_count}\n\n` +
      `This is the first accepted report from this profile, not a verified unique person.\n` +
      `No profile identifier, location or individual visit is included.\n`
  };
}

export function createRpc(env: Environment, request: Requester = fetch): Rpc {
  return async (name, body) => {
    const key = required(env, 'SUPABASE_SERVICE_ROLE_KEY');
    const response = await request(`${required(env, 'SUPABASE_URL')}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Notification database operation failed: ${response.status}`);
    return response.json();
  };
}

export async function deliverNewProfiles({ rpc, send, submissionId = null }: Worker & {submissionId?: string | null}) {
  const rows = array(await rpc('claim_new_profile_notifications', { p_submission_id: submissionId, p_limit: submissionId ? 1 : 3 })).map(notification);
  let sent = 0, failed = 0;
  for (const row of rows) {
    let success = false;
    try { await send(renderNewProfileMail(row), row.id); success = true; }
    catch { failed++; }
    const finished = await rpc('finish_new_profile_notification', {
      p_id: row.id, p_lease_token: row.lease_token, p_success: success
    });
    if (finished !== true) throw new Error('Notification lease no longer owned');
    if (success) sent++;
  }
  return { sent, failed };
}

export function mailConfigured(env: Environment) {
  return ['MWH_MS_TENANT_ID', 'MWH_MS_CLIENT_ID', 'MWH_MS_CLIENT_SECRET'].every(name => Boolean(env(name)));
}

export function createMailSender(env: Environment, request: Requester = fetch): SendMail {
  let cachedToken: string | null = null, validUntil = 0;
  return async (mail, id) => {
    if (!mailConfigured(env)) throw new Error('Exchange application authorisation is not configured');
    if (!cachedToken || Date.now() >= validUntil) {
      const response = await request(`https://login.microsoftonline.com/${encodeURIComponent(required(env, 'MWH_MS_TENANT_ID'))}/oauth2/v2.0/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: required(env, 'MWH_MS_CLIENT_ID'), client_secret: required(env, 'MWH_MS_CLIENT_SECRET'),
          grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`Microsoft authorisation failed: ${response.status}`);
      const token = object(await response.json());
      if (typeof token.access_token !== 'string' || !token.access_token || !Number.isFinite(Number(token.expires_in))) {
        throw new Error('Microsoft returned an invalid access token');
      }
      cachedToken = token.access_token;
      validUntil = Date.now() + Math.max(0, Number(token.expires_in) - 60) * 1000;
    }
    const sender = env('MWH_MS_MAIL_FROM') || 'pekka@data.co.za';
    const response = await request(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: 'POST', headers: { Authorization: `Bearer ${cachedToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { subject: mail.subject, body: { contentType: 'Text', content: mail.text },
        toRecipients: [{ emailAddress: { address: mail.to } }],
        internetMessageHeaders: [{ name: 'x-mwh-notification-id', value: id }] }, saveToSentItems: true }),
      signal: AbortSignal.timeout(15000)
    });
    if (response.status === 401) { cachedToken = null; validUntil = 0; }
    if (response.status !== 202) {
      let code = '';
      try {
        const failure = object(await response.json());
        const value = object(failure.error).code;
        if (typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value)) code = ` (${value})`;
      } catch { /* Provider diagnostics are optional and never exposed verbatim. */ }
      throw new Error(`Exchange rejected message: ${response.status}${code}`);
    }
    // Graph 202 means accepted for delivery, not confirmation of inbox receipt.
  };
}
