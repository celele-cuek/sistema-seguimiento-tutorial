import * as XLSX from 'xlsx';
import { normalizeRut, validateRut } from './utils.js';

export const PARTICIPANTE_HEADERS = [
  'rut', 'nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo',
  'correo', 'genero', 'telefono', 'contacto_preferido', 'grupo', 'microgrupo',
  'funcion_principal', 'establecimiento', 'tipo_establecimiento', 'rbd',
  'region', 'comuna', 'dependencia', 'estado', 'fecha_ingreso',
  'fecha_baja', 'motivo_baja', 'notas',
];

export const USUARIO_HEADERS = [
  'correo', 'nombre_completo', 'rut', 'roles', 'grupos',
  'activo', 'correo_zoom', 'fecha_creacion',
];

export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function detectColumnMapping(headers, expectedHeaders) {
  const map = {};
  const normalized = headers.map(h => h?.toString().toLowerCase().trim().replace(/\s+/g, '_'));
  for (const expected of expectedHeaders) {
    const idx = normalized.findIndex(h => h === expected || h.includes(expected.slice(0, 5)));
    if (idx >= 0) map[expected] = idx;
  }
  return map;
}

export function processParticipantsFile(rawRows, columnMap) {
  if (!rawRows.length) return { valid: [], errors: [] };
  const valid = [];
  const errors = [];

  rawRows.forEach((row, i) => {
    if (i === 0) return; // skip header
    const get = (field) => {
      const idx = columnMap[field];
      return idx !== undefined ? (row[idx] ?? '').toString().trim() : '';
    };

    const rut = normalizeRut(get('rut'));
    const errList = [];

    if (!rut) errList.push('RUT vacío');
    else if (!validateRut(rut)) errList.push(`RUT inválido: ${rut}`);

    const correo = get('correo');
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      errList.push('Correo inválido');
    }

    const nombres = get('nombres') || get('nombre');
    const primerApellido = get('primer_apellido') || get('apellido_paterno');

    if (!nombres) errList.push('Nombre vacío');
    if (!primerApellido) errList.push('Apellido vacío');

    const obj = {
      rut,
      nombres,
      primer_apellido: primerApellido,
      segundo_apellido: get('segundo_apellido') || get('apellido_materno') || '',
      nombre_completo: get('nombre_completo') || `${nombres} ${primerApellido}`.trim(),
      correo,
      genero: get('genero') || '',
      telefono: get('telefono') || '',
      contacto_preferido: get('contacto_preferido') || 'Whatsapp',
      grupo: get('grupo') || '',
      microgrupo: get('microgrupo') || '',
      funcion_principal: get('funcion_principal') || get('cargo') || '',
      establecimiento: get('establecimiento') || '',
      tipo_establecimiento: get('tipo_establecimiento') || '',
      rbd: get('rbd') || '',
      region: get('region') || '',
      comuna: get('comuna') || '',
      dependencia: get('dependencia') || '',
      estado: 'Activo',
      fecha_ingreso: get('fecha_ingreso') || new Date().toISOString().split('T')[0],
      fecha_baja: '',
      motivo_baja: '',
      notas: get('notas') || '',
      _rowNum: i + 1,
      _errors: errList,
    };

    if (errList.length) errors.push(obj);
    else valid.push(obj);
  });

  return { valid, errors };
}

export function detectDuplicates(incoming, existing, field) {
  const existingValues = new Set(existing.map(r => r[field]).filter(Boolean));
  return incoming.map(r => ({
    ...r,
    _isDuplicate: existingValues.has(r[field]),
  }));
}

export function exportToExcel(sheetData, fileName) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheetData).forEach(([name, rows]) => {
    if (!rows.length) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, fileName);
}
