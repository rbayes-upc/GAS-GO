'use strict';
(function(){
const $=id=>document.getElementById(id);
let peer=null,connection=null,remoteState=null,overlayMode=null,cameraStream=null,scanFrame=null,pendingStation=null,isConnecting=false,currentScannerMode=null,connTimer=null,operationStation=null,peerInitPromise=null,lastTarget=null;
const fmt=n=>Number(n||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const isLinked=()=>!!connection?.open&&(connection.local!==true||!!(localPumpWindow&&!localPumpWindow.closed));
let localPumpWindow=null,localPendingId=null,localReady=false,localWindowTimer=null,qrEntryActive=false;
function currentProfile(){const pp=data.profile||{},cv=data.customVehicle||{};return {profileName:[pp.first,pp.last].filter(Boolean).join(' ').trim()||'Usuario GAS&GO',vehicle:data.vehicle||cv.name||'Vehículo registrado',fuel:data.fuel||cv.fuel||'Gasolina 95',vehicleName:cv.name||data.vehicle||'Vehículo registrado',vehicleModel:cv.model||'',vehiclePlate:cv.plate||'',vehicleEmoji:cv.emoji||'',vehicleDetected:[cv.name||data.vehicle||'Vehículo registrado',cv.model||'',cv.plate||''].filter(Boolean).join(' · ')}}
function reportProfile(){if(isLinked())connection.send({type:'profile',...currentProfile()})}
const safe=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const log=msg=>{const el=$('ggFeedback');if(el)el.textContent=msg};
const actionText={idle:'Disponible',verifying:'Verificando',awaiting_confirmation:'Confirmación necesaria',awaiting_fallback:'Verificación alternativa',authorized:'Autorizado',fueling:'Suministrando',paused:'Pausado',finished:'Finalizado',emergency:'Suministro detenido'};
function upsertConnectButton(){const nav=document.querySelector('.top-actions');if(nav&&!$('ggv2ConnectBtn')){const button=document.createElement('button');button.id='ggv2ConnectBtn';button.type='button';button.className='iconbutton';button.title='Vincular surtidor';button.setAttribute('aria-label','Vincular surtidor virtual');button.style.fontSize='21px';button.textContent='🔗';button.addEventListener('click',openPair);nav.prepend(button)}const b=$('ggv2ConnectBtn');if(b){b.classList.toggle('ggv2-online',isLinked());b.title=isLinked()?'Surtidor virtual conectado':typeof inPresentationDemo==='function'&&inPresentationDemo()?'Abrir surtidor DEMO local':'Vincular surtidor virtual'}syncLinkUI()}
function show(content,mode='pair'){stopCamera();overlayMode=mode;let wrap=$('ggv2Overlay');if(!wrap){wrap=document.createElement('div');wrap.id='ggv2Overlay';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');document.body.append(wrap)}wrap.innerHTML=`<div class="ggv2-card"><div class="ggv2-head"><div class="ggv2-brand">⛽ GAS<span>&</span>GO</div><button id="ggv2X" type="button" aria-label="Cerrar ventana" onclick="ggv2.close()">×</button></div>${content}</div>`;document.body.classList.add('ggv2-lock');$('ggv2X')?.focus({preventScroll:true})}
function close(){stopCamera();overlayMode=null;$('ggv2Overlay')?.remove();document.body.classList.remove('ggv2-lock');}
function showProblem(message){log(message);const box=$('ggv2Alert');if(box){box.textContent=message;box.classList.remove('hide')}if(overlayMode==='connecting'){
 const card=$('ggv2Overlay')?.querySelector('.ggv2-card');if(card&&!$('ggv250Retry'))card.insertAdjacentHTML('beforeend',`<button id="ggv250Retry" class="ggv2-main" type="button" onclick="ggv2.retry()">Reintentar conexión</button><button class="ggv2-alt" type="button" onclick="ggv2.close()">Entrar sin conectar el surtidor</button>`)
 }}
function syncLinkUI(){const chip=$('ggv250PairHint');if(!chip)return;chip.classList.toggle('hide',!isLinked()&&!isConnecting);chip.classList.toggle('ggv250-waiting',!isLinked());chip.textContent=isLinked()?'✓ Surtidor 02 vinculado automáticamente.':'Conectando con el surtidor…'}
function pairErrorMessage(error){
 const type=String(error?.type||'').toLowerCase();
 if(type==='peer-unavailable')return 'Surtidor no disponible: el código del QR ya no está activo. Mantén el portátil abierto y escanea el QR NUEVO que aparece ahora en pantalla.';
 if(type==='network'||type==='server-error'||type==='socket-error'||type==='disconnected')return 'No se puede contactar con el servicio PeerJS. Comprueba Internet, cambia de red o prueba compartiendo los datos del móvil con el portátil.';
 if(type==='browser-incompatible')return 'Este navegador no admite la conexión WebRTC. Abre el enlace en Chrome o Safari actualizado.';
 if(type==='invalid-id'||type==='invalid-key')return 'Identificador de conexión no válido. Recarga el surtidor para obtener un QR nuevo.';
 return 'No se ha podido completar el enlace entre dispositivos. Prueba otra red y escanea un QR recién generado.';
}
function retry(){if(lastTarget){if(connection&&!connection.open){try{connection.close()}catch(e){}}connection=null;isConnecting=false;connect(lastTarget)}else openPair()}

function openPair(){if(!qrEntryActive&&typeof inPresentationDemo==='function'&&inPresentationDemo()){openLocalPump(9001);return}if(isLinked()){show(`<h2>Dispositivos vinculados</h2><p>El móvil está conectado con el surtidor virtual del portátil.</p><div class="ggv2-success">● Conexión activa</div><button class="ggv2-alt" onclick="ggv2.unlink()">Desvincular</button>`, 'paired');return}
 show(`<h2>Conectar con el surtidor</h2><p>Escanea con la cámara del móvil el <b>QR de vinculación</b> que aparece en el ordenador. Esto conecta los dispositivos, pero no autoriza un repostaje.</p><button class="ggv2-main" onclick="ggv2.scanPair()">▣ Abrir cámara y escanear QR</button><div class="ggv2-separator">o introduce el código del portátil</div><label for="ggv2Code">Código de vinculación</label><input id="ggv2Code" type="text" autocapitalize="characters" autocomplete="off" maxlength="32" placeholder="GG-XXXX-XXXX-XXXX-XXXX" value=""><button class="ggv2-alt" onclick="ggv2.pairManual()">Vincular con código</button><div id="ggv2Alert" class="ggv2-alert hide" role="alert"></div><p class="ggv2-note">La cámara requiere abrir esta aplicación desde una dirección HTTPS en Chrome, Safari o Firefox, no desde la vista de un archivo de WhatsApp.</p>`, 'pair')}
function parsePeer(input){const raw=String(input||'').trim();if(!raw)return null;try{const u=new URL(raw);const p=u.searchParams.get('ggpair');if(p)return parsePeer(p)}catch(e){}const compact=raw.toUpperCase().replace(/[^A-Z0-9]/g,'');if(compact.startsWith('GGP')&&compact.length===19&&/^[0-9A-F]+$/.test(compact.slice(3)))return 'gg-p-'+compact.slice(3);if(compact.startsWith('GG')&&compact.length===18&&/^[0-9A-F]+$/.test(compact.slice(2)))return 'gg-p-'+compact.slice(2);if(/^gg-p-[a-f0-9]{16}$/i.test(raw))return raw.toLowerCase();return null}
function startPeer(){
 if(peer?.open)return Promise.resolve(peer);
 if(peerInitPromise)return peerInitPromise;
 if(typeof Peer!=='function')return Promise.reject(Error('La biblioteca PeerJS no se ha cargado. Comprueba Internet y que el navegador no bloquee cdn.jsdelivr.net.'));
 peerInitPromise=new Promise((resolve,reject)=>{
  const p=new Peer(undefined,{debug:0});peer=p;let complete=false;
  const timeout=setTimeout(()=>fail('El servicio de enlace tarda demasiado. Prueba de nuevo.'),13000);
  function fail(message){if(complete)return;complete=true;clearTimeout(timeout);peerInitPromise=null;if(peer===p)peer=null;try{p.destroy()}catch(e){}reject(Error(message))}
  p.on('open',()=>{if(complete)return;complete=true;clearTimeout(timeout);peerInitPromise=null;resolve(p)});
  p.on('error',err=>{console.warn('PeerJS:',err);
   if(!p.open){fail(pairErrorMessage(err));return}
   if(isConnecting&&connection&&!connection.open){
     clearTimeout(connTimer);connTimer=null;isConnecting=false;
     showProblem(pairErrorMessage(err));syncLinkUI();
     try{connection.close()}catch(e){}
   }
  });
  p.on('disconnected',()=>{if(!isLinked())upsertConnectButton()});
 });
 return peerInitPromise;
}
async function connect(id){if(isLinked()){close();return}if(isConnecting)return;const target=parsePeer(id);if(!target){showProblem('El código o el QR no corresponde a un surtidor GAS&GO válido.');return}
 lastTarget=target;isConnecting=true;syncLinkUI();stopCamera();show(`<h2>Conectando dispositivos</h2><p>Buscando el surtidor en el portátil…</p><div class="ggv2-spinner" aria-hidden="true"></div><p id="ggFeedback" class="ggv2-note">Esperando el servicio PeerJS y la respuesta del surtidor. Esta vinculación NO usa la contraseña de inicio de sesión.</p><div id="ggv2Alert" class="ggv2-alert hide"></div><p class="ggv2-note">Si falla la conexión, podrás reintentar o explorar GAS&GO sin enlazar el surtidor.</p>`,'connecting');
 try{const p=await startPeer();const c=p.connect(target,{reliable:true,serialization:'json'});connection=c;const timer=setTimeout(()=>{if(connection===c&&!c.open){showProblem('No hay respuesta del surtidor. Puede ser un QR antiguo o una red que bloquea WebRTC. Genera un QR nuevo y prueba con ambos dispositivos conectados al mismo Wi-Fi.');isConnecting=false;syncLinkUI();c.close()}},17000);connTimer=timer;
 c.on('open',()=>{clearTimeout(timer);connTimer=null;isConnecting=false;if(connection!==c)return;upsertConnectButton();c.send({type:'hello',version:2,...currentProfile()});close();toast('✓ Móvil vinculado al surtidor');if(pendingStation!==null){const id=pendingStation;pendingStation=null;setTimeout(()=>startConnectedOperation(id),650)}});
 c.on('data',handleData);c.on('close',()=>{if(connection!==c)return;connection=null;clearTimeout(timer);connTimer=null;isConnecting=false;upsertConnectButton();if(remoteState?.status==='fueling')toast('Conexión perdida. El surtidor detendrá el suministro.');if((overlayMode==='connecting'||overlayMode==='session')&&!$('ggv2Alert')?.textContent)showProblem('Conexión con el portátil interrumpida. Vuelve a vincular mediante QR.')});
 c.on('error',e=>{clearTimeout(timer);isConnecting=false;syncLinkUI();showProblem(pairErrorMessage(e)+(e?.type?' · '+e.type:''))});
 }catch(e){isConnecting=false;syncLinkUI();showProblem(e.message||'No fue posible vincular los dispositivos')}
}
function pairManual(){connect($('ggv2Code')?.value||'')}
function unlink(){connection?.close();connection=null;remoteState=null;pendingStation=null;lastTarget=null;upsertConnectButton();close();toast('Dispositivos desvinculados')}
function requestScan(mode){if(!navigator.mediaDevices?.getUserMedia){showProblem('La cámara requiere HTTPS y permisos del navegador. Abre la web publicada en Chrome o Safari.');return}
 if(typeof jsQR!=='function'){showProblem('No se ha cargado el lector QR. Comprueba Internet o usa el código manual.');return}
 currentScannerMode=mode;const caption=mode==='pair'?'Escanea el QR del portátil':'Escanea el QR de seguridad del surtidor';
 show(`<h2>${caption}</h2><p>Permite el acceso a la cámara y enfoca el QR dentro del recuadro.</p><div class="ggv2-camera"><video id="ggv2Video" autoplay playsinline muted></video><div class="ggv2-reticle" aria-hidden="true"></div></div><p id="ggFeedback" class="ggv2-note">Solicitando permiso para usar la cámara…</p><div id="ggv2Alert" class="ggv2-alert hide"></div><button class="ggv2-alt" onclick="ggv2.stopScan()">Volver</button>`,mode==='pair'?'scanPair':'scanVerify');
 navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false}).then(stream=>{if(!['scanPair','scanVerify'].includes(overlayMode)){stream.getTracks().forEach(t=>t.stop());return}cameraStream=stream;const video=$('ggv2Video');video.srcObject=stream;video.play().then(()=>{log('Apunta al código QR.');scanning(video,mode)}).catch(e=>showProblem('No se pudo iniciar la vista de cámara: '+e.message))}).catch(e=>showProblem('No se pudo abrir la cámara ('+e.name+'). Concede el permiso o introduce el código manual.'))}
function scanning(video,mode){const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d',{willReadFrequently:true});let last=0;const step=now=>{if(!cameraStream||!['scanPair','scanVerify'].includes(overlayMode))return;if(now-last>130&&video.readyState>=2&&video.videoWidth){last=now;const w=Math.min(640,video.videoWidth),h=Math.round(video.videoHeight*w/video.videoWidth);canvas.width=w;canvas.height=h;ctx.drawImage(video,0,0,w,h);const pixels=ctx.getImageData(0,0,w,h);const found=jsQR(pixels.data,w,h,{inversionAttempts:'dontInvert'});if(found){const raw=found.data;stopCamera();if(mode==='pair'){const id=parsePeer(raw);if(id){connect(id);return}showProblem('Ese no es el QR de vinculación de GAS&GO.');return}if(/^GGVERIFY:/i.test(raw)){const parts=raw.split(':');verifyCode(null,parts[1],parts[2]);return}showProblem('Ese QR no corresponde a la verificación del surtidor.');return}}scanFrame=requestAnimationFrame(step)};scanFrame=requestAnimationFrame(step)}
function stopCamera(){if(scanFrame!==null)cancelAnimationFrame(scanFrame);scanFrame=null;if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;const video=$('ggv2Video');if(video)video.srcObject=null}
function stopScan(){stopCamera();if(currentScannerMode==='verify')showSession();else openPair()}
function send(type,payload={}){if(!isLinked()){toast('Primero conecta con el surtidor');return false}connection.send({type,sessionId:remoteState?.sessionId||'',...payload});return true}
function statusScreen(){const s=remoteState;if(!s)return '<p>Esperando la respuesta del surtidor…</p>';
 const label=actionText[s.status]||s.status;
 let result=`<h2>Surtidor 02</h2><p class="ggv2-state">● ${safe(label)}</p><p class="ggv2-note">${safe(s.vehicle||data.vehicle||'Vehículo seleccionado')} · ${safe(s.fuel||data.fuel||'')}</p>`;
 if(s.status==='awaiting_confirmation')result+=`<p>Confirma que estás frente al <b>Surtidor 02</b> antes de autorizar el suministro.</p><button class="ggv2-main" onclick="ggv2.confirm()">Confirmar Surtidor 02</button>`;
 else if(s.status==='awaiting_fallback')result+=(typeof inPresentationDemo==='function'&&inPresentationDemo()?`<p>Verificación alternativa: introduce los seis dígitos que aparecen en el surtidor DEMO. No hace falta utilizar la cámara.</p>`:`<p>El sistema necesita una verificación alternativa. Escanea el <b>QR de seguridad</b> del surtidor.</p><button class="ggv2-main" onclick="ggv2.scanVerify()">▣ Escanear QR de seguridad</button><div class="ggv2-separator">o introduce el código temporal</div>`)+`<label for="ggv2Verify">Código del surtidor</label><input id="ggv2Verify" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="000000"><button class="ggv2-alt" onclick="ggv2.verifyManual()">Validar código</button>`;
 else if(s.status==='verifying')result+='<p>La estación está comprobando la autorización. No necesitas realizar ninguna acción.</p>';
 else if(s.status==='authorized')result+=`<div class="ggv2-success">✓ ${s.fuel==='Eléctrico'?'Punto de carga autorizado. Puedes iniciar la recarga desde el portátil.':'Surtidor autorizado. Puedes repostar desde el portátil.'}</div>`;
 else if(s.status==='fueling'||s.status==='paused')result+=`<p>${s.fuel==='Eléctrico'?'La recarga':'El repostaje'} se controla desde el portátil. ${s.status==='paused'?'Operación pausada.':'Puedes cerrar esta ventana.'}</p>`;
 else if(s.status==='emergency')result+='<div class="ggv2-alert">Se ha detenido el suministro ficticio por seguridad. El operador debe restablecer el surtidor.</div>';
 else if(s.status==='finished')result+='<div class="ggv2-success">Operación finalizada. Puedes consultar el recibo en Historial.</div>';
 else result+='<p>El surtidor está esperando una nueva operación.</p>';
 return result+'<div id="ggv2Alert" class="ggv2-alert hide" role="alert"></div>';
}
function showSession(){if(!isLinked()){openPair();return}show(statusScreen(),'session')}
function showState(){if(typeof inPresentationDemo==='function'&&inPresentationDemo()){const st=remoteState?.status;if(['awaiting_confirmation','awaiting_fallback'].includes(st)){showSession();return}if(overlayMode==='session')close();return}if(overlayMode==='scanVerify'||overlayMode==='scanPair'||overlayMode==='pair'||overlayMode==='connecting')return;
 const st=remoteState?.status;if(['awaiting_confirmation','awaiting_fallback'].includes(st)){showSession();return}
 if(st==='authorized'&&overlayMode==='session'){close();toast('✓ Surtidor autorizado. Ya puedes repostar.')}
 else if(st==='finished'){close()}
 else if(overlayMode==='session'){showSession()}
}
function handleData(msg){if(!msg||typeof msg!=='object')return;if(msg.type==='request-profile'){reportProfile();return}if(msg.type==='notice'){toast(String(msg.message||'Información del surtidor'));return}
 if(msg.type==='state'&&msg.state){const before=remoteState;remoteState=msg.state;
 if(remoteState.status==='finished')saveReceipt(remoteState);
 else if(remoteState.status==='authorized'&&before?.status!==remoteState.status){toast('✓ Surtidor autorizado')}
 if(remoteState.status==='emergency'&&before?.status!==remoteState.status)toast('Suministro detenido en el surtidor');showState();upsertConnectButton()}}
function startConnectedOperation(id){const s=STATIONS.find(st=>st.id===id);if(!s){toast('Estación no disponible');return}
 const fuel=data.fuel||'Gasolina 95',isEV=fuel==='Eléctrico',valid=isEV?s.ev>0:fuel==='Diésel'?s.diesel!=null:s.gas!=null,free=isEV?s.evFree:s.free;
 if(!valid){toast('La estación no admite el suministro de tu vehículo');return}if(!(free>0)){toast('No quedan puntos libres de este servicio');return}
 if(!isLinked()){pendingStation=id;openPair();return}
 if(remoteState&& !['idle','finished'].includes(remoteState.status)){toast(remoteState.status==='busy'?'El surtidor está ocupado con un repostaje tradicional.':'Hay una operación en curso. Termínala en el surtidor.');if(remoteState.status!=='busy')showSession();return}
 operationStation={id:s.id,name:s.name,area:s.area,lat:s.lat,lng:s.lng};reportProfile();const price=isEV?s.ev:fuel==='Diésel'?s.diesel:s.gas;
 const walletMatch=window.GGWallet?GGWallet.chooseForStation(s):null;const walletCard=walletMatch?.card||null;
 selectedStation=null;render();if(!(typeof inPresentationDemo==='function'&&inPresentationDemo()))show(`<h2>Conectando con el surtidor</h2><p>El portátil está recibiendo la llegada del vehículo.</p><div class="ggv2-spinner"></div><div id="ggv2Alert" class="ggv2-alert hide"></div>`,'session');
 const selectedPower=isEV&&window.ggTiming?window.ggTiming.plan(s).kw:null;const cv=data.customVehicle||{};
 send('arrival',{vehicle:data.vehicle,vehicleName:cv.name||data.vehicle,vehicleModel:cv.model||'',vehiclePlate:cv.plate||'',vehicleDetected:[cv.name||data.vehicle,cv.model||'',cv.plate||''].filter(Boolean).join(' · '),fuel,station:s.name,price,loyaltyProgram:walletCard?.provider||null,loyaltyCardRef:walletCard?.id||null,loyaltyCardSuffix:walletCard?.memberCode?.slice(-4)||null,powerKW:isEV?Number(selectedPower||s.evPowerPublished||s.kw||75):null,
 powerSource:isEV&&s.evOrigin==='ripree'&&selectedPower?'ripree':'demo'});
}
function confirmPump(){send('confirm')}
function verifyCode(code,sessionId=null,nonce=null){if(!remoteState){showProblem('No hay una operación abierta');return}if(sessionId&&remoteState.sessionId!==sessionId){showProblem('Ese QR corresponde a otra sesión. Escanea el QR actual.');return}
 if(nonce){send('verify',{nonce});show(`<h2>Verificando QR</h2><p>Esperando respuesta del surtidor…</p><div class="ggv2-spinner"></div><div id="ggv2Alert" class="ggv2-alert hide"></div>`,'session')}
 else{const typed=String(code||'').replace(/\s+/g,'');if(!/^\d{6}$/.test(typed)){showProblem('Introduce los 6 dígitos del surtidor');return}send('verify',{code:typed});log('Validando código…')}}
function verifyManual(){verifyCode($('ggv2Verify')?.value)}
function saveReceipt(s){if(!s.sessionId||!s.quantity||!s.vehicle)return;
 const id='GG2-'+s.sessionId;if((data.history||[]).some(h=>h.id===id)){return}const lock='ggv2_saved_'+id;
 if(localStorage.getItem(lock))return;
 const r={id,invoiceNumber:'SIM-2026-'+String((data.history||[]).length+1).padStart(5,'0'),date:new Date(s.finishedAt||Date.now()).toLocaleString('es-ES'),station:s.station||'GAS&GO Surtidor 02',stationId:operationStation?.name===s.station?operationStation.id:null,stationArea:operationStation?.name===s.station?operationStation.area:null,stationLat:operationStation?.name===s.station?operationStation.lat:null,stationLng:operationStation?.name===s.station?operationStation.lng:null,pump:'Surtidor 02',amount:Number(s.amount)||0,subtotal:Number(s.subtotal??s.amount)||0,discount:Number(s.discount||0),promoId:s.promoId||null,promoLabel:window.GGRewards?.label(s.promoId)||'',unitPrice:Number(s.price)||0,liters:s.fuel==='Eléctrico'?0:Number(s.quantity)||0,energy:s.fuel==='Eléctrico'?Number(s.quantity)||0:0,powerKW:s.fuel==='Eléctrico'?Number(s.powerKW||75):null,vehicle:s.vehicle,plate:data.customVehicle?.plate||'DEMO',payment:data.payment,fuel:s.fuel==='Eléctrico'?'Electricidad':s.fuel,paymentStatus:'Pago ficticio completado',customer:data.profile?data.profile.first+' '+data.profile.last:DEMO_FISCAL.customer,customerNif:data.profile?.dni||DEMO_FISCAL.customerNif,customerAddress:data.profile?.address||DEMO_FISCAL.customerAddress};
 r.loyaltyProvider=s.loyaltyProgram||null;r.loyaltyCardRef=s.loyaltyCardRef||null;r.loyaltyStatus=s.loyaltyCardRef?'Identificación de fidelización simulada · sin puntos oficiales':null;if(window.GGWallet){GGWallet.record(r,s);};data.history.push(r);save();localStorage.setItem(lock,'1');if(page!=='Bienvenida'&&page!=='Registro'){go('Home');showRepostNotification(r.amount)}else toast('Operación completada: '+fmt(r.amount));
}
// V2.5.9 · Enlace local con apertura automática del surtidor DEMO y sin modal en la APP.
function localSend(data){if(localPumpWindow&&!localPumpWindow.closed){localPumpWindow.postMessage({gasgoLocal:258,data},'*');return true}return false}
function releaseLocalConnection(){if(!connection?.local)return;connection=null;remoteState=null;localReady=false;upsertConnectButton()}
function openLocalPump(id){
 if(typeof inPresentationDemo!=='function'||!inPresentationDemo()){openPair();return}
 localPendingId=id;
 let w;
 try{w=window.open('./surtidor-demo.html?gglocal=1','gasgo-surtidor-demo','width=1080,height=880')}catch(e){}
 if(!w){toast('El navegador ha bloqueado la pestaña. Permite ventanas emergentes para esta APP.');return}
 localPumpWindow=w;
 if(connection?.local){connection=null;remoteState=null;localReady=false}
 close();
 const ping=()=>localSend({type:'helloLocal'});
 ping();clearInterval(localWindowTimer);let attempts=0;
 localWindowTimer=setInterval(()=>{
   if(localReady||!localPumpWindow||localPumpWindow.closed){clearInterval(localWindowTimer);localWindowTimer=null;if(!localReady)toast('La pestaña del surtidor se ha cerrado. Vuelve a abrir el modo DEMO.');return}
   if(++attempts>25){clearInterval(localWindowTimer);localWindowTimer=null;toast('No responde el surtidor local. Cierra su pestaña y vuelve a abrir el modo DEMO.');return}
   ping();
 },350);
}
window.addEventListener('message',event=>{
 if(!localPumpWindow||event.source!==localPumpWindow||event.data?.gasgoLocal!==258)return;
 const msg=event.data.data||{};
 if(msg.type==='readyLocal'){
  if(localReady)return;
  localReady=true;clearInterval(localWindowTimer);localWindowTimer=null;
  connection={open:true,local:true,send:localSend,close:()=>{releaseLocalConnection()}};
  remoteState=null;upsertConnectButton();reportProfile();
  const id=localPendingId;localPendingId=null;
  if(id!=null)setTimeout(()=>startConnectedOperation(id),100);
  return;
 }
 if(msg.type==='closedLocal'){releaseLocalConnection();return}
 if(!isLinked())return;
 handleData(msg);
});
setInterval(()=>{if(connection?.local&&localPumpWindow?.closed){releaseLocalConnection();toast('Se ha cerrado el surtidor DEMO')}},1200);
const formerStart=window.start;
window.start=function(id){if(typeof inPresentationDemo==='function'&&inPresentationDemo())return openLocalPump(id);startConnectedOperation(id)};
window.ggv2={close,openPair,pairManual,retry,refreshLinkUI:syncLinkUI,scanPair:()=>requestScan('pair'),scanVerify:()=>requestScan('verify'),stopScan,confirm:confirmPump,verifyManual,showSession,unlink};
upsertConnectButton();
// Acceso directo desde el QR físico: abre GAS&GO y enlaza automáticamente.
// No solicita elegir modo FULL/DEMO ni escanear un segundo código.
function bootstrapPumpQRCode(){
 const params=new URLSearchParams(location.search);
 if(params.get('ggentry')!=='surtidor')return;
 const target=parsePeer(params.get('ggpair'));
 if(!target){toast('El QR del surtidor no es válido. Escanea uno nuevo.');return}
 qrEntryActive=true;
 // Usar una estación de demostración interna; sin abrir una segunda pestaña de surtidor.
 if(typeof setDemoStation==='function'){
  data.presentationDemo=true;
  setDemoStation();save();
 }
 // Si este dispositivo ya tiene un vehículo, conservamos sus datos;
 // si es una primera visita, el prototipo usa el perfil ficticio como demostración.
 if(!data.profile||!data.customVehicle){
  if(typeof useDemoProfile==='function')useDemoProfile();
 }else{go('Home')}
 // La conexión WebRTC la inicia automáticamente la APP desde el QR.
 pendingStation=9001;
 setTimeout(()=>connect(target),150);
}
bootstrapPumpQRCode();



})();
