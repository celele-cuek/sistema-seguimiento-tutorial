import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ShieldX } from 'lucide-react';

export default function AccessDenied() {
  const { state } = useLocation();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  function handleBack() {
    signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-fondo)' }}>
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
          <ShieldX size={32} className="text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 mb-1">Acceso denegado</h1>
          <p className="text-gray-500 text-sm">
            El correo <strong>{state?.email || 'desconocido'}</strong> no está registrado en el sistema o está inactivo.
          </p>
        </div>
        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3 w-full text-left">
          Si crees que es un error, contacta al coordinador del sistema para que registre tu correo en la hoja USUARIOS.
        </p>
        <button
          onClick={handleBack}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-colors hover:opacity-90"
          style={{ background: 'var(--color-verde)' }}
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}
