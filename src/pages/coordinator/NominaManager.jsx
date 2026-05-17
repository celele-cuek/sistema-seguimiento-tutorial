import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { readSheet, updateRow, writeRow } from '../../lib/sheetsApi.js';
import { generateId, nowISO, normalizeRut } from '../../lib/utils.js';
import { Plus, HelpCircle } from 'lucide-react';
import { GRUPOS_SEED } from '../../lib/seedData.js';

export default function NominaManager() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grupo, setGrupo] = useState(searchParams.get('grupo') || '');
  const [editP, setEditP] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [grupo]);

  async function load() {
    setLoading(true);
    try {
      const [parts, res] = await Promise.all([readSheet('PARTICIPANTES'), readSheet('RESUMEN_PARTICIPANTE')]);
      const filtered = grupo ? parts.filter(p => p.grupo === grupo) : parts;
      setParticipants(filtered.filter(p => p.estado !== 'Inactivo'));
      setResumen(res);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!editP) return;
    setSaving(true);
    try {
      await updateRow('PARTICIPANTES', editP._rowIndex, editP);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: 'coord', rol_activo: 'COORD', accion: 'EDITAR_PARTICIPANTE', entidad: 'PARTICIPANTES', grupo: editP.grupo, semana: '', detalle: `RUT: ${editP.rut}`, ip: '' });
      setEditP(null);
      await load();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleBaja(p) {
    if (!confirm(`¿Dar de baja a ${p.nombre_completo}?`)) return;
    await updateRow('PARTICIPANTES', p._rowIndex, { ...p, estado: 'Inactivo', fecha_baja: nowISO().split('T')[0], motivo_baja: 'Baja manual por coordinación' });
    await load();
  }

  const columns = [
    { key: 'grupo', label: 'Grupo', render: (v) => <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{v}</span> },
    { key: 'microgrupo', label: 'MG', sortable: false },
    { key: 'nombre_completo', label: 'Nombre' },
    { key: 'funcion_principal', label: 'Función' },
    { key: 'establecimiento', label: 'Establecimiento' },
    { key: 'region', label: 'Región' },
    { key: 'rut', label: 'RUT', sortable: false },
    { key: 'alerta', label: 'Alerta', sortable: false, render: (_, row) => {
      const r = resumen.find(x => x.rut === row.rut);
      return <Badge nivel={r?.alerta_max || 'OK'} />;
    }},
    { key: 'acciones', label: '', sortable: false, render: (_, row) => (
      <div className="flex gap-1">
        <Tooltip content="Editar datos del participante: nombre, correo, grupo, microgrupo, función, establecimiento, etc.">
          <button onClick={(e) => { e.stopPropagation(); setEditP({ ...row }); }} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">Editar</button>
        </Tooltip>
        <Tooltip content="Marcar al participante como inactivo. Sus datos y registros de asistencia se conservan, pero ya no aparecerá en las listas activas ni en los cálculos de asistencia.">
          <button onClick={(e) => { e.stopPropagation(); handleBaja(row); }} className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">Baja</button>
        </Tooltip>
      </div>
    )},
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Gestión de nómina" />
      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-start gap-2 text-xs text-blue-700">
          <HelpCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            Nómina completa de participantes activos. Usa los filtros de grupo para ver un grupo específico.
            Haz clic en cualquier fila para ver la <strong>ficha completa del participante</strong> con su historial de asistencia y novedades.
            La columna <strong>Alerta</strong> refleja el nivel de riesgo actual según los umbrales configurados.
          </span>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <Tooltip content="Muestra todos los participantes activos del curso, sin filtrar por grupo.">
            <button onClick={() => setGrupo('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!grupo ? 'text-white' : 'bg-white border border-gray-200 text-gray-600'}`} style={!grupo ? { background: 'var(--color-verde)' } : {}}>Todos</button>
          </Tooltip>
          {GRUPOS_SEED.map(g => (
            <button key={g.id} onClick={() => setGrupo(g.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${grupo === g.id ? 'text-white' : 'bg-white border border-gray-200 text-gray-600'}`} style={grupo === g.id ? { background: 'var(--color-verde)' } : {}}>{g.id}</button>
          ))}
        </div>

        {loading ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div> : (
          <DataTable columns={columns} data={participants} searchable emptyText="Sin participantes" onRowClick={row => navigate(`/coord/participant/${row.rut}`)} />
        )}
      </div>

      {editP && (
        <Modal open title={`Editar: ${editP.nombre_completo}`} onClose={() => setEditP(null)} size="lg"
          footer={
            <>
              <button onClick={() => setEditP(null)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ background: 'var(--color-verde)' }}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'nombres', tip: 'Nombres del participante (sin apellidos).' },
              { key: 'primer_apellido', tip: 'Primer apellido.' },
              { key: 'segundo_apellido', tip: 'Segundo apellido.' },
              { key: 'correo', tip: 'Correo electrónico principal para contacto.' },
              { key: 'telefono', tip: 'Teléfono de contacto. Formato libre.' },
              { key: 'grupo', tip: 'ID del grupo de tutoría al que pertenece (ej: A01). Cambiar esto reasigna al participante.' },
              { key: 'microgrupo', tip: 'Subgrupo dentro del grupo de tutoría para organización interna del tutor.' },
              { key: 'funcion_principal', tip: 'Cargo o función que desempeña en su establecimiento (ej: Docente, Director, etc.).' },
              { key: 'establecimiento', tip: 'Nombre del establecimiento educacional donde trabaja.' },
              { key: 'region', tip: 'Región del país donde se ubica el establecimiento.' },
              { key: 'comuna', tip: 'Comuna donde se ubica el establecimiento.' },
              { key: 'dependencia', tip: 'Dependencia administrativa: Municipal, Particular subvencionado, Particular pagado, SLEP, etc.' },
            ].map(({ key, tip }) => (
              <div key={key}>
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  {key.replace(/_/g, ' ')}
                  <Tooltip content={tip}>
                    <HelpCircle size={10} className="text-gray-300 cursor-help" />
                  </Tooltip>
                </label>
                <input value={editP[key] || ''} onChange={e => setEditP(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]" />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
