import Tooltip from '../ui/Tooltip.jsx';

const STATES = {
  A: {
    label: 'A',
    color: 'bg-green-500 text-white border-green-500',
    title: 'Asistió (100%)',
    tooltip: 'Asistió — La persona participó en la sesión completa. Cuenta 100% de asistencia.',
  },
  R: {
    label: 'R',
    color: 'bg-amber-400 text-white border-amber-400',
    title: 'Retiro',
    tooltip: 'Se retiró antes del término. Ingresa la hora de retiro:\n• Retiro en 1ª hora → 0%\n• Retiro después de 1h → 50%',
  },
  J: {
    label: 'J',
    color: 'bg-blue-500  text-white border-blue-500',
    title: 'Justificado',
    tooltip: 'Ausencia justificada con documento. Cuenta 0% pero se excluye del denominador — no penaliza el promedio general.',
  },
  F: {
    label: 'F',
    color: 'bg-red-500   text-white border-red-500',
    title: 'Falta',
    tooltip: 'Falta injustificada — 0% de asistencia. Suma al denominador y baja el promedio acumulado.',
  },
};

export default function StatusButton({ state, selected, onClick, disabled = false }) {
  const s = STATES[state];
  const isSelected = selected === state;
  return (
    <Tooltip content={s.tooltip}>
      <button
        type="button"
        onClick={() => !disabled && onClick(state)}
        disabled={disabled}
        className={`w-8 h-8 rounded-lg border-2 text-xs font-bold transition-all ${
          isSelected ? s.color : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {s.label}
      </button>
    </Tooltip>
  );
}
