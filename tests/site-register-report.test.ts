import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRegisters, renderRegisterReport } from '../scripts/site_register_report.ts';
const site = (id: number, overrides: Record<string,unknown> = {}) => ({ site_id: `WHS ${id}`, name: `Site ${id}`, site_scope: 'whs', status: 'active', lat: 1, lon: 2, ...overrides });
const catalogue = (sites: unknown[]): {schema:string;sites:unknown[];metadata?:Record<string,unknown>} => ({ schema: 'my-world-heritage-sites/v1', sites });
test('separates additions, retirement, reactivation, attribute changes and removals', () => {
  const before = catalogue([site(1), site(2, { status: 'retired' }), site(3), site(4)]);
  const after = catalogue([site(1, { status: 'retired' }), site(2), site(3, { name: 'Renamed', lon: 4 }), site(5)]);
  const c = compareRegisters(before, after);
  assert.equal(c.added[0].site_id, 'WHS 5');
  assert.equal(c.retired[0].site_id, 'WHS 1');
  assert.equal(c.reactivated[0].site_id, 'WHS 2');
  assert.deepEqual(c.changed[0].changed_fields, ['lon', 'name']);
  assert.equal(c.removed[0].site_id, 'WHS 4');
});
test('ignores metadata, record ordering and object property ordering', () => {
  const before = { ...catalogue([site(1), site(2)]), metadata: { generated_at: 'old' } };
  const after = { ...catalogue([site(2), Object.fromEntries(Object.entries(site(1)).reverse())]), metadata: { generated_at: 'new' } };
  assert.match(renderRegisterReport(before, after), /No semantic site-register changes/);
});
test('email is bounded, counts components separately and highlights unmappable roots', () => {
  const after = catalogue([site(1), site(2, { site_id: 'MWH 1-001', site_scope: 'component' })]);
  after.metadata = { unmapped_source_ids: ['WHS 99'] };
  const text = renderRegisterReport(catalogue([]), after, { limit: 1 });
  assert.match(text, /2 \(1 roots; 1 components\)/);
  assert.match(text, /1 more/);
  assert.match(text, /WHS 99/);
});
test('invalid or duplicate-ID catalogues cannot produce misleading reports', () => {
  assert.throws(() => compareRegisters({}, catalogue([])), /Invalid/);
  assert.throws(() => compareRegisters(catalogue([site(1), site(1)]), catalogue([])), /duplicate/);
});

test('nullable optional catalogue attributes retain their meaning and malformed values are rejected',()=>{
 const original=catalogue([site(1,{parent_site_id:null,component_ref:null,lat:null,lon:null,name:null})]);
 assert.match(renderRegisterReport(original,original),/No semantic site-register changes/);
 for(const invalid of [{site_id:42},{lat:'not a coordinate'},{name:{text:'invalid'}}]) {
  assert.throws(()=>compareRegisters(original,catalogue([site(1,invalid)])),/Invalid/);
 }
});
