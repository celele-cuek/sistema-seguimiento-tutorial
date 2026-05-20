import Badge from '../ui/Badge.jsx';
import { pctDisplay } from '../../lib/utils.js';

const COLORS = {
  P:  { bg: 'bg-green-100', text: 'text-green-800' },
  R:  { bg: 'bg-amber-100', text: 'text-amber-800' },
  J:  { bg: 'bg-blue-100',  text: 'text-blue-800'  },
  A:  { bg: 'bg-red-100',   text: 'text-red-800'   },
};

function EstadoChip({ estado, label }) {
  if (!estado) return (
    <span className="inline-flex items-center gap-0.5 text-gray-300 text-[10px] leading-none">
      <span className="font-mono">{label}</span>
      <span>·</span>
    </span>
  );
  const { bg, text } = COLORS[estado] || { bg: 'bg-gray-100', text: 'text-gray-500' };
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] leading-none ${text}`}>
      <span className={`font-mono font-bold text-[9px] ${text} opacity-60`}>{label}</span>
      <span className={`px-1 py-0.5 rounded ${bg} ${text} font-bold text-[10px]`}>{estado}</span>
    </span>
  );
}

export default function AttendanceGrid({ participants, asistencia, resumen, totalSemanas = 12, semanaActual = 12, onCellClick }) {
  const semanas = Array.from({ length: totalSemanas }, (_, i) => i + 1);

  function getEstados(rut, semana) {
    const registros = asistencia.filter(
      r => r.rut_participante === rut && Number(r.semana.toString().trim()) === semana
    );
    const tp = registros.find(r => r.tipo_sesion === 'TP');
    const se = registros.find(r => r.tipo_sesion === 'SE');
    return { tp: tp?.estado || null, se: se?.estado || null };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ background: 'var(--color-oscuro)', color: '#9ABFB8' }}>
            <th className="px-3 py-2 text-left sticky left-0 z-10 min-w-[160px]" style={{ background: 'var(--color-oscuro)' }}>
              Participante
            </th>
            {semanas.map(s => (
              <th key={s} className={`px-1 py-2 text-center min-w-[52px] ${s > semanaActual ? 'opacity-40' : ''}`}>
                <div className="text-[10px] font-bold">S{s}</div>
                <div className="flex justify-center gap-1 mt-0.5 text-[8px] text-gray-400 font-normal">
                  <span>TP</span><span>SE</span>
                </div>
              </th>
            ))}
            <th className="px-3 py-2 text-center whitespace-nowrap">% Acum.</th>
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
                  const { tp, se } = getEstados(p.rut, s);
                  const hasData = tp || se;
                  const isFuture = s > semanaActual && !hasData;

                  return (
                    <td
                      key={s}
                      className={`px-1 py-1.5 text-center ${isFuture ? 'opacity-30' : ''} ${!isFuture && onCellClick ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                      onClick={() => !isFuture && onCellClick?.(p, s, { tp, se })}
                    >
                      {isFuture ? (
                        <span className="text-gray-300 text-xs">·</span>
                      ) : (
                        <div className="flex flex-col gap-0.5 items-center">
                          <EstadoChip estado={tp} label="T" />
                          <EstadoChip estado={se} label="S" />
                        </div>
                      )}
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

      {/* Legend */}
      <div className="mt-3 px-3 pb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500 border-t border-gray-100 pt-3">
        <span className="font-medium text-gray-600">Estados:</span>
        {[
          { k: 'P', label: 'Presente (100%)' },
          { k: 'R', label: 'Retiro (0 – 50%)' },
          { k: 'J', label: 'Justificado (excluido)' },
          { k: 'A', label: 'Ausente (0%)' },
        ].map(({ k, label }) => {
          const { bg, text } = COLORS[k];
          return (
            <span key={k} className="flex items-center gap-1">
              <span className={`inline-block w-5 h-5 rounded text-center leading-5 font-bold ${bg} ${text}`}>{k}</span>
              {label}
            </span>
          );
        })}
        <span className="flex items-center gap-1 ml-2 border-l border-gray-200 pl-3">
          <span className="font-mono text-[9px] text-gray-400 font-bold">T</span> = Tutoría pedagógica (TP)
        </span>
        <span className="flex items-center gap-1">
          <span className="font-mono text-[9px] text-gray-400 font-bold">S</span> = Sesión con experto (SE)
        </span>
      </div>
    </div>
  );
}
