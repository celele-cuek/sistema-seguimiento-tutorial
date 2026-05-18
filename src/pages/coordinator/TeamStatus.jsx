import { useEffect, useState } from 'react';
import Topbar from '../../components/layout/Topbar.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { USUARIOS_SEED, GRUPOS_SEED } from '../../lib/seedData.js';
import { formatDateTime } from '../../lib/utils.js';
import { CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

export default function TeamStatus() {
  const [logs, setLogs] = useState([]);
  const [asistencia, setAsistencia] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [logData, asistData] = await Promise.all([readSheet('LOG'), readSheet('ASISTENCIA')]);
      setLogs(logData);
      setAsistencia(asistData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const tutores = USUARIOS_SEED.filter((u, i, arr) =>
    u.roles.includes('TUTOR') && arr.findIndex(x => x.correo === u.correo) === i
  );

  function getLastActivity(correo) {
    return logs.filter(l => l.usuario === correo).sort((a, b) => new Date(b.datetime) - new Date(a.datetime))[0] || null;
  }

  function getPuntualidad(correo) {
    const grupos_t = (USUARIOS_SEED.find(u => u.correo === correo)?.grupos || '').split(',').filter(Boolean);
    const registros = asistencia.filter(a => grupos_t.includes(a.grupo) && a.registrado_por === correo);
    let tardios = 0, aTiempo = 0;
    registros.forEach(a => {
      if (!a.fecha_sesion || !a.fecha_registro) return;
      const horas = (new Date(a.fecha_registro) - new Date(a.fecha_sesion + 'T23:59:59')) / 3600000;
      if (horas > 24) tardios++; else aTiempo++;
    });
    const ultReg = registros.sort((a, b) => b.fecha_registro?.localeCompare(a.fecha_registro))[0];
    return { tardios, aTiempo, total: registros.length, ultReg };
  }

  const today = new Date();
  const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);
  const activos = tutores.filter(t => { const a = getLastActivity(t.correo); return a && new Date(a.datetime) > weekAgo; }).length;
  const inactivos = tutores.length - activos;

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Estado del equipo de tutores" />
      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-start gap-2 text-xs text-blue-700">
          <HelpCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            Monitoreo de actividad del equipo de tutores basado en el registro de auditoría del sistema.
            El indicador de estado es <strong>verde</strong> si el/la tutor/a realizó alguna acción en los últimos 7 días,
            y <strong>naranja</strong> si no hay actividad reciente — lo que puede indicar que no ha ingresado asistencia o novedades.
          </span>
        </div>

        {/* Summary */}
        <div className="flex gap-3">
          <Tooltip content="Tutores que han registrado al menos una acción en el sistema en los últimos 7 días (guardar asistencia, registrar novedad, etc.).">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <CheckCircle size={14} className="text-green-500" />
              <span className="font-medium text-gray-700">{activos} activos</span>
              <HelpCircle size={11} className="text-gray-300 cursor-help" />
            </div>
          </Tooltip>
          <Tooltip content="Tutores sin actividad registrada en los últimos 7 días. Pueden no haber ingresado sesiones o no haber usado el sistema esa semana.">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <AlertTriangle size={14} className="text-amber-500" />
              <span className="font-medium text-gray-700">{inactivos} sin actividad reciente</span>
              <HelpCircle size={11} className="text-gray-300 cursor-help" />
            </div>
          </Tooltip>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--color-oscuro)', color: '#9ABFB8' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs">Tutor/a</th>
                  <th className="px-4 py-3 text-left text-xs">
                    <Tooltip content="Grupos asignados a este tutor/a. Un tutor con más de 3 grupos puede tener carga operacional alta.">
                      <span className="flex items-center gap-1 cursor-help">Grupos <HelpCircle size={10} /></span>
                    </Tooltip>
                  </th>
                  <th className="px-4 py-3 text-left text-xs">
                    <Tooltip content="Fecha y hora de la última acción registrada en el sistema (guardar asistencia, agregar novedad, cargar Moodle, etc.).">
                      <span className="flex items-center gap-1 cursor-help">Última actividad <HelpCircle size={10} /></span>
                    </Tooltip>
                  </th>
                  <th className="px-4 py-3 text-left text-xs">Acción</th>
                  <th className="px-4 py-3 text-center text-xs">
                    <Tooltip content="Verde: activo en los últimos 7 días. Naranja: sin actividad reciente.">
                      <span className="flex items-center justify-center gap-1 cursor-help">Actividad <HelpCircle size={10} /></span>
                    </Tooltip>
                  </th>
                  <th className="px-4 py-3 text-center text-xs">
                    <Tooltip content="Puntualidad en el registro de asistencia. El plazo máximo es 24 horas desde la realización de la sesión.">
                      <span className="flex items-center justify-center gap-1 cursor-help">Puntualidad 24h <HelpCircle size={10} /></span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tutores.map((t, i) => {
                  const act = getLastActivity(t.correo);
                  const lastDate = act ? new Date(act.datetime) : null;
                  const isActive = lastDate && lastDate > weekAgo;
                  const grupos = t.grupos?.split(',').filter(Boolean) || [];
                  const highLoad = grupos.length >= 4;
                  const punt = getPuntualidad(t.correo);
                  return (
                    <tr key={t.correo} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{t.nombre_completo}</p>
                        <p className="text-xs text-gray-400">{t.correo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap items-center">
                          {grupos.map(g => <span key={g} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{g}</span>)}
                          {highLoad && (
                            <Tooltip content={`Este tutor/a tiene ${grupos.length} grupos asignados — carga operacional alta.`}>
                              <AlertTriangle size={13} className="text-amber-500 cursor-help" />
                            </Tooltip>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{act ? formatDateTime(act.datetime) : 'Sin actividad'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{act?.accion?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Tooltip content={isActive ? 'Activo en los últimos 7 días.' : 'Sin actividad reciente.'}>
                          {isActive
                            ? <CheckCircle size={16} className="text-green-500 inline-block" />
                            : <AlertTriangle size={16} className="text-amber-500 inline-block" />
                          }
                        </Tooltip>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {punt.total === 0 ? (
                          <span className="text-xs text-gray-400">Sin registros</span>
                        ) : punt.tardios === 0 ? (
                          <Tooltip content={`${punt.aTiempo} sesión(es) registradas dentro de las 24h.`}>
                            <CheckCircle size={16} className="text-green-500 inline-block" />
                          </Tooltip>
                        ) : (
                          <Tooltip content={`${punt.tardios} registro(s) fuera de plazo (>24h desde la sesión). ${punt.aTiempo} a tiempo.`}>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={11} />{punt.tardios} tardío{punt.tardios > 1 ? 's' : ''}
                            </span>
                          </Tooltip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
