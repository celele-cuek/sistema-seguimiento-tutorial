import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import AttendanceGrid from '../../components/attendance/AttendanceGrid.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { readSheet, updateRow, writeRow } from '../../lib/sheetsApi.js';
import { pctDisplay, formatDate, formatDateTime, nowISO, generateId } from '../../lib/utils.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { ArrowLeft, User, MapPin, Briefcase } from 'lucide-react';

const ESTADOS_CASO = ['Pendiente', 'En seguimiento', 'Resuelto', 'Derivado a coord.', 'Baja definitiva'];
const ALERTA_MAP_NOV = { 'Pendiente': 'ALERTA', 'En seguimiento': 'ALERTA', 'Resuelto': 'OK', 'Derivado a coord.': 'CRÍTICO', 'Baja definitiva': 'CRÍTICO' };

export default function ParticipantProfile() {
  const { rut } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [participant, setParticipant] = useState(null);
  const [asistencia, setAsistencia] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [novedades, setNovedades] = useState([]);
  const [moodle, setMoodle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNov, setSelectedNov] = useState(null);
  const [editEstado, setEditEstado] = useState('');
  const [savingNov, setSavingNov] = useState(false);

  const canEditEstado = auth?.roles?.includes('COORD') || auth?.roles?.includes('ADMIN');

  useEffect(() => { load(); }, [rut]);

  async function load() {
    setLoading(true);
    try {
      const [parts, asist, res, nov, mood] = await Promise.all([
        readSheet('PARTICIPANTES'),
        readSheet('ASISTENCIA'),
        readSheet('RESUMEN_PARTICIPANTE'),
        readSheet('NOVEDADES'),
        readSheet('MOODLE_SEMANAL'),
      ]);
      setParticipant(parts.find(p => p.rut === rut) || null);
      setAsistencia(asist.filter(a => a.rut_participante === rut));
      setResumen(res.find(r => r.rut === rut) || null);
      setNovedades(nov.filter(n => n.rut_participante === rut).sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro)));
      setMoodle(mood.filter(m => m.rut_participante === rut).sort((a, b) => b.semana - a.semana));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function openNov(n) { setSelectedNov(n); setEditEstado(n.estado_caso || 'Pendiente'); }
  function closeNov() { setSelectedNov(null); setEditEstado(''); }

  async function handleGuardarEstado() {
    if (!selectedNov || editEstado === selectedNov.estado_caso) { closeNov(); return; }
    setSavingNov(true);
    try {
      const now = nowISO();
      const updated = { ...selectedNov, estado_caso: editEstado, fecha_edicion: now, editado_por: auth.email };
      await updateRow('NOVEDADES', selectedNov._rowIndex, updated);
      await writeRow('LOG', {
        id: generateId(), datetime: now, usuario: auth.email, rol_activo: 'COORD',
        accion: 'EDITAR_NOVEDAD', entidad: 'NOVEDADES', grupo: selectedNov.grupo,
        semana: selectedNov.semana, detalle: `estado: ${selectedNov.estado_caso} → ${editEstado}`, ip: '',
      });
      setNovedades(prev => prev.map(n => n._rowIndex === selectedNov._rowIndex ? updated : n));
      setSelectedNov(updated);
      setEditEstado(updated.estado_caso);
    } catch (err) { console.error(err); }
    finally { setSavingNov(false); }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div>;
  if (!participant) return <div className="flex-1 flex items-center justify-center text-gray-400">Participante no encontrado</div>;

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title={participant.nombre_completo}
        actions={<button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft size={14} />Volver</button>}
      />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">

        {/* Header card */}
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col sm:flex-row gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ background: 'var(--color-verde)' }}>
            {participant.nombres?.[0]}{participant.primer_apellido?.[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-lg font-bold text-gray-800">{participant.nombre_completo}</h1>
              <Badge nivel={resumen?.alerta_max || 'OK'} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Briefcase size={13} />{participant.funcion_principal}</span>
              <span className="flex items-center gap-1"><MapPin size={13} />{participant.establecimiento} · {participant.region}</span>
              <span className="flex items-center gap-1"><User size={13} />Grupo {participant.grupo} · {participant.microgrupo}</span>
            </div>
          </div>
          <div className="flex gap-4 sm:flex-col text-center">
            <div><div className="text-2xl font-bold text-[var(--color-verde)]">{pctDisplay(Number(resumen?.pct_asistencia))}</div><div className="text-xs text-gray-400">Asistencia</div></div>
            <div><div className="text-2xl font-bold text-gray-700">{resumen?.sesiones_cursadas || 0}</div><div className="text-xs text-gray-400">Sesiones</div></div>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Historial de asistencia</h2>
          <AttendanceGrid participants={[participant]} asistencia={asistencia} resumen={resumen ? [resumen] : []} totalSemanas={12} semanaActual={12} />
        </div>

        {/* Novedades */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Novedades ({novedades.length})</h2>
          {novedades.length === 0 ? (
            <p className="text-sm text-gray-400">Sin novedades registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sem.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo de novedad</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Req. seguim.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {novedades.map(n => (
                    <tr
                      key={n.id || n._rowIndex}
                      onClick={() => openNov(n)}
                      className="border-b border-gray-50 hover:bg-green-50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(n.fecha_registro)}</td>
                      <td className="px-3 py-2 text-xs text-center text-gray-500">{n.semana}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 max-w-[160px] truncate">{n.tipo_novedad}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge nivel={ALERTA_MAP_NOV[n.estado_caso] || 'OK'} />
                        <span className="ml-1.5 text-xs text-gray-500">{n.estado_caso}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{n.requiere_seguimiento || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-400 max-w-[200px] truncate">{n.observacion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Moodle */}
        {moodle.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Actividad Moodle</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ background: 'var(--color-oscuro)', color: '#9ABFB8' }}>
                  <tr>
                    <th className="px-3 py-2 text-left">Semana</th>
                    <th className="px-3 py-2 text-left">Último acceso</th>
                    <th className="px-3 py-2 text-center">Foro</th>
                    <th className="px-3 py-2 text-center">Entrega</th>
                    <th className="px-3 py-2 text-center">Blog</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {moodle.map((m, i) => (
                    <tr key={m.id || i} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="px-3 py-1.5">S{m.semana}</td>
                      <td className="px-3 py-1.5">{formatDate(m.ultimo_acceso)}</td>
                      <td className="px-3 py-1.5 text-center">{m.participo_foro === 'TRUE' ? '✓' : '✗'}</td>
                      <td className="px-3 py-1.5 text-center">{m.entrego_producto === 'TRUE' ? '✓' : '✗'}</td>
                      <td className="px-3 py-1.5 text-center">{m.blog_actualizado === 'TRUE' ? '✓' : '✗'}</td>
                      <td className="px-3 py-1.5">{m.estado_moodle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Novedad detail modal */}
      <Modal
        open={!!selectedNov}
        onClose={closeNov}
        title="Detalle de novedad"
        size="lg"
        footer={
          canEditEstado ? (
            <>
              <button onClick={closeNov} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cerrar</button>
              <button
                onClick={handleGuardarEstado}
                disabled={savingNov || editEstado === selectedNov?.estado_caso}
                className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40"
                style={{ background: 'var(--color-verde)' }}
              >
                {savingNov ? 'Guardando…' : 'Guardar estado'}
              </button>
            </>
          ) : (
            <button onClick={closeNov} className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">Cerrar</button>
          )
        }
      >
        {selectedNov && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              <NovField label="Tipo de novedad">{selectedNov.tipo_novedad || '—'}</NovField>
              <NovField label="Semana / Sesión">Sem. {selectedNov.semana} · {selectedNov.tipo_sesion || '—'}</NovField>
              <NovField label="Hora evento">{selectedNov.hora_evento || '—'}</NovField>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                    <Badge nivel={ALERTA_MAP_NOV[selectedNov.estado_caso] || 'OK'} />
                    <span className="text-sm text-gray-700">{selectedNov.estado_caso}</span>
                  </div>
                )}
              </div>
              <NovField label="Requiere seguimiento">{selectedNov.requiere_seguimiento || '—'}</NovField>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observación</p>
              {selectedNov.observacion ? (
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap leading-relaxed">{selectedNov.observacion}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Sin observación registrada.</p>
              )}
            </div>
            <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3 text-xs text-gray-400">
              <div>
                <span className="font-medium">Registrado por:</span> {selectedNov.registrado_por || '—'}<br />
                <span className="font-medium">Fecha:</span> {formatDateTime(selectedNov.fecha_registro)}
              </div>
              {selectedNov.editado_por && (
                <div>
                  <span className="font-medium">Editado por:</span> {selectedNov.editado_por}<br />
                  <span className="font-medium">Fecha edición:</span> {formatDateTime(selectedNov.fecha_edicion)}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function NovField({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}
