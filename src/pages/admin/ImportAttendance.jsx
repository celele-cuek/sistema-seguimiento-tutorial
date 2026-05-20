import { useState, useRef } from 'react';
import Topbar from '../../components/layout/Topbar.jsx';
import { readSheet, batchWrite, writeRow } from '../../lib/sheetsApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import { generateId, nowISO } from '../../lib/utils.js';
import { GRUPOS_SEED } from '../../lib/seedData.js';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle,
  XCircle, ChevronRight, RotateCcw, HelpCircle,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────── */

const DIA_WEEKDAY = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5 };

function normRut(rut) {
  return String(rut ?? '').replace(/\./g, '').toLowerCase().trim();
}

function extractGrupo(filename) {
  const m = filename.match(/^([AB]\d{2})/i);
  return m ? m[1].toUpperCase() : null;
}

// "1(18.05)" | "1 (18.05)" → { semanaLocal: 1, dateStr: "2026-05-18" }
// "2" | "2.0"             → { semanaLocal: 2, dateStr: null }
function parseWeekHeader(h) {
  if (h == null) return null;
  const s = String(h).trim();
  const withDate = s.match(/^(\d+)\s*\((\d{1,2})\.(\d{2})\)/);
  if (withDate) {
    const [, sem, dd, mm] = withDate;
    return {
      semanaLocal: parseInt(sem),
      dateStr: `2026-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`,
    };
  }
  const numOnly = s.match(/^(\d+)(\.\d+)?$/);
  if (numOnly) return { semanaLocal: parseInt(numOnly[1]), dateStr: null };
  return null;
}

// Derive system semana + date for a group session on a given date
function deriveSystemWeek(dateStr, grupo, fechaInicio) {
  const grupoInfo = GRUPOS_SEED.find(g => g.id === grupo);
  if (!grupoInfo) return null;
  const wd = DIA_WEEKDAY[grupoInfo.dia_tutoria];
  if (wd == null) return null;

  // Use localDate() to avoid UTC midnight → wrong weekday in Chile (UTC-3/4)
  let start = localDate(fechaInicio);
  while (start.getDay() !== wd) start.setDate(start.getDate() + 1);

  const target = localDate(dateStr);
  const diffDays = Math.round((target - start) / 86_400_000);
  if (diffDays < 0) return null;
  return Math.floor(diffDays / 7) + 1;
}

// Parse YYYY-MM-DD as local date (avoids UTC midnight → wrong day in Chile timezone)
function localDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addWeeks(dateStr, n) {
  const d = localDate(dateStr);
  d.setDate(d.getDate() + n * 7);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function mapEstado(val) {
  if (val == null) return null;
  const s = String(val).trim().toUpperCase();
  if (s === 'P' || s === '1') return 'P';
  if (s === 'A' || s === 'F' || s === '0') return 'A';
  if (s === '') return ''; // blank in active session → handled later
  return null;
}

/* ─── component ───────────────────────────────────────────── */

export default function ImportAttendance() {
  const { auth } = useAuth();
  const { config } = useConfig();
  const fileRef = useRef();

  const [step, setStep] = useState('upload'); // upload | preview | result
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [result, setResult] = useState(null);

  /* ── file selection ── */
  function addFiles(incoming) {
    const xlsx = Array.from(incoming).filter(f => f.name.toLowerCase().endsWith('.xlsx'));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...xlsx.filter(f => !names.has(f.name))];
    });
  }

  function removeFile(name) { setFiles(prev => prev.filter(f => f.name !== name)); }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  /* ── analyze ── */
  async function analyze() {
    setAnalyzing(true);
    const errs = [];
    const results = [];

    try {
      const fechaInicio = config?.fecha_inicio || '2026-03-10';

      // Load sheets data once
      const [asistRows, partRows, calRows] = await Promise.all([
        readSheet('ASISTENCIA'),
        readSheet('PARTICIPANTES'),
        readSheet('CALENDARIO').catch(() => []),
      ]);

      const existingKeys = new Set(
        asistRows.map(r => `${r.rut_participante}|${r.grupo}|${r.semana}|${r.tipo_sesion}`)
      );
      const partByRut = {};
      partRows.forEach(p => { partByRut[normRut(p.rut)] = p; });

      // CALENDARIO fecha → semana map
      const calMap = {};
      calRows.forEach(r => { if (r.fecha && r.semana) calMap[r.fecha] = { semana: r.semana, tipo: r.tipo_sesion || 'TP' }; });

      for (const file of files) {
        const grupo = extractGrupo(file.name);
        if (!grupo) {
          errs.push(`${file.name}: no se pudo identificar el grupo del nombre.`);
          continue;
        }

        let wb;
        try {
          const buf = await file.arrayBuffer();
          wb = XLSX.read(buf, { type: 'array' });
        } catch {
          errs.push(`${file.name}: error al leer el archivo Excel.`);
          continue;
        }

        if (!wb.SheetNames.includes(grupo)) {
          errs.push(`${file.name}: la hoja "${grupo}" no existe.`);
          continue;
        }

        const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[grupo], { header: 1, defval: null });
        if (rawRows.length < 2) { errs.push(`${file.name}: sin datos.`); continue; }

        const headerRow = rawRows[0];
        const dataRows = rawRows.slice(1).filter(r => r[0] != null);

        // Detect week columns (header starts with digit)
        const weekCols = [];
        for (let ci = 0; ci < headerRow.length; ci++) {
          const parsed = parseWeekHeader(headerRow[ci]);
          if (parsed) weekCols.push({ ci, ...parsed });
        }

        if (!weekCols.length) { errs.push(`${file.name}: no se encontraron columnas de semanas.`); continue; }

        // Build semana map for all week columns
        // Find anchor: first week col that has a date
        const anchor = weekCols.find(wc => wc.dateStr);
        let anchorSistema = null;
        let anchorLocal = null;
        let anchorDate = null;

        if (anchor) {
          // Try CALENDARIO first
          if (calMap[anchor.dateStr]) {
            anchorSistema = parseInt(calMap[anchor.dateStr].semana);
          } else {
            anchorSistema = deriveSystemWeek(anchor.dateStr, grupo, fechaInicio);
          }
          anchorLocal = anchor.semanaLocal;
          anchorDate = anchor.dateStr;
        }

        for (const wc of weekCols) {
          const { ci, semanaLocal, dateStr } = wc;

          // Check if this column has any actual data
          const colVals = dataRows.map(r => r[ci]);
          const hasData = colVals.some(v => v != null && String(v).trim() !== '');
          if (!hasData) continue;

          // Derive system semana and fecha for this column
          let sistemaSemana, fechaSesion;
          if (anchorSistema && anchorLocal) {
            const offset = semanaLocal - anchorLocal;
            sistemaSemana = anchorSistema + offset;
            fechaSesion = anchorDate ? addWeeks(anchorDate, offset) : (dateStr || '');
          } else if (dateStr) {
            sistemaSemana = deriveSystemWeek(dateStr, grupo, fechaInicio);
            fechaSesion = dateStr;
          }

          if (!sistemaSemana) {
            errs.push(`${file.name}: no se pudo determinar semana del sistema para columna "${headerRow[ci]}".`);
            continue;
          }

          // Determine tipo_sesion
          const tipoSesion = (calMap[fechaSesion]?.tipo) || 'TP';

          // Process each participant row
          for (const row of dataRows) {
            const rawRut = row[1];
            if (!rawRut) continue;

            const rut = normRut(rawRut);
            const raw = row[ci];
            let estado = mapEstado(raw);

            // blank in active session → Ausente
            if (estado === '') estado = 'A';
            if (estado === null) continue;

            const part = partByRut[rut];
            const nombre = part?.nombre_completo || String(row[0] || rut);
            const key = `${rut}|${grupo}|${sistemaSemana}|${tipoSesion}`;

            let action;
            if (!part) action = 'no-match';
            else if (existingKeys.has(key)) action = 'skip';
            else action = 'import';

            results.push({
              _key: key,
              grupo,
              rut,
              rutDisplay: String(rawRut).trim(),
              nombre,
              semana: String(sistemaSemana),
              fechaSesion: fechaSesion || '',
              tipoSesion,
              estado,
              action,
              archivo: file.name,
            });
          }
        }
      }

      setCandidates(results);
      setParseErrors(errs);
      setStep('preview');
    } catch (err) {
      console.error(err);
      errs.push(`Error inesperado: ${err.message}`);
      setParseErrors(errs);
    } finally {
      setAnalyzing(false);
    }
  }

  /* ── import ── */
  async function doImport() {
    setImporting(true);
    const toImport = candidates.filter(r => r.action === 'import');
    try {
      const now = nowISO();
      const rows = toImport.map(r => ({
        id: generateId(),
        rut_participante: r.rut,
        grupo: r.grupo,
        semana: r.semana,
        tipo_sesion: r.tipoSesion,
        fecha_sesion: r.fechaSesion,
        estado: r.estado,
        hora_evento: '',
        pct_sesion: r.estado === 'P' ? '100' : '0',
        registrado_por: auth.email,
        fecha_registro: now,
        editado: 'FALSE',
        fecha_edicion: '',
        editado_por: '',
      }));

      if (rows.length) {
        await batchWrite('ASISTENCIA', rows);
        const grupos = [...new Set(toImport.map(r => r.grupo))].join(',');
        const semanas = [...new Set(toImport.map(r => r.semana))].join(',');
        await writeRow('LOG', {
          id: generateId(), datetime: now, usuario: auth.email, rol_activo: 'ADMIN',
          accion: 'IMPORTAR_ASISTENCIA', entidad: 'ASISTENCIA',
          grupo: grupos, semana: semanas,
          detalle: `${rows.length} registros importados desde planillas Excel`, ip: '',
        });
      }

      setResult({
        imported: toImport.length,
        skipped: candidates.filter(r => r.action === 'skip').length,
        noMatch: candidates.filter(r => r.action === 'no-match').length,
        grupos: [...new Set(toImport.map(r => r.grupo))],
      });
      setStep('result');
    } catch (err) {
      console.error(err);
      setParseErrors([`Error al importar: ${err.message}`]);
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep('upload'); setFiles([]); setCandidates([]);
    setParseErrors([]); setResult(null);
  }

  /* ── derived stats ── */
  const nImport = candidates.filter(r => r.action === 'import').length;
  const nSkip   = candidates.filter(r => r.action === 'skip').length;
  const nNoMatch = candidates.filter(r => r.action === 'no-match').length;

  // Group by grupo for preview table
  const byGrupo = {};
  candidates.forEach(r => {
    if (!byGrupo[r.grupo]) byGrupo[r.grupo] = [];
    byGrupo[r.grupo].push(r);
  });

  /* ─── render ─────────────────────────────────────────────── */
  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Importar planillas de asistencia" />

      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-5">

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {['upload', 'preview', 'result'].map((s, i) => {
            const labels = ['1. Subir archivos', '2. Vista previa', '3. Resultado'];
            const active = step === s;
            const done = ['upload', 'preview', 'result'].indexOf(step) > i;
            return (
              <span key={s} className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  active ? 'text-white' : done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`} style={active ? { background: 'var(--color-verde)' } : {}}>
                  {labels[i]}
                </span>
                {i < 2 && <ChevronRight size={14} className="text-gray-300" />}
              </span>
            );
          })}
        </div>

        {/* ── STEP 1: Upload ── */}
        {step === 'upload' && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-start gap-2 text-xs text-blue-700">
              <HelpCircle size={13} className="shrink-0 mt-0.5" />
              <span>
                Sube los archivos Excel de los tutores. El sistema detecta el grupo desde el nombre del archivo
                (ej. <strong>A07 ALEJANDRA.xlsx</strong> → grupo A07) y lee la hoja correspondiente.
                Solo se importan los registros nuevos; los duplicados se saltan.
              </span>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragging ? 'border-[var(--color-verde)] bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <Upload size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Arrastra archivos .xlsx aquí</p>
              <p className="text-xs text-gray-400 mt-1">o haz clic para seleccionar</p>
              <input ref={fileRef} type="file" accept=".xlsx" multiple className="hidden"
                onChange={e => addFiles(e.target.files)} />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}
                </div>
                {files.map(f => {
                  const grupo = extractGrupo(f.name);
                  return (
                    <div key={f.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50">
                      <FileSpreadsheet size={16} className="text-green-500 shrink-0" />
                      <span className="flex-1 text-sm text-gray-700 truncate">{f.name}</span>
                      {grupo
                        ? <span className="text-xs font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded">→ {grupo}</span>
                        : <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">grupo no detectado</span>
                      }
                      <button onClick={e => { e.stopPropagation(); removeFile(f.name); }}
                        className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={analyze}
                disabled={files.length === 0 || analyzing}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40"
                style={{ background: 'var(--color-verde)' }}
              >
                {analyzing ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analizando…</>
                ) : (
                  <><ChevronRight size={15} /> Analizar archivos</>
                )}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === 'preview' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <SummaryCard icon={<CheckCircle size={20} className="text-green-600" />}
                label="A importar" value={nImport} color="green" />
              <SummaryCard icon={<AlertTriangle size={20} className="text-yellow-500" />}
                label="Duplicados (saltar)" value={nSkip} color="yellow" />
              <SummaryCard icon={<XCircle size={20} className="text-red-400" />}
                label="RUT no encontrado" value={nNoMatch} color="red" />
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-xs text-red-700 flex flex-col gap-1">
                <p className="font-semibold mb-1">Advertencias al leer archivos:</p>
                {parseErrors.map((e, i) => <p key={i}>• {e}</p>)}
              </div>
            )}

            {/* Table per grupo */}
            {Object.entries(byGrupo).map(([grupo, rows]) => {
              const imp = rows.filter(r => r.action === 'import').length;
              const ski = rows.filter(r => r.action === 'skip').length;
              const nom = rows.filter(r => r.action === 'no-match').length;
              return (
                <div key={grupo} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                    <span className="font-mono font-semibold text-gray-700">{grupo}</span>
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">{imp} importar</span>
                    {ski > 0 && <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">{ski} saltar</span>}
                    {nom > 0 && <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">{nom} sin RUT</span>}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Participante</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">RUT</th>
                        <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wide">Semana</th>
                        <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wide">Sesión</th>
                        <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wide">Fecha</th>
                        <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wide">Estado</th>
                        <th className="px-3 py-2 text-center text-gray-500 font-semibold uppercase tracking-wide">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r._key + i} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                          <td className="px-3 py-1.5 font-medium text-gray-800 max-w-[200px] truncate">{r.nombre}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-500">{r.rutDisplay}</td>
                          <td className="px-3 py-1.5 text-center text-gray-600">{r.semana}</td>
                          <td className="px-3 py-1.5 text-center text-gray-600">{r.tipoSesion}</td>
                          <td className="px-3 py-1.5 text-center text-gray-500">{r.fechaSesion || '—'}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              r.estado === 'P' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                            }`}>{r.estado === 'P' ? 'Presente' : 'Ausente'}</span>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {r.action === 'import' && <span className="text-green-600 font-medium">Importar</span>}
                            {r.action === 'skip' && <span className="text-yellow-600">Saltar</span>}
                            {r.action === 'no-match' && <span className="text-red-400">Sin RUT</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {candidates.length === 0 && !parseErrors.length && (
              <div className="text-center py-12 text-gray-400">No se encontraron datos para importar en los archivos subidos.</div>
            )}

            <div className="flex justify-between">
              <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50">
                <RotateCcw size={14} /> Volver
              </button>
              <button
                onClick={doImport}
                disabled={nImport === 0 || importing}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-40"
                style={{ background: 'var(--color-verde)' }}
              >
                {importing ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importando…</>
                ) : (
                  <><CheckCircle size={15} /> Confirmar importación ({nImport})</>
                )}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Result ── */}
        {step === 'result' && result && (
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={36} className="text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-800 mb-1">Importación completada</p>
              <p className="text-sm text-gray-500">
                Grupos: {result.grupos.join(', ')}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
              <SummaryCard icon={<CheckCircle size={20} className="text-green-600" />}
                label="Importados" value={result.imported} color="green" />
              <SummaryCard icon={<AlertTriangle size={20} className="text-yellow-500" />}
                label="Saltados" value={result.skipped} color="yellow" />
              <SummaryCard icon={<XCircle size={20} className="text-red-400" />}
                label="Sin RUT" value={result.noMatch} color="red" />
            </div>
            {result.noMatch > 0 && (
              <p className="text-xs text-red-500 text-center max-w-md">
                {result.noMatch} participante{result.noMatch !== 1 ? 's' : ''} no se importó porque su RUT no coincide con la nómina del sistema.
                Verifica la nómina en Admin &gt; Nómina masiva.
              </p>
            )}
            <button onClick={reset} className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium"
              style={{ background: 'var(--color-verde)' }}>
              <RotateCcw size={14} /> Nueva importación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }) {
  const colors = {
    green: 'border-green-100 bg-green-50',
    yellow: 'border-yellow-100 bg-yellow-50',
    red: 'border-red-100 bg-red-50',
  };
  return (
    <div className={`rounded-xl border p-4 flex flex-col items-center gap-1 ${colors[color]}`}>
      {icon}
      <span className="text-2xl font-bold text-gray-800">{value}</span>
      <span className="text-xs text-gray-500 text-center">{label}</span>
    </div>
  );
}
