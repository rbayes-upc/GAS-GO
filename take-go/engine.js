/* TAKE&GO · simulador local: sin cámara, lectores, credenciales ni pagos reales. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TakeGo=factory()})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
const PRODUCTS=[
 {id:'coffee',name:'Café latte',detail:'Listo para llevar · 250 ml',category:'Bebidas',cents:185,kind:'cup',color:'#d7b590'},
 {id:'water',name:'Agua mineral',detail:'Tu pausa más fresca · 500 ml',category:'Bebidas',cents:120,kind:'bottle',color:'#b8cfd0'},
 {id:'sandwich',name:'Sándwich de pollo',detail:'Pan integral · 160 g',category:'Para picar',cents:395,kind:'sandwich',color:'#c9b98d'},
 {id:'chips',name:'Patatas al punto de sal',detail:'Crujientes de verdad · 45 g',category:'Para picar',cents:175,kind:'bag',color:'#ead061'},
 {id:'croissant',name:'Croissant de mantequilla',detail:'Un pequeño capricho · 65 g',category:'Para picar',cents:150,kind:'pastry',color:'#d6a56b'},
 {id:'juice',name:'Zumo de naranja',detail:'Una dosis de sol · 250 ml',category:'Bebidas',cents:220,kind:'carton',color:'#dcad73'}
];
const CARDS=['Visa •••• 4821','Mastercard •••• 1056','PayPal (demo)','Bizum (demo)'];
const Spending=typeof module==='object'&&module.exports?require('./spending.js'):window.TakeGoSpending;
const allowedProfile=p=>p&&p.id==='TG-DEMO-ALEX'&&CARDS.includes(p.payment)&&(p.limits===undefined||Spending.valid(p.limits));
const copy=value=>JSON.parse(JSON.stringify(value));
class Store{
 constructor(saved=null,options={}){
  this.clock=options.clock||(()=>Date.now());this.id=options.id||(()=>crypto.randomUUID());
  this.state=saved?.version===1?copy(saved):{version:1,storeId:this.id(),phase:'ready',visitId:null,profile:null,pendingProfile:null,method:'A',code:null,units:PRODUCTS.flatMap((p,i)=>Array.from({length:3},(_,n)=>({id:p.id+'-'+(n+1),sku:p.id,visionKey:'VIS-'+String(i*3+n+1).padStart(3,'0'),rfidKey:'EPC-TG-'+p.id.toUpperCase()+'-'+String(n+1).padStart(3,'0'),vision:{location:'shelf',sequence:0},rfid:{location:'shelf',sequence:0}}))),seen:[],events:[],receipt:null,receipts:[],checkout:null,sequence:0,note:'',entryAt:null,authorizedAt:null,paymentAttempts:0};
  this.state.limits=Spending.normalize(this.state.limits);
  this.state.receipts=Array.isArray(this.state.receipts)?this.state.receipts:[];
  if(this.state.receipt&&!this.state.receipts.some(r=>r.id===this.state.receipt.id))this.state.receipts.push(copy(this.state.receipt));
  if(this.state.phase==='identifying'){this.state.phase='ready';this.state.note='La acreditación de prueba se interrumpió. Puedes volver a entrar.';this.event('recovery','Acreditación interrumpida; puedes volver a entrar')}
  if(['exiting','paying'].includes(this.state.phase)){this.state.phase=this.state.checkout?'payment_failed':'shopping';this.state.note='La comprobación se interrumpió. No se ha registrado un pago; puedes reintentar.';this.event('recovery','Comprobación interrumpida; no se registra ningún pago')}
 }
 event(type,message,extra={}){this.state.events.push({id:this.id(),type,message,at:this.clock(),...extra});this.state.events=this.state.events.slice(-60);this.state.sequence++}
 profile(p){if(!allowedProfile(p))return false;this.state.pendingProfile={id:p.id,name:'Alex García',payment:p.payment,limits:Spending.normalize(p.limits)};this.state.limits=Spending.normalize(p.limits);if(this.state.phase==='ready')this.state.profile=copy(this.state.pendingProfile);this.event('profile','Perfil de demostración disponible');return true}
 start(method='A'){
  if(this.state.phase!=='ready'||!allowedProfile(this.state.pendingProfile||this.state.profile)||!['A','B','C'].includes(method))return false;
  this.state.profile=copy(this.state.pendingProfile||this.state.profile);this.state.visitId=this.id();this.state.method=method;this.state.code=String(parseInt(this.id().replace(/[^a-f0-9]/gi,'').slice(-6)||'1',16)%1000000).padStart(6,'0');this.state.phase=method==='A'?'identifying':method==='B'?'confirmation':'code';this.state.entryAt=this.clock();this.state.note='';this.state.receipt=null;this.state.checkout=null;this.state.paymentAttempts=0;this.event('entry','Presencia de una persona simulada en el acceso · método '+method);return true;
 }
 authorize(){if(!['identifying','confirmation','code'].includes(this.state.phase))return false;this.state.authorizedAt=this.clock();this.state.phase='shopping';this.state.note='Acceso acreditado. La cesta se verificará con dos lecturas simuladas.';this.event('authorized','Acreditación completada · método '+this.state.method);return true}
 automatic(visit){if(visit!==this.state.visitId||this.state.phase!=='identifying')return false;return this.authorize()}
 confirm(visit){if(visit!==this.state.visitId||this.state.phase!=='confirmation')return false;return this.authorize()}
 verify(visit,code){if(visit!==this.state.visitId||this.state.phase!=='code')return false;if(String(code)!==this.state.code){this.state.note='El código no coincide. Revisa el acceso de la tienda.';this.event('verification_failed','Código de demostración no válido');return false}return this.authorize()}
 observe({visitId,source,key,location,sequence,eventId}){
  if(visitId!==this.state.visitId||!['shopping','reviewing'].includes(this.state.phase)||!['vision','rfid'].includes(source)||!['shelf','basket'].includes(location)||!Number.isSafeInteger(sequence)||sequence<1||!eventId||this.state.seen.includes(eventId))return false;
  const unit=this.state.units.find(u=>u[source==='vision'?'visionKey':'rfidKey']===key);if(!unit||sequence<=unit[source].sequence)return false;
  this.state.seen.push(eventId);this.state.seen=this.state.seen.slice(-400);unit[source]={location,sequence};
  const p=PRODUCTS.find(p=>p.id===unit.sku);this.event(source,(source==='vision'?'Cámara simulada':'RFID simulado')+' · '+(location==='basket'?'retirada de ':'devolución de ')+p.name,{sensorKey:key});
  if(this.state.phase==='reviewing'&&!this.basket().pending.length){this.state.phase='shopping';this.state.note='Lecturas conciliadas. Puedes repetir la comprobación de salida.'}
  return true;
 }
 read(unit,source,location){return this.observe({visitId:this.state.visitId,source,key:unit[source==='vision'?'visionKey':'rfidKey'],location,sequence:unit[source].sequence+1,eventId:this.id()})}
 pick(sku,{missingRfid=false}={}){if(this.state.phase!=='shopping')return false;const unit=this.state.units.find(u=>u.sku===sku&&u.vision.location==='shelf'&&u.rfid.location==='shelf');if(!unit)return false;this.read(unit,'vision','basket');if(!missingRfid)this.read(unit,'rfid','basket');return unit.id}
 returnOne(sku){if(!['shopping','reviewing','limit_exceeded'].includes(this.state.phase))return false;const unit=this.state.units.find(u=>u.sku===sku&&(u.vision.location==='basket'||u.rfid.location==='basket'));if(!unit)return false;if(this.state.phase==='limit_exceeded')this.reviseBasket();this.read(unit,'vision','shelf');this.read(unit,'rfid','shelf');return true}
 reconcile(){if(!['shopping','reviewing'].includes(this.state.phase))return false;for(const unit of this.state.units.filter(u=>u.vision.location!==u.rfid.location))this.read(unit,'rfid',unit.vision.location);this.event('reconciled','Relectura RFID de demostración completada');return true}
 basket(){const held=this.state.units.filter(u=>u.vision.location==='basket'&&u.rfid.location==='basket'),pending=this.state.units.filter(u=>u.vision.location!==u.rfid.location),rows=PRODUCTS.map(p=>({...p,quantity:held.filter(u=>u.sku===p.id).length,pending:pending.filter(u=>u.sku===p.id).length})).filter(p=>p.quantity||p.pending);return {rows,pending,quantity:held.length,detectedQuantity:held.length+pending.length,estimatedCents:rows.reduce((n,p)=>n+p.cents*(p.quantity+p.pending),0),totalCents:rows.reduce((n,p)=>n+p.cents*p.quantity,0)}}
 beginExit(){if(!['shopping','reviewing','limit_exceeded'].includes(this.state.phase))return false;this.state.phase='exiting';this.state.note='Comprobando la cesta de demostración…';this.event('exit_check','Presencia simulada en la zona de salida');return true}
 validateExit(visit){
  if(visit!==this.state.visitId||this.state.phase!=='exiting')return false;const basket=this.basket();
  if(basket.pending.length){this.state.phase='reviewing';this.state.note='Hay lecturas pendientes. No se inicia ningún pago.';this.event('review','Las lecturas de cámara y RFID todavía no coinciden');return false}
  if(!basket.quantity){this.state.phase='left_empty';this.state.note='Has salido sin productos. No hay ningún cobro.';this.event('empty_exit','Salida sin compra; no se genera recibo');return true}
  if(!this.checkLimit(basket.totalCents))return false;
  this.state.checkout={id:this.id(),visitId:visit,rows:basket.rows.map(({id,name,cents,quantity})=>({sku:id,name,cents,quantity})),totalCents:basket.totalCents,profile:copy(this.state.profile)};this.state.phase='paying';this.state.paymentAttempts++;this.event('payment_started','Pago de demostración iniciado');return true;
 }
 payment(visit,success=true){
  if(visit!==this.state.visitId||this.state.phase!=='paying'||!this.state.checkout)return false;
  if(!this.checkLimit(this.state.checkout.totalCents))return false;
  if(!success){this.state.phase='payment_failed';this.state.note='El pago de prueba no se ha completado. No hay cobro ni recibo.';this.event('payment_failed','Pago simulado rechazado');return false}
  const c=this.state.checkout;this.state.receipt={id:'TG-'+c.id,visitId:visit,store:'TAKE&GO · Estación Diagonal',customer:c.profile.name,payment:c.profile.payment,method:this.state.method,rows:copy(c.rows),totalCents:c.totalCents,paidAt:this.clock(),entryAt:this.state.entryAt,simulated:true};if(!this.state.receipts.some(r=>r.id===this.state.receipt.id))this.state.receipts.push(copy(this.state.receipt));this.state.phase='complete';this.state.note='Compra de demostración completada. Tu recibo ya está disponible.';this.event('payment_completed','Pago simulado completado · recibo '+this.state.receipt.id);return copy(this.state.receipt);
 }
 retryPayment(payment=this.state.checkout?.profile.payment){if(this.state.phase!=='payment_failed'||!this.state.checkout||!CARDS.includes(payment))return false;if(payment!==this.state.checkout.profile.payment){this.state.checkout.profile.payment=payment;this.state.profile.payment=payment;this.event('payment_method_changed','Método elegido solo para esta compra: '+payment)}this.state.phase='paying';this.state.paymentAttempts++;this.state.note='Reintentando el mismo pago de demostración…';this.event('payment_retry','Reintento del mismo pago simulado');return true}
 reviseBasket(){if(!['payment_failed','limit_exceeded'].includes(this.state.phase))return false;this.state.phase='shopping';this.state.checkout=null;this.state.note='Sin pago registrado. Puedes revisar y devolver productos.';this.event('basket_reopened','Cesta reabierta tras un pago de prueba no completado');return true}
 newVisit(){if(!['complete','left_empty'].includes(this.state.phase))return false;for(const u of this.state.units){u.vision={location:'shelf',sequence:0};u.rfid={location:'shelf',sequence:0}}this.state.phase='ready';this.state.profile=copy(this.state.pendingProfile||this.state.profile);this.state.visitId=null;this.state.code=null;this.state.checkout=null;this.state.receipt=null;this.state.seen=[];this.state.note='';this.event('new_visit','Preparada una nueva visita de demostración');return true}
 spending(amount=0){return Spending.report(this.state.receipts,this.state.limits,this.clock(),amount)}
 checkLimit(amount){const exceeded=this.spending(amount).filter(p=>p.exceeded);if(!exceeded.length)return true;this.state.phase='limit_exceeded';this.state.checkout=null;this.state.note='Compra sin cobrar: supera el límite '+exceeded.map(p=>({daily:'diario',weekly:'semanal',monthly:'mensual'}[p.key])).join(', ')+'. Devuelve productos o ajusta tus límites en Perfil.';this.event('limit_exceeded',this.state.note);return false}
 mergeReceipts(rows){for(const r of rows||[])if(r&&r.simulated===true&&typeof r.id==='string'&&Number.isSafeInteger(r.totalCents)&&r.totalCents>0&&Number.isFinite(r.paidAt)&&!this.state.receipts.some(x=>x.id===r.id))this.state.receipts.push(copy(r))}
 snapshot(){return copy(this.state)}
 publicState(){const s=this.state;return {version:1,storeId:s.storeId,sequence:s.sequence,phase:s.phase,visitId:s.visitId,method:s.method,profile:s.profile?copy(s.profile):null,note:s.note,entryAt:s.entryAt,authorizedAt:s.authorizedAt,basket:this.basket(),receipt:s.receipt?copy(s.receipt):null,receipts:copy(s.receipts),events:s.events.map(({sensorKey,...e})=>e),checkoutTotal:s.checkout?.totalCents??null,checkoutPayment:s.checkout?.profile.payment??null,paymentAttempts:s.paymentAttempts,spending:this.spending(this.basket().estimatedCents)}}
}
return {PRODUCTS,CARDS,Store};
});
