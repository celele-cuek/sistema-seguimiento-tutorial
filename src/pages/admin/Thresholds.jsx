import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { readSheet, updateRow, writeRow } from '../../lib/sheetsApi.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Save, CheckCircle, HelpCircle, AlertTriangle } from 'lucide-react';

const thresholds = [
  {
    key: 'umbral_critico',
    label: 'Umbral crítico (%)',
    desc: 'Asistencia bajo este % activa alerta CRÍTICO',
    tip: 'Si la asistencia acumulada cae bajo este valor, el participante queda en CRÍTICO (rojo). El coordinador y tutor ven la alerta inmediatamente. Requiere contacto urgente. Recomendado: 70.',
    info: 'Asistencia acumulada menor que este % → participante en CRÍTICO (rojo). Requiere contacto urgente.',
  },
  {
    key: 'umbral_alerta',
    label: 'Umbral alerta (%)',
    desc: 'Asistencia bajo este % activa alerta ALERTA',
    tip: 'Si la asistencia cae entre este valor y el umbral crítico, el participante queda en ALERTA (naranja). Es la señal para una intervención preventiva antes de que empeore. Debe ser mayor que el umbral crítico. Recomendado: 75.',
    info: 'Asistencia entre el umbral crítico y este % → participante en ALERTA (naranja). Señal de intervención preventiva.',
  },
  {
    key: 'umbral_justificaciones',
    label: 'Máx. justificaciones',
    desc: 'N° de J que activa alerta de justificaciones',
    tip: 'Cuántas ausencias justificadas (código J) puede tener un participante antes de que se active una alerta específica de justificaciones.',
    info: 'Si el participante acumula este número de ausencias justificadas (J), el sistema activa una alerta específica aunque su % sea aceptable.',
  },
  {
    key: 'umbral_retiros',
    label: 'Máx. retiros',
    desc: 'N° de R que activa alerta de retiros',
    tip: 'Cuántos retiros anticipados (código R) activan una alerta. Un participante que se retira sistemáticamente puede estar en riesgo de abandono aunque su porcentaje no sea crítico todavía.',
    info: 'Si el participante acumula este número de retiros anticipados (R), el sistema activa alerta de riesgo de abandono.',
  },
  {
    key: 'umbral_dias_moodle',
    label: 'Días sin Moodle',
    desc: 'Días sin acceso a Moodle para activar alerta',
    tip: 'Si el cargado de datos Moodle indica que el participante lleva X o más días sin acceder a la plataforma, se activa una alerta de actividad.',
    info: 'Participante sin acceso a Moodle por este número de días → alerta de desconexión de plataforma.',
  },
  {
    key: 'umbral_logro',
    label: 'Umbral logro (%)',
    desc: 'Puntaje bajo este % cuenta como bajo umbral',
    tip: 'En evaluaciones, si el puntaje del participante está bajo este porcentaje, la evaluación se marca como "bajo umbral".',
    info: 'Evaluación con puntaje menor que este % se considera "bajo umbral" y se acumula para la alerta de logro.',
  },
  {
    key: 'umbral_evaluaciones_logro',
    label: 'Evaluaciones bajo umbral',
    desc: 'Cuántas evaluaciones bajo umbral activan alerta',
    tip: 'Número de evaluaciones con puntaje bajo el umbral de logro necesarias para activar una alerta de logro.',
    info: 'Al acumular este número de evaluaciones bajo el umbral de logro, se activa alerta de rendimiento académico.',
  },
  {
    key: 'descuento_retiro_primera_hora',
    label: 'Retiro ≥ 1h del inicio (%)',
    desc: 'Porcentaje de asistencia si el retiro fue ≥1h después del inicio',
    tip: 'Si un participante (código R) se retiró una hora o más después del inicio, se le asigna este porcentaje de asistencia en la sesión.',
    info: 'Retiro ocurrido ≥1h después del inicio → se cuenta este % de asistencia para esa sesión.',
  },
  {
    key: 'descuento_tardanza',
    label: 'Retiro < 1h del inicio (%)',
    desc: 'Porcentaje de asistencia si el retiro fue <1h después del inicio',
    tip: 'Si el retiro ocurrió dentro de la primera hora desde el inicio de la sesión, se asigna este porcentaje. Generalmente 0.',
    info: 'Retiro ocurrido dentro de la primera hora → se cuenta este % de asistencia (generalmente 0).',
  },
];

export default function Thresholds() {
  const { auth, hasRole } = useAuth();
  const { config, updateConfig } = useConfig();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showConfirm1, setShowConfirm1] = useState(false);
  const [showConfirm2, setShowConfirm2] = useState(false);

  const isAdmin = hasRole('ADMIN');
  const isCoord = hasRole('COORD') && !isAdmin;
  const isAsistente = hasRole('ASISTENTE') && !isAdmin && !isCoord;

  useEffect(() => { if (config) setForm({ ...config }); }, [config]);

  async function doSave() {
    setSaving(true);
    try {
      const rows = await readSheet('CONFIGURACION');
      const toSave = { ...form, setup_completo: form.setup_completo ? 'TRUE' : 'FALSE' };
      if (rows.length) await updateRow('CONFIGURACION', rows[0]._rowIndex, toSave);
      else await writeRow('CONFIGURACION', toSave);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: isCoord ? 'COORD' : 'ADMIN', accion: 'EDITAR_CONFIG', entidad: 'CONFIGURACION', grupo: '', semana: '', detalle: 'Umbrales actualizados', ip: '' });
      updateConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  function handleSaveClick() {
    if (isCoord) {
      setShowConfirm1(true);
    } else {
      doSave();
    }
  }

  // ASISTENTE: read-only view
  if (isAsistente) {
    return (
      <div className="flex-1 flex flex-col">
        <Topbar title="Umbrales de alerta" />
        <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto max-w-2xl">
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-blue-700">
            <HelpCircle size={13} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">¿Para qué sirve esto?</p>
              <p>Estos son los criterios que el sistema usa para marcar a los participantes en <strong>ALERTA</strong> o <strong>CRÍTICO</strong>. Cuando ves a un participante con esas etiquetas, es porque superó alguno de estos umbrales — eso es lo que te indica que debes contactarlos.</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {thresholds.map(t => (
              <div key={t.key} className="flex items-center justify-between px-5 py-3.5 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.info}</p>
                </div>
                <span className="text-lg font-bold shrink-0" style={{ color: 'var(--color-verde)' }}>
                  {config?.[t.key] ?? '—'}
                  {t.key.includes('umbral_critico') || t.key.includes('umbral_alerta') || t.key.includes('logro') || t.key.includes('descuento') ? '%' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // COORD / ADMIN: edit view
  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Umbrales de alerta" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto max-w-2xl">

        {isCoord && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-amber-800">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Estás modificando los umbrales del sistema</p>
              <p>Los cambios que hagas aquí afectarán inmediatamente a todos los participantes del programa. El sistema recalculará las alertas con los nuevos valores al guardar la próxima asistencia.</p>
            </div>
          </div>
        )}

        {!isCoord && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-blue-700">
            <HelpCircle size={13} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">¿Cómo funcionan los umbrales?</p>
              <p>El sistema evalúa automáticamente a cada participante al guardar asistencia. Según los valores configurados aquí, asigna un nivel de alerta: <strong>OK</strong> (verde), <strong>ALERTA</strong> (naranja) o <strong>CRÍTICO</strong> (rojo).</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-800">Parámetros de alerta</h2>
          <div className="flex flex-col gap-4">
            {thresholds.map(t => (
              <div key={t.key} className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-sm font-medium text-gray-700">{t.label}</label>
                    <Tooltip content={t.tip}>
                      <HelpCircle size={12} className="text-gray-300 cursor-help" />
                    </Tooltip>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                </div>
                <input type="number" value={form[t.key] ?? ''} onChange={e => setForm(f => ({ ...f, [t.key]: Number(e.target.value) }))}
                  className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={handleSaveClick} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40"
              style={{ background: 'var(--color-verde)' }}>
              <Save size={16} />{saving ? 'Guardando…' : 'Guardar umbrales'}
            </button>
            {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle size={14} />Guardado</span>}
          </div>
        </div>
      </div>

      {/* Confirmación 1 — COORD */}
      <Modal open={showConfirm1} onClose={() => setShowConfirm1(false)} title="Confirmar cambio de umbrales" size="sm"
        footer={
          <>
            <button onClick={() => setShowConfirm1(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600">Cancelar</button>
            <button onClick={() => { setShowConfirm1(false); setShowConfirm2(true); }}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium"
              style={{ background: 'var(--color-verde)' }}>Sí, continuar</button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 text-sm">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <p>Estás a punto de modificar los criterios de alerta del sistema. Esto <strong>afectará a todos los participantes</strong> inmediatamente.</p>
          </div>
          <p className="text-sm text-gray-600">¿Quieres continuar con los nuevos valores?</p>
        </div>
      </Modal>

      {/* Confirmación 2 — COORD */}
      <Modal open={showConfirm2} onClose={() => setShowConfirm2(false)} title="Confirmación final" size="sm"
        footer={
          <>
            <button onClick={() => setShowConfirm2(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600">Cancelar</button>
            <button onClick={() => { setShowConfirm2(false); doSave(); }}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium bg-red-600 hover:bg-red-700">
              Guardar definitivamente</button>
          </>
        }
      >
        <p className="text-sm text-gray-700">Los umbrales actuales serán reemplazados con los nuevos valores. Esta acción queda registrada en el log del sistema.</p>
        <p className="text-sm font-semibold text-gray-800 mt-3">¿Confirmas los cambios?</p>
      </Modal>
    </div>
  );
}
