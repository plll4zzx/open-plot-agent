import { useEffect, useState } from 'react'
import { Send, X, Save } from 'lucide-react'
import { useStore } from '../store'

function getBarColor(element) {
  const paths = element?.querySelectorAll('path, rect, polygon, circle') ?? []
  for (const p of paths) {
    const fill = p.getAttribute('fill') || p.style?.fill || ''
    if (fill && fill !== 'none' && fill !== 'transparent') return fill
  }
  return '#E69F00'
}

function getTextContent(element) {
  const tspan = element?.querySelector('tspan')
  if (tspan) return tspan.textContent
  const text = element?.querySelector('text')
  return text?.textContent ?? ''
}

function toHex(color) {
  if (!color || color.startsWith('#')) return color || '#000000'
  // Convert rgb(...) to hex if needed
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return color
  return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')
}

/**
 * Post a pending edit to the backend so the agent can pick it up.
 */
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

export function ElementEditor({ selected, onClose, onSendMessage }) {
  const { activeProjectId, activeExperimentId, activeTaskId, updateSvgContent } = useStore()
  const { gid, element, container } = selected ?? {}
  const isBar = gid?.startsWith('bar_') || gid?.startsWith('line_')
  const isText = ['title', 'xlabel', 'ylabel'].includes(gid) || gid?.startsWith('annotation_')

  const [color, setColor] = useState('#E69F00')
  const [origColor, setOrigColor] = useState('#E69F00')
  const [text, setText] = useState('')
  const [origText, setOrigText] = useState('')
  const [editsSaved, setEditsSaved] = useState(false)

  useEffect(() => {
    if (!element) return
    if (isBar) {
      const c = toHex(getBarColor(element))
      setColor(c)
      setOrigColor(c)
    }
    if (isText) {
      const t = getTextContent(element)
      setText(t)
      setOrigText(t)
    }
    setEditsSaved(false)
  }, [gid, element, isBar, isText])

  const syncToStore = () => {
    const svg = container?.querySelector('svg')
    if (svg) updateSvgContent(svg.outerHTML)
  }

  const applyColor = (newColor) => {
    setColor(newColor)
    if (!element) return
    element.querySelectorAll('path, rect, polygon, circle').forEach(p => {
      const fill = p.getAttribute('fill') || ''
      if (fill !== 'none' && fill !== 'transparent') {
        p.setAttribute('fill', newColor)
        p.style.fill = newColor
      }
    })
    syncToStore()
  }

  // When color picker loses focus or user stops dragging, record the edit
  const commitColorEdit = () => {
    if (color !== origColor && activeProjectId && activeExperimentId && activeTaskId) {
      postPendingEdit(activeProjectId, activeExperimentId, activeTaskId, {
        gid,
        property: 'fill',
        old_value: origColor,
        new_value: color,
      })
      setOrigColor(color)
      setEditsSaved(true)
    }
  }

  const applyText = () => {
    if (!element) return
    const tspan = element.querySelector('tspan')
    if (tspan) {
      tspan.textContent = text
    } else {
      const textEl = element.querySelector('text')
      if (textEl) textEl.textContent = text
    }
    syncToStore()
    // Record text edit
    if (text !== origText && activeProjectId && activeExperimentId && activeTaskId) {
      postPendingEdit(activeProjectId, activeExperimentId, activeTaskId, {
        gid,
        property: 'text',
        old_value: origText,
        new_value: text,
      })
      setOrigText(text)
      setEditsSaved(true)
    }
  }

  const sendMsg = (msg) => { onSendMessage?.(msg); onClose?.() }

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

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: '#E7E0D1' }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#A8A29E' }}>ELEMENT</div>
          <div style={{ fontSize: 14, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic' }}>{gid}</div>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded"
          style={{ color: '#A8A29E', border: '1px solid #E7E0D1' }}>
          <X size={12} />
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {isBar && (
          <div>
            <label style={{ fontSize: 11, color: '#78716C', display: 'block', marginBottom: 6 }}>填充颜色（即时生效）</label>
            <div className="flex items-center gap-2 mb-3">
              <input type="color" value={color}
                onChange={e => applyColor(e.target.value)}
                onBlur={commitColorEdit}
                onMouseUp={commitColorEdit}
                style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid #D6CFC2', padding: 2, cursor: 'pointer' }} />
              <input value={color}
                onChange={e => applyColor(e.target.value)}
                onBlur={commitColorEdit}
                className="flex-1 rounded px-2 py-1.5 outline-none"
                style={{ fontSize: 12, border: '1px solid #D6CFC2', fontFamily: 'JetBrains Mono, monospace' }} />
            </div>
            <button onClick={() => sendMsg(`请将 ${gid} 的颜色永久改为 ${color}，并更新 chart/plot.py`)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md"
              style={{ fontSize: 11.5, border: '1px solid #D6CFC2', color: '#44403C' }}>
              <Send size={10} />保存颜色到 plot.py
            </button>
          </div>
        )}

        {isText && (
          <div>
            <label style={{ fontSize: 11, color: '#78716C', display: 'block', marginBottom: 6 }}>文字内容</label>
            <input value={text} onChange={e => setText(e.target.value)}
              onBlur={applyText}
              className="w-full rounded px-2 py-1.5 outline-none mb-3"
              style={{ fontSize: 12.5, border: '1px solid #D6CFC2' }} />
            <button onClick={() => sendMsg(`请将 ${gid} 的文字改为"${text}"，并更新 chart/plot.py`)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md"
              style={{ fontSize: 11.5, border: '1px solid #D6CFC2', color: '#44403C' }}>
              <Send size={10} />让 Agent 修改
            </button>
          </div>
        )}

        <div style={{ fontSize: 11, color: '#C4BEB7', lineHeight: 1.5 }}>
          {editsSaved
            ? <span style={{ color: '#0F766E' }}>✓ 编辑已记录，Agent 下次对话时会自动同步到 plot.py</span>
            : '颜色改动即时显示，点击"保存到 plot.py"让 agent 写入脚本使改动永久生效。'
          }
        </div>
      </div>
    </div>
  )
}
