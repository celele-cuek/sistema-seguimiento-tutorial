import { calcAlertaAsistencia } from './utils.js';

const NIVEL = { 'OK': 0, 'ALERTA': 1, 'CRÍTICO': 2 };

export function nivelMax(...niveles) {
  let max = 'OK';
  for (const n of niveles) {
    if (NIVEL[n] > NIVEL[max]) max = n;
  }
  return max;
}

export function calcResumenParticipante(registros, config) {
  const {
    umbral_critico = 70,
    umbral_alerta = 75,
    umbral_justificaciones = 3,
    umbral_retiros = 3,
    hora_inicio_sesion = '20:00',
  } = config;

  const cursadas = registros.filter(r => r.estado && r.estado !== '');
  const asistidas = cursadas.filter(r => r.estado === 'A');
  const justificadas = cursadas.filter(r => r.estado === 'J');
  const retiros = cursadas.filter(r => r.estado === 'R');
  const faltas = cursadas.filter(r => r.estado === 'F');

  const denominador = cursadas.filter(r => r.estado !== 'J').length;
  const numeradorPts = cursadas.reduce((sum, r) => {
    const pct = Number(r.pct_sesion ?? 0);
    return sum + pct;
  }, 0);

  const pct = denominador > 0 ? numeradorPts / (denominador * 100) : null;
  const pctNum = pct !== null ? pct * 100 : null;

  const alerta_asistencia = pctNum !== null
    ? calcAlertaAsistencia(pctNum, Number(umbral_critico), Number(umbral_alerta))
    : 'OK';

  const alerta_justificaciones = justificadas.length >= Number(umbral_justificaciones);
  const alerta_retiros = retiros.length >= Number(umbral_retiros);

  const alerta_max = nivelMax(
    alerta_asistencia,
    alerta_justificaciones ? 'ALERTA' : 'OK',
    alerta_retiros ? 'ALERTA' : 'OK',
  );

  const ultima = cursadas.sort((a, b) => b.semana - a.semana)[0];

  return {
    pct_asistencia: pct,
    sesiones_cursadas: cursadas.length,
    sesiones_asistidas: asistidas.length,
    contador_j: justificadas.length,
    contador_r: retiros.length,
    contador_f: faltas.length,
    alerta_asistencia,
    alerta_justificaciones,
    alerta_retiros,
    alerta_logro: false,
    alerta_moodle: false,
    alerta_max,
    ultima_sesion_registrada: ultima?.semana ?? 0,
    fecha_ultimo_registro: ultima?.fecha_sesion ?? '',
    logro_promedio: null,
    evaluaciones_bajo_umbral: 0,
  };
}

export function calcAlertaMoodle(diasSinAcceso, umbralDias) {
  return Number(diasSinAcceso) >= Number(umbralDias);
}

export function getAlertaColor(nivel) {
  if (nivel === 'CRÍTICO') return { bg: 'var(--color-critico-bg)', text: 'var(--color-critico-text)' };
  if (nivel === 'ALERTA') return { bg: 'var(--color-alerta-bg)', text: 'var(--color-alerta-text)' };
  return { bg: 'var(--color-ok-bg)', text: 'var(--color-ok-text)' };
}

export function getAlertaLabel(nivel) {
  const labels = { 'OK': 'OK', 'ALERTA': 'Alerta', 'CRÍTICO': 'Crítico' };
  return labels[nivel] || nivel;
}
