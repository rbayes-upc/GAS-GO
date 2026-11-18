import { equipment, methods, services, vehicles } from './engine.mjs';

export const money = cents => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const timer = milliseconds => {
  const seconds = Math.floor(milliseconds / 1000);
  return [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
};

function pdfText(value) {
  // Encode text as an ASCII hex string interpreted by PDF's WinAnsi font.
  return Array.from(String(value), char => {
    const code = char === '€' ? 128 : char.codePointAt(0);
    return (code <= 255 ? code : 63).toString(16).padStart(2, '0');
  }).join('');
}

export function receipt(session) {
  const lines = [
    ['Service&Go', 28], ['FACTURA SIMULADA', 16], ['Documento de demostración sin validez fiscal', 11],
    ['', 11], ['Referencia: ' + session.id, 12],
    ['Fecha: ' + new Date(session.finished).toLocaleString('es-ES'), 12],
    ['Servicio: ' + services[session.service].label, 12],
    ['Equipo: ' + equipment[session.service], 12],
    ['Identificación: ' + methods[session.method], 12],
    ['Vehículo: ' + vehicles[session.vehicle].label, 12],
    ['Tiempo activo: ' + timer(session.elapsed), 12],
    ['Importe máximo: ' + money(session.limit), 12],
    ['Finalización: ' + session.reason, 12],
    ['', 11], ['Total simulado: ' + money(session.total), 20],
  ];
  const stream = lines.map(([value, size], i) =>
    `BT /F1 ${size} Tf 48 ${780 - i * 31} Td <${pdfText(value)}> Tj ET\n`).join('');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const start = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n' + offsets.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}
