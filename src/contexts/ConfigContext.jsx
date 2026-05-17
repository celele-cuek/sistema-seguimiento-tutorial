import { createContext, useContext, useState, useEffect } from 'react';
import { readSheet } from '../lib/sheetsApi.js';
import { useAuth } from './AuthContext.jsx';
import { CONFIG_SEED } from '../lib/seedData.js';

const ConfigContext = createContext(null);

const DEFAULT_CONFIG = { ...CONFIG_SEED };

export function ConfigProvider({ children }) {
  const { auth } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth || auth.denied || auth === false) {
      setConfig(DEFAULT_CONFIG);
      return;
    }
    loadConfig();
  }, [auth]);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const rows = await readSheet('CONFIGURACION');
      if (rows.length > 0) {
        const raw = rows[0];
        // Only override defaults with non-empty values from the sheet
        const nonEmpty = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== '' && v !== undefined));
        setConfig({
          ...DEFAULT_CONFIG,
          ...nonEmpty,
          umbral_critico: Number(raw.umbral_critico) || DEFAULT_CONFIG.umbral_critico,
          umbral_alerta: Number(raw.umbral_alerta) || DEFAULT_CONFIG.umbral_alerta,
          umbral_justificaciones: Number(raw.umbral_justificaciones) || DEFAULT_CONFIG.umbral_justificaciones,
          umbral_retiros: Number(raw.umbral_retiros) || DEFAULT_CONFIG.umbral_retiros,
          umbral_dias_moodle: Number(raw.umbral_dias_moodle) || DEFAULT_CONFIG.umbral_dias_moodle,
          umbral_logro: Number(raw.umbral_logro) || DEFAULT_CONFIG.umbral_logro,
          total_semanas: Number(raw.total_semanas) || DEFAULT_CONFIG.total_semanas,
          setup_completo: raw.setup_completo === 'TRUE' || raw.setup_completo === true,
        });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch (err) {
      console.warn('Config load error, using defaults:', err);
      setConfig(DEFAULT_CONFIG);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateConfig(updates) {
    setConfig(prev => ({ ...prev, ...updates }));
  }

  return (
    <ConfigContext.Provider value={{ config, loading, error, updateConfig, reloadConfig: loadConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be inside ConfigProvider');
  return ctx;
}
