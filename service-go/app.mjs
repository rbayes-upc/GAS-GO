import { act, advance, createSession, equipment, methods, pressureUnits, programs, selectedWheel, services, target, tireLabels, tires } from './engine.mjs?v=6';
import { invoiceDetails, money, receipt, tariffLabel, timer } from './pdf.mjs?v=5';
import { gasgoStorageKey, serviceProfile } from './profile.mjs';

const key = 'service-go.session.v1';
const invoiceKey = 'service-go.invoices.v1';
const issueKey = 'service-go.issues.v1';
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
let auxiliaryView = null;
let profilePage = 'overview';
let selectedInvoice = null;

function read() {
  return JSON.parse(localStorage.getItem(key));
}

function readInvoices() {
  try {
    const list = JSON.parse(localStorage.getItem(invoiceKey) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function rememberInvoice(session) {
  if (session?.phase !== 'finished') return;
  const invoices = readInvoices();
  if (!invoices.some(invoice => invoice.id === session.id)) {
    localStorage.setItem(invoiceKey, JSON.stringify([session, ...invoices]));
  }
}

function fillInvoice(node, session) {
  const details = invoiceDetails(session);
  for (const field of node.querySelectorAll('[data-invoice]')) setText(field, details[field.dataset.invoice]);
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
      const detectCustomer = !client && current?.phase === 'requested' && current.method === 'auto';
      const next = change ? change(current, now) : detectCustomer ? act(current, 'identify', null, now) : current;
      if (next !== previous) {
        if (next) localStorage.setItem(key, JSON.stringify(next));
        else {
          rememberInvoice(current);
          localStorage.removeItem(key);
        }
      }
      try { rememberInvoice(next); }
      finally { render(next); }
    });
    if (change) showError(null);
  } catch (error) {
    showError(error);
  }
}

function status(session) {
  const active = client ? 'Sigue las indicaciones del equipo.' : 'Selecciona un control para empezar o continuar.';
  switch (session.phase) {
    case 'requested':
      if (session.method === 'auto') return 'Esperando la identificación automática del equipo.';
      return client ? 'Inicia la identificación en el simulador.' : 'Solicitud recibida. Identifica al cliente para empezar.';
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
  $('session').hidden = !session || viewingWelcome || Boolean(auxiliaryView);
  if (client) {
    $('welcome').hidden = Boolean(auxiliaryView) || (!viewingWelcome && (Boolean(session) || configuring));
    $('reservation').hidden = Boolean(auxiliaryView) || viewingWelcome || Boolean(session) || !configuring;
    $('invoicesView').hidden = auxiliaryView !== 'invoices';
    $('profileView').hidden = auxiliaryView !== 'profile';
    $('backService').hidden = !$('welcome').hidden;
    $('openEquipment').hidden = !session || terminal.includes(session.phase) || !$('equipmentPane').hidden;
    setText($('startService'), session ? 'Continuar sesión' : 'Probar Service&Go');
    const operation = auxiliaryView ?? (!$('welcome').hidden ? 'home' : session?.service ?? $('reservation').elements.service.value);
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
    identify: session.phase === 'requested' && session.method !== 'auto',
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
      fillInvoice(invoice, session);
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
  const session = auxiliaryView === 'invoices' ? selectedInvoice : shown;
  if (session?.phase !== 'finished') return;
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
      opener.hidden = true;
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
    opener.hidden = !shown || terminal.includes(shown.phase);
    document.body.classList.remove('equipment-open');
    sessionStorage.removeItem('service-go.equipment-open');
  }
  $('closeEquipment').addEventListener('click', async () => {
    await pauseSession();
    hideEquipment();
    if (!opener.hidden) opener.focus();
  });
  async function showWelcome() {
    if (!$('welcome').hidden) return;
    auxiliaryView = null;
    await pauseSession();
    hideEquipment();
    configuring = false;
    viewingWelcome = true;
    render(shown);
    $('welcome-title').focus();
  }
  $('backService').addEventListener('click', () => {
    if (auxiliaryView === 'profile' && profilePage !== 'overview') {
      showProfilePage('overview');
      return;
    }
    if (!auxiliaryView) {
      showWelcome();
      return;
    }
    auxiliaryView = null;
    render(shown);
    if (shown && !viewingWelcome) $('service-title').focus();
    else $($('reservation').hidden ? 'welcome-title' : 'service-choice').focus();
  });
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
    try {
      await navigator.locks.request(issueKey, () => {
        const issues = JSON.parse(localStorage.getItem(issueKey) || '[]');
        localStorage.setItem(issueKey, JSON.stringify([...issues, issue]));
      });
      issueForm.reset();
      if (auxiliaryView === 'profile' && profilePage === 'issues') renderProfileIssues();
      setText($('issueStatus'), 'Incidencia guardada en este navegador.');
    } catch {
      setText($('issueStatus'), 'No se pudo guardar la incidencia. Vuelve a intentarlo.');
    } finally {
      button.disabled = false;
    }
  });
  $('issueDialog').addEventListener('close', () => setText($('issueStatus'), ''));
  function openOperation(service) {
    auxiliaryView = null;
    if (service && !shown) $('reservation').elements.service.value = service;
    updateProfile();
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
  function renderProfileIssues() {
    const list = $('profileIssueList');
    list.replaceChildren();
    let issues = [];
    try {
      const stored = JSON.parse(localStorage.getItem(issueKey) || '[]');
      if (Array.isArray(stored)) issues = stored.slice().reverse();
    } catch {}
    if (!issues.length) list.textContent = 'Todavía no tienes incidencias.';
    for (const issue of issues) {
      const card = document.createElement('div');
      card.className = 'panel';
      const title = document.createElement('strong');
      title.textContent = issue.reason;
      const date = document.createElement('small');
      date.textContent = new Date(issue.createdAt).toLocaleDateString('es-ES');
      card.append(title, date);
      if (issue.details) {
        const details = document.createElement('p');
        details.textContent = issue.details;
        card.append(details);
      }
      list.append(card);
    }
  }
  function showProfilePage(page) {
    profilePage = page;
    for (const section of document.querySelectorAll('[data-profile-page]')) {
      section.hidden = section.dataset.profilePage !== page;
      if (!section.hidden) section.querySelector('h2').focus();
    }
    if (page === 'issues') renderProfileIssues();
  }
  for (const button of document.querySelectorAll('[data-profile-open]')) {
    button.addEventListener('click', () => showProfilePage(button.dataset.profileOpen));
  }
  $('newProfileIssue').addEventListener('click', () => $('issueDialog').showModal());
  addEventListener('storage', event => {
    if (event.key === issueKey && auxiliaryView === 'profile' && profilePage === 'issues') renderProfileIssues();
  });
  $('startService').addEventListener('click', () => openOperation(shown ? null : 'wash'));
  for (const button of document.querySelectorAll('[data-operation="air"], [data-operation="wash"]')) {
    button.addEventListener('click', () => openOperation(button.dataset.operation));
  }
  const savedInvoice = $('serviceInvoice').cloneNode(true);
  savedInvoice.id = 'savedInvoice';
  savedInvoice.hidden = false;
  savedInvoice.tabIndex = -1;
  $('invoicePreview').append(savedInvoice);

  function renderInvoices() {
    const invoices = readInvoices();
    if (shown?.phase === 'finished' && !invoices.some(invoice => invoice.id === shown.id)) invoices.unshift(shown);
    const list = $('invoiceList');
    list.replaceChildren();
    if (!invoices.length) list.textContent = 'Todavía no tienes facturas.';
    for (const session of invoices) {
      const details = invoiceDetails(session);
      const button = makeButton(details.service, () => {
        selectedInvoice = session;
        fillInvoice(savedInvoice, session);
        $('invoiceDetail').hidden = false;
        savedInvoice.scrollIntoView({ block: 'start' });
        savedInvoice.focus({ preventScroll: true });
      });
      const summary = document.createElement('small');
      summary.textContent = details.date + ' · ' + details.total;
      button.append(summary);
      list.append(button);
    }
  }
  $('downloadSavedInvoice').addEventListener('click', download);
  addEventListener('storage', event => {
    if (event.key === invoiceKey && auxiliaryView === 'invoices') renderInvoices();
  });
  for (const view of ['invoices', 'profile']) {
    document.querySelector(`[data-operation="${view}"]`).addEventListener('click', () => {
      auxiliaryView = view;
      if (view === 'invoices') {
        selectedInvoice = null;
        $('invoiceDetail').hidden = true;
        renderInvoices();
      } else {
        updateProfile();
      }
      render(shown);
      if (view === 'profile') showProfilePage('overview');
      else $('invoicesTitle').focus();
    });
  }
  for (const [id, label] of Object.entries(methods)) $('method').add(new Option(label, id));
  function updateProfile() {
    const profile = readProfile();
    const service = $('reservation').elements.service.value;
    setText($('service-choice'), 'Hola, ' + profile.name.split(' ')[0]);
    for (const guide of document.querySelectorAll('[data-service-guide]')) {
      guide.hidden = guide.dataset.serviceGuide !== service;
    }
    setText($('saved-profile-origin'), profile.linked ? 'Perfil de GAS&GO' : 'Perfil de demostración');
    setText($('saved-profile-name'), profile.name);
    setText($('saved-profile-vehicle'), profile.vehicleLabel);
    setText($('saved-profile-payment'), profile.payment + ' · Predeterminado');
    setText($('paymentDetails'), profile.payment);
    setText($('profileInitials'), profile.name.split(' ').slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('es-ES'));
  }
  const options = $('sessionOptions');
  options.addEventListener('submit', event => event.preventDefault());
  function updateLimitSummary() {
    const value = options.elements.limit.valueAsNumber;
    setText($('profileLimitSummary'), Number.isFinite(value) ? 'Máximo ' + money(Math.round(value * 100)) + ' por sesión' : 'Importe máximo por sesión');
  }
  options.addEventListener('input', updateLimitSummary);
  updateLimitSummary();
  addEventListener('storage', event => {
    if (event.key === gasgoStorageKey || event.key === null) updateProfile();
  });
  updateProfile();
  $('reservation').addEventListener('submit', async event => {
    event.preventDefault();
    if (!options.checkValidity()) {
      auxiliaryView = 'profile';
      render(shown);
      showProfilePage('limits');
      options.reportValidity();
      return;
    }
    const service = event.currentTarget.elements.service.value;
    const settings = new FormData(options);
    const profile = readProfile();
    const id = crypto.randomUUID();
    await update((current, now) => {
      if (current) return current;
      return createSession({
        service, vehicle: profile.vehicle, customer: profile, method: settings.get('method'),
        limit: Math.round(Number(settings.get('limit')) * 100), id,
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
