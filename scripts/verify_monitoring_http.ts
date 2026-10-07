import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {probeDatabase} from './probe_supabase.ts';
// Public deployment checks only: no credentials, valid reports or mail requests.
export async function verifyMonitoringHttp(base: string, request: typeof fetch = fetch) {
 await probeDatabase(base, request);
 for(const worker of ['new-profile-notifications','monthly-report','owner-admin']) {
  const response=await request(new URL(`/functions/v1/${worker}`,base),{method:'POST',signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,401,`${worker} must reject unauthenticated callers`);
 }
 const url=new URL('/functions/v1/usage-summary',base);
 const preflight=await request(url,{method:'OPTIONS',headers:{Origin:'https://pekka-28.github.io'},signal:AbortSignal.timeout(30000)});
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('access-control-allow-origin'),'https://pekka-28.github.io');
 const invalid=await request(url,{method:'POST',headers:{Origin:'https://pekka-28.github.io','Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});
 assert.equal(invalid.status,400);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 const base=process.env.SUPABASE_URL;
 if(!base)throw new Error('Set SUPABASE_URL to the project origin');
 await verifyMonitoringHttp(base);
 console.log('Database read, CORS, invalid-input rejection and private endpoint authentication passed.');
}
