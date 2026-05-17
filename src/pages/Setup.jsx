import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useConfig } from '../contexts/ConfigContext.jsx';
import { initSheet, writeRow, batchWrite, readSheet, updateRow } from '../lib/sheetsApi.js';
import { USUARIOS_SEED, CONFIG_SEED, SHEET_HEADERS } from '../lib/seedData.js';
import { generateId, nowISO } from '../lib/utils.js';
import { CheckCircle, Circle, ChevronRight, Database, Users, Settings, BookOpen, Bell } from 'lucide-react';

const STEPS = [
  { id: 'sheets', label: 'Inicializar hojas', icon: Database, desc: 'Crea las cabeceras en todas las hojas del libro de Sheets' },
  { id: 'config', label: 'Configuración del curso', icon: Settings, desc: 'Escribe los datos del curso en la hoja CONFIGURACION' },
  { id: 'usuarios', label: 'Cargar usuarios', icon: Users, desc: 'Carga los 18 usuarios del equipo en la hoja USUARIOS' },
  { id: 'participantes', label: 'Nómina de participantes', icon: BookOpen, desc: 'Importa la nómina de participantes (o carga datos piloto)' },
  { id: 'umbrales', label: 'Verificar umbrales', icon: Bell, desc: 'Confirma los umbrales de alerta y marca el setup como completo' },
];

export default function Setup() {
  const { auth } = useAuth();
  const { config, updateConfig, reloadConfig } = useConfig();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState({});
  const [loading, setLoading] = useState(null);
  const [errors, setErrors] = useState({});
  const [activeStep, setActiveStep] = useState(0);

  async function runStep(stepId) {
    setLoading(stepId);
    setErrors(e => ({ ...e, [stepId]: null }));
    try {
      if (stepId === 'sheets') await initSheets();
      if (stepId === 'config') await writeConfig();
      if (stepId === 'usuarios') await writeUsuarios();
      if (stepId === 'participantes') { navigate('/admin/nomina'); return; }
      if (stepId === 'umbrales') await markSetupComplete();
      setCompleted(c => ({ ...c, [stepId]: true }));
      if (stepId !== 'umbrales') setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1));
    } catch (err) {
      setErrors(e => ({ ...e, [stepId]: err.message }));
    } finally {
      setLoading(null);
    }
  }

  async function initSheets() {
    for (const [sheet, headers] of Object.entries(SHEET_HEADERS)) {
      await initSheet(sheet, headers);
    }
  }

  async function writeConfig() {
    const rows = await readSheet('CONFIGURACION');
    const row = { ...CONFIG_SEED, setup_completo: 'FALSE' };
    if (rows.length) await updateRow('CONFIGURACION', rows[0]._rowIndex, row);
    else await writeRow('CONFIGURACION', row);
  }

  async function writeUsuarios() {
    await batchWrite('USUARIOS', USUARIOS_SEED.map(u => ({
      ...u,
      activo: u.activo ? 'TRUE' : 'FALSE',
      fecha_creacion: nowISO().split('T')[0],
    })));
  }

  async function markSetupComplete() {
    const rows = await readSheet('CONFIGURACION');
    if (rows.length) {
      await updateRow('CONFIGURACION', rows[0]._rowIndex, { ...rows[0], setup_completo: 'TRUE' });
    }
    await writeRow('LOG', { id: generateId(), datetime: nowISO(), usuario: auth.email, rol_activo: 'ADMIN', accion: 'EDITAR_CONFIG', entidad: 'CONFIGURACION', grupo: '', semana: '', detalle: 'Setup inicial completado', ip: '' });
    updateConfig({ setup_completo: true });
    setTimeout(() => navigate('/tutor/dashboard'), 1500);
  }

  const allDone = STEPS.every(s => completed[s.id]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-fondo)' }}>
      <div className="max-w-2xl mx-auto w-full px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--color-verde)' }}>SST</div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Configuración inicial del sistema</h1>
              <p className="text-sm text-gray-500">Completa estos pasos en orden antes de operar con tutores</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(Object.keys(completed).length / STEPS.length) * 100}%`, background: 'var(--color-verde)' }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{Object.keys(completed).length} de {STEPS.length} pasos completados</p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3">
          {STEPS.map((step, i) => {
            const isDone = completed[step.id];
            const isActive = i === activeStep && !isDone;
            const isLocked = i > activeStep && !Object.values(completed).every((v, j) => j < i ? v : true);
            const Icon = step.icon;
            const err = errors[step.id];
            return (
              <div key={step.id} className={`bg-white rounded-xl shadow-sm border-2 transition-all ${isDone ? 'border-green-200' : isActive ? 'border-[var(--color-verde)]' : 'border-transparent'}`}>
                <div className="p-4 flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDone ? 'bg-green-100' : isActive ? 'bg-[var(--color-verde)]' : 'bg-gray-100'}`}>
                    {isDone
                      ? <CheckCircle size={20} className="text-green-600" />
                      : <Icon size={20} className={isActive ? 'text-white' : 'text-gray-400'} />
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold ${isDone ? 'text-green-700' : isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                        {i + 1}. {step.label}
                      </h3>
                      {isDone && <span className="text-xs text-green-600 font-medium">Completado</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                    {err && <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">{err}</p>}
                    {(isActive || isDone) && !isDone && (
                      <button
                        onClick={() => runStep(step.id)}
                        disabled={loading === step.id}
                        className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                        style={{ background: 'var(--color-verde)' }}
                      >
                        {loading === step.id
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Ejecutando…</>
                          : <><ChevronRight size={14} /> {step.id === 'participantes' ? 'Ir a importación' : 'Ejecutar paso'}</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {allDone && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
            <p className="font-semibold text-green-800">¡Setup completado!</p>
            <p className="text-sm text-green-600">Redirigiendo al sistema…</p>
          </div>
        )}
      </div>
    </div>
  );
}
