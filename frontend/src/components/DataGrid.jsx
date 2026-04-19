import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SEP = '\t'

function rangeOf(sel) {
  return {
    r1: Math.min(sel.ar, sel.fr), r2: Math.max(sel.ar, sel.fr),
    c1: Math.min(sel.ac, sel.fc), c2: Math.max(sel.ac, sel.fc),
  }
}

function inRange(r, c, sel) {
  const { r1, r2, c1, c2 } = rangeOf(sel)
  return r >= r1 && r <= r2 && c >= c1 && c <= c2
}

function parseClipboardPaste(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  // Trim a single trailing empty line (common when copying from Excel)
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  const sep = lines.some(l => l.includes('\t')) ? '\t' : ','
  return lines.map(l => l.split(sep))
}

/**
 * Spreadsheet-style data grid.
 * rows[0] is header. Props:
 *   rows: string[][]
 *   onChange(newRows)
 */
export function DataGrid({ rows, onChange, types }) {
  const gridRef = useRef(null)
  const editInputRef = useRef(null)
  const header = rows[0] ?? []
  const nRows = rows.length
  const nCols = header.length

  // selection: ar/ac = anchor, fr/fc = focus. Body is rows 1..nRows-1 (row 0 = header).
  const [sel, setSel] = useState({ ar: 1, ac: 0, fr: 1, fc: 0 })
  const [editing, setEditing] = useState(null) // { r, c }
  const [editValue, setEditValue] = useState('')
  const draggingRef = useRef(false)

  // Clamp selection on rows/cols change
  useEffect(() => {
    if (!nCols || nRows <= 1) return
    const clamp = (r, max) => Math.max(1, Math.min(max, r))
    const clampC = (c) => Math.max(0, Math.min(nCols - 1, c))
    setSel(s => ({
      ar: clamp(s.ar, nRows - 1), fr: clamp(s.fr, nRows - 1),
      ac: clampC(s.ac), fc: clampC(s.fc),
    }))
  }, [nRows, nCols])

  const focus = () => gridRef.current?.focus()

  const startEdit = (r, c, initial) => {
    if (r === 0) return // header not editable here
    setEditing({ r, c })
    setEditValue(initial ?? (rows[r]?.[c] ?? ''))
  }

  const commitEdit = (advance) => {
    if (!editing) return
    const { r, c } = editing
    const next = rows.map(row => [...row])
    while (next.length <= r) next.push(Array(nCols).fill(''))
    while (next[r].length <= c) next[r].push('')
    next[r][c] = editValue
    onChange(next)
    setEditing(null)
    if (advance) {
      const nr = advance === 'down' ? Math.min(nRows - 1, r + 1) : r
      const nc = advance === 'right' ? Math.min(nCols - 1, c + 1) : c
      setSel({ ar: nr, ac: nc, fr: nr, fc: nc })
    }
    setTimeout(focus, 0)
  }

  const cancelEdit = () => { setEditing(null); setTimeout(focus, 0) }

  // ── Mouse ─────────────────────────────────────────────────
  const onMouseDown = (e, r, c) => {
    if (editing && editing.r === r && editing.c === c) return
    if (r === 0) return // header click → nothing for now
    e.preventDefault()
    focus()
    if (e.shiftKey) {
      setSel(s => ({ ...s, fr: r, fc: c }))
    } else {
      setSel({ ar: r, ac: c, fr: r, fc: c })
    }
    draggingRef.current = true
  }

  const onMouseEnter = (r, c) => {
    if (draggingRef.current && r > 0) {
      setSel(s => ({ ...s, fr: r, fc: c }))
    }
  }

  useEffect(() => {
    const up = () => { draggingRef.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // ── Keyboard ──────────────────────────────────────────────
  const onKeyDown = (e) => {
    if (editing) return
    const { fr, fc } = sel
    const move = (dr, dc) => {
      const nr = Math.max(1, Math.min(nRows - 1, fr + dr))
      const nc = Math.max(0, Math.min(nCols - 1, fc + dc))
      if (e.shiftKey) setSel(s => ({ ...s, fr: nr, fc: nc }))
      else setSel({ ar: nr, ac: nc, fr: nr, fc: nc })
      e.preventDefault()
    }
    // Ctrl/Cmd combos
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'a' || e.key === 'A') {
        setSel({ ar: 1, ac: 0, fr: nRows - 1, fc: nCols - 1 })
        e.preventDefault()
        return
      }
      if (e.key === 'c' || e.key === 'C') {
        copySelection()
        e.preventDefault()
        return
      }
      if (e.key === 'v' || e.key === 'V') {
        // Let the paste event handler fire
        return
      }
      if (e.key === 'x' || e.key === 'X') {
        copySelection()
        deleteSelection()
        e.preventDefault()
        return
      }
    }
    switch (e.key) {
      case 'ArrowUp': move(-1, 0); break
      case 'ArrowDown': move(1, 0); break
      case 'ArrowLeft': move(0, -1); break
      case 'ArrowRight': move(0, 1); break
      case 'Tab':
        move(0, e.shiftKey ? -1 : 1); break
      case 'Enter':
      case 'F2':
        e.preventDefault()
        startEdit(fr, fc)
        break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        deleteSelection()
        break
      case 'Escape':
        setSel(s => ({ ...s, ar: s.fr, ac: s.fc }))
        break
      default:
        // Start editing with typed character
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          startEdit(fr, fc, e.key)
        }
    }
  }

  const copySelection = async () => {
    const { r1, r2, c1, c2 } = rangeOf(sel)
    const lines = []
    for (let r = r1; r <= r2; r++) {
      const cells = []
      for (let c = c1; c <= c2; c++) {
        cells.push(rows[r]?.[c] ?? '')
      }
      lines.push(cells.join(SEP))
    }
    try { await navigator.clipboard.writeText(lines.join('\n')) } catch {}
  }

  const deleteSelection = () => {
    const { r1, r2, c1, c2 } = rangeOf(sel)
    const next = rows.map(row => [...row])
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (next[r]) next[r][c] = ''
      }
    }
    onChange(next)
  }

  const onPaste = (e) => {
    if (editing) return
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text) return
    e.preventDefault()
    const block = parseClipboardPaste(text)
    if (!block.length) return
    const { r1, c1 } = rangeOf(sel)
    const blockH = block.length
    const blockW = Math.max(...block.map(r => r.length))
    // Expand table if needed
    const needRows = Math.max(nRows, r1 + blockH)
    const needCols = Math.max(nCols, c1 + blockW)
    const next = rows.map(row => {
      const extra = needCols - row.length
      return extra > 0 ? [...row, ...Array(extra).fill('')] : [...row]
    })
    while (next.length < needRows) next.push(Array(needCols).fill(''))
    for (let i = 0; i < blockH; i++) {
      for (let j = 0; j < block[i].length; j++) {
        next[r1 + i][c1 + j] = block[i][j]
      }
    }
    onChange(next)
    setSel({
      ar: r1, ac: c1,
      fr: r1 + blockH - 1, fc: c1 + blockW - 1,
    })
  }

  // ── Editing focus ─────────────────────────────────────────
  useEffect(() => {
    if (editing) editInputRef.current?.focus()
  }, [editing])

  const onEditKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit('down') }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(e.shiftKey ? 'left' : 'right') }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
  }

  // ── Render ────────────────────────────────────────────────
  const body = rows.slice(1)

  return (
    <div
      ref={gridRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className="flex-1 overflow-auto outline-none"
      style={{
        fontSize: 11.5,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
      <table className="border-collapse" style={{ width: '100%' }}>
        <thead>
          <tr style={{ background: '#FAF6ED', borderBottom: '1px solid #E7E0D1' }}>
            {header.map((h, ci) => (
              <th key={ci} className="px-2 py-1.5 text-left sticky top-0"
                style={{
                  background: '#FAF6ED',
                  borderRight: '1px solid #F1ECE0',
                  fontWeight: 500,
                  color: '#57534E',
                  minWidth: 80,
                }}>
                <div
                  onDoubleClick={() => {
                    const v = prompt('重命名列', h)
                    if (v != null) {
                      const next = rows.map(r => [...r])
                      next[0][ci] = v
                      onChange(next)
                    }
                  }}>
                  {h || <span style={{ color: '#C4BEB7' }}>col_{ci}</span>}
                </div>
                {types && <div style={{ fontSize: 9.5, color: '#A8A29E', fontWeight: 400 }}>{types[ci]}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, bi) => {
            const ri = bi + 1
            return (
              <tr key={ri} style={{ borderBottom: '1px solid #F9F6F0' }}>
                {header.map((_, ci) => {
                  const isSelected = inRange(ri, ci, sel)
                  const isFocus = ri === sel.fr && ci === sel.fc
                  const isEditing = editing && editing.r === ri && editing.c === ci
                  return (
                    <td key={ci}
                      onMouseDown={e => onMouseDown(e, ri, ci)}
                      onMouseEnter={() => onMouseEnter(ri, ci)}
                      onDoubleClick={() => startEdit(ri, ci)}
                      className="relative px-2 py-1"
                      style={{
                        borderRight: '1px solid #F9F6F0',
                        color: '#1C1917',
                        background: isFocus
                          ? 'rgba(15,118,110,0.12)'
                          : isSelected
                            ? 'rgba(15,118,110,0.06)'
                            : 'transparent',
                        outline: isFocus ? '1.5px solid #0F766E' : 'none',
                        outlineOffset: '-1.5px',
                        userSelect: 'none',
                        cursor: 'cell',
                      }}>
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={onEditKeyDown}
                          onBlur={() => commitEdit(null)}
                          className="absolute inset-0 px-2 py-1 outline-none"
                          style={{
                            fontSize: 11.5,
                            fontFamily: 'JetBrains Mono, monospace',
                            background: '#FFFFFF',
                            border: '2px solid #0F766E',
                            color: '#1C1917',
                            width: '100%', height: '100%',
                          }}
                        />
                      ) : (
                        <span style={{ pointerEvents: 'none' }}>{row[ci] ?? ''}</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
