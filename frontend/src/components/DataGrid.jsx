import { useCallback, useEffect, useRef, useState } from 'react'

// ── Selection helpers ──────────────────────────────────────────────────────

function inRange(v, a, b) { return v >= Math.min(a, b) && v <= Math.max(a, b) }

function normSel(sel) {
  if (!sel) return null
  return {
    r0: Math.min(sel.r0, sel.r1), r1: Math.max(sel.r0, sel.r1),
    c0: Math.min(sel.c0, sel.c1), c1: Math.max(sel.c0, sel.c1),
  }
}

// ── Context menu ──────────────────────────────────────────────────────────

function CtxMenu({ x, y, items, onClose }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={onClose} />
      <div style={{
        position: 'fixed', top: y, left: x, zIndex: 9999,
        background: '#fff', border: '1px solid #CFE0ED',
        borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        minWidth: 160, padding: '4px 0', fontSize: 12,
      }}>
        {items.map((item, i) =>
          item == null ? (
            <div key={i} style={{ height: 1, background: '#EBF4FA', margin: '4px 0' }} />
          ) : (
            <button key={i} onClick={item.action} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '5px 14px', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace',
              color: item.danger ? '#DC2626' : '#1A2B3C', fontSize: 12,
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0F7FC'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >{item.label}</button>
          )
        )}
      </div>
    </>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────

export function DataGrid({ rows, onChange, types, onSelectionChange }) {
  // sel: 0-indexed over full `rows` array (row 0 = header row)
  const [sel, setSel] = useState(null)          // { r0, c0, r1, c1 }
  const [anchor, setAnchor] = useState(null)    // { r, c } — shift+click base
  const [editing, setEditing] = useState(null)  // { r, c }
  const [editVal, setEditVal] = useState('')
  const [sortCfg, setSortCfg] = useState(null)  // { col, dir: 'asc'|'desc' }
  const [ctxMenu, setCtxMenu] = useState(null)

  const dragging = useRef(false)
  const dragAnchor = useRef(null)
  const tableRef = useRef(null)
  const editRef = useRef(null)

  // Notify parent when selection changes
  useEffect(() => {
    if (!onSelectionChange) return
    const s = normSel(sel)
    if (!s) { onSelectionChange(''); return }
    const lines = []
    for (let r = s.r0; r <= s.r1; r++) {
      const cols = []
      for (let c = s.c0; c <= s.c1; c++) cols.push(rows[r]?.[c] ?? '')
      lines.push(cols.join('\t'))
    }
    onSelectionChange(lines.join('\n'))
  }, [sel, rows, onSelectionChange])

  const nRows = rows.length       // includes header row
  const nCols = rows[0]?.length ?? 0

  // ── Sort ────────────────────────────────────────────────────────────────

  const sortedDataRows = (() => {
    const data = rows.slice(1)
    if (!sortCfg) return data
    const { col, dir } = sortCfg
    return [...data].sort((a, b) => {
      const av = a[col] ?? '', bv = b[col] ?? ''
      const an = Number(av), bn = Number(bv)
      const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv))
      return dir === 'asc' ? cmp : -cmp
    })
  })()

  const displayRows = [rows[0], ...sortedDataRows]

  // ── Selection ────────────────────────────────────────────────────────────

  const isSel = (r, c) => {
    const s = normSel(sel)
    return s ? inRange(r, s.r0, s.r1) && inRange(c, s.c0, s.c1) : false
  }

  const selectRow = (r, e) => {
    e.preventDefault()
    setSel({ r0: r, c0: 0, r1: r, c1: nCols - 1 })
    setAnchor({ r, c: 0 })
  }

  const selectCol = (c, e) => {
    e.preventDefault()
    setSel({ r0: 0, c0: c, r1: nRows - 1, c1: c })
    setAnchor({ r: 0, c })
  }

  const selectAll = (e) => {
    e.preventDefault()
    setSel({ r0: 0, c0: 0, r1: nRows - 1, c1: nCols - 1 })
  }

  const startCellDrag = (r, c, e) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (editing) commitEdit()
    if (e.shiftKey && anchor) {
      setSel({ r0: anchor.r, c0: anchor.c, r1: r, c1: c })
    } else {
      setSel({ r0: r, c0: c, r1: r, c1: c })
      setAnchor({ r, c })
    }
    dragging.current = true
    dragAnchor.current = { r, c }
  }

  const extendDrag = (r, c) => {
    if (!dragging.current || !dragAnchor.current) return
    setSel({ r0: dragAnchor.current.r, c0: dragAnchor.current.c, r1: r, c1: c })
  }

  useEffect(() => {
    const up = () => { dragging.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // ── Editing ──────────────────────────────────────────────────────────────

  const startEdit = (r, c) => {
    setEditing({ r, c })
    setEditVal(rows[r]?.[c] ?? '')
    setSel({ r0: r, c0: c, r1: r, c1: c })
  }

  const commitEdit = useCallback((newVal) => {
    setEditing(prev => {
      if (!prev) return null
      const v = newVal !== undefined ? newVal : editVal
      const newRows = rows.map(row => [...row])
      newRows[prev.r][prev.c] = v
      onChange(newRows)
      return null
    })
  }, [editVal, rows, onChange])

  useEffect(() => { if (editing && editRef.current) editRef.current.focus() }, [editing])

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(null); tableRef.current?.focus() }
    if (e.key === 'Tab') {
      e.preventDefault()
      const { r, c } = editing
      commitEdit()
      const nc = e.shiftKey ? c - 1 : c + 1
      if (nc >= 0 && nc < nCols) startEdit(r, nc)
    }
  }

  // ── Keyboard on table ─────────────────────────────────────────────────────

  const handleTableKeyDown = (e) => {
    if (editing) return
    const s = normSel(sel)

    // Select all
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault()
      setSel({ r0: 0, c0: 0, r1: nRows - 1, c1: nCols - 1 })
      return
    }

    // Copy
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      e.preventDefault()
      if (!s) return
      const lines = []
      for (let r = s.r0; r <= s.r1; r++) {
        const cols = []
        for (let c = s.c0; c <= s.c1; c++) cols.push(rows[r]?.[c] ?? '')
        lines.push(cols.join('\t'))
      }
      navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
      return
    }

    // Paste
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      e.preventDefault()
      if (!s) return
      navigator.clipboard.readText().then(text => {
        const pasted = text.split('\n').map(l => l.split('\t'))
        const newRows = rows.map(r => [...r])
        pasted.forEach((prow, dr) => {
          prow.forEach((val, dc) => {
            const rr = s.r0 + dr, cc = s.c0 + dc
            if (rr < nRows && cc < nCols) newRows[rr][cc] = val
          })
        })
        onChange(newRows)
      }).catch(() => {})
      return
    }

    // Delete / Backspace
    if ((e.key === 'Delete' || e.key === 'Backspace') && s) {
      e.preventDefault()
      const newRows = rows.map(row => [...row])
      for (let r = s.r0; r <= s.r1; r++)
        for (let c = s.c0; c <= s.c1; c++)
          newRows[r][c] = ''
      onChange(newRows)
      return
    }

    // Arrow navigation
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    if (arrows[e.key] && s) {
      e.preventDefault()
      const [dr, dc] = arrows[e.key]
      if (e.shiftKey) {
        setSel(prev => ({
          ...prev,
          r1: Math.max(0, Math.min(nRows - 1, prev.r1 + dr)),
          c1: Math.max(0, Math.min(nCols - 1, prev.c1 + dc)),
        }))
      } else {
        const nr = Math.max(0, Math.min(nRows - 1, s.r1 + dr))
        const nc = Math.max(0, Math.min(nCols - 1, s.c1 + dc))
        setSel({ r0: nr, c0: nc, r1: nr, c1: nc })
        setAnchor({ r: nr, c: nc })
      }
    }

    // Enter → start edit on selected cell
    if (e.key === 'Enter' && s && s.r0 === s.r1 && s.c0 === s.c1) {
      startEdit(s.r0, s.c0)
    }
  }

  // ── Right-click ───────────────────────────────────────────────────────────

  const openCtx = (e, dataRowIdx) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, dataRowIdx })
  }

  const ctxItems = ctxMenu ? [
    { label: '在上方插入行', action: () => {
      const newRows = [...rows]
      newRows.splice(ctxMenu.dataRowIdx + 1, 0, Array(nCols).fill(''))
      onChange(newRows); setCtxMenu(null)
    }},
    { label: '在下方插入行', action: () => {
      const newRows = [...rows]
      newRows.splice(ctxMenu.dataRowIdx + 2, 0, Array(nCols).fill(''))
      onChange(newRows); setCtxMenu(null)
    }},
    null,
    { label: '删除此行', danger: true, action: () => {
      if (rows.length <= 2) { setCtxMenu(null); return }
      const newRows = rows.filter((_, i) => i !== ctxMenu.dataRowIdx + 1)
      onChange(newRows); setCtxMenu(null)
    }},
  ] : []

  // ── Styles ────────────────────────────────────────────────────────────────

  const colStyle = (ci) => ({
    fontSize: 11.5,
    fontFamily: '"JetBrains Mono", monospace',
    color: types?.[ci] === 'f64' ? '#1A7DC4' : '#1A2B3C',
    textAlign: types?.[ci] === 'f64' ? 'right' : 'left',
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'auto', position: 'relative', outline: 'none' }}
      ref={tableRef}
      tabIndex={0}
      onKeyDown={handleTableKeyDown}
      onContextMenu={e => e.preventDefault()}
    >
      <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'auto' }}>
        {/* ── Column headers (rows[0]) ────────────────────────── */}
        <thead>
          <tr>
            {/* Corner: select all */}
            <th onMouseDown={selectAll}
              style={{
                position: 'sticky', top: 0, left: 0, zIndex: 3,
                width: 36, minWidth: 36, padding: '0 4px',
                background: '#F0F7FC', border: '1px solid #CFE0ED',
                cursor: 'pointer', fontSize: 11, color: '#CFE0ED',
                textAlign: 'center', userSelect: 'none',
              }}
              title="全选">⊞</th>

            {rows[0]?.map((h, ci) => {
              const isColSel = sel && normSel(sel).c0 === ci && normSel(sel).c1 === ci &&
                normSel(sel).r0 === 0 && normSel(sel).r1 === nRows - 1
              const sorted = sortCfg?.col === ci
              return (
                <th key={ci}
                  onMouseDown={(e) => selectCol(ci, e)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    const dir = sorted && sortCfg.dir === 'asc' ? 'desc' : 'asc'
                    setSortCfg(sortCfg?.col === ci && sortCfg?.dir === dir ? null : { col: ci, dir })
                  }}
                  title="点击选中整列 · 右键排序"
                  style={{
                    position: 'sticky', top: 0, zIndex: 2,
                    padding: '0 8px', height: 34, whiteSpace: 'nowrap',
                    background: isColSel ? 'rgba(26,125,196,0.1)' : '#F0F7FC',
                    border: '1px solid #CFE0ED', cursor: 'pointer',
                    fontWeight: 600, fontSize: 11, color: '#2E4A5E',
                    fontFamily: '"JetBrains Mono", monospace',
                    textAlign: types?.[ci] === 'f64' ? 'right' : 'left',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: types?.[ci] === 'f64' ? 'flex-end' : 'flex-start' }}>
                    <span>{h || `col_${ci}`}</span>
                    {sorted && (
                      <span style={{ fontSize: 9, color: '#1A7DC4' }}>
                        {sortCfg.dir === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                    {types?.[ci] && (
                      <span style={{ fontSize: 9, color: '#9DB5C7', fontWeight: 400 }}>{types[ci]}</span>
                    )}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>

        {/* ── Data rows (rows[1..]) ───────────────────────────── */}
        <tbody>
          {displayRows.slice(1).map((row, di) => {
            const ri = di + 1  // index in original `rows` (1-based data rows)
            const isRowSel = sel && normSel(sel).r0 <= ri && normSel(sel).r1 >= ri &&
              normSel(sel).c0 === 0 && normSel(sel).c1 === nCols - 1
            return (
              <tr key={di}>
                {/* Row number */}
                <td onMouseDown={(e) => selectRow(ri, e)}
                  onContextMenu={(e) => openCtx(e, di)}
                  style={{
                    position: 'sticky', left: 0, zIndex: 1,
                    width: 36, minWidth: 36, padding: '0 4px',
                    background: isRowSel ? 'rgba(26,125,196,0.1)' : '#FAFCFE',
                    border: '1px solid #EBF4FA',
                    borderRight: '1px solid #CFE0ED',
                    fontSize: 10, color: '#BDCFDF', textAlign: 'center',
                    cursor: 'pointer', userSelect: 'none',
                    fontFamily: '"JetBrains Mono", monospace',
                  }}>
                  {di + 1}
                </td>

                {/* Data cells */}
                {row.map((cell, ci) => {
                  const selected = isSel(ri, ci)
                  const isEdit = editing?.r === ri && editing?.c === ci
                  return (
                    <td key={ci}
                      onMouseDown={(e) => {
                        if (e.button === 2) return
                        startCellDrag(ri, ci, e)
                      }}
                      onMouseEnter={() => extendDrag(ri, ci)}
                      onDoubleClick={() => startEdit(ri, ci)}
                      onContextMenu={(e) => openCtx(e, di)}
                      style={{
                        padding: isEdit ? 0 : '0 8px',
                        height: 28, minWidth: 80,
                        border: '1px solid #EBF4FA',
                        borderTop: selected ? '1px solid rgba(26,125,196,0.4)' : undefined,
                        borderBottom: selected ? '1px solid rgba(26,125,196,0.4)' : undefined,
                        background: selected ? 'rgba(26,125,196,0.08)' : '#FFFFFF',
                        outline: selected && sel && normSel(sel).r0 === ri && normSel(sel).c0 === ci ? '2px solid #1A7DC4' : 'none',
                        outlineOffset: -1,
                        position: 'relative',
                        whiteSpace: 'nowrap',
                        ...colStyle(ci),
                      }}>
                      {isEdit ? (
                        <input
                          ref={editRef}
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={() => commitEdit()}
                          onKeyDown={handleEditKeyDown}
                          style={{
                            width: '100%', height: '100%', border: 'none',
                            outline: '2px solid #1A7DC4', padding: '0 8px',
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 11.5, background: '#EBF4FA',
                            color: colStyle(ci).color,
                            textAlign: colStyle(ci).textAlign,
                            boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        cell
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      {ctxMenu && <CtxMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxItems} onClose={() => setCtxMenu(null)} />}
    </div>
  )
}
