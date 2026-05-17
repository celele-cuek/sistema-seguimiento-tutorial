import { useState, useCallback } from 'react';
import * as api from '../lib/sheetsApi.js';

export function useSheets(sheetName) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.readSheet(sheetName);
      setData(rows);
      return rows;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sheetName]);

  const addRow = useCallback(async (rowData) => {
    try {
      await api.writeRow(sheetName, rowData);
      setData(prev => [...prev, rowData]);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [sheetName]);

  const updateRow = useCallback(async (rowIndex, rowData) => {
    try {
      await api.updateRow(sheetName, rowIndex, rowData);
      setData(prev => prev.map(r => r._rowIndex === rowIndex ? { ...r, ...rowData } : r));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [sheetName]);

  return { data, loading, error, load, addRow, updateRow, setData };
}

export function useSheetsRead(sheetName) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.readSheet(sheetName);
      setData(rows);
      return rows;
    } catch (err) {
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [sheetName]);

  return { data, loading, error, load, setData };
}
