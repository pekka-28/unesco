import {object} from '../supabase/functions/_shared/contracts.ts';
import { pathToFileURL } from 'node:url';

export async function probeDatabase(projectUrl: string | undefined, request: (url: URL, options: RequestInit) => Promise<Response> = fetch) {
  if (!projectUrl) throw new Error('SUPABASE_URL is not configured');
  const base = new URL(projectUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('SUPABASE_URL must be an HTTPS project origin without credentials');
  }
  // The bare health route does not touch Postgres. stats=1 executes the existing
  // read-only usage_stats SQL function through the Edge Function's private key.
  const url = new URL('/functions/v1/usage-summary?stats=1', base);
  const response = await request(url, { method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Database probe failed: HTTP ${response.status}`);
  const body = object(await response.json());
  const stats = object(body.stats);
  if (body.ok !== true || typeof stats.active_datasets !== 'number' || !Number.isInteger(stats.active_datasets) || stats.active_datasets < 0 ||
      typeof stats.average_visited_sites !== 'number' || !Number.isFinite(stats.average_visited_sites) || stats.average_visited_sites < 0 || stats.window_days !== 14) {
    throw new Error('Database probe did not receive a valid database-backed response');
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await probeDatabase(process.env.SUPABASE_URL);
  console.log('Database read succeeded. No submissions were created or modified.');
}
