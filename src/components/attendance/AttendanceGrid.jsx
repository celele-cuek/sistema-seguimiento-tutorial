import Badge from '../ui/Badge.jsx';
import { pctDisplay } from '../../lib/utils.js';

const ESTADO_COLORS = {
  A:  'bg-green-100 text-green-800 font-semibold',
  R:  'bg-amber-100 text-amber-800 font-semibold',
  J:  'bg-blue-100  text-blue-800  font-semibold',
  F:  'bg-red-100   text-red-800   font-semibold',
  SE: 'bg-purple-100 text-purple-800 font-semibold',
  '': 'bg-gray-100 text-gray-400',
};

export default function AttendanceGrid({ participants, asistencia, resumen, totalSemanas = 12, semanaActual = 1, onCellClick }) {
  const semanas = Array.from({ length: totalSemanas }, (_, i) => i + 1);

  function getEstado(rut, semana) {
    const registros = asistencia.filter(r => r.rut_participante === rut && Number(r.semana) === semana);
    if (!registros.length) return null;
    const tipos = registros.map(r => r.tipo_sesion);
    if (tipos.includes('SE')) return { estado: registros.find(r => r.tipo_sesion === 'SE')?.estado, tipo: 'SE' };
    return { estado: registros[0]?.estado, tipo: registros[0]?.tipo_sesion };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ background: 'var(--color-oscuro)', color: '#9ABFB8' }}>
            <th className="px-3 py-2 text-left sticky left-0 z-10" style={{ background: 'var(--color-oscuro)' }}>Participante</th>
            {semanas.map(s => (
              <th key={s} className={`px-2 py-2 text-center w-10 ${s > semanaActual ? 'opacity-40' : ''}`}>S{s}</th>
            ))}
            <th className="px-3 py-2 text-center">% Acum.</th>
            <th className="px-3 py-2 text-center">Alerta</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p, i) => {
            const res = resumen?.find(r => r.rut === p.rut);
            const pct = res ? pctDisplay(Number(res.pct_asistencia)) : '—';
            const alerta = res?.alerta_max || 'OK';
            return (
              <tr key={p.rut} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-3 py-2 sticky left-0 z-10 bg-inherit min-w-[160px]">
                  <p className="font-medium text-gray-800 truncate max-w-[150px]">{p.nombre_completo}</p>
                  <p className="text-gray-400">{p.microgrupo}</p>
                </td>
                {semanas.map(s => {
                  const cell = getEstado(p.rut, s);
                  const isPending = s > semanaActual;
                  const displayEstado = cell?.tipo === 'SE' ? 'SE' : (cell?.estado || '');
                  const colorClass = isPending ? 'bg-gray-100 text-gray-300' : (ESTADO_COLORS[displayEstado] || ESTADO_COLORS['']);
                  return (
                    <td
                      key={s}
                      className={`px-1 py-2 text-center ${colorClass} ${!isPending && onCellClick ? 'cursor-pointer hover:opacity-80' : ''} rounded`}
                      onClick={() => !isPending && onCellClick?.(p, s, cell)}
                    >
                      {isPending ? '·' : (displayEstado || '—')}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-semibold text-gray-700">{pct}</td>
                <td className="px-3 py-2 text-center"><Badge nivel={alerta} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex gap-4 px-3 pb-2 text-xs text-gray-500 flex-wrap">
        {Object.entries({ A: 'Asistió (100%)', R: 'Retiro', J: 'Justificado', F: 'Falta', SE: 'Sesión con experto', '—': 'Pendiente' }).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`inline-block w-5 h-5 rounded text-center leading-5 text-xs ${ESTADO_COLORS[k === '—' ? '' : k]}`}>{k}</span>
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
