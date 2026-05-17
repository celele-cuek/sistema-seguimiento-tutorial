import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import RoleBadge from './RoleBadge.jsx';
import { Calendar, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Topbar({ title, actions }) {
  const { auth } = useAuth();
  const { config } = useConfig();
  const navigate = useNavigate();

  const currentWeek = config ? getCurrentWeek(config.fecha_inicio, config.total_semanas) : null;
  const needsSetup = config !== null && !config?.setup_completo;

  return (
    <div className="sticky top-0 z-30 flex flex-col">
      {needsSetup && auth?.roles?.includes('ADMIN') && (
        <div
          className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm cursor-pointer hover:bg-amber-600 transition-colors"
          onClick={() => navigate('/setup')}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={14} />
            {auth.bootstrap
              ? 'Sistema sin inicializar — las hojas de Sheets están vacías. Haz clic para ejecutar el Setup inicial.'
              : 'Setup pendiente — el sistema aún no está completamente configurado. Haz clic para continuar.'}
          </span>
          <span className="shrink-0 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs font-semibold">
            Ir a Setup →
          </span>
        </div>
      )}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <h1 className="text-base font-semibold text-gray-800 truncate">{title}</h1>
        <div className="flex items-center gap-3 shrink-0">
          {currentWeek && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg">
              <Calendar size={12} />
              <span>Semana {currentWeek} de {config?.total_semanas}</span>
            </div>
          )}
          {auth?.roles?.map(role => (
            <RoleBadge key={role} role={role} />
          ))}
          {actions}
        </div>
      </header>
    </div>
  );
}

function getCurrentWeek(fechaInicio, totalSemanas) {
  if (!fechaInicio) return null;
  const start = new Date(fechaInicio);
  const now = new Date();
  const diffMs = now - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.ceil((diffDays + 1) / 7);
  return Math.min(Math.max(week, 1), totalSemanas || 12);
}
