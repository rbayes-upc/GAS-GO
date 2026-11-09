/* Borrador UX: navegación, ubicación y compatibilidad por vehículo. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const HYBRID='Híbrido enchufable';
const connectors=['Tipo 2','CCS2','CHAdeMO','Tipo 1','Schuko'];
const esc=escapeHtml;
let history=[],goingBack=false,locationChecked=false,lastVehicleIdentity=null;
let locationPending=false,lastCompletedReceipt=null,completionTimer=null,completionExpiresAt=0;
let chargeConnectorFilter='',minimumChargePower=0;
let fullDataInformation='';
const hybrid=()=>data.customVehicle?.fuel===HYBRID&&data.vehicle===data.customVehicle.name;
const preferenceKey=()=>data.customVehicle?.plate||data.vehicle;
function energyMode(){return hybrid()?(data.energyPreferences?.[preferenceKey()]||'fuel'):data.fuel==='Eléctrico'?'charge':'fuel'}
function combustion(){return hybrid()?data.customVehicle.combustionFuel||'Gasolina 95':data.fuel}
function syncEnergy(){
 const identity=[data.vehicle,data.customVehicle?.plate,hybrid()?HYBRID:data.fuel,data.customVehicle?.connector,data.customVehicle?.combustionFuel].join('|');
 if(identity!==lastVehicleIdentity){filterFuel='Todos';maxPrice=0;chargeConnectorFilter='';minimumChargePower=0;selectedStation=null;lastVehicleIdentity=identity}
 if(!hybrid())return;
 const fuel=energyMode()==='charge'?'Eléctrico':combustion();
 if(data.fuel!==fuel){data.fuel=fuel;save()}
}
function compatibleCharge(s){
 if(!(s.ev>0))return false;
 const connector=data.customVehicle?.name===data.vehicle?data.customVehicle.connector:null;
 const published=String(s.evConnector||'').split(',').map(x=>x.trim());
 if(connector&&!published.includes(connector))return false;
 if(chargeConnectorFilter&&!published.includes(chargeConnectorFilter))return false;
 return !minimumChargePower||chargePower(s)>=minimumChargePower;
}
function chargePower(s){return Math.max(Number(s.evPowerPublished)||0,Number(s.kw)||0,...(s.evPowerLevels||[]).map(level=>Number(level[0])||0))}
const compatibleFuel=s=>Number(combustion()==='Diésel'?s.diesel:s.gas)>0;
function setEnergy(mode){
 if(!hybrid()||!['fuel','charge','both'].includes(mode))return;
 data.energyPreferences=data.energyPreferences||{};data.energyPreferences[preferenceKey()]=mode;
 if(mode==='both')mapSort='dist';
 filterFuel='Todos';maxPrice=0;selectedStation=null;syncEnergy();save();render();
}
function energyFields(prefix,v){
 const hybridSelected=v.fuel===HYBRID,charging=hybridSelected||v.fuel==='Eléctrico';
 const fuelId=prefix==='reg'?'reg_combustionFuel':'ggvCombustion';
 const connectorId=prefix==='reg'?'reg_connector':'ggvConnector';
 return `<div class="gg-energy-fields" id="${prefix}MotorFields" ${hybridSelected?'':'hidden'}><label class="field" for="${fuelId}">Combustible del motor</label><select id="${fuelId}">${['Gasolina 95','Diésel'].map(x=>`<option ${v.combustionFuel===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="gg-energy-fields" id="${prefix}ChargeFields" ${charging?'':'hidden'}><label class="field" for="${connectorId}">Conector de carga</label><select id="${connectorId}"><option value="">Selecciona el conector</option>${connectors.map(x=>`<option ${v.connector===x?'selected':''}>${x}</option>`).join('')}</select><p class="small muted">Consulta el conector de tu vehículo. Se mostrarán los puntos que publiquen ese conector.</p></div>`;
}
function toggleEnergyFields(prefix){
 const fuel=$(prefix==='reg'?'reg_fuel':'ggvFuel')?.value;
 $(prefix+'MotorFields').hidden=fuel!==HYBRID;
 $(prefix+'ChargeFields').hidden=![HYBRID,'Eléctrico'].includes(fuel);
}
const originalGo=window.go;
window.go=function(target){
 if(!goingBack&&target!==page){history.push({page,stationView,selectedStation,scroll:window.scrollY});if(history.length>40)history.shift()}
 originalGo(target);
};
function back(){
 if(page==='Registro'&&regStep>1){regCache();regNavigate(regStep-1);return}
 const previous=history.pop()||{page:page==='Registro'?'Bienvenida':'Home',stationView:'map',selectedStation:null,scroll:0};
 goingBack=true;try{originalGo(previous.page);stationView=previous.stationView;selectedStation=previous.selectedStation;render();window.scrollTo(0,previous.scroll)}finally{goingBack=false}
}
window.shownStations=function(){
 syncEnergy();const mode=energyMode(),q=mapSearch.trim().toLocaleLowerCase('es');
 const selected=filterFuel==='Todos'?null:filterFuel;
 const options=s=>{
  const values=[];
  if(mode!=='charge'&&compatibleFuel(s)&&(!selected||selected===combustion()))values.push({price:combustion()==='Diésel'?s.diesel:s.gas,free:s.free});
  if(mode!=='fuel'&&compatibleCharge(s)&&(!selected||selected==='Eléctrico'))values.push({price:s.ev,free:s.evFree});
  return values.filter(v=>(!onlyAvailable||v.free>0)&&(mode==='both'||!maxPrice||v.price<=maxPrice));
 };
 return STATIONS.filter(s=>(!q||(s.name+' '+s.area).toLocaleLowerCase('es').includes(q))&&options(s).length).sort((a,b)=>{
  if(mode==='both')return a.dist-b.dist;
  if(mapSort==='price')return options(a)[0].price-options(b)[0].price;
  if(mapSort==='free')return (options(b)[0].free||0)-(options(a)[0].free||0);
  if(['fastest','wait','time'].includes(mapSort)&&window.ggTiming)return ggTiming.sortScore(a,mapSort)-ggTiming.sortScore(b,mapSort)||a.dist-b.dist;
  return a.dist-b.dist;
 });
};
function selectStation(id,desiredMode){
 const s=STATIONS.find(x=>x.id===id);if(!s)return;
 if(!inPresentationDemo())stationView='map';
 if(hybrid()&&energyMode()==='both'){
  if(!desiredMode&&compatibleFuel(s)&&compatibleCharge(s)){
   modal(`<h2>${esc(s.name)}</h2><p>¿Qué servicio necesitas?</p><button class="btn primary block" onclick="ggUX.openStation(${id},'fuel')">Repostar</button><button class="btn block" onclick="ggUX.openStation(${id},'charge')">Recargar</button>`);return;
  }
  // La ficha debe usar el producto elegido, sin enviar «híbrido» al surtidor.
  if(desiredMode==='charge'||!compatibleFuel(s)){setEnergy('charge')}else setEnergy('fuel');
 }
 selectedStation=id;render();
}
function openStation(id,mode){closeModal();setEnergy(mode);stationView='map';selectStation(id,mode)}
function drawStations(map,layer){
 const draw=()=>{
  layer.clearLayers();const cells=new Map();
  for(const s of shownStations()){
   if(!Number.isFinite(s.lat)||!Number.isFinite(s.lng))continue;
   const point=map.project([s.lat,s.lng],map.getZoom());const key=Math.floor(point.x/58)+':'+Math.floor(point.y/58);
   if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);
  }
  for(const group of cells.values()){
   const s=group[0],cluster=group.length>1;
   const position=cluster?[group.reduce((n,x)=>n+x.lat,0)/group.length,group.reduce((n,x)=>n+x.lng,0)/group.length]:[s.lat,s.lng];
   const mixed=s.ev>0&&(Number(s.gas)>0||Number(s.diesel)>0),ev=s.ev>0&&!mixed;
   const hasCharging=group.some(station=>station.ev>0);
   const icon=L.divIcon({className:'',html:cluster?`<button class="gg-map-cluster ${hasCharging?'gg-map-cluster-charging':''}" aria-label="Ver ${group.length} estaciones${hasCharging?', con recarga eléctrica':''}">${group.length}</button>`:`<div class="geo-pin ${ev?'ev':mixed?'mixed':''}" aria-label="${esc(s.name)}">${ev?'⚡':'⛽'}</div>`,iconSize:[34,34],iconAnchor:[17,17]});
   const marker=L.marker(position,{icon,autoPanOnFocus:false}).addTo(layer);
   marker.getElement()?.addEventListener('mousedown',event=>{
    // Leaflet restaura el scroll de la ventana, pero el mapa vive en un panel
    // con scroll propio. Enfocar sin desplazar evita perder el clic del marcador.
    event.stopPropagation();event.currentTarget.focus({preventScroll:true});
   });
   marker.getElement()?.addEventListener('focus',event=>{
    if(event.currentTarget.matches(':focus-visible'))map.panInside(position,{padding:[20,20]});
   });
   marker.getElement()?.addEventListener('keydown',event=>{
    if(event.target!==event.currentTarget||!['Enter',' '].includes(event.key))return;
    event.preventDefault();event.stopPropagation();marker.fire('click');
   });
   marker.on('click',()=>{
    if(!cluster){selectStation(s.id);return}
    if(map.getZoom()<18){map.setView(position,map.getZoom()+2);return}
    modal(`<h2>Estaciones en esta ubicación</h2>${group.map(x=>`<button class="btn block" onclick="closeModal();ggUX.selectStation(${x.id})">${esc(x.name)}</button>`).join('')}`);
   });
  }
 };
 // La cuadrícula depende del zoom, no del centro: no reemplazar un marcador
 // durante el enfoque/paneo que puede producirse entre pulsar y soltar el ratón.
 draw();map.on('zoomend',draw);
}
function activeVehicle(){return data.customVehicle?.name===data.vehicle?data.customVehicle:null}
function vehicleCard(content){
 if(inPresentationDemo())return;
 window.GGPlate?.ensureExamples?.();
 const vehicle=activeVehicle();
 const description=hybrid()?`${HYBRID} · ${energyMode()==='both'?'Ambos servicios':energyMode()==='charge'?'Recargar':'Repostar'}`:data.fuel;
 const card=document.createElement('section');card.className='gg-active-vehicle';card.setAttribute('aria-label','Vehículo activo');
 card.innerHTML=`<div><span class="gg-active-vehicle-label">Vehículo activo</span><strong>${esc(data.vehicle||'Selecciona un vehículo')}</strong><small>${esc(description||'')}${vehicle?.plate?' · '+esc(vehicle.plate):''}</small></div><button type="button" class="btn ghost" onclick="ggUX.chooseVehicle()" aria-label="Cambiar vehículo">Cambiar</button>`;
 content.prepend(card);
}
function chooseVehicle(){
 if(inPresentationDemo())return;
 window.GGPlate?.ensureExamples?.();
 const rows=Array.isArray(data.plateVehicles)?data.plateVehicles:[];
 modal(`<h2>Cambiar vehículo</h2><p class="small muted">Las estaciones y los filtros se actualizarán con tu elección.</p>${rows.map((v,i)=>`<button type="button" class="gg-vehicle-pick" onclick="ggUX.pickVehicle(${i})"><strong>${esc(v.name)}</strong><span>${esc(v.plate)} · ${esc(v.fuel)}</span>${v.plate===activeVehicle()?.plate?'<small>Seleccionado</small>':''}</button>`).join('')||'<p>Tienes disponible el vehículo actual. Puedes añadir otro desde Mi garaje.</p>'}<button type="button" class="btn ghost block" onclick="closeModal();go('Mi vehículo')">Gestionar mi garaje</button>`);
}
function pickVehicle(index){if(inPresentationDemo())return;GGPlate.select(index);closeModal()}
const previousFilters=window.openMapFilters,previousApplyFilters=window.applyCompactFilters,previousClearFilters=window.clearMapFilters;
window.openMapFilters=function(){
 if(inPresentationDemo()){previousFilters();return}
 const mode=energyMode(),charging=mode!=='fuel',both=mode==='both',vehicle=activeVehicle();
 const prices=both?[]:mode==='charge'?[.2,.3,.4,.5,.6,.8,1]:[1.4,1.5,1.6,1.7,1.8,2,2.5];
 if(maxPrice&&!prices.includes(maxPrice))prices.push(maxPrice);prices.sort((a,b)=>a-b);
 const connector=vehicle?.connector||chargeConnectorFilter;
 const connectorOptions=vehicle?.connector?[vehicle.connector]:connectors;
 const options=(items,value)=>items.map(x=>`<option value="${esc(x)}" ${String(x)===String(value)?'selected':''}>${esc(x)}</option>`).join('');
 modal(`<h2>Filtrar ${mode==='fuel'?'estaciones de servicio':mode==='charge'?'puntos de recarga':'ambos servicios'}</h2><p class="gg-filter-context">${esc(data.vehicle)} · ${esc(both?'Repostar y recargar':data.fuel)}</p><label class="field" for="modalMapQuery">Buscar por nombre o zona</label><input id="modalMapQuery" type="search" maxlength="50" value="${esc(mapSearch)}" placeholder="Nombre, calle o población"><label class="field" for="modalPrice">Precio máximo ${mode==='charge'?'(€/kWh)':both?'':'(€/L)'}</label><select id="modalPrice" ${both?'disabled':''}><option value="0">Sin límite</option>${prices.map(p=>`<option value="${p}" ${maxPrice===p?'selected':''}>${p.toFixed(2).replace('.',',')} ${mode==='charge'?'€/kWh':'€/L'}</option>`).join('')}</select>${both?'<p class="small muted">Elige Repostar o Recargar para comparar precios del mismo servicio. En Ver ambas se ordena por distancia.</p>':''}${charging?`<label class="field" for="modalConnector">${vehicle?.connector?'Conector del vehículo':'Conector de carga'}</label><select id="modalConnector" ${vehicle?.connector?'disabled':''}>${vehicle?.connector?'':'<option value="">Cualquiera</option>'}${options(connectorOptions,connector)}</select><label class="field" for="modalPower">Potencia máxima de la estación: al menos</label><select id="modalPower"><option value="0">Sin mínimo</option>${[7,11,22,50,100,150,250].map(p=>`<option value="${p}" ${minimumChargePower===p?'selected':''}>${p} kW</option>`).join('')}</select><p class="small muted">Se comprueba la potencia máxima publicada de la instalación; puede variar por conector. ${both?'Estos filtros solo afectan a la recarga.':''}</p><details class="gg-secondary-details"><summary>Estimación de la recarga</summary><label class="field" for="ggDemoEnergy">Energía a estimar</label><select id="ggDemoEnergy">${ggTiming.energyOptions()}</select></details>`:''}<label class="field" for="modalSort">Ordenar por</label><select id="modalSort" ${both?'disabled':''}>${ggTiming.sortOptions()}</select><label class="gg-filter-available"><input id="modalAvailable" type="checkbox" ${onlyAvailable?'checked':''}> Solo ${mode==='fuel'?'surtidores':'puntos'} libres (simulación)</label><p class="small muted">La disponibilidad y las estimaciones de tiempo son simuladas.</p><div class="btnrow"><button type="button" class="btn ghost" onclick="closeModal();clearMapFilters()">Limpiar</button><button type="button" class="btn primary" onclick="applyCompactFilters()">Aplicar filtros</button></div>`);
 if(both)$('modalSort').value='dist';
};
window.applyCompactFilters=function(){
 if(inPresentationDemo()){previousApplyFilters();return}
 const both=energyMode()==='both';mapSearch=$('modalMapQuery').value.trim();filterFuel='Todos';
 maxPrice=both?0:Number($('modalPrice').value)||0;mapSort=both?'dist':$('modalSort').value;onlyAvailable=$('modalAvailable').checked;
 chargeConnectorFilter=$('modalConnector')?.value||'';minimumChargePower=Number($('modalPower')?.value)||0;
 if($('ggDemoEnergy'))ggTiming.setEnergy($('ggDemoEnergy').value);
 selectedStation=null;closeModal();render();
};
window.clearMapFilters=function(){if(!inPresentationDemo()){chargeConnectorFilter='';minimumChargePower=0}previousClearFilters()};
const previousGoStation=window.goStation;
window.goStation=function(id){if(!inPresentationDemo()&&hybrid()&&energyMode()==='both'){stationView='map';go('Home');selectStation(id);return}previousGoStation(id)};
function summarizeStation(card){
 if(inPresentationDemo())return;
 const id=Number(card.dataset.stationId),station=STATIONS.find(s=>s.id===id);if(!station)return;
 const oldPrices=card.querySelector('.gg-price-pair,.list-price-row');if(!oldPrices)return;
 const mode=energyMode(),services=[];
 if(mode!=='charge'&&compatibleFuel(station))services.push({label:combustion(),price:combustion()==='Diésel'?station.diesel:station.gas,unit:'€/L',free:station.free,total:station.total,source:station.officialSource?'Precio oficial':'Precio simulado'});
 if(mode!=='fuel'&&compatibleCharge(station))services.push({label:'Recarga eléctrica',price:station.ev,unit:'€/kWh',free:station.evFree,total:station.evTotal,source:'Tarifa simulada',charging:true});
 const summary=document.createElement('div');summary.className='gg-service-summary';
 summary.innerHTML=services.map(service=>`<div><small>${esc(service.label)} · ${esc(service.source)}</small><strong>${Number(service.price).toLocaleString('es-ES',{minimumFractionDigits:3,maximumFractionDigits:3})} <span>${service.unit}</span></strong><span class="gg-service-free">${Number(service.free)||0}${service.total?'/'+service.total:''} ${service.charging?'puntos':'surtidores'} libres · simulado</span>${service.charging?`<span class="gg-service-connector">${esc(activeVehicle()?.connector||station.evConnector||'Conector no publicado')} · ${chargePower(station)?'hasta '+chargePower(station)+' kW en la estación':'Potencia no publicada'}</span>`:''}</div>`).join('');
 oldPrices.before(summary);
 const stock=card.querySelector('.stock');if(stock){const available=services.some(s=>s.free>0);stock.textContent=available?'Disponible en la simulación':'Ocupado en la simulación';stock.classList.toggle('ok',available);stock.classList.toggle('bad',!available)}
}

function setupMoreMenu(){
 const header=document.querySelector('.top-actions');if(!header||$('ggAppMore'))return;
 const settings=header.querySelector('[aria-label="Configuración"]'),incident=$('ggIncidentButton');
 const menu=document.createElement('details');menu.id='ggAppMore';menu.className='gg-app-more';
 const summary=document.createElement('summary');summary.textContent='⋯';summary.setAttribute('aria-label','Más opciones de la aplicación');menu.append(summary);
 const panel=document.createElement('div');panel.className='gg-app-more-panel';menu.append(panel);
 for(const [button,label] of [[settings,'Configuración'],[incident,'Comunicar incidencia']]){
  if(!button)continue;button.classList.remove('iconbutton');button.classList.add('gg-more-action');button.textContent=label;panel.append(button);
 }
 const help=document.createElement('button');help.type='button';help.className='gg-more-action';help.textContent='Ayuda';help.addEventListener('click',()=>go('Ayuda'));panel.append(help);
 panel.addEventListener('click',event=>{if(event.target.closest('button'))menu.open=false});
 document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;summary.focus()}});
 header.append(menu);
}
function foldDetails(container,selector,label){
 const nodes=Array.from(container.querySelectorAll(selector)).filter(node=>!node.closest('.gg-secondary-details'));
 if(!nodes.length)return;
 const details=document.createElement('details');details.className='gg-secondary-details';
 const summary=document.createElement('summary');summary.textContent=label;details.append(summary);
 nodes[0].before(details);for(const node of nodes)details.append(node);
}
function simplify(content){
 const mapHome=content.querySelector('.map-home');
 if(mapHome){
  if(!inPresentationDemo()){
   mapHome.querySelector('.map-home-title')?.remove();
   mapHome.querySelector('.map-status')?.remove();
   const sources=Array.from(mapHome.querySelectorAll('.gg-source,.gg-ev-strip')).filter(node=>!node.textContent.includes('⚠'));
   fullDataInformation=sources.map(node=>node.outerHTML).join('');for(const node of sources)node.remove();
  }else{
   foldDetails(mapHome,'.gg-source','Información de los datos');
   for(const strip of mapHome.querySelectorAll('.gg-ev-strip')){
    if(strip.textContent.includes('⚠'))continue;
    const details=mapHome.querySelector('.gg-secondary-details');if(details&&!strip.closest('details'))details.append(strip);
   }
   const title=mapHome.querySelector('.map-home-title span');if(title)title.textContent='Prototipo · operaciones simuladas';
  }
 }
 for(const card of content.querySelectorAll('.gg-station-popup,.list-station-card,.gg-demo-compact-popup,.gg258-list-card')){
  summarizeStation(card);
  foldDetails(card,inPresentationDemo()?'.gg-station-source,.gg245-metrics,.ggdc-times':'.gg-station-source,.gg245-metrics,.gg-price-pair,.list-price-row,.list-stat-row,.gg-ev-capacity','Más detalles de la estación');
  const secondary=card.querySelector('.gg-secondary-details');if(!secondary)continue;
  const service=card.querySelector('.gg-service-summary');if(service)secondary.before(service);
  const favorite=card.querySelector('button[onclick^="fav("]'),incident=card.querySelector('.gg-report-station,button[onclick^="ggIncidents.openWithStation("]');
  if(favorite)secondary.append(favorite);
  if(incident&&!card.matches('.gg-station-popup'))secondary.append(incident);
  if(card.matches('.gg-station-popup')){
   const row=card.querySelector('.gg-popup-actions'),arrival=card.querySelector(':scope > button[onclick^="start("]');
   if(row&&arrival){row.classList.add('gg-primary-actions');row.append(arrival)}
  }
  const actions=card.querySelector('.ggdc-secondary');if(actions&&actions.children.length===1)actions.classList.add('gg-single-secondary');
 }
}
function dismissCompletion(){
 clearTimeout(completionTimer);completionTimer=null;completionExpiresAt=0;lastCompletedReceipt=null;
 $('ggCompletionCard')?.remove();
}
function showCompletion(content){
 if(lastCompletedReceipt&&Date.now()>=completionExpiresAt){dismissCompletion();return}
 const receipt=lastCompletedReceipt&&findReceipt(lastCompletedReceipt);if(!receipt)return;
 const card=document.createElement('section');card.id='ggCompletionCard';card.className='gg-completion-card';
 card.setAttribute('aria-label','Operación finalizada');
 card.innerHTML=`<h2>${receipt.energy>0?'Recarga finalizada':'Repostaje finalizado'}</h2><p><strong>${esc(euro(receipt.amount))}</strong> · ${esc(receipt.station||'GAS&GO')}</p><p class="small muted">Operación simulada. La factura también está disponible en Historial.</p><button type="button" class="btn primary block" id="ggOpenCompletedInvoice">Ver y descargar factura</button><button type="button" class="gg-completion-dismiss" id="ggDismissCompletion">Seguir explorando</button>`;
 card.querySelector('#ggOpenCompletedInvoice').addEventListener('click',()=>viewReceipt(receipt.id));
 card.querySelector('#ggDismissCompletion').addEventListener('click',dismissCompletion);
 content.prepend(card);
}
const originalNotification=window.showRepostNotification;
window.showRepostNotification=function(amount,receiptId){
 if(!receiptId||!findReceipt(receiptId)){originalNotification(amount);return}
 clearTimeout(completionTimer);lastCompletedReceipt=receiptId;completionExpiresAt=Date.now()+3000;
 completionTimer=setTimeout(dismissCompletion,3000);if(page==='Home')render();
};
window.locateUser=function(){
 if(inPresentationDemo()){geoStatus='Ubicación simulada: estás en la estación de demostración.';render();toast(geoStatus);return}
 if(locationPending)return;
 if(!navigator.geolocation){geoStatus='Tu navegador no permite obtener la ubicación.';render();return}
 locationPending=true;geoStatus='Buscando tu ubicación…';if(page==='Home')render();
 navigator.geolocation.getCurrentPosition(position=>{
  locationPending=false;userPosition={lat:position.coords.latitude,lng:position.coords.longitude};mapCenter={...userPosition};geoStatus='Tu ubicación está marcada en azul.';
  if(page==='Home')render();loadRealStations(mapCenter);
 },error=>{
  locationPending=false;userPosition=null;
  geoStatus=error.code===1?'Ubicación denegada. Activa el permiso del navegador para ver tu punto azul.':error.code===3?'La ubicación tarda demasiado. Pulsa «Mi ubicación» para reintentar.':'No se ha podido obtener tu ubicación. Puedes reintentar o explorar el mapa.';
  if(page==='Home')render();toast(geoStatus);
 },{enableHighAccuracy:true,timeout:14000,maximumAge:60000});
};
const originalRender=window.render;
window.render=function(){
 syncEnergy();originalRender();
 const content=$('content');
 if(!['Home','Bienvenida'].includes(page))content.insertAdjacentHTML('afterbegin','<button class="gg-back" type="button" onclick="ggUX.back()" aria-label="Volver a la pantalla anterior">← Volver</button>');
 if(page==='Ayuda'&&!inPresentationDemo())content.insertAdjacentHTML('beforeend',`<section class="card" id="ggHelpData"><h2>Información de los datos</h2><p class="small muted">Las operaciones, la disponibilidad y los tiempos de espera son simulados. Las fuentes y el estado de los datos del mapa se muestran aquí.</p><p class="small muted">${esc(geoStatus)}</p>${fullDataInformation||'<p class="small muted">Abre el mapa para consultar sus fuentes de datos.</p>'}</section>`);
 if(page==='Home'){
  const controls=hybrid()?`<fieldset class="gg-energy-switch"><legend>¿Qué necesitas para tu híbrido?</legend>${[['fuel','Repostar'],['charge','Recargar'],['both','Ver ambas']].map(([mode,text])=>`<button type="button" aria-pressed="${energyMode()===mode}" onclick="ggUX.setEnergy('${mode}')">${text}</button>`).join('')}</fieldset>`:'';
  content.insertAdjacentHTML('afterbegin',controls);
  if(hybrid()&&energyMode()==='both'&&stationView==='list'){
   const stations=shownStations();content.querySelectorAll('.list-station-card').forEach((card,i)=>{
    const s=stations[i],action=card.querySelector('.list-actions .primary');if(!s||!action)return;
    action.disabled=false;action.textContent='Elegir servicio';action.setAttribute('onclick',`ggUX.selectStation(${s.id})`);
   });
  }
  if(!shownStations().length)content.insertAdjacentHTML('beforeend','<p class="gg-empty" role="status">No hay estaciones compatibles con tu vehículo y los filtros actuales. Prueba otra zona o restablece los filtros.</p>');
  if(hybrid()&&energyMode()==='both')content.insertAdjacentHTML('beforeend','<p class="small muted">Ordenadas por distancia. Selecciona Repostar o Recargar para comparar precios del mismo servicio.</p>');
  if(!locationChecked&&!inPresentationDemo()&&navigator.permissions){locationChecked=true;navigator.permissions.query({name:'geolocation'}).then(p=>{if(p.state==='granted')locateUser()}).catch(()=>{})}
  const gps=content.querySelector('.gps-locate');if(gps){gps.disabled=locationPending;gps.textContent=locationPending?'Buscando ubicación…':'⌖ Mi ubicación';gps.setAttribute('aria-busy',String(locationPending))}
  if(!inPresentationDemo()){vehicleCard(content);if(energyMode()==='both'&&$('listSort')){$('listSort').value='dist';$('listSort').disabled=true}}
  simplify(content);showCompletion(content);
 }
};
const originalModal=window.modal;
window.modal=function(html){originalModal('<button type="button" class="gg-back" onclick="closeModal()">← Volver</button>'+html)};
const originalRegistration=window.completeRegistration;
window.completeRegistration=function(){
 regCache();
 if(regDraft.fuel===HYBRID&&!connectors.includes(regDraft.connector)){toast('Selecciona el conector de tu híbrido enchufable');regStep=2;render();return}
 originalRegistration();syncEnergy();
};
window.ggUX={chooseVehicle,pickVehicle,back,energyFields,toggleEnergyFields,setEnergy,energyMode,selectStation,openStation,drawStations};
document.addEventListener('click',event=>{
 if(page!=='Home'||!menu||!event.target.closest?.('.mapframe'))return;
 // Capturar el toque antes de Leaflet: cerrar el menú sin seleccionar una estación.
 event.preventDefault();event.stopImmediatePropagation();toggleHome();
},true);
setupMoreMenu();
render();
})();
