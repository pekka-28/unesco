import {object, array} from '../_shared/contracts.ts';
import type {Environment, Requester, Worker} from '../_shared/contracts.ts';
const OWNER = 'pekka@data.co.za';
const ORIGIN = 'https://pekka-28.github.io';
const PAGE = `${ORIGIN}/unesco/admin/`;
const REPO = 'https://api.github.com/repos/pekka-28/unesco';
const entities = new Set(['status','profiles','submissions','notifications','operations','schema','auth-audit','security-health']);
const commands = new Set(['retry-notifications','test-mail','monthly-mail']);

export function createAdminHandler({env, rpc, send, request = fetch}: Worker & {env: Environment; request?: Requester}) {
  const base = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  async function api(path: string, body: unknown, bearer = key, method = 'POST'): Promise<unknown> {
    if (!base || !key || !bearer) throw new Error('Service configuration unavailable');
    const response = await request(`${base}${path}`, {method,
      headers: {apikey:key, Authorization:`Bearer ${bearer}`, 'Content-Type':'application/json'},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`Service operation failed (${response.status})`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async function workflowStatus() {
    // Public read only. This component has no GitHub credential or dispatch path.
    const response = await request(`${REPO}/actions/runs?branch=main&per_page=20`, {method:'GET',
      headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
        'User-Agent':'My-World-Heritage-admin'}, signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`GitHub operation failed (${response.status})`);
    return object(await response.json());
  }
  function isOwner(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const user=object(value);
    return user?.id === env('MWH_ADMIN_USER_ID') && typeof user.email === 'string' && user.email.toLowerCase() === OWNER && Boolean(user.email_confirmed_at);
  }
  return async (req: Request) => {
    const headers = {'Access-Control-Allow-Origin':ORIGIN, 'Access-Control-Allow-Headers':'authorization,content-type',
      'Access-Control-Allow-Methods':'POST,OPTIONS', 'Cache-Control':'no-store', Vary:'Origin'};
    const reply = (body: unknown,status=200) => Response.json(body,{status,headers});
    if (req.headers.get('origin') !== ORIGIN) return reply({error:'Origin not allowed'},403);
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method !== 'POST') return reply({error:'POST required'},405);
    if (!env('MWH_ADMIN_USER_ID')) return reply({error:'Owner access has not been configured'},503);
    let operation: string | undefined;
    try {
      const raw = await req.text();
      if (raw.length > 8192) return reply({error:'Request too large'},413);
      let parsed: unknown;
      try { parsed=JSON.parse(raw); } catch { return reply({error:'Invalid JSON'},400); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply({error:'Invalid request'},400);
      const body=object(parsed);
      if (body.action === 'login') {
        if (await rpc('admin_reserve_login',{}) === true) {
          const link = object(await api('/auth/v1/admin/generate_link',{type:'magiclink',email:OWNER}));
          if (link.id !== env('MWH_ADMIN_USER_ID') || typeof link.hashed_token !== 'string' || !link.hashed_token) throw new Error('Owner link unavailable');
          await send({to:OWNER,subject:'My World Heritage â€” administration sign-in',
            text:`Open this single-use link to sign in to My World Heritage administration:\n\n${PAGE}#token_hash=${encodeURIComponent(link.hashed_token)}\n\nOnly use a link you requested. It expires according to the project sign-in policy. No catalogue or usage records were changed.`},crypto.randomUUID());
        }
        return reply({accepted:true,message:'A sign-in link is sent to the owner at most once every five minutes.'},202);
      }
      if (body.action === 'verify') {
        if (typeof body.token_hash !== 'string' || !/^[a-f0-9]{32,128}$/i.test(body.token_hash)) return reply({error:'Invalid sign-in link'},400);
        const session = object(await api('/auth/v1/verify',{type:'magiclink',token_hash:body.token_hash}));
        if (!isOwner(session.user)) return reply({error:'Owner access required'},403);
        if (typeof session.access_token !== 'string' || !session.access_token ||
            typeof session.expires_in !== 'number' || !Number.isFinite(session.expires_in) || session.expires_in <= 0) throw new Error('Invalid session response');
        return reply({access_token:session.access_token,expires_in:session.expires_in});
      }
      const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
      if (!bearer) return reply({error:'Sign in required'},401);
      let user: Record<string, unknown>;
      try { user=object(await api('/auth/v1/user',undefined,bearer,'GET')); }
      catch { return reply({error:'Session expired; sign in again'},401); }
      if (!isOwner(user)) return reply({error:'Owner access required'},403);
      if (body.action === 'logout') { await api('/auth/v1/logout',undefined,bearer); return reply({ok:true}); }
      if (body.action === 'read') {
        if (typeof body.entity !== 'string' || !entities.has(body.entity)) return reply({error:'Unknown entity'},400);
        const offset = body.offset ?? 0;
        if (typeof offset !== 'number' || !Number.isInteger(offset) || offset<0 || offset>100000) return reply({error:'Invalid offset'},400);
        if (body.profile && (typeof body.profile !== 'string' || !/^[a-f0-9-]{8,80}$/i.test(body.profile))) return reply({error:'Invalid profile identifier'},400);
        if (body.record_class && (typeof body.record_class !== 'string' || !['activity','test','synthetic'].includes(body.record_class))) return reply({error:'Invalid record class'},400);
        for (const date of [body.from,body.until]) if (date && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))) return reply({error:'Invalid date'},400);
        if (body.entity === 'auth-audit' || body.entity === 'security-health')
          return reply({data:await rpc('security_audit_read',{p_entity:body.entity,p_offset:offset,p_from:body.from||null,p_until:body.until||null})});
        return reply({data:await rpc('admin_read',{p_entity:body.entity,p_offset:offset,p_profile:body.profile||null,
          p_class:body.record_class||null,p_from:body.from||null,p_until:body.until||null})});
      }
      if (body.action === 'runs') {
        const data=await workflowStatus();
        return reply({data:array(data.workflow_runs).map(value=>{const r=object(value);return ({id:r.id,name:r.name,status:r.status,conclusion:r.conclusion,created_at:r.created_at,url:r.html_url,commit:r.head_sha});})});
      }
      if (typeof body.action !== 'string' || !commands.has(body.action)) return reply({error:'Unknown operation'},400);
      if (typeof body.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.id)) return reply({error:'Operation Id required'},400);
      // A repeated request must never send another email.
      const prior=array(await api(`/rest/v1/admin_operations?id=eq.${body.id}&select=id,status`,undefined,key,'GET'));
      if (prior.length) return reply({error:'Operation already recorded; inspect its status before retrying',data:prior},409);
      await api('/rest/v1/admin_operations',{id:body.id,actor:user.id,action:body.action});
      operation=body.id;
      let result: unknown;
      {
        const monthly=body.action==='monthly-mail';
        const response=await request(`${base}/functions/v1/${monthly?'monthly-report':'new-profile-notifications'}`,{
          method:'POST',headers:{Authorization:`Bearer ${env('MWH_NOTIFICATION_TOKEN')}`,
            ...(body.action==='test-mail'?{'x-mwh-delivery-test':'true'}:{}),
            ...(monthly?{'x-mwh-report-test':'true'}:{})},signal:AbortSignal.timeout(60000)});
        if (!response.ok) throw new Error('Mail worker did not confirm completion; inspect history before retrying');
        result=await response.json();
      }
      await api(`/rest/v1/admin_operations?id=eq.${operation}`,{status:'succeeded',finished_at:new Date().toISOString()},key,'PATCH');
      return reply({accepted:true,id:operation,result});
    } catch (error) {
      if (operation) {
        try { await api(`/rest/v1/admin_operations?id=eq.${operation}`,{status:'uncertain',finished_at:new Date().toISOString()},key,'PATCH'); } catch { /* A started row remains visible for investigation. */ }
      }
      // Never return provider bodies, tokens, SQL diagnostics or mail content.
      return reply({error:operation?'Completion uncertain. Inspect action history and provider status before retrying.':'Operation could not be completed. Check configuration or sign in again.'},503);
    }
  };
}
