import { GRUPOS_SEED } from './seedData.js';

const NOMBRES = ['Carlos Andrés','María José','Jorge Luis','Ana Cecilia','Pedro Pablo','Rosa Elena','Luis Alberto','Carmen Gloria','Rodrigo Andrés','Claudia Marcela','Felipe Ignacio','Valentina Paz','Diego Alejandro','Francisca Isabel','Sebastián Tomás'];
const APELLIDOS_P = ['Henríquez','Muñoz','González','Soto','Martínez','Rojas','Valenzuela','Fuentes','Espinoza','Castro','Morales','Ortiz','Vera','Herrera','Sandoval'];
const APELLIDOS_S = ['Mora','Pizarro','Riquelme','Araya','Bravo','Lagos','Cisternas','Contreras','Navarro','Campos','Peña','Silva','Medina','Torres','Reyes'];
const FUNCIONES = ['Director(a)','Jefe(a) de UTP','Inspector(a) General','Docente','Psicólogo(a)','Orientador(a)','Coordinador(a) Convivencia'];
const REGIONES = ['Metropolitana de Santiago','Valparaíso','Biobío','La Araucanía','Los Lagos','Maule',"O'Higgins",'Antofagasta','Coquimbo','Atacama','Tarapacá','Los Ríos','Aysén','Magallanes','Arica y Parinacota'];
const COMUNAS = ['Santiago','Valparaíso','Concepción','Temuco','Puerto Montt','Talca','Rancagua','Antofagasta','La Serena','Copiapó','Iquique','Valdivia','Coyhaique','Punta Arenas','Arica'];
const ESTABLECIMIENTOS = ['Escuela Las Araucarias','Liceo Politécnico Sur','Colegio San Agustín','Escuela Rural Maipú','Liceo Bicentenario Norte','Colegio Particular Los Andes','Escuela Básica El Roble','Liceo Técnico Profesional Centro','Colegio Municipal Las Palmas','Escuela Especial Horizonte'];
const TIPOS_ESTAB = ['ESCUELA','LICEO','COLEGIO'];
const DEPENDENCIAS = ['Municipal','Particular Subvencionado','Particular Pagado','Corporación Municipal'];

let rutCounter = 10000000;

function generateFakeRut() {
  const body = rutCounter++;
  let sum = 0;
  let mult = 2;
  let n = body;
  while (n > 0) {
    sum += (n % 10) * mult;
    n = Math.floor(n / 10);
    mult = mult === 7 ? 2 : mult + 1;
  }
  const dv = 11 - (sum % 11);
  const dvStr = dv === 11 ? '0' : dv === 10 ? 'k' : String(dv);
  return `${body}-${dvStr}`;
}

function pick(arr, idx) { return arr[idx % arr.length]; }

export function generatePilotParticipants() {
  const participants = [];
  let globalIdx = 0;

  for (const grupo of GRUPOS_SEED) {
    for (let i = 0; i < 5; i++) {
      const idx = globalIdx++;
      const nombres = pick(NOMBRES, idx);
      const primerApellido = pick(APELLIDOS_P, idx + 3);
      const segundoApellido = pick(APELLIDOS_S, idx + 7);
      const regionIdx = idx % REGIONES.length;
      const mg = `MG${(i % 5) + 1}`;

      participants.push({
        rut: generateFakeRut(),
        nombres,
        primer_apellido: primerApellido,
        segundo_apellido: segundoApellido,
        nombre_completo: `${nombres} ${primerApellido} ${segundoApellido}`,
        correo: `participante${idx + 1}@escuela-piloto.cl`,
        genero: idx % 2 === 0 ? 'Femenino' : 'Masculino',
        telefono: `569${String(90000000 + idx).slice(0, 8)}`,
        contacto_preferido: idx % 3 === 0 ? 'Email' : 'Whatsapp',
        grupo: grupo.id,
        microgrupo: mg,
        funcion_principal: pick(FUNCIONES, idx),
        establecimiento: pick(ESTABLECIMIENTOS, idx),
        tipo_establecimiento: pick(TIPOS_ESTAB, idx),
        rbd: String(10000 + idx),
        region: REGIONES[regionIdx],
        comuna: COMUNAS[regionIdx],
        dependencia: pick(DEPENDENCIAS, idx),
        estado: 'Activo',
        fecha_ingreso: '2026-03-10',
        fecha_baja: '',
        motivo_baja: '',
        notas: '',
      });
    }
  }
  return participants;
}
