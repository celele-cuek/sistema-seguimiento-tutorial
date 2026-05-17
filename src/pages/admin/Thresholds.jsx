import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import { readSheet, updateRow, writeRow } from '../../lib/sheetsApi.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Save, CheckCircle } from 'lucide-react';

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
    { key: 'umbral_critico', label: 'Umbral crítico (%)', desc: 'Asistencia bajo este % activa alerta CRÍTICO' },
    { key: 'umbral_alerta', label: 'Umbral alerta (%)', desc: 'Asistencia bajo este % activa alerta ALERTA' },
    { key: 'umbral_justificaciones', label: 'Máx. justificaciones', desc: 'Número de J que activa alerta de justificaciones' },
    { key: 'umbral_retiros', label: 'Máx. retiros', desc: 'Número de R que activa alerta de retiros' },
    { key: 'umbral_dias_moodle', label: 'Días sin Moodle', desc: 'Días sin acceso a Moodle para activar alerta' },
    { key: 'umbral_logro', label: 'Umbral logro (%)', desc: 'Puntaje bajo este % cuenta como bajo umbral' },
    { key: 'umbral_evaluaciones_logro', label: 'Evaluaciones bajo umbral', desc: 'Cuántas evaluaciones bajo umbral activan alerta' },
    { key: 'descuento_retiro_primera_hora', label: 'Descuento retiro ≥1h (%)', desc: 'Porcentaje que cuenta si el retiro es ≥1h' },
    { key: 'descuento_tardanza', label: 'Descuento tardanza/retiro <1h (%)', desc: 'Porcentaje que cuenta si retiro es <1h' },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Umbrales y parámetros" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-800">Umbrales de alerta</h2>
          <div className="flex flex-col gap-4">
            {thresholds.map(t => (
              <div key={t.key} className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">{t.label}</label>
                  <p className="text-xs text-gray-400">{t.desc}</p>
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
