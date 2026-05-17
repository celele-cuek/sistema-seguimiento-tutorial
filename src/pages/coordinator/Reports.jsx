import { useState } from 'react';
import { useConfig } from '../../contexts/ConfigContext.jsx';
import Topbar from '../../components/layout/Topbar.jsx';
import { readSheet } from '../../lib/sheetsApi.js';
import { generatePDF, generateInformeText } from '../../lib/pdfGenerator.js';
import { pctDisplay, formatDate } from '../../lib/utils.js';
import { GRUPOS_SEED } from '../../lib/seedData.js';
import { FileText, Download } from 'lucide-react';

export default function Reports() {
  const { config } = useConfig();
  const [tipo, setTipo] = useState('final');
  const [semanaInicio, setSemanaInicio] = useState('1');
  const [semanaFin, setSemanaFin] = useState('12');
  const [alcance, setAlcance] = useState('todos');
  const [grupoSel, setGrupoSel] = useState('A01');
  const [loading, setLoading] = useState(false);
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
      const conc = generateInformeText({ grupos: GRUPOS_SEED, participantes: filtP, resumen: filtR, semanaInicio, semanaFin }, config || {});
      setConclusiones(conc);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
      <Topbar title="Generador de informes PDF" />
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-4 max-w-xl">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><FileText size={16} />Configurar informe</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                <option value="parcial">Parcial</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Alcance</label>
              <select value={alcance} onChange={e => setAlcance(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                <option value="todos">Curso completo</option>
                <option value="grupo">Grupo específico</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Semana inicio</label>
              <select value={semanaInicio} onChange={e => setSemanaInicio(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Semana fin</label>
              <select value={semanaFin} onChange={e => setSemanaFin(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
            {alcance === 'grupo' && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Grupo</label>
                <select value={grupoSel} onChange={e => setGrupoSel(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-verde)]">
                  {GRUPOS_SEED.map(g => <option key={g.id} value={g.id}>{g.id} — {g.tutor_nombre}</option>)}
                </select>
              </div>
            )}
          </div>
          <button onClick={generatePreview} disabled={loading} className="self-start px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40" style={{ background: 'var(--color-verde)' }}>
            {loading ? 'Generando…' : 'Vista previa'}
          </button>
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
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Conclusiones y recomendaciones</h2>
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
          <button onClick={handleExportPDF} className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--color-oscuro)' }}>
            <Download size={16} />Exportar PDF
          </button>
        )}
      </div>
    </div>
  );
}
