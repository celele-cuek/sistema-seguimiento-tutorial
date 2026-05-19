import { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ConfigProvider } from './contexts/ConfigContext.jsx';
import { ViewAsProvider } from './contexts/ViewAsContext.jsx';
import Sidebar from './components/layout/Sidebar.jsx';

// Pages — eager load auth pages, lazy load the rest
import Login from './pages/Login.jsx';
import AccessDenied from './pages/AccessDenied.jsx';
import Setup from './pages/Setup.jsx';

const TutorDashboard     = lazy(() => import('./pages/tutor/Dashboard.jsx'));
const AttendanceEntry    = lazy(() => import('./pages/tutor/AttendanceEntry.jsx'));
const WeeklyGrid         = lazy(() => import('./pages/tutor/WeeklyGrid.jsx'));
const Novedades          = lazy(() => import('./pages/tutor/Novedades.jsx'));
const MoodleUpload       = lazy(() => import('./pages/tutor/MoodleUpload.jsx'));
const ParticipantProfile = lazy(() => import('./pages/tutor/ParticipantProfile.jsx'));

const CoordPanel         = lazy(() => import('./pages/coordinator/CoordPanel.jsx'));
const CriticalAlerts     = lazy(() => import('./pages/coordinator/CriticalAlerts.jsx'));
const NominaManager      = lazy(() => import('./pages/coordinator/NominaManager.jsx'));
const TeamStatus         = lazy(() => import('./pages/coordinator/TeamStatus.jsx'));
const Reports            = lazy(() => import('./pages/coordinator/Reports.jsx'));
const CoordProfile       = lazy(() => import('./pages/coordinator/ParticipantProfile.jsx'));

const CourseConfig       = lazy(() => import('./pages/admin/CourseConfig.jsx'));
const NominaImport       = lazy(() => import('./pages/admin/NominaImport.jsx'));
const UsersManager       = lazy(() => import('./pages/admin/UsersManager.jsx'));
const Thresholds         = lazy(() => import('./pages/admin/Thresholds.jsx'));
const CoordThresholds    = lazy(() => import('./pages/admin/Thresholds.jsx'));
const Backup             = lazy(() => import('./pages/admin/Backup.jsx'));
const AuditLog           = lazy(() => import('./pages/admin/AuditLog.jsx'));

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-verde)', borderTopColor: 'transparent' }} />
    </div>
  );
}

function RequireAuth({ children, roles }) {
  const { auth, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!auth) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (auth.denied) return <Navigate to="/access-denied" replace />;

  if (roles && !roles.some(r => auth.roles?.includes(r))) {
    // Redirect to appropriate home
    if (auth.roles?.includes('TUTOR')) return <Navigate to="/tutor/dashboard" replace />;
    if (auth.roles?.includes('COORD')) return <Navigate to="/coord/panel" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-fondo)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Suspense fallback={<Spinner />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}

function RootRedirect() {
  const { auth, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!auth) return <Navigate to="/login" replace />;
  if (auth.denied) return <Navigate to="/access-denied" replace />;
  if (auth.roles?.includes('TUTOR')) return <Navigate to="/tutor/dashboard" replace />;
  if (auth.roles?.includes('COORD')) return <Navigate to="/coord/panel" replace />;
  if (auth.roles?.includes('ASISTENTE')) return <Navigate to="/coord/panel" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter basename="/sistema-seguimiento-tutorial">
      <AuthProvider>
        <ConfigProvider>
        <ViewAsProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/access-denied" element={<AccessDenied />} />

            {/* Setup — admin only, before system is ready */}
            <Route path="/setup" element={
              <RequireAuth roles={['ADMIN']}>
                <Setup />
              </RequireAuth>
            } />

            {/* Tutor routes */}
            <Route path="/tutor/dashboard" element={
              <RequireAuth roles={['TUTOR', 'ADMIN', 'COORD', 'ASISTENTE']}>
                <AppLayout><TutorDashboard /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/tutor/attendance" element={
              <RequireAuth roles={['TUTOR', 'ADMIN', 'ASISTENTE']}>
                <AppLayout><AttendanceEntry /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/tutor/grid" element={
              <RequireAuth roles={['TUTOR', 'ADMIN', 'COORD', 'ASISTENTE']}>
                <AppLayout><WeeklyGrid /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/tutor/novedades" element={
              <RequireAuth roles={['TUTOR', 'ADMIN', 'COORD', 'ASISTENTE']}>
                <AppLayout><Novedades /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/tutor/moodle" element={
              <RequireAuth roles={['TUTOR', 'ADMIN', 'ASISTENTE']}>
                <AppLayout><MoodleUpload /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/tutor/participant/:rut" element={
              <RequireAuth roles={['TUTOR', 'ADMIN', 'COORD', 'ASISTENTE']}>
                <AppLayout><ParticipantProfile /></AppLayout>
              </RequireAuth>
            } />

            {/* Coordinator routes */}
            <Route path="/coord/panel" element={
              <RequireAuth roles={['COORD', 'ADMIN', 'ASISTENTE']}>
                <AppLayout><CoordPanel /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/coord/alerts" element={
              <RequireAuth roles={['COORD', 'ADMIN', 'ASISTENTE']}>
                <AppLayout><CriticalAlerts /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/coord/nomina" element={
              <RequireAuth roles={['COORD', 'ADMIN', 'ASISTENTE']}>
                <AppLayout><NominaManager /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/coord/team" element={
              <RequireAuth roles={['COORD', 'ADMIN', 'ASISTENTE']}>
                <AppLayout><TeamStatus /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/coord/reports" element={
              <RequireAuth roles={['COORD', 'ADMIN', 'ASISTENTE']}>
                <AppLayout><Reports /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/coord/participant/:rut" element={
              <RequireAuth roles={['COORD', 'ADMIN', 'ASISTENTE']}>
                <AppLayout><CoordProfile /></AppLayout>
              </RequireAuth>
            } />

            {/* Coord thresholds (COORD edita, ASISTENTE solo lee) */}
            <Route path="/coord/thresholds" element={
              <RequireAuth roles={['COORD', 'ADMIN', 'ASISTENTE']}>
                <AppLayout><CoordThresholds /></AppLayout>
              </RequireAuth>
            } />

            {/* Admin routes */}
            <Route path="/admin/config" element={
              <RequireAuth roles={['ADMIN']}>
                <AppLayout><CourseConfig /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/admin/nomina" element={
              <RequireAuth roles={['ADMIN']}>
                <AppLayout><NominaImport /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/admin/users" element={
              <RequireAuth roles={['ADMIN']}>
                <AppLayout><UsersManager /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/admin/thresholds" element={
              <RequireAuth roles={['ADMIN']}>
                <AppLayout><Thresholds /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/admin/backup" element={
              <RequireAuth roles={['ADMIN']}>
                <AppLayout><Backup /></AppLayout>
              </RequireAuth>
            } />
            <Route path="/admin/log" element={
              <RequireAuth roles={['ADMIN']}>
                <AppLayout><AuditLog /></AppLayout>
              </RequireAuth>
            } />

            {/* Root */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ViewAsProvider>
        </ConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
