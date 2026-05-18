import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import { parseFile, detectColumnMapping, processParticipantsFile, PARTICIPANTE_HEADERS } from '../../lib/csvProcessor.js';
import { batchWrite, readSheet, writeRow, clearAndWriteSheet } from '../../lib/sheetsApi.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Upload, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function NominaImport() {
  const { auth } = useAuth();
  const [step, setStep] = useState(0);
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [colMap, setColMap] = useState({});
  const [result, setResult] = useState({ valid: [], errors: [] });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [replaceMode, setReplaceMode] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    try {
      const rows = await parseFile(f);
      if (!rows.length) { setError('Archivo vacío'); return; }
      const hdrs = rows[0].map(h => h?.toString().trim());
      setHeaders(hdrs);
      setRawRows(rows);
      const map = detectColumnMapping(hdrs, PARTICIPANTE_HEADERS);
      setColMap(map);
      setStep(1);
    } catch (err) { setError('Error: ' + err.message); }
  }

  function handleProcess() {
    const processed = processParticipantsFile(rawRows, colMap);
    setResult(processed);
    setStep(2);
  }

  async function handleSave() {
    if (!result.valid.length) return;
    setSaving(true);
    setError('');
    try {
      const existing = await readSheet('PARTICIPANTES');
      const existRuts = new Set(existing.map(p => p.rut));
      const toWrite = result.valid.filter(p => !existRuts.has(p.rut)).map(({ _rowNum, _errors, ...p }) => ({
        ...p,
        fecha_ingreso: p.fecha_ingreso || nowISO().split('T')[0],
        estado: 'Activo',
      }));
      if (!toWrite.length) { setError('Todos los registros ya existen en el sistema.'); setSaving(false); return; }
      await batchWrite('PARTICIPANTES', toWrite);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'AGREGAR_PARTICIPANTE', entidad: 'PARTICIPANTES', grupo: '', semana: '', detalle: `${toWrite.length} participantes importados`, ip: '' });
      setSaved(true);
      setStep(3);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  async function handleReplace() {
    if (!result.valid.length) return;
    setSaving(true);
    setError('');
    setConfirmReplace(false);
    try {
      const toWrite = result.valid.map(({ _rowNum, _errors, ...p }) => ({
        ...p,
        fecha_ingreso: p.fecha_ingreso || nowISO().split('T')[0],
        estado: 'Activo',
      }));
      await clearAndWriteSheet('PARTICIPANTES', toWrite);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'REEMPLAZAR_NOMINA', entidad: 'PARTICIPANTES', grupo: '', semana: '', detalle: `${toWrite.length} participantes cargados (reemplazo completo)`, ip: '' });
      setSaved(true);
      setStep(3);
    } catch (err) { setError('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  const minCols = ['rut', 'nombres', 'primer_apellido', 'grupo'];

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Importación masiva de nómina" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto max-w-4xl">
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2"><AlertTriangle size={14} />{error}</div>}

        {/* Step 0: Upload */}
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-800">1. Subir archivo</h2>
          <p className="text-sm text-gray-500">CSV o Excel con columnas mínimas: {minCols.join(', ')}.</p>
          <label className="flex flex-col items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-[var(--color-verde)] transition-colors">
            <Upload size={24} className="text-gray-400" />
            <span className="text-sm text-gray-500">Haz clic o arrastra el archivo aquí (.csv, .xlsx)</span>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
        </div>

        {/* Step 1: Map columns */}
        {step >= 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-800">2. Mapear columnas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PARTICIPANTE_HEADERS.slice(0, 12).map(col => (
                <div key={col}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{col.replace(/_/g, ' ')} {minCols.includes(col) ? '*' : ''}</label>
                  <select value={colMap[col] ?? ''} onChange={e => setColMap(m => ({ ...m, [col]: e.target.value !== '' ? Number(e.target.value) : undefined }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                    <option value="">— sin mapear —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button onClick={handleProcess} className="self-start px-5 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--color-verde)' }}>
              Procesar y validar
            </button>
          </div>
        )}

        {/* Step 2: Preview */}
        {step >= 2 && (
          <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
            <h2 className="font-semibold text-gray-800">3. Revisión y guardado</h2>
            <div className="flex gap-4 text-sm">
              <span className="text-green-700"><strong>{result.valid.length}</strong> válidos</span>
              <span className="text-red-700"><strong>{result.errors.length}</strong> con errores</span>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-2">Registros con errores (no serán importados):</p>
                {result.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Fila {e._rowNum}: {e._errors.join(', ')}</p>
                ))}
                {result.errors.length > 5 && <p className="text-xs text-red-400">…y {result.errors.length - 5} más.</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-3 items-center">
              <button onClick={handleSave} disabled={saving || !result.valid.length} className="px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40" style={{ background: 'var(--color-verde)' }}>
                {saving && !confirmReplace ? 'Importando…' : `Agregar ${result.valid.length} a nómina existente`}
              </button>
              <button onClick={() => setConfirmReplace(true)} disabled={saving || !result.valid.length} className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40 bg-red-600 hover:bg-red-700">
                <RefreshCw size={14} />
                Reemplazar nómina completa
              </button>
            </div>

            {confirmReplace && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-sm font-semibold text-red-800">¿Confirmas el reemplazo?</p>
                <p className="text-sm text-red-700">Se borrará toda la nómina actual y se cargarán los <strong>{result.valid.length}</strong> participantes del archivo. Esta acción no se puede deshacer.</p>
                <div className="flex gap-3">
                  <button onClick={handleReplace} disabled={saving} className="px-4 py-2 rounded-lg text-white text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-40">
                    {saving ? 'Reemplazando…' : 'Sí, reemplazar'}
                  </button>
                  <button onClick={() => setConfirmReplace(false)} disabled={saving} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm p-10 flex flex-col items-center gap-4">
            <CheckCircle size={40} className="text-green-500" />
            <h2 className="text-lg font-bold text-gray-800">Importación completada</h2>
            <button onClick={() => { setStep(0); setRawRows([]); setSaved(false); setResult({ valid: [], errors: [] }); }}
              className="px-5 py-2 rounded-xl text-white text-sm" style={{ background: 'var(--color-verde)' }}>
              Nueva importación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
