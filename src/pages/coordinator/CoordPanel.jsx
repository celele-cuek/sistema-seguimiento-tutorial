import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { pctDisplay } from '../../lib/utils.js';
import { GRUPOS_SEED } from '../../lib/seedData.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Users, TrendingUp, HelpCircle } from 'lucide-react';

export default function CoordPanel() {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState([]);
  const [participantes, setParticipantes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [res, parts, users] = await Promise.all([
        readSheet('RESUMEN_PARTICIPANTE'),
        readSheet('PARTICIPANTES'),
        readSheet('USUARIOS'),
      ]);
      setResumen(res);
      setParticipantes(parts.filter(p => p.estado !== 'Inactivo'));
      setUsuarios(users);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al cargar datos');
    }
    finally { setLoading(false); }
  }

  const normPct = (v) => { const n = Number(v) || 0; return n > 1 ? n / 100 : n; };

  function getGrupoStats(grupoId) {
    const gRes = resumen.filter(r => r.grupo === grupoId);
    const gParts = participantes.filter(p => p.grupo === grupoId);
    if (!gRes.length) return { pct: null, criticos: 0, alertas: 0, total: gParts.length, alerta_max: 'OK' };
    const pct = gRes.reduce((s, r) => s + normPct(r.pct_asistencia), 0) / gRes.length;
    const criticos = gRes.filter(r => r.alerta_max === 'CRÍTICO').length;
    const alertas = gRes.filter(r => r.alerta_max === 'ALERTA').length;
    const alerta_max = criticos > 0 ? 'CRÍTICO' : alertas > 0 ? 'ALERTA' : 'OK';
    return { pct, criticos, alertas, total: gParts.length, alerta_max };
  }

  const santiagoCorrecto = 'santiago.scabezas@gmail.com';
  const santiagoCarga = GRUPOS_SEED.filter(g => g.tutor_correo === santiagoCorrecto);

  const chartData = GRUPOS_SEED.map(g => {
    const s = getGrupoStats(g.id);
    return { grupo: g.id, pct: s.pct !== null ? Math.round(s.pct * 100) : 0 };
  });

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div>;

  if (error) return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Panel de coordinación" />
      <div className="flex-1 p-6 flex flex-col items-center justify-center gap-4">
        <AlertTriangle size={32} className="text-amber-500" />
        <div className="text-center max-w-md">
          <p className="font-semibold text-gray-700 mb-1">No se pudo cargar la información</p>
          <p className="text-sm text-gray-500 mb-3">Verificá que tu cuenta de Google tenga acceso a la planilla del sistema. Si el problema persiste, contactá al administrador.</p>
          <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded px-3 py-2">{error}</p>
        </div>
        <button onClick={load} className="text-sm text-[var(--color-verde)] underline">Reintentar</button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Panel de coordinación" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">

        {/* Riesgo operacional */}
        {santiagoCarga.length >= 4 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Riesgo operacional — Carga excesiva</p>
              <p className="text-sm text-amber-700">Santiago Cabezas tiene {santiagoCarga.length} grupos asignados ({santiagoCarga.map(g => g.id).join(', ')}). Evaluar redistribución de carga.</p>
            </div>
          </div>
        )}

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tooltip content="Total de participantes activos en el curso. No incluye personas dadas de baja. Haz clic en cualquier tarjeta de grupo para ver el detalle.">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center cursor-default">
              <div className="text-2xl font-bold text-[var(--color-verde)]">{participantes.length}</div>
              <div className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                Participantes activos <HelpCircle size={10} className="text-gray-300" />
              </div>
            </div>
          </Tooltip>
          <Tooltip content="Participantes con asistencia bajo el umbral crítico. Requieren contacto inmediato. El umbral se configura en Admin → Umbrales.">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center cursor-default">
              <div className="text-2xl font-bold text-[#7A1818]">{resumen.filter(r => r.alerta_max === 'CRÍTICO').length}</div>
              <div className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                En zona crítica <HelpCircle size={10} className="text-gray-300" />
              </div>
            </div>
          </Tooltip>
          <Tooltip content="Participantes con asistencia entre el umbral de alerta y el crítico. Están en riesgo — se recomienda contacto preventivo del tutor.">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center cursor-default">
              <div className="text-2xl font-bold text-[#7A5010]">{resumen.filter(r => r.alerta_max === 'ALERTA').length}</div>
              <div className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                En zona alerta <HelpCircle size={10} className="text-gray-300" />
              </div>
            </div>
          </Tooltip>
          <Tooltip content="Promedio de asistencia ponderado sobre todos los participantes y todas las sesiones registradas hasta la fecha. Incluye TP y SE.">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center cursor-default">
              <div className="text-2xl font-bold text-gray-700">
                {resumen.length ? pctDisplay(resumen.reduce((s, r) => s + normPct(r.pct_asistencia), 0) / resumen.length) : '—'}
              </div>
              <div className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                Asistencia global <HelpCircle size={10} className="text-gray-300" />
              </div>
            </div>
          </Tooltip>
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Asistencia promedio por grupo</h2>
            <Tooltip content="Compara el porcentaje de asistencia promedio entre los 16 grupos. Las barras rojas están bajo el umbral crítico; las naranjas bajo el umbral de alerta; las verdes están bien. Los grupos sin datos aparecen en 0%.">
              <HelpCircle size={13} className="text-gray-300 cursor-help" />
            </Tooltip>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="grupo" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <ReTooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pct <= 70 ? '#7A1818' : entry.pct <= 75 ? '#C8974A' : '#2E6B5E'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Group cards */}
        <div className="flex items-center gap-2">
          <Users size={14} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Grupos ({GRUPOS_SEED.length})</h2>
          <Tooltip content="Cada tarjeta muestra el ID del grupo, el/la tutor/a responsable, el % de asistencia promedio del grupo y cuántos participantes tienen alertas activas. Haz clic para ver la nómina detallada del grupo.">
            <HelpCircle size={13} className="text-gray-300 cursor-help" />
          </Tooltip>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GRUPOS_SEED.map(g => {
            const stats = getGrupoStats(g.id);
            return (
              <div key={g.id}
                onClick={() => navigate(`/coord/nomina?grupo=${g.id}`)}
                className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-lg">{g.id}</span>
                  <Badge nivel={stats.alerta_max} />
                </div>
                <div className="text-xs text-gray-500 truncate">{g.tutor_nombre.split(' ').slice(-2).join(' ')}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xl font-bold" style={{ color: stats.pct !== null && stats.pct * 100 <= 70 ? '#7A1818' : 'var(--color-verde)' }}>
                    {stats.pct !== null ? pctDisplay(stats.pct) : '—'}
                  </span>
                  <span className="text-xs text-gray-400">{stats.total} part.</span>
                </div>
                {(stats.criticos > 0 || stats.alertas > 0) && (
                  <div className="text-xs text-gray-500">
                    {stats.criticos > 0 && <span className="text-[#7A1818] font-medium">{stats.criticos} crítico{stats.criticos !== 1 ? 's' : ''} </span>}
                    {stats.alertas > 0 && <span className="text-[#7A5010] font-medium">{stats.alertas} alerta{stats.alertas !== 1 ? 's' : ''}</span>}
                  </div>
                )}
                <div className="text-xs text-gray-400">{g.tipo_establecimiento}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
