import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { readSheet, updateRow, writeRow, clearAndWriteSheet } from '../../lib/sheetsApi.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Plus, Shield, RefreshCw } from 'lucide-react';

const ROLES_OPTS = ['ADMIN', 'COORD', 'TUTOR', 'ASISTENTE'];

export default function UsersManager() {
  const { auth } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editU, setEditU] = useState(null);
  const [newMode, setNewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const blank = { correo: '', nombre_completo: '', rut: '', roles: 'TUTOR', grupos: '', activo: 'TRUE', correo_zoom: '', fecha_creacion: nowISO().split('T')[0] };

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const all = await readSheet('USUARIOS');
      const seen = new Set();
      setUsers(all.filter(u => {
        const key = u.correo?.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
    }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleDedup() {
    if (!confirm('¿Eliminar usuarios duplicados de Google Sheets?')) return;
    setDeduping(true);
    try {
      const all = await readSheet('USUARIOS');
      const seen = new Set();
      const unique = all.filter(u => {
        const key = u.correo?.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      await clearAndWriteSheet('USUARIOS', unique);
      await load();
    } catch (err) { console.error(err); }
    finally { setDeduping(false); }
  }

  async function handleSave() {
    if (!editU) return;
    setSaving(true);
    try {
      if (newMode) {
        await writeRow('USUARIOS', editU);
      } else {
        await updateRow('USUARIOS', editU._rowIndex, editU);
      }
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'EDITAR_USUARIO', entidad: 'USUARIOS', grupo: '', semana: '', detalle: editU.correo, ip: '' });
      setEditU(null);
      setNewMode(false);
      await load();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(u) {
    if (!confirm(`¿Desactivar a ${u.nombre_completo}?`)) return;
    await updateRow('USUARIOS', u._rowIndex, { ...u, activo: 'FALSE' });
    await load();
  }

  const columns = [
    { key: 'correo', label: 'Correo' },
    { key: 'nombre_completo', label: 'Nombre' },
    { key: 'roles', label: 'Roles', render: (v) => (
      <div className="flex gap-1 flex-wrap">
        {v?.split(',').filter(Boolean).map(r => (
          <span key={r} className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{
            background: r === 'ADMIN' ? '#FAF0DF' : r === 'COORD' ? '#E3F2EC' : r === 'TUTOR' ? '#E3F2EC' : '#EFF6FF',
            color: r === 'ADMIN' ? '#7A5010' : '#0A5645',
          }}>{r}</span>
        ))}
      </div>
    )},
    { key: 'grupos', label: 'Grupos' },
    { key: 'activo', label: 'Activo', render: (v) => v === 'TRUE' ? <span className="text-green-600 text-xs">Activo</span> : <span className="text-red-500 text-xs">Inactivo</span> },
    { key: 'acciones', label: '', sortable: false, render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); setEditU({ ...row }); setNewMode(false); }} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">Editar</button>
        {row.activo !== 'FALSE' && <button onClick={(e) => { e.stopPropagation(); handleDeactivate(row); }} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">Desactivar</button>}
      </div>
    )},
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Gestión de usuarios"
        actions={
          <div className="flex gap-2">
          <button onClick={handleDedup} disabled={deduping} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <RefreshCw size={14} className={deduping ? 'animate-spin' : ''} />{deduping ? 'Limpiando…' : 'Eliminar duplicados'}
          </button>
          <button onClick={() => { setEditU({ ...blank }); setNewMode(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--color-verde)' }}>
            <Plus size={14} />Nuevo usuario
          </button>
          </div>
        }
      />
      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div> : (
          <DataTable columns={columns} data={users} searchable emptyText="Sin usuarios" />
        )}
      </div>

      {editU && (
        <Modal open title={newMode ? 'Nuevo usuario' : `Editar: ${editU.correo}`} onClose={() => { setEditU(null); setNewMode(false); }} size="md"
          footer={
            <>
              <button onClick={() => { setEditU(null); setNewMode(false); }} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ background: 'var(--color-verde)' }}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {[
              { key: 'correo', label: 'Correo Gmail', type: 'email' },
              { key: 'nombre_completo', label: 'Nombre completo' },
              { key: 'rut', label: 'RUT' },
              { key: 'correo_zoom', label: 'Correo Zoom (opcional)', type: 'email' },
              { key: 'grupos', label: 'Grupos (ej: A01,B12)' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                <input type={f.type || 'text'} value={editU[f.key] || ''} onChange={e => setEditU(u => ({ ...u, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]" />
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Roles</label>
              <div className="flex gap-3 flex-wrap">
                {ROLES_OPTS.map(r => {
                  const active = editU.roles?.split(',').includes(r);
                  return (
                    <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={active} onChange={e => {
                        const current = editU.roles?.split(',').filter(Boolean) || [];
                        const updated = e.target.checked ? [...current, r] : current.filter(x => x !== r);
                        setEditU(u => ({ ...u, roles: updated.join(',') }));
                      }} className="w-4 h-4 accent-[var(--color-verde)]" />
                      <span className="text-sm text-gray-700">{r}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editU.activo === 'TRUE'} onChange={e => setEditU(u => ({ ...u, activo: e.target.checked ? 'TRUE' : 'FALSE' }))} className="w-4 h-4 accent-[var(--color-verde)]" />
                <span className="text-sm text-gray-700">Usuario activo</span>
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
