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
  const { grupos, participantes, resumen, semanaInicio, semanaFin } = data;
  const conclusiones = [];

  const criticos = participantes.filter(p => p.alerta_max === 'CRÍTICO');
  const enAlerta = participantes.filter(p => p.alerta_max === 'ALERTA');
  const pctGlobal = participantes.reduce((s, p) => s + (Number(p.pct_asistencia) || 0), 0) / (participantes.length || 1);

  if (pctGlobal < config.umbral_critico / 100) {
    conclusiones.push(`La asistencia promedio global (${Math.round(pctGlobal * 100)}%) está por debajo del umbral crítico (${config.umbral_critico}%). Se requiere intervención inmediata.`);
  } else if (pctGlobal < config.umbral_alerta / 100) {
    conclusiones.push(`La asistencia promedio global (${Math.round(pctGlobal * 100)}%) está en zona de alerta. Monitorear de cerca.`);
  } else {
    conclusiones.push(`La asistencia promedio global es ${Math.round(pctGlobal * 100)}%, por sobre los umbrales de alerta.`);
  }

  if (criticos.length > 0) {
    conclusiones.push(`${criticos.length} participante(s) se encuentran en situación crítica y requieren contacto urgente.`);
  }
  if (enAlerta.length > 0) {
    conclusiones.push(`${enAlerta.length} participante(s) están en zona de alerta. Se recomienda seguimiento proactivo.`);
  }

  const santiagoCarga = grupos.filter(g => g.tutor_correo === 'santiago.scabezas@gmail.com');
  if (santiagoCarga.length >= 4) {
    conclusiones.push(`Riesgo operacional: Santiago Cabezas tiene ${santiagoCarga.length} grupos asignados. Evaluar redistribución de carga.`);
  }

  return conclusiones;
}
