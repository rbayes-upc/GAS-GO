const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/GAS-GO\//,'');
  const file=path.join(root,pathname.endsWith('/')?pathname+'index.html':pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data)});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[];
  context.setDefaultTimeout(10000);context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  await context.route('https://**',r=>r.abort());
  let app=await context.newPage();await app.goto(`http://127.0.0.1:${server.address().port}/GAS-GO/take-go/`);
  await app.evaluate(()=>localStorage.setItem('gasgo_demo','unchanged'));
  await app.getByRole('button',{name:/Probar TAKE/}).click();await app.getByRole('heading',{name:'Dos pantallas, una demostración'}).waitFor();
  await app.getByRole('button',{name:'Entendido',exact:true}).click();await app.reload();assert.equal(await app.locator('.demo-guide').count(),0);
  const opened=app.waitForEvent('popup');await app.getByRole('button',{name:/Abrir tienda virtual/}).click();let store=await opened;await store.waitForLoadState();
  const storeURL=store.url(),appURL=app.url(),saved=()=>store.evaluate(()=>JSON.parse(localStorage.getItem('takego_store_v1_'+new URLSearchParams(location.search).get('session'))));
  const phase=async expected=>{await store.waitForFunction(expected=>JSON.parse(localStorage.getItem('takego_store_v1_'+new URLSearchParams(location.search).get('session')))?.phase===expected,expected,{timeout:10000})};
  const action=a=>store.locator('[data-action="'+a+'"]').click(),pick=sku=>store.locator('[data-action="pick"][data-sku="'+sku+'"]').click();
  async function limits(daily){await app.getByRole('button',{name:'Perfil',exact:true}).click();await app.locator('[data-tab="limits"]').click();if(daily===null)await app.locator('#enable-daily').uncheck();else{await app.locator('#enable-daily').check();await app.locator('#limit-daily').fill(daily)}await app.getByRole('button',{name:'Guardar límites',exact:true}).click()}
  await app.getByRole('button',{name:'Perfil',exact:true}).click();await app.locator('[data-tab="payments"]').click();
  assert.equal(await app.locator('#appNav').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight+1),true);
  await app.goBack();await app.getByRole('heading',{name:'Tu perfil.',exact:true}).waitFor();await app.goForward();await app.getByRole('heading',{name:'Método de pago',exact:true}).waitFor();
  await limits('0');assert.equal(await app.locator('#zero-daily').isVisible(),true);await app.locator('#enable-daily').uncheck();assert.equal(await app.locator('#limit-daily').isDisabled(),true);await app.getByRole('button',{name:'Guardar límites',exact:true}).click();
  assert.equal(await app.evaluate(()=>JSON.parse(localStorage.getItem('takego_customer_v1')).profile.limits.daily),null);
  await app.locator('#enable-daily').check();await app.locator('#limit-daily').fill('20');await app.waitForTimeout(1800);assert.equal(await app.locator('#limit-daily').inputValue(),'20');await app.locator('#enable-daily').uncheck();await app.getByRole('button',{name:'Guardar límites',exact:true}).click();
  console.log('PASS one-time guide, browser back/forward, pinned mobile navigation, explicit unlimited/zero cap and edits survive heartbeats');
  await action('enter');await phase('shopping');assert.match(await store.locator('#accessPanel').innerText(),/Identificado. Puedes entrar/);
  await store.locator('#demoOptions').evaluate(e=>e.open=true);await store.locator('#missingRfid').check();await pick('coffee');
  assert.equal(await store.locator('.count').innerText(),'1');assert.match(await store.locator('#checkoutPanel').innerText(),/Importe pendiente/);assert.doesNotMatch(await store.locator('#checkoutPanel').innerText(),/0,00 €/);
  await app.getByRole('button',{name:'Cesta',exact:true}).click();await app.getByText('Importe pendiente',{exact:true}).waitFor();assert.doesNotMatch(await app.locator('#appMain').innerText(),/0,00 €/);
  await action('exit');await phase('reviewing');assert.equal((await saved()).checkout,null);await action('reconcile');await pick('water');
  await store.locator('#declinePayment').check();await action('exit');await phase('payment_failed');const checkout=(await saved()).checkout.id;
  await store.locator('#retryPaymentMethod').selectOption('Mastercard •••• 1056');await app.waitForTimeout(1700);assert.equal(await store.locator('#retryPaymentMethod').inputValue(),'Mastercard •••• 1056');
  await action('retry');await phase('complete');let s=await saved();assert.equal(s.checkout.id,checkout);assert.equal(s.receipt.payment,'Mastercard •••• 1056');assert.equal(s.pendingProfile.payment,'Visa •••• 4821');assert.equal(s.receipts.length,1);
  await app.getByText('Compra pagada · No se volverá a cobrar esta cesta.',{exact:false}).waitFor();assert.doesNotMatch(await app.locator('#appMain').innerText(),/salida.*inicia el cobro/);
  console.log('PASS pending items counted without zero prices, RFID blocks charge, chosen retry card survives heartbeat, same checkout and paid basket');
  await app.locator('[data-action="receipt"]').click();await app.goBack();await app.waitForFunction(()=>!document.querySelector('#receiptDialog').open);await app.locator('[data-action="receipt"]').click();
  await app.locator('#reportReceipt').click();await app.locator('#issueReason').selectOption('Cantidad o importe incorrecto');await app.locator('#issueDetails').fill('El agua no era mía <script>alert(1)</script>');await app.getByRole('button',{name:'Guardar incidencia de demostración',exact:true}).click();
  await app.getByRole('heading',{name:'Mis incidencias',exact:true}).waitFor();assert.equal(await app.locator('#appMain script').count(),0);assert.match(await app.locator('#appMain').innerText(),/No se han enviado/);
  const issues=await app.evaluate(()=>JSON.parse(localStorage.getItem('takego_issues_v1')));assert.equal(issues.length,1);assert.equal(issues[0].receiptId,s.receipt.id);
  const download=app.waitForEvent('download');await app.getByRole('button',{name:'Descargar copia',exact:true}).click();const copied=fs.readFileSync(await (await download).path(),'utf8');assert.ok(copied.includes(s.receipt.id));assert.match(copied,/No enviada/);
  await app.goBack();await app.waitForFunction(()=>document.querySelector('#receiptDialog').open);assert.match(await app.locator('#receiptContent').innerText(),/FACTURA/);await app.locator('#closeReceipt').click();await app.getByRole('button',{name:'Perfil',exact:true}).click();await app.locator('[data-tab="issues"]').click();await app.reload();assert.equal(await app.locator('[data-action="download-issue"]').count(),1);
  console.log('PASS invoice back closes modal, receipt-linked local issue, escaped details, downloadable copy and reload persistence');
  await limits('3.05');await action('new');await action('enter');await phase('shopping');await pick('water');await action('exit');await phase('limit_exceeded');
  assert.equal(await store.getByRole('button',{name:'Devolver Agua mineral'}).isEnabled(),true);await store.getByRole('button',{name:'Devolver Agua mineral'}).click();await phase('shopping');await action('exit');await phase('left_empty');assert.equal((await saved()).receipts.length,1);
  await limits(null);await action('new');await action('enter');await phase('shopping');await pick('juice');await store.locator('#declinePayment').check();await action('exit');await phase('payment_failed');
  await app.getByRole('button',{name:'Perfil',exact:true}).click();await app.locator('[data-tab="payments"]').click();await app.locator('[data-payment="Bizum (demo)"]').click();
  const retry=app.getByRole('button',{name:'Usar Bizum (demo) en esta compra y reintentar',exact:true});await retry.click();await phase('complete');assert.equal((await saved()).receipt.payment,'Bizum (demo)');assert.equal((await saved()).receipts.length,2);
  console.log('PASS direct return after cap, empty exit without invoice, customer authorizes alternate card for a failed purchase');
  await action('new');await store.locator('#authMethod').selectOption('C');await action('enter');await phase('code');await app.getByRole('button',{name:'Inicio',exact:true}).click();await app.locator('input[name="code"]').fill('123');await app.waitForTimeout(1700);assert.equal(await app.locator('input[name="code"]').inputValue(),'123');
  await store.close();await app.getByText('CONEXIÓN INTERRUMPIDA',{exact:true}).waitFor();assert.equal(await app.locator('#codeForm button').isDisabled(),true);await app.reload();await app.getByRole('heading',{name:'Introduce el código de entrada.',exact:true}).waitFor();assert.equal(await app.locator('#codeForm button').isDisabled(),true);
  store=await context.newPage();await store.goto(storeURL);await phase('code');await app.waitForFunction(()=>!document.querySelector('#codeForm button').disabled);await app.locator('input[name="code"]').fill((await saved()).code);await app.locator('#codeForm button').click();await phase('shopping');
  const duplicate=await context.newPage();await duplicate.goto(storeURL);await duplicate.getByText('Esta tienda virtual ya está abierta en otra pestaña.',{exact:false}).waitFor();await duplicate.close();
  await pick('coffee');await app.close();await store.getByText('App sin conexión · estado guardado',{exact:true}).waitFor();assert.match(await store.locator('#connectionState').innerText(),/sin conexión/);await action('exit');await phase('complete');assert.equal((await saved()).receipts.length,3);
  app=await context.newPage();await app.goto(appURL);await app.getByRole('heading',{name:'Compra pagada. Puedes salir.',exact:true}).waitFor();await app.getByRole('button',{name:'Facturas',exact:true}).click();assert.equal(await app.locator('[data-action="receipt"]').count(),3);assert.equal(await app.evaluate(()=>localStorage.getItem('gasgo_demo')),'unchanged');
  await action('report');await store.locator('#issueReason').selectOption('Problema con la factura');await store.getByRole('button',{name:'Guardar incidencia de demostración',exact:true}).click();await store.getByRole('heading',{name:'Incidencia guardada localmente',exact:true}).waitFor();assert.equal(await app.evaluate(()=>JSON.parse(localStorage.getItem('takego_issues_v1')).length),2);await store.locator('#closeStoreIssue').click();assert.equal((await saved()).receipts.length,3);await app.screenshot({path:'/tmp/takego-ux-facturas.png',fullPage:true});await store.screenshot({path:'/tmp/takego-ux-store.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS connection loss disables stale actions, cached reload/reconnect, stable code input, single terminal lock, app closed during automatic payment and receipt resync; no browser errors');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
