const STATES = {
  A: { label: 'A', color: 'bg-green-500 text-white border-green-500',   title: 'Asistió (100%)' },
  R: { label: 'R', color: 'bg-amber-400 text-white border-amber-400',   title: 'Retiro' },
  J: { label: 'J', color: 'bg-blue-500  text-white border-blue-500',    title: 'Justificado (no descuenta %)' },
  F: { label: 'F', color: 'bg-red-500   text-white border-red-500',     title: 'Falta (−100%)' },
};

export default function StatusButton({ state, selected, onClick, disabled = false }) {
  const s = STATES[state];
  const isSelected = selected === state;
  return (
    <button
      type="button"
      onClick={() => !disabled && onClick(state)}
      disabled={disabled}
      title={s.title}
      className={`w-8 h-8 rounded-lg border-2 text-xs font-bold transition-all ${
        isSelected ? s.color : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {s.label}
    </button>
  );
}
