import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import KpiCard from '../../components/ui/KpiCard.jsx';
import AlertItem from '../../components/ui/AlertItem.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { readSheet } from '../../lib/sheetsApi.js';
import { pctDisplay } from '../../lib/utils.js';
import { Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TutorDashboard() {
  const { auth } = useAuth();
  const { config } = useConfig();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ participantes: [], resumen: [], novedades: [], asistencia: [] });

  const grupos = auth?.grupos || [];

  useEffect(() => {
    if (!auth || !grupos.length) { setLoading(false); return; }
    loadData();
  }, [auth]);

  async function loadData() {
    setLoading(true);
    try {
      const [participantes, resumen, novedades] = await Promise.all([
        readSheet('PARTICIPANTES'),
        readSheet('RESUMEN_PARTICIPANTE'),
        readSheet('NOVEDADES'),
      ]);
      const mis = participantes.filter(p => grupos.includes(p.grupo) && p.estado !== 'Inactivo');
      const misRes = resumen.filter(r => grupos.includes(r.grupo));
      const misNov = novedades.filter(n => grupos.includes(n.grupo));
      setData({ participantes: mis, resumen: misRes, novedades: misNov });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const { participantes, resumen, novedades } = data;
  const criticos = resumen.filter(r => r.alerta_max === 'CRÍTICO');
  const enAlerta = resumen.filter(r => r.alerta_max === 'ALERTA');
  const pctGlobal = resumen.length
    ? resumen.reduce((s, r) => s + (Number(r.pct_asistencia) || 0), 0) / resumen.length
    : null;

  const alertasPendientes = novedades.filter(n => n.estado_caso === 'Pendiente' || n.estado_caso === 'En seguimiento');

  // Weekly coverage chart
  const semanas = Array.from({ length: config?.total_semanas || 12 }, (_, i) => i + 1);
  const semanaData = semanas.map(s => {
    const enSemana = resumen.filter(r => Number(r.ultima_sesion_registrada) >= s);
    const avg = enSemana.length
      ? enSemana.reduce((acc, r) => acc + (Number(r.pct_asistencia) || 0), 0) / enSemana.length
      : 0;
    return { semana: `S${s}`, pct: Math.round(avg * 100) };
  });

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title={`Mi Aula ${grupos.length === 1 ? `· Grupo ${grupos[0]}` : `· Grupos ${grupos.join(', ')}`}`} />
      <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Participantes"
            value={participantes.length}
            icon={<Users size={16} />}
            color="verde"
          />
          <KpiCard
            label="% Asistencia prom."
            value={pctGlobal !== null ? pctDisplay(pctGlobal) : '—'}
            color={pctGlobal !== null && pctGlobal * 100 <= (config?.umbral_critico || 70) ? 'critico' : 'verde'}
          />
          <KpiCard
            label="En zona crítica"
            value={criticos.length}
            icon={<AlertTriangle size={16} />}
            color={criticos.length > 0 ? 'critico' : 'verde'}
          />
          <KpiCard
            label="En zona alerta"
            value={enAlerta.length}
            icon={<Clock size={16} />}
            color={enAlerta.length > 0 ? 'alerta' : 'verde'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Asistencia promedio por semana</h2>
            {resumen.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos de asistencia aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={semanaData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                    {semanaData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.pct <= (config?.umbral_critico || 70) ? '#7A1818' : entry.pct <= (config?.umbral_alerta || 75) ? '#C8974A' : '#2E6B5E'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Alertas */}
          <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Alertas activas</h2>
              <span className="text-xs text-gray-400">{criticos.length + enAlerta.length} total</span>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 max-h-64">
              {criticos.length === 0 && enAlerta.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                  <CheckCircle size={24} className="text-green-400" />
                  <p className="text-sm">Sin alertas activas</p>
                </div>
              ) : (
                <>
                  {criticos.map(r => {
                    const p = participantes.find(x => x.rut === r.rut);
                    return (
                      <AlertItem
                        key={r.rut}
                        nivel="CRÍTICO"
                        participante={p?.nombre_completo || r.rut}
                        grupo={r.grupo}
                        descripcion={`Asistencia: ${pctDisplay(Number(r.pct_asistencia))}`}
                        accion="Ver ficha"
                        onAction={() => navigate(`/tutor/participant/${r.rut}`)}
                      />
                    );
                  })}
                  {enAlerta.map(r => {
                    const p = participantes.find(x => x.rut === r.rut);
                    return (
                      <AlertItem
                        key={r.rut}
                        nivel="ALERTA"
                        participante={p?.nombre_completo || r.rut}
                        grupo={r.grupo}
                        descripcion={`Asistencia: ${pctDisplay(Number(r.pct_asistencia))}`}
                        accion="Ver ficha"
                        onAction={() => navigate(`/tutor/participant/${r.rut}`)}
                      />
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Novedades pendientes */}
        {alertasPendientes.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Novedades pendientes de seguimiento ({alertasPendientes.length})</h2>
            <div className="flex flex-col gap-2">
              {alertasPendientes.slice(0, 5).map(n => (
                <AlertItem
                  key={n.id}
                  nivel={n.estado_caso === 'Pendiente' ? 'ALERTA' : 'OK'}
                  participante={n.nombre_participante || n.rut_participante}
                  grupo={n.grupo}
                  descripcion={`${n.tipo_novedad} · ${n.estado_caso}`}
                  accion="Ver"
                  onAction={() => navigate('/tutor/novedades')}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
