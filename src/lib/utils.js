export function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function normalizeRut(rut) {
  if (!rut) return '';
  const clean = rut.toString().replace(/\./g, '').replace(/\s/g, '').toLowerCase();
  if (!clean.includes('-')) {
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    return `${body}-${dv}`;
  }
  return clean;
}

export function formatRut(rut) {
  const clean = normalizeRut(rut);
  const [body, dv] = clean.split('-');
  if (!body || !dv) return rut;
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}

export function validateRut(rut) {
  const clean = normalizeRut(rut);
  const [body, dv] = clean.split('-');
  if (!body || !dv) return false;
  const num = parseInt(body, 10);
  if (isNaN(num)) return false;
  let sum = 0;
  let mult = 2;
  let n = num;
  while (n > 0) {
    sum += (n % 10) * mult;
    n = Math.floor(n / 10);
    mult = mult === 7 ? 2 : mult + 1;
  }
  const expected = 11 - (sum % 11);
  const dvExpected = expected === 11 ? '0' : expected === 10 ? 'k' : String(expected);
  return dvExpected === dv.toLowerCase();
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatShortDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dt) {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dt;
  }
}

export function nowISO() {
  return new Date().toISOString();
}

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

export function minutesDiff(time1, time2) {
  if (!time1 || !time2) return 0;
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

export function calcPctSesion(estado, horaEvento, horaInicioSesion) {
  if (estado === 'P') return 100;
  if (estado === 'A') return 0;
  if (estado === 'J') return 0;
  if (estado === 'R') {
    if (!horaEvento || !horaInicioSesion) return 0;
    const diff = minutesDiff(horaInicioSesion, horaEvento);
    return diff >= 60 ? 50 : 0;
  }
  return null;
}

export function calcAlertaAsistencia(pct, umbralCritico, umbralAlerta) {
  if (pct === null || pct === undefined) return 'OK';
  const p = pct <= 1 ? pct * 100 : pct;
  if (p <= umbralCritico) return 'CRÍTICO';
  if (p <= umbralAlerta) return 'ALERTA';
  return 'OK';
}

export function pctDisplay(pct) {
  if (pct === null || pct === undefined || pct === '') return '—';
  const n = pct <= 1 ? pct * 100 : pct;
  return `${Math.round(n)}%`;
}

export function slugify(str) {
  return str?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || '';
}

export function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  return diff;
}
