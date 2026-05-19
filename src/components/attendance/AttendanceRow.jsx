import { useState } from 'react';
import StatusButton from './StatusButton.jsx';
import NovedadCounter from './NovedadCounter.jsx';
import Badge from '../ui/Badge.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { calcPctSesion, calcAlertaAsistencia } from '../../lib/utils.js';
import { HelpCircle } from 'lucide-react';

export default function AttendanceRow({ participant, estado, observacion = '', onEstadoChange, onObservacionChange, config, novedades = [] }) {
  const [showTime, setShowTime] = useState(estado?.estado === 'R' || estado?.estado === 'J');

  function handleEstado(newEstado) {
    if (estado?.estado === newEstado) {
      setShowTime(false);
      onEstadoChange?.(participant.rut, { estado: '', pct_sesion: '', hora_evento: '' });
      return;
    }
    const needsTime = newEstado === 'R' || newEstado === 'J';
    setShowTime(needsTime);
    const pct = calcPctSesion(newEstado, estado?.hora_evento, config?.hora_inicio_sesion);
    onEstadoChange?.(participant.rut, { estado: newEstado, pct_sesion: pct, hora_evento: needsTime ? (estado?.hora_evento || '') : '' });
  }

  function handleTimeChange(e) {
    const hora = e.target.value;
    const pct = calcPctSesion(estado?.estado, hora, config?.hora_inicio_sesion);
    onEstadoChange?.(participant.rut, { ...estado, hora_evento: hora, pct_sesion: pct });
  }

  const pct = estado?.pct_sesion;
  const alerta = participant.alerta_max || 'OK';
  const lastNovedad = novedades[0]?.observacion ? `[${novedades[0].fecha_registro?.slice(5, 10)?.replace('-', '-')}] ${novedades[0].observacion}` : null;
  const novCount = novedades.length;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2 text-xs text-gray-400 font-mono">{participant.microgrupo || '—'}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{participant.nombre_completo}</span>
          <NovedadCounter count={novCount} lastNovedad={lastNovedad} />
        </div>
        <p className="text-xs text-gray-400">{participant.funcion_principal} · {participant.establecimiento}</p>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {['A', 'R', 'J', 'F'].map(s => (
            <StatusButton key={s} state={s} selected={estado?.estado} onClick={handleEstado} />
          ))}
        </div>
      </td>
      <td className="px-3 py-2 w-32">
        {showTime && (
          <Tooltip content="Hora en que ocurrió el retiro o la justificación. Determina el % de asistencia: si fue dentro de la 1ª hora → 0%, después → 50%.">
            <input
              type="time"
              value={estado?.hora_evento || ''}
              onChange={handleTimeChange}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]"
            />
          </Tooltip>
        )}
      </td>
      <td className="px-3 py-2 w-44">
        <Tooltip content="Texto libre. Si escribes algo aquí, se crea automáticamente una novedad en el registro del participante para trazabilidad y seguimiento.">
          <input
            type="text"
            value={observacion}
            onChange={e => onObservacionChange?.(participant.rut, e.target.value)}
            placeholder="Observación…"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]"
          />
        </Tooltip>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {pct !== null && pct !== undefined && (
            <span className="text-xs text-gray-500">{pct}%</span>
          )}
          <Badge nivel={alerta} />
        </div>
      </td>
    </tr>
  );
}
