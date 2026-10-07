import {browserContext} from './browser_context.ts';
import {siteHtml} from '../scripts/site_source.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const html=siteHtml();
function setup({visible=true,dialog=false}={}) {
 const listeners=new Map<string,()=>void>();let callback: (()=>void)|undefined,delay: number|undefined,cancelled=false,loads=0;
 const ctx=browserContext({ui:{helpOverlay:{style:{display:'none'}}},loadUsageHistogram:()=>{loads++;},
  window:{setTimeout:(f: ()=>void,ms: number)=>{callback=f;delay=ms;return 1;},clearTimeout:()=>{cancelled=true;}},
  document:{visibilityState:visible?'visible':'hidden',querySelectorAll:()=>[{style:{display:dialog?'flex':'none'}}],
   addEventListener:(n: string,f: ()=>void)=>listeners.set(n,f),removeEventListener:(n: string)=>listeners.delete(n)},getComputedStyle:(el: {style:{display:string}})=>el.style});
 vm.runInContext(html.slice(html.indexOf('    function openAppDialog()'),html.indexOf('    function wireUi()')),ctx);
 ctx.scheduleStartupHelp();
 return {ctx,listeners,delay,fire:()=>{if(!cancelled){assert(callback);callback();}},loads:()=>loads};
}
test('startup help opens once at one minute and loads the application histogram',()=>{
 const s=setup();assert.equal(s.delay,60000);assert.equal(s.ctx.ui.helpOverlay.style.display,'none');s.fire();
 assert.equal(s.ctx.ui.helpOverlay.style.display,'flex');assert.equal(s.loads(),1);assert.equal(s.listeners.size,0);
});
test('each supported user interaction cancels the one-time prompt',()=>{
 for(const event of ['pointerdown','keydown','wheel','touchstart']){
  const s=setup();const listener=s.listeners.get(event);assert(listener);listener();s.fire();assert.equal(s.loads(),0);assert.equal(s.listeners.size,0);
 }
});
test('startup help does not cover another dialog or appear in a hidden tab',()=>{
 for(const state of [{dialog:true},{visible:false}]){const s=setup(state);s.fire();assert.equal(s.loads(),0);assert.equal(s.listeners.size,0);}
});
