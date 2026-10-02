export {};
type Json = null | boolean | number | string | Json[] | {[key:string]:Json};
interface Reply {error?:string;data?:Json;access_token?:string;expires_in?:number;message?:string;accepted?:boolean;id?:string;result?:Json}
const endpoint = 'https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/owner-admin';
const sessionKey = 'mwh_admin_session';
function el<K extends keyof HTMLElementTagNameMap>(id:string,tag:K):HTMLElementTagNameMap[K] {
  const node=document.getElementById(id);
  if (!node || node.tagName.toLowerCase()!==tag) throw new Error(`Missing ${id}`);
  return node as HTMLElementTagNameMap[K];
}
const status=el('status','p'), workspace=el('workspace','div');
let accessToken='', offset=0, lastData:Json=null, lastCount=0, pending=false;
let tokenHash=new URLSearchParams(location.hash.slice(1)).get('token_hash');
history.replaceState(null,'',location.pathname);
try {
  const saved: {token?:string;expires?:number}=JSON.parse(sessionStorage.getItem(sessionKey)||'{}');
  if (typeof saved.token==='string' && typeof saved.expires==='number' && saved.expires>Date.now()) accessToken=saved.token;
  else sessionStorage.removeItem(sessionKey);
} catch { sessionStorage.removeItem(sessionKey); }
function signedOut():void {accessToken='';sessionStorage.removeItem(sessionKey);workspace.hidden=true;el('signin','section').hidden=false;}
function message(text:string):void {status.textContent=text;}
async function api(body:Record<string,Json>):Promise<Reply> {
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(70000)});
  const reply:Reply=await response.json();
  if(response.status===401 || response.status===403) signedOut();
  if(!response.ok) throw new Error(reply.error||`Request failed (${response.status})`);
  return reply;
}
async function task(work:()=>Promise<void>):Promise<void> {
  if(pending)return;
  pending=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);message('Working…');
  try {await work();}catch(error:unknown){message(error instanceof Error?error.message:'Operation failed. Inspect status before retrying.');}
  finally{pending=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);pagination();}
}
function pagination():void {
  el('previous','button').disabled=pending||offset===0;
  el('next','button').disabled=pending||lastCount<100;
  el('page-label','span').textContent=Array.isArray(lastData)?`Rows ${lastCount?offset+1:0}–${offset+lastCount}`:'';
}
function render(data:Json):void {
  lastData=data;lastCount=Array.isArray(data)?data.length:0;
  const target=el('result','div');target.replaceChildren();
  if(Array.isArray(data)&&data.length&&data.every(r=>r!==null&&typeof r==='object'&&!Array.isArray(r))){
    const rows=data as Record<string,Json>[], columns=Array.from(new Set(rows.flatMap(row=>Object.keys(row))));
    const table=document.createElement('table'), head=table.createTHead().insertRow();
    for(const key of columns){const th=document.createElement('th');th.textContent=key;th.scope='col';head.append(th);}
    const body=table.createTBody();
    for(const row of rows){const tr=body.insertRow();for(const key of columns){const value=row[key];tr.insertCell().textContent=typeof value==='object'?JSON.stringify(value):String(value??'');}}
    target.append(table);
  }else{const pre=document.createElement('pre');pre.textContent=JSON.stringify(data,null,2);target.append(pre);}
  pagination();
}
async function health():Promise<void>{
  const reply=await api({action:'read',entity:'status'});
  workspace.hidden=false;el('signin','section').hidden=true;offset=0;render(reply.data??null);
  message('Signed in as owner. Database query succeeded.');
}
async function query():Promise<void>{
  const entity=el('entity','select').value;
  const reply=await api({action:'read',entity,offset,
    profile:['profiles','submissions','notifications'].includes(entity)?el('profile','input').value.trim():'',
    record_class:entity==='submissions'?el('record-class','select').value:'',
    from:entity==='submissions'?el('from','input').value:'',until:entity==='submissions'?el('until','input').value:''});
  render(reply.data??null);message('Query completed.');
}
el('login','button').onclick=()=>void task(async()=>{const reply=await api({action:'login'});message(reply.message||'Check your mailbox.');});
el('verify','button').hidden=!tokenHash;
el('verify','button').onclick=()=>void task(async()=>{
  if(!tokenHash)throw new Error('Open a new sign-in link.');
  const reply=await api({action:'verify',token_hash:tokenHash});
  tokenHash=null;el('verify','button').hidden=true;
  if(!reply.access_token||!reply.expires_in)throw new Error('Invalid sign-in response.');
  accessToken=reply.access_token;sessionStorage.setItem(sessionKey,JSON.stringify({token:accessToken,expires:Date.now()+reply.expires_in*1000}));
  await health();
});
el('logout','button').onclick=()=>void task(async()=>{try{await api({action:'logout'});}finally{signedOut();el('result','div').replaceChildren();lastData=null;message('Signed out.');}});
el('health','button').onclick=()=>void task(health);
el('runs','button').onclick=()=>void task(async()=>{const reply=await api({action:'runs'});offset=0;render(reply.data??null);message('Latest production workflow runs.');});
el('query','form').onsubmit=event=>{event.preventDefault();offset=0;void task(query);};
el('previous','button').onclick=()=>{offset=Math.max(0,offset-100);void task(query);};
el('next','button').onclick=()=>{offset+=100;void task(query);};
el('export','button').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(lastData,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='mwh-admin-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach(button=>{
  button.onclick=()=>void task(async()=>{
    const action=button.dataset.action;
    if(!action)return;
    if(!confirm(`${button.textContent}? This records an owner operation and may send mail.`)){message('Cancelled.');return;}
    const reply=await api({action,id:crypto.randomUUID(),confirm:true});
    message(`Operation accepted. ${reply.id||''}\nCheck action history or your mailbox for the result.`);
  });
});
if(accessToken)void task(health);
pagination();
