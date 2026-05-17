import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { readSheet, writeRow } from '../../lib/sheetsApi.js';
import { generateId, nowISO, formatDateTime } from '../../lib/utils.js';
import { Plus } from 'lucide-react';

const TIPOS_NOVEDAD = [
  'Retiro en primera hora',
  'Retiro/tardanza antes de 1h',
  'Ausencia justificada (con documento)',
  'Ausencia injustificada',
  'No entregó trabajo/actividad',
  'Problemas técnicos de conexión',
  'Abandono voluntario del curso',
  'Situación personal crítica',
  'Contacto realizado por tutor/a',
  'Derivación a coordinación',
  'Caso resuelto — cierre',
];

const ESTADOS_CASO = ['Pendiente', 'En seguimiento', 'Resuelto', 'Derivado a coord.', 'Baja definitiva'];

const ALERTA_MAP = { 'Pendiente': 'ALERTA', 'En seguimiento': 'ALERTA', 'Resuelto': 'OK', 'Derivado a coord.': 'CRÍTICO', 'Baja definitiva': 'CRÍTICO' };

export default function Novedades() {
  const { auth } = useAuth();
  const { config } = useConfig();
  const [novedades, setNovedades] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [grupo, setGrupo] = useState(auth?.grupos?.[0] || '');
  const grupos = auth?.grupos || [];

  const [form, setForm] = useState({ rut_participante: '', tipo_novedad: '', hora_evento: '', estado_caso: 'Pendiente', requiere_seguimiento: 'No', observacion: '', semana: '1', tipo_sesion: 'TP' });

  useEffect(() => { load(); }, [grupo]);

  async function load() {
    setLoading(true);
    try {
      const [nov, part] = await Promise.all([readSheet('NOVEDADES'), readSheet('PARTICIPANTES')]);
      setNovedades(nov.filter(n => n.grupo === grupo).sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro)));
      setParticipants(part.filter(p => p.grupo === grupo && p.estado !== 'Inactivo'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!form.rut_participante || !form.tipo_novedad) return;
    setSaving(true);
    try {
      const p = participants.find(x => x.rut === form.rut_participante);
      const row = {
        id: generateId(),
        fecha_registro: nowISO(),
        semana: form.semana,
        tipo_sesion: form.tipo_sesion,
        grupo,
        rut_participante: form.rut_participante,
        nombre_participante: p?.nombre_completo || form.rut_participante,
        tipo_novedad: form.tipo_novedad,
        hora_evento: form.hora_evento,
        estado_caso: form.estado_caso,
        requiere_seguimiento: form.requiere_seguimiento,
        observacion: form.observacion,
        registrado_por: auth.email,
        fecha_edicion: '',
        editado_por: '',
      };
      await writeRow('NOVEDADES', row);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'TUTOR', accion: 'AGREGAR_NOVEDAD', entidad: 'NOVEDADES', grupo, semana: form.semana, detalle: form.tipo_novedad, ip: '' });
      setShowModal(false);
      setForm({ rut_participante: '', tipo_novedad: '', hora_evento: '', estado_caso: 'Pendiente', requiere_seguimiento: 'No', observacion: '', semana: '1', tipo_sesion: 'TP' });
      await load();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  const totalSemanas = config?.total_semanas || 12;
  const semanas = Array.from({ length: totalSemanas }, (_, i) => String(i + 1));

  let filtered = novedades;
  if (filtroEstado) filtered = filtered.filter(n => n.estado_caso === filtroEstado);
  if (filtroTipo) filtered = filtered.filter(n => n.tipo_novedad === filtroTipo);

  const columns = [
    { key: 'fecha_registro', label: 'Fecha', render: (v) => formatDateTime(v) },
    { key: 'nombre_participante', label: 'Participante' },
    { key: 'tipo_novedad', label: 'Tipo' },
    { key: 'estado_caso', label: 'Estado', render: (v) => <Badge nivel={ALERTA_MAP[v] || 'OK'} className="text-xs" /> },
    { key: 'observacion', label: 'Observación', render: (v) => <span className="text-xs text-gray-600 max-w-xs truncate block">{v}</span> },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Topbar
        title="Novedades"
        actions={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium" style={{ background: 'var(--color-verde)' }}>
            <Plus size={14} /> Nueva novedad
          </button>
        }
      />
      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
        {grupos.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {grupos.map(g => (
              <button key={g} onClick={() => setGrupo(g)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${grupo === g ? 'text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                style={grupo === g ? { background: 'var(--color-verde)' } : {}}>
                Grupo {g}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
            <option value="">Todos los estados</option>
            {ESTADOS_CASO.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
            <option value="">Todos los tipos</option>
            {TIPOS_NOVEDAD.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <DataTable columns={columns} data={filtered} emptyText="Sin novedades registradas" searchable />
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar novedad" size="md"
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.rut_participante || !form.tipo_novedad}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ background: 'var(--color-verde)' }}>
              {saving ? 'Guardando…' : 'Guardar novedad'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Participante</label>
            <select value={form.rut_participante} onChange={e => setForm(f => ({ ...f, rut_participante: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
              <option value="">Seleccionar…</option>
              {participants.map(p => <option key={p.rut} value={p.rut}>{p.nombre_completo}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Semana</label>
              <select value={form.semana} onChange={e => setForm(f => ({ ...f, semana: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                {semanas.map(s => <option key={s} value={s}>Semana {s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo sesión</label>
              <select value={form.tipo_sesion} onChange={e => setForm(f => ({ ...f, tipo_sesion: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                <option value="TP">TP</option>
                <option value="SE">SE</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo de novedad</label>
            <select value={form.tipo_novedad} onChange={e => setForm(f => ({ ...f, tipo_novedad: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
              <option value="">Seleccionar…</option>
              {TIPOS_NOVEDAD.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Hora evento</label>
              <input type="time" value={form.hora_evento} onChange={e => setForm(f => ({ ...f, hora_evento: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Estado del caso</label>
              <select value={form.estado_caso} onChange={e => setForm(f => ({ ...f, estado_caso: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                {ESTADOS_CASO.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Requiere seguimiento</label>
            <select value={form.requiere_seguimiento} onChange={e => setForm(f => ({ ...f, requiere_seguimiento: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
              <option value="No">No</option>
              <option value="Sí">Sí</option>
              <option value="Derivar a coord.">Derivar a coordinación</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Observación</label>
            <textarea rows={3} value={form.observacion} onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)] resize-none"
              placeholder="Describa la situación…" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
