import Badge from './Badge.jsx';

export default function AlertItem({ nivel, participante, grupo, descripcion, accion, onAction }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:shadow-sm transition-shadow">
      <Badge nivel={nivel} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-800 truncate">{participante}</span>
          {grupo && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{grupo}</span>}
        </div>
        {descripcion && <p className="text-xs text-gray-500 mt-0.5">{descripcion}</p>}
      </div>
      {accion && (
        <button
          onClick={onAction}
          className="shrink-0 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
          style={{ background: 'var(--color-verde)', color: 'white' }}
        >
          {accion}
        </button>
      )}
    </div>
  );
}
