import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { pctDisplay } from '../../lib/utils.js';
import { HelpCircle, FileSpreadsheet } from 'lucide-react';
import { GRUPOS_SEED } from '../../lib/seedData.js';
import * as XLSX from 'xlsx';

const ALERT_ORDER = { 'CRÍTICO': 0, 'ALERTA': 1, 'OK': 2 };

export default function CriticalAlerts() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [resumen, setResumen] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroNivel, setFiltroNivel] = useState('TODOS');
  const [filtroGrupo, setFiltroGrupo] = useState('');

  const tutorPorGrupo = {};
  GRUPOS_SEED.forEach(g => { tutorPorGrupo[g.id] = g.tutor_nombre; });

  const isAsistente = auth?.roles?.includes('ASISTENTE') && !auth?.roles?.includes('COORD') && !auth?.roles?.includes('ADMIN');
  const misGrupos = auth?.grupos || [];

  // Grupos disponibles para el filtro: si es asistente con grupos → solo sus grupos; si no → todos
  const gruposDisponibles = (isAsistente && misGrupos.length > 0)
    ? GRUPOS_SEED.filter(g => misGrupos.includes(g.id))
    : GRUPOS_SEED;

  useEffect(() => {
    // Pre-seleccionar el primer grupo para asistentes con grupos asignados
    if (isAsistente && misGrupos.length > 0) setFiltroGrupo(misGrupos[0]);
  }, []);

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

  const partMap = {};
  participantes.forEach(p => { partMap[p.rut] = p; });

  const rows = resumen
    .filter(r => {
      const nivelOk = filtroNivel === 'TODOS' ? (r.alerta_max === 'CRÍTICO' || r.alerta_max === 'ALERTA') : r.alerta_max === filtroNivel;
      const grupoOk = filtroGrupo ? r.grupo === filtroGrupo : (isAsistente && misGrupos.length > 0 ? misGrupos.includes(r.grupo) : true);
      return nivelOk && grupoOk;
    })
    .map(r => ({ ...r, p: partMap[r.rut] || {} }))
    .sort((a, b) =>
      (a.grupo || '').localeCompare(b.grupo || '') ||
      (ALERT_ORDER[a.alerta_max] ?? 3) - (ALERT_ORDER[b.alerta_max] ?? 3)
    );

  function razones(r) {
    const m = [];
    if (r.alerta_asistencia && r.alerta_asistencia !== 'OK') m.push(`Asistencia ${r.alerta_asistencia} (${r.pct_asistencia}%)`);
    if (r.alerta_justificaciones === 'ALERTA') m.push(`Justificadas: ${r.contador_j}`);
    if (r.alerta_retiros === 'ALERTA') m.push(`Retiros: ${r.contador_r}`);
    if (r.alerta_logro === 'ALERTA') m.push('Bajo logro');
    if (r.alerta_moodle === 'ALERTA') m.push('Inactivo Moodle');
    return m.join(' · ');
  }

  function handleExcel() {
    const data = rows.map(({ p, ...r }) => ({
      'Nivel':              r.alerta_max,
      'Grupo':              r.grupo,
      'Tutor/a':            tutorPorGrupo[r.grupo] || '',
      'Nombre completo':    p.nombre_completo || '',
      'Correo':             p.correo || '',
      'Teléfono':           p.telefono || '',
      'Contacto preferido': p.contacto_preferido || '',
      'Función':            p.funcion_principal || '',
      'Establecimiento':    p.establecimiento || '',
      '% Asistencia':       r.pct_asistencia ? `${r.pct_asistencia}%` : '',
      'Inasistencias':      r.contador_a || '',
      'Justificadas':       r.contador_j || '',
      'Retiros':            r.contador_r || '',
      'Razón(es)':          razones(r),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [8,7,22,28,30,14,16,22,28,12,12,10,8,40].map(w => ({ wch: w }));
    const label = filtroGrupo ? `_${filtroGrupo}` : '';
    const nivel = filtroNivel === 'TODOS' ? 'alertas' : filtroNivel.toLowerCase();
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos');
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `contactos_${nivel}${label}_${fecha}.xlsx`);
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex-1 flex flex-col">
      <Topbar
        title="Alertas y contactos"
        actions={
          <button onClick={handleExcel}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-white text-sm font-medium"
            style={{ background: 'var(--color-verde)' }}>
            <FileSpreadsheet size={15} />
            Descargar Excel
          </button>
        }
      />
      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">

        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-start gap-2 text-xs text-blue-700">
          <HelpCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            Participantes con alertas activas, ordenados por grupo. El Excel descarga los datos de contacto de los participantes visibles según los filtros activos.
          </span>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {['TODOS', 'CRÍTICO', 'ALERTA'].map(f => (
              <button key={f} onClick={() => setFiltroNivel(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroNivel === f ? 'text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                style={filtroNivel === f ? { background: 'var(--color-verde)' } : {}}>
                {f}
              </button>
            ))}
          </div>

          <select
            value={filtroGrupo}
            onChange={e => setFiltroGrupo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)] bg-white"
          >
            <option value="">{isAsistente && misGrupos.length > 0 ? 'Mis grupos' : 'Todos los grupos'}</option>
            {gruposDisponibles.map(g => (
              <option key={g.id} value={g.id}>{g.id} — {g.tutor_nombre}</option>
            ))}
          </select>

          <span className="text-sm text-gray-500 ml-auto">{rows.length} participante{rows.length !== 1 ? 's' : ''}</span>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Sin participantes con alertas activas</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Grupo</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tutor/a</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Participante</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Alerta</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">% Asist.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Correo</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Teléfono</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contacto pref.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Razón</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, ...r }) => (
                  <tr key={r.rut} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.grupo}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[120px] truncate">{tutorPorGrupo[r.grupo] || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">{p.nombre_completo || r.rut}</div>
                      <div className="text-xs text-gray-400">{p.funcion_principal} · {p.establecimiento}</div>
                    </td>
                    <td className="px-3 py-2"><Badge nivel={r.alerta_max} /></td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.pct_asistencia ? pctDisplay(Number(r.pct_asistencia)) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{p.correo || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{p.telefono || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{p.contacto_preferido || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-400 max-w-[180px]">
                      <Tooltip content={razones(r) || 'Sin detalle'}>
                        <span className="truncate block">{razones(r) || '—'}</span>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => navigate(`/coord/participant/${r.rut}`)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap">
                        Ver ficha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
