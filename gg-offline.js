/* Historial y facturas locales sin conexión. No almacena respuestas de servicios externos. */
(function(){'use strict';
const esc=escapeHtml;
let cacheInfo=null,cacheError='',registering=false,historySignature=JSON.stringify(data.history||[]);
const stored=localStorage.getItem('gg_offline_ready');try{cacheInfo=stored?JSON.parse(stored):null}catch(e){}
const stamp=value=>new Date(value).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});
const oldSave=window.save;
window.save=function(){
 const signature=JSON.stringify(data.history||[]);
 if(signature!==historySignature||!data.historyStoredAt){data.historyStoredAt=Date.now();historySignature=signature}
 oldSave();
};
if(!data.historyStoredAt){data.historyStoredAt=Date.now();oldSave()}
const offline=()=>navigator.onLine===false;
function note(){return data.historyStoredAt?'Historial guardado en este dispositivo: '+stamp(data.historyStoredAt):'Historial guardado en este dispositivo.'}
function openHistory(){
 if(data.fullSession)Object.assign(data,structuredClone(data.fullSession));
 data.presentationDemo=false;menu=false;save();go('Historial');
}
function blocked(){toast('Sin conexión: puedes consultar el historial y descargar las facturas guardadas.');return false}
const originalStart=window.start;
window.start=function(...args){if(offline())return blocked();return originalStart(...args)};
for(const name of ['openPair','pairManual','retry','scanPair']){const action=window.ggv2?.[name];if(action)window.ggv2[name]=function(...args){if(offline())return blocked();return action(...args)}}
document.addEventListener('click',event=>{if(offline()&&event.target.closest?.('#ggv2ConnectBtn')){event.preventDefault();event.stopImmediatePropagation();blocked()}},true);
const oldSearch=window.openSearch;
window.openSearch=function(...args){if(offline())return blocked();return oldSearch(...args)};
const oldRender=window.render;
window.render=function(){
 oldRender();const content=document.getElementById('content');
 if(offline()){
  const map=content.querySelector('.map-home,.station-list-screen');if(map)map.innerHTML='<section class="card"><h2>Mapa no disponible sin conexión</h2><p>Conéctate para consultar estaciones y precios actualizados.</p></section>';
  const banner=document.createElement('section');banner.className='gg-offline-banner';banner.setAttribute('role','status');
  banner.innerHTML=`<strong>Sin conexión</strong><p>${esc(note())}</p><p>Los precios y el mapa no se están actualizando.</p>${page!=='Historial'?'<button type="button" class="btn ghost" onclick="GGOffline.history()">Consultar historial guardado</button>':''}`;
  content.prepend(banner);
 }
 if(page==='Historial'&&!inPresentationDemo())content.insertAdjacentHTML('beforeend',`<p class="small muted gg-history-saved-at">${esc(note())} Las facturas se generan con los datos de cada operación guardada.</p>`);
 if(page==='Configuración'&&!inPresentationDemo())content.insertAdjacentHTML('beforeend',`<section class="card gg-offline-settings"><h2>Acceso sin conexión</h2><p>${cacheInfo?'Historial y facturas disponibles en este navegador. Archivos preparados: '+esc(stamp(cacheInfo.preparedAt)):cacheError?esc(cacheError):'Preparando los archivos para consultar tu historial sin Internet…'}</p><p class="small muted">Solo en este dispositivo y navegador. Las nuevas operaciones y las búsquedas necesitan conexión.</p>${!cacheInfo?'<button type="button" class="btn ghost" onclick="GGOffline.prepare()">Preparar acceso sin conexión</button>':''}</section>`);
};
async function prepare(){
 if(registering)return;
 if(!('serviceWorker' in navigator)||!window.isSecureContext){cacheError='Para preparar el acceso sin conexión, abre la app desde HTTPS o localhost.';if(page==='Configuración')render();return}
 registering=true;
 try{
  await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  const registration=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('prepare-timeout')),20000);navigator.serviceWorker.ready.then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})});
  const channel=new MessageChannel();
  const info=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No se ha podido confirmar la copia sin conexión. Vuelve a intentarlo con Internet.')),5000);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data)};registration.active.postMessage({type:'GASGO_OFFLINE_STATUS'},[channel.port2])});
  if(!info?.preparedAt)throw Error('Los archivos aún no están preparados. Vuelve a intentarlo con Internet.');
  cacheInfo=info;cacheError='';localStorage.setItem('gg_offline_ready',JSON.stringify(info));
 }catch(error){cacheError='No se ha podido preparar la copia sin conexión. Vuelve a intentarlo con Internet.'}
 finally{registering=false;if(page==='Configuración')render()}
}
window.addEventListener('offline',()=>render());
window.addEventListener('online',()=>{render();if(!cacheInfo)prepare()});
window.GGOffline={history:openHistory,prepare,isOffline:offline};
if(document.readyState==='complete')prepare();else window.addEventListener('load',prepare,{once:true});
render();
})();
