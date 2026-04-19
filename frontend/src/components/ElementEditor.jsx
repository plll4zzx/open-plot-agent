import { useEffect, useMemo, useState } from 'react'
import { Send, X } from 'lucide-react'
import { useStore } from '../store'

// ── element introspection helpers ───────────────────────────────

function getAllTexts(element) {
  return Array.from(element?.querySelectorAll('text') ?? [])
}

function getTextContent(element) {
  // Concatenate all tspans across all <text> nodes.
  const texts = getAllTexts(element)
  if (!texts.length) return ''
  const lines = texts.map(t => {
    const tspans = t.querySelectorAll('tspan')
    if (tspans.length) return Array.from(tspans).map(s => s.textContent).join('')
    return t.textContent ?? ''
  })
  return lines.join('\n')
}

function setTextContent(element, newText) {
  const texts = getAllTexts(element)
  if (!texts.length) return
  // If there's only one <text> node, write to it. If more, we still overwrite
  // the first and clear the rest — matplotlib usually only emits one.
  const primary = texts[0]
  // Preserve existing tspan positioning by writing into first tspan if any.
  const tspans = primary.querySelectorAll('tspan')
  if (tspans.length === 1) {
    tspans[0].textContent = newText
  } else if (tspans.length > 1) {
    tspans[0].textContent = newText
    for (let i = 1; i < tspans.length; i++) tspans[i].textContent = ''
  } else {
    primary.textContent = newText
  }
}

function getFontSize(element) {
  const text = element?.querySelector('text')
  if (!text) return null
  // matplotlib usually emits style="font: 10px ..." — read computed style for reliability
  const computed = window.getComputedStyle(text).fontSize
  if (computed) {
    const m = computed.match(/([\d.]+)px/)
    if (m) return Math.round(parseFloat(m[1]) * 10) / 10
  }
  const attr = text.getAttribute('font-size')
  if (attr) return parseFloat(attr)
  return null
}

function setFontSize(element, px) {
  const texts = getAllTexts(element)
  texts.forEach(text => {
    // Update inline style font shorthand if present
    const style = text.getAttribute('style') || ''
    const fontMatch = style.match(/font:\s*[^;]+/i)
    if (fontMatch) {
      const newStyle = style.replace(
        /font:\s*[^;]+/i,
        (orig) => orig.replace(/(\d+(?:\.\d+)?)(px|pt)/, `${px}$2`)
      )
      text.setAttribute('style', newStyle)
    }
    text.setAttribute('font-size', `${px}px`)
    text.style.fontSize = `${px}px`
  })
}

function getFillColor(element) {
  const paths = element?.querySelectorAll('path, rect, polygon, circle') ?? []
  for (const p of paths) {
    const fill = p.getAttribute('fill') || p.style?.fill || ''
    if (fill && fill !== 'none' && fill !== 'transparent') return fill
  }
  return null
}

function getStrokeColor(element) {
  const paths = element?.querySelectorAll('path, polyline, line') ?? []
  for (const p of paths) {
    const stroke = p.getAttribute('stroke') || p.style?.stroke || ''
    if (stroke && stroke !== 'none') return stroke
  }
  return null
}

function toHex(color) {
  if (!color) return '#000000'
  if (color.startsWith('#')) {
    // Expand #rgb → #rrggbb
    if (color.length === 4) {
      return '#' + color.slice(1).split('').map(ch => ch + ch).join('')
    }
    return color.slice(0, 7)
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return '#000000'
  return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')
}

// ── element type classification ─────────────────────────────────

function classify(gid, element) {
  // Returns which editors to show
  const hasFill = !!getFillColor(element)
  const hasStroke = !!getStrokeColor(element)
  const hasText = getAllTexts(element).length > 0

  const isBar = /^(bar|patch)_\d+/.test(gid ?? '')
  const isLine = /^line_\d+/.test(gid ?? '')
  const isSemanticText = ['title', 'xlabel', 'ylabel'].includes(gid)
    || /^annotation_\d+/.test(gid ?? '')
    || /^legend_text_\d+/.test(gid ?? '')

  return {
    showFill: isBar || (hasFill && !isLine && !hasText),
    showStroke: isLine || (hasStroke && !hasFill),
    showText: isSemanticText || hasText,
    showFontSize: hasText,
    hasFill, hasStroke, hasText, isBar, isLine,
  }
}

// ── pending-edits API ───────────────────────────────────────────

async function postPendingEdit(projectId, experimentId, taskId, edit) {
  try {
    await fetch(
      `/api/projects/${projectId}/experiments/${experimentId}/tasks/${taskId}/pending-edits`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit),
      }
    )
  } catch (e) {
    console.warn('Failed to post pending edit:', e)
  }
}

// ── component ───────────────────────────────────────────────────

export function ElementEditor({ selected, onClose, onSendMessage }) {
  const { activeProjectId, activeExperimentId, activeTaskId, updateSvgContent } = useStore()
  const { gid, element, container } = selected ?? {}
  const kind = useMemo(() => classify(gid, element), [gid, element])

  const [fill, setFill] = useState('#E69F00')
  const [origFill, setOrigFill] = useState('#E69F00')
  const [stroke, setStroke] = useState('#1C1917')
  const [origStroke, setOrigStroke] = useState('#1C1917')
  const [text, setText] = useState('')
  const [origText, setOrigText] = useState('')
  const [fontSize, setFontSizeState] = useState(10)
  const [origFontSize, setOrigFontSize] = useState(10)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!element) return
    const f = getFillColor(element)
    const s = getStrokeColor(element)
    const t = getTextContent(element)
    const fs = getFontSize(element)
    const hf = f ? toHex(f) : '#E69F00'
    const hs = s ? toHex(s) : '#1C1917'
    setFill(hf); setOrigFill(hf)
    setStroke(hs); setOrigStroke(hs)
    setText(t); setOrigText(t)
    if (fs != null) { setFontSizeState(fs); setOrigFontSize(fs) }
    setNotice(null)
  }, [gid, element])

  const syncToStore = () => {
    const svg = container?.querySelector('svg')
    if (svg) updateSvgContent(svg.outerHTML)
  }

  // ── fill color ──────────────────────────────────────────
  const applyFill = (newColor) => {
    setFill(newColor)
    if (!element) return
    element.querySelectorAll('path, rect, polygon, circle').forEach(p => {
      const f = p.getAttribute('fill') || ''
      if (f !== 'none' && f !== 'transparent') {
        p.setAttribute('fill', newColor)
        p.style.fill = newColor
      }
    })
    syncToStore()
  }
  const commitFill = () => {
    if (fill !== origFill && activeProjectId) {
      postPendingEdit(activeProjectId, activeExperimentId, activeTaskId, {
        gid, property: 'fill', old_value: origFill, new_value: fill,
      })
      setOrigFill(fill)
      setNotice({ ok: true, text: '颜色已暂存，Agent 下次对话时同步写入 plot.py' })
    }
  }

  // ── stroke color ────────────────────────────────────────
  const applyStroke = (newColor) => {
    setStroke(newColor)
    if (!element) return
    element.querySelectorAll('path, polyline, line').forEach(p => {
      const s = p.getAttribute('stroke') || ''
      if (s && s !== 'none') {
        p.setAttribute('stroke', newColor)
        p.style.stroke = newColor
      }
    })
    syncToStore()
  }
  const commitStroke = () => {
    if (stroke !== origStroke && activeProjectId) {
      postPendingEdit(activeProjectId, activeExperimentId, activeTaskId, {
        gid, property: 'stroke', old_value: origStroke, new_value: stroke,
      })
      setOrigStroke(stroke)
      setNotice({ ok: true, text: '描边色已暂存' })
    }
  }

  // ── text ────────────────────────────────────────────────
  const applyText = () => {
    if (!element) return
    setTextContent(element, text)
    syncToStore()
    if (text !== origText && activeProjectId) {
      postPendingEdit(activeProjectId, activeExperimentId, activeTaskId, {
        gid, property: 'text', old_value: origText, new_value: text,
      })
      setOrigText(text)
      setNotice({ ok: true, text: '文字已暂存' })
    }
  }

  // ── font size ───────────────────────────────────────────
  const applyFontSize = (px) => {
    setFontSizeState(px)
    if (!element || !isFinite(px) || px <= 0) return
    setFontSize(element, px)
    syncToStore()
  }
  const commitFontSize = () => {
    if (fontSize !== origFontSize && activeProjectId) {
      postPendingEdit(activeProjectId, activeExperimentId, activeTaskId, {
        gid, property: 'font-size', old_value: String(origFontSize), new_value: String(fontSize),
      })
      setOrigFontSize(fontSize)
      setNotice({ ok: true, text: '字体大小已暂存' })
    }
  }

  // ── send-to-agent helpers ───────────────────────────────
  const sendMsg = (msg) => { onSendMessage?.(msg); onClose?.() }

  if (!selected) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-4"
        style={{ color: '#C4BEB7', fontSize: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🖱️</div>
        <div>在预览图中点击元素</div>
        <div style={{ marginTop: 4, color: '#D6CFC2', fontSize: 11 }}>
          支持文本 / 颜色 / 字体大小
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: '#E7E0D1' }}>
        <div className="min-w-0">
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#A8A29E' }}>ELEMENT</div>
          <div style={{
            fontSize: 14, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{gid}</div>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded flex-shrink-0"
          style={{ color: '#A8A29E', border: '1px solid #E7E0D1' }}>
          <X size={12} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {kind.showText && (
          <div>
            <label style={{ fontSize: 11, color: '#78716C', display: 'block', marginBottom: 6 }}>
              文字内容（回车/失焦生效）
            </label>
            <textarea value={text} onChange={e => setText(e.target.value)}
              onBlur={applyText}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applyText(); e.target.blur() }
              }}
              rows={Math.min(4, Math.max(1, (text.match(/\n/g) || []).length + 1))}
              className="w-full rounded px-2 py-1.5 outline-none mb-2 resize-none"
              style={{ fontSize: 12.5, border: '1px solid #D6CFC2', background: '#FFFFFF', fontFamily: 'inherit' }} />
          </div>
        )}

        {kind.showFontSize && (
          <div>
            <label style={{ fontSize: 11, color: '#78716C', display: 'block', marginBottom: 6 }}>
              字体大小（px）
            </label>
            <div className="flex items-center gap-2">
              <input type="range" min="6" max="48" step="0.5" value={fontSize}
                onChange={e => applyFontSize(parseFloat(e.target.value))}
                onMouseUp={commitFontSize}
                onTouchEnd={commitFontSize}
                className="flex-1" />
              <input type="number" min="4" max="96" step="0.5" value={fontSize}
                onChange={e => applyFontSize(parseFloat(e.target.value) || origFontSize)}
                onBlur={commitFontSize}
                className="w-16 rounded px-2 py-1 outline-none"
                style={{ fontSize: 12, border: '1px solid #D6CFC2', fontFamily: 'JetBrains Mono, monospace' }} />
            </div>
          </div>
        )}

        {kind.showFill && (
          <div>
            <label style={{ fontSize: 11, color: '#78716C', display: 'block', marginBottom: 6 }}>填充色（即时生效）</label>
            <div className="flex items-center gap-2">
              <input type="color" value={fill}
                onChange={e => applyFill(e.target.value)}
                onBlur={commitFill}
                onMouseUp={commitFill}
                style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid #D6CFC2', padding: 2, cursor: 'pointer' }} />
              <input value={fill}
                onChange={e => applyFill(e.target.value)}
                onBlur={commitFill}
                className="flex-1 rounded px-2 py-1.5 outline-none"
                style={{ fontSize: 12, border: '1px solid #D6CFC2', fontFamily: 'JetBrains Mono, monospace' }} />
            </div>
          </div>
        )}

        {kind.showStroke && (
          <div>
            <label style={{ fontSize: 11, color: '#78716C', display: 'block', marginBottom: 6 }}>描边色</label>
            <div className="flex items-center gap-2">
              <input type="color" value={stroke}
                onChange={e => applyStroke(e.target.value)}
                onBlur={commitStroke}
                onMouseUp={commitStroke}
                style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid #D6CFC2', padding: 2, cursor: 'pointer' }} />
              <input value={stroke}
                onChange={e => applyStroke(e.target.value)}
                onBlur={commitStroke}
                className="flex-1 rounded px-2 py-1.5 outline-none"
                style={{ fontSize: 12, border: '1px solid #D6CFC2', fontFamily: 'JetBrains Mono, monospace' }} />
            </div>
          </div>
        )}

        {!kind.showFill && !kind.showStroke && !kind.showText && (
          <div style={{ fontSize: 11.5, color: '#A8A29E', lineHeight: 1.5 }}>
            此元素暂不支持直接编辑。你可以描述改动让 Agent 修改。
          </div>
        )}

        <div className="mt-1 flex flex-col gap-1.5">
          <button
            onClick={() => sendMsg(`请修改 plot.py 让 ${gid} 的样式与当前预览保持一致（可能涉及文字、颜色、字体大小等改动）。`)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md"
            style={{ fontSize: 11.5, border: '1px solid #1C1917', background: '#1C1917', color: '#F5F1EA' }}>
            <Send size={10} />让 Agent 写回 plot.py
          </button>
        </div>

        {notice && (
          <div style={{
            fontSize: 11,
            color: notice.ok ? '#0F766E' : '#B45309',
            lineHeight: 1.5,
          }}>
            {notice.text}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#C4BEB7', lineHeight: 1.5 }}>
          改动即时可见；点击"让 Agent 写回 plot.py"让下次运行也保留改动。
        </div>
      </div>
    </div>
  )
}
