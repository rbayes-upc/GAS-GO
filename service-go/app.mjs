import { act, advance, createSession, equipment, methods, pressureUnits, programs, selectedWheel, services, target, tireLabels, tires, vehicles } from './engine.mjs?v=6';
import { invoiceDetails, money, receipt, tariffLabel, timer } from './pdf.mjs?v=5';
import { gasgoStorageKey, serviceProfile } from './profile.mjs';

const key = 'service-go.session.v1';
const client = document.body.dataset.view === 'client';
const $ = id => document.getElementById(id);
const terminal = ['finished', 'expired', 'cancelled'];
function formatPressure(value, unit = 'BAR') {
  const { factor, decimals } = pressureUnits[unit];
  return (value * factor).toLocaleString('es-ES', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }) + ' ' + unit;
}
const buttons = [...document.querySelectorAll('button[data-action]')];
let shown;
let configuring = false;
let viewingWelcome = false;

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
    case 'ready':
      if (session.service === 'air' && session.completed.length === tireLabels(session).length) {
        return 'Neumáticos ajustados. Puedes volver a ajustar una rueda o finalizar.';
      }
      return session.completed.length ? 'Objetivo alcanzado. ' + active : 'Equipo listo. ' + active;
    case 'running': return session.service === 'air' ? 'Ajustando presión' : 'Pistola activa';
    case 'finished': return session.reason + '.';
    case 'expired': return 'La identificación ha caducado. Prepara otra sesión.';
    case 'cancelled': return 'Solicitud cancelada.';
  }
}

function render(session) {
  const previous = shown;
  shown = session;
  $('session').hidden = !session || viewingWelcome;
  if (client) {
    $('welcome').hidden = !viewingWelcome && (Boolean(session) || configuring);
    $('reservation').hidden = viewingWelcome || Boolean(session) || !configuring;
    $('backService').hidden = !$('welcome').hidden;
    setText($('startService'), session ? 'Continuar sesión' : 'Probar Service&Go');
    const operation = !$('welcome').hidden ? 'home' : session?.service ?? $('reservation').elements.service.value;
    for (const button of document.querySelectorAll('[data-operation]')) {
      if (button.dataset.operation === operation) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  } else {
    $('standby').hidden = Boolean(session);
  }
  if (!session) return;

  setText($('equipment-name'), 'EQUIPO ' + equipment[session.service]);
  setText($('service-title'), services[session.service].label);
  setText($('status'), status(session));
  setText($('time'), timer(session.elapsed, session.service === 'air'));
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
  const unit = session.pressureUnit ?? 'BAR';
  const activity = air
    ? (running ? labels[session.tire] + ' · ' + formatPressure(session.pressures[session.tire], unit) + ' → ' + formatPressure(target(session, session.tire), unit) + ' · ' : '') +
      session.completed.length + ' de ' + labels.length + ' neumáticos ajustados · ' + tariffLabel(session) + ' de ajuste activo'
    : (running ? programs[session.program] + ' · ' : '') + 'Tarifa: ' + tariffLabel(session);
  setText($('activity'), activity);

  const visible = client ? {
    confirm: identifying && session.method === 'confirm',
    cancel: session.phase === 'requested' || identifying,
    finish: ready || running,
    receipt: session.phase === 'finished',
    reset: terminal.includes(session.phase),
  } : {
    identify: session.phase === 'requested',
    spray: !air && (ready || running),
    pressurize: air && ready && session.pressureGoal != null,
    pause: air && running,
    finish: ready || running,
  };
  for (const button of buttons) button.hidden = !visible[button.dataset.action];

  if (client) {
    const invoice = $('serviceInvoice');
    invoice.hidden = session.phase !== 'finished';
    if (!invoice.hidden && (previous?.phase !== 'finished' || previous.id !== session.id)) {
      const details = invoiceDetails(session);
      for (const field of invoice.querySelectorAll('[data-invoice]')) setText(field, details[field.dataset.invoice]);
    }
    $('client-code').hidden = !codeEntry;
    setText($('client-code'), codeEntry ? 'Código temporal · ' + session.code : '');
  } else {
    $('code-form').hidden = !codeEntry;
    if (previous?.id !== session.id || (previous?.phase === 'identifying' && !codeEntry)) $('code').value = '';
    $('air-controls').hidden = !air || !(ready || running);
    $('wash-controls').hidden = air || !(ready || running);
    setText(document.querySelector('[data-action="pause"]'), 'Detener ajuste');
    setText(document.querySelector('[data-action="spray"]'), running ? 'Pausar lanza' : 'Usar lanza');
    const wheel = selectedWheel(session);
    if (air && (ready || running)) {
      setText($('pressure-current'), formatPressure(session.pressures[wheel], unit));
      setText($('pressure-target'), formatPressure(session.pressureDraft ?? target(session, wheel), unit));
      for (const id of ['pressure-set', 'pressure-up', 'pressure-down']) $(id).disabled = running;
      $('pressure-set').setAttribute('aria-pressed', String(session.pressureGoal != null));
    }
    tireControls.forEach(({ card, title, pressure, button }, i) => {
      card.hidden = i >= labels.length;
      if (card.hidden) return;
      setText(title, labels[i]);
      setText(pressure, formatPressure(session.pressures[i], unit));
      setText(button, session.completed.includes(i) ? 'Volver a ajustar' : 'Elegir');
      button.setAttribute('aria-pressed', String(i === wheel));
      button.disabled = !ready;
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

async function download(event) {
  if (shown?.phase !== 'finished') return;
  const session = shown;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const url = URL.createObjectURL(await receipt(session));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'service-go-' + session.id + '.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    showError(new Error('No se pudo generar la factura. Vuelve a intentarlo.'));
  } finally {
    button.disabled = false;
  }
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
  const pane = $('equipmentPane');
  const opener = $('openEquipment');
  function showEquipment(focus = false) {
    if (pane.hidden) {
      const frame = document.createElement('iframe');
      frame.src = opener.href;
      frame.title = 'Controles del inflador y del box de lavado';
      pane.append(frame);
      pane.hidden = false;
      document.body.classList.add('equipment-open');
      sessionStorage.setItem('service-go.equipment-open', '1');
    }
    if (focus) {
      pane.scrollIntoView({ block: 'nearest' });
      $('closeEquipment').focus({ preventScroll: true });
    }
  }
  opener.addEventListener('click', event => {
    event.preventDefault();
    showEquipment(true);
  });
  function pauseSession() {
    return update((current, now) => current?.phase === 'running' ? act(current, 'pause', null, now) : current);
  }
  function hideEquipment() {
    pane.querySelector('iframe')?.remove();
    pane.hidden = true;
    document.body.classList.remove('equipment-open');
    sessionStorage.removeItem('service-go.equipment-open');
  }
  $('closeEquipment').addEventListener('click', async () => {
    await pauseSession();
    hideEquipment();
    opener.focus();
  });
  async function showWelcome() {
    if (!$('welcome').hidden) return;
    await pauseSession();
    hideEquipment();
    configuring = false;
    viewingWelcome = true;
    render(shown);
    $('welcome-title').focus();
  }
  $('backService').addEventListener('click', showWelcome);
  document.querySelector('[data-operation="home"]').addEventListener('click', showWelcome);
  $('returnGasgo').addEventListener('click', async event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || shown?.phase !== 'running') return;
    event.preventDefault();
    await pauseSession();
    location.assign($('returnGasgo').href);
  });
  if (sessionStorage.getItem('service-go.equipment-open') === '1') showEquipment();
  const issueForm = $('issueForm');
  $('openIssue').addEventListener('click', () => $('issueDialog').showModal());
  issueForm.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(issueForm);
    const button = event.submitter;
    button.disabled = true;
    const issue = {
      reason: fields.get('reason'), details: String(fields.get('details')).trim(),
      sessionId: shown?.id ?? null, createdAt: Date.now(),
    };
    const issueKey = 'service-go.issues.v1';
    try {
      await navigator.locks.request(issueKey, () => {
        const issues = JSON.parse(localStorage.getItem(issueKey) || '[]');
        localStorage.setItem(issueKey, JSON.stringify([...issues, issue]));
      });
      issueForm.reset();
      setText($('issueStatus'), 'Incidencia guardada en este navegador.');
    } catch {
      setText($('issueStatus'), 'No se pudo guardar la incidencia. Vuelve a intentarlo.');
    } finally {
      button.disabled = false;
    }
  });
  $('issueDialog').addEventListener('close', () => setText($('issueStatus'), ''));
  function openOperation(service) {
    if (service && !shown) {
      $('reservation').elements.service.value = service;
      updateHint();
    }
    configuring = true;
    viewingWelcome = false;
    render(shown);
    if (shown && !terminal.includes(shown.phase)) showEquipment();
    $(shown ? 'service-title' : 'service-choice').focus();
    if (service && shown && shown.service !== service) {
      showError(new Error(terminal.includes(shown.phase)
        ? 'Pulsa «Nueva sesión» para elegir otro servicio.'
        : 'Finaliza la sesión actual antes de cambiar de servicio.'));
    } else {
      showError(null);
    }
  }
  $('startService').addEventListener('click', () => openOperation());
  for (const button of document.querySelectorAll('[data-operation]:not([data-operation="home"])')) {
    button.addEventListener('click', () => openOperation(button.dataset.operation));
  }
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
      ? 'Objetivos simulados · delante ' + formatPressure(selected.front) + ' · detrás ' + formatPressure(selected.rear)
      : 'Todos los programas tienen la misma tarifa. Las pausas no se cobran.');
  }
  $('reservation').addEventListener('input', event => {
    updateHint();
    if (event.target.name === 'service') render(shown);
  });
  addEventListener('storage', event => {
    if (event.key === gasgoStorageKey || event.key === null) updateHint();
  });
  updateHint();
  $('reservation').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile = readProfile();
    const id = crypto.randomUUID();
    await update((current, now) => {
      if (current) return current;
      return createSession({
        service: form.get('service'), vehicle: profile.vehicle, customer: profile, method: form.get('method'),
        limit: Math.round(Number(form.get('limit')) * 100), id,
        code: String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
      }, now);
    });
    if (shown?.id === id) showEquipment();
  });
} else {
  if (window.parent !== window) {
    document.body.classList.add('equipment-embedded');
    document.querySelector('.topbar .brand').removeAttribute('href');
  }
  $('pressure-set').addEventListener('click', () => dispatch('set-pressure'));
  $('pressure-up').addEventListener('click', () => dispatch('adjust-pressure', 1));
  $('pressure-down').addEventListener('click', () => dispatch('adjust-pressure', -1));
  $('pressure-unit').addEventListener('click', () => dispatch('unit'));
  for (const [i, tire] of tires.entries()) {
    const card = document.createElement('div');
    card.className = 'tire';
    const title = document.createElement('h4');
    title.textContent = tire;
    const pressure = document.createElement('p');
    const button = makeButton('Elegir', () => dispatch('wheel', i));
    button.setAttribute('aria-describedby', 'wheel-title-' + i);
    title.id = 'wheel-title-' + i;
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
