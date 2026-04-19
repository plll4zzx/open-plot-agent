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
      const barEl = doc.getElementById(`bar_${i}`)
      if (!barEl) break
      const path = barEl.querySelector('path, rect, polygon, circle')
      const fill = path?.getAttribute('fill')
      if (fill && fill !== 'none') colors.push(fill)
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
      const barEl = doc.getElementById(`bar_${i}`)
      if (!barEl) break
      const color = palette[i % palette.length]
      barEl.querySelectorAll('path, rect, polygon, circle').forEach(p => {
        if ((p.getAttribute('fill') || '') !== 'none') p.setAttribute('fill', color)
      })
      // Also try line elements
      barEl.querySelectorAll('polyline, path[stroke]').forEach(p => {
        if (p.getAttribute('stroke') && p.getAttribute('stroke') !== 'none')
          p.setAttribute('stroke', color)
      })
      i++
    }
    return new XMLSerializer().serializeToString(doc.documentElement)
  } catch { return svgContent }
}

export function PalettePanel() {
  const { svgContent, updateSvgContent } = useStore()
  const [custom, setCustom] = useState([])
  const [applied, setApplied] = useState(null)

  const apply = (palette) => {
    const newSvg = applyPaletteToSvg(svgContent, palette.colors)
    updateSvgContent(newSvg)
    setApplied(palette.name)
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
            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', color: '#A8A29E' }}>
              当前配色
            </span>
            <button onClick={saveCurrent}
              className="flex items-center gap-1 px-2 py-0.5 rounded"
              style={{ fontSize: 11, border: '1px solid #D6CFC2', color: '#57534E' }}>
              <Plus size={9} />保存
            </button>
          </div>
          <div className="flex gap-1 p-2 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E7E0D1' }}>
            {currentColors.map((c, i) => (
              <span key={i} title={c} style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 4, background: c, border: '1px solid rgba(0,0,0,0.08)' }} />
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', color: '#A8A29E', marginBottom: 8 }}>
        预设方案
      </div>

      <div className="flex flex-col gap-2">
        {all.map(p => (
          <div key={p.name} className="flex items-center gap-2">
            <button onClick={() => apply(p)}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-left transition"
              style={{
                border: `1px solid ${applied === p.name ? '#0F766E' : '#E7E0D1'}`,
                background: applied === p.name ? 'rgba(15,118,110,0.05)' : '#FFFFFF',
              }}>
              <div className="flex gap-0.5 flex-shrink-0">
                {p.colors.slice(0, 6).map(c => (
                  <span key={c} style={{ display: 'inline-block', width: 13, height: 13, borderRadius: 3, background: c }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: '#44403C', fontFamily: 'Fraunces, serif', fontStyle: 'italic', flex: 1 }}>
                {p.name}
              </span>
              {applied === p.name && <Check size={11} style={{ color: '#0F766E', flexShrink: 0 }} />}
            </button>
            {custom.includes(p) && (
              <button onClick={() => deleteCustom(p.name)}
                className="w-6 h-6 flex items-center justify-center rounded flex-shrink-0"
                style={{ color: '#C4BEB7', border: '1px solid #E7E0D1' }}>
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!svgContent && (
        <div style={{ fontSize: 12, color: '#C4BEB7', textAlign: 'center', marginTop: 32 }}>
          生成图表后才能切换配色
        </div>
      )}
    </div>
  )
}
