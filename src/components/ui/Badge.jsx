export default function Badge({ nivel, className = '' }) {
  const styles = {
    'OK':      'bg-[#E3F2EC] text-[#0A5645]',
    'ALERTA':  'bg-[#FAF0DF] text-[#7A5010]',
    'CRÍTICO': 'bg-[#FAE5E5] text-[#7A1818]',
  };
  const labels = { 'OK': 'OK', 'ALERTA': 'Alerta', 'CRÍTICO': 'Crítico' };
  const style = styles[nivel] || styles['OK'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${style} ${className}`}>
      {labels[nivel] || nivel}
    </span>
  );
}
