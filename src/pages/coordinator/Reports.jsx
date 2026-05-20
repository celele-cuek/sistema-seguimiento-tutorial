import { useState } from 'react';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { generatePDF, generateInformeText } from '../../lib/pdfGenerator.js';
import { pctDisplay, formatDate, todayISO } from '../../lib/utils.js';
import { GRUPOS_SEED, USUARIOS_SEED } from '../../lib/seedData.js';
import * as XLSX from 'xlsx';
import { FileText, Download, HelpCircle, FileSpreadsheet } from 'lucide-react';

export default function Reports() {
  const { config } = useConfig();
  const [tipo, setTipo] = useState('final');
  const [semanaInicio, setSemanaInicio] = useState('1');
  const [semanaFin, setSemanaFin] = useState('12');
  const [alcance, setAlcance] = useState('todos');
  const [grupoSel, setGrupoSel] = useState('A01');
  const [loading, setLoading] = useState(false);
  const [loadingXls, setLoadingXls] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [conclusiones, setConclusiones] = useState([]);

  async function generatePreview() {
    setLoading(true);
    try {
      const [participantes, resumen, asistencia, novedades] = await Promise.all([
        readSheet('PARTICIPANTES'),
        readSheet('RESUMEN_PARTICIPANTE'),
        readSheet('ASISTENCIA'),
        readSheet('NOVEDADES'),
      ]);
      const filtP = alcance === 'grupo' ? participantes.filter(p => p.grupo === grupoSel) : participantes;
      const filtR = alcance === 'grupo' ? resumen.filter(r => r.grupo === grupoSel) : resumen;
      setReportData({ participantes: filtP, resumen: filtR, asistencia, novedades });
      const filtGrupos = alcance === 'grupo' ? GRUPOS_SEED.filter(g => g.id === grupoSel) : GRUPOS_SEED;
      const conc = generateInformeText({ grupos: filtGrupos, participantes: filtP, resumen: filtR, semanaInicio, semanaFin, alcance }, config || {});
      setConclusiones(conc);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleExportContactosXLS() {
    setLoadingXls(true);
    try {
      const [participantes, resumen, asistencia, logs] = await Promise.all([
        readSheet('PARTICIPANTES'),
        readSheet('RESUMEN_PARTICIPANTE'),
        readSheet('ASISTENCIA'),
        readSheet('LOG'),
      ]);

      // Mapa tutor por grupo
      const tutorPorGrupo = {};
      GRUPOS_SEED.forEach(g => { tutorPorGrupo[g.id] = g.tutor_nombre; });

      // Mapa resumen por rut
      const resumenMap = {};
      resumen.forEach(r => { resumenMap[r.rut] = r; });

      // Hoja 1: participantes CRÍTICO o ALERTA con datos de contacto
      const razones = (r) => {
        const motivos = [];
        if (r.alerta_asistencia && r.alerta_asistencia !== 'OK') motivos.push(`Asistencia ${r.alerta_asistencia} (${r.pct_asistencia}%)`);
        if (r.alerta_justificaciones === 'ALERTA') motivos.push(`Justificaciones: ${r.contador_j}`);
        if (r.alerta_retiros === 'ALERTA') motivos.push(`Retiros: ${r.contador_r}`);
        if (r.alerta_logro === 'ALERTA') motivos.push('Bajo logro');
        if (r.alerta_moodle === 'ALERTA') motivos.push('Inactivo en Moodle');
        return motivos.join(' | ');
      };

      const contactos = participantes
        .map(p => ({ p, r: resumenMap[p.rut] }))
        .filter(({ r }) => r && (r.alerta_max === 'CRÍTICO' || r.alerta_max === 'ALERTA'))
        .sort((a, b) => {
          const ord = { 'CRÍTICO': 0, 'ALERTA': 1 };
          return (ord[a.r.alerta_max] ?? 2) - (ord[b.r.alerta_max] ?? 2) || a.p.grupo.localeCompare(b.p.grupo);
        })
        .map(({ p, r }) => ({
          'Nivel':             r.alerta_max,
          'Grupo':             p.grupo,
          'Tutor/a':           tutorPorGrupo[p.grupo] || '',
          'Nombre completo':   p.nombre_completo,
          'Correo':            p.correo,
          'Teléfono':          p.telefono,
          'Contacto preferido':p.contacto_preferido,
          'Función':           p.funcion_principal,
          'Establecimiento':   p.establecimiento,
          '% Asistencia':      r.pct_asistencia ? `${r.pct_asistencia}%` : '',
          'Inasistencias':     r.contador_a,
          'Justificadas':      r.contador_j,
          'Retiros':           r.contador_r,
          'Razón(es)':         razones(r),
          'Última sesión':     r.ultima_sesion_registrada,
        }));

      // Hoja 2: estado de registro de tutores
      const tutores = USUARIOS_SEED.filter(u => u.roles.includes('TUTOR'));
      const asistPorTutor = {};
      asistencia.forEach(a => {
        const tutor = GRUPOS_SEED.find(g => g.id === a.grupo)?.tutor_correo;
        if (!tutor) return;
        if (!asistPorTutor[tutor] || a.fecha_registro > asistPorTutor[tutor].fecha_registro) {
          asistPorTutor[tutor] = a;
        }
      });

      // Para cada tutor, obtener todos sus registros de asistencia y calcular puntualidad
      const estadoTutores = tutores
        .filter((t, i, arr) => arr.findIndex(x => x.correo === t.correo) === i)
        .map(t => {
          const grupos_t = (t.grupos || '').split(',').filter(Boolean);
          const registros = asistencia.filter(a => grupos_t.includes(a.grupo) && a.registrado_por === t.correo);
          const ultReg = registros.sort((a, b) => b.fecha_registro?.localeCompare(a.fecha_registro))[0];

          let tardios = 0, aTiempo = 0;
          registros.forEach(a => {
            if (!a.fecha_sesion || !a.fecha_registro) return;
            const sesionFin = new Date(a.fecha_sesion + 'T23:59:59');
            const registro = new Date(a.fecha_registro);
            const horas = (registro - sesionFin) / 3600000;
            if (horas > 24) tardios++;
            else aTiempo++;
          });

          const estado = !ultReg ? 'Sin registros'
            : tardios > 0 ? `TARDÍO (${tardios} vez${tardios > 1 ? 'es' : ''})`
            : 'A tiempo';

          return {
            'Tutor/a':                    t.nombre_completo,
            'Correo':                     t.correo,
            'Grupos':                     t.grupos,
            'Última sesión registrada':   ultReg ? `S${ultReg.semana} ${ultReg.tipo_sesion} — ${ultReg.fecha_sesion || ''}` : '—',
            'Fecha registro':             ultReg ? ultReg.fecha_registro?.split('T')[0] : '—',
            'Registros a tiempo (≤24h)':  aTiempo,
            'Registros tardíos (>24h)':   tardios,
            'Estado puntualidad':         estado,
          };
        });

      // Construir workbook
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(contactos);
      const ws2 = XLSX.utils.json_to_sheet(estadoTutores);

      // Ancho columnas hoja 1
      ws1['!cols'] = [8,7,20,28,30,14,14,20,28,12,11,10,8,35,16].map(w => ({ wch: w }));
      ws2['!cols'] = [25,28,20,30,18,12].map(w => ({ wch: w }));

      XLSX.utils.book_append_sheet(wb, ws1, 'Contactos críticos');
      XLSX.utils.book_append_sheet(wb, ws2, 'Estado tutores');

      const fecha = todayISO();
      XLSX.writeFile(wb, `informe_contactos_${fecha}.xlsx`);
    } catch (err) { console.error(err); }
    finally { setLoadingXls(false); }
  }

  async function handleExportPDF() {
    try {
      await generatePDF('informe-preview', `informe_${alcance === 'grupo' ? grupoSel : 'completo'}_S${semanaInicio}-S${semanaFin}.pdf`);
    } catch (err) { console.error(err); }
  }

  const pctGlobal = reportData?.resumen?.length
    ? reportData.resumen.reduce((s, r) => s + (Number(r.pct_asistencia) || 0), 0) / reportData.resumen.length
    : null;

  return (
    <div className="flex-1 flex flex-col">
      <Topbar title="Informes"
        actions={
          <button onClick={handleExportContactosXLS} disabled={loadingXls}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--color-verde)' }}>
            <FileSpreadsheet size={15} />
            {loadingXls ? 'Generando…' : 'Excel contactos críticos'}
          </button>
        }
      />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 flex items-start gap-2 text-xs text-blue-700">
          <HelpCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            Genera informes de asistencia en PDF para compartir con directivos o la institución.
            Configura el período, el alcance (curso completo o grupo) y haz clic en <strong>Vista previa</strong>.
            Cuando estés conforme con el resultado, usa <strong>Exportar PDF</strong>.
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-4 max-w-xl">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><FileText size={16} />Configurar informe</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                Tipo
                <Tooltip content="Parcial: informe de avance para una o varias semanas del curso. Final: informe de cierre con toda la información del curso.">
                  <HelpCircle size={10} className="text-gray-300 cursor-help" />
                </Tooltip>
              </label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                <option value="parcial">Parcial</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                Alcance
                <Tooltip content="Curso completo: incluye todos los grupos y participantes. Grupo específico: genera el informe solo para el grupo seleccionado, útil para compartir con el tutor.">
                  <HelpCircle size={10} className="text-gray-300 cursor-help" />
                </Tooltip>
              </label>
              <select value={alcance} onChange={e => setAlcance(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                <option value="todos">Curso completo</option>
                <option value="grupo">Grupo específico</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                Semana inicio
                <Tooltip content="Primera semana del período a informar. El informe incluirá datos de asistencia desde esta semana.">
                  <HelpCircle size={10} className="text-gray-300 cursor-help" />
                </Tooltip>
              </label>
              <select value={semanaInicio} onChange={e => setSemanaInicio(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                Semana fin
                <Tooltip content="Última semana del período a informar. Para un informe final del curso, selecciona la semana máxima configurada.">
                  <HelpCircle size={10} className="text-gray-300 cursor-help" />
                </Tooltip>
              </label>
              <select value={semanaFin} onChange={e => setSemanaFin(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
            {alcance === 'grupo' && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  Grupo
                  <Tooltip content="Selecciona el grupo para el que quieres generar el informe. Se mostrará el nombre del tutor junto al ID del grupo.">
                    <HelpCircle size={10} className="text-gray-300 cursor-help" />
                  </Tooltip>
                </label>
                <select value={grupoSel} onChange={e => setGrupoSel(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                  {GRUPOS_SEED.map(g => <option key={g.id} value={g.id}>{g.id} — {g.tutor_nombre}</option>)}
                </select>
              </div>
            )}
          </div>
          <Tooltip content="Genera una vista previa del informe en pantalla. Revisa que los datos y las conclusiones sean correctos antes de exportar a PDF.">
            <button onClick={generatePreview} disabled={loading} className="self-start px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40" style={{ background: 'var(--color-verde)' }}>
              {loading ? 'Generando…' : 'Vista previa'}
            </button>
          </Tooltip>
        </div>

        {reportData && (
          <div id="informe-preview" className="bg-white rounded-xl shadow-sm p-6 flex flex-col gap-5">
            <div className="border-b border-gray-100 pb-4">
              <h1 className="text-xl font-bold text-gray-800">{config?.nombre_curso || 'Informe de Asistencia'}</h1>
              <p className="text-sm text-gray-500">{config?.institucion} · Período: Semana {semanaInicio} a {semanaFin} · {formatDate(new Date().toISOString())}</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[var(--color-verde)]">{reportData.participantes.length}</div>
                <div className="text-xs text-gray-400">Participantes</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[var(--color-verde)]">{pctGlobal !== null ? pctDisplay(pctGlobal) : '—'}</div>
                <div className="text-xs text-gray-400">Asistencia prom.</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[#7A1818]">{reportData.resumen.filter(r => r.alerta_max === 'CRÍTICO').length}</div>
                <div className="text-xs text-gray-400">Críticos</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[#7A5010]">{reportData.resumen.filter(r => r.alerta_max === 'ALERTA').length}</div>
                <div className="text-xs text-gray-400">En alerta</div>
              </div>
            </div>

            {conclusiones.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-gray-700">Conclusiones y recomendaciones</h2>
                  <Tooltip content="Texto generado automáticamente a partir de los datos. Puedes usarlo como base para el informe oficial — revisa y ajusta según corresponda.">
                    <HelpCircle size={12} className="text-gray-300 cursor-help" />
                  </Tooltip>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {conclusiones.map((c, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-[var(--color-verde)] mt-0.5">›</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {reportData && (
          <Tooltip content="Descarga el informe como archivo PDF. Se captura exactamente lo que ves en la vista previa. Asegúrate de revisar antes de descargar.">
            <button onClick={handleExportPDF} className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--color-oscuro)' }}>
              <Download size={16} />Exportar PDF
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
