import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'
import { useStore } from '../store'

export function PlotlyPreview() {
  const { chartJson, chartLoading } = useStore()
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (!chartJson) {
      Plotly.purge(el)
      return
    }
    Plotly.react(
      el,
      chartJson.data || [],
      { ...chartJson.layout, autosize: true },
      { responsive: true, displayModeBar: true, displaylogo: false }
    )
    return () => { Plotly.purge(el) }
  }, [chartJson])

  if (chartLoading) {
    return (
      <div className="flex items-center justify-center h-full pulse-soft"
        style={{ color: '#7A99AE', fontSize: 13 }}>加载中…</div>
    )
  }

  if (!chartJson) {
    return (
      <div className="flex items-center justify-center h-full"
        style={{ color: '#7A99AE', fontSize: 13 }}>
        尚无图表 — 在右侧对话框告诉 Agent 你想要什么
      </div>
    )
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
