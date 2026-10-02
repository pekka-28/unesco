export function createHandler({ env, fetch: request = fetch, now = () => new Date(), onAccepted = () => {} }) {
  const origin = env('MWH_ALLOWED_ORIGIN') || 'https://pekka-28.github.io';
  const headers = { 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  async function rpc(name, body) {
    const url = env('SUPABASE_URL');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Service not configured');
    const response = await request(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const rateLimited = error.message === 'Rate limited';
      throw Object.assign(new Error(rateLimited ? 'Rate limited; retry later.' : 'Submission service unavailable.'),
        { status: rateLimited ? 429 : 503 });
    }
    return response.json();
  }
  return async (req) => {
    if (req.headers.get('origin') && req.headers.get('origin') !== origin) return reply({ ok: false, error: 'Origin not allowed' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      if (req.method === 'GET') {
        if (new URL(req.url).searchParams.get('histogram') === '1') {
          const histogram = await rpc('usage_histogram', {});
          return reply({ ok: true, histogram: { visible: true,
            buckets: histogram.buckets, population: 'latest_per_profile', bucket_count: 10 } });
        }
        if (new URL(req.url).searchParams.get('stats') !== '1') return reply({ ok: true, service: 'mwh-supabase', version: 1 });
        const end = now();
        const stats = await rpc('usage_stats', { start_at: new Date(+end - 14 * 86400000).toISOString(), end_at: end.toISOString() });
        // Only coarse aggregates are public; cookies and individual rows stay private.
        return reply({ ok: true, stats: { active_datasets: stats.active_datasets,
          average_visited_sites: stats.average_visited_sites, window_days: 14 } });
      }
      if (req.method !== 'POST') return reply({ ok: false, error: 'Method not allowed' }, 405);
      const reader = req.body?.getReader();
      if (!reader) return reply({ ok: false, error: 'Body required' }, 400);
      const chunks = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) { await reader.cancel(); return reply({ ok: false, error: 'Payload too large' }, 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let p;
      try { p = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { return reply({ ok: false, error: 'Invalid JSON' }, 400); }
      const token = env('MWH_INGEST_TOKEN');
      if (token && p?.token !== token) return reply({ ok: false, error: 'Invalid token' }, 401);
      const count = (n) => Number.isInteger(n) && n >= 0 && n <= 2147483647;
      if (!p || !/^[a-f0-9]{16,64}$/i.test(p.magic_cookie || '') ||
          !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(p.submitted_at_utc || '') || !Number.isFinite(Date.parse(p.submitted_at_utc)) ||
          !count(p.use_count_since_last_push) || !count(p.visited_site_count) ||
          !['adoption', 'manual', 'periodic'].includes(p.event_type) ||
          typeof p.client_version !== 'string' || p.client_version.length > 32 ||
          (p.reporting_alias != null && (typeof p.reporting_alias !== 'string' || p.reporting_alias.length > 80 || /[\u0000-\u001f\u007f-\u009f]/.test(p.reporting_alias))) ||
          (p.submission_id != null && !/^[a-f0-9-]{32,64}$/i.test(p.submission_id))) {
        return reply({ ok: false, error: 'Invalid usage summary' }, 400);
      }
      // Only the explicitly optional reporting alias may identify a profile.
      const clean = { submitted_at_utc: new Date(p.submitted_at_utc).toISOString(), magic_cookie: p.magic_cookie,
        use_count_since_last_push: p.use_count_since_last_push, visited_site_count: p.visited_site_count,
        event_type: p.event_type, client_version: p.client_version };
      if (typeof p.reporting_alias === 'string' && p.reporting_alias.trim()) clean.reporting_alias = p.reporting_alias.trim();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(clean)));
      clean.submission_id = p.submission_id || Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const receipt = await rpc('accept_usage', { p: clean });
      if (receipt?.ok === true) {
        // Email is independent of the committed receipt, including duplicate retries.
        try { onAccepted(clean.submission_id); } catch { /* the durable queue retains the alert */ }
      }
      return reply(receipt);
    } catch (error) {
      return reply({ ok: false, error: error.status === 429 ? error.message : 'Service unavailable; retry the same submission.' }, error.status || 503);
    }
  };
}
