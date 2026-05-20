import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useViewAs } from '../../contexts/ViewAsContext.jsx';
import { USUARIOS_SEED } from '../../lib/seedData.js';
import {
  LayoutDashboard, ClipboardList, Grid3X3, MessageSquare, Upload,
  Users, BarChart3, AlertTriangle, FileText, Settings, Database,
  LogOut, ChevronRight, BookOpen, Shield, UserCog, Sliders, Eye
} from 'lucide-react';

function NavItem({ to, icon: Icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[var(--color-verde)] text-white'
            : 'text-gray-300 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function SidebarSection({ title, children }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 px-3 pt-3 pb-1">{title}</p>
      {children}
    </div>
  );
}

// Permissions per role
const ROLE_PERMS = {
  ADMIN:     { tutor: true,  coord: true,  admin: true  },
  COORD:     { tutor: true,  coord: true,  admin: false },
  TUTOR:     { tutor: true,  coord: false, admin: false },
  ASISTENTE: { tutor: true,  coord: true,  admin: false },
};

export default function Sidebar({ collapsed, onToggle }) {
  const { auth, signOut, hasRole } = useAuth();
  const { viewAsRole, setViewAsRole, viewAsTutor, setViewAsTutor } = useViewAs();
  const navigate = useNavigate();
  const isAdmin = hasRole('ADMIN');

  const tutorOptions = USUARIOS_SEED.filter((u, i, arr) =>
    u.roles.includes('TUTOR') && arr.findIndex(x => x.correo === u.correo) === i
  );

  function handleSignOut() {
    signOut();
    navigate('/login');
  }

  // Determine effective permissions
  const effectiveRole = viewAsRole || (
    hasRole('ADMIN') ? 'ADMIN' :
    hasRole('COORD') ? 'COORD' :
    hasRole('TUTOR') ? 'TUTOR' : 'ASISTENTE'
  );
  const perms = ROLE_PERMS[effectiveRole] || ROLE_PERMS.TUTOR;

  const showTutor = perms.tutor;
  const showCoord = perms.coord;
  const showAdmin = perms.admin;

  // Tutor selector: show only when ADMIN (real) and tutor section is visible
  const showTutorSelector = !collapsed && isAdmin && showTutor;

  return (
    <aside
      className={`flex flex-col h-screen sticky top-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}
      style={{ background: 'var(--color-oscuro)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        {!collapsed && (
          <div>
            <p className="text-white font-semibold text-sm leading-tight">SST</p>
            <p className="text-gray-400 text-xs">CPEIP / U. de Chile</p>
          </div>
        )}
        <button onClick={onToggle} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors ml-auto">
          <ChevronRight size={16} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Role selector — ADMIN only */}
      {!collapsed && isAdmin && (
        <div className="px-3 py-2.5 border-b border-white/10">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Eye size={11} className="text-gray-500" />
            <p className="text-xs text-gray-500">Vista como:</p>
          </div>
          <select
            value={viewAsRole || ''}
            onChange={e => { setViewAsRole(e.target.value || null); setViewAsTutor(null); }}
            className="w-full text-xs rounded-md px-2 py-1.5 bg-white/10 text-gray-300 border border-white/10 focus:outline-none focus:border-white/30"
          >
            <option value="">Mi rol (Admin)</option>
            <option value="COORD">Coordinador/a</option>
            <option value="TUTOR">Tutor/a</option>
            <option value="ASISTENTE">Asistente</option>
          </select>
          {viewAsRole && (
            <p className="text-xs text-blue-400 mt-1 px-1">
              Viendo como {viewAsRole}
            </p>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
        {showTutor && (
          <SidebarSection title={collapsed ? '' : 'Mi aula'}>
            {showTutorSelector && (
              <select
                className="mx-1 mb-1 text-xs rounded-md px-2 py-1.5 bg-white/10 text-gray-300 border border-white/10 focus:outline-none focus:border-white/30"
                value={viewAsTutor?.correo || ''}
                onChange={e => {
                  const t = tutorOptions.find(u => u.correo === e.target.value);
                  setViewAsTutor(t ? {
                    correo: t.correo,
                    nombre: t.nombre_completo,
                    grupos: (t.grupos || '').split(',').filter(Boolean),
                  } : null);
                }}
              >
                <option value="">— Seleccionar tutor —</option>
                {tutorOptions.map(t => (
                  <option key={t.correo} value={t.correo}>
                    {t.nombre_completo.split(' ').slice(0, 2).join(' ')}
                    {t.grupos ? ` (${t.grupos})` : ''}
                  </option>
                ))}
              </select>
            )}
            <NavItem to="/tutor/dashboard" icon={LayoutDashboard} label="Tablero" />
            <NavItem to="/tutor/attendance" icon={ClipboardList} label="Asistencia" />
            <NavItem to="/tutor/grid" icon={Grid3X3} label="Grilla histórica" />
            <NavItem to="/tutor/novedades" icon={MessageSquare} label="Novedades" />
            <NavItem to="/tutor/moodle" icon={Upload} label="Cargar Moodle" />
          </SidebarSection>
        )}

        {showCoord && (
          <SidebarSection title={collapsed ? '' : 'Coordinación'}>
            <NavItem to="/coord/panel" icon={BarChart3} label="Panel general" />
            <NavItem to="/coord/novedades" icon={MessageSquare} label="Novedades" />
            <NavItem to="/coord/alerts" icon={AlertTriangle} label="Alertas críticas" />
            <NavItem to="/coord/nomina" icon={Users} label="Nómina" />
            <NavItem to="/coord/team" icon={UserCog} label="Equipo tutores" />
            <NavItem to="/coord/reports" icon={FileText} label="Informes" />
            <NavItem to="/coord/thresholds" icon={Sliders} label="Umbrales" />
          </SidebarSection>
        )}

        {showAdmin && (
          <SidebarSection title={collapsed ? '' : 'Administración'}>
            <NavItem to="/admin/config" icon={Settings} label="Configuración" />
            <NavItem to="/admin/nomina" icon={BookOpen} label="Nómina masiva" />
            <NavItem to="/admin/users" icon={Shield} label="Usuarios" />
            <NavItem to="/admin/thresholds" icon={Settings} label="Umbrales" />
            <NavItem to="/admin/backup" icon={Database} label="Backup" />
            <NavItem to="/admin/log" icon={ClipboardList} label="Auditoría" />
          </SidebarSection>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-white/10">
        {!collapsed && auth && (
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-xs font-medium truncate">{auth.nombre?.split(' ')[0]}</p>
            <p className="text-gray-500 text-xs truncate">{auth.email}</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
