/* Caché del shell de GAS&GO: actualizar VERSION al cambiar los archivos precargados. */
'use strict';
const VERSION='300';
const BASE=new URL('./',self.location.href);
const PREFIX='gasgo-shell-'+encodeURIComponent(BASE.pathname)+'-';
const CACHE=PREFIX+VERSION;
const ASSETS=["gg-demo-compact.css", "gg-driver.css", "gg-driver.js", "gg-ev.css", "gg-ev.js", "gg-explore.css", "gg-explore.js", "gg-google-icons-data.js", "gg-google-icons.css", "gg-google-icons.js", "gg-incidents.css", "gg-incidents.js", "gg-invoice.css", "gg-invoice.js", "gg-official.css", "gg-official.js", "gg-offline.js", "gg-plate.css", "gg-plate.js", "gg-preferences.css", "gg-preferences.js", "gg-theme-driver.css", "gg-timing.css", "gg-timing.js", "gg-ux.css", "gg-ux.js", "gg-wallet.css", "gg-wallet.js", "logo-cabecera-gg.png", "logo-gasgo-wordmark.png", "logo-gasgo.jpeg", "index.html", "logo-factura-cabecera.png", "logo-factura-pie.png"];
const paths=new Set(ASSETS.map(p=>new URL(p,BASE).pathname));
const indexURL=new URL('index.html',BASE).href;
const metaURL=new URL('__gasgo_offline_metadata__',BASE).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(ASSETS.map(p=>new Request(new URL(p,BASE),{cache:'reload'})));
 await cache.put(metaURL,new Response(JSON.stringify({version:VERSION,preparedAt:Date.now()}),{headers:{'Content-Type':'application/json'}}));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='GASGO_OFFLINE_STATUS')event.waitUntil((async()=>{const result=await (await caches.open(CACHE)).match(metaURL);event.ports[0]?.postMessage(result?await result.json():null)})())});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==BASE.origin)return;
 const navigation=request.mode==='navigate'&&(url.pathname===BASE.pathname||url.pathname===new URL('index.html',BASE).pathname);
 if(!navigation&&!paths.has(url.pathname))return;
 const cacheKey=navigation?indexURL:BASE.origin+url.pathname;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(request,{cache:'no-cache'});
   if(!response.ok)throw Error('HTTP '+response.status);
   try{await cache.put(cacheKey,response.clone())}catch(error){}return response;
  }catch(error){
   const saved=await cache.match(cacheKey);if(saved)return saved;
   return new Response('Abre GAS&GO con conexión al menos una vez para preparar el acceso al historial.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
 })());
});
