const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const errors=[];
 async function context(){const c=await browser.newContext({viewport:{width:430,height:932}});c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='gasgo.test')return r.abort();const name=u.pathname.replace(/^\/GAS-GO\//,'')||'index.html';const full=path.join(root,name);return r.fulfill({path:full,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':undefined})});return c;}
 const demo=await context();const d=await demo.newPage();await d.goto('https://gasgo.test/GAS-GO/');await d.getByRole('button',{name:/DEMO.*acceso rápido/}).click();await d.locator('#ggv2X').waitFor();await d.locator('#ggv2X').click();assert.equal(await d.evaluate(()=>data.plateVehicles?.length||0),0);assert.equal(await d.evaluate(()=>data.garageExamplesVersion),undefined);await demo.close();
 console.log('PASS DEMO does not populate the FULL garage');
 const c=await context(),p=await c.newPage();await p.goto('https://gasgo.test/GAS-GO/');await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();
 assert.deepEqual(await p.evaluate(()=>data.plateVehicles.map(v=>v.fuel)),['Gasolina 95','Diésel','Eléctrico','Híbrido enchufable']);assert.equal(await p.evaluate(()=>data.vehicle),'Moto principal');assert.equal(await p.evaluate(()=>data.plateVehicles.every(v=>GGPlate.validPlate(v.plate))),true);
 // Sesión FULL ya abierta antes de actualizar: sin pasar por login ni por el garaje.
 await p.evaluate(()=>{data.plateVehicles=[];delete data.garageExamplesVersion;save();});
 await p.getByRole('button',{name:'Cambiar vehículo',exact:true}).click();
 assert.equal(await p.locator('.gg-vehicle-pick').count(),4);assert.equal(await p.evaluate(()=>data.vehicle),'Moto principal');
 await p.evaluate(()=>closeModal());
 await p.evaluate(()=>{data.plateVehicles=[];delete data.garageExamplesVersion;save();render();});
 assert.equal(await p.evaluate(()=>data.plateVehicles.length),4);
 console.log('PASS an existing FULL session initializes examples on quick selection and Home without visiting the garage');
 const history=await p.evaluate(()=>JSON.stringify(data.history));
 await p.locator('.footnav .home').click();await p.locator('#menugrid').getByRole('button',{name:/Mi garaje/}).click();assert.equal(await p.locator('.gg-plate-saved').count(),4);assert.equal(await p.locator('.gg-plate-saved').first().evaluate(el=>el.getBoundingClientRect().top < document.querySelector('.gg-plate-intro').getBoundingClientRect().top),true);
 assert.equal(await p.locator('.gg-plate-saved').first().evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight}),true);
 assert.equal(await p.locator('.gg-garage-current-only').count(),1);assert.equal(await p.locator('.gg-vehicle-current').count(),1);
 const initialRows=await p.locator('.gg-garage-vehicle').evaluateAll(rows=>rows.map(row=>row.dataset.vehiclePlate));assert.equal(new Set(initialRows).size,initialRows.length);
 console.log('PASS saved vehicles appear before the add form and the first vehicle is visible without scrolling');
 await p.evaluate(()=>{window.loadRealStations=async()=>{};const base={lat:41.39,lng:2.16,free:1,total:2,evFree:1,evTotal:2,dist:1,area:'Prueba',kw:50};STATIONS.splice(0,STATIONS.length,...[
 {...base,id:901,name:'Gasolina',gas:1.6,diesel:null,ev:0},
 {...base,id:902,name:'Diésel',gas:null,diesel:1.5,ev:0},
 {...base,id:903,name:'CCS2',gas:null,diesel:null,ev:.3,evConnector:'CCS2',type:'electric'},
 {...base,id:904,name:'Tipo 2',gas:null,diesel:null,ev:.4,evConnector:'Tipo 2',type:'electric'},
 {...base,id:905,name:'Mixta',gas:1.7,diesel:1.55,ev:.5,evConnector:'CCS2',type:'gas'}]);});
 const expected=[['Coche gasolina (ejemplo)','Gasolina 95',[901,905]],['Coche diésel (ejemplo)','Diésel',[902,905]],['Coche eléctrico (ejemplo)','Eléctrico',[903,905]],['Híbrido enchufable (ejemplo)','Gasolina 95',[901,905]]];
 for(const [name,fuel,stations]of expected){const row=p.locator('.gg-plate-saved').filter({hasText:name});await row.getByRole('button',{name:'Elegir',exact:true}).click();assert.equal(await p.evaluate(()=>data.fuel),fuel);assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),stations);
 const plates=await p.locator('.gg-garage-vehicle').evaluateAll(rows=>rows.map(row=>row.dataset.vehiclePlate));assert.equal(plates.length,4);assert.equal(new Set(plates).size,4);assert.equal(await p.locator('.gg-vehicle-current').count(),1);assert.equal(await p.locator('.gg-garage-current-only').count(),0);assert.match(await p.locator('.gg-garage-vehicle').first().innerText(),new RegExp(name.replace(/[()]/g,'\\$&')));
 if(fuel==='Diésel')await p.screenshot({path:'/tmp/gasgo-garage-clean.png'});
 }
 await p.locator('.footnav .home').click();await p.getByRole('button',{name:'Recargar',exact:true}).click();assert.deepEqual(await p.evaluate(()=>shownStations().map(s=>s.id)),[904]);
 await p.getByRole('button',{name:'Cambiar vehículo',exact:true}).click();assert.equal(await p.locator('.gg-vehicle-pick').count(),4);await p.getByRole('button',{name:/Gestionar mi garaje/}).click();
 console.log('PASS a single uniform card per plate; active vehicle is first and is not repeated as a separate card');
 console.log('PASS four examples can be selected, filter the expected fuels/connectors and appear in quick selection');
 const gas=p.locator('.gg-plate-saved').filter({hasText:'Coche gasolina (ejemplo)'});await gas.getByRole('button',{name:'Editar',exact:true}).click();await p.locator('#ggvName').fill('Coche gasolina personalizado');await p.locator('#ggvConfirmFuel').check();await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();
 await p.reload();await p.evaluate(()=>go('Mi vehículo'));assert.equal(await p.locator('.gg-plate-saved').count(),4);assert.equal(await p.evaluate(()=>data.plateVehicles[0].name),'Coche gasolina personalizado');
 p.once('dialog',dialog=>dialog.accept());await p.locator('.gg-plate-saved').filter({hasText:'Coche diésel (ejemplo)'}).getByRole('button',{name:'Eliminar vehículo',exact:true}).click();
 await p.reload();await p.evaluate(()=>go('Mi vehículo'));assert.equal(await p.locator('.gg-plate-saved').count(),3);assert.equal(await p.evaluate(()=>data.plateVehicles.some(v=>v.fuel==='Diésel')),false);
 console.log('PASS reload does not duplicate examples or restore deleted/edited vehicles');
 // Simular la actualización de un garaje existente con una matrícula que coincide con un ejemplo.
 const userVehicle=await p.evaluate(()=>{const v=data.plateVehicles[0];data.plateVehicles=[v];data.customVehicle={...v};data.vehicle=v.name;data.fuel=v.fuel;delete data.garageExamplesVersion;save();return JSON.stringify(v)});
 await p.reload();await p.evaluate(()=>go('Mi vehículo'));
 assert.equal(await p.evaluate(()=>data.plateVehicles.length),4);assert.equal(await p.evaluate(()=>JSON.stringify(data.plateVehicles[0])),userVehicle);assert.equal(await p.evaluate(()=>data.vehicle),'Coche gasolina personalizado');assert.equal(await p.evaluate(()=>JSON.stringify(data.history)),history);
 assert.equal(await p.evaluate(()=>new Set(data.plateVehicles.map(v=>GGPlate.norm(v.plate))).size),4);assert.deepEqual(errors,[]);
 console.log('PASS existing vehicles, selected vehicle and history are preserved; plate collisions do not overwrite data');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
