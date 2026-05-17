import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import { readSheet, writeRow, clearAndWriteSheet } from '../../lib/sheetsApi.js';
import { exportToExcel } from '../../lib/csvProcessor.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Database, Download, CheckCircle, Trash2, AlertTriangle } from 'lucide-react';

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
      </div>
    </div>
  );
}
