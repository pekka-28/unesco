import {object, text} from '../supabase/functions/_shared/contracts.ts';
export interface RegisterSite extends Record<string, unknown> {
  site_id: string; parent_site_id?: string|null; status?: string|null; site_scope?: string|null;
  name?: string|null; component_ref?: string|null; lat?: number|null; lon?: number|null;
}
export interface Register extends Record<string,unknown> { schema?: string; sites: RegisterSite[]; metadata: Record<string, unknown> }
export function register(value: unknown, legacy = false): Register {
  const data = object(value);
  if ((!legacy && data.schema !== 'my-world-heritage-sites/v1') || !Array.isArray(data.sites)) throw new Error('Invalid canonical catalogue');
  const sites = data.sites.map((value: unknown) => {
    const row = object(value);
    const site_id = legacy && typeof row.site_id === 'number' ? String(row.site_id) : text(row.site_id);
    if (!site_id) throw new Error('Missing site ID');
    const result: RegisterSite = {...row, site_id};
    for (const key of ['status','site_scope','name','component_ref'] as const) {
      if (row[key] != null) result[key] = text(row[key]);
    }
    if (row.parent_site_id != null) result.parent_site_id = legacy && typeof row.parent_site_id === 'number' ? String(row.parent_site_id) : text(row.parent_site_id);
    for (const key of ['lat','lon'] as const) {
      if (row[key] != null) {
        if (typeof row[key] !== 'number' || !Number.isFinite(row[key])) throw new Error('Invalid coordinate');
        result[key] = row[key];
      }
    }
    return result;
  });
  return {...data, schema: data.schema === undefined ? undefined : text(data.schema), sites, metadata: data.metadata == null ? {} : object(data.metadata)};
}
