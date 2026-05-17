import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar.jsx';
import AttendanceGrid from '../../components/attendance/AttendanceGrid.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { pctDisplay, formatDate } from '../../lib/utils.js';
import { ArrowLeft, User, MapPin, Briefcase } from 'lucide-react';

export default function ParticipantProfile() {
  const { rut } = useParams();
  const navigate = useNavigate();
  const [participant, setParticipant] = useState(null);
  const [asistencia, setAsistencia] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [novedades, setNovedades] = useState([]);
  const [moodle, setMoodle] = useState([]);
  const [loading, setLoading] = useState(true);

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
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Historial de novedades ({novedades.length})</h2>
          {novedades.length === 0 ? <p className="text-sm text-gray-400">Sin novedades registradas.</p> : (
            <div className="flex flex-col gap-2">
              {novedades.map(n => (
                <div key={n.id} className="border-l-4 border-gray-200 pl-3 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatDate(n.fecha_registro)}</span>
                    <Badge nivel={n.estado_caso === 'Resuelto' ? 'OK' : n.estado_caso === 'Pendiente' ? 'ALERTA' : 'CRÍTICO'} />
                    <span className="text-xs font-medium text-gray-600">{n.tipo_novedad}</span>
                  </div>
                  {n.observacion && <p className="text-xs text-gray-500 mt-0.5">{n.observacion}</p>}
                </div>
              ))}
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
    </div>
  );
}
