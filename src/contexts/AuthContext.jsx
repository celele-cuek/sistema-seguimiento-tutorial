import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { readSheet, setToken } from '../lib/sheetsApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null); // null = loading, false = not logged in, object = logged in
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async (email, token) => {
    setToken(token);
    sessionStorage.setItem('gsi_token', token);
    try {
      const usuarios = await readSheet('USUARIOS');
      const match = usuarios.find(u =>
        u.correo?.toLowerCase() === email.toLowerCase() && u.activo !== 'FALSE'
      );
      if (!match) {
        return { denied: true, email };
      }
      const roles = match.roles?.split(',').map(r => r.trim()).filter(Boolean) || [];
      const grupos = match.grupos?.split(',').map(g => g.trim()).filter(Boolean) || [];
      return {
        email: match.correo,
        nombre: match.nombre_completo,
        rut: match.rut,
        roles,
        grupos,
        correoZoom: match.correo_zoom || '',
        token,
        denied: false,
      };
    } catch (err) {
      console.error('Error cargando perfil:', err);
      throw err;
    }
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
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setAuth(false);
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
