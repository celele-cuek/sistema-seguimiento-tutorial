import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import { readSheet, batchWrite, writeRow } from '../../lib/sheetsApi.js';
import { parseFile } from '../../lib/csvProcessor.js';
import { generateId, nowISO, daysSince } from '../../lib/utils.js';
import { Upload, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import Tooltip from '../../components/ui/Tooltip.jsx';

const EXPECTED_COLS = ['rut', 'ultimo_acceso', 'participo_foro', 'entrego_producto', 'blog_actualizado'];

export default function MoodleUpload() {
  const { auth } = useAuth();
  const [file, setFile] = useState(null);
  const [semana, setSemana] = useState('');
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [colMap, setColMap] = useState({});
  const [preview, setPreview] = useState([]);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
    try {
      const rows = await parseFile(f);
      if (!rows.length) { setError('Archivo vacío'); return; }
      const hdrs = rows[0].map(h => h?.toString().trim());
      setHeaders(hdrs);
      setRawRows(rows.slice(1));
      const initialMap = {};
      for (const col of EXPECTED_COLS) {
        const idx = hdrs.findIndex(h => h.toLowerCase().includes(col.toLowerCase().split('_')[0]));
        if (idx >= 0) initialMap[col] = idx;
      }
      setColMap(initialMap);
      setStep(1);
    } catch (err) {
      setError('Error leyendo archivo: ' + err.message);
    }
  }

  async function buildPreview() {
    setError('');
    try {
      const participantes = await readSheet('PARTICIPANTES');
      const prev = rawRows.map((row, i) => {
        const rut = row[colMap['rut']]?.toString().trim() || '';
        const p = participantes.find(x => x.rut === rut || x.correo === rut);
        const ultimo_acceso = row[colMap['ultimo_acceso']]?.toString().trim() || '';
        const participo_foro = (row[colMap['participo_foro']]?.toString().trim() || '').toLowerCase().includes('si') || (row[colMap['participo_foro']]?.toString().trim() || '').toLowerCase() === 'true';
        const entrego_producto = (row[colMap['entrego_producto']]?.toString().trim() || '').toLowerCase().includes('si') || (row[colMap['entrego_producto']]?.toString().trim() || '').toLowerCase() === 'true';
        const blog_actualizado = (row[colMap['blog_actualizado']]?.toString().trim() || '').toLowerCase().includes('si') || (row[colMap['blog_actualizado']]?.toString().trim() || '').toLowerCase() === 'true';
        const dias = daysSince(ultimo_acceso) || 0;
        const estado_moodle = !participo_foro && !entrego_producto ? 'Sin conexión' : !entrego_producto ? 'Entrega pend.' : !blog_actualizado ? 'Blog pend.' : 'Ok';
        return {
          _row: i, rut, nombre: p?.nombre_completo || '(no encontrado)', grupo: p?.grupo || '—',
          ultimo_acceso, dias_sin_acceso: dias, participo_foro, entrego_producto, blog_actualizado, estado_moodle,
          _matched: !!p, _p: p,
        };
      }).filter(r => r.rut);
      setPreview(prev);
      setStep(2);
    } catch (err) {
      setError('Error generando preview: ' + err.message);
    }
  }

  async function handleSave() {
    if (!semana) { setError('Selecciona la semana'); return; }
    setSaving(true);
    setError('');
    try {
      const now = nowISO();
      const rows = preview.filter(p => p._matched).map(p => ({
        id: generateId(),
        rut_participante: p.rut,
        grupo: p.grupo,
        semana: String(semana),
        ultimo_acceso: p.ultimo_acceso,
        dias_sin_acceso: String(p.dias_sin_acceso),
        participo_foro: p.participo_foro ? 'TRUE' : 'FALSE',
        entrego_producto: p.entrego_producto ? 'TRUE' : 'FALSE',
        blog_actualizado: p.blog_actualizado ? 'TRUE' : 'FALSE',
        estado_moodle: p.estado_moodle,
        cargado_por: auth.email,
        fecha_carga: now,
      }));
      await batchWrite('MOODLE_SEMANAL', rows);
      await writeRow('LOG', { id: generateId(), datetime: now, usuario: auth.email, rol_activo: auth.roles?.[0] || 'TUTOR', accion: 'CARGAR_MOODLE', entidad: 'MOODLE_SEMANAL', grupo: '', semana: String(semana), detalle: `${rows.length} registros`, ip: '' });
      setSaved(true);
      setStep(3);
    } catch (err) {
      setError('Error guardando: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Carga de datos Moodle" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto max-w-3xl">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertTriangle size={14} />{error}</div>}

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-blue-700">
          <HelpCircle size={13} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">¿Para qué sirve esta sección?</p>
            <p>Permite registrar la actividad de tus participantes en la plataforma Moodle: accesos, participación en foros, entrega de productos y estado del blog. Estos datos alimentan el indicador de actividad Moodle en la ficha de cada participante y activan alertas si alguien lleva demasiados días sin conectarse.</p>
            <p className="mt-1">Descarga el informe desde Moodle → Administración del curso → Informes → Participación del curso, y súbelo aquí en formato CSV o Excel.</p>
          </div>
        </div>

        {/* Step 0: Upload */}
        {step >= 0 && step < 3 && (
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-800">1. Seleccionar archivo Moodle</h2>
            <p className="text-sm text-gray-500">Descarga el informe CSV/Excel desde Moodle (Informes &gt; Participación del curso).</p>
            <label className="flex flex-col items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-[var(--color-verde)] transition-colors">
              <Upload size={24} className="text-gray-400" />
              <span className="text-sm text-gray-500">{file ? file.name : 'Haz clic o arrastra el archivo aquí'}</span>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
            </label>
          </div>
        )}

        {/* Step 1: Map columns */}
        {step >= 1 && step < 3 && (
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-800">2. Mapear columnas</h2>
            <p className="text-sm text-gray-500">Verifica que cada campo del sistema apunte a la columna correcta del archivo.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EXPECTED_COLS.map(col => {
                const tips = {
                  rut: 'Columna que contiene el RUT del participante (sin puntos, con guión). Se usa para vincular el registro con el participante en el sistema.',
                  ultimo_acceso: 'Fecha del último acceso del participante a Moodle. Formato: YYYY-MM-DD o similar. Se usa para calcular días sin conexión.',
                  participo_foro: 'Indica si el participante participó en el foro del curso esa semana. Acepta: Sí/No, TRUE/FALSE, 1/0.',
                  entrego_producto: 'Indica si el participante entregó el producto o tarea de la semana. Acepta: Sí/No, TRUE/FALSE, 1/0.',
                  blog_actualizado: 'Indica si el participante actualizó su blog de aprendizaje esa semana. Acepta: Sí/No, TRUE/FALSE, 1/0.',
                };
                return (
                <div key={col}>
                  <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                    {col.replace(/_/g, ' ')}
                    <Tooltip content={tips[col] || ''}>
                      <HelpCircle size={11} className="text-gray-300 cursor-help" />
                    </Tooltip>
                  </label>
                  <select value={colMap[col] ?? ''} onChange={e => setColMap(m => ({ ...m, [col]: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                    <option value="">— sin mapear —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
                );
              })}
            </div>
            <button onClick={buildPreview} className="self-start px-5 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--color-verde)' }}>
              Ver preview
            </button>
          </div>
        )}

        {/* Step 2: Preview & save */}
        {step >= 2 && step < 3 && (
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">3. Preview y semana</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Semana:</span>
                <select value={semana} onChange={e => setSemana(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                  <option value="">—</option>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
            </div>
            <p className="text-sm text-gray-500">{preview.filter(p => p._matched).length} de {preview.length} registros encontrados en el sistema.</p>
            <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-64">
              <table className="w-full text-xs">
                <thead style={{ background: 'var(--color-oscuro)', color: '#9ABFB8' }}>
                  <tr>
                    <th className="px-3 py-2 text-left">RUT</th>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-center">Foro</th>
                    <th className="px-3 py-2 text-center">Entrega</th>
                    <th className="px-3 py-2 text-center">Blog</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className={`border-t border-gray-100 ${!r._matched ? 'bg-red-50' : i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                      <td className="px-3 py-1.5 font-mono">{r.rut}</td>
                      <td className="px-3 py-1.5">{r.nombre}</td>
                      <td className="px-3 py-1.5 text-center">{r.participo_foro ? '✓' : '✗'}</td>
                      <td className="px-3 py-1.5 text-center">{r.entrego_producto ? '✓' : '✗'}</td>
                      <td className="px-3 py-1.5 text-center">{r.blog_actualizado ? '✓' : '✗'}</td>
                      <td className="px-3 py-1.5">{r.estado_moodle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleSave} disabled={saving || !semana}
              className="self-start px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40" style={{ background: 'var(--color-verde)' }}>
              {saving ? 'Guardando…' : 'Guardar en Sheets'}
            </button>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm p-10 flex flex-col items-center gap-4">
            <CheckCircle size={40} className="text-green-500" />
            <h2 className="text-lg font-bold text-gray-800">Datos Moodle guardados</h2>
            <p className="text-sm text-gray-500">Los indicadores han sido actualizados correctamente.</p>
            <button onClick={() => { setStep(0); setFile(null); setSaved(false); setPreview([]); }}
              className="px-5 py-2 rounded-xl text-white text-sm" style={{ background: 'var(--color-verde)' }}>
              Cargar otro archivo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
