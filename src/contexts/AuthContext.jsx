import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { readSheet, writeRow, setToken } from '../lib/sheetsApi.js';
import { generateId, nowISO } from '../lib/utils.js';
import { USUARIOS_SEED } from '../lib/seedData.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null); // null = loading, false = not logged in, object = logged in
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async (email, token) => {
    setToken(token);
    sessionStorage.setItem('gsi_token', token);

    // Read USUARIOS sheet — fall back to empty array on any API error
    let usuarios = [];
    try {
      usuarios = await readSheet('USUARIOS');
    } catch (err) {
      console.warn('No se pudo leer USUARIOS desde Sheets, usando modo bootstrap:', err.message);
    }

    // Filter to rows that have a valid correo field and are active
    // activo can be 'TRUE', 'FALSE', boolean true/false, 'VERDADERO'/'FALSO' (Sheets es-locale), or empty
    const isInactive = (v) => v === 'FALSE' || v === false || v === 'FALSO' || v === 'false';
    const validUsers = usuarios.filter(u => u.correo && u.correo.trim() !== '' && !isInactive(u.activo));

    // Bootstrap mode: if no valid users in Sheets, fall back to seed data
    const isBootstrap = validUsers.length === 0;
    const source = isBootstrap ? USUARIOS_SEED : validUsers;

    console.log(`Auth: ${isBootstrap ? 'BOOTSTRAP (seed)' : `${validUsers.length} users from Sheets`}, buscando: ${email}`);

    const match = source.find(u =>
      u.correo?.toLowerCase().trim() === email?.toLowerCase().trim()
    );

    if (!match) {
      console.warn(`Auth: correo no encontrado → denied (${email})`);
      return { denied: true, email };
    }

    const roles = (match.roles || '').split(',').map(r => r.trim()).filter(Boolean);
    const grupos = (match.grupos || '').split(',').map(g => g.trim()).filter(Boolean);
    return {
      email: match.correo,
      nombre: match.nombre_completo,
      rut: match.rut,
      roles,
      grupos,
      correoZoom: match.correo_zoom || '',
      token,
      denied: false,
      bootstrap: isBootstrap,
    };
  }, []);

  const signIn = useCallback(async (credential, token, emailOverride) => {
    setLoading(true);
    try {
      let email = emailOverride || null;
      if (!email && credential) {
        const payload = JSON.parse(atob(credential.split('.')[1]));
        email = payload.email;
      }
      // If token provided via OAuth2 token client, use it directly
      const effectiveToken = token || credential;
      const profile = await loadUserProfile(email, effectiveToken);
      if (profile.denied) {
        setAuth({ denied: true, email: profile.email });
      } else {
        setAuth(profile);
        sessionStorage.setItem('auth_profile', JSON.stringify(profile));
        writeRow('LOG', {
          id: generateId(),
          datetime: nowISO(),
          usuario: profile.email,
          rol_activo: profile.roles.join(','),
          accion: 'LOGIN',
          entidad: 'USUARIOS',
          grupo: '',
          semana: '',
          detalle: profile.nombre || '',
          ip: '',
        }).catch(err => console.warn('No se pudo registrar LOGIN en LOG:', err.message));
      }
    } catch (err) {
      console.error('Sign in error:', err);
      // Surface the error so the user sees it on the login page
      setAuth({ error: err.message });
    } finally {
      setLoading(false);
    }
  }, [loadUserProfile]);

  const signOut = useCallback(() => {
    sessionStorage.removeItem('gsi_token');
    sessionStorage.removeItem('auth_profile');
    setAuth(false);
    setToken(null);
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('auth_profile');
    const token = sessionStorage.getItem('gsi_token');
    if (saved && token) {
      try {
        const profile = JSON.parse(saved);
        setToken(token);
        setAuth({ ...profile, token });
      } catch {
        setAuth(false);
      }
    } else {
      setAuth(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handler = () => {
      sessionStorage.removeItem('gsi_token');
      sessionStorage.removeItem('auth_profile');
      setAuth(false);
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, []);

  const hasRole = useCallback((role) => {
    if (!auth || auth.denied) return false;
    return auth.roles?.includes(role) || false;
  }, [auth]);

  const canAccessGroup = useCallback((groupId) => {
    if (!auth || auth.denied) return false;
    if (auth.roles?.includes('ADMIN') || auth.roles?.includes('COORD') || auth.roles?.includes('ASISTENTE')) return true;
    return auth.grupos?.includes(groupId) || false;
  }, [auth]);

  return (
    <AuthContext.Provider value={{ auth, loading, signIn, signOut, hasRole, canAccessGroup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
