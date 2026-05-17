import { useMemo } from 'react';
import { calcResumenParticipante, nivelMax } from '../lib/alertEngine.js';
import { useConfig } from '../contexts/ConfigContext.jsx';

export function useAlerts(participantes, asistencia, resumen) {
  const { config } = useConfig();

  const alertasPorParticipante = useMemo(() => {
    if (!participantes?.length || !config) return {};
    const map = {};
    for (const p of participantes) {
      const r = resumen?.find(r => r.rut === p.rut);
      if (r) {
        map[p.rut] = {
          alerta_max: r.alerta_max || 'OK',
          alerta_asistencia: r.alerta_asistencia || 'OK',
          alerta_justificaciones: r.alerta_justificaciones === 'TRUE' || r.alerta_justificaciones === true,
          alerta_retiros: r.alerta_retiros === 'TRUE' || r.alerta_retiros === true,
          pct_asistencia: Number(r.pct_asistencia) || 0,
        };
      } else {
        map[p.rut] = { alerta_max: 'OK', alerta_asistencia: 'OK', alerta_justificaciones: false, alerta_retiros: false, pct_asistencia: null };
      }
    }
    return map;
  }, [participantes, resumen, config]);

  const alertasCriticas = useMemo(() => {
    return Object.entries(alertasPorParticipante)
      .filter(([, a]) => a.alerta_max === 'CRÍTICO')
      .map(([rut, a]) => ({ rut, ...a }));
  }, [alertasPorParticipante]);

  const alertasAlerta = useMemo(() => {
    return Object.entries(alertasPorParticipante)
      .filter(([, a]) => a.alerta_max === 'ALERTA')
      .map(([rut, a]) => ({ rut, ...a }));
  }, [alertasPorParticipante]);

  return { alertasPorParticipante, alertasCriticas, alertasAlerta };
}

export function useAlertaRealtime(estados, config) {
  return useMemo(() => {
    if (!estados || !config) return {};
    const registros = Object.entries(estados).map(([rut, s]) => ({
      rut,
      estado: s.estado,
      pct_sesion: s.pct_sesion ?? 0,
      semana: s.semana,
    }));
    return calcResumenParticipante(registros, config);
  }, [estados, config]);
}
