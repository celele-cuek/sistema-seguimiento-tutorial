import { useState, useCallback, useRef } from 'react';
import { readSheet, writeRow, updateRow, batchWrite } from '../lib/sheetsApi.js';
import { normalizeRut } from '../lib/utils.js';

const CACHE_TTL = 5 * 60 * 1000; // 5 min

export function useParticipants(grupo) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cacheRef = useRef({ data: null, time: 0, grupo: null });

  const load = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && cacheRef.current.grupo === grupo && cacheRef.current.data && now - cacheRef.current.time < CACHE_TTL) {
      setParticipants(cacheRef.current.data);
      return cacheRef.current.data;
    }
    setLoading(true);
    setError(null);
    try {
      const all = await readSheet('PARTICIPANTES');
      const filtered = grupo ? all.filter(p => p.grupo === grupo && p.estado !== 'Inactivo') : all.filter(p => p.estado !== 'Inactivo');
      const sorted = filtered.sort((a, b) => {
        const mgA = a.microgrupo || '';
        const mgB = b.microgrupo || '';
        if (mgA !== mgB) return mgA.localeCompare(mgB);
        return (a.nombre_completo || '').localeCompare(b.nombre_completo || '');
      });
      cacheRef.current = { data: sorted, time: Date.now(), grupo };
      setParticipants(sorted);
      return sorted;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [grupo]);

  const add = useCallback(async (participant) => {
    await writeRow('PARTICIPANTES', participant);
    cacheRef.current = { data: null, time: 0, grupo: null };
    await load(true);
  }, [load]);

  const update = useCallback(async (rut, updates) => {
    const p = participants.find(p => normalizeRut(p.rut) === normalizeRut(rut));
    if (!p) throw new Error('Participante no encontrado');
    await updateRow('PARTICIPANTES', p._rowIndex, { ...p, ...updates });
    cacheRef.current = { data: null, time: 0, grupo: null };
    setParticipants(prev => prev.map(x => normalizeRut(x.rut) === normalizeRut(rut) ? { ...x, ...updates } : x));
  }, [participants]);

  const deactivate = useCallback(async (rut, motivo) => {
    await update(rut, {
      estado: 'Inactivo',
      fecha_baja: new Date().toISOString().split('T')[0],
      motivo_baja: motivo || 'Baja',
    });
  }, [update]);

  return { participants, loading, error, load, add, update, deactivate, setParticipants };
}
