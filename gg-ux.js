/* Borrador UX: navegación, ubicación y compatibilidad por vehículo. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const HYBRID='Híbrido enchufable';
const connectors=['Tipo 2','CCS2','CHAdeMO','Tipo 1','Schuko'];
const esc=escapeHtml;
let history=[],goingBack=false,locationChecked=false,lastVehicleIdentity=null;
let locationPending=false,lastCompletedReceipt=null,completionTimer=null,completionExpiresAt=0;
const hybrid=()=>data.customVehicle?.fuel===HYBRID&&data.vehicle===data.customVehicle.name;
const preferenceKey=()=>data.customVehicle?.plate||data.vehicle;
function energyMode(){return hybrid()?(data.energyPreferences?.[preferenceKey()]||'fuel'):data.fuel==='Eléctrico'?'charge':'fuel'}
function combustion(){return hybrid()?data.customVehicle.combustionFuel||'Gasolina 95':data.fuel}
function syncEnergy(){
 const identity=[data.vehicle,data.customVehicle?.plate,hybrid()?HYBRID:data.fuel].join('|');
 if(identity!==lastVehicleIdentity){filterFuel='Todos';maxPrice=0;selectedStation=null;lastVehicleIdentity=identity}
 if(!hybrid())return;
 const fuel=energyMode()==='charge'?'Eléctrico':combustion();
 if(data.fuel!==fuel){data.fuel=fuel;save()}
}
function compatibleCharge(s){
 if(!(s.ev>0))return false;
 const connector=data.customVehicle?.name===data.vehicle?data.customVehicle.connector:null;
 if(!connector)return true; // Vehículos anteriores sin conector: no se afirma su compatibilidad.
 return String(s.evConnector||'').split(',').map(x=>x.trim()).includes(connector);
}
const compatibleFuel=s=>Number(combustion()==='Diésel'?s.diesel:s.gas)>0;
function setEnergy(mode){
 if(!hybrid()||!['fuel','charge','both'].includes(mode))return;
 data.energyPreferences=data.energyPreferences||{};data.energyPreferences[preferenceKey()]=mode;
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
   const ev=energyMode()==='charge'||!compatibleFuel(s);
   const icon=L.divIcon({className:'',html:cluster?`<button class="gg-map-cluster" aria-label="Ver ${group.length} estaciones">${group.length}</button>`:`<div class="geo-pin ${ev?'ev':''}" aria-label="${esc(s.name)}">${ev?'⚡':'⛽'}</div>`,iconSize:[34,34],iconAnchor:[17,17]});
   L.marker(position,{icon}).addTo(layer).on('click',()=>{
    if(!cluster){selectStation(s.id);return}
    if(map.getZoom()<18){map.setView(position,map.getZoom()+2);return}
    modal(`<h2>Estaciones en esta ubicación</h2>${group.map(x=>`<button class="btn block" onclick="closeModal();ggUX.selectStation(${x.id})">${esc(x.name)}</button>`).join('')}`);
   });
  }
 };
 draw();map.on('zoomend moveend',draw);
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
  foldDetails(mapHome,'.gg-source','Información de los datos');
  // El censo tiene una sola etiqueta; conservar sus avisos de error visibles.
  for(const strip of mapHome.querySelectorAll('.gg-ev-strip')){
   if(strip.textContent.includes('⚠'))continue;
   const details=mapHome.querySelector('.gg-secondary-details');if(details&&!strip.closest('details'))details.append(strip);
  }
  const title=mapHome.querySelector('.map-home-title span');if(title)title.textContent='Prototipo · operaciones simuladas';
 }
 for(const card of content.querySelectorAll('.gg-station-popup,.list-station-card,.gg-demo-compact-popup,.gg258-list-card')){
  foldDetails(card,'.gg-station-source,.gg245-metrics,.ggdc-times','Más detalles de la estación');
  const secondary=card.querySelector('.gg-secondary-details');if(!secondary)continue;
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
  if(!inPresentationDemo()&&!userPosition)content.insertAdjacentHTML('beforeend','<p class="small muted" id="ggLocationHint">Pulsa «Mi ubicación» para mostrar tu posición real como un punto azul.</p>');
  if(!locationChecked&&!inPresentationDemo()&&navigator.permissions){locationChecked=true;navigator.permissions.query({name:'geolocation'}).then(p=>{if(p.state==='granted')locateUser()}).catch(()=>{})}
  const gps=content.querySelector('.gps-locate');if(gps){gps.disabled=locationPending;gps.textContent=locationPending?'Buscando ubicación…':'⌖ Mi ubicación';gps.setAttribute('aria-busy',String(locationPending))}
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
window.ggUX={back,energyFields,toggleEnergyFields,setEnergy,energyMode,selectStation,openStation,drawStations};
setupMoreMenu();
render();
})();
