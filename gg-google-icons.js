/* Google Material Symbols: presentación reversible exclusiva de FULL. */
(function(){
'use strict';
const data=window.GGGoogleIconData;if(!data)return;
const choices={
 '⛽':['local_gas_station','Estación de servicio'],'⚡':['ev_station','Recarga eléctrica'],'🔋':['battery_charging_full','Vehículo eléctrico'],
 '🚙':['directions_car','Vehículo'],'🚘':['directions_car','Vehículo'],'🚗':['directions_car','Vehículo'],'🛵':['two_wheeler','Moto'],
 '💳':['credit_card','Método de pago'],'▤':['credit_card','Tarjetas'],'🅿':['account_balance_wallet','Pago digital'],
 '📄':['receipt_long','Factura'],'◴':['history','Historial'],'◷':['history','Tiempo estimado'],
 '★':['star_filled','Quitar de favoritos'],'⭐':['star_filled','Favorito'],'☆':['star','Añadir a favoritos'],'♡':['favorite','Favoritos'],
 '⚙':['settings','Configuración'],'⌂':['home','Inicio'],'⌃':['expand_less','Contraer'],'⌄':['expand_more','Desplegar'],
 '🔗':['link','Vincular surtidor'],'⌕':['search','Buscar'],'⚠':['warning','Incidencia'],'⌖':['my_location','Mi ubicación'],
 '☷':['tune','Filtros'],'◉':['radio_button_checked','Seleccionar'],'◎':['directions_car','Mi vehículo'],
 '🔒':['lock','Seguridad'],'🔐':['lock','Seguridad'],'♢':['shield','Privacidad'],'✎':['edit','Editar'],
 '▣':['photo_camera','Fotografía'],'📷':['photo_camera','Cámara'],'☕':['local_cafe','Servicios'],'🌐':['public','Internet'],
 '✓':['check','Confirmado'],'✅':['check_circle','Confirmado'],'📡':['sensors','Detección'],'📲':['qr_code_scanner','Escanear QR'],
 '■':['stop_circle','Detener'],'⏸':['pause_circle','Pausar'],'📅':['calendar_month','Fecha'],'◌':['progress_activity','Cargando'],
 '●':['circle','Estado'],'◇':['radio_button_checked','Modo'],'↗':['location_on','Cómo llegar'],'↻':['refresh','Actualizar'],
 '↺':['refresh','Restablecer'],'↩':['arrow_back','Volver'],'←':['arrow_back','Volver'],'↓':['download','Descargar'],'↑':['upload','Subir'],
 '⋯':['more_horiz','Más opciones'],'＋':['add','Añadir']
};
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const matcher=new RegExp('('+Object.keys(choices).sort((a,b)=>b.length-a.length).map(escape).join('|')+')[\uFE0F\uFE0E]?','gu');
const eligibleRoots='.device,#overlay,#ggv2Overlay,#ggIncidentOverlay,.toast,.repost-toast';
const skip='script,style,svg,input,textarea,select,option,pre,code,.status,.gg-invoice-preview,.ggw-secret,[contenteditable],[data-gg-no-icons]';
let refreshing=false;
const observer=new MutationObserver(()=>refresh());
function isFull(){return typeof inPresentationDemo==='function'&&!inPresentationDemo()}
function icon(symbol,original){
 const [name,label]=choices[symbol];const source=data[name];
 if(!source)return document.createTextNode(original);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox',source.viewBox);svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 svg.setAttribute('class','gg-google-icon');svg.dataset.ggIcon=name;svg.dataset.ggOriginal=original;svg.dataset.ggLabel=label;
 svg.innerHTML=source.body;return svg;
}
function restore(){
 for(const svg of document.querySelectorAll('.gg-google-icon[data-gg-original]'))svg.replaceWith(document.createTextNode(svg.dataset.ggOriginal));
 for(const button of document.querySelectorAll('[data-gg-icon-auto-label]')){button.removeAttribute('aria-label');button.removeAttribute('data-gg-icon-auto-label')}
}
function replaceText(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes=[];
 while(walker.nextNode()){
  const node=walker.currentNode,parent=node.parentElement;
  if(!parent||!parent.closest(eligibleRoots)||parent.closest(skip))continue;
  matcher.lastIndex=0;if(matcher.test(node.nodeValue))nodes.push(node);
 }
 for(const node of nodes){
  const text=node.nodeValue;matcher.lastIndex=0;const matches=Array.from(text.matchAll(matcher));if(!matches.length)continue;
  const button=node.parentElement?.closest('button,[role="button"]');
  if(button&&!button.hasAttribute('aria-label')&&!button.hasAttribute('aria-labelledby')){
   matcher.lastIndex=0;
   if(!button.textContent.replace(matcher,'').trim()){
    const stationLabel=button.querySelector('.geo-pin[aria-label]')?.getAttribute('aria-label');
    button.setAttribute('aria-label',stationLabel||choices[matches[0][1]][1]);button.setAttribute('data-gg-icon-auto-label','true');
   }
  }
  const fragment=document.createDocumentFragment();let cursor=0;
  for(const match of matches){if(match.index>cursor)fragment.append(document.createTextNode(text.slice(cursor,match.index)));fragment.append(icon(match[1],match[0]));cursor=match.index+match[0].length}
  if(cursor<text.length)fragment.append(document.createTextNode(text.slice(cursor)));node.replaceWith(fragment);
 }
}
function refresh(){
 if(refreshing)return;refreshing=true;observer.disconnect();
 try{
  const full=isFull();document.body.classList.toggle('gg-full-icons',full);
  if(full)replaceText();else restore();
 }finally{refreshing=false;observer.observe(document.body,{subtree:true,childList:true,characterData:true})}
}
const originalRender=window.render;
window.render=function(){if(!isFull())restore();originalRender();refresh()};
refresh();
})();
