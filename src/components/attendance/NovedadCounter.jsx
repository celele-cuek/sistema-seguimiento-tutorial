import Tooltip from '../ui/Tooltip.jsx';
import { MessageCircle } from 'lucide-react';

export default function NovedadCounter({ count, lastNovedad }) {
  if (!count || count === 0) return null;

  const tooltipContent = (
    <div>
      <p className="font-medium mb-1">Novedades registradas: {count}</p>
      {lastNovedad && (
        <p className="opacity-80 text-xs">Última: {lastNovedad}</p>
      )}
      <p className="opacity-60 text-xs mt-1">La celda muestra solo la última. El historial completo está en Novedades.</p>
    </div>
  );

  return (
    <Tooltip content={tooltipContent}>
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full cursor-help">
        <MessageCircle size={10} />
        {count}
      </span>
    </Tooltip>
  );
}
