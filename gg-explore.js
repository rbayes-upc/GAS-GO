/* FULL: búsqueda explícita de lugares y comparación de servicios compatibles. */
(function(){'use strict';
const $=id=>document.getElementById(id),esc=escapeHtml;
const GEOCODER='https://nominatim.openstreetmap.org/search';
const text=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
const distance=s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)?haversine(mapCenter.lat,mapCenter.lng,s.lat,s.lng):Number(s.dist);
const km=n=>Number.isFinite(n)?n.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})+' km':'Sin distancia';
let places=[],searchRequest=null,searchEpoch=0,lastRequest=0,area=null,areaEpoch=0;
let comparisonService='fuel',comparisonSort='price',comparisonLimit=10;
const cache=new Map();
function cancelSearch(){searchEpoch++;searchRequest?.abort();searchRequest=null;places=[]}
const oldClose=window.closeModal;
window.closeModal=function(){cancelSearch();oldClose()};
const oldSearch=window.openSearch;
window.openSearch=function(){
 if(inPresentationDemo()){oldSearch();return}
 cancelSearch();
 modal(`<h2>Buscar un lugar o estación</h2><form id="ggPlaceForm"><label class="field" for="ggPlaceQuery">Dirección, población o estación</label><input id="ggPlaceQuery" type="search" maxlength="160" autocomplete="off" placeholder="Ej.: Girona o Gran Via 100, Barcelona"><button class="btn primary block" type="submit">Buscar dirección o población</button></form><p class="small muted">Direcciones de España · la búsqueda se envía al pulsar el botón.</p><div id="ggPlaceStatus" role="status" aria-live="polite"></div><div id="ggPlaceResults"></div><section id="ggLocalResults"></section><p class="small muted gg-geocoder-credit">Búsqueda: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · Nominatim</p>`);
 $('ggPlaceForm').addEventListener('submit',event=>{event.preventDefault();searchPlaces()});
 $('ggPlaceQuery').addEventListener('input',()=>{cancelSearch();$('ggPlaceResults').replaceChildren();$('ggPlaceStatus').textContent='';document.querySelector('#ggPlaceForm button').disabled=false;localResults()});
 localResults();$('ggPlaceQuery').focus();
};
function localResults(){
 const q=text($('ggPlaceQuery')?.value),node=$('ggLocalResults');if(!node)return;
 const stations=shownStations().filter(s=>!q||text(s.name+' '+s.area).includes(q)).slice(0,5);
 node.innerHTML='<h3>Estaciones compatibles del mapa</h3>'+(stations.map(s=>`<button type="button" class="gg-place-result" onclick="ggExplore.station(${Number(s.id)})"><strong>${esc(s.name)}</strong><small>${esc(s.area||'')} · ${km(distance(s))}</small></button>`).join('')||'<p class="small muted">Sin coincidencias en el mapa actual. Busca una dirección o población para explorar otra zona.</p>');
}
function displayPlaces(rows){
 places=rows;
 $('ggPlaceStatus').textContent=rows.length?'Elige la zona que quieres explorar.':'No se han encontrado direcciones. Añade el municipio o prueba otra dirección.';
 $('ggPlaceResults').innerHTML=rows.map((p,i)=>`<button type="button" class="gg-place-result" onclick="ggExplore.place(${i})"><strong>${esc(p.label)}</strong><small>${esc(p.description)}</small></button>`).join('');
}
async function searchPlaces(){
 const input=$('ggPlaceQuery');if(!input||inPresentationDemo())return;
 const query=input.value.trim(),key=text(query);
 if(query.length<3){$('ggPlaceStatus').textContent='Escribe al menos 3 caracteres.';return}
 cancelSearch();const epoch=searchEpoch;const valid=()=>epoch===searchEpoch&&!!$('ggPlaceQuery')&&!inPresentationDemo();
 $('ggPlaceResults').replaceChildren();const cached=cache.get(key);
 if(cached&&Date.now()-cached.time<3600000){displayPlaces(cached.rows);return}
 if(Date.now()-lastRequest<1100){$('ggPlaceStatus').textContent='Espera un momento antes de volver a buscar.';return}
 lastRequest=Date.now();const ctrl=new AbortController();searchRequest=ctrl;
 $('ggPlaceStatus').textContent='Buscando direcciones…';document.querySelector('#ggPlaceForm button').disabled=true;
 const timer=setTimeout(()=>ctrl.abort(),10000);
 try{
  const params=new URLSearchParams({format:'jsonv2',q:query,countrycodes:'es',limit:'5',addressdetails:'1','accept-language':'es'});
  const response=await fetch(GEOCODER+'?'+params,{headers:{Accept:'application/json'},signal:ctrl.signal,credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});
  if(!response.ok)throw Error(response.status===429?'rate':'network');
  const result=await response.json();if(!Array.isArray(result))throw Error('invalid');
  const rows=result.filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180).slice(0,5).map(p=>({lat:Number(p.lat),lng:Number(p.lon),label:String(p.display_name||p.name||query).split(',').slice(0,3).join(',').slice(0,150),description:String(p.display_name||p.name||query).slice(0,300)}));
  cache.set(key,{time:Date.now(),rows});if(valid())displayPlaces(rows);
 }catch(error){if(valid())$('ggPlaceStatus').textContent=error.message==='rate'?'El servicio está ocupado. Espera unos segundos y vuelve a buscar.':error.name==='AbortError'?'La búsqueda tarda demasiado. Vuelve a intentarlo.':'No se ha podido buscar la dirección. Comprueba Internet y vuelve a intentarlo.'}
 finally{clearTimeout(timer);if(valid()){document.querySelector('#ggPlaceForm button').disabled=false;searchRequest=null}}
}
function station(id){closeModal();goStation(id)}
function place(index){
 const p=places[index];if(!p||inPresentationDemo())return;
 const previous=area?.previous||{...mapCenter};closeModal();area={...p,previous,loading:true};areaEpoch++;
 mapCenter={lat:p.lat,lng:p.lng};mapSearch='';selectedStation=null;stationView='map';go('Home');loadArea();
}
async function loadArea(){
 if(!area||inPresentationDemo())return;
 const epoch=++areaEpoch,current=area;current.loading=true;render();
 try{await loadRealStations({lat:current.lat,lng:current.lng})}
 catch(error){if(epoch===areaEpoch)current.error=true}
 finally{if(epoch===areaEpoch&&area===current&&!inPresentationDemo()){current.loading=false;current.error=current.error||geoStationMode==='demo';if(page==='Home')render()}}
}
function leaveArea(){
 if(!area)return;const center=area.previous;area=null;areaEpoch++;mapCenter={...center};selectedStation=null;render();loadRealStations(mapCenter);
}
const oldShown=window.shownStations;
window.shownStations=function(){
 const rows=oldShown();if(!area||inPresentationDemo())return rows;
 if(haversine(mapCenter.lat,mapCenter.lng,area.lat,area.lng)>.5)return rows;
 // No presentar estaciones de Barcelona como resultados de una búsqueda en otra población.
 return rows.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&distance(s)<14&&!s.demoOnly&&(geoStationMode!=='demo'||s.realElectric));
};
function comparisonRows(){
 return shownStations().map(s=>{const service=ggUX.stationServices(s).find(v=>v.type===comparisonService);return service?{s,...service,distance:distance(s)}:null}).filter(Boolean);
}
function openComparison(service){
 if(inPresentationDemo())return;
 const both=ggUX.energyMode()==='both';comparisonService=service||(ggUX.energyMode()==='charge'?'charge':'fuel');comparisonSort='price';comparisonLimit=10;
 modal(`<h2>Comparar estaciones</h2><p class="small muted">${esc(data.vehicle)} · Distancias en línea recta desde ${area?'la zona buscada':'el centro del mapa'}.</p>${both?`<fieldset class="gg-compare-services"><legend>Servicio que quieres comparar</legend><button type="button" class="btn ghost" aria-pressed="${comparisonService==='fuel'}" onclick="ggExplore.compare('fuel')">Repostar</button><button type="button" class="btn ghost" aria-pressed="${comparisonService==='charge'}" onclick="ggExplore.compare('charge')">Recargar</button></fieldset><p class="small muted">Cada servicio se compara por separado: €/L o €/kWh.</p>`:''}<label class="field" for="ggCompareSort">Ordenar por</label><select id="ggCompareSort"><option value="price">Menor precio</option><option value="distance">Más cerca</option></select><div id="ggCompareResults"></div><p class="small muted">Se aplican tu vehículo y los filtros del mapa. Disponibilidad y tarifas de recarga simuladas.</p>`);
 $('ggCompareSort').addEventListener('change',event=>{comparisonSort=event.target.value;comparisonLimit=10;renderComparison()});renderComparison();
}
function renderComparison(){
 const node=$('ggCompareResults');if(!node)return;
 if(geoLoading||area?.loading){node.innerHTML='<p class="gg-empty" role="status">Buscando estaciones de esta zona…</p>';return;}
 const rows=comparisonRows().sort((a,b)=>comparisonSort==='price'?a.price-b.price||a.distance-b.distance:a.distance-b.distance||a.price-b.price);
 if(!rows.length){node.innerHTML='<p class="gg-empty" role="status">No hay estaciones compatibles con este servicio y los filtros actuales. Prueba otra zona o ajusta los filtros del mapa.</p>';return}
 const minPrice=Math.min(...rows.map(r=>r.price)),minDistance=Math.min(...rows.map(r=>r.distance).filter(Number.isFinite));
 const shown=rows.slice(0,comparisonLimit),unit=comparisonService==='charge'?'€/kWh':'€/L';
 node.innerHTML=`<p class="small muted" role="status">${rows.length} estaciones comparables · ${esc(rows[0].label)}</p><table class="gg-compare-table"><caption>Precio y distancia · ${esc(rows[0].label)}</caption><thead><tr><th scope="col">Estación</th><th scope="col">Precio (${unit})</th><th scope="col">Distancia</th></tr></thead><tbody>${shown.map(r=>`<tr data-station-id="${Number(r.s.id)}"><th scope="row"><button type="button" onclick="ggExplore.comparedStation(${Number(r.s.id)},'${comparisonService}')">${esc(r.s.name)}</button><small>${esc(r.source)}</small>${r.price===minPrice?'<span class="gg-compare-badge">Menor precio</span>':''}${r.distance===minDistance?'<span class="gg-compare-badge">Más cerca</span>':''}</th><td><strong>${r.price.toLocaleString('es-ES',{minimumFractionDigits:3,maximumFractionDigits:3})}</strong></td><td>${km(r.distance)}</td></tr>`).join('')}</tbody></table><p class="small muted">Pulsa el nombre para ver la estación. Las etiquetas comparan solo las estaciones mostradas por tus filtros.</p>${rows.length>shown.length?'<button type="button" class="btn ghost block" onclick="ggExplore.more()">Mostrar más estaciones</button>':''}`;
}
function comparedStation(id,service){closeModal();go('Home');ggUX.selectStation(id,service)}
const oldRender=window.render;
window.render=function(){
 if(inPresentationDemo()){area=null;areaEpoch++}
 else if(area&&haversine(mapCenter.lat,mapCenter.lng,area.lat,area.lng)>.5){area=null;areaEpoch++}
 oldRender();
 const search=document.querySelector('.top-actions button[onclick="openSearch()"]');if(search)search.setAttribute('aria-label',inPresentationDemo()?'Buscar gasolinera':'Buscar dirección, población o estación');
 if(page!=='Home'||inPresentationDemo())return;
 renderComparison();
 const container=document.querySelector('.mapcontrols,.station-list-screen .list-summary');
 if(container){const button=document.createElement('button');button.type='button';button.className='map-filter-btn gg-compare-open';button.textContent='Comparar';button.addEventListener('click',()=>openComparison());container.append(button)}
 if(area){
  const status=document.createElement('section');status.className='gg-search-area';status.setAttribute('aria-label','Zona explorada');
  status.innerHTML=`<div><strong>Explorando: ${esc(area.label)}</strong>${area.loading?'<small role="status">Buscando estaciones en esta zona…</small>':area.error?'<small role="alert">No se han podido actualizar todos los datos de esta zona.</small>':'<small>Distancias desde esta zona · tu ubicación no cambia.</small>'}</div>${area.error?'<button type="button" class="btn ghost" onclick="ggExplore.retryArea()">Reintentar</button>':''}<button type="button" class="gg-leave-area" onclick="ggExplore.leaveArea()" aria-label="Volver a la zona anterior">×</button>`;
  const card=document.querySelector('.gg-active-vehicle');if(card)card.after(status);
 }
};
window.ggExplore={locationRevision:()=>areaEpoch,place,station,compare:openComparison,comparedStation,more(){comparisonLimit+=10;renderComparison()},leaveArea,retryArea(){if(area)area.error=false;loadArea()}};
render();
})();
