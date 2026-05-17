import { useEffect, useState } from 'react';
import Topbar from '../../components/layout/Topbar.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { USUARIOS_SEED, GRUPOS_SEED } from '../../lib/seedData.js';
import { formatDateTime } from '../../lib/utils.js';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export default function TeamStatus() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const logData = await readSheet('LOG');
      setLogs(logData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const tutores = USUARIOS_SEED.filter(u => u.roles.includes('TUTOR'));

  function getLastActivity(correo) {
    const userLogs = logs.filter(l => l.usuario === correo).sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    return userLogs[0] || null;
  }

  const today = new Date();
  const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Estado del equipo de tutores" />
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--color-oscuro)', color: '#9ABFB8' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs">Tutor/a</th>
                  <th className="px-4 py-3 text-left text-xs">Grupos</th>
                  <th className="px-4 py-3 text-left text-xs">Última actividad</th>
                  <th className="px-4 py-3 text-left text-xs">Acción</th>
                  <th className="px-4 py-3 text-center text-xs">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tutores.map((t, i) => {
                  const act = getLastActivity(t.correo);
                  const lastDate = act ? new Date(act.datetime) : null;
                  const isActive = lastDate && lastDate > weekAgo;
                  const grupos = t.grupos?.split(',').filter(Boolean) || [];
                  return (
                    <tr key={t.correo} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{t.nombre_completo}</p>
                        <p className="text-xs text-gray-400">{t.correo}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {grupos.map(g => <span key={g} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{g}</span>)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{act ? formatDateTime(act.datetime) : 'Sin actividad'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{act?.accion?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {isActive
                          ? <CheckCircle size={16} className="text-green-500 inline-block" />
                          : <AlertTriangle size={16} className="text-amber-500 inline-block" />
                        }
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
