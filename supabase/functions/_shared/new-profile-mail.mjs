export function renderNewProfileMail(row) {
  return {
    to: 'pekka@data.co.za',
    subject: 'My World Heritage - new user report',
    text: `A new pseudonymous profile has reported to My World Heritage.\n\n` +
      (row.name ? `Name: ${row.name}\n` : '') +
      `First received: ${row.first_received_at}\n` +
      `First report type: ${row.event_type}\nVisited sites reported: ${row.visited_count}\n\n` +
      `This is the first accepted report from this profile, not a verified unique person.\n` +
      `No profile identifier, location or individual visit is included.\n`
  };
}

export function createRpc(env, request = fetch) {
  return async (name, body) => {
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    const response = await request(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Notification database operation failed: ${response.status}`);
    return response.json();
  };
}

export async function deliverNewProfiles({ rpc, send, submissionId = null }) {
  const rows = await rpc('claim_new_profile_notifications', { p_submission_id: submissionId, p_limit: submissionId ? 1 : 3 });
  let sent = 0, failed = 0;
  for (const row of rows) {
    let success = false;
    try { await send(renderNewProfileMail(row), row.id); success = true; }
    catch { failed++; }
    const finished = await rpc('finish_new_profile_notification', {
      p_id: row.id, p_lease_token: row.lease_token, p_success: success
    });
    if (!finished) throw new Error('Notification lease no longer owned');
    if (success) sent++;
  }
  return { sent, failed };
}

export function mailConfigured(env) {
  return ['MWH_MS_TENANT_ID', 'MWH_MS_CLIENT_ID', 'MWH_MS_CLIENT_SECRET'].every(name => Boolean(env(name)));
}

export function createMailSender(env, request = fetch) {
  let cachedToken, validUntil = 0;
  return async (mail, id) => {
    if (!mailConfigured(env)) throw new Error('Exchange application authorisation is not configured');
    if (!cachedToken || Date.now() >= validUntil) {
      const response = await request(`https://login.microsoftonline.com/${encodeURIComponent(env('MWH_MS_TENANT_ID'))}/oauth2/v2.0/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: env('MWH_MS_CLIENT_ID'), client_secret: env('MWH_MS_CLIENT_SECRET'),
          grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`Microsoft authorisation failed: ${response.status}`);
      const token = await response.json();
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
      const failure = await response.json().catch(() => ({}));
      const code = /^[A-Za-z0-9_.-]{1,80}$/.test(failure?.error?.code || '') ? ` (${failure.error.code})` : '';
      throw new Error(`Exchange rejected message: ${response.status}${code}`);
    }
    // Graph 202 means accepted for delivery, not confirmation of inbox receipt.
  };
}
