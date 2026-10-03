import {object, number, array} from '../_shared/contracts.ts';
import type {Environment, Requester} from '../_shared/contracts.ts';
interface Summary { submitted_at_utc: string; magic_cookie: string; use_count_since_last_push: number; visited_site_count: number; event_type: string; client_version: string; name?: string; submission_id?: string }
export function createHandler({ env, fetch: request = fetch, now = () => new Date(), onAccepted = () => {} }: {env: Environment; fetch?: Requester; now?: () => Date; onAccepted?: (id: string) => void}) {
  const origin = env('MWH_ALLOWED_ORIGIN') || 'https://pekka-28.github.io';
  const headers = { 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    const url = env('SUPABASE_URL');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Service not configured');
    const response = await request(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const error = object(await response.json().catch(() => ({})));
      const rateLimited = error.message === 'Rate limited';
      throw Object.assign(new Error(rateLimited ? 'Rate limited; retry later.' : 'Submission service unavailable.'),
        { status: rateLimited ? 429 : 503 });
    }
    return response.json();
  }
  return async (req: Request) => {
    if (req.headers.get('origin') && req.headers.get('origin') !== origin) return reply({ ok: false, error: 'Origin not allowed' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      if (req.method === 'GET') {
        if (new URL(req.url).searchParams.get('histogram') === '1') {
          const histogram = object(await rpc('usage_histogram', {}));
          const buckets = array(histogram.buckets).map(value => {
            const bucket = object(value);
            return {lower_bound:number(bucket.lower_bound),upper_bound:number(bucket.upper_bound),height:number(bucket.height)};
          });
          return reply({ ok: true, histogram: { visible: true,
            buckets, population: 'latest_per_profile', bucket_count: 10 } });
        }
        if (new URL(req.url).searchParams.get('stats') !== '1') return reply({ ok: true, service: 'mwh-supabase', version: 1 });
        const end = now();
        const stats = object(await rpc('usage_stats', { start_at: new Date(+end - 14 * 86400000).toISOString(), end_at: end.toISOString() }));
        // Only coarse aggregates are public; cookies and individual rows stay private.
        return reply({ ok: true, stats: { active_datasets: number(stats.active_datasets),
          average_visited_sites: number(stats.average_visited_sites), window_days: 14 } });
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
      let p: Record<string, unknown>;
      try { p = object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); }
      catch { return reply({ ok: false, error: 'Invalid JSON' }, 400); }
      const token = env('MWH_INGEST_TOKEN');
      if (token && p?.token !== token) return reply({ ok: false, error: 'Invalid token' }, 401);
      const count = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 2147483647;
      if (typeof p.magic_cookie !== 'string' || !/^[a-f0-9]{16,64}$/i.test(p.magic_cookie) ||
          typeof p.submitted_at_utc !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(p.submitted_at_utc) || !Number.isFinite(Date.parse(p.submitted_at_utc)) ||
          !count(p.use_count_since_last_push) || !count(p.visited_site_count) ||
          typeof p.event_type !== 'string' || !['adoption', 'manual', 'periodic'].includes(p.event_type) ||
          typeof p.client_version !== 'string' || p.client_version.length > 32 ||
          (p.name != null && (typeof p.name !== 'string' || p.name.length > 80 || /[\u0000-\u001f\u007f-\u009f]/.test(p.name))) ||
          (p.submission_id != null && (typeof p.submission_id !== 'string' || !/^[a-f0-9-]{32,64}$/i.test(p.submission_id)))) {
        return reply({ ok: false, error: 'Invalid usage summary' }, 400);
      }
      // Only the profile Name is retained; home location and individual visits are excluded.
      const clean: Summary = { submitted_at_utc: new Date(p.submitted_at_utc).toISOString(), magic_cookie: p.magic_cookie,
        use_count_since_last_push: p.use_count_since_last_push, visited_site_count: p.visited_site_count,
        event_type: p.event_type, client_version: p.client_version };
      if (typeof p.name === 'string' && p.name.trim()) clean.name = p.name.trim();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(clean)));
      clean.submission_id = p.submission_id || Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      const receipt = object(await rpc('accept_usage', { p: clean }));
      if (receipt?.ok === true) {
        // Email is independent of the committed receipt, including duplicate retries.
        try { onAccepted(clean.submission_id); } catch { /* the durable queue retains the alert */ }
      }
      return reply(receipt);
    } catch (error) {
      const limited = error instanceof Error && 'status' in error && error.status === 429;
      return reply({ ok: false, error: limited ? error.message : 'Service unavailable; retry the same submission.' }, limited ? 429 : 503);
    }
  };
}
