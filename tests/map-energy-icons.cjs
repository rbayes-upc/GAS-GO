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
 data.presentationDemo=false;data.customVehicle=null;data.fuel='Gasolina 95';filterFuel='Todos';go('Home');
});
await p.evaluate(()=>{
 const base={...STATIONS[0],lat:41.39,free:2,total:3,evFree:2,evTotal:3,evConnector:'Tipo 2'};
 STATIONS.splice(0,STATIONS.length,...[
 {...base,id:21,name:'Solo combustible',lng:2.160,gas:1.6,diesel:1.5,ev:0,dist:1},
 {...base,id:22,name:'Solo eléctrico',lng:2.161,gas:null,diesel:null,ev:.3,type:'electric',dist:2},
 {...base,id:23,name:'Estación mixta',lng:2.162,gas:1.7,diesel:1.55,ev:.4,dist:3}]);
 data.vehicle='Mi híbrido';data.customVehicle={name:'Mi híbrido',plate:'1234 BCD',fuel:'Híbrido enchufable',combustionFuel:'Gasolina 95',connector:'Tipo 2'};
 mapCenter={lat:41.39,lng:2.161};ggUX.setEnergy('both');
});
await p.waitForFunction(()=>geoMap&&geoMap.getContainer().isConnected);await p.evaluate(()=>geoMap.setView(mapCenter,17,{animate:false}));
const gas=p.locator('.geo-pin[aria-label="Solo combustible"]'),ev=p.locator('.geo-pin[aria-label="Solo eléctrico"]'),mixed=p.locator('.geo-pin[aria-label="Estación mixta"]');
await ev.locator('[data-gg-icon="bolt"]').waitFor({state:'attached'});await mixed.locator('[data-gg-icon="local_gas_station"]').waitFor({state:'attached'});
for(const marker of [ev,mixed])assert.equal(await marker.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 223, 46)');
assert.equal(await gas.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(7, 81, 62)');
assert.equal(await gas.locator('[data-gg-icon="local_gas_station"]').count(),1);
console.log('PASS electric = brand yellow + Google bolt; mixed = brand yellow + fuel pump; fuel-only stays green');
await p.evaluate(()=>ggUX.setEnergy('charge'));await p.waitForFunction(()=>geoMap&&geoMap.getContainer().isConnected);await p.evaluate(()=>geoMap.setView(mapCenter,17,{animate:false}));
await mixed.locator('[data-gg-icon="local_gas_station"]').waitFor({state:'attached'});
await mixed.click();await p.locator('.gg-station-popup').getByRole('button',{name:'Simular recarga',exact:true}).waitFor();
console.log('PASS mixed station retains pump icon while its charge action remains available');
await p.locator('.gg-station-popup .close').click();await p.waitForFunction(()=>geoMap&&geoMap.getContainer().isConnected);await p.evaluate(()=>geoMap.setView(mapCenter,17,{animate:false}));
await p.getByRole('button',{name:'Estación mixta',exact:true}).press('Enter');await p.locator('.gg-station-popup').getByRole('button',{name:'Simular recarga',exact:true}).waitFor();
console.log('PASS mixed station remains accessible by keyboard');
await p.evaluate(()=>{selectedStation=null;render()});await p.waitForFunction(()=>geoMap&&geoMap.getContainer().isConnected);await p.evaluate(()=>geoMap.setView(mapCenter,9,{animate:false}));
assert.equal(await p.locator('.gg-map-cluster-charging').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 223, 46)');
console.log('PASS groups containing charging points use the same yellow');
await p.evaluate(()=>go('Bienvenida'));await p.getByRole('button',{name:/DEMO.*acceso rápido/}).click();await p.locator('#ggv2X').waitFor();await p.locator('#ggv2X').click();
assert.equal(await p.locator('.gg-google-icon').count(),0);await p.locator('.gg-demo-map-marker').waitFor();assert.match(await p.locator('.gg-demo-map-marker').innerText(),/⛽/);
assert.deepEqual(errors,[]);console.log('PASS DEMO keeps its original station marker and emoji');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
