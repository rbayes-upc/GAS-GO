/* GAS&GO v2.3 — Estaciones reales y precios del Geoportal de Carburantes.
   Origen primario: API Ministerio (puede tener CORS cerrado).
   Acceso web alternativo: API pública Punto Muerto (reutiliza datos oficiales, CORS abierto).
   No se proporcionan precios, disponibilidad ni afiliaciones no verificadas como reales. */
(function(){
'use strict';
const EESS_URL='https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/08';
const AGG_URL='https://puntomuerto.es/api/gasolineras';
const MAX_AGE=20*60*1000;
const CACHE=new Map();
let fetchCounter=0, lastLoaded=null;
const N=(v)=>{if(typeof v==='number')return Number.isFinite(v)?v:null;
  if(typeof v!=='string')return null;const val=Number(v.trim().replace(',','.'));
  return Number.isFinite(val)?val:null;};
const money=(n)=>Number.isFinite(n)&&n>0?n.toFixed(3).replace('.',',')+' €':'—';
const numberPrice=(n)=>{n=N(n);return n!==null&&n>0&&n<20?n:null};
const ascii=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function readOfficialPrice(o,kind){const keys=Object.keys(o||{});let k;
 if(kind==='gas'){k=keys.find(x=>ascii(x)==='precio gasolina 95 e5')||keys.find(x=>ascii(x)==='precio gasolina 95 e10')}
 else{k=keys.find(x=>ascii(x)==='precio gasoleo a')}
 return k?numberPrice(o[k]):null;
}
function officialItem(p){
 const lon=Object.keys(p||{}).find(k=>ascii(k)==='longitud wgs84');
 return {id:p.IDEESS,rotulo:p['Rótulo']||p.Rotulo||'',direccion:p['Dirección']||p.Direccion||'',localidad:p.Localidad||p.Municipio||'',lat:N(p.Latitud),lng:N(lon?p[lon]:p.Longitud),gas:readOfficialPrice(p,'gas'),diesel:readOfficialPrice(p,'diesel'),horario:p.Horario||'',rawSource:'ministerio'};
}
function aggItem(p){let prices=p.precios||{};return {id:p.id,rotulo:p.rotulo||'',direccion:p.direccion||'',localidad:p.localidad||'',lat:N(p.lat),lng:N(p.lng),gas:numberPrice(prices.g95e5),diesel:numberPrice(prices['gasoleo-a']),horario:p.horario||'',rawSource:'puntomuerto'};}
function stationOf(p,center){
 if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||!(p.gas||p.diesel))return null;
 const idNumber=Number(p.id); const seed=geoSeed(String(p.id||p.rotulo+'-'+p.direccion));
 // IDs del Ministerio se guardan en un espacio distinto para no colisionar con demos.
 const id=2000000+(Number.isFinite(idNumber)?idNumber%1500000:seed%1500000);
 const total=2+seed%5;
 const isMixed=false; // Los cargadores reales se añaden desde gg-ev.js; no inventar equipos.
 const displayName=String(p.rotulo||'Estación de servicio').trim().slice(0,70);
 const area=[p.direccion,p.localidad].filter(Boolean).join(' · ').slice(0,180);
 const s={id,name:displayName,area,gas:p.gas,diesel:p.diesel,time:220+seed%120,x:50,y:50,type:'gas',free:1+seed%total,total,dist:haversine(center.lat,center.lng,p.lat,p.lng),ev:isMixed?Number((.31+(seed%16)/100).toFixed(2)):0,evFree:isMixed?1:0,evTotal:isMixed?2:0,kw:isMixed?75:0,lat:p.lat,lng:p.lng,officialSource:true,sourceVia:p.rawSource,officialId:String(p.id||''),demoCharging:isMixed,horario:p.horario||''};
 return s;
}
function endpointBounds(c){const dLat=.092,dLng=.135;const params=new URLSearchParams({minLng:(c.lng-dLng).toFixed(4),minLat:(c.lat-dLat).toFixed(4),maxLng:(c.lng+dLng).toFixed(4),maxLat:(c.lat+dLat).toFixed(4),limit:'800'});return AGG_URL+'?'+params.toString()}
async function fetchWithTimeout(url,ms=7000){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),ms);
 try{const r=await fetch(url,{mode:'cors',headers:{Accept:'application/json'},signal:ctrl.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(timer)} }
function isBarcelona(c){return haversine(c.lat,c.lng,BARCELONA.lat,BARCELONA.lng)<22}
function cacheKey(c){return `${(Math.round(c.lat*25)/25).toFixed(2)}:${(Math.round(c.lng*25)/25).toFixed(2)}`}
function cacheFromStorage(key){try{const c=JSON.parse(sessionStorage.getItem('gg_official_'+key)||'null');return c&&Date.now()-c.ts<MAX_AGE?c:null}catch(e){return null}}
function displayStatus(){
 if(inPresentationDemo())return 'Versión DEMO · estación ficticia';
 if(geoLoading)return 'Consultando estaciones y precios…';
 if(geoStationMode==='official')return 'Precios del Ministerio · información real';
 if(geoStationMode==='official-via-third-party')return 'Precios del Ministerio vía Punto Muerto';
 return 'Estaciones de demostración · precios ficticios';
}
function foot(){if(inPresentationDemo())return '<div class="gg-source gg-demo"><span>DEMO</span><span>Una estación ficticia · precios y ocupación simulados</span></div>';let source=geoStationMode==='official'? 'Ministerio (API directa)' :geoStationMode==='official-via-third-party'?'Ministerio (vía Punto Muerto)':'Datos de demostración';
 const since=lastLoaded?` · Consultado: ${new Date(lastLoaded).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`:'';
 const real=geoStationMode!=='demo';
 return `<div class="gg-source ${real?'gg-live':'gg-demo'}"><span>${real?'✓ Precios reales':'◌ Precios ficticios'}</span><span>${geoStationMode==='official-via-third-party'?'<a href="https://puntomuerto.es/api" target="_blank" rel="noopener">'+escapeHtml(source)+'</a>':escapeHtml(source)}${since}</span><button type="button" onclick="ggOfficial.refresh()" title="Actualizar precios y ubicaciones">↻</button></div>`;
}
// Búsqueda geográfica. Si la API directa no permite CORS, se emplea un reutilizador declarado.
async function officialLoad(center=mapCenter,force=false){
 if(typeof inPresentationDemo==='function'&&inPresentationDemo()){geoLoading=false;geoStationMode='demo';geoStatus='Modo DEMO · estación ficticia';if(page==='Home')render();return}
 if(!center||!Number.isFinite(center.lat)||!Number.isFinite(center.lng))center=BARCELONA;
 const request=++fetchCounter;
 const key=cacheKey(center);
 const cached=!force&&(CACHE.get(key)||cacheFromStorage(key));
 geoLoading=true;geoStatus='Consultando datos oficiales de estaciones…';if(page==='Home')render();
 try{
  let points=[],via='puntomuerto', ts=Date.now();
  if(cached){points=cached.points;via=cached.via;ts=cached.ts}
  else{
   if(isBarcelona(center)){
    try{const j=await fetchWithTimeout(EESS_URL,5700);
      if(!Array.isArray(j.ListaEESSPrecio))throw Error('Respuesta oficial inesperada');
      points=j.ListaEESSPrecio.map(officialItem).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&haversine(center.lat,center.lng,p.lat,p.lng)<=13);
      if(!points.length)throw Error('Ninguna estación cercana');via='ministerio';
    }catch(e){console.info('[GAS&GO] API directa no disponible desde el navegador:',e.message)}
   }
   if(!points.length){
     const j=await fetchWithTimeout(endpointBounds(center),9500);
     if(!Array.isArray(j.estaciones))throw Error('El servicio alternativo no devolvió estaciones');
     points=j.estaciones.map(aggItem).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));via='puntomuerto';
   }
   if(!points.length)throw Error('No hay gasolineras en el área consultada');
   // Guardar resultados solo temporalmente; evita repetir peticiones a un servicio público.
   const entry={points,via,ts};CACHE.set(key,entry);
   try{sessionStorage.setItem('gg_official_'+key,JSON.stringify(entry))}catch(e){}
  }
  if(request!==fetchCounter||inPresentationDemo())return;
  const real=points.map(p=>stationOf(p,center)).filter(Boolean).filter(s=>s.dist<14).sort((a,b)=>a.dist-b.dist).slice(0,120);
  if(!real.length)throw Error('Ningún carburante compatible publicado cerca');
  // Conservar los dos puntos eléctricos exclusivos del prototipo únicamente en Barcelona.
  const demoEv=isBarcelona(center)?DEMO_STATIONS_BACKUP.filter(s=>s.type==='electric').map(s=>({...s,demoOnly:true,area:s.area+' · No es un cargador verificado'})):[];
  STATIONS.splice(0,STATIONS.length,...real,...demoEv);
  geoStationMode=via==='ministerio'?'official':'official-via-third-party';lastLoaded=ts;
  geoStatus=`${real.length} gasolineras con precios publicados · ${via==='ministerio'?'Fuente: Ministerio':'Fuente: Ministerio vía Punto Muerto'}. Ocupación y suministro simulados.`;
  selectedStation=null;
 }catch(e){
  if(request!==fetchCounter||inPresentationDemo())return;
  STATIONS.splice(0,STATIONS.length,...DEMO_STATIONS_BACKUP.map(s=>({...s,demoOnly:true})));
  geoStationMode='demo';lastLoaded=null;
  geoStatus='No se pudieron obtener los precios oficiales · Estaciones y precios de demostración. Reintenta al tener conexión.';
  console.warn('[GAS&GO] consulta estaciones:',e.message);
 }finally{
  if(request!==fetchCounter||inPresentationDemo())return;
  try{if(window.ggEV)await window.ggEV.merge(center)}catch(err){console.warn('[GAS&GO] recarga:',err.message)}
  if(request!==fetchCounter||inPresentationDemo())return;geoLoading=false;
  STATIONS.forEach(s=>s.dist=haversine(center.lat,center.lng,s.lat,s.lng));
  if(page==='Home')render();
 }
}
// Quitar el ciclo antiguo de Overpass y emplear la nueva fuente, sin tocar WebRTC.
window.loadRealStations=officialLoad;
window.ggOfficial={refresh(){return officialLoad(mapCenter,true)},status(){return {mode:geoStationMode,loaded:lastLoaded,stations:STATIONS.length}}};

window.shownStations=function(){
 const q=mapSearch.trim().toLocaleLowerCase('es');const choice=filterFuel==='Todos'?data.fuel:filterFuel;
 const priceFor=s=>choice==='Eléctrico'?(s.ev||null):choice==='Diésel'?s.diesel:s.gas;
 return STATIONS.filter(s=>{
   const compatible=filterFuel==='Todos'?true:filterFuel==='Eléctrico'?!!s.ev:filterFuel==='Diésel'?!!s.diesel:!!s.gas;
   const p=priceFor(s);
   return (!q||(s.name+' '+s.area).toLocaleLowerCase('es').includes(q))&&compatible&&
    (!onlyAvailable||(filterFuel==='Todos'?s.free>0||s.evFree>0:filterFuel==='Eléctrico'?s.evFree>0:s.free>0))&&
    (!maxPrice||(p!==null&&p!==undefined&&p>0&&p<=maxPrice));
 }).sort((a,b)=>{
  if(mapSort==='price')return (priceFor(a)||Infinity)-(priceFor(b)||Infinity);
  if(mapSort==='free')return (b.free+b.evFree)-(a.free+a.evFree);
  if(['fastest','wait','time'].includes(mapSort))return (window.ggTiming.sortScore(a,mapSort)-window.ggTiming.sortScore(b,mapSort))||(a.dist-b.dist);
  return a.dist-b.dist;
 });
};

const description=s=>s.type==='electric'&&s.evOrigin==='ripree'?'<b class="gg-real">RECARGA · CENSO RIPREE (CSV)</b> · ubicación y potencia publicadas; tarifa/ocupación simuladas':s.type==='electric'&&s.evOrigin==='osm'?'<b class="gg-real">RECARGA · OPENSTREETMAP</b> · precio/ocupación simulados':s.officialSource?s.realElectric?'<b class="gg-real">CARBURANTES OFICIALES + RECARGA '+(s.evOrigin==='ripree'?'RIPREE':'OSM')+'</b> · ocupación simulada':'<b class="gg-real">PRECIOS OFICIALES</b> · disponibilidad simulada':'<b class="gg-sim">DEMO</b> · ubicación y precios ficticios';
const labelFuel=(s,ev=false)=>s.officialSource&&!ev?'Precio oficial':'Precio demo';
function compatibility(s){return data.fuel==='Eléctrico'?s.ev>0:data.fuel==='Diésel'?s.diesel!=null:s.gas!=null}
function canStart(s){return compatibility(s)&&(data.fuel==='Eléctrico'?s.evFree>0:s.free>0)}
function priceBox(n,unit,real,product='Combustible'){return `<span>${product} · ${real?'oficial':'demo'}</span><strong>${money(n)}<small>/${unit}</small></strong>`}
function demoCompactStationPopup(s){
 const ev=data.fuel==='Eléctrico';
 const supply=ev?'Recarga eléctrica':data.fuel==='Diésel'?'Diésel':'Gasolina 95';
 const numeric=(v,unit)=>`${Number(v).toFixed(3).replace('.',',')} <small>€/${unit}</small>`;
 const freeFuel=Math.max(0,Number(s.free)||0),totalFuel=Math.max(0,Number(s.total)||0);
 const freeEv=Math.max(0,Number(s.evFree)||0),totalEv=Math.max(0,Number(s.evTotal)||0);
 const w=window.ggTiming.wait(s,ev),duration=window.ggTiming.duration(s,ev);
 const mins=n=>Number.isFinite(n)?`≈ ${Math.round(n)} min`:'—';
 const avail=ev?freeEv>0:freeFuel>0;
 const reserveText=avail?'Disponible':'Ocupada';
 return `<div class="mapdetails gg-demo-compact-popup" role="region" aria-label="Ficha de estación de demostración">
   <div class="ggdc-head"><div><h4>${escapeHtml(s.name)}</h4><span>Barcelona · Estación ficticia</span></div><button class="ggdc-close" onclick="selectedStation=null;render()" aria-label="Cerrar ficha">×</button></div>
   <div class="ggdc-prices" aria-label="Tres suministros y precios ficticios">
     <div class="${supply==='Gasolina 95'?'chosen':''}"><span>Gasolina 95</span><strong>${numeric(s.gas,'L')}</strong></div>
     <div class="${supply==='Diésel'?'chosen':''}"><span>Diésel</span><strong>${numeric(s.diesel,'L')}</strong></div>
     <div class="${ev?'chosen':''}"><span>Eléctrico</span><strong>${numeric(s.ev,'kWh')}</strong></div>
   </div>
   <div class="ggdc-availability" aria-label="Ocupación simulada">
     <span>⛽ <b>${freeFuel}/${totalFuel} surtidores libres</b></span>
     <span>⚡ <b>${freeEv}/${totalEv} puntos libres</b> · ${Number(s.kw)} kW</span>
   </div>
   <div class="ggdc-times" aria-label="Tiempos estimados de prueba">
     <div><small>Espera · ${supply}</small><b>${w===0?'Sin espera':mins(w)}</b></div>
     <div><small>${ev?'Recarga '+window.ggTiming.energy()+' kWh':'Suministro medio'}</small><b>${mins(duration)}</b></div>
   </div>
   <div class="ggdc-actions">
     <button class="ggdc-main" ${avail?'':'disabled'} onclick="start(${s.id})">${ev?'⚡ Abrir surtidor demo':'⛽ Abrir surtidor demo'} <span>›</span></button>
     <div class="ggdc-secondary">
       <button onclick="fav(${s.id})">${data.favorites.includes(s.id)?'★ Favorita':'☆ Favorito'}</button>
       <button onclick="chooseNavigation(${s.id})">↗ Ruta</button>
       <button onclick="ggIncidents.openWithStation(${s.id})">⚠ Incidencia</button>
     </div>
   </div>
   <span class="ggdc-disclaimer">DEMO · Disponibilidad, precios y tiempos simulados</span>
 </div>`;
}
window.stationPopup=function(){const s=STATIONS.find(s=>s.id===selectedStation);if(!s)return '';
 if(inPresentationDemo())return demoCompactStationPopup(s);
 const evOnly=s.type==='electric';const electric=data.fuel==='Eléctrico';
 return `<div class="mapdetails gg-station-popup" data-station-id="${s.id}"><button class="close" onclick="selectedStation=null;render()">×</button><h4>${evOnly?'⚡ ':''}${escapeHtml(s.name)}</h4><div class="small muted">${escapeHtml(s.area)} · ${s.dist.toFixed(1).replace('.',',')} km</div><div class="gg-station-source">${description(s)}</div>
 ${inPresentationDemo()?'<div class="gg-demo-fuel-trio"><div><small>Gasolina 95</small><strong>1,620 €/L</strong></div><div><small>Diésel</small><strong>1,550 €/L</strong></div><div><small>Eléctrico</small><strong>0,390 €/kWh</strong></div></div>':''}
 <div class="gg-price-pair"><div>${priceBox(evOnly?s.ev:s.gas,evOnly?'kWh':'L',s.officialSource&&!evOnly,evOnly?'Electricidad':'Gasolina 95')}</div><div>${evOnly?`<span>${s.evPowerPublished?'Potencia publicada':'Potencia demo'}</span><strong>${s.evPowerPublished||s.kw} kW</strong>`:priceBox(s.diesel,'L',s.officialSource,'Diésel')}</div></div>
 ${s.realElectric&&window.ggEV?window.ggEV.detail(s):''}${s.demoCharging&&!evOnly&&!s.realElectric?`<p class="gg-note">⚡ Punto de carga solo de demostración · ${money(s.ev)}/kWh.</p>`:''}
 ${s.horario?`<p class="gg-note">Horario publicado: ${escapeHtml(s.horario)}</p>`:''}
 ${window.ggTiming.metrics(s)}
 <div class="stock ${canStart(s)?'ok':'bad'}">${!compatibility(s)?'No ofrece el combustible seleccionado (o no consta precio)':canStart(s)?'● Disponible en la simulación':'● Ocupado en la simulación'}</div>
 <div class="gg-popup-actions"><button class="btn ghost" onclick="fav(${s.id})">${data.favorites.includes(s.id)?'★ Favorita':'☆ Favorito'}</button><button class="btn ghost" onclick="chooseNavigation(${s.id})">↗ Cómo llegar</button></div>
 <button class="btn primary block" style="margin-top:8px" ${canStart(s)?'':'disabled'} onclick="start(${s.id})">${electric?'Simular recarga':'Simular llegada'}</button><button type="button" class="btn ghost block gg-report-station" onclick="ggIncidents.openWithStation(${s.id})">⚠ Comunicar incidencia en esta estación</button><div class="gg-note">GAS&GO no presta servicios reales en esta estación. Operación ficticia.</div></div>`;
};
function demoCompactList(list){
 return `<div class="station-list-screen gg258-demo-list"><div class="gg258-list-head"><button class="btn ghost" onclick="setStationView('map')">← Volver al mapa</button><span>DEMO · 1 estación</span></div>
 <div class="list-cards">${list.length?list.map(s=>{
 const ev=data.fuel==='Eléctrico',available=canStart(s),wait=window.ggTiming.wait(s,ev),duration=window.ggTiming.duration(s,ev),mins=n=>Number.isFinite(n)?'≈ '+Math.round(n)+' min':'—';
 return `<article class="gg258-list-card"><div class="gg258-lc-head"><div><h3>${escapeHtml(s.name)}</h3><small>Estación ficticia · tres suministros disponibles</small></div><button class="star-btn" onclick="fav(${s.id})" aria-label="Cambiar favorito">${data.favorites.includes(s.id)?'★':'☆'}</button></div>
 <div class="ggdc-prices"><div><span>Gasolina 95</span><strong>${Number(s.gas).toFixed(3).replace('.',',')} <small>€/L</small></strong></div><div><span>Diésel</span><strong>${Number(s.diesel).toFixed(3).replace('.',',')} <small>€/L</small></strong></div><div><span>Eléctrico</span><strong>${Number(s.ev).toFixed(3).replace('.',',')} <small>€/kWh</small></strong></div></div>
 <div class="ggdc-availability"><span>⛽ <b>${s.free}/${s.total} surtidores libres</b></span><span>⚡ <b>${s.evFree}/${s.evTotal} puntos libres</b> · ${s.kw} kW</span></div>
 <div class="ggdc-times"><div><small>Espera estimada</small><b>${wait===0?'Sin espera':mins(wait)}</b></div><div><small>${ev?'Recarga '+window.ggTiming.energy()+' kWh':'Suministro medio'}</small><b>${mins(duration)}</b></div></div>
 <button class="ggdc-main" ${available?'':'disabled'} onclick="start(${s.id})">⛽ Abrir surtidor demo <span>›</span></button>
 <div class="ggdc-secondary"><button onclick="goStation(${s.id})">◉ Ver mapa</button><button onclick="chooseNavigation(${s.id})">↗ Ruta</button><button onclick="ggIncidents.openWithStation(${s.id})">⚠ Incidencia</button></div>
 <span class="ggdc-disclaimer">Precios, ubicación, ocupación y suministros ficticios · conexión local sin QR</span></article>`}).join(''):`<div class="empty">No hay resultados. <button class="btn ghost" onclick="clearMapFilters()">Limpiar filtros</button></div>`}</div></div>`;
}
window.stationList=function(){const list=shownStations();if(inPresentationDemo())return demoCompactList(list);return `<div class="station-list-screen"><div class="list-toolbar"><button class="btn ghost" onclick="setStationView('map')">← Vista en mapa</button><label class="list-sort-label">Priorizar<select id="listSort" onchange="changeListSort(this.value)">${window.ggTiming.sortOptions()}</select></label></div>
 <div class="list-summary"><b>Estaciones y áreas de servicio</b><span>${list.length} resultados · ${escapeHtml(displayStatus())}</span><button onclick="openMapFilters()">☷ Filtros</button></div>
 <div class="gg-list-source">${foot()}${!inPresentationDemo()&&window.ggEV?window.ggEV.strip():''}</div>${['fastest','wait','time'].includes(mapSort)?'<div class="gg245-sorting-note">Orden aproximado: distancia en línea recta, espera simulada y potencia del punto de recarga según el CSV. La energía a recargar se ajusta en Filtros.</div>':''}<div class="list-cards">${list.length?list.map(s=>`<article class="list-station-card" data-station-id="${s.id}"><div class="row between" style="align-items:flex-start;gap:8px"><div><div class="small muted">${description(s)}</div><b>${escapeHtml(s.name)}</b><div class="muted small">${escapeHtml(s.area)} · ${s.dist.toFixed(1).replace('.',',')} km</div></div><button class="star-btn" onclick="fav(${s.id})">${data.favorites.includes(s.id)?'★':'☆'}</button></div>
 <div class="list-price-row"><div><small>${s.type==='electric'?'Electricidad · tarifa demo':'Gasolina 95 · '+(s.officialSource?'oficial':'demo')}</small><strong>${money(s.type==='electric'?s.ev:s.gas)}<em>/${s.type==='electric'?'kWh':'L'}</em></strong></div><div><small>${s.type==='electric'?(s.evPowerPublished?'Potencia publicada':'Potencia demo'):'Diésel · '+(s.officialSource?'oficial':'demo')}</small><strong>${s.type==='electric'?(s.evPowerPublished||s.kw)+' kW':money(s.diesel)+' /L'}</strong></div></div>
 ${inPresentationDemo()?'<div class="gg-demo-fuel-trio"><div><small>Gasolina 95</small><strong>1,620 €/L</strong></div><div><small>Diésel</small><strong>1,550 €/L</strong></div><div><small>Eléctrico</small><strong>0,390 €/kWh</strong></div></div>':''}
 <div class="list-stat-row"><span>◷ ${s.dist.toFixed(1).replace('.',',')} km</span><span class="stock ${canStart(s)?'ok':'bad'}">${canStart(s)?'● Libre (demo)':'● No disponible (demo)'}</span></div>
 ${window.ggTiming.metrics(s)}
 ${s.realElectric&&window.ggEV?window.ggEV.detail(s):''}${s.demoCharging&&!s.realElectric?'<div class="gg-note">Recarga eléctrica únicamente simulada</div>':''}
 <div class="list-actions"><button class="btn ghost" onclick="goStation(${s.id})">Ver en mapa</button><button class="btn ghost" onclick="chooseNavigation(${s.id})">Cómo llegar</button><button class="btn primary" ${canStart(s)?'':'disabled'} onclick="start(${s.id})">${data.fuel==='Eléctrico'?'Recarga demo':'Repostaje demo'}</button></div></article>`).join(''):'<div class="empty">No hay estaciones con estos filtros. Prueba ampliando tu selección.</div>'}</div></div>`}
window.home=function(){if(stationView==='list')return stationList();return `<div class="map-home"><div class="map-home-title"><strong>${inPresentationDemo()?'Estación de demostración':'Estaciones cercanas'}</strong><span>${inPresentationDemo()?'Un solo establecimiento de prueba':'Carburantes y recarga'}</span></div>${foot()}${!inPresentationDemo()&&window.ggEV?window.ggEV.strip():''}<div id="mapResultArea">${map()}</div><div class="map-footer"><span><b>${shownStations().length}</b> estaciones visibles</span><span>Ocupación <b>simulada</b></span></div></div>`}

// Recargar resultados al desplazar significativamente el mapa. Esperar para evitar consultas continuas.
const OLD_UPDATE=window.updateRealMap;
let panTimer=null;
window.updateRealMap=function(){clearTimeout(panTimer);OLD_UPDATE();if(!geoMap)return;
 geoMap.on('moveend',()=>{if(page!=='Home'||stationView!=='map')return;const c=geoMap.getCenter();if(!c||!Number.isFinite(c.lat)||!Number.isFinite(c.lng))return;
 if(haversine(mapCenter.lat,mapCenter.lng,c.lat,c.lng)<4)return;
 clearTimeout(panTimer);panTimer=setTimeout(()=>{mapCenter={lat:c.lat,lng:c.lng};officialLoad(mapCenter)},1200);
 });
};
// Disclamer source in station filter. Does not alter the optional view/list and connected flow.
const OLD_FILTERS=window.openMapFilters;
window.openMapFilters=function(){OLD_FILTERS();const box=document.querySelector('.modalcontent');if(box){const p=document.createElement('p');p.className='gg-note';p.innerHTML='Precios de carburante: Ministerio / <a href="https://puntomuerto.es/api" target="_blank" rel="noopener">Punto Muerto</a>. Ocupación, espera y duración: simuladas. Ubicación y potencia de recarga: CSV RIPREE cuando así se indique.';p.innerHTML='Carburantes: precios oficiales cuando estén disponibles. Recarga: <b>censo RIPREE del CSV 21/10/2026, incorporado automáticamente</b>. Ubicaciones, número de puntos y potencia publicados; tarifas y ocupación siempre ficticias.';box.appendChild(p)}};
})();
