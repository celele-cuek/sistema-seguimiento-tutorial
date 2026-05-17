import { useState } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

export default function DataTable({ columns, data, onRowClick, searchable = false, emptyText = 'Sin datos', compact = false }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  let rows = [...data];

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(r => columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q)));
  }

  if (sortCol) {
    rows.sort((a, b) => {
      const av = String(a[sortCol] ?? '');
      const bv = String(b[sortCol] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  const pad = compact ? 'px-3 py-1.5' : 'px-4 py-3';

  return (
    <div className="flex flex-col gap-2">
      {searchable && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-verde)]"
          />
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: 'var(--color-oscuro)', color: '#9ABFB8' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`${pad} text-left font-medium text-xs uppercase tracking-wide select-none ${col.sortable !== false ? 'cursor-pointer hover:text-white' : ''}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortCol === col.key && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center text-gray-400 py-8 text-sm">{emptyText}</td>
              </tr>
            ) : rows.map((row, i) => (
              <tr
                key={row.id || row.rut || i}
                onClick={() => onRowClick?.(row)}
                className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : 'bg-white'} ${onRowClick ? 'cursor-pointer hover:bg-blue-50' : ''} transition-colors`}
              >
                {columns.map(col => (
                  <td key={col.key} className={`${pad} text-gray-700`}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <p className="text-xs text-gray-400 text-right">{rows.length} registro{rows.length !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}
