const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const c=await b.newContext();const errors=[];c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='gasgo.test')return r.abort();let f=u.pathname.replace(/^\/GAS-GO\//,'')||'index.html';const full=path.resolve(__dirname,'..',f);return r.fulfill({path:full,contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':undefined});});
 await c.addInitScript(()=>{
  window.testPeers=[];window.testConnections=[];
  class Emitter{constructor(){this.events={}}on(k,f){(this.events[k]??=[]).push(f)}emit(k,...a){for(const f of this.events[k]||[])f(...a)}}
  window.TestConnection=class extends Emitter{constructor(){super();this.open=false;this.sent=[];testConnections.push(this)}send(x){this.sent.push(x)}close(){this.open=false;this.emit('close')}start(){this.open=true;this.emit('open')}};
  window.Peer=class extends Emitter{constructor(id){super();this.id=id||'phone';this.open=false;this.disconnected=false;this.destroyed=false;this.reconnects=0;testPeers.push(this)}connect(id){this.target=id;return new TestConnection()}destroy(){this.destroyed=true;this.open=false;this.emit('close')}reconnect(){this.reconnects++;this.disconnected=false}start(){this.open=true;this.disconnected=false;this.emit('open',this.id)}drop(){this.open=false;this.disconnected=true;this.emit('disconnected')}};
  window.QRCode=class{static CorrectLevel={M:0};constructor(el,o){el.dataset.qr=o.text}};
 });
 const pump=await c.newPage();await pump.clock.install();await pump.goto('https://gasgo.test/GAS-GO/surtidor-demo.html');
 await pump.evaluate(()=>testPeers[0].start());const url=await pump.locator('#qrNetworkUrl').getAttribute('href');
 await pump.evaluate(()=>testPeers[0].drop());assert.match(await pump.locator('#qrNetworkStatus').innerText(),/Reconectando/);assert.equal(await pump.locator('#qrNetworkUrl').getAttribute('href'),null);
 await pump.clock.fastForward(1500);assert.equal(await pump.evaluate(()=>testPeers[0].reconnects),1);
 await pump.evaluate(()=>testPeers[0].start());assert.equal(await pump.locator('#qrNetworkUrl').getAttribute('href'),url);
 console.log('PASS signaling reconnect preserves QR session and hides inactive link');
 await pump.evaluate(()=>{testPeers[0].emit('connection',new TestConnection());testPeers[0].emit('connection',new TestConnection());testConnections[0].start()});
 assert.notEqual(await pump.locator('#qrLinkBadge').innerText(),'MÓVIL ENLAZADO');
 await pump.evaluate(()=>{testConnections[1].start();testConnections[0].close();testConnections[0].emit('data',{type:'arrival',vehicle:'OLD',fuel:'Diésel',price:1})});
 assert.equal(await pump.locator('#qrLinkBadge').innerText(),'MÓVIL ENLAZADO');assert.equal(await pump.locator('#stateBadge').innerText(),'● Disponible');
 console.log('PASS stale connection open/close/data cannot replace active connection');
 const phone=await c.newPage();await phone.clock.install();await phone.goto(url);await phone.getByRole('button',{name:/DEMO.*acceso rápido/}).click();
 assert.equal(await phone.locator('#ggConnectionTitle').innerText(),'Conectando con el servicio de enlace');
 await phone.evaluate(()=>testPeers[0].start());
 await phone.getByRole('heading',{name:'Enlazando con el surtidor',exact:true}).waitFor();
 await phone.clock.fastForward(45001);assert.equal(await phone.locator('#ggConnectionTitle').innerText(),'No se ha podido enlazar');assert.equal(await phone.locator('.ggv2-spinner').count(),0);
 await phone.getByRole('button',{name:'Reintentar conexión',exact:true}).click();
 await phone.getByRole('heading',{name:'Enlazando con el surtidor',exact:true}).waitFor();
 await phone.evaluate(()=>testConnections.at(-1).start());assert.equal(await phone.locator('#ggv2Overlay').count(),0);assert.equal(c.pages().length,2);
 console.log('PASS visible connection stages, bounded timeout, retry succeeds without extra pump');
 await pump.locator('#disconnectBtn').evaluate(el=>el.click());
 await pump.locator('#qrNetworkRefresh').click();await pump.evaluate(()=>{testPeers[1].start();testPeers[0].emit('error',{type:'network'});testPeers[0].emit('disconnected')});
 assert.equal(await pump.locator('#qrLinkBadge').innerText(),'QR ACTIVO');assert.notEqual(await pump.locator('#qrNetworkUrl').getAttribute('href'),url);
 assert.deepEqual(errors,[]);console.log('PASS old signaling events cannot corrupt a regenerated session');
 await pump.evaluate(()=>testPeers[1].drop());await pump.clock.fastForward(1500);await pump.clock.fastForward(8001);
 assert.equal(await pump.locator('#qrLinkBadge').innerText(),'SIN CONEXIÓN');assert.match(await pump.locator('#qrNetworkStatus').innerText(),/no responde/);
 console.log('PASS a stalled reconnect ends with an actionable error');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
