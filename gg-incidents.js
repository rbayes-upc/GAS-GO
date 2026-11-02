/* GAS&GO v2.4.4 - Registro LOCAL de incidencias con fotografía (no se envía a operadores). */
'use strict';
(function(){
 const DB_NAME='gasgo-incidencias-v1',STORE='avisos';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let imageBlob=null,previewUrl=null,view='nuevo',dbPromise=null,writing=false,lastStation='',pinnedStation=null,formStations=[];
 const categories=['Surtidor fuera de servicio','Cargador eléctrico averiado','Suelo en mal estado','Derrame o fuga','Iluminación o señalización','Limpieza o mantenimiento','Otra incidencia'];
 function db(){if(!('indexedDB'in window))return Promise.reject(Error('Este navegador no admite el almacenamiento de avisos'));
   if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('No se pudo abrir el almacenamiento'))}).catch(e=>{dbPromise=null;throw e});return dbPromise}
 async function list(){const database=await db();return new Promise((resolve,reject)=>{const r=database.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>resolve((r.result||[]).sort((a,b)=>b.createdAt-a.createdAt));r.onerror=()=>reject(r.error)})}
 async function put(item){const database=await db();return new Promise((resolve,reject)=>{const t=database.transaction(STORE,'readwrite');t.objectStore(STORE).put(item);t.oncomplete=resolve;t.onerror=()=>reject(t.error||Error('No se pudo guardar'))})}
 async function erase(id){const database=await db();return new Promise((resolve,reject)=>{const t=database.transaction(STORE,'readwrite');t.objectStore(STORE).delete(id);t.oncomplete=resolve;t.onerror=()=>reject(t.error||Error('No se pudo eliminar'))})}
 function clearPreview(){imageBlob=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;const wrap=$('ggIncPreview');if(wrap)wrap.classList.remove('show');const img=$('ggIncImage');if(img)img.removeAttribute('src');}
 function close(){revokeCardPhotos();clearPreview();const root=$('ggIncidentOverlay');if(root)root.remove();document.body.classList.remove('gg-inc-locked');document.removeEventListener('keydown',onEscape)}
 function onEscape(ev){if(ev.key==='Escape')close()}
 function renderFrame(inner){const root=$('ggIncidentOverlay');if(!root)return;revokeCardPhotos();root.innerHTML=`<section class="gg-inc-panel" role="dialog" aria-modal="true" aria-labelledby="ggIncTitle"><div class="gg-inc-heading"><strong id="ggIncTitle">⚠ Comunicar incidencia</strong><button class="gg-inc-close" type="button" id="ggIncClose" aria-label="Cerrar">×</button></div><p class="gg-inc-muted">Ayuda a identificar averías y desperfectos en las estaciones.</p><nav class="gg-inc-tabs" aria-label="Secciones de incidencias"><button class="gg-inc-tab ${view==='nuevo'?'active':''}" type="button" data-ggtab="nuevo">Nuevo aviso</button><button class="gg-inc-tab ${view==='lista'?'active':''}" type="button" data-ggtab="lista">Mis avisos</button></nav><div id="ggIncContent">${inner}</div></section>`;
 root.querySelector('#ggIncClose').addEventListener('click',close);
 root.querySelectorAll('[data-ggtab]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.ggtab;clearPreview();if(view==='nuevo')form();else showList()}));
 root.querySelector('.gg-inc-panel').scrollTop=0;
 }
 // Solo aparecen las cinco estaciones diferentes en las que el usuario tiene operaciones terminadas.
 // El mapa es la alternativa cuando no fue posible completar el repostaje.
 function recentStations(){
   const history=(typeof data!=='undefined'&&Array.isArray(data.history))?data.history:[];
   const live=(typeof STATIONS!=='undefined'&&Array.isArray(STATIONS))?STATIONS:[];
   const seen=new Set(),items=[];
   for(let i=history.length-1;i>=0&&items.length<5;i--){
     const h=history[i];if(!h||!h.station||!Number.isFinite(Number(h.amount))||Number(h.amount)<=0)continue;
     const name=String(h.station).trim();if(!name)continue;
     const id=h.stationId??null,lat=Number(h.stationLat),lng=Number(h.stationLng);
     const haveCoords=Number.isFinite(lat)&&Number.isFinite(lng)&&h.stationLat!=null&&h.stationLng!=null;
     // No atribuir una estación equivocada si el rótulo es compartido por varias ubicaciones.
     const matches=live.filter(x=>x.name===name);
     const match=id!=null?live.find(x=>String(x.id)===String(id)):(matches.length===1?matches[0]:null);
     const locLat=haveCoords?lat:(match?.lat??null),locLng=haveCoords?lng:(match?.lng??null);
     const key=haveCoords?`${name.toLocaleLowerCase('es')}|${lat.toFixed(5)},${lng.toFixed(5)}`:
       (id!=null?'id:'+id:'name:'+name.toLocaleLowerCase('es'));
     if(seen.has(key))continue;seen.add(key);
     items.push({id:id??match?.id??null,name,area:h.stationArea||match?.area||'',lat:locLat,lng:locLng,date:String(h.date||''),key});
   }
   return items;
 }
 function chooseMapStation(){close();try{stationView='map';go('Home');toast('Selecciona una estación en el mapa y pulsa «Comunicar incidencia».')}catch(e){console.warn('[GAS&GO] No se pudo abrir el mapa:',e)}}
 function form(){
   view='nuevo';formStations=recentStations();
   const pinned=pinnedStation;
   const recentOptions=formStations.map((s,i)=>`<option value="${i}" ${lastStation===s.key?'selected':''}>${esc(s.name)}${s.area?' · '+esc(s.area):''}</option>`).join('');
   const dropdown=pinned?
     `<div class="gg-inc-pinned"><span class="gg-inc-pinned-label">Estación seleccionada desde el mapa</span><strong>${esc(pinned.name)}</strong>${pinned.area?`<small>${esc(pinned.area)}</small>`:''}</div>`:
     `<label class="gg-inc-label" for="ggIncStation">Últimas estaciones visitadas *</label>${formStations.length?
       `<select class="gg-inc-input" id="ggIncStation" required><option value="" disabled ${!formStations.some(s=>s.key===lastStation)?'selected':''}>Elige una de tus últimas estaciones</option>${recentOptions}</select><p class="gg-inc-hint">Se muestran como máximo 5 estaciones distintas con operaciones registradas en tu historial.</p>`:
       `<div class="gg-inc-empty-recent">Todavía no tienes estaciones visitadas en tu historial. Si no has podido repostar, selecciona la estación directamente desde el mapa.</div>`}
      <button class="gg-inc-secondary gg-inc-map-link" id="ggIncGoMap" type="button">⌖ ${formStations.length?'No pude repostar · Seleccionar desde el mapa':'Seleccionar estación en el mapa'}</button>`;
   renderFrame(`<form id="ggIncForm">${dropdown}<label class="gg-inc-label" for="ggIncCategory">Tipo de incidencia *</label><select class="gg-inc-input" id="ggIncCategory" required>${categories.map(c=>`<option>${esc(c)}</option>`).join('')}</select><label class="gg-inc-label">Fotografía de la incidencia *</label><div class="gg-inc-photo-actions"><label class="gg-inc-photo-choice">📷 Hacer foto<input id="ggIncCamera" type="file" accept="image/*" capture="environment" aria-label="Hacer una foto con la cámara"></label><label class="gg-inc-photo-choice">▣ Elegir foto<input id="ggIncGallery" type="file" accept="image/*" aria-label="Seleccionar foto de la galería"></label></div><div class="gg-inc-photo-preview" id="ggIncPreview"><img id="ggIncImage" alt="Vista previa de la incidencia"><div><p id="ggIncPhotoSize">Fotografía preparada</p><button type="button" id="ggIncRemove" class="gg-inc-remove">Eliminar foto</button></div></div><label class="gg-inc-label" for="ggIncDescription">Describe brevemente qué sucede *</label><textarea class="gg-inc-textarea" id="ggIncDescription" rows="3" minlength="8" maxlength="350" required placeholder="Ej.: El surtidor 3 no permite iniciar el suministro."></textarea><span id="ggIncLength" class="gg-inc-count">0 / 350 caracteres</span><p class="gg-inc-alert">Prototipo: el aviso y su fotografía se guardan <b>solo en este dispositivo</b>. No se envían a la gasolinera. Ante fugas o riesgos inmediatos, avisa directamente al personal.</p><div id="ggIncError" class="gg-inc-error" role="alert" hidden></div><button type="submit" id="ggIncSave" class="gg-inc-submit" ${!pinned&&!formStations.length?'disabled':''}>Registrar incidencia</button></form>`);
   $('ggIncGoMap')?.addEventListener('click',chooseMapStation);
   $('ggIncStation')?.addEventListener('change',ev=>{lastStation=formStations[Number(ev.target.value)]?.key||''});
   $('ggIncCamera').addEventListener('change',fileChanged);$('ggIncGallery').addEventListener('change',fileChanged);
   $('ggIncRemove').addEventListener('click',clearPreview);
   $('ggIncDescription').addEventListener('input',e=>{$('ggIncLength').textContent=`${e.target.value.length} / 350 caracteres`});
   $('ggIncForm').addEventListener('submit',saveForm);
 }
 function error(message){const el=$('ggIncError');if(el){el.hidden=false;el.textContent=message}}
 async function downsize(file){if(!file.type.startsWith('image/'))throw Error('Selecciona una imagen válida.');if(file.size>25*1024*1024)throw Error('La foto supera el límite de 25 MB.');const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error('No se ha podido leer la fotografía'));img.src=url});const max=1440,ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(Error('Error al optimizar la imagen')),'image/jpeg',.78))}finally{URL.revokeObjectURL(url)}}
 async function fileChanged(event){const input=event.target,file=input.files?.[0];if(!file)return;const msg=$('ggIncError');if(msg)msg.hidden=true;try{const blob=await downsize(file);clearPreview();imageBlob=blob;previewUrl=URL.createObjectURL(blob);$('ggIncImage').src=previewUrl;$('ggIncPhotoSize').textContent=`Foto adjunta · ${Math.ceil(blob.size/1024)} KB`;$('ggIncPreview').classList.add('show')}catch(e){error(e.message)}finally{input.value=''}}
 async function saveForm(ev){ev.preventDefault();if(writing)return;
   const form=$('ggIncForm'),category=$('ggIncCategory'),description=$('ggIncDescription');if(!form.reportValidity())return;
   if(!imageBlob){error('Necesitamos una foto para registrar la incidencia.');return}
   const chosen=pinnedStation||formStations[Number($('ggIncStation')?.value)];
   if(!chosen?.name){error('Selecciona una de las cinco últimas estaciones o elige una desde el mapa.');return}
   const record={id:'GG-INC-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),createdAt:Date.now(),category:category.value,description:description.value.trim(),station:chosen.name,stationId:chosen.id??null,lat:chosen.lat??null,lng:chosen.lng??null,photo:imageBlob,status:'local'};
   if(record.description.length<8){error('Describe el problema con al menos 8 caracteres.');return}
   writing=true;const b=$('ggIncSave');if(b){b.disabled=true;b.textContent='Guardando…'};
   try{await put(record);clearPreview();pinnedStation=null;lastStation='';view='lista';showList('Aviso guardado en este dispositivo. Aún no se ha enviado a la estación.')}
   catch(e){error('No se pudo guardar. Revisa el espacio disponible del navegador.');if(b){b.disabled=false;b.textContent='Registrar incidencia'}}finally{writing=false}
 }
 function revokeCardPhotos(){document.querySelectorAll('#ggIncidentOverlay img[data-ggblob]').forEach(img=>{if(img.src.startsWith('blob:'))URL.revokeObjectURL(img.src)})}
 async function showList(success){view='lista';clearPreview();renderFrame(`<div id="ggIncList"><p class="gg-inc-muted">Cargando avisos guardados…</p></div>`);const root=$('ggIncList');try{const records=await list();if(!root?.isConnected)return;root.innerHTML=(success?`<div class="gg-inc-success">${esc(success)}</div>`:'')+(records.length?`<p class="gg-inc-muted">${records.length} incidencia${records.length!==1?'s':''} en este navegador. No se han enviado a las estaciones.</p>`+records.map(r=>`<article class="gg-inc-entry"><div class="gg-inc-entry-header"><div><h3>${esc(r.category)}</h3><small>${esc(r.station)} · ${new Date(r.createdAt).toLocaleString('es-ES')}</small></div><span class="gg-inc-local">Local</span></div><p>${esc(r.description)}</p><img class="gg-inc-entry-photo" data-ggblob="${esc(r.id)}" alt="Fotografía adjunta al aviso"><button type="button" class="gg-inc-delete" data-ggdelete="${esc(r.id)}">Eliminar aviso</button></article>`).join(''):'<p class="gg-inc-muted">Todavía no has registrado ninguna incidencia.</p>');
  for(const r of records){const img=[...root.querySelectorAll('img[data-ggblob]')].find(el=>el.dataset.ggblob===r.id);if(img&&r.photo)img.src=URL.createObjectURL(r.photo)}
  root.querySelectorAll('[data-ggdelete]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('¿Eliminar esta incidencia guardada en tu dispositivo?'))return;try{await erase(b.dataset.ggdelete);revokeCardPhotos();showList()}catch(e){alert('No se ha podido eliminar la incidencia')}}))
 }catch(e){if(root?.isConnected)root.innerHTML='<div class="gg-inc-error">No se han podido consultar los avisos del navegador.</div>'}}
 function openWithStation(id){
   const station=(typeof STATIONS!=='undefined'?STATIONS.find(x=>String(x.id)===String(id)):null);
   if(!station){try{toast('Esta estación ya no está disponible en el mapa. Selecciona otra.')}catch(e){}return}
   pinnedStation={id:station.id,name:station.name,area:station.area||'',lat:station.lat??null,lng:station.lng??null};
   lastStation='';open(true);
 }
 function open(fromMap=false){if($('ggv2Overlay'))return;const home=$('menu');if(home&&!home.classList.contains('hide')){try{toggleHome()}catch(e){home.classList.add('hide')}}
   if(!fromMap){pinnedStation=null;lastStation=''}
   if($('ggIncidentOverlay')){view='nuevo';clearPreview();form();return}
   const root=document.createElement('div');root.id='ggIncidentOverlay';root.addEventListener('click',e=>{if(e.target===root)close()});document.body.appendChild(root);document.body.classList.add('gg-inc-locked');document.addEventListener('keydown',onEscape);view='nuevo';form();root.querySelector('.gg-inc-close')?.focus({preventScroll:true})
 }
 const header=document.querySelector('.top-actions');if(header){const button=document.createElement('button');button.id='ggIncidentButton';button.className='iconbutton';button.type='button';button.setAttribute('aria-label','Comunicar una incidencia');button.title='Comunicar incidencia';button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M10.3 3.9 2 18.2c-.5.9.1 2 1.2 2h17.6c1.1 0 1.7-1.1 1.2-2L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';button.addEventListener('click',()=>open(false));header.appendChild(button)}
 window.ggIncidents={open,openWithStation,close,recentStations};
})();
