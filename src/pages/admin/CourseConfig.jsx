import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { readSheet, updateRow, writeRow } from '../../lib/sheetsApi.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Save, CheckCircle, HelpCircle } from 'lucide-react';

export default function CourseConfig() {
  const { auth } = useAuth();
  const { config, updateConfig, reloadConfig } = useConfig();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (config) setForm({ ...config }); }, [config]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const rows = await readSheet('CONFIGURACION');
      const row = { ...form, setup_completo: form.setup_completo ? 'TRUE' : 'FALSE' };
      if (rows.length > 0) {
        await updateRow('CONFIGURACION', rows[0]._rowIndex, row);
      } else {
        await writeRow('CONFIGURACION', row);
      }
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'EDITAR_CONFIG', entidad: 'CONFIGURACION', grupo: '', semana: '', detalle: 'Configuración actualizada', ip: '' });
      updateConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  if (!form) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--color-verde)] border-t-transparent rounded-full animate-spin" /></div>;

  const fields = [
    {
      key: 'nombre_curso', label: 'Nombre del curso', type: 'text', col: 2,
      tip: 'Nombre oficial del curso. Aparece en los encabezados de los informes PDF y en el sistema.',
    },
    {
      key: 'institucion', label: 'Institución', type: 'text', col: 2,
      tip: 'Institución que imparte o acredita el curso. Se usa en informes y en la pantalla de login.',
    },
    {
      key: 'anio', label: 'Año', type: 'number',
      tip: 'Año lectivo del curso. Referencial para distinguir versiones del mismo curso.',
    },
    {
      key: 'total_semanas', label: 'N° semanas', type: 'number',
      tip: 'Duración total del curso en semanas. Determina cuántas columnas aparecen en la grilla de asistencia y el eje X del gráfico.',
    },
    {
      key: 'fecha_inicio', label: 'Fecha inicio', type: 'date',
      tip: 'Fecha en que comienza el curso. El sistema la usa para calcular en qué semana estamos actualmente y mostrar el indicador de semana en la barra superior.',
    },
    {
      key: 'fecha_cierre', label: 'Fecha cierre', type: 'date',
      tip: 'Fecha de término del curso. Se muestra en los informes PDF para dar contexto temporal.',
    },
    {
      key: 'hora_inicio_sesion', label: 'Hora inicio sesión', type: 'time',
      tip: 'Hora en que comienzan las sesiones síncronas. Se usa para calcular el % de asistencia en retiros: si la persona se retiró dentro de la primera hora desde este momento, cuenta 0%; si fue después, cuenta 50%.',
    },
    {
      key: 'duracion_minutos', label: 'Duración (min)', type: 'number',
      tip: 'Duración en minutos de cada sesión. Referencial — actualmente no afecta el cálculo de asistencia, pero se incluye en informes.',
    },
  ];

  const thresholds = [
    {
      key: 'umbral_critico', label: 'Umbral crítico (%)',
      tip: 'Si la asistencia acumulada de un participante baja de este porcentaje, su alerta queda en estado CRÍTICO (rojo). Requiere contacto inmediato. Valor recomendado: 70.',
    },
    {
      key: 'umbral_alerta', label: 'Umbral alerta (%)',
      tip: 'Si la asistencia baja de este porcentaje (pero no llega al crítico), la alerta es ALERTA (naranja). Permite intervención preventiva. Valor recomendado: 75.',
    },
    {
      key: 'umbral_justificaciones', label: 'Máx. justificaciones',
      tip: 'Número máximo de ausencias con código J (justificadas) permitidas antes de activar una alerta de justificaciones. Evita que el uso de J se vuelva abusivo.',
    },
    {
      key: 'umbral_retiros', label: 'Máx. retiros',
      tip: 'Número máximo de retiros con código R permitidos antes de activar una alerta. Un participante que se retira sistemáticamente antes del término puede ser un riesgo de abandono.',
    },
    {
      key: 'umbral_dias_moodle', label: 'Días sin Moodle',
      tip: 'Días sin acceso a Moodle a partir de los cuales se activa una alerta de actividad en plataforma. Si el participante no ha ingresado en X días, requiere contacto.',
    },
    {
      key: 'umbral_logro', label: 'Umbral logro (%)',
      tip: 'Puntaje mínimo en evaluaciones para considerar que el participante "logró" el objetivo. Bajo este porcentaje, la evaluación se cuenta como "bajo umbral".',
    },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Configuración del curso" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto max-w-3xl">
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-800">Datos del curso</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.key} className={f.col === 2 ? 'sm:col-span-2' : ''}>
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  {f.label}
                  <Tooltip content={f.tip}>
                    <HelpCircle size={11} className="text-gray-300 cursor-help" />
                  </Tooltip>
                </label>
                <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800">Umbrales de alerta</h2>
            <Tooltip content="Los umbrales determinan cuándo el sistema clasifica a un participante como OK, ALERTA o CRÍTICO. Ajústalos según los requisitos del programa. Los cambios aplican a todos los cálculos desde ese momento.">
              <HelpCircle size={13} className="text-gray-300 cursor-help" />
            </Tooltip>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {thresholds.map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  {f.label}
                  <Tooltip content={f.tip}>
                    <HelpCircle size={11} className="text-gray-300 cursor-help" />
                  </Tooltip>
                </label>
                <input type="number" value={form[f.key] || ''} onChange={e => setForm(x => ({ ...x, [f.key]: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="setup_completo" checked={!!form.setup_completo} onChange={e => setForm(x => ({ ...x, setup_completo: e.target.checked }))}
              className="w-4 h-4 accent-[var(--color-verde)]" />
            <label htmlFor="setup_completo" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              Setup inicial completado
              <Tooltip content="Cuando está marcado, el banner de advertencia de setup desaparece del sistema. Solo desmarcar si necesitas volver a ejecutar el proceso de inicialización.">
                <HelpCircle size={12} className="text-gray-300 cursor-help" />
              </Tooltip>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40" style={{ background: 'var(--color-verde)' }}>
            <Save size={16} />{saving ? 'Guardando…' : 'Guardar configuración'}
          </button>
          {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle size={14} />Guardado correctamente</span>}
        </div>
      </div>
    </div>
  );
}
