import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import { readSheet, writeRow } from '../../lib/sheetsApi.js';
import { exportToExcel } from '../../lib/csvProcessor.js';
import { generateId, nowISO } from '../../lib/utils.js';
import { Database, Download, CheckCircle } from 'lucide-react';

const SHEETS = ['CONFIGURACION', 'CALENDARIO', 'USUARIOS', 'PARTICIPANTES', 'ASISTENCIA', 'RESUMEN_PARTICIPANTE', 'NOVEDADES', 'MOODLE_SEMANAL', 'LOG', 'EVALUACIONES'];

export default function Backup() {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState('');

  async function handleBackup() {
    setLoading(true);
    setDone(false);
    try {
      const sheetData = {};
      for (const sheet of SHEETS) {
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

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Backup y exportación" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto max-w-xl">
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
              {SHEETS.map(s => <span key={s} className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono">{s}</span>)}
            </div>
          </div>
          {progress && <p className="text-sm text-gray-500">{progress}</p>}
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
      </div>
    </div>
  );
}
