/* Planificador de trayectos por carretera y paradas. */
(function () {
'use strict';

const corridor = 10000;
const maxStops = 3;
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

async function fallbackStations(points, signal) {
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
        const parse = value => value === null || value === '' ? NaN : Number(String(value).replace(',', '.'));
        elements.push({ lat: parse(p.lat), lon: parse(p.lng), tags: { name: p.rotulo } });
      }
    }
  }
  if (!successes) throw Error('Gasolineras no disponibles');
  return { elements, source: 'Punto Muerto', partial: partial || signal.aborted };
}

async function fuelStations(points, signal) {
  const coordinates = points.map(p => L.point(p.lng * 111320, p.lat * 111320));
  let tolerance = 100;
  let simplified = L.LineUtil.simplify(coordinates, tolerance);
  while (simplified.length > 140) {
    tolerance *= 1.5;
    simplified = L.LineUtil.simplify(coordinates, tolerance);
  }
  const path = simplified.map(p => (p.y / 111320).toFixed(6) + ',' + (p.x / 111320).toFixed(6)).join(',');
  const query = `[out:json][timeout:10];nwr["amenity"="fuel"](around:${Math.ceil(corridor + tolerance)},${path});out center;`;
  let body, source = 'OpenStreetMap', partial = false;
  try {
    body = await request('https://overpass.kumi.systems/api/interpreter', {
      method: 'POST', body: new URLSearchParams({ data: query }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    });
    if (!Array.isArray(body.elements) || body.remark || !body.elements.length) throw Error('Consulta incompleta');
  } catch {
    body = await fallbackStations(points, signal);
    ({ source, partial } = body);
  }
  const segments = routeSegments(points);
  const stations = [];
  const seen = new Set();
  for (const item of body.elements) {
    const { lat, lon: lng } = item.center ?? item;
    if (!validPoint({ lat, lng })) continue;
    const key = lat.toFixed(4) + ',' + lng.toFixed(4);
    if (seen.has(key)) continue;
    seen.add(key);
    const station = { lat, lng, label: String(item.tags?.name || item.tags?.brand || 'Gasolinera').slice(0, 100) };
    const nearest = locate(station, segments);
    if (nearest.offset <= corridor) stations.push({ ...station, ...nearest });
  }
  return { stations: stations.sort((a, b) => a.along - b.along), source, partial };
}

function active(current) {
  return planner === current && current.root.isConnected;
}

function drawMap(current) {
  if (!window.L || !current.route) return;
  current.map?.remove();
  const node = current.root.querySelector('.gg-route-map');
  node.hidden = false;
  const map = current.map = L.map(node, { scrollWheelZoom: false, preferCanvas: true });
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri and contributors',
  }).addTo(map);
  const path = L.polyline(current.route.points.map(p => [p.lat, p.lng]), { color: '#075a46', weight: 4 }).addTo(map);
  for (const [index, station] of current.stations.entries()) {
    if (current.stops.includes(station)) continue;
    const label = document.createElement('span');
    label.textContent = station.label;
    L.circleMarker([station.lat, station.lng], { radius: 4, color: '#075a46', fillColor: '#fff', fillOpacity: 1 }).addTo(map)
      .bindTooltip(label)
      .on('click', () => current.root.querySelector(`.gg-route-stops input[value="${index}"]`)?.click());
  }
  for (const [index, p] of [current.origin, ...current.stops, current.destination].entries()) {
    L.circleMarker([p.lat, p.lng], { radius: 7, color: '#075a46', fillColor: '#ffdf2e', fillOpacity: 1 }).addTo(map)
      .bindTooltip(index === 0 ? 'Origen' : index === current.stops.length + 1 ? 'Destino' : 'Parada ' + index);
  }
  map.fitBounds(path.getBounds(), { padding: [15, 15], maxZoom: 15 });
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

function updateExport(current) {
  current.root.querySelector('.gg-route-count').textContent = current.stops.length + ' de ' + maxStops + ' paradas seleccionadas';
  current.root.querySelector('.gg-route-google').href = googleUrl(current);
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

function renderResults(current, failed) {
  const node = current.root.querySelector('.gg-route-results');
  const stations = current.stations;
  node.innerHTML = `<h3>Gasolineras en el trayecto</h3><p class="small muted">${formatDistance(current.route.distance)} de ruta. Distancias a la ruta en línea recta.</p>
    ${failed ? '<p role="status">No se han podido cargar las gasolineras. Puedes abrir la ruta o reintentar.</p><button class="btn ghost" type="button" data-route-retry>Reintentar gasolineras</button>' :
    stations.length ? `<p class="small muted">${stations.length} gasolineras a hasta 10 km de la ruta · ${esc(current.source)}.</p><fieldset class="gg-route-stops"><legend>Elige hasta tres paradas</legend>${stations.map((p, i) => `<label><input type="checkbox" value="${i}"><span><strong>${esc(p.label)}</strong><small>Km ${formatDistance(p.along).replace(' km','')} del viaje · ${formatDistance(p.offset)} de la ruta</small></span></label>`).join('')}</fieldset>` : '<p>No se encontraron gasolineras cerca de este trayecto.</p>'}
    ${current.partial ? '<p class="small muted">Hay tramos sin datos. Puedes seleccionar las gasolineras disponibles.</p>' : ''}
    <p class="gg-route-count small muted" role="status"></p><div class="gg-route-export"><a class="btn primary gg-route-google" target="_blank" rel="noopener">Abrir en Google Maps</a><button class="btn ghost" type="button" data-route-gpx>Descargar GPX</button></div><p class="small muted">El navegador recalculará el trayecto con las paradas elegidas. El GPX incluye el origen, las paradas y el destino en orden.</p>`;
  node.addEventListener('change', event => {
    if (!event.target.matches('input[type=checkbox]')) return;
    current.stops = [...node.querySelectorAll('input:checked')].map(input => stations[Number(input.value)]);
    for (const checkbox of node.querySelectorAll('input')) checkbox.disabled = !checkbox.checked && current.stops.length >= maxStops;
    updateExport(current);
    drawMap(current);
  }, { signal: current.controller.signal });
  node.querySelector('[data-route-gpx]').onclick = () => downloadGpx(current);
  node.querySelector('[data-route-retry]')?.addEventListener('click', () => plan(current, current.destination));
  updateExport(current);
}

async function plan(current, destination) {
  current.controller?.abort();
  const controller = current.controller = new AbortController();
  const signal = controller.signal;
  current.destination = destination;
  current.stops = [];
  current.stations = [];
  current.partial = false;
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
      const found = await fuelStations(current.route.points, signal);
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
    const link = document.createElement('a');
    link.className = 'btn primary';
    link.href = googleUrl(current);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Abrir destino en Google Maps';
    current.root.querySelector('.gg-route-results').replaceChildren(link);
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
