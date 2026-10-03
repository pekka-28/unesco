import {array, object, text} from './contracts.ts';
import type {Period, Requester} from './contracts.ts';
const repository = 'pekka-28/unesco';
const cataloguePath = 'data/current/unesco_official_sites.json';
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(object(value)[k])]));
  return value;
}
const canonical = (value: unknown) => JSON.stringify(stable(value));

export function registerChanges(before: unknown, after: unknown) {
  const rows = (value: unknown) => array(object(value).sites).map(value=>{const row=object(value);return {...row,site_id:text(row.site_id),status:row.status};});
  const old = new Map(rows(before).map(s=>[s.site_id,s]));
  const current = new Map(rows(after).map(s=>[s.site_id,s]));
  const result: Record<'added' | 'retired' | 'reactivated' | 'changed' | 'removed', string[]> = {added:[], retired:[], reactivated:[], changed:[], removed:[]};
  for (const [id, site] of current) {
    const prior = old.get(id);
    if (!prior) result.added.push(id);
    else if (site.status === 'retired' && prior.status !== 'retired') result.retired.push(id);
    else if (site.status === 'active' && prior.status === 'retired') result.reactivated.push(id);
    else if (canonical(prior) !== canonical(site)) result.changed.push(id);
  }
  for (const id of old.keys()) if (!current.has(id)) result.removed.push(id);
  return result;
}

export async function monthlyRegisterReport(period: Period, request: Requester = fetch) {
  async function json(url: string): Promise<unknown> {
    const response = await request(url, {headers:{Accept:'application/vnd.github+json','User-Agent':'My-World-Heritage-monthly-report'}, signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`Catalogue history HTTP ${response.status}`);
    return response.json();
  }
  async function snapshot(at: string) {
    // GitHub's until is inclusive; subtract one millisecond for calendar boundaries.
    const until = new Date(Date.parse(at)-1).toISOString();
    const commits = await json(`https://api.github.com/repos/${repository}/commits?sha=main&path=${cataloguePath}&until=${encodeURIComponent(until)}&per_page=1`);
    const first = array(commits)[0];
    const sha = first == null ? '' : text(object(first).sha);
    if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('No catalogue history at boundary');
    return {sha, data:object(await json(`https://raw.githubusercontent.com/${repository}/${sha}/${cataloguePath}`))};
  }
  const before = await snapshot(period.start_at), after = await snapshot(period.end_at);
  const changes = registerChanges(before.data, after.data);
  const lines = ['', 'Site register changes', '', `Period: ${period.label}`, `Current entries at period end: ${array(after.data.sites).length}`,
    'These are register records, including components; additions are not necessarily new UNESCO inscriptions.',
    'Retired means absent from the latest source, not confirmed official delisting.'];
  for (const [kind, ids] of Object.entries(changes)) {
    lines.push(`${kind[0].toUpperCase()+kind.slice(1)}: ${ids.length}`);
    if (ids.length) lines.push(ids.slice(0,40).join(', ')+(ids.length>40?' (more in Git comparison)':''));
  }
  lines.push(`Git comparison: https://github.com/${repository}/compare/${before.sha}...${after.sha}`);
  return lines.join('\n')+'\n';
}
