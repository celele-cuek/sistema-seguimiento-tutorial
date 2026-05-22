#!/usr/bin/env bash
# =============================================================================
# recuperar.sh — Restaura el proyecto SST y la memoria de Claude Code
# Uso: bash recuperar.sh
# =============================================================================
set -e

REPO="https://github.com/celele-cuek/sistema-seguimiento-tutorial.git"
DESTINO="$HOME/sistema-seguimiento-tutorial"
MEMORY_DIR="$HOME/.claude/projects/-home-cesar/memory"

VERDE="\033[0;32m"
AMARILLO="\033[1;33m"
ROJO="\033[0;31m"
RESET="\033[0m"

ok()   { echo -e "${VERDE}✓ $1${RESET}"; }
info() { echo -e "${AMARILLO}→ $1${RESET}"; }
err()  { echo -e "${ROJO}✗ $1${RESET}"; exit 1; }

echo ""
echo "============================================="
echo "  Recuperación del proyecto SST"
echo "============================================="
echo ""

# --- 1. Verificar dependencias ---
info "Verificando dependencias..."
command -v git  >/dev/null 2>&1 || err "git no está instalado. Instálalo con: sudo apt install git"
command -v node >/dev/null 2>&1 || err "node no está instalado. Instálalo desde https://nodejs.org"
command -v npm  >/dev/null 2>&1 || err "npm no está instalado."
ok "git, node y npm disponibles"

# --- 2. Credenciales del .env ---
echo ""
info "Ingresa las credenciales del sistema (están guardadas en tu respaldo):"
echo ""
read -rp "  VITE_GOOGLE_CLIENT_ID: " CLIENT_ID
read -rp "  VITE_SHEETS_ID:        " SHEETS_ID

[[ -z "$CLIENT_ID" ]] && err "VITE_GOOGLE_CLIENT_ID no puede estar vacío"
[[ -z "$SHEETS_ID" ]] && err "VITE_SHEETS_ID no puede estar vacío"

# --- 3. Clonar repositorio ---
echo ""
info "Clonando repositorio..."
if [[ -d "$DESTINO" ]]; then
  info "La carpeta $DESTINO ya existe — actualizando con git pull..."
  git -C "$DESTINO" pull
else
  git clone "$REPO" "$DESTINO"
fi
ok "Repositorio listo en $DESTINO"

# --- 4. Crear .env ---
info "Creando archivo .env..."
cat > "$DESTINO/.env" <<ENV
VITE_GOOGLE_CLIENT_ID=$CLIENT_ID
VITE_SHEETS_ID=$SHEETS_ID
ENV
ok ".env creado"

# --- 5. Instalar dependencias ---
info "Instalando dependencias npm..."
npm --prefix "$DESTINO" install --silent
ok "Dependencias instaladas"

# --- 6. Verificar build ---
info "Verificando build..."
npm --prefix "$DESTINO" run build --silent
ok "Build exitoso"

# --- 7. Recrear memoria de Claude Code ---
echo ""
info "Recreando memoria de Claude Code..."
mkdir -p "$MEMORY_DIR"

# MEMORY.md (índice)
cat > "$MEMORY_DIR/MEMORY.md" <<'EOF'
# Memory Index

- [Proyecto SST — stack y arquitectura](project_sst.md) — React+Vite, Google Sheets como BD, GitHub Pages, deploy automático
- [Roles del sistema](project_sst_roles.md) — ADMIN/COORD/TUTOR/ASISTENTE y sus permisos
- [Convenciones Sheets API](project_sst_sheets.md) — siempre RAW, nunca USER_ENTERED; rango limpieza A2:Z100000
- [Funcionalidades implementadas](project_sst_features.md) — módulos, regla 24h, selector de aula para admin
- [Perfil César Leal](user_cesar.md) — coordinador CPEIP, prefiere respuestas directas sin jerga
- [Idioma preferido](feedback_idioma.md) — español de Chile, no argentino (tú/puedes, no vos/podés)
EOF

# project_sst.md
cat > "$MEMORY_DIR/project_sst.md" <<'EOF'
---
name: project-sst
description: "Sistema de Seguimiento Tutorial — stack, arquitectura, deploy, Google Sheets como BD"
metadata:
  type: project
---

Proyecto: Sistema de Seguimiento Tutorial (SST) para CPEIP / U. de Chile.

Repo GitHub: https://github.com/celele-cuek/sistema-seguimiento-tutorial
Deploy: GitHub Pages en https://celele-cuek.github.io/sistema-seguimiento-tutorial
Directorio local: /home/cesar/sistema-seguimiento-tutorial

Stack: React 18 + Vite, Tailwind CSS, React Router, Recharts, SheetJS (XLSX), Lucide icons.
Base de datos: Google Sheets (ID: 1RfOym4uAXD89z6l2sRM7NCEFqUNl4TYbVW50_3F_Ohs) vía Sheets API v4.
Auth: Google OAuth 2.0 token client (scope: spreadsheets + openid + profile). App publicada (no en modo prueba).
Deploy: GitHub Actions → gh-pages branch automáticamente al hacer push a main.

**Why:** No hay backend — todo es frontend puro sobre Google Sheets como BD. El .env tiene VITE_GOOGLE_CLIENT_ID y VITE_SHEETS_ID (no está en git, debe copiarse manualmente).

**How to apply:** Al hacer cambios, siempre `npm run build` para verificar antes de commit. Push a main dispara el deploy automáticamente.
EOF

# project_sst_roles.md
cat > "$MEMORY_DIR/project_sst_roles.md" <<'EOF'
---
name: project-sst-roles
description: Roles del sistema SST y qué puede hacer cada uno
metadata:
  type: project
---

Roles: ADMIN, COORD, TUTOR, ASISTENTE.

ADMIN: acceso total. Puede configurar el sistema, gestionar usuarios, importar nómina, ver todo.
COORD: panel general, alertas, nómina, equipo tutores, informes, fichas de participantes, vistas de tutor.
TUTOR: su propio tablero, registro de asistencia, grilla histórica, novedades, carga Moodle.
ASISTENTE (ej. Catalina Zelada catalinazelada@gmail.com): igual que COORD excepto registro de asistencia. Su tarea principal es cargar datos Moodle y contactar participantes con alertas.

Sidebar muestra sección "Mi aula" para TUTOR/ADMIN/COORD, y sección "Coordinación" para COORD/ADMIN/ASISTENTE.
ADMIN tiene selector de tutor en el sidebar para ver cualquier aula.

**Why:** ASISTENTE se agregó para los asistentes de coordinación que contactan participantes con inasistencias.
EOF

# project_sst_sheets.md
cat > "$MEMORY_DIR/project_sst_sheets.md" <<'EOF'
---
name: project-sst-sheets
description: Convenciones críticas de la API de Sheets en el SST — RAW vs USER_ENTERED
metadata:
  type: project
---

Todas las escrituras a Sheets usan valueInputOption=RAW (nunca USER_ENTERED).

**Why:** USER_ENTERED interpreta RUTs con guión (ej. 16526901-2) como resta aritmética, corrompiendo el valor. También convierte 'TRUE'/'FALSE' a booleanos con formato dependiente del locale (español → VERDADERO/FALSO).

Funciones afectadas en sheetsApi.js: batchWrite, clearAndWriteSheet, writeRow, updateRow — todas usan RAW.

Rango de limpieza: A2:Z100000 (con fila final explícita). Sin fila final el clear puede fallar silenciosamente.

El filtro de activo en AuthContext maneja múltiples formatos: 'FALSE', false, 'FALSO', 'false' → todos se tratan como inactivo.

**How to apply:** Si se agrega alguna función nueva de escritura a Sheets, usar RAW siempre.
EOF

# project_sst_features.md
cat > "$MEMORY_DIR/project_sst_features.md" <<'EOF'
---
name: project-sst-features
description: Funcionalidades implementadas en el SST — qué hace cada módulo
metadata:
  type: project
---

Módulos implementados:

- Registro de asistencia (tutor): selector de fecha de sesión, regla 24h (aviso si la fecha es >24h atrás, queda marcado como tardío en ASISTENCIA.fecha_registro).
- Grilla histórica: vista por semana/grupo de toda la asistencia registrada.
- Novedades: registro de situaciones por participante (retiros, ausencias, derivaciones).
- Carga Moodle: importa CSV/Excel de Moodle para actualizar datos de asistencia.
- Panel coordinación: KPIs globales, alertas críticas, estado por grupo.
- Equipo tutores: estado de actividad de cada tutor + columna Puntualidad 24h (tardíos vs a tiempo).
- Informes: descarga Excel con dos hojas — "Contactos críticos" (participantes CRÍTICO/ALERTA con datos de contacto) y "Estado tutores" (puntualidad de registro).
- NominaImport: carga masiva de participantes con botón "Reemplazar nómina completa" (clearAndWriteSheet + confirmación).
- UsersManager: gestión de usuarios del sistema con dedup y desactivación.
- Admin selector de aula: ADMIN puede seleccionar cualquier tutor en el sidebar y ver su aula (ViewAsContext.viewAsTutor).
- ImportAttendance: importa planillas Excel de asistencia por grupo (un archivo por grupo o archivo multihojas con todos los grupos). Recalcula RESUMEN_PARTICIPANTE automáticamente tras importar.
- Backup/Recalcular: botón "Recalcular RESUMEN_PARTICIPANTE" en Admin → Backup para datos ya importados.

Nomenclatura estados de asistencia (vigente desde 2026-05-19): P=Presente, A=Ausente, R=Retiro, J=Justificado. Antes era A=Asistió, F=Falta.

Regla 24h: fecha_sesion (fecha real de la sesión, elegida por el tutor) vs fecha_registro (datetime del guardado). Si la diferencia > 24h → tardío.

pct_asistencia se almacena como fracción 0-1 en RESUMEN_PARTICIPANTE. Los umbrales (umbral_critico, umbral_alerta) son enteros 0-100. Normalizar con: n > 1 ? n : n * 100 antes de comparar.

**How to apply:** Al agregar funcionalidades, respetar la convención RAW de sheetsApi y recalcular RESUMEN_PARTICIPANTE cuando se modifican datos de asistencia.
EOF

# user_cesar.md
cat > "$MEMORY_DIR/user_cesar.md" <<'EOF'
---
name: user-cesar
description: "Perfil del usuario — César Leal, coordinador del programa de tutorías CPEIP"
metadata:
  type: user
---

César Leal (cesar.leal@gmail.com). Coordinador del programa de tutorías CPEIP / Universidad de Chile.

No es desarrollador de profesión — trabaja con código pero necesita explicaciones claras sin jerga excesiva. Prefiere respuestas cortas y directas. Toma decisiones de diseño pragmáticas (ej. prefirió cargar participantes vía web UI en vez de scripts Python cuando el script falló por OAuth).

Contexto del proyecto: gestiona ~400 participantes en 16 grupos, con tutores, asistentes de coordinación y coordinadores como usuarios del sistema.
EOF

# feedback_idioma.md
cat > "$MEMORY_DIR/feedback_idioma.md" <<'EOF'
---
name: feedback_idioma
description: "Escribir en español de Chile, no en argentino"
metadata:
  type: feedback
---

Usar español de Chile en todas las respuestas. No usar construcciones del español rioplatense.

**Why:** El usuario lo indicó explícitamente — es chileno y prefiere el registro local.

**How to apply:** Usar "tú/puedes/tienes" en vez de "vos/podés/tenés". Evitar expresiones propias del español argentino. Mantener un registro formal-profesional pero chileno.
EOF

ok "Memoria de Claude Code restaurada"

# --- 8. Resumen final ---
echo ""
echo "============================================="
echo -e "${VERDE}  Proyecto restaurado exitosamente${RESET}"
echo "============================================="
echo ""
echo "  Proyecto:  $DESTINO"
echo "  Sistema:   https://celele-cuek.github.io/sistema-seguimiento-tutorial"
echo "  Dev local: cd $DESTINO && npm run dev"
echo ""
