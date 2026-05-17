import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import AlertItem from '../../components/ui/AlertItem.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { pctDisplay } from '../../lib/utils.js';

export default function CriticalAlerts() {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('CRÍTICO');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [res, parts] = await Promise.all([readSheet('RESUMEN_PARTICIPANTE'), readSheet('PARTICIPANTES')]);
      setResumen(res);
      setParticipantes(parts);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const filtered = resumen.filter(r => filtro === 'TODOS' || r.alerta_max === filtro);
  const withNames = filtered.map(r => {
    const p = participantes.find(x => x.rut === r.rut);
    return { ...r, nombre: p?.nombre_completo || r.rut, funcion: p?.funcion_principal || '', establecimiento: p?.establecimiento || '' };
  }).sort((a, b) => (a.alerta_max === 'CRÍTICO' ? -1 : 1));

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Alertas críticas" />
      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="flex gap-2">
          {['CRÍTICO', 'ALERTA', 'TODOS'].map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtro === f ? 'text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
              style={filtro === f ? { background: 'var(--color-verde)' } : {}}>
              {f}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500">{withNames.length} participante{withNames.length !== 1 ? 's' : ''} en estado {filtro.toLowerCase()}</p>
        <div className="flex flex-col gap-2">
          {withNames.map(r => (
            <AlertItem
              key={r.rut}
              nivel={r.alerta_max}
              participante={r.nombre}
              grupo={r.grupo}
              descripcion={`${pctDisplay(Number(r.pct_asistencia))} asistencia · ${r.funcion} · ${r.establecimiento}`}
              accion="Ver ficha"
              onAction={() => navigate(`/coord/participant/${r.rut}`)}
            />
          ))}
          {withNames.length === 0 && <div className="text-center py-10 text-gray-400">Sin alertas de nivel {filtro.toLowerCase()}</div>}
        </div>
      </div>
    </div>
  );
}
