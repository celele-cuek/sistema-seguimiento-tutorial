import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { readSheet, updateRow, writeRow } from '../../lib/sheetsApi.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Save, CheckCircle, HelpCircle } from 'lucide-react';

export default function Thresholds() {
  const { auth } = useAuth();
  const { config, updateConfig } = useConfig();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (config) setForm({ ...config }); }, [config]);

  async function handleSave() {
    setSaving(true);
    try {
      const rows = await readSheet('CONFIGURACION');
      const toSave = { ...form, setup_completo: form.setup_completo ? 'TRUE' : 'FALSE' };
      if (rows.length) await updateRow('CONFIGURACION', rows[0]._rowIndex, toSave);
      else await writeRow('CONFIGURACION', toSave);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'EDITAR_CONFIG', entidad: 'CONFIGURACION', grupo: '', semana: '', detalle: 'Umbrales actualizados', ip: '' });
      updateConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  const thresholds = [
    {
      key: 'umbral_critico',
      label: 'Umbral crítico (%)',
      desc: 'Asistencia bajo este % activa alerta CRÍTICO',
      tip: 'Si la asistencia acumulada cae bajo este valor, el participante queda en CRÍTICO (rojo). El coordinador y tutor ven la alerta inmediatamente. Requiere contacto urgente. Recomendado: 70.',
    },
    {
      key: 'umbral_alerta',
      label: 'Umbral alerta (%)',
      desc: 'Asistencia bajo este % activa alerta ALERTA',
      tip: 'Si la asistencia cae entre este valor y el umbral crítico, el participante queda en ALERTA (naranja). Es la señal para una intervención preventiva antes de que empeore. Debe ser mayor que el umbral crítico. Recomendado: 75.',
    },
    {
      key: 'umbral_justificaciones',
      label: 'Máx. justificaciones',
      desc: 'N° de J que activa alerta de justificaciones',
      tip: 'Cuántas ausencias justificadas (código J) puede tener un participante antes de que se active una alerta específica de justificaciones. Las J no descuentan asistencia, pero su acumulación puede indicar fragilidad en la participación.',
    },
    {
      key: 'umbral_retiros',
      label: 'Máx. retiros',
      desc: 'N° de R que activa alerta de retiros',
      tip: 'Cuántos retiros anticipados (código R) activan una alerta. Un participante que se retira sistemáticamente puede estar en riesgo de abandono aunque su porcentaje no sea crítico todavía.',
    },
    {
      key: 'umbral_dias_moodle',
      label: 'Días sin Moodle',
      desc: 'Días sin acceso a Moodle para activar alerta',
      tip: 'Si el cargado de datos Moodle indica que el participante lleva X o más días sin acceder a la plataforma, se activa una alerta de actividad. Útil para detectar desconexión silenciosa.',
    },
    {
      key: 'umbral_logro',
      label: 'Umbral logro (%)',
      desc: 'Puntaje bajo este % cuenta como bajo umbral',
      tip: 'En evaluaciones, si el puntaje del participante está bajo este porcentaje, la evaluación se marca como "bajo umbral". Cuando se acumulan N evaluaciones bajo umbral (ver campo siguiente), se activa alerta de logro.',
    },
    {
      key: 'umbral_evaluaciones_logro',
      label: 'Evaluaciones bajo umbral',
      desc: 'Cuántas evaluaciones bajo umbral activan alerta',
      tip: 'Número de evaluaciones con puntaje bajo el umbral de logro necesarias para activar una alerta de logro. Evita que una sola evaluación baja dispare alertas innecesarias.',
    },
    {
      key: 'descuento_retiro_primera_hora',
      label: 'Retiro ≥ 1h del inicio (%)',
      desc: 'Porcentaje de asistencia si el retiro fue ≥1h después del inicio',
      tip: 'Si un participante (código R) se retiró una hora o más después del inicio, se le asigna este porcentaje de asistencia en la sesión. El tiempo se calcula contra la hora de inicio configurada. Recomendado: 50.',
    },
    {
      key: 'descuento_tardanza',
      label: 'Retiro < 1h del inicio (%)',
      desc: 'Porcentaje de asistencia si el retiro fue <1h después del inicio',
      tip: 'Si el retiro ocurrió dentro de la primera hora desde el inicio de la sesión, se asigna este porcentaje. Generalmente 0, ya que implica que prácticamente no asistió. Recomendado: 0.',
    },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Umbrales y parámetros" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto max-w-2xl">

        {/* Explanation banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-blue-700">
          <HelpCircle size={13} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">¿Cómo funcionan los umbrales?</p>
            <p>El sistema evalúa automáticamente a cada participante al guardar asistencia. Según los valores configurados aquí, asigna un nivel de alerta: <strong>OK</strong> (verde), <strong>ALERTA</strong> (naranja) o <strong>CRÍTICO</strong> (rojo). Estos niveles aparecen en el tablero del tutor, el panel de coordinación y los informes PDF.</p>
          </div>
        </div>

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
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40" style={{ background: 'var(--color-verde)' }}>
              <Save size={16} />{saving ? 'Guardando…' : 'Guardar umbrales'}
            </button>
            {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle size={14} />Guardado</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
