import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import AttendanceRow from '../../components/attendance/AttendanceRow.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { readSheet, batchWrite, batchUpdateRows, writeRow, updateRow } from '../../lib/sheetsApi.js';
import { calcPctSesion, generateId, nowISO, pctDisplay } from '../../lib/utils.js';
import { calcResumenParticipante, nivelMax } from '../../lib/alertEngine.js';
import { CheckCircle, Save, ChevronRight, Users, ClipboardCheck, HelpCircle } from 'lucide-react';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { useNavigate } from 'react-router-dom';

const STEPS = ['Seleccionar sesión', 'Registrar asistencia', 'Confirmar y guardar'];

export default function AttendanceEntry() {
  const { auth } = useAuth();
  const { config } = useConfig();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [semana, setSemana] = useState('');
  const [tipoSesion, setTipoSesion] = useState('TP');
  const [grupo, setGrupo] = useState(auth?.grupos?.[0] || '');
  const [participants, setParticipants] = useState([]);
  const [estados, setEstados] = useState({});
  const [observaciones, setObservaciones] = useState({});
  const [novedadesMap, setNovedadesMap] = useState({});
  const [fechaSesion, setFechaSesion] = useState(nowISO().split('T')[0]);
  const [existingRows, setExistingRows] = useState({}); // rut → _rowIndex of existing ASISTENCIA record
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const grupos = auth?.grupos || [];
  const totalSemanas = config?.total_semanas || 12;
  const semanas = Array.from({ length: totalSemanas }, (_, i) => i + 1);

  useEffect(() => {
    const draft = sessionStorage.getItem('attendance_draft');
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.estados) setEstados(d.estados);
        if (d.observaciones) setObservaciones(d.observaciones);
        if (d.semana) setSemana(d.semana);
        if (d.grupo) setGrupo(d.grupo);
        if (d.tipoSesion) setTipoSesion(d.tipoSesion);
        if (d.fechaSesion) setFechaSesion(d.fechaSesion);
      } catch {}
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('attendance_draft', JSON.stringify({ estados, observaciones, semana, grupo, tipoSesion, fechaSesion }));
  }, [estados, observaciones, semana, grupo, tipoSesion]);

  async function loadParticipants() {
    if (!grupo || !semana) return;
    setLoading(true);
    setError('');
    try {
      const [allP, novedades] = await Promise.all([
        readSheet('PARTICIPANTES'),
        readSheet('NOVEDADES'),
      ]);
      const mis = allP.filter(p => p.grupo === grupo && p.estado !== 'Inactivo')
        .sort((a, b) => (a.microgrupo || '').localeCompare(b.microgrupo || '') || a.nombre_completo.localeCompare(b.nombre_completo));
      setParticipants(mis);

      const novMap = {};
      for (const p of mis) {
        const pNov = novedades.filter(n => n.rut_participante === p.rut)
          .sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));
        novMap[p.rut] = pNov;
      }
      setNovedadesMap(novMap);

      // Load existing attendance for this session to pre-fill
      const asist = await readSheet('ASISTENCIA');
      const existing = asist.filter(a => a.grupo === grupo && String(a.semana) === String(semana) && a.tipo_sesion === tipoSesion);
      if (existing.length > 0) {
        const map = {};
        const rowMap = {};
        for (const e of existing) {
          // Keep only the latest record per participant (in case of existing duplicates)
          if (!rowMap[e.rut_participante] || e._rowIndex > rowMap[e.rut_participante]) {
            map[e.rut_participante] = { estado: e.estado, hora_evento: e.hora_evento, pct_sesion: Number(e.pct_sesion) };
            rowMap[e.rut_participante] = e._rowIndex;
          }
        }
        setEstados(map);
        setExistingRows(rowMap);
      } else {
        setExistingRows({});
      }
    } catch (err) {
      setError('Error cargando participantes: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEstadoChange(rut, update) {
    setEstados(prev => ({ ...prev, [rut]: { ...(prev[rut] || {}), ...update } }));
  }

  function handleObservacionChange(rut, obs) {
    setObservaciones(prev => ({ ...prev, [rut]: obs }));
  }

  function marcarTodosA() {
    const newMap = {};
    for (const p of participants) {
      newMap[p.rut] = { estado: 'A', pct_sesion: 100, hora_evento: '' };
    }
    setEstados(newMap);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const now = nowISO();
      const toUpdate = [];
      const toInsert = [];
      for (const p of participants) {
        const e = estados[p.rut] || {};
        if (!e.estado) continue;
        const row = {
          id: generateId(),
          rut_participante: p.rut,
          grupo,
          semana: String(semana),
          tipo_sesion: tipoSesion,
          fecha_sesion: fechaSesion,
          estado: e.estado,
          hora_evento: e.hora_evento || '',
          pct_sesion: String(e.pct_sesion ?? ''),
          registrado_por: auth.email,
          fecha_registro: now,
          editado: 'FALSE',
          fecha_edicion: '',
          editado_por: '',
        };
        if (existingRows[p.rut]) {
          toUpdate.push({ rowIndex: existingRows[p.rut], rowData: { ...row, editado: 'TRUE', fecha_edicion: now, editado_por: auth.email } });
        } else {
          toInsert.push(row);
        }
      }

      if (toUpdate.length) await batchUpdateRows('ASISTENCIA', toUpdate);
      if (toInsert.length) await batchWrite('ASISTENCIA', toInsert);
      const registros = [...toUpdate.map(u => u.rowData), ...toInsert];

      // Handle novedades for participants with observations
      const novRows = [];
      for (const p of participants) {
        const obs = observaciones[p.rut];
        if (obs && obs.trim()) {
          novRows.push({
            id: generateId(),
            fecha_registro: now,
            semana: String(semana),
            tipo_sesion: tipoSesion,
            grupo,
            rut_participante: p.rut,
            nombre_participante: p.nombre_completo,
            tipo_novedad: estados[p.rut]?.estado === 'R' ? 'Retiro en primera hora' : estados[p.rut]?.estado === 'J' ? 'Ausencia justificada (con documento)' : 'Contacto realizado por tutor/a',
            hora_evento: estados[p.rut]?.hora_evento || '',
            estado_caso: 'Pendiente',
            requiere_seguimiento: 'No',
            observacion: obs.trim(),
            registrado_por: auth.email,
            fecha_edicion: '',
            editado_por: '',
          });
        }
      }
      if (novRows.length) await batchWrite('NOVEDADES', novRows);

      // Update RESUMEN_PARTICIPANTE
      await updateResumenes();

      // Log
      await writeRow('LOG', {
        id: generateId(), datetime: now, usuario: auth.email, rol_activo: 'TUTOR',
        accion: 'GUARDAR_ASISTENCIA', entidad: 'ASISTENCIA', grupo, semana: String(semana),
        detalle: `${registros.length} registros guardados`, ip: '',
      });

      sessionStorage.removeItem('attendance_draft');
      setExistingRows({});
      setSaved(true);
      setStep(2);
    } catch (err) {
      setError('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateResumenes() {
    const asist = await readSheet('ASISTENCIA');
    const resumen = await readSheet('RESUMEN_PARTICIPANTE');
    const now = nowISO();

    for (const p of participants) {
      const registros = asist.filter(r => r.rut_participante === p.rut);
      const calc = calcResumenParticipante(registros, config || {});
      const existing = resumen.find(r => r.rut === p.rut);
      const row = {
        rut: p.rut, grupo,
        pct_asistencia: calc.pct_asistencia ?? '',
        sesiones_cursadas: calc.sesiones_cursadas,
        sesiones_asistidas: calc.sesiones_asistidas,
        contador_j: calc.contador_j,
        contador_r: calc.contador_r,
        contador_f: calc.contador_f,
        alerta_asistencia: calc.alerta_asistencia,
        alerta_justificaciones: calc.alerta_justificaciones ? 'ALERTA' : 'OK',
        alerta_retiros: calc.alerta_retiros ? 'ALERTA' : 'OK',
        alerta_logro: 'OK',
        alerta_moodle: 'OK',
        alerta_max: calc.alerta_max,
        ultima_sesion_registrada: calc.ultima_sesion_registrada,
        fecha_ultimo_registro: now.split('T')[0],
        logro_promedio: '',
        evaluaciones_bajo_umbral: 0,
      };
      if (existing) {
        await updateRow('RESUMEN_PARTICIPANTE', existing._rowIndex, row);
      } else {
        await writeRow('RESUMEN_PARTICIPANTE', row);
      }
    }
  }

  const registrados = Object.values(estados).filter(e => e.estado).length;
  const pctGrupo = registrados
    ? Object.values(estados).reduce((s, e) => s + (Number(e.pct_sesion) || 0), 0) / (participants.length || 1)
    : null;

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Ingreso de asistencia" />
      <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? 'bg-[var(--color-verde)] text-white'
                : i === step ? 'bg-[var(--color-verde)] text-white ring-4 ring-[var(--color-verde)]/20'
                : 'bg-gray-200 text-gray-400'
              }`}>{i < step ? <CheckCircle size={14} /> : i + 1}</div>
              <span className={`text-sm hidden sm:block ${i === step ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 0: Select session */}
        {step === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-5 max-w-lg">
            <h2 className="font-semibold text-gray-800">Seleccionar sesión</h2>
            <div className="flex flex-col gap-4">
              {grupos.length > 1 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Grupo</label>
                  <select value={grupo} onChange={e => setGrupo(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-verde)]">
                    {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  Semana
                  <Tooltip content="Número de semana del curso en que se realizó esta sesión. Cada semana puede tener una TP y/o una SE.">
                    <HelpCircle size={12} className="text-gray-400 cursor-help" />
                  </Tooltip>
                </label>
                <select value={semana} onChange={e => setSemana(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-verde)]">
                  <option value="">Seleccionar…</option>
                  {semanas.map(s => <option key={s} value={s}>Semana {s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  Fecha de realización
                  <Tooltip content="Fecha en que se realizó la sesión. Por defecto es hoy — ajusta si estás registrando una sesión pasada.">
                    <HelpCircle size={12} className="text-gray-400 cursor-help" />
                  </Tooltip>
                </label>
                <input
                  type="date"
                  value={fechaSesion}
                  max={nowISO().split('T')[0]}
                  onChange={e => setFechaSesion(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-verde)]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  Tipo de sesión
                  <Tooltip content="TP = Tutoría Pedagógica (sesión sincrónica del grupo con el/la tutor/a). SE = Sesión con Experto (charla magistral para todos los grupos).">
                    <HelpCircle size={12} className="text-gray-400 cursor-help" />
                  </Tooltip>
                </label>
                <div className="flex gap-3">
                  {['TP', 'SE'].map(t => (
                    <button key={t} onClick={() => setTipoSesion(t)}
                      className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${tipoSesion === t ? 'border-[var(--color-verde)] bg-[var(--color-verde)] text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                      {t === 'TP' ? '🎓 Tutoría pedagógica' : '👨‍🏫 Sesión con experto'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              disabled={!semana || !grupo}
              onClick={async () => { await loadParticipants(); setStep(1); }}
              className="px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ background: 'var(--color-verde)' }}
            >
              <Users size={16} /> Cargar participantes
            </button>
          </div>
        )}

        {/* Step 1: Register attendance */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-gray-700">Grupo {grupo} · Semana {semana} · {tipoSesion} · {fechaSesion}</div>
                <span className="text-xs text-gray-400">{participants.length} participantes</span>
              </div>
              <div className="flex items-center gap-3">
                {pctGrupo !== null && (
                  <div className="text-sm font-semibold text-gray-600">
                    Promedio sesión: <span className="text-[var(--color-verde)]">{Math.round(pctGrupo)}%</span>
                  </div>
                )}
                <button onClick={marcarTodosA}
                  className="text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 font-medium transition-colors">
                  Marcar todos A
                </button>
                <button onClick={() => setStep(0)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                  Volver
                </button>
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--color-oscuro)', color: '#9ABFB8' }}>
                      <th className="px-3 py-2 text-left text-xs w-12">MG</th>
                      <th className="px-3 py-2 text-left text-xs">Participante</th>
                      <th className="px-3 py-2 text-left text-xs">Estado</th>
                      <th className="px-3 py-2 text-left text-xs w-32">Hora</th>
                      <th className="px-3 py-2 text-left text-xs w-40">Observación</th>
                      <th className="px-3 py-2 text-right text-xs w-28">% / Alerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map(p => (
                      <AttendanceRow
                        key={p.rut}
                        participant={p}
                        estado={estados[p.rut]}
                        observacion={observaciones[p.rut] || ''}
                        onEstadoChange={handleEstadoChange}
                        onObservacionChange={handleObservacionChange}
                        config={config}
                        novedades={novedadesMap[p.rut] || []}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || registrados === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--color-verde)' }}
              >
                <Save size={16} />
                {saving ? 'Guardando…' : `Guardar asistencia (${registrados} de ${participants.length})`}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Saved */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm p-10 flex flex-col items-center gap-4 max-w-md mx-auto">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
              <ClipboardCheck size={32} className="text-green-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Asistencia guardada</h2>
            <p className="text-sm text-gray-500 text-center">
              Semana {semana} · Grupo {grupo} · {tipoSesion} — {registrados} registros guardados correctamente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setStep(0); setEstados({}); setObservaciones({}); setSaved(false); }}
                className="px-5 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Nueva sesión
              </button>
              <button onClick={() => navigate('/tutor/grid')}
                className="px-5 py-2 rounded-xl text-white text-sm font-medium"
                style={{ background: 'var(--color-verde)' }}>
                Ver grilla histórica
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
