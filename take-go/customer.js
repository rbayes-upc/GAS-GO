(function(){'use strict';
const U=TakeGoUI,E=TakeGoExperience,$=s=>document.querySelector(s),key='takego_customer_v1';
let data;try{data=JSON.parse(localStorage.getItem(key))||{}}catch{data={}}
if(data.profile)data.profile.limits=TakeGoSpending.normalize(data.profile.limits);
data.receipts=Array.isArray(data.receipts)?data.receipts.filter(U.receiptValid):[];
let link=new URLSearchParams(location.search).get('session');
if(!/^[a-f0-9-]{36}$/i.test(link||''))link=sessionStorage.getItem('takego_link_v1')||crypto.randomUUID();
sessionStorage.setItem('takego_link_v1',link);
const cachedKey='takego_last_state_'+link;
let state=null;try{state=JSON.parse(sessionStorage.getItem(cachedKey))}catch{}
let tab='home',receipt=null,lastSeen=0,limitsDirty=false;
const channel=new BroadcastChannel('takego_v1_'+link),save=()=>localStorage.setItem(key,JSON.stringify(data));
const connected=()=>lastSeen>0&&Date.now()-lastSeen<6000;
const hello=()=>channel.postMessage({type:'hello',role:'customer',profile:data.profile});
const receiptById=id=>data.receipts.find(r=>r.id===id)||(state?.receipt?.id===id?state.receipt:null);
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4000)}
function route(){const [view,id]=location.hash.slice(1).split('/');return {view:['home','basket','receipts','profile','payments','limits','issues','issue','invoice'].includes(view)?view:'home',id:id?decodeURIComponent(id):null}}
function url(view,id){return '?session='+link+'#'+view+(id?'/'+encodeURIComponent(id):'')}
function navigate(view,id,{replace=false}={}){
 if(view===tab&&!id)return;
 const depth=replace?(history.state?.depth||0):(history.state?.takego?history.state.depth+1:1);
 history[replace?'replaceState':'pushState']({takego:true,depth,tab:view==='invoice'?tab:view},'',url(view,id));
 showRoute();$('#appMain').scrollTop=0;$('#appMain').focus({preventScroll:true});
}
function back(){if(history.state?.takego&&history.state.depth>0)history.back();else navigate(['payments','limits','issues'].includes(tab)?'profile':'home',null,{replace:true})}
function showRoute(){const r=route();if($('#receiptDialog').open)$('#receiptDialog').close();tab=r.view==='invoice'?(history.state?.tab||'receipts'):r.view;limitsDirty=false;render();if(r.view==='invoice'){receipt=receiptById(r.id);if(receipt&&U.receiptValid(receipt)){$('#receiptContent').innerHTML=U.receiptHTML(receipt);$('#receiptDialog').showModal()}else toast('No se encuentra esta factura en el navegador.')}}
history.replaceState({takego:true,depth:0,tab:route().view==='invoice'?'receipts':route().view},'',url(route().view,route().id));
$('.wordmark').href=url('home');$('.wordmark').onclick=e=>{e.preventDefault();navigate('home')};
addEventListener('popstate',showRoute);
function openStore(){const popup=window.open('./tienda.html?session='+link,'takego-shop-'+link);if(!popup)toast('Permite abrir la pestaña de la tienda virtual en tu navegador.')}
function connectionHTML(){return `<div class="connection-notice" data-connection-notice role="status" aria-live="polite" hidden></div>`}
function updateConnection(){
 const online=connected();
 const label=online?'TIENDA ENLAZADA · DEMO':state?'CONEXIÓN INTERRUMPIDA':'ESPERANDO A LA TIENDA';
 const badge=$('[data-connection-label]');if(badge){if(badge.textContent!==label)badge.textContent=label;badge.classList.toggle('disconnected',!online)}
 const notice=$('[data-connection-notice]');if(notice){notice.hidden=online||!state;const text='Sin conexión con la tienda. Se muestra el último estado recibido; los cambios y el pago se confirmarán al reconectar.';if(notice.textContent!==text)notice.textContent=text}
 document.querySelectorAll('.live-only').forEach(button=>button.disabled=!online);
}
function liveSend(message){if(!connected()){toast('Reconecta con la tienda antes de continuar.');return}channel.postMessage(message)}
function phaseCard(){
 const p=state?.phase||'ready',messages={ready:['Todo listo para tu próxima parada.','Abre la tienda virtual para iniciar la experiencia.'],identifying:['Te estamos identificando…','Comprueba el aviso de acceso en la tienda.'],confirmation:['Confirma que eres tú.','Este método alternativo requiere tu confirmación.'],code:['Introduce el código de entrada.','Lo encontrarás en la pantalla de la tienda virtual.'],shopping:['Identificado. Puedes entrar.','Elige tus productos. Puedes guardar el móvil.'],reviewing:['Estamos verificando un producto.','La tienda indica cómo resolverlo. No se cobrará hasta contrastar la cesta.'],exiting:['Comprobando tu salida…','Contrastamos la cesta antes de preparar el pago.'],paying:['Procesando tu compra…','Espera la confirmación de salida de la tienda.'],limit_exceeded:['Esta cesta supera un tope.','Puedes devolver productos directamente en la tienda o ajustar tus límites en Perfil.'],payment_failed:['El pago no se ha completado.','Elige otro método para esta compra o reintenta en la tienda. No hay cargo registrado.'],complete:['Compra pagada. Puedes salir.','Tu factura ya está disponible. Gracias por tu visita.'],left_empty:['Hasta la próxima, Alex.','Has salido sin productos. No se ha realizado ningún cobro.']};
 const m=messages[p]||messages.ready;
 return `<section class="card status-card"><span class="pill" data-connection-label></span><h2>${m[0]}</h2><p>${m[1]}</p>${p==='confirmation'?'<button class="button primary wide live-only" data-action="confirm">Confirmar identidad de prueba</button>':''}${p==='code'?'<form id="codeForm" class="code-form"><input aria-label="Código temporal" aria-describedby="codeError" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="off"><button class="button primary live-only">Entrar</button></form><p id="codeError" class="code-error" role="alert">'+U.esc(state?.note||'')+'</p>':''}${p==='ready'?'<button class="button primary wide" data-action="store">Abrir tienda virtual '+U.icon('arrow')+'</button>':''}${p==='payment_failed'?'<button class="button primary wide" data-tab="payments">Resolver el pago</button>':''}${p==='complete'?'<button class="button primary wide" data-action="receipt" data-id="'+U.esc(state.receipt.id)+'">Ver y descargar factura</button>':''}</section>`;
}
function basket(){
 const b=state?.basket,paid=state?.phase==='complete';
 if(!b?.rows.length)return `<div class="empty">${U.icon('bag')}<h3>${state?.phase==='left_empty'?'Has salido sin compra.':'Tu cesta empieza aquí.'}</h3><p>Al coger un producto en la tienda virtual, aparecerá automáticamente.</p></div>`;
 return `${paid?'<section class="paid-banner">'+U.icon('check')+' Compra pagada · No se volverá a cobrar esta cesta.</section>':''}${b.rows.map(p=>E.row(p)).join('')}${E.total(b,paid)}${paid?'<button class="button primary wide" data-action="receipt" data-id="'+U.esc(state.receipt.id)+'">Ver y descargar factura</button>':E.budget(state?.spending,{estimated:b.pending.length>0})}`;
}
function paymentRecovery(){if(state?.phase!=='payment_failed')return '';const method=state.checkoutPayment||state.profile?.payment;return `<section class="card tinted"><h3>Resolver esta compra pendiente</h3><p>No se completó el pago con <strong>${U.esc(method)}</strong>.</p><p class="micro">Predeterminado para nuevas visitas: ${U.esc(data.profile.payment)}.</p><button class="button primary wide live-only" data-action="retry-current">Usar ${U.esc(data.profile.payment)} en esta compra y reintentar</button><p class="micro">Este botón autoriza el reintento de la misma compra con el método indicado. No crea otra cesta.</p></section>`}
function render(){
 const main=$('#appMain');
 if(!data.profile){main.innerHTML=`<div class="welcome-copy">${U.logo('full','welcome-logo')}<p class="eyebrow">TU PARADA, SIN PASAR POR CAJA</p><h1>Lo coges.<br>Y sigues tu camino.</h1>${U.hero()}<p>Entra con tu identidad GAS&GO, elige tus productos y sal. Nosotros nos encargamos del resto.</p><button class="button primary wide" data-action="demo">Probar TAKE&GO ${U.icon('arrow')}</button><p class="micro center" style="margin-top:15px">Perfil ficticio · Sin conexión a tu cuenta GAS&GO.<br>Sin cámaras conectadas ni cobros reales.</p></div>`;$('#appNav').innerHTML='';return}
 const profileTabs=['payments','limits','issues','issue'];
 $('#appNav').innerHTML=[['home','home','Inicio'],['basket','bag','Cesta'],['receipts','receipt','Facturas'],['profile','person','Perfil']].map(([id,icon,label])=>`<button class="nav-button ${tab===id||(id==='profile'&&profileTabs.includes(tab))?'active':''}" data-tab="${id}" ${tab===id||(id==='profile'&&profileTabs.includes(tab))?'aria-current="page"':''}>${U.icon(icon)}${label}</button>`).join('');
 const backButton=tab!=='home'?'<button class="back" data-action="back">'+U.icon('back')+' Volver</button>':'';
 if(tab==='home')main.innerHTML=`<p class="eyebrow">HOLA, ALEX</p><h1 class="page-title">Tu pausa, a tu ritmo.</h1><p>TAKE&GO · Estación Diagonal</p>${phaseCard()}${connectionHTML()}${state?.phase==='ready'?E.budget(TakeGoSpending.report(data.receipts,data.profile.limits)):''}${!data.demoGuideSeen?'<section class="card demo-guide"><h3>Dos pantallas, una demostración</h3><p>La app es tu cuenta. La otra pestaña representa la tienda física: allí, «Coger», «Devolver» y «Salir» simulan tus movimientos.</p><p class="micro">Mantén ambas en este navegador. En una tienda real, el recorrido automático no exigiría estas acciones en el móvil.</p><button class="button outline small" data-action="guide-done">Entendido</button></section>':''}<div class="steps"><div class="step"><span class="step-number">01</span><div><strong>Entra y te reconocemos</strong><p>La tienda confirma tu acceso.</p></div></div><div class="step"><span class="step-number">02</span><div><strong>Coge. Devuelve. Elige.</strong><p>Los sensores simulados contrastan tu cesta.</p></div></div><div class="step"><span class="step-number">03</span><div><strong>Sal y sigue tu camino</strong><p>La tienda confirma el pago y guarda tu factura.</p></div></div></div>${state&&state.phase!=='ready'?'<button class="button quiet wide" data-action="store">Volver a la tienda virtual '+U.icon('arrow')+'</button>':''}`;
 if(tab==='basket')main.innerHTML=backButton+`<h1 class="page-title">${state?.phase==='complete'?'Tu compra pagada.':'Tu cesta, al instante.'}</h1>${connectionHTML()}${basket()}${!['complete','left_empty'].includes(state?.phase)?'<p class="micro">La salida de la tienda inicia el cobro simulado. Espera su confirmación para saber que la compra está pagada.</p>':''}`;
 if(tab==='receipts')main.innerHTML=backButton+`<h1 class="page-title">Tus facturas.</h1><p>Todas tus pausas, en un mismo lugar.</p>`+(data.receipts.length?data.receipts.slice().sort((a,b)=>b.paidAt-a.paidAt).map(r=>`<button class="card wide row" data-action="receipt" data-id="${U.esc(r.id)}"><span style="text-align:left"><strong>Estación Diagonal</strong><p class="micro" style="margin:5px 0">${U.date(r.paidAt)} · Pagada · Demo</p></span><strong>${U.money(r.totalCents)} ${U.icon('arrow')}</strong></button>`).join(''):'<div class="empty">'+U.icon('receipt')+'<h3>Aún no hay facturas.</h3><p>Aparecerán al completar una compra de prueba.</p></div>');
 if(tab==='profile')main.innerHTML=backButton+`<h1 class="page-title">Tu perfil.</h1><p>Una misma idea de identidad. Una nueva experiencia.</p><section class="card"><div class="row"><div class="profile-avatar">AG</div><div><strong>Alex García</strong><p class="micro" style="margin:4px 0">Identidad ficticia · DEMO</p></div></div></section><button class="card wide row profile-link" data-tab="payments"><span>${U.icon('card')} <strong>Método de pago</strong><small>${U.esc(data.profile.payment)} · Predeterminado</small></span>${U.icon('arrow')}</button><button class="card wide row profile-link" data-tab="limits"><span>${U.icon('shield')} <strong>Límites de compra</strong><small>Topes diarios, semanales y mensuales</small></span>${U.icon('arrow')}</button><button class="card wide row profile-link" data-tab="issues"><span>${U.icon('shield')} <strong>Mis incidencias</strong><small>Copias de demostración guardadas localmente</small></span>${U.icon('arrow')}</button><p class="micro">La integración con tu cuenta GAS&GO se realizará en una fase posterior. Este prototipo guarda únicamente datos de demostración en este navegador.</p>`;
 if(tab==='payments')main.innerHTML=backButton+connectionHTML()+paymentRecovery()+TakeGoPreferences.payments(data.profile);
 if(tab==='limits')main.innerHTML=backButton+TakeGoPreferences.limits(data.profile,data.receipts);
 if(tab==='issues')main.innerHTML=backButton+E.issuesHTML();
 if(tab==='issue'){const r=receiptById(route().id);main.innerHTML=backButton+(r?E.issueForm(r):'<p>No se encuentra esta compra. Abre una factura para registrar una incidencia.</p>')}
 updateConnection();
}
channel.onmessage=({data:msg})=>{
 if(msg.type==='hello'&&msg.role==='store'){hello();return}
 if(msg.type==='store_closed'){lastSeen=0;updateConnection();return}
 if(msg.type!=='state'||!msg.state||msg.state.version!==1)return;
 const next=msg.state;if(state?.storeId===next.storeId&&next.sequence<state.sequence)return;
 const changed=!state||state.sequence!==next.sequence||state.storeId!==next.storeId;
 state=next;lastSeen=Date.now();sessionStorage.setItem(cachedKey,JSON.stringify(state));
 let added=false;for(const r of next.receipts||[])if(U.receiptValid(r)&&!data.receipts.some(x=>x.id===r.id)){data.receipts.push(r);added=true}if(added)save();
 if((changed||added)&&(!['limits','payments','profile','issue','issues'].includes(tab)||(tab==='payments'&&changed)||(tab==='limits'&&added&&!limitsDirty)))render();
 updateConnection();
};
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.payment){data.profile.payment=b.dataset.payment;save();hello();render();return}
 if(b.dataset.tab){navigate(b.dataset.tab);return}
 const action=b.dataset.action;
 if(action==='back'){back();return}
 if(action==='demo'){data.profile={id:'TG-DEMO-ALEX',name:'Alex García',payment:TakeGo.CARDS[0],limits:TakeGoSpending.empty()};save();hello();render()}
 if(action==='guide-done'){data.demoGuideSeen=true;save();render()}
 if(action==='store')openStore();
 if(action==='confirm')liveSend({type:'confirm',visitId:state?.visitId});
 if(action==='receipt')navigate('invoice',b.dataset.id);
 if(action==='retry-current')liveSend({type:'retry_payment',visitId:state?.visitId,payment:data.profile.payment});
 if(action==='add-payment')toast('Disponible al integrar pagos reales. No introduzcas datos bancarios.');
 if(action==='download-issue')E.downloadIssue(b.dataset.id);
});
document.addEventListener('change',e=>{
 if(e.target.dataset.limitToggle){const key=e.target.dataset.limitToggle,input=$('#limit-'+key),enabled=e.target.checked;input.disabled=!enabled;input.required=enabled;$('[data-unlimited="'+key+'"]').hidden=enabled;$('#zero-'+key).hidden=!enabled||input.value===''||Number(input.value)!==0;limitsDirty=true}
});
document.addEventListener('input',e=>{if(e.target.closest('#limitsForm')){limitsDirty=true;const key=e.target.name;if(['daily','weekly','monthly'].includes(key))$('#zero-'+key).hidden=e.target.value===''||Number(e.target.value)!==0}});
document.addEventListener('submit',e=>{
 if(e.target.id==='limitsForm'){e.preventDefault();try{data.profile.limits=TakeGoPreferences.parse(e.target);limitsDirty=false;save();hello();render();$('#limitsSaved').textContent='Límites guardados'}catch(error){$('#limitsError').textContent=error.message}return}
 if(e.target.id==='codeForm'){e.preventDefault();liveSend({type:'verify',visitId:state?.visitId,code:new FormData(e.target).get('code')});return}
 if(e.target.id==='issueForm'){e.preventDefault();try{E.recordIssue(receiptById(route().id),e.target);navigate('issues',null,{replace:true});toast('Incidencia guardada solo en este navegador. No se ha enviado.')}catch(error){$('#issueError').textContent=error.message}}
});
$('#downloadReceipt').onclick=async()=>{const button=$('#downloadReceipt');button.disabled=true;try{await U.downloadReceipt(receipt)}catch(error){toast(error.message)}finally{button.disabled=false}};
$('#closeReceipt').onclick=back;
$('#receiptDialog').addEventListener('cancel',e=>{e.preventDefault();back()});
$('#reportReceipt').onclick=()=>{if(receipt)navigate('issue',receipt.id)};
setInterval(hello,1500);setInterval(updateConnection,1000);addEventListener('pageshow',hello);document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateConnection();hello()}});hello();showRoute();
})();
