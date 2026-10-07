import type {Register} from './catalogue_contract.ts';
import {register} from './catalogue_contract.ts';
import {text} from '../supabase/functions/_shared/contracts.ts';
// Read-only Git audit. Recovered prior catalogue is a temporary conversion input,
// never an assertion that reconstructed records were present in an old output.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 });
const parse = (text: string) => register(JSON.parse(text.replace(/^\uFEFF/, '')), true);
const source = 'data/staging/unesco_source_raw.txt';
const catalogue = 'data/current/unesco_official_sites.json';
const commits = git('log', '--reverse', '--format=%H', 'HEAD', '--', source, catalogue).trim().split(/\s+/);
const manifest: {commit: string;source_blob:string;generated_at:string;role:string;proposed_tag:string}[] = [];
const prior = parse(git('show', `HEAD:${catalogue}`));
const originalIds = new Set(prior.sites.map(s => s.site_id));
const retained = new Map(prior.sites.map(s => [s.site_id, s]));
const conflicts = new Map<string,{site_id:string;current_ref:string|null|undefined;historical_ref:string|null|undefined}>();
let previousBlob: string|undefined;
for (const commit of commits) {
  let rawBlob: string, data: Register;
  try { rawBlob = git('rev-parse', `${commit}:${source}`).trim(); data = parse(git('show', `${commit}:${catalogue}`)); }
  catch { continue; }
  // Prove both source and output objects can actually be read.
  git('cat-file', '-s', rawBlob);
  const generated = text(data.metadata.generated_at);
  const role = manifest.length === 0 ? 'imported-baseline' : rawBlob === previousBlob ? 'unchanged-source-or-reprocessing' : 'changed-source';
  manifest.push({ commit, source_blob: rawBlob, generated_at: generated, role,
    proposed_tag: `unesco-ingest/${role === 'imported-baseline' ? 'imported-' : ''}${generated.replace(/[-:]/g, '')}-${commit.slice(0, 7)}` });
  previousBlob = rawBlob;
}
const recovered: {site_id:string;name:string|null|undefined;from_commit:string}[] = [];
const skipped: {commit:string;site_id:string;reason:string}[] = [];
// Prefer each absent entry's most recent known attributes.
for (const entry of [...manifest].reverse()) {
  const data = parse(git('show', `${entry.commit}:${catalogue}`));
  for (const s of data.sites) {
    // The baseline used bare numeric root keys. This is the documented,
    // unambiguous root-key migration, not component identity inference.
    if (/^\d{1,6}$/.test(String(s.site_id))) s.site_id = `WHS ${Number(s.site_id)}`;
    if (/^\d{1,6}$/.test(String(s.parent_site_id))) s.parent_site_id = `WHS ${Number(s.parent_site_id)}`;
    if (!/^(WHS \d{1,6}|MWH \d{1,6}-\d{3})$/.test(s.site_id)) {
      skipped.push({ commit: entry.commit, site_id: s.site_id, reason: 'legacy identifier requires explicit migration' }); continue;
    }
    const existing = retained.get(s.site_id);
    if (existing) {
      if (s.site_scope === 'component' && (existing.component_ref !== s.component_ref || existing.parent_site_id !== s.parent_site_id)) {
        conflicts.set(s.site_id, { site_id: s.site_id, current_ref: existing.component_ref, historical_ref: s.component_ref });
      }
      continue;
    }
    if (s.site_scope === 'component' && [...retained.values()].some(x => x.parent_site_id === s.parent_site_id && x.component_ref === s.component_ref && x.lat === s.lat && x.lon === s.lon)) {
      skipped.push({ commit: entry.commit, site_id: s.site_id, reason: 'same component location exists under a different ID' }); continue;
    }
    retained.set(s.site_id, { ...s, status: 'retired' });
    recovered.push({ site_id: s.site_id, name: s.name, from_commit: entry.commit });
  }
}
for (const id of conflicts.keys()) {
  // Do not restore an ID with evidence of historical reuse.
  if (!originalIds.has(id)) retained.delete(id);
}
for (const [id, s] of retained) {
  if (s.site_scope === 'component' && !retained.has(s.parent_site_id || '')) throw new Error(`Orphan candidate: ${id}`);
}
mkdirSync('data/provenance', { recursive: true });
mkdirSync('.local', { recursive: true });
writeFileSync('data/provenance/ingestion-history.json', JSON.stringify({
  basis: git('rev-parse', 'HEAD').trim(), note: 'Generation times are not proven fetch times. Roles do not establish successful workflow runs. Proposed tags have not been created.', entries: manifest
}, null, 2) + '\n');
const audit = { current_count: originalIds.size, recovered_count: retained.size - originalIds.size,
  recovered: recovered.filter(s => retained.has(s.site_id)), identity_conflicts: [...conflicts.values()],
  skipped_count: skipped.length, skipped_examples: skipped.slice(0, 20),
  policy: 'Normalize bare numeric root/parent keys to WHS keys; retain latest known entries as retired. No temporal fields. Ambiguous component ID reuse requires separate review; Git retains evidence.' };
writeFileSync('data/provenance/recovery-audit.json', JSON.stringify(audit, null, 2) + '\n');
prior.sites = [...retained.values()]; prior.metadata.site_count = prior.sites.length;
writeFileSync('.local/recovered-prior.json', JSON.stringify(prior));
console.log(JSON.stringify({ ingestion_points: manifest.length, current: originalIds.size, restored: audit.recovered_count, conflicts: conflicts.size, skipped: skipped.length }));
