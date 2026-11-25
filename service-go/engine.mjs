export const vehicles = {
  motorcycle: { label: 'Moto', front: 2.2, rear: 2.5 },
  city: { label: 'Urbano', front: 2.3, rear: 2.1 },
  suv: { label: 'SUV', front: 2.5, rear: 2.5 },
  van: { label: 'Furgoneta', front: 3.2, rear: 3.5 },
};
export const services = {
  air: { label: 'Inflador de neumáticos', tariff: { cents: 5, milliseconds: 1000 } },
  wash: { label: 'Autolavado con pistola', tariff: { cents: 100, milliseconds: 60000 } },
};
const legacyTariffs = {
  air: { cents: 2, milliseconds: 1000 },
  wash: { cents: 5, milliseconds: 1000 },
};

export function sessionTariff(session) {
  return session.tariff ?? legacyTariffs[session.service];
}

export const methods = {
  auto: 'Automático',
  confirm: 'Confirmación en app',
  code: 'Código temporal',
};
export const tires = ['Delantero izquierdo', 'Delantero derecho', 'Trasero izquierdo', 'Trasero derecho'];
const motorcycleTires = ['Delantero', 'Trasero'];
export function tireLabels(session) {
  return session.vehicle === 'motorcycle' ? motorcycleTires : tires;
}
export const programs = { degrease: 'Desengrasante', water: 'Lavado', foam: 'Jabón', rinse: 'Aclarado' };
export const pressureUnits = {
  BAR: { factor: 1, step: 0.1, decimals: 2 },
  PSI: { factor: 14.5037738, step: 1, decimals: 1 },
  kPa: { factor: 100, step: 10, decimals: 0 },
};
const unitNames = Object.keys(pressureUnits);
const minPressure = 0.5;
const maxPressure = 6;

export function selectedWheel(session) {
  const next = tireLabels(session).findIndex((_, i) => !session.completed.includes(i));
  return session.tire ?? session.selectedTire ?? (next >= 0 ? next : session.completed.at(-1) ?? 0);
}
export const equipment = { air: 'A-01', wash: 'L-01' };

export function createSession({ service, vehicle, method, limit, id, code, customer }, now) {
  if (!Object.hasOwn(services, service) || !Object.hasOwn(vehicles, vehicle) ||
      !Object.hasOwn(methods, method) || !Number.isInteger(limit) || limit < 50 || limit > 5000) {
    throw new Error('Elige un servicio y fija un límite entre 0,50 € y 50,00 €.');
  }
  return {
    service, vehicle, method, limit, id, code, customer, tariff: services[service].tariff, created: now, expires: now + 90000,
    phase: 'requested', elapsed: 0, total: 0, pressures: vehicle === 'motorcycle' ? [1.8, 2.0] : [1.8, 2.0, 1.9, 2.2],
    completed: [], tire: null, program: 'water', runningSince: null,
  };
}

export function target(session, tire) {
  if (session.pressureGoal != null && tire === selectedWheel(session)) return session.pressureGoal;
  if (session.completed.includes(tire)) return session.pressures[tire];
  return vehicles[session.vehicle][tire < tireLabels(session).length / 2 ? 'front' : 'rear'];
}

function finish(session, now, reason) {
  return { ...session, phase: 'finished', finished: now, runningSince: null, reason };
}

function authorize(session) {
  return { ...session, phase: 'ready', code: null };
}

export function advance(session, now) {
  if (session.phase === 'identifying' && session.method === 'auto' &&
      now >= session.identifyingSince + 900 && session.identifyingSince + 900 < session.expires) {
    return authorize(session);
  }
  if (['requested', 'identifying'].includes(session.phase) && now >= session.expires) {
    return { ...session, phase: 'expired', code: null };
  }
  if (session.phase !== 'running') return session;

  const { cents, milliseconds } = sessionTariff(session);
  const untilLimit = Math.ceil(session.limit * milliseconds / cents) - session.elapsed;
  const untilTarget = session.service === 'air'
    ? Math.ceil(Math.abs(target(session, session.tire) - session.pressures[session.tire]) * 5000 - 1e-8)
    : Infinity;
  const duration = Math.max(0, Math.min(now - session.runningSince, untilLimit, untilTarget));
  if (!duration && untilTarget > 0) return session;

  const eventTime = session.runningSince + duration;
  const elapsed = session.elapsed + duration;
  let updated = {
    ...session, elapsed, runningSince: eventTime,
    total: Math.min(session.limit, Math.floor(elapsed * cents / milliseconds)),
  };
  if (session.service === 'air') {
    updated.pressures = [...session.pressures];
    const desired = target(session, session.tire);
    const current = session.pressures[session.tire];
    updated.pressures[session.tire] = duration === untilTarget
      ? desired : current + Math.sign(desired - current) * duration / 5000;
    if (duration === untilTarget) {
      updated.completed = [...new Set([...session.completed, session.tire])];
      updated = { ...updated, phase: 'ready', runningSince: null, tire: null, selectedTire: null, pressureDraft: null, pressureGoal: null };
    }
  }
  if (duration === untilLimit) return finish(updated, eventTime, 'Importe máximo alcanzado');
  return updated;
}

export function act(session, action, value, now) {
  const current = advance(session, now);
  switch (action) {
    case 'identify':
      if (current.phase === 'requested') return { ...current, phase: 'identifying', identifyingSince: now };
      break;
    case 'confirm':
      if (current.phase === 'identifying' && current.method === 'confirm') return authorize(current);
      break;
    case 'code':
      if (current.phase === 'identifying' && current.method === 'code') {
        if (value !== current.code) throw new Error('El código es incorrecto. Revisa la app del cliente.');
        return authorize(current);
      }
      break;
    case 'unit':
      if (current.service === 'air' && ['ready', 'running'].includes(current.phase)) {
        const next = (unitNames.indexOf(current.pressureUnit ?? 'BAR') + 1) % unitNames.length;
        return { ...current, pressureUnit: unitNames[next] };
      }
      break;
    case 'wheel':
      if (current.service === 'air' && current.phase === 'ready' &&
          Number.isInteger(value) && value >= 0 && value < tireLabels(current).length) {
        if (value === selectedWheel(current)) return current;
        return { ...current, selectedTire: value, pressureDraft: null, pressureGoal: null };
      }
      break;
    case 'adjust-pressure':
      if (current.service === 'air' && current.phase === 'ready' && (value === 1 || value === -1)) {
        const wheel = selectedWheel(current);
        const unit = pressureUnits[current.pressureUnit ?? 'BAR'];
        const draft = current.pressureDraft ?? target(current, wheel);
        const adjusted = draft + value * unit.step / unit.factor;
        return { ...current, pressureDraft: Math.max(minPressure, Math.min(maxPressure, adjusted)), pressureGoal: null };
      }
      break;
    case 'set-pressure':
      if (current.service === 'air' && current.phase === 'ready') {
        return { ...current, pressureGoal: current.pressureDraft ?? target(current, selectedWheel(current)) };
      }
      break;
    case 'pressurize':
      if (current.service === 'air' && current.phase === 'ready' && current.pressureGoal != null) {
        const tire = selectedWheel(current);
        return advance({
          ...current, tire, completed: current.completed.filter(i => i !== tire),
          phase: 'running', runningSince: now,
        }, now);
      }
      break;
    case 'program':
      if (current.service === 'wash' && ['ready', 'running'].includes(current.phase) && Object.hasOwn(programs, value)) {
        return { ...current, program: value };
      }
      break;
    case 'spray':
      if (current.service === 'wash' && current.phase === 'running') {
        return { ...current, phase: 'ready', runningSince: null };
      }
      if (current.service === 'wash' && current.phase === 'ready') {
        return { ...current, phase: 'running', runningSince: now };
      }
      break;
    case 'pause':
      if (current.phase === 'running') return { ...current, phase: 'ready', runningSince: null, tire: null };
      break;
    case 'finish':
      if (['ready', 'running'].includes(current.phase)) return finish(current, now, 'Finalización manual');
      break;
    case 'cancel':
      if (['requested', 'identifying'].includes(current.phase)) return { ...current, phase: 'cancelled', code: null };
      break;
  }
  return current;
}
