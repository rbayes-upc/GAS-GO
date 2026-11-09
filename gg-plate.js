/* GAS&GO v2.7.1 - OCR asistido por recortes en resolución original, sin API de pago.
 * Solo FULL; la foto no sale del dispositivo ni se conserva tras el análisis.
 * El OCR propone texto; logos, color y motor pueden requerir introducción manual. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const validPlate=s=>/^[0-9]{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(norm(s))||/^[A-Z]{1,2}[0-9]{4}[A-Z]{1,2}$/.test(norm(s));
const full=()=>typeof inPresentationDemo==='function'&&!inPresentationDemo();
const fuels=['Gasolina 95','Diésel','Eléctrico','Híbrido enchufable'];
const types=['Coche','Moto','Furgoneta'];
const emojiFor=(type,fuel)=>fuel==='Eléctrico'?'🔋':type==='Moto'?'🛵':'🚙';
const modelLabel=v=>[v.brand||'',v.model||''].filter(Boolean).join(' ')||'Sin modelo';
const stored=()=>Array.isArray(data.plateVehicles)?data.plateVehicles:[];
function sync(){if(!Array.isArray(data.plateVehicles))data.plateVehicles=[];return data.plateVehicles}
function ensureExampleVehicles(){
 if(!full()||Number(data.garageExamplesVersion)>=1)return;
 const examples=[
  {name:'Coche gasolina (ejemplo)',brand:'SEAT',model:'Ibiza',plate:'1101BCD',fuel:'Gasolina 95'},
  {name:'Coche diésel (ejemplo)',brand:'Peugeot',model:'308 BlueHDi',plate:'2202FGH',fuel:'Diésel'},
  {name:'Coche eléctrico (ejemplo)',brand:'Tesla',model:'Model 3',plate:'3303JKL',fuel:'Eléctrico',connector:'CCS2'},
  {name:'Híbrido enchufable (ejemplo)',brand:'SEAT',model:'León e-HYBRID',plate:'4404MNP',fuel:'Híbrido enchufable',combustionFuel:'Gasolina 95',connector:'Tipo 2'}
 ];
 const rows=sync(),plates=new Set(rows.map(v=>norm(v.plate)));
 if(data.customVehicle?.plate)plates.add(norm(data.customVehicle.plate));
 for(const v of examples){
  if(plates.has(v.plate))continue;
  rows.push({...v,kind:'Coche',emoji:emojiFor('Coche',v.fuel),origin:'garage_example_v1'});plates.add(v.plate);
 }
 data.garageExamplesVersion=1;save();
}
let draft=null,photoData=null,photoObjectUrl=null,mode='garage',activeAnalysis=0,pendingRegistrationVehicle=null,ocrScriptPromise=null;
let editingPlate=null,editingActive=false;
let cropActive='plate',cropDragging=false,cropStartPoint=null;
const cropDefaults={plate:{x:.24,y:.52,w:.54,h:.32},badges:{x:.08,y:.14,w:.84,h:.49}};
let cropRects={plate:{...cropDefaults.plate},badges:{...cropDefaults.badges}};
const yearBands={B:'2000–2002',C:'2002–2004',D:'2004–2006',F:'2006–2008',G:'2008–2010',H:'2010–2014',J:'2014–2017',K:'2017–2019',L:'2019–2022',M:'2022–2025',N:'2025–2026'};
function approximateRegistration(plate){const m=norm(plate).match(/^\d{4}([A-Z]{3})$/);return m?yearBands[m[1][0]]||'':''}
function chronologyAlert(yearText,registration){
 const spans=String(yearText||'').match(/(?:19|20)\d{2}/g)||[];
 const end=Number(spans[spans.length-1]),begin=Number(String(registration||'').match(/^\d{4}/)?.[0]||0);
 if(end>0&&begin>0&&end<begin-1)return 'La generación reconocida parece anterior a la matriculación estimada. Puede tratarse de una importación, una rematriculación o una lectura incorrecta: comprueba ambos datos.';
 return '';
}
function newDraft(){return {name:'',brand:'',model:'',version:'',color:'',kind:'Coche',plate:'',registration:'',fuel:'',suggestedFuel:'',year:'',badges:'',origin:'manual',confidence:'',notes:'',photo:false}}
function cleanPhoto(){if(photoObjectUrl){URL.revokeObjectURL(photoObjectUrl);photoObjectUrl=null}photoData=null}
function screen(){if(!full())return '';
 ensureExampleVehicles();
 const current=data.customVehicle,items=stored();
 const active=current?`<div class="card gg-vehicle-current"><div class="gg-vehicle-current-heading"><span class="pill green">✓ Vehículo seleccionado</span><span class="gg-vehicle-emoji">${esc(current.emoji||'🚙')}</span></div><h2>${esc(current.name||'Mi vehículo')}</h2><p class="muted small">${esc(current.model||'')} · ${esc(current.plate||'')}</p><b>${esc(current.fuel||'Sin combustible')}</b><button type="button" class="btn ghost block gg-edit-current" onclick="GGPlate.editCurrent()">Editar vehículo</button><button type="button" class="btn ghost block gg-pref-button" onclick="GGPreferences.open('current')">Preferencias</button></div>`:'';
 const choices=`<div class="gg-vehicle-choices"><button class="gg-vehicle-choice" onclick="GGPlate.openManual()"><span class="gg-choice-icon">✎</span><strong>Manualmente</strong><small>Rellena los datos de tu vehículo</small></button><button class="gg-vehicle-choice gg-photo-choice" onclick="GGPlate.openPhoto()"><span class="gg-choice-icon">▣</span><strong>Con una foto</strong><small>Selecciona matrícula y emblemas</small></button></div>`;
 const rows=items.length?`<div class="sectionlabel">Mis vehículos guardados</div>`+items.map((v,i)=>`<div class="card gg-plate-saved"><div class="row between"><div class="gg-plate-item-info"><b>${esc(v.emoji||'🚙')} ${esc(v.name)}</b><div class="small muted">${esc(modelLabel(v))}${v.version?' · '+esc(v.version):''}</div><div class="small muted">${esc(v.plate)} · ${esc(v.fuel)}${v.color?' · '+esc(v.color):''}</div></div><button class="btn ${current?.plate===v.plate?'primary':'ghost'}" onclick="GGPlate.select(${i})">${current?.plate===v.plate?'Activo':'Elegir'}</button></div><button type="button" class="btn ghost block gg-pref-button" onclick="GGPreferences.open(${i})">Preferencias</button><div class="gg-plate-remove"><button class="gg-edit-vehicle" onclick="GGPlate.edit(${i})" type="button">Editar</button><button onclick="GGPlate.remove(${i})" type="button">Eliminar vehículo</button></div></div>`).join(''):'';
 return `<h1 class="title">Mi garaje</h1><p class="sub">Versión completa · tu garaje GAS&GO</p>${rows}${active}<div class="card gg-plate-intro"><h2 style="font-size:19px;margin:0 0 7px">+ Añadir un vehículo</h2><p class="small muted">Escoge cómo quieres registrar tu coche o moto:</p>${choices}<p class="small muted" style="margin:14px 2px 0">Para mejorar la lectura, selecciona por separado la matrícula y los emblemas en la foto. Después corrige y confirma los datos.</p></div><p class="small muted gg-plate-disclaimer">En este prototipo las fichas confirmadas se guardan en el navegador. No existe aún una base de datos compartida ni un registro oficial de matrículas. La foto no se conserva.</p>`;
}
function openManual(context='garage'){
 if(!full())return;
 if(editingPlate)draft=null;editingPlate=null;editingActive=false;
 activeAnalysis++;
 if(!draft||mode!==context)draft=newDraft();
 mode=context;
 cleanPhoto();
 showForm();
}
function openPhoto(context='garage'){
 if(!full())return;editingPlate=null;editingActive=false;
 activeAnalysis++;
 mode=context;draft=newDraft();cleanPhoto();cropRects={plate:{...cropDefaults.plate},badges:{...cropDefaults.badges}};cropActive='plate';cropDragging=false;
 modal(`<div class="gg-plate-modal"><div class="gg-plate-step">Fotografía trasera · reconocimiento guiado</div><h2>Marca dos zonas de la foto</h2><p class="small muted">Primero encuadra la matrícula y después los distintivos de la marca, modelo o motor. Así no intentamos reconocer letras diminutas en toda la fotografía.</p><label class="gg-photo-drop" for="ggVehiclePhoto"><span>📷</span><b>Hacer foto o seleccionar archivo</b><small>JPG, PNG o WEBP · hasta 12 MB</small><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" id="ggVehiclePhoto" onchange="GGPlate.fileChange(this)"></label><div id="ggPhotoPreview" class="gg-photo-preview hide"><div id="ggCropTools" class="gg-crop-tools"><div class="gg-crop-tabs"><button type="button" id="ggCropPlateTab" class="gg-crop-tab current" onclick="GGPlate.cropMode('plate')">1 · Matrícula</button><button type="button" id="ggCropBadgesTab" class="gg-crop-tab" onclick="GGPlate.cropMode('badges')">2 · Emblemas</button></div><div class="gg-crop-view"><div id="ggCropStage" class="gg-crop-stage" onpointerdown="GGPlate.cropStart(event)" onpointermove="GGPlate.cropMove(event)" onpointerup="GGPlate.cropEnd(event)" onpointercancel="GGPlate.cropEnd(event)"><img id="ggPhotoImage" alt="Fotografía trasera que puedes recortar para reconocimiento"><div id="ggCropSelection" class="gg-crop-selection"><span id="ggCropSelectionTag">MATRÍCULA</span></div></div></div><p id="ggCropHelp" class="gg-plate-hint">Arrastra sobre la matrícula para marcar solamente sus números y letras.</p><div class="gg-crop-actions"><button class="btn ghost" type="button" onclick="GGPlate.cropReset()">Restablecer selección</button><button class="btn ghost" type="button" onclick="GGPlate.nextCrop()">Cambiar zona</button></div><p id="ggPhotoFileInfo" class="small muted"></p></div></div><div class="gg-plate-info"><strong>Sin pagos · procesamiento local</strong><p class="small muted">El OCR se ejecuta en el navegador y no envía la foto al servidor. Se necesita conexión para descargar el motor la primera vez. Las inscripciones permiten sugerir el combustible, pero el sistema no reconoce los logotipos ni el color.</p></div><div role="status" id="ggPhotoStatus" class="gg-plate-hint" aria-live="polite"></div><button class="btn primary block" id="ggAnalyzeBtn" type="button" onclick="GGPlate.analyze()" disabled>Analizar las dos zonas →</button><button class="btn ghost block" style="margin-top:8px" type="button" onclick="GGPlate.openManual('${context}')">Rellenar manualmente</button><button class="btn ghost block" style="margin-top:8px" type="button" onclick="GGPlate.cancel()">Cancelar</button></div>`);
}
function cropMode(which){if(!['plate','badges'].includes(which))return;cropActive=which;cropDragging=false;paintCrop()}
function cropReset(){cropRects[cropActive]={...cropDefaults[cropActive]};paintCrop()}
function nextCrop(){cropMode(cropActive==='plate'?'badges':'plate')}
function paintCrop(){
 const box=$('ggCropSelection'),help=$('ggCropHelp');if(!box)return;
 const r=cropRects[cropActive];Object.assign(box.style,{left:(r.x*100)+'%',top:(r.y*100)+'%',width:(r.w*100)+'%',height:(r.h*100)+'%'});
 $('ggCropSelectionTag').textContent=cropActive==='plate'?'MATRÍCULA':'EMBLEMAS';
 $('ggCropPlateTab')?.classList.toggle('current',cropActive==='plate');
 $('ggCropBadgesTab')?.classList.toggle('current',cropActive==='badges');
 if(help)help.textContent=cropActive==='plate'?'Arrastra sobre la matrícula para abarcar sus números y letras. Evita incluir el parachoques.':'Arrastra sobre las inscripciones (modelo, cilindrada, TDI, TFSI, etc.). Si no hay emblemas, puedes analizar igualmente.';
}
function cropCoordinates(ev){const el=$('ggCropStage'),rect=el?.getBoundingClientRect();if(!rect||!rect.width||!rect.height)return null;
 return {x:Math.max(0,Math.min(1,(ev.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(ev.clientY-rect.top)/rect.height))};
}
function cropStart(ev){if(!photoData||ev.button>0)return;const pt=cropCoordinates(ev);if(!pt)return;ev.preventDefault();cropDragging=true;cropStartPoint=pt;try{$('ggCropStage').setPointerCapture(ev.pointerId)}catch(e){}
 cropRects[cropActive]={x:pt.x,y:pt.y,w:.002,h:.002};paintCrop();
}
function cropMove(ev){if(!cropDragging||!cropStartPoint)return;const pt=cropCoordinates(ev);if(!pt)return;const a=cropStartPoint;cropRects[cropActive]={x:Math.min(a.x,pt.x),y:Math.min(a.y,pt.y),w:Math.abs(pt.x-a.x),h:Math.abs(pt.y-a.y)};paintCrop();}
function cropEnd(ev){if(!cropDragging)return;const r=cropRects[cropActive];cropDragging=false;cropStartPoint=null;
 if(r.w<.025||r.h<.02){cropRects[cropActive]={...cropDefaults[cropActive]};}paintCrop();
}
async function fileChange(input){if(!full())return;const file=input?.files?.[0];if(!file)return;const token=++activeAnalysis;
 cleanPhoto();const status=$('ggPhotoStatus'),btn=$('ggAnalyzeBtn');if(btn)btn.disabled=true;if(status)status.textContent='Abriendo fotografía original…';
 try{
  if(file.size>12*1024*1024)throw new Error('El archivo supera 12 MB.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('El archivo debe ser JPG, PNG o WEBP.');
  const url=URL.createObjectURL(file);
  const img=new Image();const dimensions=await new Promise((resolve,reject)=>{img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(new Error('No se pudo abrir la imagen.'));img.src=url});
  if(token!==activeAnalysis||!$('ggPhotoPreview')){URL.revokeObjectURL(url);return}
  if(Math.min(dimensions.width,dimensions.height)<230){URL.revokeObjectURL(url);throw new Error('La imagen tiene poca resolución; acerca la cámara a la matrícula y repite la foto.');}
  photoData=url;photoObjectUrl=url;
  $('ggPhotoImage').src=url;$('ggPhotoPreview').classList.remove('hide');
  $('ggPhotoFileInfo').textContent=dimensions.width+' × '+dimensions.height+' px · resolución original conservada';
  cropActive='plate';cropRects={plate:{...cropDefaults.plate},badges:{...cropDefaults.badges}};paintCrop();
  if(status)status.textContent='Selecciona la matrícula y los emblemas arrastrando sobre la foto. Después pulsa Analizar.';
  if(btn)btn.disabled=false;
 }catch(err){if(status)status.textContent=err?.message||'No se pudo abrir la fotografía.';if(photoObjectUrl)cleanPhoto();if(btn)btn.disabled=true}
}
// Cargamos Tesseract.js únicamente en la versión FULL y cuando se necesita. El
// motor OCR es gratuito y se ejecuta en el dispositivo (no se sube la imagen).
function loadFreeOCR(){
 if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
 if(ocrScriptPromise)return ocrScriptPromise;
 ocrScriptPromise=new Promise((resolve,reject)=>{
  const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  sc.async=true;sc.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error('El lector OCR no se ha iniciado.'));
  sc.onerror=()=>reject(new Error('No se ha podido descargar el lector gratuito. Comprueba la conexión o continúa manualmente.'));
  document.head.appendChild(sc);
 }).catch(err=>{ocrScriptPromise=null;throw err});
 return ocrScriptPromise;
}
function getPlateFromOCR(raw){
 const lines=String(raw||'').toUpperCase().split(/\n|\r/);
 for(const line of lines){
  const words=line.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
  for(let i=0;i<words.length;i++){
   // No juntamos todo el texto de una línea: ello inventaría matrículas con
   // letras de modelos próximos a la placa, por ejemplo AUDI S3 TFSI.
   for(const candidate of [words[i],words[i]+(words[i+1]||'')]){
    if(candidate.length!==7||!/^[0-9OBDQSILZ]{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(candidate))continue;
    if((candidate.slice(0,4).match(/[0-9]/g)||[]).length<3)continue;
    const head=candidate.slice(0,4).replace(/[OQD]/g,'0').replace(/[IL]/g,'1').replace(/S/g,'5').replace(/B/g,'8').replace(/Z/g,'2');
    const p=head+candidate.slice(4);if(validPlate(p))return p;
   }
  }
 }
 return '';
}
// Reglas conservadoras; es un catálogo de pistas, no una base oficial por matrícula.
function interpretOCR(text){
 const upper=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 const spaced=upper.replace(/[^A-Z0-9.]+/g,' ').replace(/\s+/g,' ').trim();
 const compact=spaced.replace(/\s/g,'');
 const has=(pat)=>pat.test(' '+spaced+' ');
 const plate=getPlateFromOCR(upper);
 let brand='',model='',version='',fuel='',kind='Coche';const found=[];
 const catalogue=[
  ['Audi','S3',/\bS\s*3\b/,/\bAUDI\b/],['Audi','A3',/\bA\s*3\b/,/\bAUDI\b/],['Audi','A4',/\bA\s*4\b/,/\bAUDI\b/],['Audi','Q3',/\bQ\s*3\b/,/\bAUDI\b/],['Audi','Q5',/\bQ\s*5\b/,/\bAUDI\b/],
  ['Volkswagen','Golf',/\bGOLF\b/],['Volkswagen','Polo',/\bPOLO\b/],['Volkswagen','Passat',/\bPASSAT\b/],['Volkswagen','Tiguan',/\bTIGUAN\b/],
  ['SEAT','León',/\bLEON\b/],['SEAT','Ibiza',/\bIBIZA\b/],['SEAT','Ateca',/\bATECA\b/],['SEAT','Arona',/\bARONA\b/],
  ['Cupra','Formentor',/\bFORMENTOR\b/],['Cupra','Born',/\bBORN\b/],
  ['BMW','320d',/\b320\s*D\b/],['BMW','118d',/\b118\s*D\b/],['BMW','X1',/\bX\s*1\b/,/\bBMW\b/],
  ['Renault','Clio',/\bCLIO\b/],['Renault','Mégane',/\bMEGANE\b/],['Renault','Captur',/\bCAPTUR\b/],
  ['Dacia','Sandero',/\bSANDERO\b/],['Dacia','Duster',/\bDUSTER\b/],
  ['Ford','Focus',/\bFOCUS\b/],['Ford','Fiesta',/\bFIESTA\b/],['Ford','Kuga',/\bKUGA\b/],
  ['Peugeot','208',/\b208\b/],['Peugeot','308',/\b308\b/],['Peugeot','3008',/\b3008\b/],
  ['Citroën','C3',/\bC\s*3\b/,/\bCITROEN\b/],['Citroën','C4',/\bC\s*4\b/,/\bCITROEN\b/],
  ['Hyundai','Tucson',/\bTUCSON\b/],['Hyundai','i30',/\bI\s*30\b/],
  ['Kia','Sportage',/\bSPORTAGE\b/],['Toyota','Corolla',/\bCOROLLA\b/],['Toyota','Yaris',/\bYARIS\b/],
  ['Tesla','Model 3',/\bMODEL\s*3\b/],['Tesla','Model Y',/\bMODEL\s*Y\b/]
 ];
 // Los nombres cortos (S3, A3...) solo indican la marca cuando también figura
 // una marca o cuando hay un distintivo inequívoco de la familia.
 for(const [b,m,modelRx,brandRx] of catalogue){
  if(!modelRx.test(' '+spaced+' '))continue;
  if(brandRx&&!brandRx.test(' '+spaced+' ')&&!/\b(TFSI|TDI|QUATTRO)\b/.test(spaced))continue;
  brand=b;model=m;break;
 }
 if(!brand){
  for(const [rx,b] of [[/\bAUDI\b/,'Audi'],[/\bBMW\b/,'BMW'],[/\bSEAT\b/,'SEAT'],[/\bVOLKSWAGEN\b|\bVW\b/,'Volkswagen'],[/\bRENAULT\b/,'Renault'],[/\bPEUGEOT\b/,'Peugeot'],[/\bCUPRA\b/,'Cupra'],[/\bFORD\b/,'Ford'],[/\bTESLA\b/,'Tesla'],[/\bTOYOTA\b/,'Toyota'],[/\bOPEL\b/,'Opel'],[/\bMERCEDES\b/,'Mercedes-Benz']]){if(rx.test(spaced)){brand=b;break}}
 }
 // Moto: solo si se ve una referencia suficientemente explícita.
 if(/\b(YAMAHA|KAWASAKI|HONDA|DUCATI|PIAGGIO|SUZUKI|KTM|VESPA|XMAX|TMAX)\b/.test(spaced)){
  kind='Moto';const mt=spaced.match(/\b(XMAX|TMAX|FORZA|PCX|NMAX)\b(?:\s*(125|300|400|530|560))?/);
  if(mt){model=[mt[1],mt[2]].filter(Boolean).join(' ')}
  if(/\bYAMAHA\b/.test(spaced)||/\b(XMAX|TMAX|NMAX)\b/.test(spaced))brand='Yamaha';
  else if(/\bHONDA\b/.test(spaced)||/\b(FORZA|PCX)\b/.test(spaced))brand='Honda';
 }
 const engine=spaced.match(/\b(?:1[.]2|1[.]4|1[.]5|1[.]6|1[.]8|1[.]9|2[.]0|2[.]2|2[.]5|3[.]0)\s*(TDI|TFSI|TSI|HDI|CDTI|DCI|GDI|TCE)\b/);
 const badge=spaced.match(/\b(TFSI|TDI|TSI|HDI|BLUEHDI|CDTI|DCI|GDI|ECOBOOST|VTEC|TCE|E-TECH|HYBRID|ELECTRIC|EV|QUATTRO|4MATIC|GTI)\b/g)||[];
 if(engine){version=engine[0].replace(/\s+/g,' ');found.push(version)}
 found.push(...badge);
 const isDiesel=/\b(TDI|HDI|BLUEHDI|CDTI|DCI|ECOBLUE)\b|\b320\s*D\b|\b118\s*D\b/.test(spaced);
 const isPetrol=/\b(TFSI|TSI|GDI|ECOBOOST|VTEC|TCE|GTI)\b/.test(spaced);
 const isElectric=/\b(ELECTRIC|100\s*%\s*ELECTRIC|BEV|ZERO EMISSION)\b/.test(spaced)||brand==='Tesla'||(brand==='Cupra'&&model==='Born');
 if(isElectric&&!isDiesel&&!isPetrol)fuel='Eléctrico';
 else if(isDiesel&&!isPetrol&&!isElectric)fuel='Diésel';
 else if(isPetrol&&!isDiesel&&!isElectric)fuel='Gasolina 95';
 else if(brand==='Audi'&&model==='S3')fuel='Gasolina 95';
 const badges=[...new Set(found)].slice(0,6);
 const clues= [plate&&'Matrícula leída por OCR',brand&&model&&'Marca y modelo propuestos mediante texto visible',fuel&&'Combustible inferido a partir de distintivos'].filter(Boolean);
 return {plate,brand,model,version,color:'',kind,fuelSuggestion:fuel,badges,confidence:clues.length>=3?'media':'baja',notes:(clues.length?clues.join('. ')+'. ':'')+'El OCR no reconoce de forma fiable logotipos, color ni la versión exacta. Confirma todos los datos.'};
}
// El reconocimiento de una foto entera hace que las letras pequeñas se pierdan.
// Usamos dos áreas dibujadas por el usuario y conservamos toda la resolución original.
function cropPrepared(imageUrl,rect,variant='gray',target=1800){
 return new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>{try{
   const w=img.naturalWidth,h=img.naturalHeight;
   const x=Math.max(0,Math.floor(rect.x*w)),y=Math.max(0,Math.floor(rect.y*h));
   const cw=Math.max(1,Math.min(w-x,Math.floor(rect.w*w))),ch=Math.max(1,Math.min(h-y,Math.floor(rect.h*h)));
   const scale=Math.min(5,Math.max(1.3,target/cw));
   const c=document.createElement('canvas');c.width=Math.min(3200,Math.max(2,Math.round(cw*scale)));c.height=Math.min(1800,Math.max(2,Math.round(ch*scale)));
   const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   ctx.filter=variant==='original'?'none':variant==='gray'?'grayscale(1) contrast(1.65) brightness(1.1)':'grayscale(1) contrast(1.4)';
   ctx.drawImage(img,x,y,cw,ch,0,0,c.width,c.height);ctx.filter='none';
   if(variant==='binary'){
    const pixels=ctx.getImageData(0,0,c.width,c.height),a=pixels.data;
    const hist=new Uint32Array(256);for(let i=0;i<a.length;i+=4)hist[a[i]]++;
    const count=c.width*c.height;let total=0;for(let i=0;i<256;i++)total+=i*hist[i];
    let back=0,num=0,best=0,cutoff=120;
    for(let i=0;i<256;i++){num+=hist[i];if(!num)continue;const rest=count-num;if(!rest)break;back+=i*hist[i];const diff=back/num-(total-back)/rest;const variance=num*rest*diff*diff;if(variance>best){best=variance;cutoff=i}}
    for(let i=0;i<a.length;i+=4){const v=a[i]>=cutoff?255:0;a[i]=a[i+1]=a[i+2]=v}
    ctx.putImageData(pixels,0,0);
   }
   resolve(c.toDataURL('image/png'));
  }catch(e){reject(e)}};img.onerror=()=>reject(new Error('No se pudo procesar la zona seleccionada.'));img.src=imageUrl;
 });
}
async function readRegion(worker,tess,region,variant,psm,whiteList){
 await worker.setParameters({tessedit_pageseg_mode:String(psm),tessedit_char_whitelist:whiteList||'',preserve_interword_spaces:'1',user_defined_dpi:'150'});
 const processed=await cropPrepared(photoData,cropRects[region],variant,region==='plate'?1700:1900);
 const result=await worker.recognize(processed);
 return String(result?.data?.text||'').trim();
}
async function analyze(){
 if(!full()||!draft)return;
 const status=$('ggPhotoStatus');if(!photoData){if(status)status.textContent='Primero selecciona una fotografía.';return}
 const token=++activeAnalysis,btn=$('ggAnalyzeBtn');if(btn)btn.disabled=true;
 if(status)status.textContent='Preparando OCR; la primera descarga necesita Internet…';
 let worker=null;
 try{
  const tess=await loadFreeOCR();if(token!==activeAnalysis||!full())return;
  worker=await tess.createWorker('eng',1,{logger:m=>{if(token!==activeAnalysis)return;if(m?.status==='recognizing text'&&status)status.textContent='Analizando zona seleccionada: '+Math.round((m.progress||0)*100)+' %';}});
  if(token!==activeAnalysis||!full())return;
  const singleLine=tess.PSM?.SINGLE_LINE||'7',sparse=tess.PSM?.SPARSE_TEXT||'11';
  if(status)status.textContent='Leyendo matrícula ampliada (1/3)…';
  let plateText=await readRegion(worker,tess,'plate','gray',singleLine,'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ');
  if(token!==activeAnalysis||!full())return;
  let plate=getPlateFromOCR(plateText);
  if(!plate){if(status)status.textContent='Mejorando contraste de matrícula (2/3)…';const variant=await readRegion(worker,tess,'plate','binary',singleLine,'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ');plateText+='\n'+variant;plate=getPlateFromOCR(plateText)}
  if(status)status.textContent='Leyendo distintivos y nombre del modelo (3/3)…';
  let badgeText=await readRegion(worker,tess,'badges','gray',sparse,'');
  if(token!==activeAnalysis||!full())return;
  if(badgeText.trim().length<3){if(status)status.textContent='Repitiendo lectura de distintivos…';badgeText+='\n'+await readRegion(worker,tess,'badges','original',sparse,'')}
  if(token!==activeAnalysis||!full())return;
  const v=interpretOCR(badgeText+'\n'+plateText);
  draft.brand=v.brand;draft.model=v.model;draft.version=v.version;draft.color='';draft.kind=v.kind;
  draft.plate=plate||v.plate||'';draft.registration=approximateRegistration(draft.plate);
  draft.suggestedFuel=fuels.includes(v.fuelSuggestion)?v.fuelSuggestion:'';draft.fuel=draft.suggestedFuel;
  draft.year='';draft.badges=v.badges.join(' · ');draft.origin='ocr_suggested';draft.confidence=v.confidence;
  draft.notes=v.notes;draft.photo=true;draft.name=[draft.brand,draft.model].filter(Boolean).join(' ').slice(0,65)||'Mi vehículo';
  draft.rawPlateText=plateText.trim().slice(0,150);draft.rawBadgeText=badgeText.trim().slice(0,200);
  if(!draft.plate&&!draft.brand&&!draft.model&&!draft.badges){
   if(status)status.textContent='No se ha leído ninguna matrícula ni emblema. Prueba a seleccionar una zona más ajustada, sin reflejos, o continúa manualmente.';
   if(btn)btn.disabled=false;return;
  }
  cleanPhoto();review();
 }catch(err){if(token===activeAnalysis&&status)status.textContent=(err?.message||'No se pudo leer esta imagen.')+' Puedes volver a marcar la matrícula o continuar manualmente.';if(btn)btn.disabled=false}
 finally{try{await worker?.terminate()}catch(e){}}
}

function review(){if(!full()||!draft)return;
 const tags=[['Marca',draft.brand],['Modelo',draft.model],['Color',draft.color],['Matrícula',draft.plate],['Insignias',draft.badges],['Combustible sugerido',draft.suggestedFuel],['Modelo / generación',draft.version]];
 modal(`<div class="gg-plate-modal"><div class="gg-plate-step">Lectura OCR gratuita · datos propuestos</div><h2>${esc(draft.name||'Vehículo analizado')}</h2><span class="pill ${draft.confidence==='alta'?'green':'yellow'}">Confianza ${esc(draft.confidence||'no determinada')}</span><div class="gg-detected-grid">${tags.map(([k,v])=>`<div><small>${esc(k)}</small><strong>${esc(v||'No identificado')}</strong></div>`).join('')}</div>${draft.registration?`<p class="gg-registration-estimate">📅 Matriculación española orientativa: ${esc(draft.registration)}. No es el año de fabricación.</p>`:''}${chronologyAlert(draft.year,draft.registration)?`<div class="gg-plate-warning">${esc(chronologyAlert(draft.year,draft.registration))}</div>`:''}${draft.notes?`<p class="small muted">${esc(draft.notes)}</p>`:''}<details class="gg-ocr-trace"><summary>Ver texto leído por OCR</summary><p class="small muted">Matrícula: ${esc(draft.rawPlateText||'No legible')}</p><p class="small muted">Emblemas: ${esc(draft.rawBadgeText||'No legibles')}</p></details><div class="gg-plate-warning">Son sugerencias basadas en texto reconocido, no una identificación visual completa. Corrige marca, modelo, matrícula y combustible antes de guardar.</div><button class="btn primary block" onclick="GGPlate.showForm()">Revisar y editar ficha →</button><button class="btn ghost block" style="margin-top:8px" onclick="GGPlate.openPhoto('${mode}')">Hacer otra foto</button></div>`);
}
function showForm(){if(!full())return;if(!draft)draft=newDraft();
 const opts=(arr,value)=>arr.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join('');
 modal(`<div class="gg-plate-modal"><div class="gg-plate-step">${editingPlate?'Editar vehículo':draft.photo?'Datos sugeridos por OCR · editar':'Alta manual'} · confirmación</div><h2>Ficha de tu vehículo</h2><p class="small muted">Corrige cualquier dato; solo se guardará lo que confirmes.</p><label class="field" for="ggvName">Nombre en GAS&GO</label><input id="ggvName" type="text" maxlength="65" value="${esc(draft.name)}" placeholder="Mi coche"><div class="gg-plate-columns"><div><label class="field" for="ggvBrand">Marca</label><input id="ggvBrand" type="text" maxlength="55" value="${esc(draft.brand)}" placeholder="Audi"></div><div><label class="field" for="ggvModel">Modelo</label><input id="ggvModel" type="text" maxlength="80" value="${esc(draft.model)}" placeholder="S3"></div></div><div class="gg-plate-columns"><div><label class="field" for="ggvPlate">Matrícula</label><input id="ggvPlate" type="text" autocapitalize="characters" maxlength="14" value="${esc(draft.plate)}" placeholder="1234 ABC" oninput="GGPlate.plateHint()"></div><div><label class="field" for="ggvColor">Color</label><input id="ggvColor" type="text" maxlength="45" value="${esc(draft.color)}" placeholder="Negro"></div></div><div id="ggRegistrationHint" class="gg-plate-hint">${draft.registration?'Matrícula española orientativa: '+esc(draft.registration)+' · no indica fabricación':''}</div><div class="gg-plate-columns"><div><label class="field" for="ggvVersion">Versión / motor</label><input id="ggvVersion" type="text" maxlength="80" value="${esc(draft.version)}" placeholder="2.0 TFSI"></div><div><label class="field" for="ggvKind">Tipo</label><select id="ggvKind">${opts(types,draft.kind)}</select></div></div><label class="field" for="ggvFuel">Combustible ${draft.suggestedFuel?'(sugerido: '+esc(draft.suggestedFuel)+')':''}</label><select id="ggvFuel" onchange="ggUX.toggleEnergyFields('ggv')"><option value="">Selecciona una opción</option>${opts(fuels,draft.fuel)}</select>${window.ggUX?ggUX.energyFields('ggv',draft):''}<label class="gg-fuel-confirm"><input type="checkbox" id="ggvConfirmFuel"><span>Confirmo que el combustible es correcto para mi vehículo.</span></label><p class="small muted">La lectura OCR puede confundir letras o versiones. Debes confirmar el combustible antes de guardar.</p><div id="ggvError" role="alert" class="gg-plate-hint invalid"></div><button class="btn primary block" onclick="GGPlate.store()">${mode==='registration'?'Aplicar datos al registro':editingPlate?'Guardar cambios':'Guardar y seleccionar'}</button><button class="btn ghost block" style="margin-top:8px" onclick="GGPlate.cancel()">Cancelar</button></div>`);
}
function plateHint(){const hint=$('ggRegistrationHint');if(!hint)return;const p=$('ggvPlate')?.value||'';const band=approximateRegistration(p);hint.textContent=!p?'':validPlate(p)?(band?`Matriculación española orientativa: ${band}. No indica fabricación.`:'Matrícula válida. Fecha no estimable con este formato.'):'Revisa la matrícula española.'}
function store(){if(!full()||!draft)return;const read=id=>String($(id)?.value||'').trim();const v={name:read('ggvName').slice(0,65),brand:read('ggvBrand').slice(0,55),model:read('ggvModel').slice(0,80),plate:norm(read('ggvPlate')),color:read('ggvColor').slice(0,45),version:read('ggvVersion').slice(0,80),kind:read('ggvKind'),fuel:read('ggvFuel'),combustionFuel:read('ggvCombustion'),connector:read('ggvConnector')};const error=$('ggvError');
 if((!v.brand&&!editingPlate)||!v.model||!validPlate(v.plate)||!types.includes(v.kind)||!fuels.includes(v.fuel)){if(error)error.textContent='Comprueba marca, modelo, matrícula válida, tipo y combustible.';return}
 if(v.fuel==='Híbrido enchufable'&&(!['Gasolina 95','Diésel'].includes(v.combustionFuel)||!['Tipo 2','CCS2','CHAdeMO','Tipo 1','Schuko'].includes(v.connector))){if(error)error.textContent='Selecciona el combustible del motor y el conector.';return}
 if(!$('ggvConfirmFuel')?.checked){if(error)error.textContent='Confirma el combustible para continuar.';return}
 if(!v.name)v.name=[v.brand,v.model].join(' ').slice(0,65);
 v.emoji=emojiFor(v.kind,v.fuel);v.registrationEstimate=approximateRegistration(v.plate);v.origin=draft.origin==='ocr_suggested'?'ocr_confirmed':'user_confirmed';v.confirmedAt=new Date().toISOString();
 if(mode==='registration'){
  if(typeof regDraft==='undefined'){if(error)error.textContent='El registro ya no está disponible.';return}
  regDraft.plate=v.plate;regDraft.name=v.name;regDraft.model=[v.brand,v.model].filter(Boolean).join(' ');regDraft.fuel=v.fuel;regDraft.combustionFuel=v.combustionFuel;regDraft.connector=v.connector;regDraft.kind=v.kind;regDraft.version=v.version;regDraft.color=v.color;pendingRegistrationVehicle=v;
  for(const [key,value] of Object.entries({plate:v.plate,name:v.name,model:regDraft.model,fuel:v.fuel,combustionFuel:v.combustionFuel,connector:v.connector})){const input=$('reg_'+key);if(input)input.value=value}
  draft=null;cleanPhoto();closeModal();if(window.ggUX)ggUX.toggleEnergyFields('reg');toast('Vehículo incorporado al registro. Revisa y continúa.');return;
 }
 const rows=sync();
 if(editingPlate&&rows.some(item=>norm(item.plate)===v.plate&&norm(item.plate)!==norm(editingPlate))){if(error)error.textContent='Ya tienes otro vehículo con esa matrícula.';return}
 const idx=rows.findIndex(item=>norm(item.plate)===norm(editingPlate||v.plate));if(idx>=0)rows[idx]=v;else rows.push(v);
 if(editingPlate&&editingPlate!==v.plate&&data.energyPreferences?.[editingPlate]){data.energyPreferences[v.plate]=data.energyPreferences[editingPlate];delete data.energyPreferences[editingPlate]}
 if(editingPlate&&norm(editingPlate)!==v.plate&&data.vehiclePreferences?.[norm(editingPlate)]){data.vehiclePreferences[v.plate]=data.vehiclePreferences[norm(editingPlate)];delete data.vehiclePreferences[norm(editingPlate)]}
 const edited=!!editingPlate;if(!edited||editingActive)apply(v);else save();
 editingPlate=null;editingActive=false;draft=null;cleanPhoto();closeModal();go('Mi vehículo');toast(edited?'Cambios del vehículo guardados':'Vehículo confirmado y guardado');
}
function apply(v){if(!full())return;data.customVehicle={name:v.name,model:modelLabel(v),plate:v.plate,fuel:v.fuel,emoji:v.emoji,brand:v.brand,kind:v.kind,version:v.version,color:v.color,origin:v.origin,combustionFuel:v.combustionFuel,connector:v.connector};data.vehicle=v.name;data.fuel=v.fuel;window.GGPreferences?.apply(v);save();try{window.ggv2?.refreshLinkUI?.()}catch(e){}}
function persistRegistrationVehicle(){if(!full())return;ensureExampleVehicles();if(!pendingRegistrationVehicle)return;const v=pendingRegistrationVehicle;pendingRegistrationVehicle=null;const rows=sync();const ix=rows.findIndex(item=>item.plate===v.plate);if(ix>=0)rows[ix]=v;else rows.push(v);apply(v)}
function select(i){if(!full())return;const v=stored()[i];if(!v)return;apply(v);render();toast('Vehículo seleccionado')}
function remove(i){if(!full())return;const rows=sync(),v=rows[i];if(!v||!confirm(`¿Eliminar ${v.name} (${v.plate}) de GAS&GO?`))return;rows.splice(i,1);if(data.vehiclePreferences)delete data.vehiclePreferences[norm(v.plate)];if(data.customVehicle?.plate===v.plate){if(rows.length)apply(rows[0]);else{data.customVehicle=null;data.vehicle='Moto principal';data.fuel='Gasolina 95';data.payment=data.generalPayment||data.payment}}save();render();toast('Vehículo eliminado')}
function editVehicle(v){
 if(!full()||!v)return;activeAnalysis++;cleanPhoto();mode='garage';draft={...newDraft(),...v,kind:v.kind||(v.emoji==='🛵'?'Moto':'Coche')};editingPlate=v.plate;editingActive=norm(data.customVehicle?.plate)===norm(v.plate)&&data.vehicle===v.name;showForm();
}
function edit(i){editVehicle(stored()[i])}
function editCurrent(){const current=data.customVehicle;if(!current)return;const saved=stored().find(v=>norm(v.plate)===norm(current.plate));if(saved){editVehicle(saved);return}const v={...current};if(v.brand&&v.model?.toLowerCase().startsWith(v.brand.toLowerCase()+' '))v.model=v.model.slice(v.brand.length+1);editVehicle(v)}
function cancel(){activeAnalysis++;editingPlate=null;editingActive=false;draft=null;cleanPhoto();closeModal()}
window.GGPlate={ensureExamples:ensureExampleVehicles,screen,edit,editCurrent,openManual,openPhoto,fileChange,cropMode,nextCrop,cropReset,cropStart,cropMove,cropEnd,analyze,review,showForm,plateHint,store,select,remove,cancel,validPlate,norm,approximateRegistration,persistRegistrationVehicle,interpretOCR,getPlateFromOCR};
})();
