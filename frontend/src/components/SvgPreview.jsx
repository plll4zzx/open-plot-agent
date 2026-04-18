import { useEffect, useRef } from 'react'
import { useStore } from '../store'

/**
 * Renders the backend SVG in the preview area.
 * Supports element hover highlighting via semantic gids.
 */
export function SvgPreview({ onElementClick, showBorders = true }) {
  const { svgContent, svgLoading } = useStore()
  const containerRef = useRef(null)

  // After SVG renders in DOM, wire up hover outlines on semantic gids
  useEffect(() => {
    const el = containerRef.current
    if (!el || !svgContent) return

    const semanticIds = ['title', 'xlabel', 'ylabel', 'legend',
      ...Array.from({ length: 20 }, (_, i) => `bar_${i}`),
      ...Array.from({ length: 20 }, (_, i) => `annotation_${i}`),
    ]

    semanticIds.forEach(gid => {
      const target = el.querySelector(`#${gid}`)
      if (!target) return

      if (showBorders) {
        target.style.cursor = 'pointer'
        target.style.outline = 'none'

        const enter = () => {
          target.setAttribute('data-hovered', '1')
          // Draw amber dashed rect around bbox
          const svg = el.querySelector('svg')
          if (!svg) return
          const existing = svg.querySelector('#_hover_rect')
          if (existing) existing.remove()
          const bbox = target.getBBox()
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
          svg.appendChild(rect)
        }

        const leave = () => {
          target.removeAttribute('data-hovered')
          el.querySelector('#_hover_rect')?.remove()
        }

        const click = (e) => {
          e.stopPropagation()
          onElementClick?.({ gid, element: target })
        }

        target.addEventListener('mouseenter', enter)
        target.addEventListener('mouseleave', leave)
        target.addEventListener('click', click)

        // Cleanup stored on element
        target._cleanup = () => {
          target.removeEventListener('mouseenter', enter)
          target.removeEventListener('mouseleave', leave)
          target.removeEventListener('click', click)
        }
      }
    })

    return () => {
      semanticIds.forEach(gid => {
        const target = el?.querySelector(`#${gid}`)
        target?._cleanup?.()
      })
    }
  }, [svgContent, showBorders, onElementClick])

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

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center p-4 overflow-hidden"
      dangerouslySetInnerHTML={{ __html: svgContent }}
      style={{ '& svg': { maxWidth: '100%', maxHeight: '100%', height: 'auto' } }}
    />
  )
}
