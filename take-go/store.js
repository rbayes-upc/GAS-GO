(function(){'use strict';
const U=TakeGoUI,E=TakeGoExperience,$=s=>document.querySelector(s);
let link=new URLSearchParams(location.search).get('session');if(!/^[a-f0-9-]{36}$/i.test(link||''))link=crypto.randomUUID();history.replaceState(null,'','?session='+link);
$('.wordmark').href='./index.html?session='+link;
const key='takego_store_v1_'+link,channel=new BroadcastChannel('takego_v1_'+link);
let engine,category='Todo',receipt=null,lastSeen=0,active=false,lastAnnounced=null;
const connected=()=>lastSeen>0&&Date.now()-lastSeen<6000;
$('#openCustomer').onclick=()=>window.open('./index.html?session='+link,'takego-customer-'+link);
const labels={ready:'Tu próxima visita empieza aquí.',identifying:'Te estamos identificando…',confirmation:'Confirma la entrada en la app.',code:'Tu código temporal de entrada.',shopping:'Identificado. Puedes entrar.',reviewing:'Estamos verificando un producto.',exiting:'Comprobando la salida…',paying:'Procesando el pago. Espera la confirmación.',limit_exceeded:'Esta cesta supera un tope.',payment_failed:'Pago no completado. No hay cargo.',complete:'Compra pagada. Puedes salir.',left_empty:'Has salido sin compra. Sin cargo.'};
const describe={identifying:'Método A automático · proximidad e identidad de demostración.',confirmation:'Método B alternativo · la app solicita una confirmación de identidad.',code:'Método C alternativo · escribe este código en la app del cliente.',shopping:'Coge o devuelve productos. Puedes guardar el móvil durante el recorrido automático.',reviewing:'Repite la lectura simulada o devuelve el producto. No se iniciará un pago hasta contrastar la cesta.',exiting:'Cámara y RFID deben coincidir antes del cobro.',paying:'La cesta queda cerrada durante este pago simulado.',limit_exceeded:'Devuelve productos directamente con «Devolver». También puedes ajustar los topes en Perfil.',payment_failed:'Elige el método para esta compra y reintenta, o revisa y devuelve productos.',complete:'La factura está guardada. Esta compra no se volverá a cobrar.',left_empty:'No se ha generado factura ni pago.'};
function postState(){channel.postMessage({type:'state',state:engine.publicState()})}
function publish(){localStorage.setItem(key,JSON.stringify(engine.snapshot()));postState();render()}
function access(){
 const s=engine.state,description=s.phase==='ready'?(s.profile?'Pulsa «Entrar» para simular tu llegada. La tienda confirmará el acceso.':'Abre la app del cliente y pulsa «Probar TAKE&GO» para acreditar un perfil ficticio.'):describe[s.phase];
 const markup=`<section class="access-card access-${s.phase}"><div class="access-icon">${U.icon(['complete','shopping'].includes(s.phase)?'check':'shield')}</div><div><h3>${labels[s.phase]}</h3><p>${description}</p></div>${s.phase==='ready'?`<button class="button primary" data-action="enter" ${!s.profile||!connected()?'disabled':''}>Entrar a la tienda ${U.icon('arrow')}</button>`:''}${s.phase==='code'?'<span class="access-code">'+U.esc(s.code)+'</span>':''}${['identifying','exiting','paying'].includes(s.phase)?'<span class="spinner"></span>':''}${['complete','left_empty'].includes(s.phase)?'<button class="button primary" data-action="new">Nueva visita '+U.icon('arrow')+'</button>':''}</section>`;
 if($('#accessPanel').innerHTML!==markup)$('#accessPanel').innerHTML=markup;
 if(lastAnnounced!==s.phase){lastAnnounced=s.phase;if($('#voiceAnnouncements').checked&&'speechSynthesis' in window){speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(labels[s.phase]);speech.lang='es-ES';speechSynthesis.speak(speech)}}
}
function render(){
 const s=engine.state,b=engine.basket(),busy=!['ready','complete','left_empty'].includes(s.phase);$('#authMethod').disabled=busy;
 renderConnection();access();
 $('#catalogTabs').innerHTML=['Todo','Bebidas','Para picar'].map(c=>`<button data-category="${c}" class="${category===c?'active':''}" aria-pressed="${category===c}">${c}</button>`).join('');
 $('#catalog').innerHTML=TakeGo.PRODUCTS.filter(p=>category==='Todo'||p.category===category).map(p=>{const stock=s.units.filter(u=>u.sku===p.id&&u.vision.location==='shelf'&&u.rfid.location==='shelf').length;return `<article class="product-card"><span class="stock">${stock} disponibles</span><div class="product-visual">${U.art(p)}</div><h3>${p.name}</h3><p>${p.detail}</p><div class="row"><span class="price">${U.money(p.cents)}</span><button class="button primary" data-action="pick" data-sku="${p.id}" ${s.phase!=='shopping'||!stock?'disabled':''}>${U.icon('plus')} Coger</button></div></article>`}).join('');
 const returnable=['shopping','reviewing','limit_exceeded'].includes(s.phase),paid=s.phase==='complete';
 const rows=b.rows.map(p=>E.row(p,{returnable})).join('');
 let controls='';
 if(['shopping','reviewing','limit_exceeded'].includes(s.phase))controls=`${b.pending.length?'<button class="button outline wide" data-action="reconcile" style="margin-bottom:10px">Repetir lectura RFID (simulada)</button>':''}${s.phase==='limit_exceeded'?'<p class="warning">'+U.esc(s.note)+'</p>':''}<button class="button primary wide" data-action="exit">${s.phase==='limit_exceeded'?'Volver a comprobar salida':'Salir de la tienda'} ${U.icon('arrow')}</button><p class="micro center" style="margin:12px 0 0">Simula cruzar la salida. La tienda confirma si puedes marcharte.</p>`;
 if(s.phase==='payment_failed'){
  const current=s.checkout?.profile.payment;
  controls=`<section class="payment-recovery"><p class="warning">Sin cargo registrado. Elige el método que autorizarás para esta compra.</p><label class="field-label" for="retryPaymentMethod">Método para esta compra</label><select id="retryPaymentMethod">${TakeGo.CARDS.map(m=>`<option ${current===m?'selected':''}>${U.esc(m)}</option>`).join('')}</select><p class="micro">Predeterminado para próximas visitas: ${U.esc(s.pendingProfile?.payment||s.profile.payment)}. Esta elección solo afecta a la compra pendiente.</p><button class="button primary wide" data-action="retry">Reintentar pago de prueba</button><button class="button quiet wide" data-action="revise">Revisar cesta</button></section>`;
 }
 if(paid)controls='<div class="success-symbol">'+U.icon('check')+'</div><p class="center">Compra pagada · No se volverá a cobrar.</p><button class="button primary wide" data-action="receipt">Ver y descargar factura</button><button class="button quiet wide" data-action="report">Hay un problema con esta compra</button>';
 if(['paying','exiting'].includes(s.phase))controls='<p class="center"><span class="spinner"></span> '+(s.phase==='paying'?'Procesando pago de prueba…':'Verificando salida…')+'</p>';
 const budget=['ready','shopping','reviewing','limit_exceeded'].includes(s.phase)?E.budget(engine.spending(b.estimatedCents),{estimated:b.pending.length>0}):'';
 $('#checkoutPanel').innerHTML=`<section class="checkout-card"><div class="checkout-heading"><h2>${paid?'Compra pagada':'Tu cesta'}</h2><span class="count" aria-label="Productos detectados">${b.detectedQuantity}</span></div>${rows||'<div class="empty">'+U.icon('bag')+'<h3>Aún está vacía.</h3><p>Lo que cojas aparecerá aquí.<br>Lo que devuelvas, desaparecerá.</p></div>'}${rows?E.total(b,paid):''}${controls}${budget}</section>`;
 const held=s.units.filter(u=>u.vision.location==='basket').length,read=s.units.filter(u=>u.rfid.location==='basket').length;
 $('#sensorStatuses').innerHTML=`<div class="sensor-status">${U.icon('camera')}<div><strong>Visión · ${held} producto(s)</strong><p>Retiradas y devoluciones simuladas</p></div></div><div class="sensor-status">${U.icon('rfid')}<div><strong>RFID · ${read} etiqueta(s)</strong><p>${b.pending.length?'Lectura pendiente de contrastar':'Lecturas contrastadas'}</p></div></div>`;
 $('#sensorLog').innerHTML=s.events.slice(-6).reverse().map(e=>`<div class="log-entry"><span class="log-time">${new Date(e.at).toLocaleTimeString('es-ES',{timeZone:'Europe/Madrid'})}</span><span>${U.esc(e.message)}</span></div>`).join('')||'<p>El registro de la visita aparecerá aquí.</p>';
}
function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
function syncBudget(){engine.mergeReceipts(readJSON('takego_spending_v1',[]).filter(U.receiptValid));const customer=readJSON('takego_customer_v1',{});engine.mergeReceipts((customer.receipts||[]).filter(U.receiptValid));if(customer.profile?.id===engine.state.profile?.id){const limits=TakeGoSpending.normalize(customer.profile.limits);if(JSON.stringify(limits)!==JSON.stringify(engine.state.limits)){engine.state.limits=limits;engine.event('limits_updated','Topes de compra actualizados')}}}
function pay(){const visit=engine.state.visitId,declined=$('#declinePayment').checked;$('#declinePayment').checked=false;setTimeout(async()=>{const finish=()=>{syncBudget();const result=engine.payment(visit,!declined);if(result)localStorage.setItem('takego_spending_v1',JSON.stringify(engine.state.receipts));publish()};if(navigator.locks)await navigator.locks.request('takego-payment-TG-DEMO-ALEX',finish);else finish()},1100)}
function exit(){syncBudget();if(!engine.beginExit())return;publish();const visit=engine.state.visitId;setTimeout(()=>{syncBudget();engine.validateExit(visit);publish();if(engine.state.phase==='paying')pay()},850)}
function retry(method){if(engine.retryPayment(method)){publish();pay()}}
function renderConnection(){
 const online=connected();$('#connectionState').textContent=online?'App enlazada · local':'App sin conexión · estado guardado';
 const notice=$('#storeConnectionNotice');notice.hidden=online;notice.textContent=engine?.state.profile?'La app no responde. Conservamos el último estado y la cesta de esta visita; la factura se sincronizará al reconectar.':'Abre la app del cliente en este navegador para iniciar la demostración.';
 if(engine?.state.phase==='ready'){const b=$('[data-action="enter"]');if(b)b.disabled=!online||!engine.state.profile}
}
channel.onmessage=({data:m})=>{
 if(!active)return;
 if(m.type==='hello'&&m.role==='customer'){
  const wasConnected=connected();lastSeen=Date.now();
  const changed=m.profile&&JSON.stringify(m.profile)!==JSON.stringify(engine.state.pendingProfile);
  if(changed){engine.profile(m.profile);publish()}else{postState();renderConnection();if(!wasConnected)access()}
 }
 if(m.type==='confirm'&&engine.confirm(m.visitId))publish();
 if(m.type==='verify'){engine.verify(m.visitId,m.code);publish()}
 if(m.type==='retry_payment'&&m.visitId===engine.state.visitId)retry(m.payment);
};
function showReceipt(){receipt=engine.state.receipt;if(!receipt)return;$('#receiptContent').innerHTML=U.receiptHTML(receipt);$('#receiptDialog').showModal()}
function report(){receipt=engine.state.receipt;if(!receipt)return;$('#receiptDialog').close();$('#storeIssueContent').innerHTML=E.issueForm(receipt);$('#storeIssueDialog').showModal()}
document.addEventListener('click',e=>{
 if(!active)return;const el=e.target.closest('button');if(!el)return;
 if(el.dataset.category){category=el.dataset.category;render();return}
 const a=el.dataset.action;
 if(a==='enter'&&connected()&&engine.start($('#authMethod').value)){publish();const visit=engine.state.visitId;if(engine.state.phase==='identifying')setTimeout(()=>{if(engine.automatic(visit))publish()},1600)}
 if(a==='pick'){if(engine.pick(el.dataset.sku,{missingRfid:$('#missingRfid').checked})){$('#missingRfid').checked=false;publish()}}
 if(a==='return'&&engine.returnOne(el.dataset.sku))publish();
 if(a==='reconcile'){engine.reconcile();publish()}
 if(a==='exit')exit();
 if(a==='retry')retry($('#retryPaymentMethod').value);
 if(a==='revise'&&engine.reviseBasket())publish();
 if(a==='new'&&engine.newVisit())publish();
 if(a==='receipt')showReceipt();
 if(a==='report')report();
 if(a==='download-issue')E.downloadIssue(el.dataset.id);
});
document.addEventListener('submit',e=>{if(e.target.id!=='issueForm')return;e.preventDefault();try{const x=E.recordIssue(receipt,e.target);$('#storeIssueContent').innerHTML='<h2>Incidencia guardada localmente</h2><p>No se ha enviado a la estación ni se ha iniciado un reembolso.</p><small class="reference">'+U.esc(x.id)+'</small><button class="button primary wide" data-action="download-issue" data-id="'+U.esc(x.id)+'">Descargar copia</button>'}catch(error){$('#issueError').textContent=error.message}});
$('#voiceAnnouncements').onchange=e=>{if(!e.target.checked){if('speechSynthesis' in window)speechSynthesis.cancel();return}lastAnnounced=null;access()};
$('#downloadReceipt').onclick=async()=>{const button=$('#downloadReceipt');button.disabled=true;try{await U.downloadReceipt(receipt)}catch(error){$('#toast').textContent=error.message;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4500)}finally{button.disabled=false}};
$('#closeReceipt').onclick=()=>$('#receiptDialog').close();$('#reportReceipt').onclick=report;
$('#closeStoreIssue').onclick=()=>$('#storeIssueDialog').close();
function init(){let saved;try{saved=JSON.parse(localStorage.getItem(key))}catch{}try{engine=new TakeGo.Store(saved);engine.basket()}catch{engine=new TakeGo.Store()}syncBudget();active=true;publish();channel.postMessage({type:'hello',role:'store'});setInterval(renderConnection,1000)}
addEventListener('pagehide',()=>{if(active){channel.postMessage({type:'store_closed'});if('speechSynthesis' in window)speechSynthesis.cancel()}});
if(navigator.locks)navigator.locks.request('takego-store-'+link,{ifAvailable:true},async lock=>{if(!lock){$('#accessPanel').innerHTML='<div class="warning">Esta tienda virtual ya está abierta en otra pestaña. Continúa allí para evitar dos terminales de prueba simultáneos.</div>';return}init();await new Promise(()=>{})});else init();
})();
