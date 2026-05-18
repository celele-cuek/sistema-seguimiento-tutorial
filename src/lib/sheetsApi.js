const SHEETS_ID = import.meta.env.VITE_SHEETS_ID;
const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

let _token = null;

export function setToken(token) {
  _token = token;
}

export function getToken() {
  return _token || sessionStorage.getItem('gsi_token');
}

function authHeaders() {
  const token = getToken();
  if (!token) throw new Error('No auth token available');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  if (res.status === 401) {
    sessionStorage.removeItem('gsi_token');
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Token expirado');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row, i) => {
    const obj = { _rowIndex: i + 2 };
    headers.forEach((h, j) => { obj[h] = row[j] ?? ''; });
    return obj;
  });
}

function objectToRow(headers, obj) {
  return headers.map(h => obj[h] ?? '');
}

export async function readSheet(sheetName) {
  const url = `${BASE_URL}/${SHEETS_ID}/values/${encodeURIComponent(sheetName)}`;
  const data = await apiFetch(url);
  return rowsToObjects(data.values || []);
}

export async function readSheetRaw(sheetName) {
  const url = `${BASE_URL}/${SHEETS_ID}/values/${encodeURIComponent(sheetName)}`;
  const data = await apiFetch(url);
  return data.values || [];
}

export async function getSheetHeaders(sheetName) {
  const url = `${BASE_URL}/${SHEETS_ID}/values/${encodeURIComponent(sheetName)}!1:1`;
  const data = await apiFetch(url);
  return (data.values || [[]])[0];
}

export async function writeRow(sheetName, rowData) {
  const headers = await getSheetHeaders(sheetName);
  const row = objectToRow(headers, rowData);
  const url = `${BASE_URL}/${SHEETS_ID}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return apiFetch(url, { method: 'POST', body: JSON.stringify({ values: [row] }) });
}

export async function updateRow(sheetName, rowIndex, rowData) {
  const headers = await getSheetHeaders(sheetName);
  const row = objectToRow(headers, rowData);
  const range = `${sheetName}!A${rowIndex}`;
  const url = `${BASE_URL}/${SHEETS_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  return apiFetch(url, { method: 'PUT', body: JSON.stringify({ values: [row] }) });
}

export async function findRows(sheetName, field, value) {
  const rows = await readSheet(sheetName);
  return rows.filter(r => r[field] === value);
}

export async function batchWrite(sheetName, rows) {
  if (!rows.length) return;
  const headers = await getSheetHeaders(sheetName);
  const values = rows.map(r => objectToRow(headers, r));
  const url = `${BASE_URL}/${SHEETS_ID}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  return apiFetch(url, { method: 'POST', body: JSON.stringify({ values }) });
}

export async function clearAndWriteSheet(sheetName, rows) {
  const headers = await getSheetHeaders(sheetName);
  const sn = encodeURIComponent(sheetName);
  const clearUrl = `${BASE_URL}/${SHEETS_ID}/values/${sn}!A2:Z100000:clear`;
  await apiFetch(clearUrl, { method: 'POST', body: JSON.stringify({}) });
  if (!rows.length) return;
  const values = rows.map(r => objectToRow(headers, r));
  const url = `${BASE_URL}/${SHEETS_ID}/values/${sn}!A2?valueInputOption=RAW`;
  return apiFetch(url, { method: 'PUT', body: JSON.stringify({ values }) });
}

export async function batchUpdateRows(sheetName, updates) {
  if (!updates.length) return;
  const headers = await getSheetHeaders(sheetName);
  const data = updates.map(({ rowIndex, rowData }) => ({
    range: `${sheetName}!A${rowIndex}`,
    values: [objectToRow(headers, rowData)],
  }));
  const url = `${BASE_URL}/${SHEETS_ID}/values:batchUpdate?valueInputOption=USER_ENTERED`;
  return apiFetch(url, { method: 'POST', body: JSON.stringify({ data }) });
}

export async function batchUpdate(updates) {
  const data = updates.map(({ sheetName, rowIndex, rowData, headers }) => ({
    range: `${sheetName}!A${rowIndex}`,
    values: [objectToRow(headers, rowData)],
  }));
  const url = `${BASE_URL}/${SHEETS_ID}/values:batchUpdate?valueInputOption=USER_ENTERED`;
  return apiFetch(url, { method: 'POST', body: JSON.stringify({ data }) });
}

export async function initSheet(sheetName, headers, rows = []) {
  const headerRow = [headers];
  const dataRows = rows.map(r => headers.map(h => r[h] ?? ''));
  const url = `${BASE_URL}/${SHEETS_ID}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`;
  return apiFetch(url, { method: 'PUT', body: JSON.stringify({ values: [...headerRow, ...dataRows] }) });
}
