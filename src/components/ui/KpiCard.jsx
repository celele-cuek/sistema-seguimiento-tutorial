export default function KpiCard({ label, value, sub, color = 'verde', icon, className = '' }) {
  const colors = {
    verde:   'border-l-[var(--color-verde)]  text-[var(--color-verde)]',
    azul:    'border-l-[var(--color-azul)]   text-[var(--color-azul)]',
    menta:   'border-l-[var(--color-menta)]  text-[var(--color-menta)]',
    ocre:    'border-l-[var(--color-ocre)]   text-[var(--color-ocre)]',
    critico: 'border-l-[#7A1818]             text-[#7A1818]',
    alerta:  'border-l-[#7A5010]             text-[#7A5010]',
  };
  const accent = colors[color] || colors.verde;

  return (
    <div className={`bg-white rounded-xl border-l-4 ${accent} shadow-sm p-4 flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <span className={`text-3xl font-bold ${accent.split(' ')[1]}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}
