const {chromium}=require('playwright');
const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const leaflet=path.dirname(require.resolve('leaflet/dist/leaflet.js',{paths:[process.env.GASGO_TEST_DEPS||'/workspace/gasgo-dev/node_modules']}));
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
const c=await b.newContext({viewport:{width:430,height:932},geolocation:{latitude:41.39,longitude:2.16}});const errors=[];
c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='unpkg.com'&&u.pathname.endsWith('leaflet.js'))return r.fulfill({path:path.join(leaflet,'leaflet.js'),contentType:'text/javascript'});if(u.hostname==='unpkg.com'&&u.pathname.endsWith('leaflet.css'))return r.fulfill({path:path.join(leaflet,'leaflet.css'),contentType:'text/css'});if(u.hostname!=='gasgo.test')return r.abort();const f=u.pathname.replace(/^\/GAS-GO\//,'')||'index.html';return r.fulfill({path:path.join(root,f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':undefined});});
const p=await c.newPage();await p.goto('https://gasgo.test/GAS-GO/');
await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
await p.evaluate(()=>{
 window.loadRealStations=async()=>{if(page==='Home')render()};
 const base={...STATIONS[0],lat:41.39,lng:2.16,free:2,total:3,evFree:2,evTotal:3,evConnector:'Tipo 2',kw:22};
 STATIONS.splice(0,STATIONS.length,...[
 {...base,id:11,name:'Solo gasolina',gas:1.6,diesel:null,ev:0,dist:1},
 {...base,id:12,name:'Solo diésel',gas:null,diesel:1.5,ev:0,dist:2},
 {...base,id:13,name:'Carga Tipo 2',gas:null,diesel:null,ev:.3,type:'electric',dist:3},
 {...base,id:14,name:'Ambos servicios',gas:1.7,diesel:1.55,ev:.4,dist:4},
 {...base,id:15,name:'Carga CCS2',gas:null,diesel:null,ev:.5,evConnector:'CCS2',type:'electric',dist:5}]);
 data.presentationDemo=false;data.fuel='Gasolina 95';filterFuel='Todos';go('Home');
});
await p.waitForFunction(()=>document.body.classList.contains('gg-full-icons'));
assert.equal(await p.locator('.footnav .house [data-gg-icon="home"]').count(),1);
assert.equal(await p.locator('#ggv2ConnectBtn [data-gg-icon="link"]').count(),1);
await p.locator('.footnav .home').click();
assert.equal(await p.locator('#menugrid .circle .gg-google-icon').count(),6);
await p.screenshot({path:'/workspace/gasgo-dev/full-google-menu.png'});
await p.locator('#menugrid').getByRole('button',{name:/Mi garaje/}).click();
await p.locator('.gg-vehicle-current [data-gg-icon="two_wheeler"]').waitFor();
assert.equal(await p.evaluate(()=>data.customVehicle.emoji),'🛵');
await p.screenshot({path:'/workspace/gasgo-dev/full-google-garage.png'});
await p.getByRole('button',{name:/Manualmente/}).click();
await p.locator('#ggvName').fill('Mi 🚙 coche');assert.equal(await p.locator('#ggvName').inputValue(),'Mi 🚙 coche');
assert.equal(await p.locator('.gg-choice-icon .gg-google-icon').count()>0,true);
await p.getByRole('button',{name:'Cancelar',exact:true}).click();
await p.evaluate(()=>go('Historial'));await p.getByRole('button',{name:'Ver y descargar factura',exact:true}).first().click();
assert.equal(await p.locator('.gg-invoice-preview .gg-google-icon').count(),0);
await p.getByRole('button',{name:'Cerrar',exact:true}).click();
await p.evaluate(()=>go('Home'));await p.evaluate(()=>{selectedStation=11;render()});
const star=p.locator('.gg-station-popup button[onclick^="fav("]');await p.locator('.gg-station-popup .gg-secondary-details > summary').click();
assert.equal(await star.locator('[data-gg-icon="star"]').count(),1);await star.click();
await p.locator('.gg-station-popup [data-gg-icon="star_filled"]').waitFor({state:'attached'});
assert.equal(await p.locator('.gg-station-popup .gg-primary-actions').getByRole('button',{name:/Simular llegada/}).count(),1);
console.log('PASS FULL Google navigation, garage and dynamic dialogs; text, input and receipt data preserved; favorite state remains visible');
await p.evaluate(()=>go('Bienvenida'));await p.getByRole('button',{name:/DEMO.*acceso rápido/}).click();
await p.locator('#ggv2X').waitFor();await p.locator('#ggv2X').click();
assert.equal(await p.locator('.gg-google-icon').count(),0);assert.equal(await p.locator('.footnav .house').innerText(),'⌂');assert.equal(await p.locator('#ggv2ConnectBtn').innerText(),'🔗');
await p.locator('.footnav .home').click();assert.match(await p.locator('#menugrid').innerText(),/🚙/);
console.log('PASS DEMO restores original emoji icons after visiting FULL');
await p.evaluate(()=>go('Bienvenida'));await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await p.locator('#ggv2ConnectBtn [data-gg-icon="link"]').waitFor();
assert.equal(await p.evaluate(()=>data.customVehicle.emoji),'🛵');assert.deepEqual(errors,[]);
console.log('PASS returning to FULL reapplies Google icons with no browser errors');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
