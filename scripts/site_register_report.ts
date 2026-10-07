import {register} from './catalogue_contract.ts';
import type {RegisterSite} from './catalogue_contract.ts';
type Change = RegisterSite & {changed_fields?: string[]};
type Changes = Record<'added'|'retired'|'reactivated'|'changed'|'removed', Change[]>;
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

function indexed(value: unknown) {
  const catalogue = register(value);
  const sites = new Map<string, RegisterSite>();
  for (const s of catalogue.sites) {
    if (!s.site_id || sites.has(s.site_id)) throw new Error('Missing or duplicate site ID');
    sites.set(s.site_id, s);
  }
  return sites;
}

export function compareRegisters(before: unknown, after: unknown) {
  const old = indexed(before), current = indexed(after);
  const result: Changes = { added: [], retired: [], reactivated: [], changed: [], removed: [] };
  for (const [id, s] of current) {
    const previous = old.get(id);
    if (!previous) { result.added.push(s); continue; }
    if (previous.status !== 'retired' && s.status === 'retired') result.retired.push(s);
    if (previous.status === 'retired' && s.status === 'active') result.reactivated.push(s);
    const fields = [...new Set([...Object.keys(previous), ...Object.keys(s)])]
      .filter(k => k !== 'status' && !isDeepStrictEqual(previous[k], s[k])).sort();
    if (fields.length) result.changed.push({ ...s, changed_fields: fields });
  }
  for (const [id, s] of old) if (!current.has(id)) result.removed.push(s);
  for (const list of Object.values(result)) list.sort((a, b) => a.site_id.localeCompare(b.site_id, 'en', { numeric: true }));
  return result;
}

export function renderRegisterReport(before: unknown, afterValue: unknown, { beforeRef, afterRef, runUrl = '', limit = 40 }: {beforeRef?:string;afterRef?:string;runUrl?:string;limit?:number} = {}) {
  const after = register(afterValue);
  const changes = compareRegisters(before, after);
  const lines = ['My World Heritage - site register update', '',
    `Compared commits: ${beforeRef || '(before)'} -> ${afterRef || '(after)'}`,
    'Comparison covers catalogue records; generation timestamps and formatting are ignored.',
    'Added records may be historical recoveries, not new UNESCO inscriptions.',
    'Retired means not matched in the latest source, not confirmed official delisting.', '',
    `Current entries: ${after.sites.length} (${after.sites.filter(s => s.status === 'active').length} active; ${after.sites.filter(s => s.status === 'retired').length} retired)`];
  if (runUrl) lines.push(`Refresh run: ${runUrl}`);
  for (const [key, label] of [['added', 'Added to register'], ['retired', 'Newly retired'], ['reactivated', 'Reactivated'], ['changed', 'Attributes changed'], ['removed', 'Removed entirely (requires review)']] as const) {
    const entries = changes[key];
    lines.push('', `${label}: ${entries.length} (${entries.filter(s => s.site_scope === 'whs').length} roots; ${entries.filter(s => s.site_scope === 'component').length} components)`);
    for (const s of entries.slice(0, limit)) lines.push(`- ${s.site_id}: ${String(s.name || '').replace(/[\r\n]+/g, ' ')}${s.changed_fields ? ' [' + s.changed_fields.join(', ') + ']' : ''}`);
    if (entries.length > limit) lines.push(`... ${entries.length - limit} more; see the JSON report artifact for the complete list.`);
  }
  if (Object.values(changes).every(list => list.length === 0)) lines.push('', 'No semantic site-register changes in this refresh.');
  const unmapped = after.metadata?.unmapped_source_ids;
  lines.push('', `Source roots without usable coordinates: ${Array.isArray(unmapped) ? unmapped.length : 'not recorded in this catalogue'}`);
  if (Array.isArray(unmapped) && unmapped.length) lines.push(unmapped.join(', '));
  return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [beforeRef, afterRef = 'HEAD', output = 'site-register-changes.txt'] = process.argv.slice(2);
  if (!beforeRef) throw new Error('Usage: node --import tsx scripts/site_register_report.ts BEFORE_COMMIT [AFTER_COMMIT] [OUTPUT]');
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 });
  // Resolve commit-only refs first; never let a ref be interpreted as a file/path or option.
  const resolve = (ref: string) => git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`).trim();
  const beforeSha = resolve(beforeRef), afterSha = resolve(afterRef);
  const load = (sha: string): unknown => JSON.parse(git('show', `${sha}:data/current/unesco_official_sites.json`).replace(/^\uFEFF/, ''));
  const before = load(beforeSha), after = load(afterSha);
  await writeFile(output, renderRegisterReport(before, after, { beforeRef: beforeSha, afterRef: afterSha, runUrl: process.env.RUN_URL }));
  await writeFile(output.replace(/\.txt$/, '') + '.json', JSON.stringify({ before: beforeSha, after: afterSha, changes: compareRegisters(before, after) }, null, 2) + '\n');
}
