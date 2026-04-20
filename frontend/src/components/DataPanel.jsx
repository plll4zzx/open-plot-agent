import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, ArrowLeftRight, RefreshCw, Play, RotateCw, Plus, MessageSquare } from 'lucide-react'
import { useStore } from '../store'
import { CodeEditor } from './CodeEditor'
import { DataGrid } from './DataGrid'

const API = ''

// ── helpers ──────────────────────────────────────────────────

function parseClipboard(text) {
  const lines = text.trim().split('\n')
  const sep = lines[0].includes('\t') ? '\t' : ','
  return lines.map(l => l.split(sep).map(c => c.trim()))
}

function inferType(vals) {
  const sample = vals.filter(Boolean).slice(0, 20)
  if (sample.every(v => !isNaN(Number(v)))) return 'f64'
  if (sample.every(v => /^\d{4}-\d{2}-\d{2}/.test(v))) return 'date'
  return 'str'
}

// ── "Send to Agent" floating button ──────────────────────────

function SendSelectionButton({ getSelection, onStage }) {
  const [hasSelection, setHasSelection] = useState(false)

  useEffect(() => {
    const check = () => {
      const sel = window.getSelection()
      setHasSelection(sel && sel.toString().trim().length > 0)
    }
    document.addEventListener('selectionchange', check)
    return () => document.removeEventListener('selectionchange', check)
  }, [])

  if (!hasSelection) return null

  const handleClick = () => {
    const text = getSelection()
    if (text) onStage(text)
  }

  return (
    <button onClick={handleClick}
      className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-md z-10 transition-all"
      style={{
        fontSize: 11,
        background: '#1C1917',
        color: '#F5F1EA',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
      <MessageSquare size={11} />
      添加到对话框
    </button>
  )
}

// ── ProcessedTab ──────────────────────────────────────────────

export function ProcessedTab({ onTableReady, onStageToChat }) {
  const { activeProjectId, activeExperimentId, activeTaskId } = useStore()
  const [rows, setRows] = useState([])
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const pasteRef = useRef(null)

  // Reset and reload when active task changes
  useEffect(() => {
    setRows([])
    setSaved(false)
    setSaveError(null)
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    fetch(`${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/files/processed/data.csv`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.content) return
        const parsed = parseClipboard(d.content)
        if (parsed.length > 1) { setRows(parsed); setSaved(true) }
      })
      .catch(() => {})
  }, [activeTaskId])

  const handlePaste = useCallback((e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    setRows(parseClipboard(text))
    setSaved(false)
  }, [])

  const handleGridChange = (next) => {
    setRows(next)
    setSaved(false)
  }

  const addRow = () => {
    if (!rows.length) return
    setRows(prev => [...prev, Array(prev[0].length).fill('')])
    setSaved(false)
  }

  const addCol = () => {
    if (!rows.length) return
    setRows(prev => prev.map((row, i) => [...row, i === 0 ? `col_${row.length}` : '']))
    setSaved(false)
    setSaveError(null)
  }

  const transpose = () => {
    if (!rows.length) return
    setRows(prev => prev[0].map((_, ci) => prev.map(row => row[ci] ?? '')))
    setSaved(false)
  }

  const saveToBackend = async () => {
    if (!rows.length || !activeProjectId || !activeExperimentId || !activeTaskId) return
    setSaveError(null)
    try {
      const resp = await fetch(
        `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/processed/data.csv`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        }
      )
      if (!resp.ok) {
        let detail = `HTTP ${resp.status}`
        try {
          const body = await resp.json()
          detail = body.detail || body.error || detail
        } catch {}
        throw new Error(detail)
      }
      setSaved(true)
      onTableReady?.(rows)
    } catch (e) {
      // Network errors (ECONNRESET, CORS, proxy failure) land here too
      setSaved(false)
      setSaveError(e.message || String(e))
    }
  }

  // Get text selection from the table area — tag it with the CSV path so the
  // agent knows what file it came from.
  const getTableSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || !sel.toString().trim()) return null
    const text = sel.toString().trim()
    return `[表格数据选中内容 (processed/data.csv)]\n${text}`
  }, [])

  const stageSelection = useCallback((text) => {
    if (onStageToChat && text) {
      onStageToChat(text)
    }
  }, [onStageToChat])

  const header = rows[0] ?? []
  const body = rows.slice(1)
  const types = header.map((_, ci) => inferType(body.map(r => r[ci])))

  return (
    <div className="flex flex-col h-full relative">
      {/* Paste zone */}
      <div
        ref={pasteRef}
        tabIndex={0}
        onPaste={handlePaste}
        className="mx-4 mt-3 mb-2 rounded-md border-2 border-dashed px-3 py-2.5 flex items-center gap-2 cursor-text focus:outline-none"
        style={{ borderColor: '#D6CFC2', background: 'rgba(255,255,255,0.4)', fontSize: 12, color: '#57534E' }}
        onClick={() => pasteRef.current?.focus()}
      >
        <span style={{ fontSize: 16 }}>📋</span>
        <span>从 Excel / Numbers 粘贴</span>
        <label className="ml-auto flex items-center gap-1 cursor-pointer" style={{ color: '#A8A29E', fontSize: 11 }}>
          <Upload size={11} />
          <span>上传文件</span>
          <input type="file" accept=".csv,.tsv,.xlsx,.json" className="hidden"
            onChange={async (e) => {
              const file = e.target.files[0]
              if (!file) return
              const text = await file.text()
              setRows(parseClipboard(text))
              setSaved(false)
            }} />
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: '#C4BEB7', fontSize: 12 }}>
          粘贴数据后在此显示
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 mb-1">
            <span style={{ fontSize: 11, color: '#A8A29E', fontFamily: 'JetBrains Mono, monospace' }}>
              {body.length} 行 × {header.length} 列
            </span>
            <span style={{ fontSize: 10, color: '#C4BEB7', fontFamily: 'JetBrains Mono, monospace' }}>
              双击编辑 · Shift+点击扩选 · ⌘C/⌘V
            </span>
            <button onClick={addRow} title="新增一行"
              className="ml-auto flex items-center gap-0.5 px-1.5 h-6 rounded"
              style={{ fontSize: 10.5, color: '#78716C', border: '1px solid #E7E0D1', fontFamily: 'JetBrains Mono, monospace' }}>
              <Plus size={10} />行
            </button>
            <button onClick={addCol} title="新增一列"
              className="flex items-center gap-0.5 px-1.5 h-6 rounded"
              style={{ fontSize: 10.5, color: '#78716C', border: '1px solid #E7E0D1', fontFamily: 'JetBrains Mono, monospace' }}>
              <Plus size={10} />列
            </button>
            <button onClick={transpose} title="转置"
              className="w-6 h-6 flex items-center justify-center rounded"
              style={{ color: '#78716C', border: '1px solid #E7E0D1' }}>
              <ArrowLeftRight size={11} />
            </button>
            <button onClick={() => { setRows([]); setSaved(false) }} title="清空"
              className="w-6 h-6 flex items-center justify-center rounded"
              style={{ color: '#78716C', border: '1px solid #E7E0D1' }}>
              <RefreshCw size={11} />
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-hidden mx-4 mb-3 rounded-md border flex"
            style={{ borderColor: '#E7E0D1', background: '#FFFFFF' }}>
            <DataGrid rows={rows} onChange={handleGridChange} types={types} />
          </div>

          {/* Send selection button */}
          <SendSelectionButton
            getSelection={getTableSelection}
            onStage={stageSelection}
          />
        </>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 flex flex-col gap-1.5">
        {saveError && (
          <div
            className="px-2 py-1.5 rounded-md text-xs"
            style={{
              background: 'rgba(220,38,38,0.08)',
              border: '1px solid rgba(220,38,38,0.3)',
              color: '#B91C1C',
            }}
          >
            保存失败：{saveError}
          </div>
        )}
        {rows.length > 0 && (
          <button onClick={saveToBackend}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs"
            style={{
              border: '1px solid #D6CFC2', color: saved ? '#0F766E' : '#44403C',
              background: saved ? 'rgba(15,118,110,0.06)' : 'transparent'
            }}>
            {saved ? '✓ 已保存' : '保存到 processed/data.csv'}
          </button>
        )}
      </div>
    </div>
  )
}


// ── ScriptTab — editable chart/plot.py, refreshes when SVG updates ──────────

export function ScriptTab({ onStageToChat }) {
  const { activeProjectId, activeExperimentId, activeTaskId, svgContent, fetchSvg, fetchGitLog } = useStore()
  const [code, setCode] = useState('')
  const [savedCode, setSavedCode] = useState('')  // track what's on disk
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [output, setOutput] = useState(null)

  const isModified = code !== savedCode

  useEffect(() => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    fetch(`${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/files/chart/plot.py`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const content = d?.content ?? '# chart/plot.py 尚未生成\n# 在右侧对话框告诉 agent 你想要什么图'
        setCode(content)
        setSavedCode(content)
      })
      .catch(() => {
        setCode('# 未找到 plot.py')
        setSavedCode('# 未找到 plot.py')
      })
  }, [activeProjectId, activeExperimentId, activeTaskId, svgContent])

  const saveCode = async () => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    setSaving(true)
    try {
      const r = await fetch(
        `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/files/chart/plot.py`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: code }),
        }
      )
      if (r.ok) {
        setSavedCode(code)
        setOutput({ ok: true, text: '已保存' })
        fetchGitLog()
      } else {
        setOutput({ ok: false, text: '保存失败' })
      }
    } catch {
      setOutput({ ok: false, text: '无法连接到后端' })
    } finally {
      setSaving(false)
    }
  }

  const run = async () => {
    // Auto-save before running if modified
    if (isModified) await saveCode()
    setRunning(true)
    setOutput(null)
    try {
      const r = await fetch(
        `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/render`,
        { method: 'GET' }
      )
      if (r.ok) {
        setOutput({ ok: true, text: '运行成功，预览已更新' })
        fetchSvg()
        fetchGitLog()
      } else {
        const d = await r.json().catch(() => ({}))
        setOutput({ ok: false, text: d.detail || '运行失败' })
      }
    } catch {
      setOutput({ ok: false, text: '无法连接到后端' })
    } finally {
      setRunning(false)
    }
  }

  // Get selected code text (works for CodeMirror contenteditable selection)
  const getCodeSelection = useCallback(() => {
    const sel = window.getSelection()
    const text = sel?.toString() ?? ''
    if (!text.trim()) return null
    return `[代码选中内容 (chart/plot.py)]\n\`\`\`python\n${text}\n\`\`\``
  }, [])

  const stageSelection = useCallback((text) => {
    if (onStageToChat && text) {
      onStageToChat(text)
    }
  }, [onStageToChat])

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: '#E7E0D1' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 11, color: '#A8A29E', fontFamily: 'JetBrains Mono, monospace' }}>chart/plot.py</span>
          {isModified && (
            <span style={{ fontSize: 9, color: '#B45309', fontFamily: 'JetBrains Mono, monospace' }}>● 未保存</span>
          )}
          <span style={{ fontSize: 10, color: '#C4BEB7', fontFamily: 'JetBrains Mono, monospace' }}>
            ⌘F 查找 · ⌘H 替换 · ⌘S 保存
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isModified && (
            <button onClick={saveCode} disabled={saving}
              className="flex items-center gap-1 px-2 py-1 rounded-md"
              style={{ fontSize: 11, border: '1px solid #D6CFC2', color: '#44403C' }}>
              {saving ? '保存中…' : '保存'}
            </button>
          )}
          <button onClick={run} disabled={running}
            className="flex items-center gap-1 px-2 py-1 rounded-md"
            style={{ fontSize: 11, background: running ? '#E7E0D1' : '#1C1917', color: running ? '#A8A29E' : '#F5F1EA' }}>
            {running ? <RotateCw size={10} className="spin" /> : <Play size={10} />}
            {running ? '运行中…' : '▶ 运行'}
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <CodeEditor value={code} onChange={setCode} onSave={saveCode} />
      </div>

      {/* Send selection button */}
      <SendSelectionButton
        getSelection={getCodeSelection}
        onStage={stageSelection}
      />

      {output && (
        <div className="px-4 py-2 border-t flex-shrink-0"
          style={{ borderColor: '#E7E0D1', fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            color: output.ok ? '#0F766E' : '#DC2626',
            background: output.ok ? 'rgba(15,118,110,0.04)' : 'rgba(220,38,38,0.04)' }}>
          {output.text}
        </div>
      )}
    </div>
  )
}
