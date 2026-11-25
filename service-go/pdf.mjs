import { equipment, methods, services, sessionTariff, vehicles } from './engine.mjs?v=6';

export const money = cents => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export function tariffLabel(session) {
  const { cents, milliseconds } = sessionTariff(session);
  return money(cents) + (milliseconds === 60000 ? '/min' : '/s');
}

export const timer = (milliseconds, exact = false) => {
  const seconds = Math.floor(milliseconds / 1000);
  const display = [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
  return exact ? display + ',' + String(Math.floor(milliseconds % 1000 / 10)).padStart(2, '0') : display;
};

function pdfText(value) {
  // Encode text as an ASCII hex string interpreted by PDF's WinAnsi font.
  return Array.from(String(value), char => {
    const code = { '€': 128, '•': 149, '–': 150, '’': 146 }[char] ?? char.codePointAt(0);
    return (code <= 255 ? code : 63).toString(16).padStart(2, '0');
  }).join('');
}

export function invoiceDetails(session) {
  return {
    id: session.id,
    date: new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(session.finished),
    service: services[session.service].label,
    equipment: equipment[session.service],
    identification: methods[session.method],
    vehicle: session.customer?.vehicleLabel || vehicles[session.vehicle].label,
    customer: session.customer?.name || 'Perfil de demostración',
    payment: session.customer?.payment || 'Método de prueba',
    duration: timer(session.elapsed, session.service === 'air'),
    rate: tariffLabel(session),
    limit: money(session.limit),
    reason: session.reason,
    total: money(session.total),
  };
}

async function logoImage() {
  try {
    const logo = new Image();
    logo.src = new URL('./assets/logotipo-service-go-oscuro.png', import.meta.url);
    await logo.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 540;
    canvas.height = 162;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#09264c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(logo, 0, 220, 1672, 501, 0, 0, canvas.width, canvas.height);
    const bytes = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
    const hex = Array.from(bytes, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('') + '>';
    return `<< /Type /XObject /Subtype /Image /Width 540 /Height 162 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`;
  } catch {
    return null;
  }
}

export async function receipt(session) {
  const d = invoiceDetails(session);
  const logo = await logoImage();
  const navy = '0.035 0.149 0.298', yellow = '1 0.875 0.18';
  const light = '0.92 0.95 0.98', muted = '0.30 0.36 0.45', white = '1 1 1';
  const commands = [];
  const measure = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  const box = (x, y, w, h, color) => commands.push(`${color} rg ${x} ${842 - y - h} ${w} ${h} re f`);
  function text(value, x, y, size = 12, color = navy, font = 'F1') {
    commands.push(`BT ${color} rg /${font} ${size} Tf ${x} ${842 - y} Td <${pdfText(value)}> Tj ET`);
  }
  function field(label, value, x, y) {
    text(label, x, y, 9, muted, 'F2');
    const size = 11;
    if (measure) measure.font = 'bold 11px Helvetica, Arial, sans-serif';
    const width = measure?.measureText(value).width ?? value.length * 6;
    text(value, x, y + 20, Math.min(size, size * 245 / Math.max(width, 1)), navy, 'F2');
  }
  box(0, 0, 595, 136, navy);
  box(0, 0, 595, 6, yellow);
  if (logo) commands.push('q 242 0 0 72.6 34 736 cm /Logo Do Q');
  else text('Service&Go', 36, 80, 33, white, 'F2');
  box(377, 34, 182, 31, yellow);
  text('FACTURA SIMULADA', 393, 54, 13, navy, 'F2');
  text(d.date, 378, 87, 10, white);
  text('Referencia: ' + d.id, 36, 116, 9, white);

  text('RESUMEN DEL SERVICIO', 36, 163, 11, navy, 'F2');
  box(36, 177, 523, 82, light);
  field('SERVICIO', d.service, 50, 198);
  field('EQUIPO', d.equipment, 350, 198);
  text('Identificación: ' + d.identification, 50, 243, 10, muted);

  text('DATOS DE FACTURACIÓN', 36, 289, 11, navy, 'F2');
  field('EMISOR', 'Service&Go · Demostración', 36, 314);
  field('CLIENTE', d.customer, 300, 314);
  field('VEHÍCULO', d.vehicle, 36, 367);
  field('MÉTODO DE PAGO SIMULADO', d.payment, 300, 367);

  text('DETALLE DEL SERVICIO', 36, 429, 11, navy, 'F2');
  box(36, 444, 523, 28, light);
  text('CONCEPTO', 50, 462, 9, muted, 'F2');
  text('IMPORTE', 471, 462, 9, muted, 'F2');
  text(d.service, 50, 495, 13, navy, 'F2');
  text(d.total, 471, 495, 13, navy, 'F2');
  text('Tiempo activo: ' + d.duration + '  ·  Tarifa: ' + d.rate, 50, 518, 11, muted);
  text('Finalización: ' + d.reason, 50, 540, 11, muted);

  box(36, 576, 523, 94, navy);
  text('IMPORTE MÁXIMO', 54, 604, 9, white, 'F2');
  text(d.limit, 54, 635, 17, white, 'F2');
  text('TOTAL SIMULADO', 377, 604, 10, white, 'F2');
  text(d.total, 377, 642, 27, yellow, 'F2');

  box(36, 732, 523, 2, yellow);
  text('DOCUMENTO FICTICIO · SIN VALIDEZ FISCAL', 36, 756, 10, navy, 'F2');
  text('Actividad de demostración. No acredita un pago real.', 36, 778, 10, muted);

  const stream = commands.join('\n') + '\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> ${logo ? '/XObject << /Logo 7 0 R >>' : ''} >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  if (logo) objects.push(logo);
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const start = pdf.length;
  const count = objects.length + 1;
  pdf += `xref\n0 ${count}\n0000000000 65535 f \n` + offsets.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}
