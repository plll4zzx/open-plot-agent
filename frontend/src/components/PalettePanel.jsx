import { useEffect, useState } from 'react'
import { Plus, Check, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'

const BUILT_IN = [
  { name: 'Okabe-Ito', colors: ['#E69F00','#56B4E9','#009E73','#F0E442','#0072B2','#D55E00','#CC79A7'] },
  { name: 'Tab10',     colors: ['#1F77B4','#FF7F0E','#2CA02C','#D62728','#9467BD','#8C564B','#E377C2'] },
  { name: 'Set2',      colors: ['#66C2A5','#FC8D62','#8DA0CB','#E78AC3','#A6D854','#FFD92F','#E5C494'] },
  { name: 'Dark2',     colors: ['#1B9E77','#D95F02','#7570B3','#E7298A','#66A61E','#E6AB02','#A6761D'] },
  { name: 'Pastel',    colors: ['#FBB4AE','#B3CDE3','#CCEBC5','#DECBE4','#FED9A6','#FFFFCC','#E5D8BD'] },
]

// Extract colors from SVG by GID — works for bar/line/scatter series
function extractCurrentColors(svgContent) {
  if (!svgContent) return []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const colors = []
    const prefixes = ['bar', 'line', 'scatter']
    let i = 0
    while (i < 20) {
      let found = false
      for (const prefix of prefixes) {
        const el = doc.getElementById(`${prefix}_${i}`)
        if (el) {
          const path = el.querySelector('path, rect, polygon, circle, polyline, ellipse')
          const fill = path?.getAttribute('fill')
          const stroke = path?.getAttribute('stroke')
          const c = (fill && fill !== 'none') ? fill : stroke
          if (c && c !== 'none') colors.push(c)
          found = true
          break
        }
      }
      if (!found) break
      i++
    }
    return colors
  } catch { return [] }
}

// Read PALETTE = [...] hex list directly from plot.py source
async function fetchColorsFromSource(projectId, experimentId, taskId) {
  try {
    const r = await fetch(
      `/api/projects/${projectId}/experiments/${experimentId}/tasks/${taskId}/files/chart/plot.py`
    )
    if (!r.ok) return []
    const data = await r.json()
    const src = data.content || ''
    const m = src.match(/PALETTE\s*=\s*(\[[\s\S]*?\])/m)
    if (!m) return []
    return [...m[1].matchAll(/["'](#[0-9a-fA-F]{6})["']/g)].map(x => x[1])
  } catch { return [] }
}

function applyPaletteToSvg(svgContent, palette) {
  if (!svgContent) return svgContent
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const prefixes = ['bar', 'line', 'scatter']
    let i = 0
    while (i < 20) {
      let found = false
      for (const prefix of prefixes) {
        const el = doc.getElementById(`${prefix}_${i}`)
        if (el) {
          const color = palette[i % palette.length]
          if (prefix === 'line') {
            el.querySelectorAll('polyline, path').forEach(p => {
              if (p.getAttribute('stroke') && p.getAttribute('stroke') !== 'none')
                p.setAttribute('stroke', color)
            })
          } else {
            el.querySelectorAll('path, rect, polygon, circle, ellipse').forEach(p => {
              if ((p.getAttribute('fill') || '') !== 'none') p.setAttribute('fill', color)
            })
          }
          found = true
          break
        }
      }
      if (!found) break
      i++
    }
    return new XMLSerializer().serializeToString(doc.documentElement)
  } catch { return svgContent }
}

/** Apply palette: try SVG color extraction first, fall back to PALETTE in plot.py source. */
export async function applyPaletteDirect({
  svgContent, palette, activeProjectId, activeExperimentId, activeTaskId,
  updateSvgContent, fetchGitLog, onNotice,
  msgs = {},
}) {
  // 1) Try SVG-based extraction (works for bar/line charts with GID tags)
  let oldColors = extractCurrentColors(svgContent)
  const fromSvg = oldColors.length > 0

  // 2) Fall back to PALETTE variable in plot.py source (works for all agent-generated charts)
  if (!fromSvg && activeProjectId && activeExperimentId && activeTaskId) {
    oldColors = await fetchColorsFromSource(activeProjectId, activeExperimentId, activeTaskId)
  }

  if (!oldColors.length) {
    onNotice?.({ ok: false, text: msgs.noColors ?? '未检测到可替换的颜色' })
    return
  }

  const newColors = oldColors.map((_, i) => palette[i % palette.length])

  // Immediate client-side preview for charts with GID-tagged series
  if (fromSvg) updateSvgContent(applyPaletteToSvg(svgContent, palette))

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
      onNotice?.({ ok: false, text: detail.detail || (msgs.writeFailed ?? '写回 plot.py 失败') })
      return
    }
    const data = await r.json()
    if (data.svg_content) updateSvgContent(data.svg_content)
    fetchGitLog?.()
    onNotice?.({ ok: true, text: msgs.replaced ? msgs.replaced(data.replacements) : `已替换 ${data.replacements} 处颜色` })
  } catch {
    onNotice?.({ ok: false, text: msgs.backendError ?? '无法连接到后端' })
  }
}

export function PalettePanel() {
  const {
    svgContent, updateSvgContent, fetchGitLog,
    activeProjectId, activeExperimentId, activeTaskId,
  } = useStore()
  const t = useT()
  const [custom, setCustom] = useState([])
  const [applied, setApplied] = useState(null)
  const [notice, setNotice] = useState(null)

  // Load persisted custom palettes from backend on mount
  useEffect(() => {
    fetch('/api/palettes')
      .then(r => r.ok ? r.json() : { palettes: [] })
      .then(data => setCustom(data.palettes || []))
      .catch(() => {})
  }, [])

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
      msgs: {
        noColors: t('noColorsDetected'),
        writeFailed: t('paletteWriteFailed'),
        replaced: (n) => t('colorsReplaced', { n }),
        backendError: t('backendError'),
      },
    })
    setTimeout(() => setApplied(null), 1500)
  }

  const saveCurrent = async () => {
    // Try SVG first, fall back to plot.py source
    let colors = extractCurrentColors(svgContent)
    if (!colors.length && activeProjectId && activeExperimentId && activeTaskId) {
      colors = await fetchColorsFromSource(activeProjectId, activeExperimentId, activeTaskId)
    }
    if (!colors.length) return
    const name = t('customPalette', { n: custom.length + 1 })
    const newPalette = { name, colors }
    try {
      await fetch('/api/palettes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPalette),
      })
    } catch { /* best-effort */ }
    setCustom(prev => [...prev, newPalette])
  }

  const deleteCustom = async (name) => {
    try {
      await fetch(`/api/palettes/${encodeURIComponent(name)}`, { method: 'DELETE' })
    } catch { /* best-effort */ }
    setCustom(prev => prev.filter(p => p.name !== name))
  }

  const all = [...BUILT_IN, ...custom]

  // Current colors: try SVG first (instant), then we don't async-fetch for display
  const currentColors = extractCurrentColors(svgContent)

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-4">
      {currentColors.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', color: '#7A99AE' }}>
              {t('currentPalette')}
            </span>
            <button onClick={saveCurrent}
              className="flex items-center gap-1 px-2 py-0.5 rounded"
              style={{ fontSize: 11, border: '1px solid #BDCFDF', color: '#2E4A5E' }}>
              <Plus size={9} />{t('save')}
            </button>
          </div>
          <div className="flex gap-1 p-2 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #CFE0ED' }}>
            {currentColors.map((c, i) => (
              <span key={i} title={c} style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 4, background: c, border: '1px solid rgba(0,0,0,0.08)' }} />
            ))}
          </div>
        </div>
      )}

      {/* Save button for charts without detectable SVG colors (e.g. scatter) */}
      {!currentColors.length && svgContent && (activeProjectId && activeExperimentId && activeTaskId) && (
        <div className="mb-4 flex justify-end">
          <button onClick={saveCurrent}
            className="flex items-center gap-1 px-2 py-0.5 rounded"
            style={{ fontSize: 11, border: '1px solid #BDCFDF', color: '#2E4A5E' }}>
            <Plus size={9} />{t('save')}
          </button>
        </div>
      )}

      <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', color: '#7A99AE', marginBottom: 8 }}>
        {t('presetSchemes')}
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
            {custom.some(cp => cp.name === p.name) && (
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
          {t('generateChartFirst')}
        </div>
      )}
    </div>
  )
}
