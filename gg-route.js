/* Planificador de trayectos por carretera y paradas. */
(function () {
'use strict';

const corridor = 10000;
const maxStops = 3;
const pageSize = 5;
const formatPrice = value => value.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' €/L';
const number = value => value == null || String(value).trim() === '' ? NaN : Number(String(value).replace(',', '.'));
function vehicleFuel() {
  const vehicle = data.customVehicle?.name === data.vehicle ? data.customVehicle : null;
  const fuel = vehicle?.fuel === 'Híbrido enchufable' ? vehicle.combustionFuel : vehicle?.fuel ?? data.fuel;
  if (fuel === 'Eléctrico') return null;
  return fuel === 'Diésel' ? 'diesel' : 'gas';
}
const filters = fuel => ({ fuel, priceFrom: null, priceTo: null, kmFrom: null, kmTo: null });
const esc = escapeHtml;
const point = p => p.lat + ',' + p.lng;
const roadPoint = p => p.lng + ',' + p.lat;
const validPoint = p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
const distance = (a, b) => haversine(a.lat, a.lng, b.lat, b.lng) * 1000;
const formatDistance = meters => (meters / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' km';
let planner;

function cancel() {
  planner?.controller?.abort();
  planner?.map?.remove();
  planner = null;
}
const close = window.closeModal;
window.closeModal = function () { cancel(); close(); };

async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw Error('Servicio no disponible');
  return response.json();
}

async function roadRoute(origin, destination, signal) {
  const url = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/' + [origin, destination].map(roadPoint).join(';');
  const body = await request(url + '?overview=full&geometries=geojson&steps=false', { signal });
  const route = body.routes?.[0];
  const points = route?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng }));
  if (!points || points.length < 2 || !points.every(validPoint) || !Number.isFinite(route.distance)) {
    throw Error('No se ha encontrado una ruta en coche para este destino.');
  }
  return { points, distance: route.distance };
}

function routeSegments(points) {
  let length = 0;
  return points.slice(1).map((b, i) => {
    const a = points[i], scale = Math.cos((a.lat + b.lat) * Math.PI / 360);
    const dx = (b.lng - a.lng) * scale, dy = b.lat - a.lat;
    const meters = distance(a, b);
    const segment = { a, scale, dx, dy, meters, length };
    length += meters;
    return segment;
  });
}

function locate(station, segments) {
  let best = { offset: Infinity, along: 0 };
  for (const { a, scale, dx, dy, meters, length } of segments) {
    const x = (station.lng - a.lng) * scale, y = station.lat - a.lat;
    const ratio = meters ? Math.max(0, Math.min(1, (x * dx + y * dy) / (dx * dx + dy * dy))) : 0;
    const approx = Math.hypot(x - dx * ratio, y - dy * ratio) * 111200;
    if (approx > corridor + 100 || approx > best.offset + 100) continue;
    const projected = { lat: a.lat + dy * ratio, lng: a.lng + (scale ? dx / scale * ratio : 0) };
    const offset = distance(station, projected);
    if (offset < best.offset) best = { offset, along: length + meters * ratio };
  }
  return best;
}

async function pricedStations(points, signal) {
  // Limit the bounding boxes to route sections so long trips do not query the whole map.
  const boxes = [];
  let start = 0, traveled = 0;
  for (let i = 1; i < points.length; i++) {
    traveled += distance(points[i - 1], points[i]);
    if (traveled < 60000 && i < points.length - 1) continue;
    const chunk = points.slice(start, i + 1);
    const lat = chunk.map(p => p.lat), lng = chunk.map(p => p.lng);
    const dy = corridor / 110000;
    const dx = dy / Math.max(0.1, Math.cos(Math.max(...lat.map(Math.abs)) * Math.PI / 180));
    boxes.push({ minLat: Math.min(...lat) - dy, maxLat: Math.max(...lat) + dy,
      minLng: Math.min(...lng) - dx, maxLng: Math.max(...lng) + dx });
    start = i;
    traveled = 0;
  }
  const elements = [];
  let partial = false, successes = 0;
  for (let i = 0; i < boxes.length && !signal.aborted; i += 4) {
    const group = await Promise.allSettled(boxes.slice(i, i + 4).map(async box => {
      const params = new URLSearchParams({ ...box, limit: '800' });
      const body = await request('https://puntomuerto.es/api/gasolineras?' + params, { signal });
      if (!Array.isArray(body.estaciones)) throw Error('Consulta incompleta');
      return body.estaciones;
    }));
    for (const item of group) {
      if (item.status === 'rejected') { partial = true; continue; }
      successes++;
      if (item.value.length >= 800) partial = true;
      for (const p of item.value) {
        elements.push({ lat: number(p.lat), lon: number(p.lng), tags: { name: p.rotulo },
          prices: { gas: number(p.precios?.g95e5), diesel: number(p.precios?.['gasoleo-a']) } });
      }
    }
  }
  if (!successes) throw Error('Gasolineras no disponibles');
  return { elements, source: 'Punto Muerto', partial: partial || signal.aborted };
}

async function fuelStations({ points, distance: tripDistance }, signal) {
  const coordinates = points.map(p => L.point(p.lng * 111320, p.lat * 111320));
  let tolerance = 100;
  let simplified = L.LineUtil.simplify(coordinates, tolerance);
  while (simplified.length > 140) {
    tolerance *= 1.5;
    simplified = L.LineUtil.simplify(coordinates, tolerance);
  }
  const path = simplified.map(p => (p.y / 111320).toFixed(6) + ',' + (p.x / 111320).toFixed(6)).join(',');
  const query = `[out:json][timeout:10];nwr["amenity"="fuel"](around:${Math.ceil(corridor + tolerance)},${path});out center;`;
  let body, source = 'Punto Muerto', partial = false;
  try {
    body = await pricedStations(points, AbortSignal.any([signal, AbortSignal.timeout(12000)]));
    if (!body.elements.length) throw Error('Sin estaciones');
    partial = body.partial;
  } catch {
    source = 'OpenStreetMap';
    body = await request('https://overpass.kumi.systems/api/interpreter', {
      method: 'POST', body: new URLSearchParams({ data: query }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    });
    if (!Array.isArray(body.elements) || body.remark) throw Error('Consulta incompleta');
  }
  const segments = routeSegments(points);
  const last = segments.at(-1);
  const length = last.length + last.meters;
  const scale = length > 0 ? tripDistance / length : 1;
  const stations = [];
  const seen = new Set();
  for (const item of body.elements) {
    const { lat, lon: lng } = item.center ?? item;
    if (!validPoint({ lat, lng })) continue;
    const key = lat.toFixed(4) + ',' + lng.toFixed(4);
    if (seen.has(key)) continue;
    seen.add(key);
    const station = { lat, lng, prices: item.prices ?? {}, label: String(item.tags?.name || item.tags?.brand || 'Gasolinera').slice(0, 100) };
    const nearest = locate(station, segments);
    if (nearest.offset <= corridor) stations.push({ ...station, ...nearest, along: nearest.along * scale });
  }
  return { stations: stations.sort((a, b) => a.along - b.along), source, partial };
}

function active(current) {
  return planner === current && current.root.isConnected;
}

function drawMap(current) {
  if (!window.L || !current.route) return;
  if (!current.map) {
    const node = current.root.querySelector('.gg-route-map');
    node.hidden = false;
    const map = current.map = L.map(node, { preferCanvas: true });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri and contributors',
    }).addTo(map);
    const path = L.polyline(current.route.points.map(p => [p.lat, p.lng]), { color: '#075a46', weight: 4 }).addTo(map);
    map.fitBounds(path.getBounds(), { padding: [15, 15], maxZoom: 15 });
    for (const [label, p] of [['Origen', current.origin], ['Destino', current.destination]]) {
      L.circleMarker([p.lat, p.lng], { radius: 7, color: '#075a46', fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(label).addTo(map);
    }
    current.markers = L.layerGroup().addTo(map);
  }
  current.markers.clearLayers();
  const stations = new Set([...matchingStations(current), ...current.stops]);
  for (const station of stations) {
    const selected = current.stops.includes(station);
    const label = document.createElement('span');
    label.textContent = station.label + (selected ? ' · parada seleccionada' : '');
    L.circleMarker([station.lat, station.lng], { radius: selected ? 8 : 5, color: '#075a46', fillColor: selected ? '#ffdf2e' : '#fff', fillOpacity: 1 })
      .bindTooltip(label).on('click', () => toggleStop(current, station)).addTo(current.markers);
  }
}

function matchingStations(current) {
  const { fuel, priceFrom, priceTo, kmFrom, kmTo } = current.filters;
  return current.stations.filter(station => {
    const price = station.prices[fuel], km = station.along / 1000;
    if ((priceFrom !== null || priceTo !== null) && !(price > 0)) return false;
    return (priceFrom === null || price >= priceFrom) && (priceTo === null || price <= priceTo) &&
      (kmFrom === null || km >= kmFrom) && (kmTo === null || km <= kmTo);
  });
}

function toggleStop(current, station) {
  if (current.stops.includes(station)) current.stops = current.stops.filter(stop => stop !== station);
  else if (current.stops.length < maxStops) current.stops.push(station);
  else {
    current.root.querySelector('.gg-route-count').textContent = 'Máximo de tres paradas. Quita una para añadir otra.';
    return;
  }
  refreshStops(current);
  drawMap(current);
}

function orderedStops(current) {
  return current.stops.slice().sort((a, b) => a.along - b.along);
}

function googleUrl(current) {
  const stops = orderedStops(current);
  const google = new URL('https://www.google.com/maps/dir/');
  const params = { api: '1', origin: point(current.origin), destination: point(current.destination), travelmode: 'driving' };
  if (stops.length) params.waypoints = stops.map(point).join('|');
  google.search = new URLSearchParams(params);
  return google.href;
}

function navigationMarkup() {
  return `<form class="gg-route-export">
    <label for="ggRouteNavigator">Navegador</label>
    <select id="ggRouteNavigator" name="navigator"></select>
    <button class="btn primary" type="submit">Ir</button>
  </form>`;
}

function bindNavigation(current) {
  current.root.querySelector('.gg-route-export').onsubmit = event => {
    event.preventDefault();
    const option = event.currentTarget.elements.navigator.selectedOptions[0];
    if (option.value === 'gpx') downloadGpx(current);
    else window.open(option.dataset.url, '_blank', 'noopener,noreferrer');
  };
  updateNavigation(current);
}

function updateNavigation(current) {
  const select = current.root.querySelector('#ggRouteNavigator');
  const previous = select.value;
  const stops = orderedStops(current);
  const option = (label, value, url) => {
    const node = new Option(label, value);
    if (url) node.dataset.url = url;
    return node;
  };
  const apple = new URL('https://maps.apple.com/directions');
  apple.search = new URLSearchParams({
    source: point(current.origin), destination: point(current.destination), mode: 'driving',
  });
  for (const stop of stops) apple.searchParams.append('waypoint', point(stop));
  const waze = target => 'https://waze.com/ul?' + new URLSearchParams({ ll: point(target), navigate: 'yes' });

  select.replaceChildren(option('Google Maps', 'google', googleUrl(current)), option('Apple Maps', 'apple', apple.href));
  if (stops.length) {
    const legs = document.createElement('optgroup');
    legs.label = 'Waze · por etapas';
    stops.forEach((stop, i) => legs.append(option('Parada ' + (i + 1) + ' · ' + stop.label, 'waze:' + point(stop), waze(stop))));
    legs.append(option('Destino · ' + current.destination.label, 'waze:destination', waze(current.destination)));
    select.append(legs);
  } else select.append(option('Waze', 'waze:destination', waze(current.destination)));
  select.append(option('Descargar GPX', 'gpx'));
  if (Array.from(select.options).some(item => item.value === previous)) select.value = previous;
}

function updateExport(current) {
  current.root.querySelector('.gg-route-count').textContent = current.stops.length + ' de ' + maxStops + ' paradas seleccionadas';
  updateNavigation(current);
}

function downloadGpx(current) {
  const stops = orderedStops(current);
  const encode = p => `<rtept lat="${p.lat}" lon="${p.lng}"><name>${esc(p.label)}</name></rtept>`;
  const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="GAS&amp;GO" xmlns="http://www.topografix.com/GPX/1/1"><rte><name>Ruta GAS&amp;GO</name>${[current.origin, ...stops, current.destination].map(encode).join('')}</rte></gpx>`;
  const href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
  const link = document.createElement('a');
  link.href = href;
  link.download = 'ruta-gasgo.gpx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function refreshStops(current) {
  const root = current.root, results = matchingStations(current);
  const start = current.page * pageSize;
  root.querySelector('.gg-route-stops').innerHTML = results.length
    ? results.slice(start, start + pageSize).map(p => {
      const price = p.prices[current.filters.fuel];
      return `<label><input type="checkbox" value="${current.stations.indexOf(p)}" ${current.stops.includes(p) ? 'checked' : ''}><span><strong>${esc(p.label)}</strong><small>Km ${formatDistance(p.along).replace(' km', '')} del viaje · ${formatDistance(p.offset)} de la ruta · ${price > 0 ? formatPrice(price) : 'Sin precio disponible'}</small></span></label>`;
    }).join('')
    : '<p class="small muted">No hay gasolineras que coincidan con estos filtros.</p>';
  const pager = root.querySelector('.gg-route-paging');
  pager.hidden = results.length <= pageSize;
  pager.querySelector('span').textContent = `${start + 1}–${Math.min(start + pageSize, results.length)} de ${results.length}`;
  pager.querySelector('[data-route-prev]').disabled = start === 0;
  pager.querySelector('[data-route-next]').disabled = start + pageSize >= results.length;
  root.querySelector('.gg-route-picked').innerHTML = orderedStops(current).map(p =>
    `<li><span>${esc(p.label)}</span><button type="button" class="btn ghost" data-route-remove="${current.stations.indexOf(p)}" aria-label="Quitar ${esc(p.label)}">Quitar</button></li>`).join('');
  updateExport(current);
}

function renderResults(current, failed) {
  const node = current.root.querySelector('.gg-route-results');
  const { fuel } = current.filters;
  const fuelLabel = fuel === 'diesel' ? 'Diésel A' : fuel === 'gas' ? 'Gasolina 95' : 'Vehículo eléctrico';
  const prices = current.stations.map(station => station.prices[fuel]).filter(price => price > 0);
  const low = prices.length ? Math.min(...prices) : null;
  const high = prices.length ? Math.max(...prices) : null;
  const lastKm = Math.ceil(current.route.distance / 100) / 10;
  const fields = [
    ['priceFrom', 'Precio desde (€/L)', low, high, '0.001', low],
    ['priceTo', 'Precio hasta (€/L)', low, high, '0.001', high],
    ['kmFrom', 'Km del viaje desde', 0, lastKm, '0.1', 0],
    ['kmTo', 'Km del viaje hasta', 0, lastKm, '0.1', lastKm],
  ];
  node.innerHTML = `<h3>Gasolineras en el trayecto</h3><p class="small muted">${formatDistance(current.route.distance)} de ruta. Distancias a la ruta en línea recta.</p>
    ${failed ? '<p role="status">No se han podido cargar las gasolineras. Puedes abrir la ruta o reintentar.</p><button class="btn ghost" type="button" data-route-retry>Reintentar gasolineras</button>' : ''}
    <div class="gg-route-availability" ${current.stations.length ? '' : 'hidden'}>
      <p class="small muted">${current.stations.length} gasolineras a hasta 10 km de la ruta · ${esc(current.source ?? '')}.</p>
      <button class="btn ghost" type="button" data-route-filter aria-expanded="false" aria-controls="ggRouteFilters">Filtros</button>
      <form id="ggRouteFilters" hidden>
        <p><strong>${fuelLabel}</strong> · vehículo activo</p>
        ${low === null ? '<p class="small muted">No hay precios disponibles para este vehículo en la ruta.</p>' : ''}
        <div class="gg-route-filter-fields">${fields.filter(([, , min]) => min !== null).map(([id, label, min, max, step, value]) => `<label>${label}<input name="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" inputmode="decimal"></label>`).join('')}</div>
        <p class="small muted" role="alert"></p>
        <button class="btn primary" type="submit">Aplicar filtros</button>
        <button class="btn ghost" type="reset">Restablecer</button>
      </form>
      <fieldset class="gg-route-stops" aria-label="Elige hasta tres paradas"></fieldset>
      <div class="gg-route-paging"><button type="button" class="btn ghost" data-route-prev>Anteriores</button><span></span><button type="button" class="btn ghost" data-route-next>Siguientes</button></div>
    </div>${!failed && !current.stations.length ? '<p>No se encontraron gasolineras cerca de este trayecto.</p>' : ''}
    ${current.partial ? '<p class="small muted">Hay tramos sin datos. Puedes seleccionar las gasolineras disponibles.</p>' : ''}
    <p class="gg-route-count small muted" role="status"></p><ol class="gg-route-picked"></ol>
    ${navigationMarkup()}<p class="small muted">El navegador recalculará el trayecto con las paradas elegidas. El GPX incluye el origen, las paradas y el destino en orden.</p>`;
  const form = node.querySelector('#ggRouteFilters'), filterButton = node.querySelector('[data-route-filter]');
  filterButton.onclick = () => {
    form.hidden = !form.hidden;
    filterButton.setAttribute('aria-expanded', String(!form.hidden));
  };
  const apply = next => {
    current.filters = next;
    current.page = 0;
    refreshStops(current);
    drawMap(current);
  };
  form.onsubmit = event => {
    event.preventDefault();
    const next = filters(fuel);
    for (const [name, , , , , initial] of fields) {
      const value = form.elements[name]?.valueAsNumber;
      if (Number.isFinite(value) && value !== initial) next[name] = value;
    }
    const error = form.querySelector('[role=alert]');
    if (['price', 'km'].some(key => next[key + 'From'] !== null && next[key + 'To'] !== null && next[key + 'From'] > next[key + 'To'])) {
      error.textContent = 'El mínimo debe ser menor o igual que el máximo.';
      return;
    }
    error.textContent = '';
    apply(next);
    filterButton.click();
  };
  form.onreset = () => {
    form.querySelector('[role=alert]').textContent = '';
    apply(filters(fuel));
  };
  node.querySelector('.gg-route-stops').onchange = event => {
    if (event.target.matches('input[type=checkbox]')) {
      const index = Number(event.target.value);
      toggleStop(current, current.stations[index]);
      const input = node.querySelector(`.gg-route-stops input[value="${index}"]`);
      if (input) {
        input.checked = current.stops.includes(current.stations[index]);
        input.focus({ preventScroll: true });
      }
    }
  };
  node.querySelector('.gg-route-picked').onclick = event => {
    const button = event.target.closest('[data-route-remove]');
    if (button) toggleStop(current, current.stations[Number(button.dataset.routeRemove)]);
  };
  node.querySelector('[data-route-prev]').onclick = () => { current.page--; refreshStops(current); };
  node.querySelector('[data-route-next]').onclick = () => { current.page++; refreshStops(current); };
  bindNavigation(current);
  node.querySelector('[data-route-retry]')?.addEventListener('click', () => plan(current, current.destination));
  refreshStops(current);
}

async function plan(current, destination) {
  current.controller?.abort();
  const controller = current.controller = new AbortController();
  const signal = controller.signal;
  current.destination = destination;
  current.stops = [];
  current.stations = [];
  current.partial = false;
  current.filters = filters(vehicleFuel());
  current.page = 0;
  current.status.textContent = 'Calculando la ruta…';
  current.root.querySelector('.gg-route-results').replaceChildren();
  current.map?.remove();
  current.map = null;
  current.root.querySelector('.gg-route-map').hidden = true;
  const timer = setTimeout(() => controller.abort(), 30000);
  const selected = () => active(current) && current.controller === controller;
  try {
    current.route = await roadRoute(current.origin, destination, signal);
    if (!selected()) return;
    drawMap(current);
    current.status.textContent = 'Buscando gasolineras cerca de la ruta…';
    let failed = false;
    try {
      const found = await fuelStations(current.route, signal);
      if (selected()) Object.assign(current, found);
    }
    catch { failed = true; }
    if (!selected()) return;
    current.status.textContent = 'Destino: ' + destination.label;
    renderResults(current, failed);
    if (current.stations.length) drawMap(current);
  } catch (error) {
    if (!selected()) return;
    current.status.textContent = error.name === 'AbortError' ? 'La ruta tardó demasiado. Elige el destino para reintentar.' : 'No se pudo calcular la ruta. Elige el destino para reintentar.';
    current.root.querySelector('.gg-route-results').innerHTML = navigationMarkup();
    bindNavigation(current);
  } finally { clearTimeout(timer); }
}

function open() {
  if (inPresentationDemo()) return;
  cancel();
  const gps = userPosition && validPoint(userPosition);
  const origin = { ...(gps ? userPosition : mapCenter), label: gps ? 'Mi ubicación' : 'Centro del mapa' };
  modal(`<section id="ggRoutePlanner"><h2>Planificar viaje</h2><p class="small muted">Origen: ${origin.label}.${gps ? '' : ' Usa «Mi ubicación» en el mapa para partir del GPS.'}</p>
    <form id="ggRouteForm"><label class="field" for="ggRouteDestination">Dirección de destino</label><input id="ggRouteDestination" type="search" minlength="3" maxlength="160" required placeholder="Ej.: Plaza Mayor 1, Madrid"><button class="btn primary block" type="submit">Buscar destino</button></form>
    <p class="small muted" role="status"></p><div class="gg-route-places"></div><div class="gg-route-map" hidden></div><div class="gg-route-results"></div>
    <p class="small muted">Ruta en coche y gasolineras en España · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · OSRM</p></section>`);
  const root = document.getElementById('ggRoutePlanner');
  const input = root.querySelector('input');
  const current = planner = { root, origin, status: root.querySelector('[role=status]') };
  root.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const query = input.value.trim();
    if (query.length < 3) return;
    current.controller?.abort();
    const controller = current.controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const results = root.querySelector('.gg-route-places');
    results.replaceChildren();
    root.querySelector('.gg-route-results').replaceChildren();
    current.map?.remove();
    current.map = null;
    root.querySelector('.gg-route-map').hidden = true;
    current.status.textContent = 'Buscando direcciones…';
    try {
      const places = await ggExplore.geocode(query, controller.signal);
      if (!active(current) || current.controller !== controller) return;
      current.status.textContent = places.length ? 'Elige el destino.' : 'No se encontraron direcciones. Añade un municipio.';
      for (const place of places) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gg-place-result';
        button.textContent = place.description;
        button.onclick = () => plan(current, place);
        results.append(button);
      }
    } catch (error) {
      if (active(current) && current.controller === controller) current.status.textContent = error.message === 'rate' ? 'Espera un momento y vuelve a buscar.' : 'No se pudo buscar el destino. Vuelve a intentarlo.';
    } finally { clearTimeout(timer); }
  };
  input.focus();
}

window.ggRoute = { open };
})();
