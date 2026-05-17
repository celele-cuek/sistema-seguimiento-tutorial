export default function RoleBadge({ role }) {
  const styles = {
    TUTOR:     'bg-[var(--color-verde)]  text-white',
    COORD:     'bg-[var(--color-menta)]  text-[var(--color-oscuro)]',
    ADMIN:     'bg-[var(--color-ocre)]   text-white',
    ASISTENTE: 'bg-[var(--color-azul)]   text-white',
  };
  const labels = { TUTOR: 'Tutor/a', COORD: 'Coordinación', ADMIN: 'Admin', ASISTENTE: 'Asistente' };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[role] || 'bg-gray-200 text-gray-700'}`}>
      {labels[role] || role}
    </span>
  );
}
