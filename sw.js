/* FUJINOE LAND PWA: network-first, app launcher + index only.
   Never clears localStorage, game progress, or unrelated caches. */
'use strict';
const APP='FUJINOE_LAND';
const CACHE='fujinoeland-page-cache-v1';
const BASE=self.registration.scope;
const INDEX=new URL('./index.html',BASE).href;
const LAUNCHER=new URL('./app.html',BASE).href;
const ROOT=new URL(BASE).pathname;
const INDEX_PATH=new URL(INDEX).pathname;
const LAUNCH_PATH=new URL(LAUNCHER).pathname;
const precache=[LAUNCHER,INDEX,new URL('./icon.svg',BASE).href,new URL('./fu-pyon.webp',BASE).href];
function keyFor(req){
  if(req.mode!=='navigate')return null;
  const u=new URL(req.url);
  if(u.origin!==self.location.origin)return null;
  if(u.pathname===ROOT||u.pathname===INDEX_PATH)return INDEX;
  if(u.pathname===LAUNCH_PATH)return LAUNCHER;
  return null;
}
async function cachePut(key,response){
  if(!response||!response.ok)return;
  try{await (await caches.open(CACHE)).put(key,response.clone())}catch(_){}
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    try{
      const cache=await caches.open(CACHE);
      const results=await Promise.allSettled(precache.map(url=>cache.add(new Request(url,{cache:'reload'}))));
    }catch(_){}
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{
  const key=keyFor(event.request);if(!key)return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request,{cache:'no-store'});
      if(response&&response.ok){event.waitUntil(cachePut(key,response.clone()));return response}
      const previous=await (await caches.open(CACHE)).match(key);
      return previous||response;
    }catch(_){
      const previous=await (await caches.open(CACHE)).match(key);
      return previous||new Response('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ふじのえランド</title><body style="font:18px sans-serif;padding:30px"><h1>ふじのえランド</h1><p>初回の読み込みには通信が必要です。ネットワーク接続後に再度お試しください。</p></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
    }
  })());
});
async function checkLatest(client){
  if(!client)return;
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),6500);let reader;
  try{
    const target=new URL(INDEX);target.searchParams.set('_st_check',String(Date.now()));
    const res=await fetch(target.href,{cache:'no-store',headers:{Range:'bytes=0-4095'},signal:abort.signal});
    if(!res.ok)return;
    let head='';
    if(res.body&&res.body.getReader){
      reader=res.body.getReader();const decoder=new TextDecoder();
      for(let i=0;i<4&&head.length<8192;i++){
        const chunk=await reader.read();if(chunk.done)break;
        head+=decoder.decode(chunk.value,{stream:true});if(head.includes('studiotomo-build'))break;
      }
    }else head=(await res.text()).slice(0,8192);
    const m=head.match(/<meta\s+name=["']studiotomo-build["']\s+content=["']([^"']+)["']/i);
    if(m)client.postMessage({app:APP,type:'VERSION',build:m[1]});
  }catch(_){}finally{clearTimeout(timer);if(reader)try{await reader.cancel()}catch(_){}}
}
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='FUJINOE_CHECK_LATEST')event.waitUntil(checkLatest(event.source));
});