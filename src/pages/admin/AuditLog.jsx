import { useEffect, useState } from 'react';
import Topbar from '../../components/layout/Topbar.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { formatDateTime } from '../../lib/utils.js';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAccion, setFiltroAccion] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setLogs((await readSheet('LOG')).sort((a, b) => new Date(b.datetime) - new Date(a.datetime))); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const acciones = [...new Set(logs.map(l => l.accion))].filter(Boolean);
  const filtered = filtroAccion ? logs.filter(l => l.accion === filtroAccion) : logs;

  const columns = [
    { key: 'datetime', label: 'Fecha/hora', render: (v) => formatDateTime(v) },
    { key: 'usuario', label: 'Usuario', render: (v) => <span className="text-xs">{v}</span> },
    { key: 'rol_activo', label: 'Rol', sortable: false },
    { key: 'accion', label: 'Acción', render: (v) => <span className="text-xs font-mono">{v}</span> },
    { key: 'grupo', label: 'Grupo' },
    { key: 'semana', label: 'S.', sortable: false },
    { key: 'detalle', label: 'Detalle', render: (v) => <span className="text-xs text-gray-500">{v}</span> },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Log de auditoría" />
      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="flex gap-3 items-center">
          <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
            <option value="">Todas las acciones</option>
            {acciones.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={load} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Recargar</button>
        </div>
        {loading ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div> : (
          <DataTable columns={columns} data={filtered} searchable compact emptyText="Sin registros de auditoría" />
        )}
      </div>
    </div>
  );
}
