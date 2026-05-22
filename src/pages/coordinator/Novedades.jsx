import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { readSheet, updateRow, writeRow } from '../../lib/sheetsApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { formatDateTime, nowISO, generateId } from '../../lib/utils.js';
import { GRUPOS_SEED } from '../../lib/seedData.js';
import { HelpCircle, MessageSquare } from 'lucide-react';

const ESTADOS_CASO = ['Pendiente', 'En seguimiento', 'Resuelto', 'Derivado a coord.', 'Baja definitiva'];
const ALERTA_MAP = { 'Pendiente': 'ALERTA', 'En seguimiento': 'ALERTA', 'Resuelto': 'OK', 'Derivado a coord.': 'CRÍTICO', 'Baja definitiva': 'CRÍTICO' };

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

const tutorPorGrupo = {};
GRUPOS_SEED.forEach(g => { tutorPorGrupo[g.id] = g.tutor_nombre; });

export default function CoordNovedades() {
  const { auth } = useAuth();
  const navigate = useNavigate();

  const isAsistente = auth?.roles?.includes('ASISTENTE') && !auth?.roles?.includes('COORD') && !auth?.roles?.includes('ADMIN');
  const misGrupos = auth?.grupos || [];

  const gruposDisponibles = (isAsistente && misGrupos.length > 0)
    ? GRUPOS_SEED.filter(g => misGrupos.includes(g.id))
    : GRUPOS_SEED;

  const [novedades, setNovedades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [selected, setSelected] = useState(null);
  const [editEstado, setEditEstado] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAsistente && misGrupos.length > 0) setFiltroGrupo(misGrupos[0]);
  }, []);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await readSheet('NOVEDADES');
      const sorted = rows.sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));
      setNovedades(sorted);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al cargar datos');
    }
    finally { setLoading(false); }
  }

  function openDetail(nov) {
    setSelected(nov);
    setEditEstado(nov.estado_caso || 'Pendiente');
  }

  function closeDetail() {
    setSelected(null);
    setEditEstado('');
  }

  async function handleGuardarEstado() {
    if (!selected || editEstado === selected.estado_caso) { closeDetail(); return; }
    setSaving(true);
    try {
      const now = nowISO();
      const updated = { ...selected, estado_caso: editEstado, fecha_edicion: now, editado_por: auth.email };
      await updateRow('NOVEDADES', selected._rowIndex, updated);
      await writeRow('LOG', {
        id: generateId(), datetime: now, usuario: auth.email, rol_activo: 'COORD',
        accion: 'EDITAR_NOVEDAD', entidad: 'NOVEDADES', grupo: selected.grupo,
        semana: selected.semana, detalle: `estado: ${selected.estado_caso} → ${editEstado}`, ip: '',
      });
      setNovedades(prev => prev.map(n =>
        n._rowIndex === selected._rowIndex ? updated : n
      ));
      setSelected(updated);
      setEditEstado(updated.estado_caso);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  const canEditEstado = auth?.roles?.includes('COORD') || auth?.roles?.includes('ADMIN');

  let rows = novedades;
  if (filtroGrupo) rows = rows.filter(n => n.grupo === filtroGrupo);
  else if (isAsistente && misGrupos.length > 0) rows = rows.filter(n => misGrupos.includes(n.grupo));
  if (filtroEstado) rows = rows.filter(n => n.estado_caso === filtroEstado);
  if (filtroTipo) rows = rows.filter(n => n.tipo_novedad === filtroTipo);
  if (busqueda) {
    const q = busqueda.toLowerCase();
    rows = rows.filter(n =>
      (n.nombre_participante || '').toLowerCase().includes(q) ||
      (n.tipo_novedad || '').toLowerCase().includes(q) ||
      (n.observacion || '').toLowerCase().includes(q)
    );
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Novedades" />
      <div className="flex-1 p-6 flex flex-col items-center justify-center gap-4">
        <HelpCircle size={32} className="text-amber-500" />
        <div className="text-center max-w-md">
          <p className="font-semibold text-gray-700 mb-1">No se pudo cargar la información</p>
          <p className="text-sm text-gray-500 mb-3">Verificá que tu cuenta de Google tenga acceso a la planilla del sistema.</p>
          <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded px-3 py-2">{error}</p>
        </div>
        <button onClick={load} className="text-sm text-[var(--color-verde)] underline">Reintentar</button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Novedades" />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-start gap-2 text-xs text-blue-700">
          <HelpCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            Registro consolidado de novedades de todas las aulas. Haz clic en una fila para ver el detalle completo
            {canEditEstado ? ' y actualizar el estado del caso.' : '.'}
          </span>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar participante, tipo u observación…"
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)] bg-white w-64"
          />
          <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)] bg-white">
            <option value="">{isAsistente && misGrupos.length > 0 ? 'Mis grupos' : 'Todos los grupos'}</option>
            {gruposDisponibles.map(g => (
              <option key={g.id} value={g.id}>{g.id} — {g.tutor_nombre}</option>
            ))}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)] bg-white">
            <option value="">Todos los estados</option>
            {ESTADOS_CASO.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)] bg-white">
            <option value="">Todos los tipos</option>
            {TIPOS_NOVEDAD.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-sm text-gray-500 ml-auto">
            {rows.length} novedad{rows.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {/* Tabla */}
        {rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400 flex flex-col items-center gap-2">
            <MessageSquare size={32} className="text-gray-300" />
            Sin novedades registradas con los filtros actuales
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Grupo</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tutor/a</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Participante</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sem.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de novedad</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Req. seguim.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(n => (
                  <tr
                    key={n.id || n._rowIndex}
                    onClick={() => openDetail(n)}
                    className="border-b border-gray-50 hover:bg-green-50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(n.fecha_registro)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{n.grupo}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[110px] truncate">{tutorPorGrupo[n.grupo] || '—'}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[160px] truncate">{n.nombre_participante || n.rut_participante}</td>
                    <td className="px-3 py-2 text-xs text-center text-gray-500">{n.semana}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[180px] truncate">{n.tipo_novedad}</td>
                    <td className="px-3 py-2">
                      <Badge nivel={ALERTA_MAP[n.estado_caso] || 'OK'} />
                      <span className="ml-1.5 text-xs text-gray-500">{n.estado_caso}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{n.requiere_seguimiento || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={closeDetail}
        title="Detalle de novedad"
        size="lg"
        footer={
          canEditEstado ? (
            <>
              <button onClick={closeDetail} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
                Cerrar
              </button>
              <button
                onClick={handleGuardarEstado}
                disabled={saving || editEstado === selected?.estado_caso}
                className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40"
                style={{ background: 'var(--color-verde)' }}
              >
                {saving ? 'Guardando…' : 'Guardar estado'}
              </button>
            </>
          ) : (
            <button onClick={closeDetail} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
              Cerrar
            </button>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-5">
            {/* Header info */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Participante">
                <button
                  onClick={() => { closeDetail(); navigate(`/coord/participant/${selected.rut_participante}`); }}
                  className="text-left font-medium text-[var(--color-verde)] hover:underline"
                >
                  {selected.nombre_participante || selected.rut_participante}
                </button>
              </Field>
              <Field label="Grupo">
                <span className="font-mono">{selected.grupo}</span>
                <span className="text-gray-500 text-xs block">{tutorPorGrupo[selected.grupo] || ''}</span>
              </Field>
              <Field label="Semana / Sesión">
                Sem. {selected.semana} · {selected.tipo_sesion || '—'}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de novedad">{selected.tipo_novedad || '—'}</Field>
              <Field label="Hora evento">{selected.hora_evento || '—'}</Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Estado — editable for COORD/ADMIN */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Estado del caso</p>
                {canEditEstado ? (
                  <select
                    value={editEstado}
                    onChange={e => setEditEstado(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]"
                  >
                    {ESTADOS_CASO.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge nivel={ALERTA_MAP[selected.estado_caso] || 'OK'} />
                    <span className="text-sm text-gray-700">{selected.estado_caso}</span>
                  </div>
                )}
              </div>
              <Field label="Requiere seguimiento">{selected.requiere_seguimiento || '—'}</Field>
            </div>

            {/* Observación */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observación</p>
              {selected.observacion ? (
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap leading-relaxed">
                  {selected.observacion}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">Sin observación registrada.</p>
              )}
            </div>

            {/* Metadata */}
            <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3 text-xs text-gray-400">
              <div>
                <span className="font-medium">Registrado por:</span> {selected.registrado_por || '—'}
                <br />
                <span className="font-medium">Fecha registro:</span> {formatDateTime(selected.fecha_registro)}
              </div>
              {selected.editado_por && (
                <div>
                  <span className="font-medium">Editado por:</span> {selected.editado_por}
                  <br />
                  <span className="font-medium">Fecha edición:</span> {formatDateTime(selected.fecha_edicion)}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}
