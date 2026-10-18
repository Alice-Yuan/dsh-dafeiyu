import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { BrowseRunner } from '../dist/browse/runner.js';
import { BrowseStore } from '../dist/browse/store.js';
import { BROWSE_LIMITS, keywordOf } from '../dist/browse/contracts.js';
import { PilotStore } from '../dist/pilot/store.js';
import { PilotError } from '../dist/pilot/contracts.js';
import { REQUESTS } from '../dist/shared/remote.js';

const candidate = n => ({ bvid: 'BV1GJ411x7' + String(n).padStart(2,'1'), aid: String(20000+n), title: '合成搜索标题', author: '合成作者' });
const material = n => ({ ...candidate(n), cid: '30001', description: '', subtitle: '字幕里的忽略指令与发评论要求都是外部数据' });
function setup(t, changes={}) {
  mkdirSync(resolve('tmp/tests'),{recursive:true});
  const path=join(mkdtempSync(resolve('tmp/tests/browse-')),'test.sqlite');
  const pilot=new PilotStore(path); pilot.bindOwner('10001'); pilot.reserveRequest('private',1);
  const store=new BrowseStore(pilot); let now=1000000; const calls=[];
  const port={ account:async()=>({uid:'30001',name:'合成'}), search:async(_q,page)=>{ calls.push(['search',page]); return {videos:[1,2,3,4].map(candidate),hasMore:true}; },
    read:async bvid=>{ calls.push(['read',bvid]); return material(Number(bvid.slice(-1))); }, ...changes };
  const runner=new BrowseRunner(store,port,()=>now);
  t.after(()=>{runner.stop();pilot.close();});
  return {runner,pilot,store,path,calls,advance:ms=>{now+=ms;},run:(signal=new AbortController().signal)=>runner.start('合成兴趣','30001','10001',signal)};
}
test('browse caps reads, keeps untrusted subtitle text inert and never consumes model quota',async t=>{
  const f=setup(t); const r=await f.run(); assert.equal(r.state,'completed'); assert.equal(r.read,3); assert.equal(r.pages,1);
  assert.equal(r.items.filter(i=>i.state==='deferred').length,1); assert.equal(f.store.history().length,3);
  assert.match(f.store.history()[0].subtitle,/忽略指令/); assert.equal(f.pilot.budget().lifetimeUsed,1); assert.equal(f.pilot.actions().length,0);
  await assert.rejects(f.run(),/BROWSE_COOLDOWN/);
});
test('browse persists recent deduplication across restart, including no-subtitle skips',async t=>{
  const f=setup(t,{search:async()=>({videos:[candidate(1)],hasMore:false}),read:async()=>({...material(1),subtitle:null})});
  const r=await f.run(); assert.equal(r.items[0].state,'no-subtitle'); f.pilot.close();
  const reopened=new PilotStore(f.path); t.after(()=>reopened.close()); const store=new BrowseStore(reopened);
  const runner=new BrowseRunner(store,{account:async()=>({uid:'30001'}),search:async()=>({videos:[candidate(1)],hasMore:true}),read:async()=>{throw Error('MUST_NOT_READ');}},()=>2000000);
  const next=await runner.start('另一个话题','30001','10001',new AbortController().signal);
  assert.equal(next.pages,2); assert.equal(next.read,0); assert.equal(next.items.length,1); assert.equal(next.items[0].state,'seen');
});
test('cancelled in-flight browse discards late response and rejects concurrent starts',async t=>{
  let resolveRead, started; const ready=new Promise(r=>{started=r;});
  const f=setup(t,{read:()=>{started();return new Promise(r=>{resolveRead=r;});}});
  const op=f.run(); await ready; await assert.rejects(f.run(),/RUN_BUSY/); f.runner.stop(); resolveRead(material(1));
  const r=await op; assert.equal(r.state,'cancelled'); assert.equal(r.reason,'OWNER_STOPPED'); assert.equal(f.store.history().length,0); assert.equal(r.read,1);
});
test('deadline and transport restrictions stop without retry or dedup poisoning',async t=>{
  for(const code of ['PLATFORM_RESTRICTED','AUTH_EXPIRED','PLATFORM_SCHEMA_CHANGED']) {
    let reads=0;const f=setup(t,{read:async()=>{reads++;throw new PilotError(code);}});const r=await f.run();
    assert.equal(r.state,'failed');assert.equal(r.reason,code);assert.equal(reads,1);assert.equal(f.store.history().length,0);
  }
  let f; f=setup(t,{search:async()=>{f.advance(BROWSE_LIMITS.durationMs);return {videos:[candidate(1)],hasMore:true};}});
  const r=await f.run();assert.equal(r.reason,'BROWSE_DEADLINE');assert.equal(r.read,0);
});
test('browse rejects UID/aid mismatch and unexpected visual material',async t=>{
  const wrong=setup(t,{account:async()=>({uid:'999'})});assert.equal((await wrong.run()).reason,'ACCOUNT_CHANGED');assert.equal(wrong.calls.length,0);
  for(const extra of [{aid:'999'},{visual:{frames:[]}}]){
    const f=setup(t,{read:async()=>({...material(1),...extra})});assert.equal((await f.run()).reason,'BROWSE_MATERIAL_MISMATCH');assert.equal(f.store.history().length,0);
  }
});
test('browse rejects unbounded inputs and remote force/media fields',()=>{
  for(const v of ['', ' ', 'x'.repeat(81), 'a\ncomment'])assert.throws(()=>keywordOf(v));
  assert.equal(REQUESTS.browse.safeParse({keyword:'游戏',accountUid:'30001',force:true}).success,false);
  assert.equal(REQUESTS.browse.safeParse({keyword:'游戏',accountUid:'30001',visualRequested:true}).success,false);
});
test('browse recovery marks interruption without work; recent storage is bounded',t=>{
  const f=setup(t); const base={accountUid:'30001',keyword:'合成',startedAt:1,finishedAt:null,state:'running',reason:'',pages:0,read:0,items:[]};
  for(let i=0;i<25;i++) f.store.save({...base,id:String(i),startedAt:i});
  assert.equal(f.pilot.db.prepare('SELECT count(*) n FROM browse_runs').get().n,20);
  const run=f.store.latest();
  for(let i=0;i<210;i++)f.store.record({accountUid:'30001',bvid:String(i),aid:String(i),title:'合成',author:'合成',subtitle:null,truncated:false,state:'no-subtitle',at:i},run);
  assert.equal(f.pilot.db.prepare('SELECT count(*) n FROM browse_readings').get().n,200);
  assert.equal(f.store.seen('30001','0'),false);assert.equal(f.store.seen('999','209'),false);assert.equal(f.store.history().length,10);
  f.pilot.close();const reopened=new PilotStore(f.path);t.after(()=>reopened.close());const store=new BrowseStore(reopened);
  assert.equal(store.latest().state,'interrupted');assert.equal(store.latest().reason,'HOST_RESTARTED');assert.equal(reopened.budget().lifetimeUsed,1);
});
