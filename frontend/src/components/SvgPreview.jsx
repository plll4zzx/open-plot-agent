import { useEffect, useRef, useCallback, useState } from 'react'
import { useStore } from '../store'

/**
 * Renders the backend SVG in the preview area.
 *
 * Uses EVENT DELEGATION on the container div instead of attaching
 * per-element listeners. This means listeners survive DOM destruction
 * caused by React re-renders (dangerouslySetInnerHTML).
 *
 * Interaction map:
 *   click on semantic element  → opens ElementEditor (via onElementClick)
 *   drag on legend             → moves legend, persists via patch_legend_position
 *   dblclick on title/xlabel/  → in-place text edit (foreignObject input overlay)
 *     ylabel/annotation_*
 *   dblclick on xaxis/yaxis    → opens an inline xlim/ylim editor floating panel
 */

const GID_PREFIXES = ['bar_', 'line_', 'scatter_', 'patch_', 'annotation_']
const GID_EXACT = ['title', 'xlabel', 'ylabel', 'legend', 'xaxis', 'yaxis']
const TEXT_EDITABLE_PREFIXES = ['annotation_']
const TEXT_EDITABLE_EXACT = ['title', 'xlabel', 'ylabel']
const AXIS_GIDS = ['xaxis', 'yaxis']

function isSemanticGid(id) {
  if (!id || id.startsWith('_')) return false
  if (GID_EXACT.includes(id)) return true
  return GID_PREFIXES.some(prefix => id.startsWith(prefix))
}

function isTextEditableGid(id) {
  if (!id) return false
  if (TEXT_EDITABLE_EXACT.includes(id)) return true
  return TEXT_EDITABLE_PREFIXES.some(p => id.startsWith(p))
}

/** Walk up from target to find nearest ancestor with a semantic gid */
function findSemanticAncestor(el, root) {
  let cur = el
  while (cur && cur !== root) {
    const id = cur.getAttribute?.('id')
    if (id && isSemanticGid(id)) return cur
    cur = cur.parentElement
  }
  return null
}

async function patchCode(projectId, experimentId, taskId, body) {
  const r = await fetch(
    `/api/projects/${projectId}/experiments/${experimentId}/tasks/${taskId}/patch-code`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  return r.json()
}

export function SvgPreview({ onElementClick, showBorders = true }) {
  const {
    svgContent, svgLoading,
    activeProjectId, activeExperimentId, activeTaskId,
    updateSvgContent, fetchGitLog,
  } = useStore()
  const containerRef = useRef(null)
  const hoveredRef = useRef(null)
  const dragStateRef = useRef(null)
  const [dragFeedback, setDragFeedback] = useState(null) // 'dragging' | 'saving' | 'saved' | 'error' | null

  // Inline-edit state for text elements (title/xlabel/ylabel/annotation_*)
  // { gid, x, y, width, height, value } — when set, we render a foreignObject overlay
  const [textEdit, setTextEdit] = useState(null)
  const [textEditSaving, setTextEditSaving] = useState(false)

  // Inline editor state for axis range (xaxis/yaxis)
  // { gid, x, y, lo, hi } in client-pixel space (relative to container)
  const [axisEdit, setAxisEdit] = useState(null)
  const [axisEditSaving, setAxisEditSaving] = useState(false)

  // Remove hover rect helper
  const removeHoverRect = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    el.querySelector('#_hover_rect')?.remove()
    if (hoveredRef.current) {
      hoveredRef.current = null
    }
  }, [])

  // Draw hover rect around a semantic element
  const drawHoverRect = useCallback((target) => {
    const el = containerRef.current
    if (!el) return
    const svg = el.querySelector('svg')
    if (!svg) return

    svg.querySelector('#_hover_rect')?.remove()

    try {
      const bbox = target.getBBox()
      if (bbox.width === 0 && bbox.height === 0) return

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('id', '_hover_rect')
      rect.setAttribute('x', bbox.x - 3)
      rect.setAttribute('y', bbox.y - 3)
      rect.setAttribute('width', bbox.width + 6)
      rect.setAttribute('height', bbox.height + 6)
      rect.setAttribute('fill', 'none')

      // Color by element role:
      //   legend   → purple (draggable)
      //   xaxis/yaxis → teal (double-click for range)
      //   text     → amber (double-click to edit)
      //   other    → amber
      const gid = target.getAttribute('id')
      const isLegend = gid === 'legend'
      const isAxis = AXIS_GIDS.includes(gid)
      const stroke =
        isLegend ? '#7C3AED' :
        isAxis   ? '#0F766E' :
        '#B45309'
      rect.setAttribute('stroke', stroke)
      rect.setAttribute('stroke-width', isLegend ? '1.5' : '1')
      rect.setAttribute('stroke-dasharray', isLegend ? '5 3' : '3 3')
      rect.setAttribute('pointer-events', 'none')
      svg.appendChild(rect)
    } catch {
      // getBBox can fail on hidden/zero-size elements
    }
  }, [])

  // Set pointer cursors on all semantic elements after SVG loads
  useEffect(() => {
    const el = containerRef.current
    if (!el || !svgContent || !showBorders) return

    const svg = el.querySelector('svg')
    if (!svg) return

    svg.querySelectorAll('[id]').forEach(target => {
      const gid = target.getAttribute('id')
      if (!isSemanticGid(gid)) return
      if (gid === 'legend') {
        target.style.cursor = 'grab'
      } else if (AXIS_GIDS.includes(gid)) {
        target.style.cursor = 'zoom-in'  // Hint that double-click does something
      } else {
        target.style.cursor = 'pointer'
      }
    })

    return () => {
      removeHoverRect()
    }
  }, [svgContent, showBorders, removeHoverRect])

  // ── Legend drag handlers ─────────────────────────────────────────────

  const handleMouseDown = useCallback((e) => {
    if (!showBorders) return
    if (textEdit || axisEdit) return  // Don't start drags while editing
    const el = containerRef.current
    if (!el) return
    const svg = el.querySelector('svg')
    if (!svg) return

    const target = findSemanticAncestor(e.target, el)
    if (!target || target.getAttribute('id') !== 'legend') return

    e.preventDefault()
    e.stopPropagation()

    const svgRect = svg.getBoundingClientRect()
    const legendBBox = target.getBBox()

    const existingTransform = target.getAttribute('transform') || ''
    const translateMatch = existingTransform.match(/translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/)
    const initialTx = translateMatch ? parseFloat(translateMatch[1]) : 0
    const initialTy = translateMatch ? parseFloat(translateMatch[2]) : 0

    dragStateRef.current = {
      legendEl: target,
      svgEl: svg,
      svgRect,
      legendBBox,
      originX: e.clientX,
      originY: e.clientY,
      initialTx,
      initialTy,
      currentTx: initialTx,
      currentTy: initialTy,
    }

    target.style.cursor = 'grabbing'
    target.style.opacity = '0.85'
    setDragFeedback('dragging')
    removeHoverRect()
  }, [showBorders, removeHoverRect, textEdit, axisEdit])

  const handleMouseMove = useCallback((e) => {
    const drag = dragStateRef.current
    if (drag) {
      const dxPx = e.clientX - drag.originX
      const dyPx = e.clientY - drag.originY

      const svgWidth = drag.svgRect.width
      const svgHeight = drag.svgRect.height
      const svg = drag.svgEl
      const viewBox = svg.viewBox?.baseVal
      const vbW = viewBox?.width || parseFloat(svg.getAttribute('width')) || svgWidth
      const vbH = viewBox?.height || parseFloat(svg.getAttribute('height')) || svgHeight
      const scaleX = vbW / svgWidth
      const scaleY = vbH / svgHeight

      const tx = drag.initialTx + dxPx * scaleX
      const ty = drag.initialTy + dyPx * scaleY
      drag.currentTx = tx
      drag.currentTy = ty
      drag.legendEl.setAttribute('transform', `translate(${tx}, ${ty})`)
      return
    }

    if (!showBorders) return
    if (textEdit || axisEdit) return
    const el = containerRef.current
    if (!el) return

    const target = findSemanticAncestor(e.target, el)
    if (target === hoveredRef.current) return

    removeHoverRect()
    if (target) {
      hoveredRef.current = target
      drawHoverRect(target)
    }
  }, [showBorders, removeHoverRect, drawHoverRect, textEdit, axisEdit])

  const handleMouseUp = useCallback(async () => {
    const drag = dragStateRef.current
    if (!drag) return

    const { legendEl, svgEl, legendBBox, currentTx, currentTy } = drag

    legendEl.style.cursor = 'grab'
    legendEl.style.opacity = ''
    dragStateRef.current = null

    const viewBox = svgEl.viewBox?.baseVal
    const vbW = viewBox?.width || parseFloat(svgEl.getAttribute('width')) || 1
    const vbH = viewBox?.height || parseFloat(svgEl.getAttribute('height')) || 1

    const newX = legendBBox.x + currentTx
    const newY = legendBBox.y + currentTy

    const figX = newX / vbW
    const figY = 1 - (newY + legendBBox.height) / vbH

    const totalDrag = Math.hypot(
      currentTx - drag.initialTx,
      currentTy - drag.initialTy,
    )
    if (totalDrag < 3) {
      setDragFeedback(null)
      return
    }

    if (!activeProjectId || !activeExperimentId || !activeTaskId) {
      setDragFeedback('error')
      setTimeout(() => setDragFeedback(null), 2000)
      return
    }

    setDragFeedback('saving')
    try {
      const result = await patchCode(activeProjectId, activeExperimentId, activeTaskId, {
        gid: 'legend',
        property: 'legend-position',
        value: `${figX.toFixed(3)},${figY.toFixed(3)}`,
      })
      if (result.ok) {
        if (result.svg_content) updateSvgContent(result.svg_content)
        fetchGitLog?.()
        setDragFeedback('saved')
      } else {
        setDragFeedback('error')
        console.warn('legend position patch failed:', result.error)
        legendEl.setAttribute('transform', `translate(${drag.initialTx}, ${drag.initialTy})`)
      }
    } catch (err) {
      setDragFeedback('error')
      console.error(err)
      legendEl.setAttribute('transform', `translate(${drag.initialTx}, ${drag.initialTy})`)
    } finally {
      setTimeout(() => setDragFeedback(null), 1800)
    }
  }, [activeProjectId, activeExperimentId, activeTaskId, updateSvgContent, fetchGitLog])

  const handleMouseLeave = useCallback(() => {
    if (dragStateRef.current) return
    removeHoverRect()
  }, [removeHoverRect])

  const handleClick = useCallback((e) => {
    if (!showBorders) return
    if (textEdit || axisEdit) return  // ignore clicks while inline editor is open
    if (dragFeedback === 'saving' || dragFeedback === 'saved') return

    const el = containerRef.current
    if (!el) return

    const target = findSemanticAncestor(e.target, el)
    if (!target) return

    e.stopPropagation()
    const gid = target.getAttribute('id')
    onElementClick?.({ gid, element: target, container: el })
  }, [showBorders, onElementClick, dragFeedback, textEdit, axisEdit])

  // ── Double-click handlers ────────────────────────────────────────────

  const extractTextValue = useCallback((target) => {
    // matplotlib renders text as <text> children inside the gid group, often
    // with multiple <tspan> nodes. We concatenate the textContent.
    const texts = target.querySelectorAll('text')
    if (!texts.length) return target.textContent?.trim() || ''
    let value = ''
    texts.forEach(t => { value += t.textContent || '' })
    return value.trim()
  }, [])

  const handleDoubleClick = useCallback((e) => {
    if (!showBorders) return
    const el = containerRef.current
    if (!el) return
    const svg = el.querySelector('svg')
    if (!svg) return

    const target = findSemanticAncestor(e.target, el)
    if (!target) return

    const gid = target.getAttribute('id')

    // Axis range editor
    if (AXIS_GIDS.includes(gid)) {
      e.preventDefault()
      e.stopPropagation()
      removeHoverRect()
      // Compute screen-space anchor near the axis
      const containerRect = el.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const x = targetRect.left + targetRect.width / 2 - containerRect.left
      const y = gid === 'xaxis'
        ? targetRect.top - containerRect.top - 8           // above x-axis
        : targetRect.bottom - containerRect.top + 8        // below y-axis (won't happen, but safe)
      setAxisEdit({
        gid,
        anchorX: Math.max(80, Math.min(x, containerRect.width - 80)),
        anchorY: Math.max(20, y),
        lo: '',
        hi: '',
      })
      return
    }

    // Text inline edit
    if (isTextEditableGid(gid)) {
      e.preventDefault()
      e.stopPropagation()
      removeHoverRect()
      try {
        const bbox = target.getBBox()
        // Convert SVG bbox → CTM screen-space → container-relative pixels
        const ctm = target.getCTM()
        if (!ctm) return
        const containerRect = el.getBoundingClientRect()
        const svgRect = svg.getBoundingClientRect()

        // viewBox scaling so we can map SVG units back to CSS pixels
        const viewBox = svg.viewBox?.baseVal
        const vbW = viewBox?.width || svgRect.width
        const vbH = viewBox?.height || svgRect.height
        const scaleX = svgRect.width / vbW
        const scaleY = svgRect.height / vbH

        // Approximate screen position by pinning to bbox top-left
        // (text is rendered with various translates, so use getBoundingClientRect
        // for a robust answer)
        const targetRect = target.getBoundingClientRect()
        const left = targetRect.left - containerRect.left
        const top = targetRect.top - containerRect.top
        const width = Math.max(targetRect.width, 80)
        const height = Math.max(targetRect.height, 18)

        setTextEdit({
          gid,
          left, top, width, height,
          value: extractTextValue(target),
          originalValue: extractTextValue(target),
        })
        // Note: scaleX/scaleY/bbox kept for future use if we need to size font
        void bbox; void scaleX; void scaleY
      } catch (err) {
        console.warn('Failed to open text editor:', err)
      }
      return
    }
  }, [showBorders, removeHoverRect, extractTextValue])

  const submitTextEdit = useCallback(async () => {
    if (!textEdit) return
    const { gid, value, originalValue } = textEdit
    if (value === originalValue) {
      setTextEdit(null)
      return
    }
    if (!activeProjectId || !activeExperimentId || !activeTaskId) {
      setTextEdit(null)
      return
    }
    setTextEditSaving(true)
    try {
      const result = await patchCode(activeProjectId, activeExperimentId, activeTaskId, {
        gid, property: 'text', value,
      })
      if (result.ok) {
        if (result.svg_content) updateSvgContent(result.svg_content)
        fetchGitLog?.()
      } else {
        console.warn('text patch failed:', result.error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setTextEditSaving(false)
      setTextEdit(null)
    }
  }, [textEdit, activeProjectId, activeExperimentId, activeTaskId, updateSvgContent, fetchGitLog])

  const cancelTextEdit = useCallback(() => {
    setTextEdit(null)
  }, [])

  const submitAxisEdit = useCallback(async () => {
    if (!axisEdit) return
    const { gid, lo, hi } = axisEdit
    const loN = parseFloat(lo)
    const hiN = parseFloat(hi)
    if (Number.isNaN(loN) || Number.isNaN(hiN)) {
      // Don't bother — let user fix
      return
    }
    if (loN >= hiN) {
      return
    }
    if (!activeProjectId || !activeExperimentId || !activeTaskId) {
      setAxisEdit(null)
      return
    }
    setAxisEditSaving(true)
    try {
      const property = gid === 'xaxis' ? 'xlim' : 'ylim'
      const result = await patchCode(activeProjectId, activeExperimentId, activeTaskId, {
        gid, property, value: `${loN},${hiN}`,
      })
      if (result.ok) {
        if (result.svg_content) updateSvgContent(result.svg_content)
        fetchGitLog?.()
      } else {
        console.warn(`${property} patch failed:`, result.error)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAxisEditSaving(false)
      setAxisEdit(null)
    }
  }, [axisEdit, activeProjectId, activeExperimentId, activeTaskId, updateSvgContent, fetchGitLog])

  // Attach/detach global mousemove+mouseup during drag so it keeps tracking
  // even if the pointer leaves the preview area.
  useEffect(() => {
    if (!dragFeedback || dragFeedback !== 'dragging') return

    const onMove = (ev) => handleMouseMove(ev)
    const onUp = () => handleMouseUp()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragFeedback, handleMouseMove, handleMouseUp])

  // Close inline editors on Escape
  useEffect(() => {
    if (!textEdit && !axisEdit) return
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        if (textEdit) cancelTextEdit()
        if (axisEdit) setAxisEdit(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [textEdit, axisEdit, cancelTextEdit])

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
    <div className="relative flex-1 flex flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center p-4 overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{ '& svg': { maxWidth: '100%', maxHeight: '100%', height: 'auto' } }}
      >
        <div
          className="contents"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />

        {/* Inline text editor overlay */}
        {textEdit && (
          <div
            className="absolute"
            style={{
              left: textEdit.left,
              top: textEdit.top,
              width: textEdit.width,
              height: textEdit.height,
              zIndex: 10,
            }}
          >
            <input
              autoFocus
              type="text"
              value={textEdit.value}
              disabled={textEditSaving}
              onChange={(e) => setTextEdit(prev => prev ? { ...prev, value: e.target.value } : prev)}
              onBlur={submitTextEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitTextEdit()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelTextEdit()
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                fontSize: 13,
                padding: '2px 6px',
                border: '2px solid #B45309',
                borderRadius: 4,
                outline: 'none',
                background: 'rgba(255,255,255,0.95)',
                color: '#1C1917',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            />
            {textEditSaving && (
              <div
                className="absolute -top-5 left-0 text-xs"
                style={{ color: '#B45309', fontFamily: 'JetBrains Mono, monospace' }}
              >
                保存中…
              </div>
            )}
          </div>
        )}

        {/* Inline axis range editor */}
        {axisEdit && (
          <div
            className="absolute rounded-lg shadow-lg"
            style={{
              left: axisEdit.anchorX - 90,
              top: axisEdit.anchorY,
              width: 180,
              padding: '10px 12px',
              background: '#FFFFFF',
              border: '1px solid #0F766E',
              zIndex: 20,
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: '#0F766E',
                marginBottom: 6,
                textTransform: 'uppercase',
              }}
            >
              {axisEdit.gid === 'xaxis' ? '设置 X 轴范围' : '设置 Y 轴范围'}
            </div>
            <div className="flex gap-1.5 items-center">
              <input
                autoFocus
                type="number"
                placeholder="min"
                value={axisEdit.lo}
                disabled={axisEditSaving}
                onChange={(e) => setAxisEdit(prev => prev ? { ...prev, lo: e.target.value } : prev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); submitAxisEdit() }
                  else if (e.key === 'Escape') { e.preventDefault(); setAxisEdit(null) }
                }}
                style={{
                  width: 60,
                  fontSize: 12,
                  padding: '4px 6px',
                  border: '1px solid #D6D3D1',
                  borderRadius: 4,
                  outline: 'none',
                }}
              />
              <span style={{ color: '#78716C', fontSize: 12 }}>—</span>
              <input
                type="number"
                placeholder="max"
                value={axisEdit.hi}
                disabled={axisEditSaving}
                onChange={(e) => setAxisEdit(prev => prev ? { ...prev, hi: e.target.value } : prev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); submitAxisEdit() }
                  else if (e.key === 'Escape') { e.preventDefault(); setAxisEdit(null) }
                }}
                style={{
                  width: 60,
                  fontSize: 12,
                  padding: '4px 6px',
                  border: '1px solid #D6D3D1',
                  borderRadius: 4,
                  outline: 'none',
                }}
              />
            </div>
            <div className="flex gap-2 mt-2 justify-end">
              <button
                type="button"
                onClick={() => setAxisEdit(null)}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  border: '1px solid #D6D3D1',
                  borderRadius: 4,
                  background: '#FAFAF9',
                  color: '#57534E',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={axisEditSaving}
                onClick={submitAxisEdit}
                style={{
                  fontSize: 11,
                  padding: '3px 10px',
                  border: 'none',
                  borderRadius: 4,
                  background: '#0F766E',
                  color: '#FFFFFF',
                  cursor: axisEditSaving ? 'wait' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {axisEditSaving ? '保存中…' : '应用'}
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: '#A8A29E', marginTop: 6 }}>
              Enter 应用 / Esc 取消
            </div>
          </div>
        )}
      </div>

      {/* Drag feedback toast */}
      {dragFeedback && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 rounded-md px-3 py-1.5 shadow-sm"
          style={{
            fontSize: 11.5,
            fontFamily: 'JetBrains Mono, monospace',
            background:
              dragFeedback === 'saved' ? 'rgba(15,118,110,0.1)' :
              dragFeedback === 'error' ? 'rgba(220,38,38,0.1)' :
              'rgba(124,58,237,0.1)',
            color:
              dragFeedback === 'saved' ? '#0F766E' :
              dragFeedback === 'error' ? '#DC2626' :
              '#7C3AED',
            border: `1px solid ${
              dragFeedback === 'saved' ? 'rgba(15,118,110,0.3)' :
              dragFeedback === 'error' ? 'rgba(220,38,38,0.3)' :
              'rgba(124,58,237,0.3)'
            }`,
          }}
        >
          {dragFeedback === 'dragging' && '↔ 拖动图例到新位置'}
          {dragFeedback === 'saving' && '保存中…'}
          {dragFeedback === 'saved' && '✓ 图例位置已保存到 plot.py'}
          {dragFeedback === 'error' && '✗ 保存失败，已回退'}
        </div>
      )}
    </div>
  )
}
