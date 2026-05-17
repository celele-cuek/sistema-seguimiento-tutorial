import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import AttendanceGrid from '../../components/attendance/AttendanceGrid.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { HelpCircle } from 'lucide-react';

export default function WeeklyGrid() {
  const { auth } = useAuth();
  const { config } = useConfig();
  const [grupo, setGrupo] = useState(auth?.grupos?.[0] || '');
  const [participants, setParticipants] = useState([]);
  const [asistencia, setAsistencia] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(false);
  const grupos = auth?.grupos || [];

  useEffect(() => { if (grupo) load(); }, [grupo]);

  async function load() {
    setLoading(true);
    try {
      const [p, a, r] = await Promise.all([
        readSheet('PARTICIPANTES'),
        readSheet('ASISTENCIA'),
        readSheet('RESUMEN_PARTICIPANTE'),
      ]);
      setParticipants(p.filter(x => x.grupo === grupo && x.estado !== 'Inactivo').sort((a, b) => (a.microgrupo || '').localeCompare(b.microgrupo || '') || a.nombre_completo.localeCompare(b.nombre_completo)));
      setAsistencia(a.filter(x => x.grupo === grupo));
      setResumen(r.filter(x => x.grupo === grupo));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const semanaActual = getCurrentWeek(config?.fecha_inicio, config?.total_semanas);

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Grilla histórica de asistencia" />
      <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
        {/* Info header */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-start gap-2 text-xs text-blue-700 shrink-0">
          <HelpCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            Resumen visual de asistencia de todo el grupo semana a semana. Cada celda muestra el estado de la sesión TP o SE: <strong>A</strong> = asistió · <strong>R</strong> = retiro · <strong>J</strong> = justificado · <strong>F</strong> = falta · <strong>SE</strong> = sesión con experto.
            La columna <strong>% Acum.</strong> es el porcentaje de asistencia acumulado ponderado. La columna <strong>Alerta</strong> indica el nivel de riesgo actual.
          </span>
        </div>
        {grupos.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {grupos.map(g => (
              <button key={g} onClick={() => setGrupo(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${grupo === g ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                style={grupo === g ? { background: 'var(--color-verde)' } : {}}>
                Grupo {g}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-1 overflow-y-auto">
            {participants.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-400">No hay participantes para este grupo.</div>
            ) : (
              <AttendanceGrid
                participants={participants}
                asistencia={asistencia}
                resumen={resumen}
                totalSemanas={config?.total_semanas || 12}
                semanaActual={semanaActual}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getCurrentWeek(fechaInicio, totalSemanas) {
  if (!fechaInicio) return 1;
  const start = new Date(fechaInicio);
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.min(Math.max(Math.ceil((diffDays + 1) / 7), 1), totalSemanas || 12);
}
