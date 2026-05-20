import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import { readSheet, writeRow, clearAndWriteSheet, batchWrite } from '../../lib/sheetsApi.js';
import { exportToExcel } from '../../lib/csvProcessor.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Database, Download, CheckCircle, Trash2, AlertTriangle, FlaskConical, ShieldCheck, RefreshCw, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

const ALL_SHEETS = ['CONFIGURACION', 'CALENDARIO', 'USUARIOS', 'PARTICIPANTES', 'ASISTENCIA', 'RESUMEN_PARTICIPANTE', 'NOVEDADES', 'MOODLE_SEMANAL', 'LOG', 'EVALUACIONES'];
const DATA_SHEETS = ['ASISTENCIA', 'RESUMEN_PARTICIPANTE', 'NOVEDADES', 'MOODLE_SEMANAL', 'EVALUACIONES', 'LOG'];

export default function Backup() {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState('');

  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const [seedingTPSE, setSeedingTPSE] = useState(false);
  const [seedTPSEDone, setSeedTPSEDone] = useState(false);
  const [seedTPSEError, setSeedTPSEError] = useState('');

  const [deduping, setDeduping] = useState(false);
  const [dedupResult, setDedupResult] = useState(null);
  const [dedupError, setDedupError] = useState('');

  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [migrateError, setMigrateError] = useState('');

  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const [restoreError, setRestoreError] = useState('');

  async function handleBackup() {
    setLoading(true);
    setDone(false);
    try {
      const sheetData = {};
      for (const sheet of ALL_SHEETS) {
        setProgress(`Leyendo ${sheet}…`);
        try { sheetData[sheet] = await readSheet(sheet); } catch { sheetData[sheet] = []; }
      }
      setProgress('Generando archivo Excel…');
      const fileName = `backup_SST_${nowISO().replace(/[:T]/g, '-').slice(0, 19)}.xlsx`;
      exportToExcel(sheetData, fileName);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'CREAR_BACKUP', entidad: 'ALL', grupo: '', semana: '', detalle: fileName, ip: '' });
      setDone(true);
      setProgress('');
    } catch (err) {
      setProgress('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    setResetError('');
    setResetDone(false);
    try {
      for (const sheet of DATA_SHEETS) {
        setProgress(`Limpiando ${sheet}…`);
        await clearAndWriteSheet(sheet, []);
      }
      setProgress('');
      setResetDone(true);
      setConfirmReset(false);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'RESET_DATOS', entidad: 'ALL', grupo: '', semana: '', detalle: `Hojas limpiadas: ${DATA_SHEETS.join(', ')}`, ip: '' });
    } catch (err) {
      setResetError('Error al limpiar: ' + err.message);
      setProgress('');
    } finally {
      setResetting(false);
    }
  }

  async function handleDedup() {
    setDeduping(true);
    setDedupResult(null);
    setDedupError('');
    try {
      setProgress('Leyendo PARTICIPANTES…');
      const rows = await readSheet('PARTICIPANTES');
      const seen = new Set();
      const unique = [];
      const dups = [];
      for (const row of rows) {
        if (!seen.has(row.rut)) { seen.add(row.rut); unique.push(row); }
        else dups.push(row.rut);
      }
      if (dups.length === 0) {
        setDedupResult({ removed: 0, kept: unique.length });
        setProgress('');
        return;
      }
      setProgress(`Reescribiendo ${unique.length} participantes únicos…`);
      await clearAndWriteSheet('PARTICIPANTES', unique);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'DEDUP_PARTICIPANTES', entidad: 'PARTICIPANTES', grupo: '', semana: '', detalle: `${dups.length} duplicados eliminados`, ip: '' });
      setDedupResult({ removed: dups.length, kept: unique.length });
      setProgress('');
    } catch (err) {
      setDedupError('Error: ' + err.message);
      setProgress('');
    } finally {
      setDeduping(false);
    }
  }

  async function handleRestoreAsistencia(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setRestoreResult(null);
    setRestoreError('');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets['ASISTENCIA'];
      if (!ws) throw new Error('El archivo no contiene una hoja llamada ASISTENCIA.');
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) throw new Error('La hoja ASISTENCIA está vacía.');
      setProgress(`Restaurando ${rows.length} registros…`);
      await clearAndWriteSheet('ASISTENCIA', rows);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'RESTAURAR_ASISTENCIA', entidad: 'ASISTENCIA', grupo: '', semana: '', detalle: `${rows.length} registros restaurados desde backup`, ip: '' });
      setRestoreResult(rows.length);
      setProgress('');
    } catch (err) {
      setRestoreError('Error: ' + err.message);
      setProgress('');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  }

  async function handleMigrateEstados() {
    setMigrating(true);
    setMigrateResult(null);
    setMigrateError('');
    try {
      setProgress('Leyendo ASISTENCIA…');
      const rows = await readSheet('ASISTENCIA');
      // Solo migrar si existen registros con nomenclatura antigua (F=Falta)
      const hasOldNomenclature = rows.some(r => r.estado === 'F' || r.estado === 'A');
      if (!hasOldNomenclature) {
        setMigrateResult({ convertidos: 0, total: rows.length });
        setProgress('');
        return;
      }
      // Verificación adicional: si no hay ningún 'F', los 'A' ya son Ausente (nueva nomenclatura)
      const hasF = rows.some(r => r.estado === 'F');
      if (!hasF) {
        setMigrateError('No se encontraron registros con estado "F". La migración ya fue ejecutada. Si hay un problema de datos, restaura desde backup.');
        setProgress('');
        return;
      }
      let convertidos = 0;
      const migrated = rows.map(r => {
        if (r.estado === 'A') { convertidos++; return { ...r, estado: 'P' }; }
        if (r.estado === 'F') { convertidos++; return { ...r, estado: 'A' }; }
        return r;
      });
      if (convertidos === 0) {
        setMigrateResult({ convertidos: 0, total: rows.length });
        setProgress('');
        return;
      }
      setProgress(`Reescribiendo ${migrated.length} registros de ASISTENCIA…`);
      await clearAndWriteSheet('ASISTENCIA', migrated);

      // Renombrar contador_f → contador_a en RESUMEN_PARTICIPANTE
      setProgress('Actualizando encabezado RESUMEN_PARTICIPANTE…');
      const resumen = await readSheet('RESUMEN_PARTICIPANTE');
      const resumenMigrado = resumen.map(r => {
        if ('contador_f' in r) {
          const { contador_f, ...rest } = r;
          return { ...rest, contador_a: contador_f };
        }
        return r;
      });
      if (resumen.length > 0) await clearAndWriteSheet('RESUMEN_PARTICIPANTE', resumenMigrado);

      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'MIGRAR_ESTADOS', entidad: 'ASISTENCIA', grupo: '', semana: '', detalle: `${convertidos} registros convertidos (A→P / F→A) + renombre contador_f→contador_a`, ip: '' });
      setMigrateResult({ convertidos, total: migrated.length });
      setProgress('');
    } catch (err) {
      setMigrateError('Error: ' + err.message);
      setProgress('');
    } finally {
      setMigrating(false);
    }
  }

  async function handleSeedTPSE() {
    setSeedingTPSE(true);
    setSeedTPSEDone(false);
    setSeedTPSEError('');
    try {
      setProgress('Leyendo participantes…');
      const parts = await readSheet('PARTICIPANTES');
      const active = parts.filter(p => p.estado !== 'Inactivo');
      if (!active.length) throw new Error('No hay participantes activos. Carga la nómina primero.');

      // 5 attendance patterns (TP,SE per week) covering OK, ALERTA and CRÍTICO levels
      const PATTERNS = [
        [['P','P'],['P','P'],['P','A'],['P','P'],['P','P']], // ~90% OK
        [['P','P'],['P','P'],['P','P'],['P','P'],['P','P']], // 100% OK
        [['P','P'],['P','A'],['J','P'],['A','R'],['P','A']], // ~61% CRÍTICO
        [['P','P'],['P','A'],['J','P'],['P','R'],['A','P']], // ~72% ALERTA
        [['P','P'],['P','P'],['R','P'],['P','J'],['P','P']], // ~94% OK
      ];
      const SEMANAS = [1, 2, 3, 4, 5];

      // Group active participants by grupo, take first 5 per group
      const byGrupo = {};
      for (const p of active) {
        if (!byGrupo[p.grupo]) byGrupo[p.grupo] = [];
        if (byGrupo[p.grupo].length < 5) byGrupo[p.grupo].push(p);
      }

      const asistenciaRows = [];
      const resumenRows = [];
      const now = nowISO();

      for (const [grupoId, sample] of Object.entries(byGrupo)) {
        for (let pi = 0; pi < sample.length; pi++) {
          const p = sample[pi];
          const pattern = PATTERNS[pi % PATTERNS.length];
          let cursadas = 0, asistidas = 0, cj = 0, cr = 0, cf = 0;

          for (let wi = 0; wi < SEMANAS.length; wi++) {
            const semana = SEMANAS[wi];
            const [tpE, seE] = pattern[wi];

            for (const [tipo, estado] of [['TP', tpE], ['SE', seE]]) {
              const pctSesion = estado === 'P' ? 100 : estado === 'R' ? 50 : 0;
              asistenciaRows.push({
                id: generateId(), rut_participante: p.rut, grupo: grupoId,
                semana: String(semana), tipo_sesion: tipo, fecha_sesion: '',
                estado, hora_evento: '', pct_sesion: String(pctSesion),
                registrado_por: auth.email, fecha_registro: now,
                editado: 'FALSE', fecha_edicion: '', editado_por: '',
              });
              if (estado === 'J') { cj++; }
              else {
                cursadas++;
                asistidas += estado === 'P' ? 1 : estado === 'R' ? 0.5 : 0;
                if (estado === 'R') cr++;
                if (estado === 'A') cf++;
              }
            }
          }

          const pct = cursadas > 0 ? Math.round((asistidas / cursadas) * 100) : 0;
          const aAs = pct < 70 ? 'CRÍTICO' : pct < 75 ? 'ALERTA' : 'OK';
          const aJ  = cj >= 3 ? 'ALERTA' : 'OK';
          const aR  = cr >= 3 ? 'ALERTA' : 'OK';
          const alertaMax = [aAs, aJ, aR].includes('CRÍTICO') ? 'CRÍTICO'
            : [aAs, aJ, aR].includes('ALERTA') ? 'ALERTA' : 'OK';

          resumenRows.push({
            rut: p.rut, grupo: grupoId, pct_asistencia: String(pct),
            sesiones_cursadas: String(cursadas), sesiones_asistidas: String(asistidas),
            contador_j: String(cj), contador_r: String(cr), contador_a: String(cf),
            alerta_asistencia: aAs, alerta_justificaciones: aJ, alerta_retiros: aR,
            alerta_logro: 'OK', alerta_moodle: 'OK', alerta_max: alertaMax,
            ultima_sesion_registrada: '5', fecha_ultimo_registro: now,
            logro_promedio: '', evaluaciones_bajo_umbral: '0',
          });
        }
      }

      setProgress(`Escribiendo ${asistenciaRows.length} registros de asistencia…`);
      await batchWrite('ASISTENCIA', asistenciaRows);
      setProgress('Actualizando resumen de participantes…');
      await clearAndWriteSheet('RESUMEN_PARTICIPANTE', resumenRows);
      await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'SEED_TPSE', entidad: 'ASISTENCIA', grupo: '', semana: '', detalle: `${asistenciaRows.length} registros en ${Object.keys(byGrupo).length} grupos`, ip: '' });
      setProgress('');
      setSeedTPSEDone(true);
    } catch (err) {
      setSeedTPSEError('Error: ' + err.message);
      setProgress('');
    } finally {
      setSeedingTPSE(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Backup y exportación" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto max-w-xl">

        {/* Backup */}
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-verde)' }}>
              <Database size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Backup completo</h2>
              <p className="text-sm text-gray-500">Descarga todas las hojas del sistema como archivo Excel</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Hojas incluidas:</p>
            <div className="flex flex-wrap gap-1">
              {ALL_SHEETS.map(s => <span key={s} className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono">{s}</span>)}
            </div>
          </div>
          {progress && !resetting && <p className="text-sm text-gray-500">{progress}</p>}
          {done && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              <span className="text-sm">Backup descargado correctamente</span>
            </div>
          )}
          <button onClick={handleBackup} disabled={loading}
            className="flex items-center gap-2 self-start px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--color-verde)' }}>
            <Download size={16} />
            {loading ? 'Generando backup…' : 'Descargar backup Excel'}
          </button>
        </div>

        {/* Reset demo */}
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4 border border-red-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Resetear datos</h2>
              <p className="text-sm text-gray-500">Borra todos los datos operativos para cargar datos reales</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-semibold mb-0.5">Esta acción no se puede deshacer</p>
              <p>Se borrarán las hojas: <span className="font-mono">{DATA_SHEETS.join(', ')}</span>.</p>
              <p className="mt-1">Se conservan: CONFIGURACION, CALENDARIO, USUARIOS y PARTICIPANTES.</p>
            </div>
          </div>

          {progress && resetting && <p className="text-sm text-gray-500">{progress}</p>}
          {resetError && <p className="text-sm text-red-600">{resetError}</p>}
          {resetDone && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              <span className="text-sm">Datos reseteados. Ya puedes cargar datos reales.</span>
            </div>
          )}

          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} disabled={resetting}
              className="flex items-center gap-2 self-start px-5 py-2.5 rounded-xl text-red-700 border-2 border-red-300 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40">
              <Trash2 size={15} />
              Resetear datos demo
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-red-700">¿Confirmas el borrado de todos los datos?</p>
              <div className="flex gap-2">
                <button onClick={handleReset} disabled={resetting}
                  className="px-5 py-2 rounded-xl text-white text-sm font-medium bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center gap-2">
                  <Trash2 size={14} />
                  {resetting ? 'Limpiando…' : 'Sí, borrar todo'}
                </button>
                <button onClick={() => setConfirmReset(false)} disabled={resetting}
                  className="px-5 py-2 rounded-xl text-gray-600 border border-gray-200 text-sm hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Dedup participants */}
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4 border border-yellow-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-50">
              <ShieldCheck size={18} className="text-yellow-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Limpiar duplicados de nómina</h2>
              <p className="text-sm text-gray-500">Elimina filas duplicadas en PARTICIPANTES conservando la primera ocurrencia de cada RUT</p>
            </div>
          </div>
          {progress && deduping && <p className="text-sm text-gray-500">{progress}</p>}
          {dedupError && <p className="text-sm text-red-600">{dedupError}</p>}
          {dedupResult && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              <span className="text-sm">
                {dedupResult.removed === 0
                  ? `Sin duplicados — ${dedupResult.kept} participantes únicos.`
                  : `${dedupResult.removed} duplicado${dedupResult.removed > 1 ? 's' : ''} eliminado${dedupResult.removed > 1 ? 's' : ''}. Quedan ${dedupResult.kept} participantes únicos.`}
              </span>
            </div>
          )}
          <button onClick={handleDedup} disabled={deduping}
            className="flex items-center gap-2 self-start px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40"
            style={{ background: '#ca8a04' }}>
            <ShieldCheck size={15} />
            {deduping ? 'Limpiando…' : 'Limpiar duplicados'}
          </button>
        </div>

        {/* Restaurar ASISTENCIA desde backup */}
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
              <Upload size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Restaurar ASISTENCIA desde backup</h2>
              <p className="text-sm text-gray-500">Sube el archivo Excel de backup para recuperar la hoja ASISTENCIA</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Esto reemplaza <strong>todos</strong> los registros actuales de ASISTENCIA con los del archivo seleccionado.</p>
          </div>
          {progress && restoring && <p className="text-sm text-gray-500">{progress}</p>}
          {restoreError && <p className="text-sm text-red-600">{restoreError}</p>}
          {restoreResult && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              <span className="text-sm">{restoreResult} registros restaurados correctamente.</span>
            </div>
          )}
          <label className={`flex items-center gap-2 self-start px-5 py-2.5 rounded-xl text-white text-sm font-medium cursor-pointer ${restoring ? 'opacity-40 pointer-events-none' : ''}`}
            style={{ background: '#2563eb' }}>
            <Upload size={15} />
            {restoring ? 'Restaurando…' : 'Seleccionar archivo backup…'}
            <input type="file" accept=".xlsx" className="hidden" onChange={handleRestoreAsistencia} disabled={restoring} />
          </label>
        </div>

        {/* Migrar nomenclatura estados */}
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4 border border-orange-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-50">
              <RefreshCw size={18} className="text-orange-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Migrar nomenclatura de asistencia</h2>
              <p className="text-sm text-gray-500">Convierte registros con estados anteriores: A→P (Presente) y F→A (Ausente)</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Haz un <strong>backup completo</strong> antes de ejecutar. Esta acción reescribe la hoja ASISTENCIA.</p>
          </div>
          {progress && migrating && <p className="text-sm text-gray-500">{progress}</p>}
          {migrateError && <p className="text-sm text-red-600">{migrateError}</p>}
          {migrateResult && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              <span className="text-sm">
                {migrateResult.convertidos === 0
                  ? `Sin registros que migrar — ${migrateResult.total} filas ya usan la nueva nomenclatura.`
                  : `${migrateResult.convertidos} registros convertidos de ${migrateResult.total} totales.`}
              </span>
            </div>
          )}
          <button onClick={handleMigrateEstados} disabled={migrating}
            className="flex items-center gap-2 self-start px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40"
            style={{ background: '#ea580c' }}>
            <RefreshCw size={15} />
            {migrating ? 'Migrando…' : 'Migrar A→P / F→A'}
          </button>
        </div>

        {/* Seed TP/SE */}
        <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-4 border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-100">
              <FlaskConical size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Cargar datos demo TP/SE</h2>
              <p className="text-sm text-gray-500">Inserta asistencia de prueba (5 semanas, TP y SE) para todos los grupos</p>
            </div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-700">
            <p className="font-semibold mb-1">Qué hace:</p>
            <ul className="list-disc list-inside flex flex-col gap-0.5">
              <li>Lee los participantes activos de la nómina</li>
              <li>Escribe 10 sesiones (5 sem × TP + SE) por participante con estados variados</li>
              <li>Genera participantes con niveles <strong>OK</strong>, <strong>ALERTA</strong> y <strong>CRÍTICO</strong></li>
              <li>Actualiza RESUMEN_PARTICIPANTE con porcentajes y alertas calculadas</li>
            </ul>
          </div>
          {progress && seedingTPSE && <p className="text-sm text-gray-500">{progress}</p>}
          {seedTPSEError && <p className="text-sm text-red-600">{seedTPSEError}</p>}
          {seedTPSEDone && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={16} />
              <span className="text-sm">Datos TP/SE cargados. Abre la Grilla histórica para verificar.</span>
            </div>
          )}
          <button onClick={handleSeedTPSE} disabled={seedingTPSE}
            className="flex items-center gap-2 self-start px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40"
            style={{ background: '#4f46e5' }}>
            <FlaskConical size={15} />
            {seedingTPSE ? 'Cargando…' : 'Cargar datos demo TP/SE'}
          </button>
        </div>

      </div>
    </div>
  );
}
