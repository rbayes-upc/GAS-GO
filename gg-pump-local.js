'use strict';
(function(){
const $=id=>document.getElementById(id);
const euro=n=>Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const format=n=>Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2});
const hexToken=()=>{const bytes=new Uint8Array(10);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()};
let code=hexToken().slice(0,16),peerId='gg-p-'+code;
let traditionalStep=null,linkedProfile=null,hoseLifted=false,welcomeTimer=null,welcomeAutoCloseTimer=null;
let peer=null,connection=null,hold=null,charge=null,verifierTimer=null,autoMethodTimer=null,autoMethodDeadline=0,peerServiceStatus='connecting',peerServiceProblem='',session={status:'idle',sessionId:'',method:null,vehicle:'',fuel:'Gasolina 95',station:'',amount:0,quantity:0,price:1.59,powerKW:null,connector:null,nonce:'',fallbackCode:'',finishedAt:null,clientReady:false};
function peerErrorText(err){
 const kind=String(err?.type||'').toLowerCase();
 if(kind==='unavailable-id')return 'Código de sesión duplicado. Pulsa «Nuevo QR y sesión».';
 if(kind==='network'||kind==='socket-error'||kind==='server-error')return 'No se puede llegar al servicio PeerJS. Comprueba Internet, prueba otra red y pulsa «Nuevo QR y sesión».';
 return 'Error de enlace '+(kind||'desconocido')+'. Prueba a recargar esta página.';
}
function setPeerServiceStatus(status,detail=''){
 peerServiceStatus=status;peerServiceProblem=detail;
 const diag=$('ggConnectionDiag');
 if(diag){diag.textContent=status==='ready'?'APP conectada en este navegador · sin QR ni llegada.':status==='connecting'?'Conectando con el servicio de enlace…':detail||'Servicio de vinculación interrumpido.';diag.className='gg-app-config-msg'+(status==='ready'?' ok':'')}
}
const isEV=()=>session.fuel==='Eléctrico';
const connected=()=>!!connection?.open;
const guestMode=()=>session.source==='traditional_guest';
const validLimit=value=>Number.isFinite(Number(value))&&Number(value)>=1&&Number(value)<=300?Math.round(Number(value)*100)/100:null;
const validPayment=value=>['Visa •••• 4821','Mastercard •••• 1056','PayPal (demo)','Bizum (demo)','Visa (demo)','Mastercard (demo)'].includes(value)?value:null;
const quantityLimit=()=>session.maxAmount?Math.floor(session.maxAmount/session.price*1000+1e-8)/1000:Infinity;
const limitReached=()=>!!session.maxAmount&&session.quantity>=quantityLimit()-1e-8;

const canOperate=()=>guestMode()||connected();
function clearWelcomeTimers(){clearTimeout(welcomeTimer);clearTimeout(welcomeAutoCloseTimer);welcomeTimer=null;welcomeAutoCloseTimer=null;}
function closeWelcomeModal(){const modal=$('welcomeModal'); if(modal) modal.classList.add('hide'); clearWelcomeTimers();}
function showWelcomeModal(){const modal=$('welcomeModal'); if(!modal||!(linkedProfile&&linkedProfile.name)) return; const name=linkedProfile.name; const vName=linkedProfile.vehicleName||linkedProfile.vehicle||session.vehicle||'Vehículo de prueba'; const vModel=linkedProfile.vehicleModel||''; const vPlate=linkedProfile.vehiclePlate||''; const fuel=session.fuel||linkedProfile.fuel||'Gasolina 95'; const meta=[vModel,vPlate].filter(Boolean).join(' · ')||'Vehículo vinculado'; $('welcomeName').textContent='Bienvenido, '+name; $('welcomeVehicleLine').textContent=vName; $('welcomeVehicleMeta').textContent=meta; $('welcomeFuelMeta').textContent='Combustible: '+fuel; modal.classList.remove('hide'); clearWelcomeTimers(); welcomeAutoCloseTimer=setTimeout(closeWelcomeModal,6500); }
// Loyalty promotions are fictional; the physical pump price remains the official published unit price.
function computeTotal(){
 const base=Math.round(Math.max(0,session.quantity||0)*Math.max(0,session.price||0)*100)/100;
 let discount=0;const p=session.promoId;
 if(p==='fuel'&&session.fuel==='Gasolina 95')discount=Math.round(session.quantity*.05*100)/100;
 else if(p==='ev'&&session.fuel==='Eléctrico')discount=Math.round(session.quantity*.03*100)/100;
 else if(p==='redeem'&&base>=2)discount=2;
 discount=Math.min(base,discount);
 session.subtotal=base;session.discount=discount;
 session.amount=Math.round((base-discount)*100)/100;
 if(session.maxAmount!=null)session.amount=Math.min(session.maxAmount,session.amount);
}

const traditionalLocked=()=>traditionalStep!==null;
function qr(target,text){const el=$(target);el.replaceChildren();if(typeof QRCode!=='function'){el.classList.add('error');el.textContent='Usa el código temporal visible debajo para autorizar (modo local).';return false}try{new QRCode(el,{text,width:180,height:180,colorDark:'#112638',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});return true}catch(e){el.textContent='No se pudo generar QR';return false}}
// Vinculación manual: se muestra un QR de identificador, no un enlace web.
// Se escanea DESDE la cámara interna de GAS&GO (botón de cadena).
function pairingCode(){return 'GG-'+code.match(/.{1,4}/g).join('-')}
function renderPairingQR(){
 if(!peer?.open||peerServiceStatus!=='ready')return;
 const token=pairingCode();
 $('pairCode').textContent=token;
 $('pairQr').classList.remove('error');
 const ready=qr('pairQr',token);
 $('qrLinkStatus').textContent=ready?'✓ QR de vinculación listo · escanéalo desde GAS&GO':'⚠ No se pudo generar el QR · introduce el código manual';
 $('qrLinkStatus').className='qr-one-tag '+(ready?'ready':'problem');
}
function snapshot(){if(guestMode())return {status:'busy',source:'traditional_guest',linked:connected(),pump:'Surtidor 02',ts:Date.now()};return {...session,linked:connected(),pump:'Surtidor 02',ts:Date.now()}}
function broadcast(){if(connected())connection.send({type:'state',state:snapshot()});paint()}
function clearAutoMethod(){clearInterval(autoMethodTimer);autoMethodTimer=null;autoMethodDeadline=0;const el=$('autoMethodCountdown');if(el)el.textContent='Método A automático en 5 s'}
function startAutoMethodCountdown(){clearAutoMethod();if(session.status!=='verifying'||!connected())return;autoMethodDeadline=Date.now()+5000;const tick=()=>{if(session.status!=='verifying'||!connected()){clearAutoMethod();return}const left=Math.max(0,Math.ceil((autoMethodDeadline-Date.now())/1000));const el=$('autoMethodCountdown');if(el)el.textContent='Método A automático en '+left+' s';if(left<=0){clearAutoMethod();method('A',true)}};tick();autoMethodTimer=setInterval(tick,250)}
function stopHold(){clearInterval(hold);hold=null;$('supplyBtn').classList.remove('active')}
function halt(){stopHold();clearInterval(charge);charge=null}
function reset(){halt();clearTimeout(verifierTimer);clearAutoMethod();closeWelcomeModal();traditionalStep=null;hoseLifted=false;session={status:'idle',sessionId:'',method:null,vehicle:'',fuel:'Gasolina 95',station:'',amount:0,quantity:0,price:1.59,powerKW:null,connector:null,nonce:'',fallbackCode:'',finishedAt:null,clientReady:false,source:'app',maxAmount:null,loyalty:false,paymentStatus:''};broadcast()}
function paint(){
 const s=session,ev=isEV(),fuel=s.fuel==='Diésel'?'Diésel':'Gasolina 95';
 const names={idle:'Disponible',verifying:'Verificando',awaiting_confirmation:'Esperando confirmación',awaiting_fallback:'Método C requerido',authorized:'Autorizado',fueling:ev?'Cargando':'Suministrando',paused:'Pausado',finished:'Finalizado',emergency:'Parada de emergencia'};
 $('stateBadge').textContent='● '+(names[s.status]||s.status);
 $('vehicle').textContent=s.vehicle?`${s.vehicle} · ${s.station||'GAS&GO'}`:'Esperando vehículo';
 $('amount').textContent=euro(s.amount);
 $('quantity').textContent=format(s.quantity)+(ev?' kWh':' L');
 $('quantityLabel').textContent=ev?'ENERGÍA (kWh)':'VOLUMEN (L)';
 $('unitPriceLabel').textContent=ev?'PRECIO POR kWh':'PRECIO POR LITRO';
 $('price').textContent=euro(s.price)+(ev?'/kWh':'/L');
 $('operationTitle').textContent=s.vehicle&&ev?'Punto de carga 02':'Surtidor 02';
 $('modeChip').textContent=!s.vehicle?'◇ Listo para combustión o electricidad':ev?'⚡ Recarga eléctrica':'⛽ Repostaje de combustible';
 $('modeChip').classList.toggle('ev',ev&&!!s.vehicle);
 document.querySelector('.wrap')?.classList.toggle('mode-electric',ev&&!!s.vehicle);
 $('productDetail').textContent=!s.vehicle?'El surtidor cambiará de modo automáticamente según el vehículo que llegue.':ev?`Electricidad · Conector ${s.connector||'CCS2'} · ${s.powerKW||75} kW ${s.powerSource==='ripree'?'nominales del punto RIPREE':'de potencia nominal de prueba'} · entrega simulada`:`${fuel} · Manguera compatible · Flujo simulado: 0,7 L/s`;
 if(s.loyaltyProgram&&s.source==='app')$('productDetail').textContent+=' · '+(s.loyaltyProgram==='Otra'?'Tarjeta de otra compañía':s.loyaltyProgram)+' seleccionada (demo; sin validación ni puntos reales)';
 const welcome=$('welcomeBanner');if(welcome){const hasProfile=!!(linkedProfile&&linkedProfile.name);const detected=(linkedProfile?.vehicleDetected||[linkedProfile?.vehicleName||linkedProfile?.vehicle||s.vehicle||'Vehículo de prueba',linkedProfile?.vehicleModel||'',linkedProfile?.vehiclePlate||''].filter(Boolean).join(' · ')).trim();const showWelcome=connected()&&hasProfile&&s.source==='app'&&s.status!=='finished';welcome.classList.toggle('hide',!showWelcome);if(showWelcome){welcome.innerHTML='<b>Bienvenido, '+escapeText(linkedProfile.name)+'</b><div class="mini">Las cámaras del surtidor han reconocido el vehículo vinculado a tu cuenta de GAS&GO.</div><div class="detected"><strong>Vehículo detectado</strong><span>'+escapeText(detected||s.vehicle||'Vehículo de prueba')+'</span><span>'+escapeText(s.fuel||linkedProfile.fuel||'Gasolina 95')+'</span></div>';}else welcome.innerHTML='';}
 const messages={idle:connected()?'Surtidor enlazado · esperando la operación demo':'Surtidor disponible · esperando móvil',verifying:s.method==='A'?'Método A activado · verificando automáticamente (simulación)…':'Vehículo recibido · puedes escoger B o C antes de que se active A automáticamente',awaiting_confirmation:'Esperando confirmación del surtidor en el móvil',awaiting_fallback:'Introduce el código temporal en la app para completar el método C',authorized:ev?'Autorizado · ya puedes iniciar la recarga':'Autorizado · ya puedes habilitar el repostaje',fueling:ev?'Recarga eléctrica en curso':'Suministro habilitado · mantén pulsado para repostar',paused:ev?'Recarga pausada':'Suministro pausado',finished:guestMode()?'Operación finalizada · importe realmente suministrado registrado':'Operación finalizada · recibo comunicado al móvil',emergency:'Parada de emergencia simulada · suministro detenido'};
 $('statusMsg').textContent=messages[s.status]||'';
 let preferences=$('ggOperationPreferences');if(!preferences){preferences=document.createElement('div');preferences.id='ggOperationPreferences';preferences.setAttribute('role','status');$('controls').before(preferences)}
 const showPreferences=!guestMode()&&!!s.vehicle&&(!!s.payment||!!s.maxAmount);
 preferences.classList.toggle('hide',!showPreferences);
 preferences.textContent=showPreferences?[s.payment?'Pago: '+s.payment+' · simulado':'',s.maxAmount?'Límite: '+euro(s.maxAmount)+' antes de descuentos':'',limitReached()&&s.status!=='finished'?'Límite alcanzado. Finaliza para guardar tu factura.':''].filter(Boolean).join(' · '):'';

 $('supplyNote').textContent=ev?'Recarga acelerada: 1 segundo de demostración equivale a 1 minuto de carga. El importe se calcula con los kWh realmente simulados.':'Mantén pulsado el botón de suministro para repostar; al soltarlo se detiene el flujo. La parada de emergencia solo afecta a esta demostración.';
 if(s.promoId&&['fuel','ev','double','redeem'].includes(s.promoId))$('supplyNote').textContent+=' Promoción de prueba activa: '+({fuel:'−0,05 €/L',ev:'−0,03 €/kWh',double:'puntos dobles',redeem:'canje de 500 puntos por 2 €'})[s.promoId]+'.';
 if(s.status==='idle')$('supplyNote').textContent='Método A automático por defecto. Al llegar un vehículo demo, podrás escoger B o C durante 5 segundos.';
 if(s.status==='verifying')$('supplyNote').textContent=s.method==='A'?'Verificación automática del método A en curso · sin intervención del usuario.':'Método A automático por defecto. Tienes 5 segundos para escoger B o C.';
 if(guestMode()&&s.status!=='finished')$('supplyNote').textContent='Repostaje tradicional: máximo autorizado '+euro(s.maxAmount)+'. Solo se cobrará el importe suministrado. No hay cobro bancario real.';
 $('guestSummary').innerHTML=guestFinishedInfo();
 $('methodpanel').classList.toggle('hide',s.status!=='verifying'||s.method!==null||traditionalLocked());
 $('security').classList.toggle('hide',s.status!=='awaiting_fallback');
 const adv=$('advancedMenu');if(adv&&(traditionalLocked()||s.status==='awaiting_fallback'))adv.open=true;
 if(s.status==='awaiting_fallback'){
  $('securityCode').textContent=s.fallbackCode;
  if($('securityQr').dataset.value!==s.nonce){$('securityQr').dataset.value=s.nonce;qr('securityQr','GGVERIFY:'+s.sessionId+':'+s.nonce)}
 }
 $('controls').classList.toggle('hide',!['authorized','fueling','paused'].includes(s.status));
 $('operationPanel').classList.toggle('hide',traditionalLocked());
 $('traditionalFlow').classList.toggle('hide',!traditionalLocked());
 $('traditionalEntry').classList.toggle('hide',traditionalLocked()||!['idle','finished','emergency'].includes(s.status));
 if(traditionalLocked())paintTraditional();
 $('startBtn').disabled=!canOperate()||limitReached()||!['authorized','paused'].includes(s.status);
 $('pauseBtn').disabled=!canOperate()||s.status!=='fueling';
 $('pauseBtn').textContent=ev?'⏸ Pausar recarga':'⏸ Pausar repostaje';
 const supplyBtn=$('supplyBtn');
 supplyBtn.classList.remove('hide');
 if(ev){
   supplyBtn.disabled=!canOperate()||limitReached()||!['authorized','fueling','paused'].includes(s.status);
   supplyBtn.textContent=s.status==='fueling'?'⚡ Cargando…':'⚡ Iniciar recarga';
   supplyBtn.classList.remove('ready');
 }else{
   supplyBtn.disabled=!canOperate()||limitReached()||!['authorized','fueling','paused'].includes(s.status);
   if(!hoseLifted){ supplyBtn.textContent='⛽ Agarra la manguera'; supplyBtn.classList.remove('ready','active'); }
   else { supplyBtn.textContent=s.status==='fueling'?'⛽ Presiona para surtir':'⛽ Presiona para surtir'; supplyBtn.classList.add('ready'); }
 }
 $('finishBtn').disabled=!canOperate()||!['fueling','paused'].includes(s.status)||s.quantity<=0.001;
 $('finishBtn').textContent=ev?'Finalizar recarga':'Finalizar repostaje';
 $('emergencyBtn').disabled=!canOperate()||!['fueling','paused','authorized'].includes(s.status);
 $('pauseMiniBtn').disabled=$('pauseBtn').disabled;
 $('finishMiniBtn').disabled=$('finishBtn').disabled;
 const visibleFinish=$('finishVisibleBtn');if(visibleFinish){visibleFinish.disabled=$('finishBtn').disabled;visibleFinish.textContent=ev?'✓ Finalizar recarga':'✓ Finalizar repostaje'}
 $('emergencyMiniBtn').disabled=$('emergencyBtn').disabled;
 $('disconnectBtn').disabled=guestMode();
 $('peerStatus').textContent=connected()?'● APP local conectada':peerServiceStatus==='error'?'● Servicio no disponible':peerServiceStatus==='disconnected'?'● Servicio desconectado':peerServiceStatus==='ready'?'● Esperando móvil…':'● Conectando al servicio…';
 $('pairHelp').textContent=connected()?'GAS&GO y el surtidor están enlazados localmente. El usuario puede autorizar y completar el suministro.':'Al abrir el modo DEMO en la APP, este surtidor se enlaza automáticamente. Ambas pestañas deben permanecer en el mismo navegador.';
}
function answer(msg){if(!msg||typeof msg!=='object')return;if(msg.type==='hello'||msg.type==='profile'){linkedProfile=normalizeProfile(msg);session.clientReady=true;broadcast();return}if(msg.type==='arrival'){
 if(traditionalLocked()||(session.status!=='idle'&&session.status!=='finished')){connection?.send({type:'notice',message:'El surtidor está ocupado. Finaliza la operación anterior.'});return}
 const v=String(msg.vehicle||msg.vehicleDetected||'Vehículo de prueba').slice(0,140),fuel=['Gasolina 95','Diésel','Eléctrico'].includes(msg.fuel)?msg.fuel:'Gasolina 95';
 halt();clearTimeout(verifierTimer);const price=Number(msg.price),power=Number(msg.powerKW),ev=fuel==='Eléctrico';
 clearAutoMethod();closeWelcomeModal();hoseLifted=false;session={status:'verifying',sessionId:hexToken(),method:null,vehicle:v,fuel,station:String(msg.station||'Estación GAS&GO').slice(0,90),amount:0,quantity:0,
 price:Number.isFinite(price)&&price>.1&&price<5?price:ev?.35:1.59,
 powerKW:ev&&Number.isFinite(power)&&power>=1&&power<=1000?power:ev?75:null,powerSource:msg.powerSource==='ripree'?'ripree':'demo',
 connector:ev?'CCS2':null,nonce:'',fallbackCode:'',finishedAt:null,clientReady:true,source:'app',promoId:null,vehicleName:typeof msg.vehicleName==='string'?msg.vehicleName.slice(0,80):'',vehicleModel:typeof msg.vehicleModel==='string'?msg.vehicleModel.slice(0,80):'',vehiclePlate:typeof msg.vehiclePlate==='string'?msg.vehiclePlate.slice(0,24):'',vehicleDetected:typeof msg.vehicleDetected==='string'?msg.vehicleDetected.slice(0,140):'',loyaltyProgram:['Repsol','BP','Moeve','Otra'].includes(msg.loyaltyProgram)?msg.loyaltyProgram:null,loyaltyCardRef:typeof msg.loyaltyCardRef==='string'?msg.loyaltyCardRef.slice(0,80):null,loyaltyCardSuffix:typeof msg.loyaltyCardSuffix==='string'?msg.loyaltyCardSuffix.slice(-4):null,subtotal:0,discount:0,maxAmount:validLimit(msg.maxAmount),payment:validPayment(msg.payment),loyalty:false,paymentStatus:''};broadcast();startAutoMethodCountdown();return}
 if(msg.sessionId!==session.sessionId)return;
 if(msg.type==='confirm'&&session.status==='awaiting_confirmation'&&session.method==='B'){session.status='authorized';broadcast()}
 else if(msg.type==='verify'&&session.status==='awaiting_fallback'&&session.method==='C'){
 const verified=msg.nonce===session.nonce||String(msg.code||'')===session.fallbackCode;
 if(verified){session.nonce='';session.fallbackCode='';session.status='authorized';broadcast()}else connection?.send({type:'notice',message:'Código de seguridad incorrecto'})
 }
}
function handleConnection(c){if(connection?.open){c.on('open',()=>{c.send({type:'notice',message:'Surtidor ya vinculado con otro móvil'});c.close()});return}
 const previous=connection;connection=c;if(previous&&previous!==c){try{previous.close()}catch(e){}}
 linkedProfile=null;c.on('open',()=>{if(connection!==c)return;paint();broadcast();c.send({type:'request-profile'})});c.on('data',msg=>{if(connection===c)answer(msg)});c.on('close',()=>{if(connection!==c)return;connection=null;clearAutoMethod();if(!guestMode()){halt();if(session.status==='fueling')session.status='paused'}paint()});c.on('error',err=>{if(connection!==c)return;console.warn('Conexión móvil:',err);paint()})}
function method(which,isAutomatic=false){if(session.status!=='verifying'||!connected()||session.method!==null||!['A','B','C'].includes(which))return;clearAutoMethod();session.method=which;if(which==='A'){
 session.status='verifying';$('statusMsg').textContent=isAutomatic?'No se ha elegido un método alternativo. Ejecutando el método A automáticamente…':'Comprobando BLE + UWB + token firmado (simulación)…';$('methodpanel').classList.add('hide');clearTimeout(verifierTimer);verifierTimer=setTimeout(()=>{if(session.status==='verifying'&&session.method==='A'&&connected()){session.status='authorized';broadcast();showWelcomeModal();}},20);
 }else if(which==='B'){session.status='awaiting_confirmation';broadcast()}
 else {const adv=$('advancedMenu');if(adv)adv.open=true;session.status='awaiting_fallback';session.nonce=hexToken();session.fallbackCode=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');broadcast()}
}
function start(){
 if(!canOperate()||limitReached()||!['authorized','paused'].includes(session.status))return;
 halt();session.status='fueling';broadcast();
 if(isEV()){
  charge=setInterval(()=>{
   if(!canOperate()||session.status!=='fueling'){halt();return}
   // Aceleración educativa: 1 s de tiempo real = 1 min de carga simulada.
   const delta=(Math.min(session.powerKW||75,150)*.82)/60; // Entrega ficticia: máximo 150 kW del vehículo demo y 82 % de potencia nominal.
   session.quantity=Number(Math.min(80,quantityLimit(),session.quantity+delta).toFixed(3));
   computeTotal();
   if(session.quantity>=Math.min(80,quantityLimit())-.0001){halt();session.status='paused';}
   broadcast();
  },1000);
 }
}
function pause(){if(session.status!=='fueling'||!canOperate())return;halt();session.status='paused';broadcast()}
function finish(){if(!canOperate()||!['fueling','paused'].includes(session.status)||session.quantity<=0)return;halt();session.status='finished';session.finishedAt=new Date().toISOString();hoseLifted=false;if(guestMode())saveGuestPayment();broadcast()}
function emergency(){if(!['fueling','paused','authorized'].includes(session.status))return;halt();hoseLifted=false;session.status='emergency';broadcast()}
function sendSupply(){if(session.status!=='fueling'||!canOperate()||isEV())return;const limit=quantityLimit();session.quantity=Number(Math.min(limit,session.quantity+.035).toFixed(3));computeTotal();if(limitReached()){stopHold();session.status='paused'}broadcast()}
$('traditionalEntry').addEventListener('click',openTraditional);
$('startBtn').addEventListener('click',start);
$('pauseBtn').addEventListener('click',pause);
$('finishBtn').addEventListener('click',finish);
$('finishVisibleBtn').addEventListener('click',finish);
$('emergencyBtn').addEventListener('click',emergency);
$('pauseMiniBtn').addEventListener('click',pause);
$('finishMiniBtn').addEventListener('click',finish);
$('emergencyMiniBtn').addEventListener('click',emergency);
$('resetBtn').addEventListener('click',()=>{if(session.status==='fueling'||session.status==='paused'){if(!confirm('¿Descartar el suministro actual? No se generará factura.'))return}reset()});
$('disconnectBtn').addEventListener('click',()=>{halt();connection?.close();connection=null;reset()});
$('welcomeClose')?.addEventListener('click',closeWelcomeModal);
for(const b of document.querySelectorAll('[data-method]'))b.addEventListener('click',()=>method(b.dataset.method));
const supply=$('supplyBtn');
const engageFuelButton=()=>{
 if(isEV()){
   if(['authorized','paused'].includes(session.status))start();
   else if(session.status==='fueling')pause();
   return;
 }
 if(!canOperate())return;
 if(session.status==='authorized'&&!hoseLifted){
   hoseLifted=true;
   supply.classList.add('ready');
   supply.textContent='⛽ Presiona para surtir';
   paint();
   return;
 }
 if(['authorized','paused'].includes(session.status)&&hoseLifted){ start(); return; }
};
supply.addEventListener('click',engageFuelButton);
supply.addEventListener('pointerdown',e=>{
 if(isEV()||!hoseLifted||!canOperate()||!['authorized','paused','fueling'].includes(session.status))return;
 e.preventDefault();
 if(session.status!=='fueling')start();
 if(session.status!=='fueling')return;
 try{supply.setPointerCapture(e.pointerId)}catch(x){}
 stopHold();supply.classList.add('active');sendSupply();hold=setInterval(sendSupply,50);
});
for(const n of ['pointerup','pointercancel','lostpointercapture'])supply.addEventListener(n,stopHold);
window.addEventListener('blur',stopHold);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopHold()});

// Traditional refuelling: all local, cashless payment and loyalty fully simulated.
const traditionalProducts={gas:{fuel:'Gasolina 95',price:1.59,powerKW:null,connector:null},diesel:{fuel:'Diésel',price:1.51,powerKW:null,connector:null},ev:{fuel:'Eléctrico',price:.35,powerKW:75,connector:'CCS2'}};
let traditionalDraft={loyalty:false,cardId:'',product:'gas',full:false,amount:30};
function escapeText(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function normalizeProfile(msg){return {name:String(msg.profileName||'').trim().slice(0,70),vehicle:String(msg.vehicle||'').trim().slice(0,80),vehicleName:String(msg.vehicleName||msg.vehicle||'').trim().slice(0,80),vehicleModel:String(msg.vehicleModel||'').trim().slice(0,80),vehiclePlate:String(msg.vehiclePlate||'').trim().slice(0,24),vehicleDetected:String(msg.vehicleDetected||'').trim().slice(0,140),maxAmount:validLimit(msg.maxAmount),payment:validPayment(msg.payment),fuel:['Gasolina 95','Diésel','Eléctrico'].includes(msg.fuel)?msg.fuel:'Gasolina 95'}}
function wizard(html){$('traditionalFlow').innerHTML=html+`<div style="margin-top:22px"><button class="button-quiet" type="button" onclick="ggTraditional.cancel()">← Volver al surtidor</button></div>`}
function openTraditional(){if(!['idle','finished','emergency'].includes(session.status))return; if(session.status!=='idle')reset();traditionalStep='membership';traditionalDraft={loyalty:false,cardId:'',product:'gas',full:false,amount:30};paint()}
function cancelTraditional(){if(session.status==='fueling'||session.status==='paused')return;if(guestMode())reset();else{traditionalStep=null;paint()}}
function membership(isMember){traditionalStep=isMember?'identify':'loyalty';if(isMember&&connected())connection.send({type:'request-profile'});paint()}
function paintTraditional(){
 const name=linkedProfile?.name,profile=linkedProfile,step=traditionalStep;
 if(step==='membership')return wizard(`<div class="trad-step">Acceso al surtidor</div><h2>¿Dispones de GAS&GO?</h2><p>Si ya tienes cuenta, recuperaremos la verificación con el método C. También puedes utilizar el surtidor sin la aplicación.</p><div class="trad-actions"><button class="primary" type="button" onclick="ggTraditional.membership(true)">Sí, tengo GAS&GO</button><button class="secondary" type="button" onclick="ggTraditional.membership(false)">No, repostaje tradicional</button></div>`);
 if(step==='identify')return wizard(`<div class="trad-step">Identificación GAS&GO</div><h2>${profile&&connected()?`¿Eres ${escapeText(name||'el usuario vinculado')}?`:'Vincula tu móvil GAS&GO'}</h2><p>${connected()?'Hemos encontrado un móvil vinculado. Como no se completó la identificación automática, debes verificar el surtidor mediante el método C.':'Escanea primero el QR de vinculación con la app del conductor. Una vez conectado el móvil, podremos identificar al usuario y continuar con el método C.'}</p>${profile?.vehicle&&connected()?`<div class="trad-card"><strong>${escapeText(profile.vehicle)}</strong><div class="trad-mini">${escapeText(profile.fuel)}</div></div>`:''}<div class="trad-actions"><button class="primary" ${!connected()||!profile?.name?'disabled':''} onclick="ggTraditional.memberConfirm()">Sí, continuar con método C</button><button class="secondary" onclick="ggTraditional.membership(false)">No, continuar sin app</button></div><p class="trad-form-note">El QR de conexión no autoriza suministrar combustible. El método C utiliza un segundo QR de seguridad.</p>`);
 if(step==='loyalty')return wizard(`<div class="trad-step">Paso 1 de 3 · Fidelización</div><h2>¿Tienes tarjeta de fidelización?</h2><p>La fidelización es opcional. Si la tienes, registraremos su identificación en esta operación de demostración, sin acreditar puntos de ninguna compañía.</p><div class="trad-actions"><button class="primary" onclick="ggTraditional.loyalty(true)">Sí, identificar mi tarjeta</button><button class="secondary" onclick="ggTraditional.loyalty(false)">No, continuar</button></div><p class="trad-form-note">No introduzcas números reales de tarjeta. La tarjeta de prueba se registra únicamente en este navegador.</p>`);
 if(step==='loyalty-card')return wizard(`<div class="trad-step">Fidelización de prueba</div><h2>Identifica tu tarjeta de fidelización</h2><p>Introduce un código de prueba. Los puntos siguen gestionándose en la compañía correspondiente; este surtidor no los acredita.</p><label for="tradLoyaltyCard">Tarjeta ficticia</label><input id="tradLoyaltyCard" type="text" maxlength="12" autocomplete="off" placeholder="Ej. DEMO1234" value="${escapeText(traditionalDraft.cardId||'')}"><div class="trad-card"><strong>Identificación de demostración</strong><div class="trad-mini">La compañía debe confirmar la aceptación y los puntos. Este prototipo no consulta saldos.</div></div><button type="button" class="primary" style="width:100%" onclick="ggTraditional.confirmCard()">Continuar →</button>`);
 if(step==='amount')return wizard(`<div class="trad-step">Paso 2 de 3 · Configurar suministro</div><h2>¿Cuánto quieres repostar?</h2><p>Escoge el producto y fija el importe. Para llenar el depósito, se autorizará un máximo de 150 €, pero solo se cobrará lo suministrado.</p><label for="tradProduct">Producto</label><select id="tradProduct" onchange="ggTraditional.product(this.value)"><option value="gas" ${traditionalDraft.product==='gas'?'selected':''}>⛽ Gasolina 95 · 1,59 €/L</option><option value="diesel" ${traditionalDraft.product==='diesel'?'selected':''}>⛽ Diésel · 1,51 €/L</option><option value="ev" ${traditionalDraft.product==='ev'?'selected':''}>⚡ Electricidad · 0,35 €/kWh</option></select><label for="tradMode">Modalidad</label><select id="tradMode" onchange="ggTraditional.mode(this.value)"><option value="preset" ${!traditionalDraft.full?'selected':''}>Fijar importe</option><option value="full" ${traditionalDraft.full?'selected':''}>Llenar depósito / carga máxima · hasta 150 €</option></select><div id="tradAmountWrap" class="${traditionalDraft.full?'hide':''}"><label for="tradAmount">Importe máximo a autorizar (€)</label><input id="tradAmount" type="number" min="0.50" max="150" step="0.01" value="${traditionalDraft.amount}" inputmode="decimal" oninput="ggTraditional.amountInput(this.value)" required></div><div class="trad-card"><div class="trad-mini">Límite de la operación</div><strong id="tradLimit">${traditionalDraft.full?'150,00 €':euro(traditionalDraft.amount)}</strong><div class="trad-mini">El cobro definitivo se hará por el consumo real registrado.</div></div><button class="primary" style="width:100%" onclick="ggTraditional.setAmount()">Continuar a pago →</button>`);
 if(step==='card')return wizard(`<div class="trad-step">Paso 3 de 3 · Tarjeta</div><h2>Comprueba tu tarjeta</h2><p>Acerca tu tarjeta al lector del surtidor para comprobar fondos antes del suministro.</p><div class="trad-card"><strong>💳 Lector de tarjetas (simulado)</strong><div class="trad-mini">Producto: ${escapeText(traditionalProducts[traditionalDraft.product].fuel)}</div><div class="trad-mini">Importe máximo: ${euro(traditionalDraft.full?150:traditionalDraft.amount)}</div><div class="trad-mini">Fidelización: ${traditionalDraft.loyalty?'Activa':'No utilizada'}</div></div><div class="trad-warning">Demostración: no se leen tarjetas, no se comprueban saldos bancarios ni se retiene dinero real.</div><button class="primary" style="width:100%" onclick="ggTraditional.approveCard()">💳 Pasar tarjeta y comprobar fondos (demo)</button>`);
 if(step==='approved')return wizard(`<div class="trad-step">Pago autorizado</div><h2>Tarjeta verificada</h2><div class="trad-ok">✓ Comprobación ficticia de fondos completada. Máximo autorizado: ${euro(session.maxAmount)}.</div><p>El suministro se detendrá al alcanzar el límite. También puedes finalizarlo antes y pagarás únicamente la cantidad suministrada.</p><button class="primary" style="width:100%" onclick="ggTraditional.beginSupply()">Continuar al surtidor →</button>`);
}
function loyalty(v){traditionalDraft.loyalty=!!v;traditionalStep=v?'loyalty-card':'amount';paint()}
function confirmCard(){const v=String($('tradLoyaltyCard')?.value||'').trim().toUpperCase();if(!/^[A-Z0-9-]{4,12}$/.test(v)){alert('Utiliza entre 4 y 12 letras, números o guiones para una tarjeta ficticia.');return}traditionalDraft.cardId=v;traditionalStep='amount';paint()}

function product(v){if(traditionalProducts[v])traditionalDraft.product=v}
function mode(v){traditionalDraft.full=v==='full';const wrap=$('tradAmountWrap');if(wrap)wrap.classList.toggle('hide',traditionalDraft.full);const limit=$('tradLimit');if(limit)limit.textContent=traditionalDraft.full?'150,00 €':euro($('tradAmount')?.value||traditionalDraft.amount)}
function amountInput(v){if(!traditionalDraft.full){const limit=$('tradLimit');if(limit)limit.textContent=euro(Math.max(0,Number(v)||0));if(Number.isFinite(Number(v))&&Number(v)>0)traditionalDraft.amount=Number(v)}}
function setAmount(){const raw=$('tradAmount')?.value;const amount=traditionalDraft.full?150:Number(raw);if(!Number.isFinite(amount)||amount<.5||amount>150){alert('Introduce un importe entre 0,50 € y 150 €.');return}traditionalDraft.amount=Number(amount.toFixed(2));traditionalStep='card';paint()}
function approveCard(){if(traditionalStep!=='card')return;const product=traditionalProducts[traditionalDraft.product],maxAmount=traditionalDraft.full?150:traditionalDraft.amount;session={status:'authorized',sessionId:hexToken(),method:'traditional',vehicle:'Cliente sin GAS&GO',fuel:product.fuel,station:'Surtidor 02 · modo tradicional',amount:0,quantity:0,price:product.price,powerKW:product.powerKW,connector:product.connector,nonce:'',fallbackCode:'',finishedAt:null,clientReady:false,source:'traditional_guest',maxAmount,loyalty:traditionalDraft.loyalty,loyaltyCardId:traditionalDraft.loyalty?traditionalDraft.cardId:null,paymentStatus:'Fondos verificados (simulación)',loyaltyPoints:0};traditionalStep='approved';broadcast()}
function beginSupply(){if(traditionalStep!=='approved'||!guestMode()||session.status!=='authorized')return;traditionalStep=null;broadcast()}
function memberConfirm(){if(!connected()||!linkedProfile?.name){paint();return}const fuel=linkedProfile.fuel,ev=fuel==='Eléctrico';session={status:'awaiting_fallback',sessionId:hexToken(),method:'C',vehicle:linkedProfile.vehicle||'Vehículo GAS&GO',fuel,station:'GAS&GO · Surtidor 02',amount:0,quantity:0,price:ev?.35:fuel==='Diésel'?1.51:1.59,powerKW:ev?75:null,connector:ev?'CCS2':null,nonce:hexToken(),fallbackCode:String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),finishedAt:null,clientReady:true,source:'traditional_member',vehiclePlate:linkedProfile.vehiclePlate,maxAmount:linkedProfile.maxAmount,payment:linkedProfile.payment,loyalty:false,paymentStatus:'Pago ficticio automático'};traditionalStep=null;broadcast()}
function saveGuestPayment(){
 if(session.paymentStatus==='Pago ficticio completado')return;
 const key='gasgo_guest_operations_demo';let rows=[];
 try{rows=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(rows))rows=[]}catch(e){}
 const points=0,totalPts=0; // La wallet no asigna puntos de terceros sin confirmación del proveedor.
 session.loyaltyPoints=points;session.loyaltyTotal=totalPts;session.paymentStatus='Pago ficticio completado';
 rows.push({id:session.sessionId,date:new Date().toLocaleString('es-ES'),product:session.fuel,quantity:session.quantity,unit:isEV()?'kWh':'L',price:session.price,amount:session.amount,authorized:session.maxAmount,loyalty:session.loyalty,loyaltyCardId:session.loyaltyCardId||null,points});
 localStorage.setItem(key,JSON.stringify(rows.slice(-50)));
}
function guestFinishedInfo(){
 if(!guestMode()||session.status!=='finished')return '';
 return `<div class="trad-ok"><strong>✓ Cobro ficticio finalizado</strong><div style="margin-top:10px">Importe suministrado y cobrado: <b>${euro(session.amount)}</b></div><div>Máximo autorizado: ${euro(session.maxAmount)}</div><div>Diferencia no cobrada: ${euro(Math.max(0,session.maxAmount-session.amount))}</div>${session.loyalty&&session.loyaltyCardId?`<div>Tarjeta ficticia ${escapeText(session.loyaltyCardId)} identificada · puntos no acreditados</div>`:''}<div class="trad-mini" style="margin-top:8px">Movimiento guardado en este portátil. No hay cobro real ni sincronización con el móvil.</div></div>`;
}
const ggTraditional={cancel:cancelTraditional,membership,loyalty,confirmCard,product,mode,amountInput,setAmount,approveCard,beginSupply,memberConfirm};window.ggTraditional=ggTraditional;

// Enlace remoto: un único Netlify aloja la APP y el surtidor.
// PeerJS ofrece el canal WebRTC entre móvil y ordenador; Netlify sirve el sitio HTTPS.
const netlifyPumpMode=(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))&&!new URLSearchParams(location.search).has('gglocal');
let signalReconnectTimer=null,signalReconnectAttempts=0;
function remotePairURL(){const url=new URL('./index.html',location.href);url.search='';url.hash='';url.searchParams.set('ggpair',peerId);url.searchParams.set('ggentry','surtidor');return url.href}
function updateNetworkPanel(message,ready=false){
 const el=$('qrNetworkPanel');if(!el)return;
 el.classList.remove('hide');el.classList.toggle('connected',ready);
 $('qrNetworkStatus').textContent=message;
 const active=peerServiceStatus==='ready'&&peer?.open;
 $('qrLinkBadge').textContent=ready?'MÓVIL ENLAZADO':active?'QR ACTIVO':peerServiceStatus==='error'?'SIN CONEXIÓN':'CONECTANDO';
 $('qrLinkBadge').classList.toggle('linked',ready);
 if(!ready&&!active){$('qrNetworkCode').replaceChildren();$('qrNetworkUrl').removeAttribute('href');$('qrNetworkUrl').textContent='El enlace estará disponible cuando el surtidor esté conectado.';}
}
function paintRemoteQR(){
 const root=$('qrNetworkCode'), link=$('qrNetworkUrl');if(!root||!link)return;
 const url=remotePairURL();root.replaceChildren();link.href=url;link.textContent=url;
 if(typeof QRCode!=='function'){root.textContent='No se ha podido cargar el generador QR. Usa el enlace inferior.';return}
 try {new QRCode(root,{text:url,width:200,height:200,colorDark:'#063b30',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}
 catch(e){root.textContent='No se pudo generar el QR. Utiliza el enlace visible.'}
}
function initRemotePump(){
 clearTimeout(signalReconnectTimer);signalReconnectAttempts=0;
 setPeerServiceStatus('connecting');
 updateNetworkPanel('Iniciando el surtidor online…');
 if(typeof Peer!=='function'){setPeerServiceStatus('error');updateNetworkPanel('No carga PeerJS. Comprueba Internet o los bloqueadores y recarga.');return}
 try{peer=new Peer(peerId,{debug:0});}catch(e){setPeerServiceStatus('error');updateNetworkPanel('Error al iniciar la conexión: '+e.message);return}
 const activePeer=peer;
 function recoverSignaling(){
  if(peer!==activePeer||activePeer.destroyed)return;
  clearTimeout(signalReconnectTimer);
  setPeerServiceStatus('disconnected');
  if(signalReconnectAttempts>=3){updateNetworkPanel('No se ha recuperado el servicio de enlace. Pulsa «Generar nuevo QR».',connected());return}
  const delay=1500*Math.pow(2,signalReconnectAttempts++);
  updateNetworkPanel('Reconectando el surtidor con el servicio de enlace…',connected());
  signalReconnectTimer=setTimeout(()=>{
   if(peer!==activePeer||activePeer.destroyed||!activePeer.disconnected)return;
   try{activePeer.reconnect()}catch(e){recoverSignaling();return}
   signalReconnectTimer=setTimeout(()=>{
    if(peer!==activePeer||activePeer.open)return;
    if(activePeer.disconnected){recoverSignaling();return}
    setPeerServiceStatus('error');updateNetworkPanel('El servicio de enlace no responde. Pulsa «Generar nuevo QR» para volver a intentarlo.',connected());
   },8000);
  },delay);
 }
 peer.on('open',id=>{
  if(peer!==activePeer)return;
  clearTimeout(signalReconnectTimer);signalReconnectAttempts=0;
  peerId=id;setPeerServiceStatus('ready','Surtidor online. Esperando móvil.');
  paintRemoteQR();updateNetworkPanel(connected()?'Móvil conectado.':'Escanea el QR con la cámara normal del móvil.',connected());
 });
 peer.on('connection',c=>{
  if(peer!==activePeer){c.close();return}
  if(connection?.open){c.on('open',()=>{c.send({type:'notice',message:'Este surtidor está ocupado.'});c.close()});return}
  handleConnection(c);
  updateNetworkPanel('Móvil localizado. Abriendo la comunicación entre dispositivos…');
  c.on('open',()=>{
    if(peer!==activePeer||connection!==c)return;
    updateNetworkPanel('Móvil conectado. Autenticando el vehículo…',true);
    $('qrLinkBadge').textContent='MÓVIL ENLAZADO';
  });
  c.on('close',()=>{
    if(peer!==activePeer||connection&&connection!==c)return;
    updateNetworkPanel('Móvil desconectado. Escanea el QR para volver a conectar.');
    if(peer?.open)paintRemoteQR();
  });
 });
 peer.on('error',e=>{
  if(peer!==activePeer)return;
  setPeerServiceStatus('error');
  const t=String(e?.type||'');
  console.warn('GAS&GO PeerJS surtidor:',e);
  if(t==='unavailable-id'){updateNetworkPanel('Otro surtidor utiliza este código. Pulsa «Generar nuevo QR».');return}
  updateNetworkPanel('Conexión no disponible ('+(t||'red')+'). Comprueba la red y genera otro QR.',connected());
 });
 peer.on('disconnected',recoverSignaling);
}
$('qrNetworkRefresh')?.addEventListener('click',()=>{if(connected()){if(!confirm('¿Desvincular el móvil y cambiar el QR?'))return;try{connection.close()}catch(e){}connection=null;reset()}
 try{peer?.destroy()}catch(e){}peer=null;code=hexToken().slice(0,16);peerId='gg-p-'+code;initRemotePump()});

// DEMO local: la comunicación usa window.postMessage entre las dos pestañas
// abiertas desde el mismo navegador; el surtidor se abre automáticamente desde la APP DEMO.
function localSend(data){if(window.opener&&!window.opener.closed)window.opener.postMessage({gasgoLocal:258,data},'*')}
function localConnect(){
 if(!window.opener||window.opener.closed){
  connection=null;setPeerServiceStatus('error','Abre esta pantalla pulsando el botón desde GAS&GO.');paint();return;
 }
 if(!connection||!connection.open)connection={open:true,send:localSend,close:()=>{connection=null;paint()}};
 setPeerServiceStatus('ready','Enlace local disponible en este ordenador.');
 paint();localSend({type:'request-profile'});broadcast();
}
window.addEventListener('message',ev=>{
 if(ev.source!==window.opener||!ev.data||ev.data.gasgoLocal!==258)return;
 if(ev.data.type==='helloLocal'){localConnect();localSend({type:'readyLocal'});return;}
 if(ev.data.data){if(!connected())localConnect();answer(ev.data.data)}
});
window.addEventListener('beforeunload',()=>{halt();localSend({type:'closedLocal'})});
function initialize(){if(netlifyPumpMode){initRemotePump();return}localConnect();localSend({type:'readyLocal'})}
initialize();paint();

})();
