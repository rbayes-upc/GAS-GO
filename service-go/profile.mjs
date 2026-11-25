export const gasgoStorageKey = 'gasgo_demo';

function clean(value, max = 54) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

export function serviceProfile(data) {
  if (!data?.profile) {
    return { name: 'Alex García', payment: 'Visa (demo)', vehicleLabel: 'Coche de ejemplo', vehicle: 'city', linked: false };
  }
  const active = data.customVehicle?.name === data.vehicle ? data.customVehicle : null;
  const kind = clean(active?.kind).toLowerCase();
  const description = [active?.name, active?.model, data.vehicle].map(value => clean(value)).join(' ');
  const vehicle = kind === 'moto' || (!kind && /\b(moto|motocicleta|scooter|xmax)\b/i.test(description)) ? 'motorcycle'
    : kind === 'furgoneta' || /\bfurgoneta\b/i.test(description) ? 'van'
    : /\bsuv\b/i.test(description) ? 'suv' : 'city';
  return {
    name: clean([clean(data.profile.first), clean(data.profile.last)].filter(Boolean).join(' ')) || 'Perfil GAS&GO',
    payment: clean(data.payment) || 'Método de prueba',
    vehicleLabel: clean(data.vehicle) || 'Coche de ejemplo',
    vehicle,
    linked: true,
  };
}
