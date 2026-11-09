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
 data.plateVehicles=[];data.presentationDemo=false;data.customVehicle=null;data.fuel='Gasolina 95';filterFuel='Todos';go('Home');
});
assert.equal(await p.locator('#content > .gg-back').count(),0);
assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[11,14]);
await p.evaluate(()=>{data.fuel='Diésel';render()});assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[12,14]);
await p.evaluate(()=>{data.fuel='Eléctrico';render()});assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[13,14,15]);
assert.equal(await p.locator('.gg-energy-switch').count(),0);console.log('PASS only compatible gasoline, diesel and electric stations; no hybrid controls');
await p.evaluate(()=>go('Mi vehículo'));await p.getByRole('button',{name:/Manualmente/}).click();
await p.locator('#ggvBrand').fill('SEAT');await p.locator('#ggvModel').fill('León');await p.locator('#ggvName').fill('Mi híbrido');await p.locator('#ggvPlate').fill('1234 BCD');
await p.locator('#ggvFuel').selectOption('Híbrido enchufable');assert.equal(await p.locator('#ggvMotorFields').isVisible(),true);
await p.locator('#ggvCombustion').selectOption('Gasolina 95');await p.locator('#ggvConfirmFuel').check();await p.getByRole('button',{name:'Guardar y seleccionar',exact:true}).click();assert.match(await p.locator('#ggvError').innerText(),/conector/);
await p.locator('#ggvConnector').selectOption('Tipo 2');await p.getByRole('button',{name:'Guardar y seleccionar',exact:true}).click();
assert.deepEqual(await p.evaluate(()=>[data.customVehicle.fuel,data.customVehicle.combustionFuel,data.customVehicle.connector,data.fuel]),['Híbrido enchufable','Gasolina 95','Tipo 2','Gasolina 95']);
await p.locator('#content > .gg-back').click();assert.equal(await p.locator('.gg-energy-switch').count(),1);await p.evaluate(()=>setVehicle('Coche eléctrico'));assert.equal(await p.locator('.gg-energy-switch').count(),0);await p.evaluate(()=>setVehicle('Coche familiar'));assert.equal(await p.locator('.gg-energy-switch').count(),0);await p.evaluate(()=>GGPlate.select(0));assert.equal(await p.locator('.gg-energy-switch').count(),1);await p.getByRole('button',{name:'Recargar',exact:true}).click();assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[13,14]);
await p.getByRole('button',{name:'Ver ambas',exact:true}).click();assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[11,13,14]);
await p.evaluate(()=>ggUX.selectStation(14));await p.getByRole('button',{name:'Recargar',exact:true}).last().click();assert.equal(await p.evaluate(()=>data.fuel),'Eléctrico');
await p.evaluate(()=>{go('Mi vehículo');go('Configuración')});await p.locator('#content > .gg-back').click();assert.equal(await p.evaluate(()=>page),'Mi vehículo');await p.locator('#content > .gg-back').click();assert.equal(await p.evaluate(()=>page),'Home');assert.equal(await p.evaluate(()=>ggUX.energyMode()),'charge');
await p.reload();assert.equal(await p.evaluate(()=>ggUX.energyMode()),'charge');
console.log('PASS hybrid garage validation, connector filtering, both services, back stack and saved preference');
await p.evaluate(()=>go('Home'));await c.grantPermissions(['geolocation'],{origin:'https://gasgo.test'});
await p.getByRole('button',{name:'Localizarme con GPS',exact:true}).click();
await p.waitForFunction(()=>userPosition?.lat===41.39);
await p.evaluate(()=>updateRealMap());
assert.equal(await p.evaluate(()=>Object.values(geoMap._layers).some(l=>l.options?.icon?.options?.className==='gg-user-dot')),true);
assert.equal(await p.evaluate(()=>Object.values(geoMap._layers).some(l=>l.options?.icon?.options?.html?.includes('gg-map-cluster'))),true);
await p.screenshot({path:'/workspace/gasgo-dev/ux-hybrid-draft.png',fullPage:true});
console.log('PASS real Leaflet blue location and station clustering');
await c.clearPermissions();await c.grantPermissions([],{origin:'https://gasgo.test'});
await p.getByRole('button',{name:'Localizarme con GPS',exact:true}).click();await p.waitForFunction(()=>userPosition===null&&geoStatus.includes('denegada'));
await p.evaluate(()=>updateRealMap());assert.equal(await p.locator('.gg-user-dot').count(),0);assert.equal(await p.getByRole('button',{name:'Localizarme con GPS',exact:true}).isEnabled(),true);
console.log('PASS denied geolocation removes old dot and allows retry');
await p.evaluate(()=>go('Bienvenida'));await p.getByRole('button',{name:'Registrarse',exact:true}).click();
for(const [key,val]of Object.entries({first:'Ana',last:'Prueba',email:'ana@example.test'}))await p.locator('#reg_'+key).fill(val);
await p.getByRole('button',{name:'Continuar →',exact:true}).click();await p.locator('#reg_model').fill('Modelo PHEV');await p.locator('#reg_plate').fill('5678 FGH');await p.locator('#reg_fuel').selectOption('Híbrido enchufable');await p.locator('#reg_combustionFuel').selectOption('Diésel');await p.locator('#reg_connector').selectOption('CCS2');
await p.getByRole('button',{name:'Continuar →',exact:true}).click();await p.locator('#content > .gg-back').click();assert.equal(await p.locator('#reg_connector').inputValue(),'CCS2');await p.getByRole('button',{name:'Continuar →',exact:true}).click();await p.getByRole('button',{name:'Crear cuenta demo',exact:true}).click();
assert.deepEqual(await p.evaluate(()=>[data.customVehicle.fuel,data.customVehicle.combustionFuel,data.customVehicle.connector,data.fuel]),['Híbrido enchufable','Diésel','CCS2','Diésel']);
assert.deepEqual(errors,[]);console.log('PASS hybrid registration and retained form values; no browser exceptions');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
