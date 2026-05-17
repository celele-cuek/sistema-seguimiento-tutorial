# Sistema de Seguimiento Tutorial
### Mejorando la Gestión Escolar con IA — CPEIP / U. de Chile

Sistema web de seguimiento tutorial para 401 participantes en 16 grupos, 12 semanas de duración.

## Stack

- **Frontend**: React 18 + Vite, Tailwind CSS, Recharts
- **Base de datos**: Google Sheets API v4
- **Autenticación**: Google OAuth 2.0 (token client)
- **Deploy**: GitHub Pages (estático)

## Configuración inicial

### 1. Variables de entorno

Crea un archivo `.env` en la raíz (o copia `.env.example`):

```env
VITE_GOOGLE_CLIENT_ID=53387282621-a9i2jmcio4i95cgne4n2cje9hq7dbrsa.apps.googleusercontent.com
VITE_SHEETS_ID=1RfOym4uAXD89z6l2sRM7NCEFqUNl4TYbVW50_3F_Ohs
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Desarrollo local

```bash
npm run dev
```

Abre [http://localhost:5173/sistema-seguimiento-tutorial](http://localhost:5173/sistema-seguimiento-tutorial)

### 4. Setup inicial del sistema

Al hacer login por primera vez como ADMIN (`cesar.leal@gmail.com`), ir a `/setup` y ejecutar los pasos en orden:

1. **Inicializar hojas** — crea las cabeceras en todas las hojas del libro Sheets
2. **Configuración del curso** — escribe datos del curso en CONFIGURACION
3. **Cargar usuarios** — carga los 18 usuarios del equipo en USUARIOS
4. **Nómina de participantes** — importa CSV/Excel o carga datos piloto (80 ficticios)
5. **Verificar umbrales** — confirma parámetros y activa el sistema

## Deploy en GitHub Pages

### Automático (recomendado)
Cada push a `main` dispara el workflow de GitHub Actions que construye y publica.

Los secretos `VITE_GOOGLE_CLIENT_ID` y `VITE_SHEETS_ID` deben estar configurados en:
`Settings → Secrets and variables → Actions`

### Manual
```bash
npm run deploy
```

## URL de producción

https://celele-cuek.github.io/sistema-seguimiento-tutorial

## Módulos

| Módulo | Ruta | Roles |
|--------|------|-------|
| Login / Acceso | `/login`, `/access-denied` | Todos |
| Tablero tutor | `/tutor/dashboard` | TUTOR, ADMIN |
| Ingreso asistencia | `/tutor/attendance` | TUTOR, ADMIN |
| Grilla histórica | `/tutor/grid` | TUTOR, COORD, ADMIN |
| Novedades | `/tutor/novedades` | TUTOR, COORD, ADMIN |
| Carga Moodle | `/tutor/moodle` | TUTOR, ASISTENTE, ADMIN |
| Ficha participante | `/tutor/participant/:rut` | TUTOR, COORD, ADMIN |
| Panel coordinación | `/coord/panel` | COORD, ADMIN, ASISTENTE |
| Alertas críticas | `/coord/alerts` | COORD, ADMIN |
| Gestión nómina | `/coord/nomina` | COORD, ADMIN |
| Equipo tutores | `/coord/team` | COORD, ADMIN |
| Informes PDF | `/coord/reports` | COORD, ADMIN |
| Configuración | `/admin/config` | ADMIN |
| Importar nómina | `/admin/nomina` | ADMIN |
| Usuarios | `/admin/users` | ADMIN |
| Umbrales | `/admin/thresholds` | ADMIN |
| Backup | `/admin/backup` | ADMIN |
| Auditoría | `/admin/log` | ADMIN |

## Estructura de Google Sheets

El libro de Sheets debe tener exactamente estas hojas (sensibles a mayúsculas):

`CONFIGURACION` · `CALENDARIO` · `USUARIOS` · `PARTICIPANTES` · `ASISTENCIA` · `RESUMEN_PARTICIPANTE` · `NOVEDADES` · `MOODLE_SEMANAL` · `LOG` · `EVALUACIONES`

## Roles

| Rol | Descripción |
|-----|-------------|
| ADMIN | Acceso completo, configuración, backup |
| COORD | Panel global, nómina, informes |
| TUTOR | Asistencia de sus grupos, novedades |
| ASISTENTE | Carga Moodle, vista coordinación |
