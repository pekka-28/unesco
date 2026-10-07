import {stats as parseStats} from '../supabase/functions/_shared/contracts.ts';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { previousMonth, renderReport } from '../supabase/functions/_shared/monthly-report.ts';
export { previousMonth, renderReport };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const period = previousMonth();
  const response = await fetch(`${url}/rest/v1/rpc/usage_stats`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_at: period.start_at, end_at: period.end_at }), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Monthly report query failed: HTTP ${response.status}`);
  const stats = parseStats(await response.json());
  await writeFile('monthly-usage.txt', renderReport(period, stats));
}
