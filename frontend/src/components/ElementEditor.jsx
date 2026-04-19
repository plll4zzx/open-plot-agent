import { useEffect, useState, useCallback, useRef } from 'react'
import { Send, X, Save, Type, Palette, Move, Loader2 } from 'lucide-react'
import { useStore } from '../store'

// ── DOM helpers ──────────────────────────────────────────────

function findElement(container, gid) {
  if (!container || !gid) return null
  try {
    return container.querySelector(`#${CSS.escape(gid)}`)
  } catch {
    return container.querySelector(`[id="${gid}"]`)
  }
}

function getBarColor(element) {
  if (!element) return '#E69F00'
  const paths = element.querySelectorAll('path, rect, polygon, circle')
  for (const p of paths) {
    const fill = p.getAttribute('fill') || p.style?.fill || ''
    if (fill && fill !== 'none' && fill !== 'transparent') return fill
  }
  return '#E69F00'
}

function getTextContent(element) {
  if (!element) return ''
  const tspan = element.querySelector('tspan')
  if (tspan) return tspan.textContent
  const text = element.querySelector('text')
  return text?.textContent ?? ''
}

function getStrokeWidth(element) {
  if (!element) return null
  const paths = element.querySelectorAll('path, line, polyline')
  for (const p of paths) {
    const sw = p.getAttribute('stroke-width') || p.style?.strokeWidth
    if (sw) return parseFloat(sw)
  }
  return null
}

function getFontSize(element) {
  if (!element) return null
  const textEl = element.querySelector('text') || element
  const fs = textEl.getAttribute('font-size') || textEl.style?.fontSize
  if (fs) return parseFloat(fs)
  return null
}

function toHex(color) {
  if (!color || color.startsWith('#')) return color || '#000000'
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return color
  return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')
}

// ── CodePatcher API call ────────────────────────────────────

async function callPatchCode(projectId, experimentId, taskId, gid, property, value) {
  const r = await fetch(
    `/api/projects/${projectId}/experiments/${experimentId}/tasks/${taskId}/patch-code`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gid, property, value: String(value) }),
    }
  )
  return r.json()
}

// ── Quick color presets ──────────────────────────────────────

const QUICK_COLORS = [
  '#E69F00', '#56B4E9', '#009E73', '#F0E442',
  '#0072B2', '#D55E00', '#CC79A7', '#1C1917',
  '#DC2626', '#059669', '#7C3AED', '#EA580C',
]

// ── Main component ───────────────────────────────────────────

export function ElementEditor({ selected, onClose, onSendMessage }) {
  const { activeProjectId, activeExperimentId, activeTaskId, updateSvgContent, fetchGitLog } = useStore()
  const { gid, container } = selected ?? {}

  const isBar = gid?.startsWith('bar_') || gid?.startsWith('line_') || gid?.startsWith('patch_') || gid?.startsWith('scatter_')
  const isText = ['title', 'xlabel', 'ylabel'].includes(gid) || gid?.startsWith('annotation_')
  const isLegend = gid === 'legend'

  const [color, setColor] = useState('#E69F00')
  const [origColor, setOrigColor] = useState('#E69F00')
  const [text, setText] = useState('')
  const [origText, setOrigText] = useState('')
  const [fontSize, setFontSize] = useState(null)
  const [origFontSize, setOrigFontSize] = useState(null)
  const [strokeWidth, setStrokeWidth] = useState(null)
  const [origStrokeWidth, setOrigStrokeWidth] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // null | 'success' | 'error'
  const [saveMessage, setSaveMessage] = useState('')

  // Always look up the live DOM element by gid
  const getElement = useCallback(() => {
    return findElement(container, gid)
  }, [container, gid])

  // Initialize state when selection changes
  useEffect(() => {
    const el = getElement()
    if (!el) return

    if (isBar) {
      const c = toHex(getBarColor(el))
      setColor(c)
      setOrigColor(c)
      const sw = getStrokeWidth(el)
      setStrokeWidth(sw)
      setOrigStrokeWidth(sw)
    }
    if (isText) {
      const t = getTextContent(el)
      setText(t)
      setOrigText(t)
      const fs = getFontSize(el)
      setFontSize(fs)
      setOrigFontSize(fs)
    }
    setSaveStatus(null)
    setSaveMessage('')
  }, [gid, container, isBar, isText, getElement])

  // ── Live DOM preview (instant visual feedback) ────────────

  const applyColorPreview = useCallback((newColor) => {
    setColor(newColor)
    const el = getElement()
    if (!el) return
    el.querySelectorAll('path, rect, polygon, circle').forEach(p => {
      const fill = p.getAttribute('fill') || ''
      if (fill !== 'none' && fill !== 'transparent') {
        p.setAttribute('fill', newColor)
        p.style.fill = newColor
      }
    })
  }, [getElement])

  const applyTextPreview = useCallback(() => {
    const el = getElement()
    if (!el) return
    const tspan = el.querySelector('tspan')
    if (tspan) {
      tspan.textContent = text
    } else {
      const textEl = el.querySelector('text')
      if (textEl) textEl.textContent = text
    }
  }, [text, getElement])

  const applyFontSizePreview = useCallback((newSize) => {
    setFontSize(newSize)
    const el = getElement()
    if (!el) return
    const textEl = el.querySelector('text') || el
    textEl.setAttribute('font-size', newSize)
  }, [getElement])

  const applyStrokeWidthPreview = useCallback((newWidth) => {
    setStrokeWidth(newWidth)
    const el = getElement()
    if (!el) return
    el.querySelectorAll('path, line, polyline').forEach(p => {
      p.setAttribute('stroke-width', newWidth)
      p.style.strokeWidth = newWidth
    })
  }, [getElement])

  // ── Save via CodePatcher (deterministic, no LLM) ──────────

  const saveViaPatcher = useCallback(async (prop, value) => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    setSaving(true)
    setSaveStatus(null)
    try {
      const result = await callPatchCode(
        activeProjectId, activeExperimentId, activeTaskId,
        gid, prop, value
      )
      if (result.ok) {
        setSaveStatus('success')
        setSaveMessage(result.message || '已保存')
        // Update SVG in store from server response
        if (result.svg_content) {
          updateSvgContent(result.svg_content)
        }
        fetchGitLog?.()
        // Update originals so diff tracking resets
        if (prop === 'fill' || prop === 'color') setOrigColor(value)
        if (prop === 'text') setOrigText(value)
        if (prop === 'font-size') setOrigFontSize(parseFloat(value))
        if (prop === 'stroke-width') setOrigStrokeWidth(parseFloat(value))
      } else {
        setSaveStatus('error')
        setSaveMessage(result.error || '保存失败')
      }
    } catch (e) {
      setSaveStatus('error')
      setSaveMessage(`请求失败: ${e.message}`)
    } finally {
      setSaving(false)
      // Clear status after 3 seconds
      setTimeout(() => { setSaveStatus(null); setSaveMessage('') }, 3000)
    }
  }, [gid, activeProjectId, activeExperimentId, activeTaskId, updateSvgContent, fetchGitLog])

  // ── Close handler ─────────────────────────────────────────

  const handleClose = useCallback(() => {
    onClose?.()
  }, [onClose])

  const sendMsg = useCallback((msg) => {
    onSendMessage?.(msg)
    onClose?.()
  }, [onSendMessage, onClose])

  // ── Render: empty state ───────────────────────────────────

  if (!selected) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-4"
        style={{ color: '#C4BEB7', fontSize: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🖱️</div>
        <div>在预览图中点击元素</div>
        <div style={{ marginTop: 4, color: '#D6CFC2', fontSize: 11 }}>支持标题、轴标签、柱/线条</div>
      </div>
    )
  }

  // ── Render: editor ────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: '#E7E0D1' }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#A8A29E' }}>ELEMENT</div>
          <div style={{ fontSize: 14, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic' }}>{gid}</div>
        </div>
        <button onClick={handleClose} className="w-6 h-6 flex items-center justify-center rounded"
          style={{ color: '#A8A29E', border: '1px solid #E7E0D1' }}>
          <X size={12} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Color section */}
        {isBar && (
          <div>
            <label className="flex items-center gap-1.5"
              style={{ fontSize: 11, color: '#78716C', marginBottom: 6 }}>
              <Palette size={11} /> 填充颜色
            </label>

            {/* Quick color presets */}
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {QUICK_COLORS.map(c => (
                <button key={c}
                  onClick={() => applyColorPreview(c)}
                  className="w-5 h-5 rounded-sm border"
                  style={{
                    background: c,
                    borderColor: color === c ? '#1C1917' : '#D6CFC2',
                    borderWidth: color === c ? 2 : 1,
                  }} />
              ))}
            </div>

            {/* Color picker + hex input */}
            <div className="flex items-center gap-2 mb-3">
              <input type="color" value={color}
                onChange={e => applyColorPreview(e.target.value)}
                style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid #D6CFC2', padding: 2, cursor: 'pointer' }} />
              <input value={color}
                onChange={e => applyColorPreview(e.target.value)}
                className="flex-1 rounded px-2 py-1.5 outline-none"
                style={{ fontSize: 12, border: '1px solid #D6CFC2', fontFamily: 'JetBrains Mono, monospace' }} />
            </div>

            {/* Save color button — uses CodePatcher, no LLM */}
            <button
              onClick={() => saveViaPatcher('fill', color)}
              disabled={saving || color === origColor}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md"
              style={{
                fontSize: 11.5,
                border: '1px solid #D6CFC2',
                color: saving ? '#A8A29E' : (color !== origColor ? '#1C1917' : '#A8A29E'),
                background: color !== origColor ? 'rgba(15,118,110,0.06)' : 'transparent',
              }}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={10} />}
              {saving ? '保存中…' : '保存到 plot.py'}
            </button>

            {/* Stroke width for lines — auto-saves on release */}
            {strokeWidth !== null && (
              <>
                <label className="flex items-center gap-1.5"
                  style={{ fontSize: 11, color: '#78716C', marginBottom: 4, marginTop: 8 }}>
                  线条宽度
                  {strokeWidth !== origStrokeWidth && (
                    <span style={{ fontSize: 9, color: '#B45309', fontFamily: 'JetBrains Mono, monospace' }}>● 未保存</span>
                  )}
                </label>
                <input type="range" min="0.5" max="8" step="0.5"
                  value={strokeWidth}
                  onChange={e => applyStrokeWidthPreview(parseFloat(e.target.value))}
                  onPointerUp={() => {
                    if (strokeWidth !== origStrokeWidth) saveViaPatcher('stroke-width', strokeWidth)
                  }}
                  className="w-full mb-1"
                  style={{ accentColor: '#7C3AED' }}
                  title="松开鼠标自动保存到 plot.py" />
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 10, color: '#A8A29E', fontFamily: 'JetBrains Mono, monospace' }}>
                    {strokeWidth}px
                  </span>
                  <span style={{ fontSize: 9.5, color: '#C4BEB7' }}>
                    松开自动保存
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Text section */}
        {isText && (
          <div>
            <label className="flex items-center gap-1.5"
              style={{ fontSize: 11, color: '#78716C', marginBottom: 6 }}>
              <Type size={11} /> 文字内容
            </label>
            <input value={text} onChange={e => setText(e.target.value)}
              onBlur={applyTextPreview}
              onKeyDown={e => { if (e.key === 'Enter') applyTextPreview() }}
              className="w-full rounded px-2 py-1.5 outline-none mb-2"
              style={{ fontSize: 12.5, border: '1px solid #D6CFC2' }} />

            <button
              onClick={() => saveViaPatcher('text', text)}
              disabled={saving || text === origText}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md mb-3"
              style={{
                fontSize: 11.5,
                border: '1px solid #D6CFC2',
                color: saving ? '#A8A29E' : (text !== origText ? '#1C1917' : '#A8A29E'),
                background: text !== origText ? 'rgba(15,118,110,0.06)' : 'transparent',
              }}>
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={10} />}
              {saving ? '保存中…' : '保存到 plot.py'}
            </button>

            {/* Font size slider — auto-saves on release */}
            {fontSize !== null && (
              <>
                <label className="flex items-center gap-1.5"
                  style={{ fontSize: 11, color: '#78716C', marginBottom: 4 }}>
                  字号
                  {fontSize !== origFontSize && (
                    <span style={{ fontSize: 9, color: '#B45309', fontFamily: 'JetBrains Mono, monospace' }}>● 未保存</span>
                  )}
                </label>
                <input type="range" min="6" max="32" step="0.5"
                  value={fontSize}
                  onChange={e => applyFontSizePreview(parseFloat(e.target.value))}
                  onPointerUp={() => {
                    if (fontSize !== origFontSize) saveViaPatcher('font-size', fontSize)
                  }}
                  className="w-full mb-1"
                  style={{ accentColor: '#7C3AED' }}
                  title="松开鼠标自动保存到 plot.py" />
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 10, color: '#A8A29E', fontFamily: 'JetBrains Mono, monospace' }}>
                    {fontSize}pt
                  </span>
                  <span style={{ fontSize: 9.5, color: '#C4BEB7' }}>
                    松开自动保存
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Legend dragging hint */}
        {isLegend && (
          <div className="rounded-md p-3"
            style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Move size={13} style={{ color: '#7C3AED' }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#1C1917' }}>图例可直接拖拽</span>
            </div>
            <div style={{ fontSize: 11, color: '#57534E', lineHeight: 1.5 }}>
              在预览图中按住图例并拖动到新位置，松开即自动保存到 plot.py。
              如需用文字说明（如"放到图外右上"），可用下方对话框发给 Agent。
            </div>
          </div>
        )}

        {/* Context suggestion — send selected element info to agent */}
        <div className="pt-2 border-t" style={{ borderColor: '#E7E0D1' }}>
          <label style={{ fontSize: 11, color: '#78716C', display: 'block', marginBottom: 6 }}>
            复杂修改？让 Agent 帮忙
          </label>
          <AgentPromptBox
            gid={gid}
            color={color}
            text={text}
            onSend={sendMsg}
          />
        </div>

        {/* Status */}
        <div style={{ fontSize: 11, lineHeight: 1.5 }}>
          {saveStatus === 'success' && (
            <span style={{ color: '#0F766E' }}>✓ {saveMessage}</span>
          )}
          {saveStatus === 'error' && (
            <span style={{ color: '#DC2626' }}>✗ {saveMessage}</span>
          )}
          {!saveStatus && (
            <span style={{ color: '#C4BEB7' }}>
              滑块调整松开自动保存；颜色/文字点"保存"即写回 plot.py（均不经过 Agent）。
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Agent prompt box (for complex edits that need LLM) ──────

function AgentPromptBox({ gid, color, text, onSend }) {
  const [prompt, setPrompt] = useState('')

  const contextHint = gid?.startsWith('bar_') || gid?.startsWith('line_') || gid?.startsWith('scatter_')
    ? `已选中 ${gid}，当前颜色 ${color}`
    : ['title', 'xlabel', 'ylabel'].includes(gid)
      ? `已选中 ${gid}，当前文字：${text}`
      : `已选中 ${gid}`

  const submit = () => {
    if (!prompt.trim()) return
    onSend(`[上下文: ${contextHint}] ${prompt}`)
    setPrompt('')
  }

  return (
    <div className="flex gap-1.5">
      <input
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder={`例如：加误差线、改成渐变色…`}
        className="flex-1 rounded px-2 py-1.5 outline-none"
        style={{ fontSize: 11.5, border: '1px solid #D6CFC2' }}
      />
      <button onClick={submit} disabled={!prompt.trim()}
        className="px-2 py-1.5 rounded"
        style={{
          fontSize: 11,
          background: prompt.trim() ? '#1C1917' : '#E7E0D1',
          color: prompt.trim() ? '#F5F1EA' : '#A8A29E',
        }}>
        <Send size={11} />
      </button>
    </div>
  )
}
