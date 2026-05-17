import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import { readSheet, updateRow, writeRow } from '../../lib/sheetsApi.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Save, CheckCircle } from 'lucide-react';

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
    { key: 'nombre_curso', label: 'Nombre del curso', type: 'text', col: 2 },
    { key: 'institucion', label: 'Institución', type: 'text', col: 2 },
    { key: 'anio', label: 'Año', type: 'number' },
    { key: 'total_semanas', label: 'N° semanas', type: 'number' },
    { key: 'fecha_inicio', label: 'Fecha inicio', type: 'date' },
    { key: 'fecha_cierre', label: 'Fecha cierre', type: 'date' },
    { key: 'hora_inicio_sesion', label: 'Hora inicio sesión', type: 'time' },
    { key: 'duracion_minutos', label: 'Duración (min)', type: 'number' },
  ];

  const thresholds = [
    { key: 'umbral_critico', label: 'Umbral crítico (%)' },
    { key: 'umbral_alerta', label: 'Umbral alerta (%)' },
    { key: 'umbral_justificaciones', label: 'Máx. justificaciones' },
    { key: 'umbral_retiros', label: 'Máx. retiros' },
    { key: 'umbral_dias_moodle', label: 'Días sin Moodle' },
    { key: 'umbral_logro', label: 'Umbral logro (%)' },
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-800">Umbrales de alerta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {thresholds.map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{f.label}</label>
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
            <label htmlFor="setup_completo" className="text-sm font-medium text-gray-700">Setup inicial completado</label>
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
