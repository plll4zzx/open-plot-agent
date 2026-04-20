import { useState } from 'react'
import { Plus, Check, Trash2 } from 'lucide-react'
import { useStore } from '../store'

const BUILT_IN = [
  { name: 'Okabe-Ito', colors: ['#E69F00','#56B4E9','#009E73','#F0E442','#0072B2','#D55E00','#CC79A7'] },
  { name: 'Tab10',     colors: ['#1F77B4','#FF7F0E','#2CA02C','#D62728','#9467BD','#8C564B','#E377C2'] },
  { name: 'Set2',      colors: ['#66C2A5','#FC8D62','#8DA0CB','#E78AC3','#A6D854','#FFD92F','#E5C494'] },
  { name: 'Dark2',     colors: ['#1B9E77','#D95F02','#7570B3','#E7298A','#66A61E','#E6AB02','#A6761D'] },
  { name: 'Pastel',    colors: ['#FBB4AE','#B3CDE3','#CCEBC5','#DECBE4','#FED9A6','#FFFFCC','#E5D8BD'] },
]

function extractCurrentColors(svgContent) {
  if (!svgContent) return []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const colors = []
    let i = 0
    while (i < 20) {
      const barEl = doc.getElementById(`bar_${i}`) || doc.getElementById(`line_${i}`)
      if (!barEl) break
      const path = barEl.querySelector('path, rect, polygon, circle, polyline')
      const fill = path?.getAttribute('fill')
      const stroke = path?.getAttribute('stroke')
      const c = (fill && fill !== 'none') ? fill : stroke
      if (c && c !== 'none') colors.push(c)
      i++
    }
    return colors
  } catch { return [] }
}

function applyPaletteToSvg(svgContent, palette) {
  if (!svgContent) return svgContent
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    let i = 0
    while (i < 20) {
      const barEl = doc.getElementById(`bar_${i}`) || doc.getElementById(`line_${i}`)
      if (!barEl) break
      const color = palette[i % palette.length]
      barEl.querySelectorAll('path, rect, polygon, circle').forEach(p => {
        if ((p.getAttribute('fill') || '') !== 'none') p.setAttribute('fill', color)
      })
      barEl.querySelectorAll('polyline, path[stroke]').forEach(p => {
        if (p.getAttribute('stroke') && p.getAttribute('stroke') !== 'none')
          p.setAttribute('stroke', color)
      })
      i++
    }
    return new XMLSerializer().serializeToString(doc.documentElement)
  } catch { return svgContent }
}

/** Apply palette directly: preview client-side, persist via backend. */
export async function applyPaletteDirect({
  svgContent, palette, activeProjectId, activeExperimentId, activeTaskId,
  updateSvgContent, fetchGitLog, onNotice,
}) {
  const oldColors = extractCurrentColors(svgContent)
  if (!oldColors.length) {
    onNotice?.({ ok: false, text: '未检测到可替换的颜色' })
    return
  }
  const newColors = oldColors.map((_, i) => palette[i % palette.length])

  // 1) Immediate client-side preview
  updateSvgContent(applyPaletteToSvg(svgContent, palette))

  // 2) Persist to plot.py + re-render on backend
  if (!activeProjectId || !activeExperimentId || !activeTaskId) return
  try {
    const r = await fetch(
      `/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/palette`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_colors: oldColors, new_colors: newColors, rerun: true }),
      }
    )
    if (!r.ok) {
      const detail = await r.json().catch(() => ({}))
      onNotice?.({ ok: false, text: detail.detail || '写回 plot.py 失败' })
      return
    }
    const data = await r.json()
    if (data.svg_content) updateSvgContent(data.svg_content)
    fetchGitLog?.()
    onNotice?.({ ok: true, text: `已替换 ${data.replacements} 处颜色` })
  } catch {
    onNotice?.({ ok: false, text: '无法连接到后端' })
  }
}

export function PalettePanel() {
  const {
    svgContent, updateSvgContent, fetchGitLog,
    activeProjectId, activeExperimentId, activeTaskId,
  } = useStore()
  const [custom, setCustom] = useState([])
  const [applied, setApplied] = useState(null)
  const [notice, setNotice] = useState(null)

  const apply = async (palette) => {
    setApplied(palette.name)
    await applyPaletteDirect({
      svgContent, palette: palette.colors,
      activeProjectId, activeExperimentId, activeTaskId,
      updateSvgContent, fetchGitLog,
      onNotice: (n) => {
        setNotice(n)
        setTimeout(() => setNotice(null), 2500)
      },
    })
    setTimeout(() => setApplied(null), 1500)
  }

  const saveCurrent = () => {
    const colors = extractCurrentColors(svgContent)
    if (!colors.length) return
    const name = `自定义 ${custom.length + 1}`
    setCustom(prev => [...prev, { name, colors }])
  }

  const deleteCustom = (name) => setCustom(prev => prev.filter(p => p.name !== name))

  const all = [...BUILT_IN, ...custom]
  const currentColors = extractCurrentColors(svgContent)

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4">
      {currentColors.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', color: '#7A99AE' }}>
              当前配色
            </span>
            <button onClick={saveCurrent}
              className="flex items-center gap-1 px-2 py-0.5 rounded"
              style={{ fontSize: 11, border: '1px solid #BDCFDF', color: '#2E4A5E' }}>
              <Plus size={9} />保存
            </button>
          </div>
          <div className="flex gap-1 p-2 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #CFE0ED' }}>
            {currentColors.map((c, i) => (
              <span key={i} title={c} style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 4, background: c, border: '1px solid rgba(0,0,0,0.08)' }} />
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', color: '#7A99AE', marginBottom: 8 }}>
        预设方案
      </div>

      <div className="flex flex-col gap-2">
        {all.map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <button onClick={() => apply(p)}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left transition"
              style={{
                border: `1px solid ${applied === p.name ? '#1A7DC4' : '#CFE0ED'}`,
                background: applied === p.name ? 'rgba(26,125,196,0.05)' : '#FFFFFF',
              }}>
              <div className="flex gap-0.5 flex-shrink-0">
                {p.colors.slice(0, 6).map(c => (
                  <span key={c} style={{ display: 'inline-block', width: 13, height: 13, borderRadius: 3, background: c }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: '#1F3547', fontFamily: 'Fraunces, serif', fontStyle: 'italic', flex: 1 }}>
                {p.name}
              </span>
              {applied === p.name && <Check size={11} style={{ color: '#1A7DC4', flexShrink: 0 }} />}
            </button>
            {custom.includes(p) && (
              <button onClick={() => deleteCustom(p.name)}
                className="w-6 h-6 flex items-center justify-center rounded flex-shrink-0"
                style={{ color: '#9DB5C7', border: '1px solid #CFE0ED' }}>
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
      </div>

      {notice && (
        <div className="mt-3 px-2 py-1.5 rounded-md"
          style={{
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: notice.ok ? '#1A7DC4' : '#1668A8',
            background: notice.ok ? 'rgba(26,125,196,0.05)' : 'rgba(22,104,168,0.05)',
          }}>
          {notice.text}
        </div>
      )}

      {!svgContent && (
        <div style={{ fontSize: 12, color: '#9DB5C7', textAlign: 'center', marginTop: 32 }}>
          生成图表后才能切换配色
        </div>
      )}
    </div>
  )
}
