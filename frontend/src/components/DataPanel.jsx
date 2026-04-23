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

function SendSelectionButton({ getSelection, onStage, hasSelection: externalHasSelection }) {
  const [browserHasSelection, setBrowserHasSelection] = useState(false)

  useEffect(() => {
    const check = () => {
      const sel = window.getSelection()
      setBrowserHasSelection(!!(sel && sel.toString().trim().length > 0))
    }
    document.addEventListener('selectionchange', check)
    return () => document.removeEventListener('selectionchange', check)
  }, [])

  const visible = externalHasSelection !== undefined ? externalHasSelection : browserHasSelection
  if (!visible) return null

  const handleClick = () => {
    const text = getSelection()
    if (text) onStage(text)
  }

  return (
    <button onMouseDown={(e) => { e.preventDefault(); handleClick() }}
      className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-md z-10 transition-all"
      style={{
        fontSize: 11,
        background: '#1A2B3C',
        color: '#EBF4FA',
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

  const [gridSelText, setGridSelText] = useState('')

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
        style={{ borderColor: '#BDCFDF', background: 'rgba(255,255,255,0.4)', fontSize: 12, color: '#2E4A5E' }}
        onClick={() => pasteRef.current?.focus()}
      >
        <span style={{ fontSize: 16 }}>📋</span>
        <span>从 Excel / Numbers 粘贴</span>
        <label className="ml-auto flex items-center gap-1 cursor-pointer" style={{ color: '#7A99AE', fontSize: 11 }}>
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
        <div className="flex-1 flex items-center justify-center" style={{ color: '#9DB5C7', fontSize: 12 }}>
          粘贴数据后在此显示
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 mb-1">
            <span style={{ fontSize: 11, color: '#7A99AE', fontFamily: 'JetBrains Mono, monospace' }}>
              {body.length} 行 × {header.length} 列
            </span>
            <span style={{ fontSize: 10, color: '#9DB5C7', fontFamily: 'JetBrains Mono, monospace' }}>
              双击编辑 · Shift+点击扩选 · ⌘C/⌘V
            </span>
            <button onClick={addRow} title="新增一行"
              className="ml-auto flex items-center gap-0.5 px-1.5 h-6 rounded"
              style={{ fontSize: 10.5, color: '#4A6478', border: '1px solid #CFE0ED', fontFamily: 'JetBrains Mono, monospace' }}>
              <Plus size={10} />行
            </button>
            <button onClick={addCol} title="新增一列"
              className="flex items-center gap-0.5 px-1.5 h-6 rounded"
              style={{ fontSize: 10.5, color: '#4A6478', border: '1px solid #CFE0ED', fontFamily: 'JetBrains Mono, monospace' }}>
              <Plus size={10} />列
            </button>
            <button onClick={transpose} title="转置"
              className="w-6 h-6 flex items-center justify-center rounded"
              style={{ color: '#4A6478', border: '1px solid #CFE0ED' }}>
              <ArrowLeftRight size={11} />
            </button>
            <button onClick={() => { setRows([]); setSaved(false) }} title="清空"
              className="w-6 h-6 flex items-center justify-center rounded"
              style={{ color: '#4A6478', border: '1px solid #CFE0ED' }}>
              <RefreshCw size={11} />
            </button>
          </div>

          {/* Table — explicit block container so AG Grid can measure height */}
          <div className="flex-1 overflow-hidden mx-4 mb-3 rounded-md border"
            style={{ borderColor: '#CFE0ED', background: '#FFFFFF', display: 'block', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <DataGrid rows={rows} onChange={handleGridChange} types={types} onSelectionChange={setGridSelText} />
            </div>
          </div>

          {/* Send selection button */}
          <SendSelectionButton
            getSelection={() => gridSelText.trim() ? `<table_selection source="processed/data.csv">\n${gridSelText.trim()}\n</table_selection>` : null}
            hasSelection={!!gridSelText.trim()}
            onStage={(text) => onStageToChat?.(text)}
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
              border: '1px solid #BDCFDF', color: saved ? '#1A7DC4' : '#1F3547',
              background: saved ? 'rgba(26,125,196,0.06)' : 'transparent'
            }}>
            {saved ? '✓ 已保存' : '保存到 processed/data.csv'}
          </button>
        )}
      </div>
    </div>
  )
}


// ── ScriptTab — two-stage pipeline: data_prep.py + plot.py ──────────────────

const SCRIPT_FILES = [
  { key: 'data_prep', path: 'chart/data_prep.py', label: 'data_prep.py', canRun: false },
  { key: 'plot',      path: 'chart/plot.py',      label: 'plot.py',      canRun: true },
]

const PLACEHOLDERS = {
  'chart/data_prep.py': '# chart/data_prep.py 尚未生成\n# Agent 将在此实现 get_data() 函数',
  'chart/plot.py':      '# chart/plot.py 尚未生成\n# 在右侧对话框告诉 agent 你想要什么图',
}

export function ScriptTab({ onStageToChat }) {
  const { activeProjectId, activeExperimentId, activeTaskId, svgContent, fetchSvg, fetchGitLog } = useStore()
  const [activeFile, setActiveFile] = useState('plot')
  const [codes, setCodes] = useState({ data_prep: '', plot: '' })
  const [savedCodes, setSavedCodes] = useState({ data_prep: '', plot: '' })
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [output, setOutput] = useState(null)
  const [monacoSelection, setMonacoSelection] = useState('')

  const fileMeta = SCRIPT_FILES.find(f => f.key === activeFile)
  const code = codes[activeFile] ?? ''
  const savedCode = savedCodes[activeFile] ?? ''
  const isModified = code !== savedCode

  // Load both files when task changes
  useEffect(() => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    setOutput(null)
    setMonacoSelection('')
    const base = `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/files`
    SCRIPT_FILES.forEach(({ key, path }) => {
      fetch(`${base}/${path}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const content = d?.content ?? PLACEHOLDERS[path]
          setCodes(prev => ({ ...prev, [key]: content }))
          setSavedCodes(prev => ({ ...prev, [key]: content }))
        })
        .catch(() => {
          const content = PLACEHOLDERS[path]
          setCodes(prev => ({ ...prev, [key]: content }))
          setSavedCodes(prev => ({ ...prev, [key]: content }))
        })
    })
  }, [activeProjectId, activeExperimentId, activeTaskId])

  // Reload plot.py when SVG updates (agent may have rewritten it)
  useEffect(() => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId || !svgContent) return
    SCRIPT_FILES.forEach(({ key, path }) => {
      fetch(`${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/files/${path}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.content) return
          setCodes(prev => ({ ...prev, [key]: d.content }))
          setSavedCodes(prev => ({ ...prev, [key]: d.content }))
        })
        .catch(() => {})
    })
  }, [svgContent])

  const saveCode = async () => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    setSaving(true)
    try {
      const r = await fetch(
        `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/files/${fileMeta.path}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: code }),
        }
      )
      if (r.ok) {
        setSavedCodes(prev => ({ ...prev, [activeFile]: code }))
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

  const stageSelection = useCallback((text) => {
    if (onStageToChat && text) onStageToChat(text)
  }, [onStageToChat])

  return (
    <div className="flex flex-col h-full relative">
      {/* File tabs + toolbar */}
      <div className="border-b flex-shrink-0" style={{ borderColor: '#CFE0ED' }}>
        <div className="flex items-center px-2 pt-1">
          {SCRIPT_FILES.map(f => (
            <button key={f.key}
              onClick={() => { setActiveFile(f.key); setOutput(null); setMonacoSelection('') }}
              className="px-3 py-1.5 transition"
              style={{
                fontSize: 10.5,
                fontFamily: 'JetBrains Mono, monospace',
                color: activeFile === f.key ? '#1A2B3C' : '#7A99AE',
                fontWeight: activeFile === f.key ? 600 : 400,
                borderBottom: activeFile === f.key ? '2px solid #1A2B3C' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 py-1.5">
          <div className="flex items-center gap-2">
            {isModified && (
              <span style={{ fontSize: 9, color: '#1668A8', fontFamily: 'JetBrains Mono, monospace' }}>● 未保存</span>
            )}
            <span style={{ fontSize: 10, color: '#9DB5C7', fontFamily: 'JetBrains Mono, monospace' }}>
              ⌘F 查找 · ⌘S 保存
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isModified && (
              <button onClick={saveCode} disabled={saving}
                className="flex items-center gap-1 px-2 py-1 rounded-md"
                style={{ fontSize: 11, border: '1px solid #BDCFDF', color: '#1F3547' }}>
                {saving ? '保存中…' : '保存'}
              </button>
            )}
            {fileMeta.canRun && (
              <button onClick={run} disabled={running}
                className="flex items-center gap-1 px-2 py-1 rounded-md"
                style={{ fontSize: 11, background: running ? '#CFE0ED' : '#1A2B3C', color: running ? '#7A99AE' : '#EBF4FA' }}>
                {running ? <RotateCw size={10} className="spin" /> : <Play size={10} />}
                {running ? '运行中…' : '▶ 运行'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <CodeEditor value={code}
          onChange={v => setCodes(prev => ({ ...prev, [activeFile]: v }))}
          onSave={saveCode}
          onSelectionChange={setMonacoSelection} />
      </div>

      {monacoSelection && (
        <button
          onMouseDown={(e) => {
            e.preventDefault()
            const text = `<code_selection source="${fileMeta.path}">\n\`\`\`python\n${monacoSelection}\n\`\`\`\n</code_selection>`
            stageSelection(text)
          }}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg shadow-md z-10 transition-all"
          style={{ fontSize: 11, background: '#1A2B3C', color: '#EBF4FA', border: '1px solid rgba(255,255,255,0.1)' }}>
          <MessageSquare size={11} />
          添加到对话框
        </button>
      )}

      {output && (
        <div className="px-4 py-2 border-t flex-shrink-0"
          style={{ borderColor: '#CFE0ED', fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            color: output.ok ? '#1A7DC4' : '#DC2626',
            background: output.ok ? 'rgba(26,125,196,0.04)' : 'rgba(220,38,38,0.04)' }}>
          {output.text}
        </div>
      )}
    </div>
  )
}
