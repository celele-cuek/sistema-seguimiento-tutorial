import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generatePDF(elementId, fileName = 'informe.pdf') {
  const el = document.getElementById(elementId);
  if (!el) throw new Error('Elemento no encontrado: ' + elementId);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let yPos = 10;
  let heightLeft = imgHeight;

  pdf.addImage(imgData, 'PNG', 10, yPos, imgWidth, imgHeight);
  heightLeft -= pageHeight - 20;

  while (heightLeft > 0) {
    yPos = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 10, yPos, imgWidth, imgHeight);
    heightLeft -= pageHeight - 20;
  }

  pdf.save(fileName);
}

export function generateInformeText(data, config) {
  const { grupos, resumen, semanaInicio, semanaFin, alcance } = data;
  const conclusiones = [];
  const isGrupo = alcance === 'grupo';

  const criticos = resumen.filter(r => r.alerta_max === 'CRÍTICO');
  const enAlerta = resumen.filter(r => r.alerta_max === 'ALERTA');

  // pct_asistencia is stored as 0-1 fraction; normalize to 0-100 for display and comparison
  const normPct = v => { const n = Number(v) || 0; return n > 1 ? n : n * 100; };
  const pctGlobal = resumen.length
    ? resumen.reduce((s, r) => s + normPct(r.pct_asistencia), 0) / resumen.length
    : null;

  const umbralCrit = config.umbral_critico || 70;
  const umbralAlert = config.umbral_alerta || 75;
  const scope = isGrupo ? 'del grupo' : 'global';

  if (pctGlobal === null) {
    conclusiones.push(`Sin datos de asistencia registrados para el período seleccionado.`);
  } else if (pctGlobal <= umbralCrit) {
    conclusiones.push(`La asistencia promedio ${scope} (${Math.round(pctGlobal)}%) está por debajo del umbral crítico (${umbralCrit}%). Se requiere intervención inmediata.`);
  } else if (pctGlobal <= umbralAlert) {
    conclusiones.push(`La asistencia promedio ${scope} (${Math.round(pctGlobal)}%) está en zona de alerta. Monitorear de cerca.`);
  } else {
    conclusiones.push(`La asistencia promedio ${scope} es ${Math.round(pctGlobal)}%, por sobre los umbrales de alerta.`);
  }

  if (criticos.length > 0) {
    conclusiones.push(`${criticos.length} participante(s) se encuentran en situación crítica y requieren contacto urgente.`);
  }
  if (enAlerta.length > 0) {
    conclusiones.push(`${enAlerta.length} participante(s) están en zona de alerta. Se recomienda seguimiento proactivo.`);
  }

  if (!isGrupo) {
    const tutoresConMuchosCarga = grupos.reduce((acc, g) => {
      const key = g.tutor_correo;
      acc[key] = acc[key] || { nombre: g.tutor_nombre, count: 0 };
      acc[key].count++;
      return acc;
    }, {});
    Object.values(tutoresConMuchosCarga).forEach(({ nombre, count }) => {
      if (count >= 4) {
        conclusiones.push(`Riesgo operacional: ${nombre} tiene ${count} grupos asignados. Evaluar redistribución de carga.`);
      }
    });
  }

  return conclusiones;
}
