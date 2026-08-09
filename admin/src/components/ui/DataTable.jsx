import { useState, useMemo } from 'react'
import { EmptyState } from './EmptyState'

export function DataTable({
  columns = [],
  rows = [],
  initialSort = null, // { key, direction: 'asc' | 'desc' }
  emptyMessage = 'No items found.',
  maxHeight = '480px',
  className = '',
}) {
  const [sort, setSort] = useState(initialSort)

  const handleHeaderClick = (col) => {
    if (!col.sortable) return
    setSort((prev) => {
      if (prev?.key === col.key) {
        return { key: col.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key: col.key, direction: 'desc' }
    })
  }

  const sortedRows = useMemo(() => {
    if (!rows || !rows.length) return []
    if (!sort || !sort.key) return rows

    return [...rows].sort((a, b) => {
      const valA = a[sort.key]
      const valB = b[sort.key]

      // Push null/undefined values to the bottom
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      let comp = 0
      if (typeof valA === 'number' && typeof valB === 'number') {
        comp = valA - valB
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        comp = valA === valB ? 0 : valA ? -1 : 1
      } else {
        comp = String(valA).localeCompare(String(valB))
      }

      return sort.direction === 'asc' ? comp : -comp
    })
  }, [rows, sort])

  if (!rows || rows.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <div
      className={`w-full overflow-auto border border-line rounded-xl bg-panel ${className}`}
      style={{ maxHeight }}
    >
      <table className="w-full text-left border-collapse">
        <thead className="bg-raised sticky top-0 z-10">
          <tr className="border-b border-line h-10">
            {columns.map((col) => {
              const isSorted = sort?.key === col.key
              const alignClass = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'

              return (
                <th
                  key={col.key || col.label}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => handleHeaderClick(col)}
                  className={`px-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint select-none ${alignClass} ${
                    col.sortable ? 'cursor-pointer hover:text-text' : ''
                  }`}
                >
                  <div className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className={`text-[10px] ${isSorted ? 'text-indigo font-bold' : 'text-faint/40'}`}>
                        {isSorted ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    )}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {sortedRows.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              className="h-10 hover:bg-raised/60 transition-colors font-body text-[13px] text-text"
            >
              {columns.map((col) => {
                const alignClass = col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : ''
                const cellValue = col.render ? col.render(row) : row[col.key]

                return (
                  <td key={col.key || col.label} className={`px-4 py-2 truncate ${alignClass}`}>
                    {cellValue ?? '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
