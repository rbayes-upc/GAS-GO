const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),leaflet=path.dirname(require.resolve('leaflet/dist/leaflet.js',{paths:['/workspace/gasgo-dev/node_modules']}));
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const c=await b.newContext({viewport:{width:430,height:932}}),errors=[],queries=[],bounds=[];let geocodeMode='ok',stationFailure=false,plannerFallback=false,plannerQuery=false,pendingGeocode;
 c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await c.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(u.hostname==='nominatim.openstreetmap.org'){
   queries.push(u.searchParams.get('q'));
   if(geocodeMode==='pending'){pendingGeocode=r;return}
   if(geocodeMode==='error')return r.fulfill({status:503,body:'unavailable',headers:{'access-control-allow-origin':'*'}});
   return r.fulfill({json:geocodeMode==='empty'?[]:geocodeMode==='tarragona'?[{lat:'41.1189',lon:'1.2445',display_name:'Tarragona, Catalunya, España'}]:[{lat:'41.9794',lon:'2.8214',display_name:'Girona, Gironès, Catalunya, España'},{lat:'41.98',lon:'2.82',display_name:'Carrer de Girona, Catalunya, España'}],headers:{'access-control-allow-origin':'*'}});
  }
  if(u.hostname==='routing.openstreetmap.de'){
   plannerQuery=true;
   assert.match(u.pathname,/^\/routed-car\/route\/v1\/driving\//);
   return r.fulfill({json:{routes:[{distance:94000,geometry:{coordinates:[[2.17,41.38],[2.4,41.6],[2.8214,41.9794]]}}]}});
  }
  if(u.hostname==='overpass.kumi.systems'&&r.request().postData()?.includes('around')){
   if(plannerFallback)return r.fulfill({status:503,body:'unavailable'});
   return r.fulfill({json:{elements:[
    {lat:41.6,lon:2.4,tags:{name:'Parada central'}},
    {center:{lat:41.96,lon:2.8},tags:{brand:'Parada final'}},
    {lat:41.49,lon:2.4,tags:{name:'Parada dentro de 10 km'}},
    {lat:41.1,lon:2.4,tags:{name:'Fuera de ruta'}},
   ]}});
  }
  if(u.hostname==='energia.serviciosmin.gob.es')return r.fulfill({json:{ListaEESSPrecio:[]}});
  if(u.hostname==='puntomuerto.es'){
   if(plannerQuery&&u.searchParams.get('limit')==='800'){
    if(!plannerFallback)return r.fulfill({status:503,body:'unavailable'});
    return r.fulfill({json:{estaciones:[
     {lat:'41,6',lng:'2,4',rotulo:'Parada alternativa',precios:{g95e5:1.85,'gasoleo-a':'1,45'}},
     ...Array.from({length:5},(_,i)=>({lat:41.65+i*.05,lng:2.45+i*.05,rotulo:'Estación '+(i+2),precios:{g95e5:1.85,'gasoleo-a':1.5+i*.05}})),
    ]}});
   }
   const lat=(Number(u.searchParams.get('minLat'))+Number(u.searchParams.get('maxLat')))/2,lng=(Number(u.searchParams.get('minLng'))+Number(u.searchParams.get('maxLng')))/2;bounds.push({lat,lng});
   if(stationFailure)return r.fulfill({status:503,body:'unavailable'});
   return r.fulfill({json:{estaciones:[{id:551,rotulo:'Estación zona buscada',direccion:'Carrer de prova',localidad:'Girona',lat:lat+.001,lng:lng+.001,precios:{g95e5:1.65,'gasoleo-a':1.55}},{id:552,rotulo:'Estación otra ciudad',lat:40.4,lng:-3.7,precios:{g95e5:1.5,'gasoleo-a':1.4}}]}});
  }
  if(u.hostname==='unpkg.com'&&/leaflet\.(js|css)$/.test(u.pathname)){const file=u.pathname.endsWith('.js')?'leaflet.js':'leaflet.css';return r.fulfill({path:path.join(leaflet,file),contentType:file.endsWith('.js')?'text/javascript':'text/css'})}
  if(u.hostname!=='gasgo.test')return r.abort();
  const f=u.pathname.replace(/^\/GAS-GO\//,'')||'index.html';return r.fulfill({path:path.join(root,f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':undefined});
 });
 const p=await c.newPage();await p.clock.install();await p.goto('https://gasgo.test/GAS-GO/');await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await p.waitForFunction(()=>!geoLoading);
 await p.evaluate(()=>{userPosition={lat:41.38,lng:2.17};navigator.geolocation.getCurrentPosition=ok=>window.pendingPosition=ok;locateUser()});
 await p.getByRole('button',{name:'Buscar dirección, población o estación',exact:true}).click();await p.locator('#ggPlaceQuery').fill('Gi');assert.equal(queries.length,0);await p.getByRole('button',{name:'Buscar dirección o población',exact:true}).click();assert.match(await p.locator('#ggPlaceStatus').innerText(),/al menos 3/);assert.equal(queries.length,0);
 await p.locator('#ggPlaceQuery').fill('Girona');assert.equal(queries.length,0);await p.locator('#ggPlaceQuery').press('Enter');await p.locator('#ggPlaceResults button').first().waitFor({timeout:5000}).catch(async e=>{console.log({dialog:await p.locator('#overlay').innerText(),queries,errors});throw e});assert.equal(queries.length,1);assert.equal(await p.locator('#ggPlaceResults button').count(),2);await p.screenshot({path:'/tmp/gasgo-search.png'});
 await p.locator('#ggPlaceResults button').first().click();await p.waitForFunction(()=>!geoLoading);assert.match(await p.locator('.gg-search-area').innerText(),/Explorando: Girona/);assert.equal(await p.evaluate(()=>mapCenter.lat),41.9794);assert.deepEqual(await p.evaluate(()=>userPosition),{lat:41.38,lng:2.17});assert.ok(Math.abs(bounds.at(-1).lat-41.9794)<.001);assert.equal(await p.evaluate(()=>shownStations().some(s=>s.name==='Estación zona buscada')),true);assert.equal(await p.evaluate(()=>shownStations().some(s=>s.name==='Estación otra ciudad')),false);assert.equal(await p.locator('.gg-user-dot').count(),1);await p.evaluate(()=>pendingPosition({coords:{latitude:41.38,longitude:2.17}}));await p.waitForFunction(()=>!geoLoading);assert.equal(await p.evaluate(()=>mapCenter.lat),41.9794);
 console.log('PASS explicit address/town search, minimum query, choice of results, station loading around the chosen place and unchanged blue location');
 await p.getByRole('button',{name:'Buscar dirección, población o estación',exact:true}).click();await p.locator('#ggPlaceQuery').fill('Girona');await p.locator('#ggPlaceQuery').press('Enter');await p.locator('#ggPlaceResults button').first().waitFor();assert.equal(queries.length,1);await p.keyboard.press('Escape');
 await p.getByRole('button',{name:'Volver a la zona anterior',exact:true}).click();await p.waitForFunction(()=>!geoLoading);assert.equal(await p.locator('.gg-search-area').count(),0);assert.ok(Math.abs(await p.evaluate(()=>mapCenter.lat)-41.3874)<.1);
 await p.clock.fastForward(1101);geocodeMode='empty';await p.evaluate(()=>openSearch());await p.locator('#ggPlaceQuery').fill('Lugar inexistente');await p.locator('#ggPlaceQuery').press('Enter');await p.waitForFunction(()=>document.getElementById('ggPlaceStatus').textContent.includes('No se han encontrado'));assert.equal(await p.locator('#ggPlaceResults button').count(),0);
 await p.clock.fastForward(1101);geocodeMode='error';await p.locator('#ggPlaceQuery').fill('Barcelona nueva búsqueda');await p.locator('#ggPlaceQuery').press('Enter');await p.waitForFunction(()=>document.getElementById('ggPlaceStatus').textContent.includes('Comprueba Internet'));assert.equal(await p.locator('#ggPlaceForm button').isEnabled(),true);
 await p.clock.fastForward(1101);geocodeMode='pending';await p.locator('#ggPlaceQuery').fill('Dirección lenta');const slow=p.waitForRequest(r=>r.url().includes('nominatim')&&r.url().includes('lenta'));await p.locator('#ggPlaceQuery').press('Enter');await slow;await p.clock.fastForward(10001);await p.waitForFunction(()=>document.getElementById('ggPlaceStatus').textContent.includes('tarda demasiado'));assert.equal(await p.locator('#ggPlaceForm button').isEnabled(),true);await pendingGeocode.abort().catch(()=>{});
 await p.clock.fastForward(1101);await p.locator('#ggPlaceQuery').fill('Dirección cancelada');const cancelled=p.waitForRequest(r=>r.url().includes('nominatim')&&r.url().includes('cancelada'));await p.locator('#ggPlaceQuery').press('Enter');await cancelled;await p.keyboard.press('Escape');await pendingGeocode.fulfill({json:[]}).catch(()=>{});assert.equal(await p.locator('#overlay [role=dialog]').count(),0);
 await p.clock.fastForward(1101);geocodeMode='tarragona';stationFailure=true;await p.evaluate(()=>openSearch());await p.locator('#ggPlaceQuery').fill('Tarragona');await p.locator('#ggPlaceQuery').press('Enter');await p.locator('#ggPlaceResults button').first().click();await p.waitForFunction(()=>!geoLoading);
 assert.match(await p.locator('.gg-search-area').innerText(),/No se han podido actualizar/);assert.equal(await p.evaluate(()=>shownStations().some(s=>s.demoOnly)),false);
 stationFailure=false;await p.locator('.gg-search-area').getByRole('button',{name:'Reintentar',exact:true}).click();await p.waitForFunction(()=>!geoLoading);assert.doesNotMatch(await p.locator('.gg-search-area').innerText(),/No se han podido actualizar/);assert.equal(await p.evaluate(()=>shownStations().some(s=>s.name==='Estación zona buscada')),true);
 await p.getByRole('button',{name:'Volver a la zona anterior',exact:true}).click();await p.waitForFunction(()=>!geoLoading);
 console.log('PASS cached geocoding, empty results, network failure with retry, return to previous area and no distant demo stations presented as search results');
 // Datos deterministas para comprobar precios y distancias, sin alterar el código de la app.
 await p.evaluate(()=>{window.loadRealStations=async()=>{};const base={dist:1,time:220,lat:41.39,lng:2.16,area:'Prueba',free:2,total:3,evFree:2,evTotal:3,evConnector:'CCS2',kw:100,officialSource:true};mapCenter={lat:41.39,lng:2.16};STATIONS.splice(0,STATIONS.length,...[
 {...base,id:71,name:'Cercana gasolina',gas:1.8,diesel:null,ev:0},
 {...base,id:72,name:'Barata mixta',lat:41.42,gas:1.5,diesel:1.4,ev:.5},
 {...base,id:73,name:'Solo diésel',lat:41.40,gas:null,diesel:1.35,ev:0},
 {...base,id:74,name:'Carga CCS2 barata',lat:41.41,gas:null,diesel:null,ev:.25,type:'electric'},
 {...base,id:75,name:'Carga Tipo 2',lat:41.43,gas:null,diesel:null,ev:.2,type:'electric',evConnector:'Tipo 2'},
 {...base,id:76,name:'Gasolina ocupada',lat:41.44,gas:1.4,diesel:null,ev:0,free:0}]);geoStationMode='official';GGPlate.select(0);go('Home');clearMapFilters()});
 await p.evaluate(()=>ggExplore.compare());assert.equal(await p.locator('.gg-compare-table tbody tr').count(),3);assert.equal(await p.locator('.gg-compare-table tbody tr').first().getAttribute('data-station-id'),'76');await p.locator('#ggCompareSort').selectOption('distance');assert.equal(await p.locator('.gg-compare-table tbody tr').first().getAttribute('data-station-id'),'71');assert.match(await p.locator('.gg-compare-table').innerText(),/Gasolina 95|Precio/);await p.screenshot({path:'/tmp/gasgo-compare.png'});assert.doesNotMatch(await p.locator('.gg-compare-table').innerText(),/Solo diésel|Carga CCS2/);
 await p.locator('#overlay').getByRole('button',{name:'Barata mixta',exact:true}).click();assert.equal(await p.evaluate(()=>selectedStation),72);assert.equal(await p.evaluate(()=>simulation),null);
 await p.evaluate(()=>{onlyAvailable=true;maxPrice=1.6;render()});await p.evaluate(()=>ggExplore.compare());assert.equal(await p.locator('.gg-compare-table tbody tr').count(),1);assert.equal(await p.locator('.gg-compare-table tbody tr').first().getAttribute('data-station-id'),'72');await p.evaluate(()=>closeModal());
 await p.evaluate(()=>{GGPlate.select(1);clearMapFilters();setStationView('list')});assert.equal(await p.locator('.gg-list-source,.list-summary>b,.list-summary>span').count(),0);assert.doesNotMatch(await p.evaluate(()=>stationList()),/Estaciones y áreas de servicio|gg-list-source|resultados ·/);for(const width of [320,375,430]){await p.setViewportSize({width,height:932});for(const selector of ['.list-summary button[onclick="openMapFilters()"]','.list-summary .gg-plan-open']){const rect=await p.locator(selector).boundingBox();assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=width)}}await p.screenshot({path:'/tmp/gasgo-list-clean.png'});await p.locator('.list-summary').getByRole('button',{name:/Filtros/}).click();assert.equal(await p.locator('#modalMapQuery').isVisible(),true);await p.evaluate(()=>closeModal());await p.evaluate(()=>ggExplore.compare());assert.equal(await p.locator('.gg-compare-table tbody tr').count(),2);assert.equal(await p.locator('.gg-compare-table tbody tr').first().getAttribute('data-station-id'),'73');await p.evaluate(()=>closeModal());
 await p.evaluate(()=>{GGPlate.select(2);clearMapFilters();go('Home')});await p.evaluate(()=>ggExplore.compare());assert.equal(await p.locator('.gg-compare-table tbody tr').count(),2);assert.match(await p.locator('.gg-compare-table').innerText(),/kWh/);assert.doesNotMatch(await p.locator('.gg-compare-table').innerText(),/Carga Tipo 2/);await p.evaluate(()=>closeModal());
 console.log('PASS gasoline/diesel/electric comparison, sorting by price or distance, matching connectors, map filters, list access and opening a station without starting supply');
 await p.evaluate(()=>{GGPlate.select(3);clearMapFilters();ggUX.setEnergy('both')});await p.evaluate(()=>ggExplore.compare());assert.match(await p.locator('.gg-compare-table').innerText(),/€\/L/);assert.doesNotMatch(await p.locator('.gg-compare-table').innerText(),/kWh/);await p.locator('#overlay').getByRole('button',{name:'Recargar',exact:true}).click();assert.equal(await p.locator('.gg-compare-table tbody tr').count(),1);assert.match(await p.locator('.gg-compare-table').innerText(),/kWh/);assert.equal(await p.evaluate(()=>ggUX.energyMode()),'both');await p.locator('#overlay').getByRole('button',{name:'Carga Tipo 2',exact:true}).click();assert.equal(await p.evaluate(()=>ggUX.energyMode()),'charge');assert.equal(await p.evaluate(()=>selectedStation),75);
 await p.evaluate(()=>{go('Home');ggExplore.compare()});for(const width of [320,375,430]){await p.setViewportSize({width,height:850});assert.equal(await p.locator('#overlay .modalcontent').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)}await p.evaluate(()=>closeModal());
 await p.evaluate(()=>openSearch());for(const width of [320,375,430]){await p.setViewportSize({width,height:850});assert.equal(await p.locator('#overlay .modalcontent').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true)}await p.evaluate(()=>closeModal());
 await p.evaluate(()=>{geoLoading=true;ggExplore.compare()});assert.match(await p.locator('#ggCompareResults').innerText(),/Buscando estaciones/);await p.evaluate(()=>{geoLoading=false;render()});assert.equal(await p.locator('.gg-compare-table').count(),1);await p.evaluate(()=>closeModal());
 await p.evaluate(()=>{STATIONS.length=0;render();ggExplore.compare()});assert.match(await p.locator('#ggCompareResults').innerText(),/No hay estaciones compatibles/);await p.evaluate(()=>closeModal());
 await p.evaluate(()=>{const s={lat:41.39,lng:2.16,dist:1,type:'electric',ev:.3,evConnector:'Tipo 2',kw:22,evFree:1,evTotal:2};STATIONS.splice(0,STATIONS.length,...Array.from({length:12},(_,i)=>({...s,id:800+i,name:'Carga '+i})));ggExplore.compare()});assert.equal(await p.locator('.gg-compare-table tbody tr').count(),10);await p.getByRole('button',{name:'Mostrar más estaciones',exact:true}).click();assert.equal(await p.locator('.gg-compare-table tbody tr').count(),12);await p.evaluate(()=>closeModal());
 console.log('PASS hybrid services use separate units, changing comparison tab preserves vehicle preference, chosen station uses the chosen service, narrow layouts and empty state');
 geocodeMode='ok';
 await p.locator('.gg-plan-open').click();
 await p.getByRole('searchbox',{name:'Dirección de destino'}).fill('Girona');
 await p.getByRole('button',{name:'Buscar destino',exact:true}).click();
 await p.getByRole('button',{name:'Girona, Gironès, Catalunya, España',exact:true}).click();
 await p.getByRole('heading',{name:'Gasolineras en el trayecto',exact:true}).waitFor();
 assert.equal(await p.getByText('Fuera de ruta',{exact:true}).count(),0);
 assert.equal(await p.getByRole('button',{name:'Comparar estaciones del mapa'}).count(),0);
 await p.getByRole('checkbox',{name:/Parada dentro de 10 km/}).waitFor();
 await p.getByRole('checkbox',{name:/Parada final/}).check();
 await p.getByRole('checkbox',{name:/Parada central/}).check();
 const google=new URL(await p.locator('#ggRouteNavigator option[value=google]').getAttribute('data-url'));
 assert.equal(google.searchParams.get('destination'),'41.9794,2.8214');
 assert.equal(google.searchParams.get('waypoints'),'41.6,2.4|41.96,2.8');
 await p.getByLabel('Navegador',{exact:true}).selectOption('gpx');
 const [gpx]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Ir',exact:true}).click()]);
 const xml=require('node:fs').readFileSync(await gpx.path(),'utf8');
 assert.match(xml,/<rtept lat="41.6" lon="2.4".*Parada central.*Parada final.*Girona/);
 for(const width of [320,430]){
  await p.setViewportSize({width,height:850});
  assert(await p.locator('#overlay .modalcontent').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 }
 await p.evaluate(()=>closeModal());
 plannerFallback=true;
 await p.evaluate(()=>{data.customVehicle=null;data.fuel='Diésel'});
 await p.locator('.gg-plan-open').click();
 await p.getByRole('searchbox',{name:'Dirección de destino'}).fill('Girona');
 await p.getByRole('button',{name:'Buscar destino',exact:true}).click();
 await p.getByRole('button',{name:'Girona, Gironès, Catalunya, España',exact:true}).click();
 await p.getByRole('checkbox',{name:/Parada alternativa/}).check();
 const apple=new URL(await p.locator('#ggRouteNavigator option[value=apple]').getAttribute('data-url'));
 assert.equal(apple.searchParams.get('destination'),'41.9794,2.8214');
 assert.deepEqual(apple.searchParams.getAll('waypoint'),['41.6,2.4']);
 const waze=new URL(await p.locator('#ggRouteNavigator optgroup[label="Waze · por etapas"] option').first().getAttribute('data-url'));
 await p.evaluate(()=>{window.open=(url)=>{window.testNavigation=url}});
 await p.getByLabel('Navegador',{exact:true}).selectOption('waze:41.6,2.4');
 await p.getByRole('button',{name:'Ir',exact:true}).click();
 assert.equal(await p.evaluate(()=>window.testNavigation),waze.href);
 assert.equal(waze.searchParams.get('ll'),'41.6,2.4');
 assert.equal(await p.locator('.gg-route-stops input').count(),5);
 await p.getByRole('button',{name:'Siguientes',exact:true}).click();
 assert.equal(await p.locator('.gg-route-stops input').count(),1);
 await p.getByRole('button',{name:'Filtros',exact:true}).last().click();
 assert.equal(await p.locator('#ggRouteFilters select').count(),0);
 assert.match(await p.locator('#ggRouteFilters').innerText(),/Diésel A/);
 assert.equal(await p.getByLabel('Precio desde (€/L)').inputValue(),'1.45');
 assert.equal(await p.getByLabel('Precio hasta (€/L)').inputValue(),'1.7');
 assert.equal(await p.getByLabel('Km del viaje desde').inputValue(),'0');
 assert.equal(await p.getByLabel('Km del viaje hasta').inputValue(),'94');
 await p.getByLabel('Precio desde (€/L)').fill('1.60');
 await p.getByLabel('Precio hasta (€/L)').fill('1.70');
 await p.getByLabel('Km del viaje desde').fill('50');
 await p.getByLabel('Km del viaje hasta').fill('90');
 await p.getByRole('button',{name:'Aplicar filtros'}).click();
 assert.equal(await p.locator('.gg-route-stops input').count(),3);
 await p.locator('.gg-route-map .leaflet-control-zoom-in').click();
 assert.equal(new URL(await p.locator('#ggRouteNavigator option[value=google]').getAttribute('data-url')).searchParams.get('waypoints'),'41.6,2.4');
 await p.evaluate(()=>closeModal());
 console.log('PASS planificador: geometría, gasolineras en el trayecto, orden, Google Maps y GPX');
 await p.evaluate(()=>{go('Bienvenida');startPresentationDemo()});await p.locator('#ggv2X').waitFor();await p.locator('#ggv2X').click();assert.equal(await p.locator('.gg-plan-open').count(),0);await p.getByRole('button',{name:'Buscar gasolinera',exact:true}).click();assert.equal(await p.locator('#ggPlaceQuery').count(),0);assert.equal(await p.locator('#searchInput').count(),1);assert.deepEqual(errors,[]);
 console.log('PASS DEMO retains its existing search and map without new controls; no browser exceptions');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
