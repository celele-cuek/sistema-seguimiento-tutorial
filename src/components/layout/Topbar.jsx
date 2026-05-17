import { useAuth } from '../../contexts/AuthContext.jsx';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import RoleBadge from './RoleBadge.jsx';
import { Calendar, RefreshCw } from 'lucide-react';

export default function Topbar({ title, actions }) {
  const { auth } = useAuth();
  const { config } = useConfig();

  const currentWeek = config ? getCurrentWeek(config.fecha_inicio, config.total_semanas) : null;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-30">
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
