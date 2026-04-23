import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Radio, X, Plus, ChevronDown } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'

const API = ''

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Column chip picker ────────────────────────────────────────

function ColumnPicker({ headers, selected, onChange }) {
  if (!headers.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {headers.map(h => {
        const on = selected.includes(h)
        return (
          <button key={h} onClick={() => onChange(
            on ? selected.filter(c => c !== h) : [...selected, h]
          )}
            className="px-1.5 py-0.5 rounded text-xs font-mono transition"
            style={{
              border: `1px solid ${on ? '#1A2B3C' : '#BDCFDF'}`,
              background: on ? '#1A2B3C' : 'transparent',
              color: on ? '#EBF4FA' : '#4A6478',
            }}>
            {h}
          </button>
        )
      })}
    </div>
  )
}

// ── Row condition builder ─────────────────────────────────────

const OPS = ['>', '<', '>=', '<=', '==', '!=', 'contains']

function ConditionRow({ headers, cond, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-1.5">
      <select value={cond.column} onChange={e => onChange({ ...cond, column: e.target.value })}
        className="rounded px-1.5 py-0.5 outline-none"
        style={{ fontSize: 11, border: '1px solid #BDCFDF', background: '#FFFFFF', color: '#1F3547', fontFamily: 'JetBrains Mono, monospace' }}>
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <select value={cond.op} onChange={e => onChange({ ...cond, op: e.target.value })}
        className="rounded px-1.5 py-0.5 outline-none"
        style={{ fontSize: 11, border: '1px solid #BDCFDF', background: '#FFFFFF', color: '#1F3547', fontFamily: 'JetBrains Mono, monospace' }}>
        {OPS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <input value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })}
        placeholder="值"
        className="flex-1 rounded px-1.5 py-0.5 outline-none"
        style={{ fontSize: 11, border: '1px solid #BDCFDF', background: '#FFFFFF', color: '#1A2B3C', fontFamily: 'JetBrains Mono, monospace', minWidth: 0 }} />
      <button onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0"
        style={{ color: '#7A99AE' }}>
        <X size={10} />
      </button>
    </div>
  )
}

// ── Filter toolbar ────────────────────────────────────────────

function FilterToolbar({ headers, selectedColumns, onColumnsChange, conditions, onConditionsChange }) {
  const t = useT()
  const addCondition = () => {
    if (!headers.length) return
    onConditionsChange([...conditions, { column: headers[0], op: '>', value: '' }])
  }

  return (
    <div className="px-4 py-2.5 border-b flex-shrink-0 space-y-2"
      style={{ borderColor: '#CFE0ED', background: 'rgba(255,255,255,0.6)' }}>
      {/* Column picker */}
      <div className="flex items-start gap-2">
        <span style={{ fontSize: 10, color: '#7A99AE', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0, paddingTop: 2 }}>
          {t('filterColLabel')}
        </span>
        {headers.length > 0
          ? <ColumnPicker headers={headers} selected={selectedColumns} onChange={onColumnsChange} />
          : <span style={{ fontSize: 11, color: '#9DB5C7' }}>—</span>
        }
      </div>

      {/* Row conditions */}
      <div className="space-y-1">
        {conditions.map((c, i) => (
          <ConditionRow key={i} headers={headers} cond={c}
            onChange={nc => onConditionsChange(conditions.map((x, j) => j === i ? nc : x))}
            onRemove={() => onConditionsChange(conditions.filter((_, j) => j !== i))} />
        ))}
        <button onClick={addCondition} disabled={!headers.length}
          className="flex items-center gap-1 text-xs"
          style={{ color: '#7A99AE' }}>
          <Plus size={10} />{t('filterRows')}
        </button>
      </div>
    </div>
  )
}

// ── Data table preview ────────────────────────────────────────

function DataTable({ headers, rows, selectedColumns, conditions }) {
  const [page, setPage] = useState(0)
  const t = useT()
  const PAGE = 100

  // Client-side filter for display
  const visibleCols = selectedColumns.length > 0 ? selectedColumns : headers
  const colIdxs = visibleCols.map(c => headers.indexOf(c)).filter(i => i >= 0)

  const filtered = rows.filter(row => {
    return conditions.every(({ column, op, value }) => {
      if (!value) return true
      const ci = headers.indexOf(column)
      if (ci < 0) return true
      const cell = row[ci] ?? ''
      if (op === 'contains') return cell.includes(value)
      const num = Number(value)
      const cellNum = Number(cell)
      if (!isNaN(num) && !isNaN(cellNum)) {
        if (op === '>') return cellNum > num
        if (op === '<') return cellNum < num
        if (op === '>=') return cellNum >= num
        if (op === '<=') return cellNum <= num
        if (op === '==') return cellNum === num
        if (op === '!=') return cellNum !== num
      }
      if (op === '==') return cell === value
      if (op === '!=') return cell !== value
      return true
    })
  })

  const pageRows = filtered.slice(page * PAGE, (page + 1) * PAGE)
  const totalPages = Math.ceil(filtered.length / PAGE)

  if (!headers.length) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: '#9DB5C7', fontSize: 12 }}>
        {t('selectFilePreview')}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto"
        style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: '#F0F7FC', borderBottom: '1px solid #CFE0ED', position: 'sticky', top: 0 }}>
              {visibleCols.map(h => (
                <th key={h} className="px-2 py-1.5 text-left"
                  style={{ borderRight: '1px solid #DDF0FB', fontWeight: 500, color: '#2E4A5E', minWidth: 70, background: '#F0F7FC' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #EEF5FB' }}>
                {colIdxs.map(ci => (
                  <td key={ci} className="px-2 py-1"
                    style={{ borderRight: '1px solid #EEF5FB', color: '#1A2B3C' }}>
                    {row[ci] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination + row count */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t flex-shrink-0"
        style={{ borderColor: '#CFE0ED', fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', color: '#7A99AE' }}>
        <span>{t('filteredRowsCount', { n: filtered.length, m: rows.length })}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ color: page === 0 ? '#BDCFDF' : '#4A6478' }}>‹</button>
            <span>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ color: page >= totalPages - 1 ? '#BDCFDF' : '#4A6478' }}>›</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Export bar ────────────────────────────────────────────────

function ExportBar({ tasks, filteredCount, selectedFile, selectedColumns, conditions, headers }) {
  const { activeProjectId, activeExperimentId, createTask } = useStore()
  const t = useT()
  const [targetTaskId, setTargetTaskId] = useState('')
  const [newTaskName, setNewTaskName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState(null)

  // Build pandas filter_expr from conditions
  const buildFilterExpr = () => {
    const parts = conditions
      .filter(c => c.value !== '')
      .map(({ column, op, value }) => {
        if (op === 'contains') return `${column}.str.contains('${value}')`
        const isNum = !isNaN(Number(value))
        const val = isNum ? value : `'${value}'`
        return `${column} ${op} ${val}`
      })
    return parts.length ? parts.join(' and ') : null
  }

  const doExport = async () => {
    if (!selectedFile || !activeProjectId || !activeExperimentId) return

    let tid = targetTaskId
    if (showNew) {
      if (!newTaskName.trim()) return
      const data = await createTask(newTaskName.trim())
      tid = data?.task_id
      if (!tid) return
    }
    if (!tid) return

    setExporting(true)
    setResult(null)
    try {
      const r = await fetch(
        `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${tid}/export-from-experiment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_filename: selectedFile,
            columns: selectedColumns.length ? selectedColumns : null,
            filter_expr: buildFilterExpr(),
            dest_filename: 'data.csv',
          }),
        }
      )
      const d = await r.json()
      setResult(d.ok ? t('exportedRows', { n: d.rows_exported, path: `${tid}/processed/data.csv` }) : t('exportFailed'))
    } catch {
      setResult(t('exportFailedBackend'))
    } finally {
      setExporting(false)
    }
  }

  const effective = targetTaskId || (showNew ? '新任务' : null)

  return (
    <div className="px-4 py-2.5 border-t flex-shrink-0 space-y-2"
      style={{ borderColor: '#CFE0ED', background: 'rgba(255,255,255,0.6)' }}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 10, color: '#7A99AE', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
          {t('exportTo')}
        </span>
        {!showNew ? (
          <>
            <select value={targetTaskId} onChange={e => setTargetTaskId(e.target.value)}
              className="flex-1 rounded px-1.5 py-0.5 outline-none"
              style={{ fontSize: 11, border: '1px solid #BDCFDF', background: '#FFFFFF', color: '#1F3547', fontFamily: 'JetBrains Mono, monospace' }}>
              <option value="">{t('selectTask')}</option>
              {tasks.map(t => <option key={t.task_id} value={t.task_id}>{t.task_id}</option>)}
            </select>
            <button onClick={() => { setShowNew(true); setTargetTaskId('') }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs flex-shrink-0"
              style={{ border: '1px solid #BDCFDF', color: '#4A6478' }}>
              <Plus size={10} />{t('newLabel')}
            </button>
          </>
        ) : (
          <>
            <input value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
              placeholder={t('taskName')}
              autoFocus
              className="flex-1 rounded px-1.5 py-0.5 outline-none"
              style={{ fontSize: 11, border: '1px solid #1A2B3C', background: '#FFFFFF', color: '#1A2B3C', fontFamily: 'JetBrains Mono, monospace' }} />
            <button onClick={() => { setShowNew(false); setNewTaskName('') }}
              className="flex-shrink-0"
              style={{ color: '#7A99AE' }}>
              <X size={12} />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span style={{ fontSize: 11, color: '#7A99AE', fontFamily: 'JetBrains Mono, monospace' }}>
          {t('rowCount', { n: filteredCount })}
          {selectedFile ? ` · ${selectedFile}` : ''}
        </span>
        <button
          onClick={doExport}
          disabled={exporting || !selectedFile || (!targetTaskId && !showNew)}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium"
          style={{
            background: exporting || !selectedFile || (!targetTaskId && !showNew) ? '#CFE0ED' : '#1A2B3C',
            color: exporting || !selectedFile || (!targetTaskId && !showNew) ? '#7A99AE' : '#EBF4FA',
          }}>
          {exporting ? t('exporting') : t('exportToTask')}
        </button>
      </div>

      {result && (
        <div style={{ fontSize: 11, color: result.startsWith('✓') ? '#1A7DC4' : '#DC2626', fontFamily: 'JetBrains Mono, monospace' }}>
          {result}
        </div>
      )}
    </div>
  )
}

// ── Main ExperimentPanel ──────────────────────────────────────

export function ExperimentPanel() {
  const { activeProjectId, activeExperimentId, tasks } = useStore()
  const t = useT()
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewData, setPreviewData] = useState({ headers: [], rows: [] })
  const [selectedColumns, setSelectedColumns] = useState([])
  const [conditions, setConditions] = useState([])
  const [ingestActive, setIngestActive] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Fetch file list
  useEffect(() => {
    if (!activeProjectId || !activeExperimentId) return
    fetch(`${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/raw`)
      .then(r => r.json())
      .then(d => setFiles(d.files ?? []))
      .catch(() => {})
  }, [activeProjectId, activeExperimentId])

  // Fetch preview when file selected
  useEffect(() => {
    if (!selectedFile || !activeProjectId || !activeExperimentId) {
      setPreviewData({ headers: [], rows: [] })
      setSelectedColumns([])
      setConditions([])
      return
    }
    setLoadingPreview(true)
    fetch(`${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/raw/${encodeURIComponent(selectedFile)}/preview?n=500`)
      .then(r => r.json())
      .then(d => {
        setPreviewData({ headers: d.headers ?? [], rows: d.rows ?? [] })
        setSelectedColumns(d.headers ?? [])
        setConditions([])
      })
      .catch(() => setPreviewData({ headers: [], rows: [] }))
      .finally(() => setLoadingPreview(false))
  }, [selectedFile, activeProjectId, activeExperimentId])

  const upload = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    await fetch(`${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/data`, {
      method: 'POST', body: fd,
    })
    const r = await fetch(`${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/raw`)
    const d = await r.json()
    setFiles(d.files ?? [])
  }

  const ingestEndpoint = `http://localhost:8000/v1/ingest/${activeProjectId}/${activeExperimentId}`

  const { headers, rows } = previewData

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: '#CFE0ED', background: 'rgba(255,255,255,0.4)' }}>
        <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#7A99AE' }}>EXPERIMENT</span>
        <span className="ml-2" style={{ fontSize: 14, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic' }}>
          {activeExperimentId}
        </span>
      </div>

      {/* Body: horizontal split */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: file list (280px) */}
        <div className="flex flex-col overflow-hidden flex-shrink-0" style={{ width: 280, borderRight: '1px solid #CFE0ED' }}>
          {/* Actions */}
          <div className="flex gap-2 px-3 py-2.5 border-b flex-shrink-0" style={{ borderColor: '#CFE0ED' }}>
            <label className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md cursor-pointer"
              style={{ fontSize: 11.5, border: '1px solid #BDCFDF', color: '#1F3547' }}>
              <Upload size={11} />{t('uploadFile')}
              <input type="file" multiple className="hidden"
                onChange={e => Array.from(e.target.files).forEach(upload)} />
            </label>
            <button
              onClick={() => setIngestActive(a => !a)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md"
              style={{
                fontSize: 11.5, border: '1px solid',
                borderColor: ingestActive ? '#1A7DC4' : '#BDCFDF',
                color: ingestActive ? '#1A7DC4' : '#1F3547',
                background: ingestActive ? 'rgba(26,125,196,0.06)' : 'transparent',
              }}>
              <Radio size={11} />
              {ingestActive ? t('receiving') : t('liveReceive')}
            </button>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto py-1">
            {files.length === 0 ? (
              <div className="flex items-center justify-center h-full" style={{ color: '#9DB5C7', fontSize: 12 }}>
                {t('noRawData')}
              </div>
            ) : (
              files.map(f => (
                <button key={f.name}
                  onClick={() => setSelectedFile(f.name === selectedFile ? null : f.name)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 transition"
                  style={{
                    background: f.name === selectedFile ? 'rgba(26,43,60,0.06)' : 'transparent',
                    borderBottom: '1px solid #EEF5FB',
                  }}>
                  <span style={{ fontSize: 9, color: f.name === selectedFile ? '#1A2B3C' : '#7A99AE', flexShrink: 0 }}>
                    {f.name === selectedFile ? '●' : '○'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: 12, color: '#1A2B3C' }}>{f.name}</div>
                    <div style={{ fontSize: 10, color: '#7A99AE', fontFamily: 'JetBrains Mono, monospace' }}>{fmt(f.size)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: preview + filter + export */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {ingestActive ? (
            /* Ingest panel */
            <div className="flex-1 flex flex-col p-4 gap-3">
              <div className="rounded-md p-3" style={{ background: 'rgba(26,125,196,0.06)', border: '1px solid rgba(26,125,196,0.2)' }}>
                <div style={{ fontSize: 10, color: '#1A7DC4', fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>ENDPOINT</div>
                <code style={{ fontSize: 10.5, color: '#134E4A', wordBreak: 'break-all' }}>{ingestEndpoint}</code>
                <div className="mt-2" style={{ fontSize: 10.5, color: '#1A7DC4' }}>
                  POST ndjson → <code style={{ fontSize: 10 }}>stream.jsonl</code>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#4A6478' }}>
                {t('waitingForStream')}
              </div>
            </div>
          ) : (
            <>
              {/* Filter toolbar */}
              <FilterToolbar
                headers={headers}
                selectedColumns={selectedColumns}
                onColumnsChange={setSelectedColumns}
                conditions={conditions}
                onConditionsChange={setConditions}
              />

              {/* Data table */}
              {loadingPreview ? (
                <div className="flex-1 flex items-center justify-center pulse-soft" style={{ color: '#7A99AE', fontSize: 12 }}>
                  {t('loading')}
                </div>
              ) : (
                <DataTable
                  headers={headers}
                  rows={rows}
                  selectedColumns={selectedColumns}
                  conditions={conditions}
                />
              )}

              {/* Export bar */}
              <ExportBar
                tasks={tasks}
                filteredCount={rows.length}
                selectedFile={selectedFile}
                selectedColumns={selectedColumns}
                conditions={conditions}
                headers={headers}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
