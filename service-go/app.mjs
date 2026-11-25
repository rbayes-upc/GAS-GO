import { act, advance, createSession, equipment, methods, programs, services, target, tireLabels, tires, vehicles } from './engine.mjs?v=2';
import { money, receipt, timer } from './pdf.mjs?v=2';
import { gasgoStorageKey, serviceProfile } from './profile.mjs';

const key = 'service-go.session.v1';
const client = document.body.dataset.view === 'client';
const $ = id => document.getElementById(id);
const terminal = ['finished', 'expired', 'cancelled'];
const bar = value => value.toFixed(2).replace('.', ',') + ' bar';
const buttons = [...document.querySelectorAll('button[data-action]')];
let shown;
let configuring = false;

function read() {
  return JSON.parse(localStorage.getItem(key));
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function showError(error) {
  setText($('error'), error ? error.message : '');
  $('error').hidden = !error;
}

async function update(change) {
  try {
    if (!navigator.locks) throw new Error('Abre Service&Go en localhost o en un sitio HTTPS con un navegador actualizado.');
    await navigator.locks.request(key, () => {
      const previous = read();
      const now = Date.now();
      const current = previous && advance(previous, now);
      const next = change ? change(current, now) : current;
      if (next !== previous) {
        if (next) localStorage.setItem(key, JSON.stringify(next));
        else localStorage.removeItem(key);
      }
      render(next);
    });
    if (change) showError(null);
  } catch (error) {
    showError(error);
  }
}

function status(session) {
  const active = client ? 'Sigue las indicaciones del equipo.' : 'Selecciona un control para empezar o continuar.';
  switch (session.phase) {
    case 'requested': return client ? 'Abre el simulador e inicia la identificación.' : 'Solicitud recibida. Identifica al cliente para empezar.';
    case 'identifying':
      if (session.method === 'auto') return 'Identificando automáticamente…';
      if (session.method === 'confirm') return client ? 'Confirma tu identidad para activar el equipo.' : 'Esperando confirmación en la app.';
      return client ? 'Introduce este código en el simulador.' : 'Introduce el código temporal que aparece en la app.';
    case 'ready': return session.completed.length ? 'Objetivo alcanzado. ' + active : 'Equipo listo. ' + active;
    case 'running': return session.service === 'air' ? 'Ajustando presión' : 'Pistola activa';
    case 'finished': return session.reason + '.';
    case 'expired': return 'La identificación ha caducado. Prepara otra sesión.';
    case 'cancelled': return 'Solicitud cancelada.';
  }
}

function render(session) {
  const previous = shown;
  shown = session;
  $('session').hidden = !session;
  if (client) {
    $('welcome').hidden = Boolean(session) || configuring;
    $('reservation').hidden = Boolean(session) || !configuring;
  } else {
    $('standby').hidden = Boolean(session);
  }
  if (!session) return;

  setText($('equipment-name'), 'EQUIPO ' + equipment[session.service]);
  setText($('service-title'), services[session.service].label);
  setText($('status'), status(session));
  setText($('time'), timer(session.elapsed));
  setText($('total'), money(session.total));
  setText($('limit'), money(session.limit));
  $('budget').max = session.limit;
  $('budget').value = session.total;

  const identifying = session.phase === 'identifying';
  const ready = session.phase === 'ready';
  const running = session.phase === 'running';
  const air = session.service === 'air';
  const codeEntry = identifying && session.method === 'code';
  const labels = tireLabels(session);
  const activity = air
    ? (running ? labels[session.tire] + ' · ' + bar(session.pressures[session.tire]) + ' → ' + bar(target(session, session.tire)) + ' · ' : '') +
      session.completed.length + ' de ' + labels.length + ' neumáticos ajustados'
    : (running ? programs[session.program] + ' · ' : '') + 'Tarifa de ' + money(services.wash.rate) + ' por segundo activo';
  setText($('activity'), activity);

  const visible = client ? {
    confirm: identifying && session.method === 'confirm',
    cancel: session.phase === 'requested' || identifying,
    finish: ready || running,
    receipt: session.phase === 'finished',
    reset: terminal.includes(session.phase),
  } : {
    identify: session.phase === 'requested',
    spray: !air && ready,
    pause: running,
    finish: ready || running,
  };
  for (const button of buttons) button.hidden = !visible[button.dataset.action];

  if (client) {
    $('client-code').hidden = !codeEntry;
    setText($('client-code'), codeEntry ? 'Código temporal · ' + session.code : '');
  } else {
    $('code-form').hidden = !codeEntry;
    if (previous?.id !== session.id || (previous?.phase === 'identifying' && !codeEntry)) $('code').value = '';
    $('air-controls').hidden = !air || !(ready || running);
    $('wash-controls').hidden = air || !(ready || running);
    setText(document.querySelector('[data-action="pause"]'), air ? 'Desconectar boquilla' : 'Pausar pistola');

    tireControls.forEach(({ card, title, pressure, button }, i) => {
      card.hidden = i >= labels.length;
      if (card.hidden) return;
      setText(title, labels[i]);
      setText(pressure, bar(session.pressures[i]) + ' / objetivo ' + bar(target(session, i)));
      setText(button, session.completed.includes(i) ? 'Ajustado' : session.tire === i ? 'Boquilla conectada' : 'Conectar boquilla');
      button.disabled = !ready || session.completed.includes(i);
    });
    for (const [program, button] of programControls) {
      button.setAttribute('aria-pressed', String(session.program === program));
    }
  }
}

function dispatch(action, value) {
  const id = shown?.id;
  return update((current, now) => {
    if (!current || current.id !== id) return current;
    if (action === 'reset' && terminal.includes(current.phase)) {
      configuring = true;
      return null;
    }
    return act(current, action, value, now);
  });
}

function download() {
  if (shown?.phase !== 'finished') return;
  const url = URL.createObjectURL(receipt(shown));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'service-go-' + shown.id + '.pdf';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function makeButton(text, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', action);
  return button;
}

function readProfile() {
  try {
    return serviceProfile(JSON.parse(localStorage.getItem(gasgoStorageKey)));
  } catch {
    return serviceProfile(null);
  }
}

const tireControls = [];
const programControls = new Map();
if (client) {
  $('startService').addEventListener('click', () => {
    configuring = true;
    render(shown);
    $('service-choice').focus();
  });
  for (const [id, label] of Object.entries(methods)) $('method').add(new Option(label, id));
  function updateHint() {
    const profile = readProfile();
    const selected = vehicles[profile.vehicle];
    const form = new FormData($('reservation'));
    setText($('profile-origin'), profile.linked ? 'Perfil de GAS&GO' : 'Perfil de demostración');
    setText($('profile-name'), profile.name);
    setText($('profile-vehicle'), profile.vehicleLabel);
    setText($('profile-payment'), profile.payment);
    setText($('limit-preview'), money(Math.round(Number(form.get('limit')) * 100)));
    setText($('vehicle-hint'), form.get('service') === 'air'
      ? 'Objetivos simulados · delante ' + bar(selected.front) + ' · detrás ' + bar(selected.rear)
      : 'El agua, la espuma y el aclarado tienen la misma tarifa. Las pausas no se cobran.');
  }
  $('reservation').addEventListener('input', updateHint);
  addEventListener('storage', event => {
    if (event.key === gasgoStorageKey || event.key === null) updateHint();
  });
  updateHint();
  $('reservation').addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile = readProfile();
    update((current, now) => {
      if (current) return current;
      return createSession({
        service: form.get('service'), vehicle: profile.vehicle, customer: profile, method: form.get('method'),
        limit: Math.round(Number(form.get('limit')) * 100), id: crypto.randomUUID(),
        code: String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
      }, now);
    });
  });
} else {
  for (const [i, tire] of tires.entries()) {
    const card = document.createElement('div');
    card.className = 'tire';
    const title = document.createElement('h4');
    title.textContent = tire;
    const pressure = document.createElement('p');
    const button = makeButton('Conectar boquilla', () => dispatch('connect', i));
    card.append(title, pressure, button);
    $('tires').append(card);
    tireControls.push({ card, title, pressure, button });
  }
  for (const [program, name] of Object.entries(programs)) {
    const button = makeButton(name, () => dispatch('program', program));
    $('programs').append(button);
    programControls.set(program, button);
  }
  $('code-form').addEventListener('submit', event => {
    event.preventDefault();
    dispatch('code', $('code').value);
  });
}

for (const button of buttons) {
  const action = button.dataset.action;
  button.addEventListener('click', action === 'receipt' ? download : () => dispatch(action));
}
addEventListener('storage', event => {
  if (event.key === key || event.key === null) {
    const current = read();
    if (current?.id !== shown?.id || current?.phase !== shown?.phase) showError(null);
    render(current);
  }
});
update();
setInterval(() => {
  if (['requested', 'identifying', 'running'].includes(shown?.phase)) update();
}, 250);
