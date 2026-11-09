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
 // Aislar las pruebas de edición de la migración de vehículos de ejemplo.
 data.plateVehicles=[];data.presentationDemo=false;data.fuel='Gasolina 95';filterFuel='Todos';go('Home');
});
const historyBefore=await p.evaluate(()=>JSON.stringify(data.history));
const garage=async()=>{await p.getByRole('button',{name:'Cambiar vehículo',exact:true}).click();await p.getByRole('button',{name:'Gestionar mi garaje',exact:true}).click()};
const home=async()=>{await p.locator('#content > .gg-back').click();await p.locator('.gg-active-vehicle').waitFor()};
const filters=async()=>{await p.locator('.mapcontrols').getByRole('button',{name:'Filtros',exact:true}).click()};
assert.match(await p.locator('.gg-active-vehicle').innerText(),/Moto principal/);
await garage();await p.locator('.gg-vehicle-current').getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await p.locator('#ggvModel').inputValue(),'Yamaha XMAX 300');
await p.locator('#ggvName').fill('Moto trabajo');await p.locator('#ggvConfirmFuel').check();await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();
assert.deepEqual(await p.evaluate(()=>[data.vehicle,data.plateVehicles.length,data.customVehicle.kind]),['Moto trabajo',1,'Moto']);
await home();assert.match(await p.locator('.gg-active-vehicle').innerText(),/Moto trabajo/);
console.log('PASS active vehicle visible; editing the initial vehicle preserves its model and type');
await garage();await p.getByRole('button',{name:/Manualmente/}).click();
for(const [id,value]of Object.entries({ggvName:'Mi híbrido',ggvBrand:'SEAT',ggvModel:'León',ggvPlate:'5678 FGH'}))await p.locator('#'+id).fill(value);
await p.locator('#ggvFuel').selectOption('Híbrido enchufable');await p.locator('#ggvCombustion').selectOption('Diésel');await p.locator('#ggvConnector').selectOption('Tipo 2');await p.locator('#ggvConfirmFuel').check();await p.getByRole('button',{name:'Guardar y seleccionar',exact:true}).click();
let moto=p.locator('.gg-plate-saved').filter({hasText:'Moto trabajo'});await moto.getByRole('button',{name:'Editar',exact:true}).click();await p.locator('#ggvName').fill('Cambio cancelado');await p.getByRole('button',{name:'Cancelar',exact:true}).click();
assert.equal(await p.evaluate(()=>data.plateVehicles[0].name),'Moto trabajo');
await moto.getByRole('button',{name:'Editar',exact:true}).click();await p.locator('#ggvName').fill('Moto fin de semana');await p.locator('#ggvConfirmFuel').check();await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();
assert.equal(await p.evaluate(()=>data.vehicle),'Mi híbrido');assert.equal(await p.evaluate(()=>data.plateVehicles.length),2);
await home();await p.getByRole('button',{name:'Cambiar vehículo',exact:true}).click();await p.getByRole('button',{name:/Moto fin de semana/}).click();assert.equal(await p.evaluate(()=>data.vehicle),'Moto fin de semana');
await filters();assert.equal(await p.locator('#modalFuel').count(),0);assert.equal(await p.locator('#modalConnector').count(),0);assert.match(await p.locator('label[for="modalPrice"]').innerText(),/€\/L/);
await p.locator('#modalPrice').selectOption('1.6');await p.getByRole('button',{name:'Aplicar filtros',exact:true}).click();assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[11]);
await filters();await p.getByRole('button',{name:'Limpiar',exact:true}).click();
console.log('PASS inactive edits and cancel preserve selection; quick vehicle switch and fuel-specific filters');
await p.getByRole('button',{name:'Cambiar vehículo',exact:true}).click();await p.getByRole('button',{name:/Mi híbrido/}).click();assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[12,14]);
await p.getByRole('button',{name:'Recargar',exact:true}).click();await filters();assert.equal(await p.locator('#modalConnector').inputValue(),'Tipo 2');assert.equal(await p.locator('#modalConnector').isDisabled(),true);assert.match(await p.locator('label[for="modalPrice"]').innerText(),/€\/kWh/);
await p.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
await p.evaluate(()=>{STATIONS.find(s=>s.id===13).kw=22;STATIONS.find(s=>s.id===14).kw=150});
await filters();await p.locator('#modalPower').selectOption('50');await p.locator('#modalPrice').selectOption('0.5');await p.getByRole('button',{name:'Aplicar filtros',exact:true}).click();assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[14]);
await p.getByRole('button',{name:/Vista en lista/}).click();const summary=p.locator('.list-station-card .gg-service-summary');assert.match(await summary.innerText(),/0,400/);assert.match(await summary.innerText(),/kWh/);assert.doesNotMatch(await summary.innerText(),/Gasolina|Diésel/);assert.equal(await p.locator('.list-price-row').isVisible(),false);assert.equal(await summary.evaluate(el=>!!(el.compareDocumentPosition(el.parentElement.querySelector('.gg-secondary-details'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
await p.getByRole('button',{name:'Ver en mapa',exact:true}).click();const popup=p.locator('.gg-station-popup');assert.match(await popup.locator('.gg-service-summary').innerText(),/Tipo 2/);assert.equal(await popup.locator('.gg-report-station').isVisible(),true);
await popup.locator('.gg-secondary-details > summary').click();assert.equal(await popup.locator('.gg-price-pair').isVisible(),true);
await p.screenshot({path:'/workspace/gasgo-dev/full-v3-station.png'});
await popup.locator('.close').click();await filters();await p.getByRole('button',{name:'Limpiar',exact:true}).click();await p.getByRole('button',{name:'Ver ambas',exact:true}).click();await filters();assert.equal(await p.locator('#modalPrice').isDisabled(),true);assert.equal(await p.locator('#modalSort').isDisabled(),true);
await p.locator('#modalPower').selectOption('50');await p.getByRole('button',{name:'Aplicar filtros',exact:true}).click();assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[12,14]);
console.log('PASS charge power/connector/price filters, clear selected-service cards, details retained, both-service rules');
await garage();await p.locator('.gg-vehicle-current').getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await p.locator('#ggvModel').inputValue(),'León');await p.locator('#ggvPlate').fill('9876 JKL');await p.locator('#ggvConnector').selectOption('CCS2');await p.locator('#ggvConfirmFuel').check();await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();
assert.deepEqual(await p.evaluate(()=>[data.plateVehicles.length,data.customVehicle.model,data.customVehicle.plate,data.energyPreferences['9876JKL']]),[2,'SEAT León','9876JKL','both']);
await p.locator('.gg-vehicle-current').getByRole('button',{name:'Editar',exact:true}).click();await p.locator('#ggvPlate').fill('1234 MTR');await p.locator('#ggvConfirmFuel').check();await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();assert.match(await p.locator('#ggvError').innerText(),/otro vehículo/);await p.getByRole('button',{name:'Cancelar',exact:true}).click();
assert.equal(await p.evaluate(()=>JSON.stringify(data.history)),historyBefore);
await home();await p.getByRole('button',{name:'Recargar',exact:true}).click();await filters();await p.getByRole('button',{name:'Limpiar',exact:true}).click();assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[15]);
await p.locator('.geo-pin,.gg-map-cluster').first().waitFor({state:'attached'});await p.screenshot({path:'/workspace/gasgo-dev/full-v3-map.png'});
console.log('PASS active edit renames plate without duplicates, migrates service preference, rejects conflicts, preserves receipts and updates connector filtering');
await p.evaluate(()=>go('Bienvenida'));await p.getByRole('button',{name:/DEMO.*acceso rápido/}).click();await p.locator('#ggv2X').waitFor();await p.locator('#ggv2X').click();assert.equal(await p.locator('.gg-active-vehicle').count(),0);
await p.locator('.mapcontrols').getByRole('button',{name:/Filtros/}).click();assert.equal(await p.locator('#modalFuel').count(),1);assert.equal(await p.locator('#modalConnector').count(),0);assert.deepEqual(errors,[]);
console.log('PASS DEMO retains original filters and no FULL vehicle card; no browser exceptions');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
