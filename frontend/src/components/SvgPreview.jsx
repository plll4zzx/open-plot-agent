import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Minus, Plus, Maximize2, Move, ZoomIn } from 'lucide-react'
import { useStore } from '../store'

const ZOOM_MIN = 0.1
const ZOOM_MAX = 8
const ZOOM_STEP = 1.2

function parseSvgSize(svgContent) {
  if (!svgContent) return null
  const viewBoxMatch = svgContent.match(/viewBox\s*=\s*"([^"]+)"/i)
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number)
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3] }
    }
  }
  const wMatch = svgContent.match(/<svg[^>]*\bwidth\s*=\s*"([\d.]+)(pt|px|mm)?"/i)
  const hMatch = svgContent.match(/<svg[^>]*\bheight\s*=\s*"([\d.]+)(pt|px|mm)?"/i)
  if (wMatch && hMatch) return { w: parseFloat(wMatch[1]), h: parseFloat(hMatch[1]) }
  return null
}

export function SvgPreview({ onElementClick, showBorders = true }) {
  const { svgContent, svgLoading } = useStore()
  const scrollRef = useRef(null)
  const innerRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [fitMode, setFitMode] = useState('width') // 'width' | 'page' | 'manual'
  const svgSize = parseSvgSize(svgContent)

  // ── compute fit ratio ───────────────────────────────────────
  const computeFit = useCallback((mode) => {
    const scroll = scrollRef.current
    if (!scroll || !svgSize) return 1
    const padding = 32
    const availW = scroll.clientWidth - padding
    const availH = scroll.clientHeight - padding
    if (availW <= 0 || availH <= 0) return 1
    if (mode === 'width') return availW / svgSize.w
    if (mode === 'page') return Math.min(availW / svgSize.w, availH / svgSize.h)
    return 1
  }, [svgSize])

  // Apply fit on mount, on svg change, and on resize
  useLayoutEffect(() => {
    if (fitMode === 'manual') return
    setZoom(computeFit(fitMode))
  }, [svgContent, fitMode, computeFit])

  useEffect(() => {
    if (fitMode === 'manual') return
    const ro = new ResizeObserver(() => setZoom(computeFit(fitMode)))
    if (scrollRef.current) ro.observe(scrollRef.current)
    return () => ro.disconnect()
  }, [fitMode, computeFit])

  // ── Ctrl/Cmd + wheel zoom ───────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setZoom(z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor)))
      setFitMode('manual')
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Normalize SVG size to px so scale() is predictable ──────
  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner || !svgSize) return
    const svg = inner.querySelector('svg')
    if (!svg) return
    svg.setAttribute('width', svgSize.w)
    svg.setAttribute('height', svgSize.h)
    svg.style.display = 'block'
    svg.style.maxWidth = 'none'
    svg.style.maxHeight = 'none'
  }, [svgContent, svgSize])

  // ── Wire up element hover/click ─────────────────────────────
  // Rather than hardcoding ids, we wire up every <g> that has an id — that
  // way everything matplotlib labels (axes / xtick_N / ytick_N / text_N …)
  // plus our semantic overlay (title / xlabel / bar_N) becomes interactive.
  useEffect(() => {
    const el = innerRef.current
    if (!el || !svgContent) return

    // Skip purely structural / background ids
    const SKIP = new Set(['figure_1', 'axes', 'patch_1', 'patch_2', '_hover_rect'])

    const candidates = Array.from(el.querySelectorAll('svg g[id], svg text[id]'))
      .filter(n => {
        const id = n.getAttribute('id')
        return id && !SKIP.has(id) && !id.startsWith('Cm') && !id.startsWith('DejaVu')
      })

    const cleanups = []
    candidates.forEach(target => {
      const gid = target.getAttribute('id')
      if (!showBorders) return

      target.style.cursor = 'pointer'
      target.style.outline = 'none'

      const enter = (e) => {
        // Prefer innermost named element
        e.stopPropagation()
        const svg = el.querySelector('svg')
        if (!svg) return
        svg.querySelector('#_hover_rect')?.remove()
        let bbox
        try { bbox = target.getBBox() } catch { return }
        if (!bbox || (bbox.width === 0 && bbox.height === 0)) return
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('id', '_hover_rect')
        rect.setAttribute('x', bbox.x - 3)
        rect.setAttribute('y', bbox.y - 3)
        rect.setAttribute('width', bbox.width + 6)
        rect.setAttribute('height', bbox.height + 6)
        rect.setAttribute('fill', 'none')
        rect.setAttribute('stroke', '#B45309')
        rect.setAttribute('stroke-width', '1')
        rect.setAttribute('stroke-dasharray', '3 3')
        rect.setAttribute('pointer-events', 'none')
        rect.setAttribute('vector-effect', 'non-scaling-stroke')
        // Move the rect into the same transform context as target
        const parent = target.parentNode
        parent.appendChild(rect)
      }
      const leave = (e) => {
        e.stopPropagation()
        el.querySelector('#_hover_rect')?.remove()
      }
      const click = (e) => {
        e.stopPropagation()
        onElementClick?.({ gid, element: target, container: el })
      }
      target.addEventListener('mouseenter', enter)
      target.addEventListener('mouseleave', leave)
      target.addEventListener('click', click)
      cleanups.push(() => {
        target.removeEventListener('mouseenter', enter)
        target.removeEventListener('mouseleave', leave)
        target.removeEventListener('click', click)
      })
    })

    return () => cleanups.forEach(fn => fn())
  }, [svgContent, showBorders, onElementClick])

  // ── zoom control helpers ────────────────────────────────────
  const zoomIn = () => { setZoom(z => Math.min(ZOOM_MAX, z * ZOOM_STEP)); setFitMode('manual') }
  const zoomOut = () => { setZoom(z => Math.max(ZOOM_MIN, z / ZOOM_STEP)); setFitMode('manual') }
  const zoomReset = () => { setZoom(1); setFitMode('manual') }
  const fitWidth = () => setFitMode('width')
  const fitPage = () => setFitMode('page')

  if (svgLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="pulse-soft text-center">
          <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>渲染中…</div>
        </div>
      </div>
    )
  }

  if (!svgContent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: '#A8A29E' }}>
        <div style={{ fontSize: 32 }}>🎨</div>
        <div style={{ fontSize: 13 }}>还没有图表</div>
        <div style={{ fontSize: 11.5, color: '#C4BEB7' }}>在右侧对话框输入需求，agent 会生成 plot.py</div>
      </div>
    )
  }

  // Scaled wrapper size drives scrollbars
  const scaledW = svgSize ? svgSize.w * zoom : undefined
  const scaledH = svgSize ? svgSize.h * zoom : undefined

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Zoom toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-shrink-0"
        style={{ borderColor: '#E7E0D1', background: 'rgba(255,255,255,0.5)' }}>
        <button onClick={zoomOut} title="缩小"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5"
          style={{ color: '#57534E' }}>
          <Minus size={12} />
        </button>
        <button onClick={zoomReset} title="100%"
          className="min-w-[46px] h-6 px-1.5 flex items-center justify-center rounded hover:bg-black/5"
          style={{
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: fitMode === 'manual' ? '#1C1917' : '#78716C',
            fontWeight: fitMode === 'manual' ? 500 : 400,
          }}>
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={zoomIn} title="放大"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5"
          style={{ color: '#57534E' }}>
          <Plus size={12} />
        </button>
        <div className="w-px h-4 mx-1" style={{ background: '#E7E0D1' }} />
        <button onClick={fitWidth} title="适合宽度"
          className="h-6 px-2 flex items-center gap-1 rounded hover:bg-black/5"
          style={{
            fontSize: 10.5,
            fontFamily: 'JetBrains Mono, monospace',
            color: fitMode === 'width' ? '#1C1917' : '#78716C',
            fontWeight: fitMode === 'width' ? 500 : 400,
            background: fitMode === 'width' ? 'rgba(0,0,0,0.04)' : 'transparent',
          }}>
          <Move size={11} style={{ transform: 'rotate(90deg)' }} />
          宽度
        </button>
        <button onClick={fitPage} title="适合页面"
          className="h-6 px-2 flex items-center gap-1 rounded hover:bg-black/5"
          style={{
            fontSize: 10.5,
            fontFamily: 'JetBrains Mono, monospace',
            color: fitMode === 'page' ? '#1C1917' : '#78716C',
            fontWeight: fitMode === 'page' ? 500 : 400,
            background: fitMode === 'page' ? 'rgba(0,0,0,0.04)' : 'transparent',
          }}>
          <Maximize2 size={11} />
          页面
        </button>
        <span className="ml-auto font-mono" style={{ fontSize: 10, color: '#C4BEB7' }}>
          ⌘/Ctrl + 滚轮 缩放
        </span>
      </div>

      {/* Scroll area */}
      <div ref={scrollRef}
        className="flex-1 overflow-auto"
        style={{ background: 'rgba(0,0,0,0.015)' }}>
        <div style={{
          width: scaledW ? `${scaledW}px` : 'auto',
          height: scaledH ? `${scaledH}px` : 'auto',
          minWidth: '100%',
          minHeight: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: 16,
          boxSizing: 'content-box',
        }}>
          <div
            ref={innerRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
              width: svgSize ? svgSize.w : 'auto',
              height: svgSize ? svgSize.h : 'auto',
              flexShrink: 0,
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      </div>
    </div>
  )
}
