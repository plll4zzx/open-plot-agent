import { useState } from 'react'
import { BarChart3, TrendingUp, Grid3X3, BoxSelect, ScatterChart, PieChart, Activity, Layers } from 'lucide-react'
import { useT } from '../i18n'

// ── Template definitions ─────────────────────────────────────

const TEMPLATES = [
  {
    id: 'grouped_bar',
    nameKey: 'tmplGroupedBarName',
    descKey: 'tmplGroupedBarDesc',
    nameEn: 'Grouped Bar Chart',
    icon: BarChart3,
    color: '#E69F00',
    tags: ['对比', '分类'],
    prompt: '请画一个分组柱状图。X轴是分类变量，不同颜色表示不同组，Y轴是数值。请加上误差线（标准差）和显著性标注。使用 Okabe-Ito 配色。',
  },
  {
    id: 'line_plot',
    nameKey: 'tmplLinePlotName',
    descKey: 'tmplLinePlotDesc',
    nameEn: 'Line Plot',
    icon: TrendingUp,
    color: '#56B4E9',
    tags: ['趋势', '时间序列'],
    prompt: '请画一个折线图。X轴是时间或序列变量，Y轴是数值。如果有多组数据，用不同颜色和线型区分。加上图例和数据点标记。',
  },
  {
    id: 'heatmap',
    nameKey: 'tmplHeatmapName',
    descKey: 'tmplHeatmapDesc',
    nameEn: 'Heatmap',
    icon: Grid3X3,
    color: '#009E73',
    tags: ['矩阵', '相关性'],
    prompt: '请画一个热力图。将数值数据以颜色深浅表示。请加上色标(colorbar)、行列标签，并在每个格子中标注数值。使用 RdYlBu 配色。',
  },
  {
    id: 'box_plot',
    nameKey: 'tmplBoxPlotName',
    descKey: 'tmplBoxPlotDesc',
    nameEn: 'Box Plot',
    icon: BoxSelect,
    color: '#F0E442',
    tags: ['分布', '统计'],
    prompt: '请画一个箱线图（box plot）。按分类变量分组，展示数值的分布。显示中位数、四分位数、须和异常值。可以叠加散点（jitter）显示原始数据点。',
  },
  {
    id: 'scatter',
    nameKey: 'tmplScatterName',
    descKey: 'tmplScatterDesc',
    nameEn: 'Scatter Plot',
    icon: ScatterChart,
    color: '#0072B2',
    tags: ['相关', '回归'],
    prompt: '请画一个散点图。X轴和Y轴分别是两个数值变量。如果有分组变量，用不同颜色区分。添加回归拟合线和 R² 值。',
  },
  {
    id: 'violin',
    nameKey: 'tmplViolinName',
    descKey: 'tmplViolinDesc',
    nameEn: 'Violin Plot',
    icon: Activity,
    color: '#D55E00',
    tags: ['分布', '密度'],
    prompt: '请画一个小提琴图（violin plot）。按分类变量分组，展示数值分布的密度估计。内部叠加箱线图显示中位数和四分位数。',
  },
  {
    id: 'stacked_bar',
    nameKey: 'tmplStackedBarName',
    descKey: 'tmplStackedBarDesc',
    nameEn: 'Stacked Bar Chart',
    icon: Layers,
    color: '#CC79A7',
    tags: ['比例', '组成'],
    prompt: '请画一个堆叠柱状图。X轴是分类变量，每个柱子内部按不同类别堆叠，Y轴是数值或百分比。加上图例标注各层含义。',
  },
  {
    id: 'pie_donut',
    nameKey: 'tmplDonutName',
    descKey: 'tmplDonutDesc',
    nameEn: 'Donut Chart',
    icon: PieChart,
    color: '#7C3AED',
    tags: ['比例', '构成'],
    prompt: '请画一个环形图（donut chart）。展示各类别占总体的比例。中心标注总数或标题。标注每个扇区的百分比和标签。',
  },
]

const JOURNAL_PRESETS = [
  {
    id: 'nature',
    name: 'Nature',
    description: '单栏 89mm / 双栏 183mm，sans-serif，8pt 最小字号',
    prompt: '请按照 Nature 期刊的图表规范调整：单栏宽度 89mm（约 3.5 英寸），使用 Arial/Helvetica 字体，最小字号 8pt，线宽至少 0.5pt，分辨率 300 DPI。',
  },
  {
    id: 'cell',
    name: 'Cell',
    description: '单栏 85mm / 1.5栏 114mm / 双栏 174mm',
    prompt: '请按照 Cell 期刊的图表规范调整：单栏宽度 85mm，使用 Arial 字体，最小字号 6pt，线宽至少 0.5pt。',
  },
  {
    id: 'science',
    name: 'Science',
    description: '单栏 55mm / 双栏 120mm / 全页 174mm',
    prompt: '请按照 Science 期刊的图表规范调整：单栏宽度 55mm，双栏 120mm，使用 Helvetica 字体，字号 6-8pt。',
  },
  {
    id: 'ieee',
    name: 'IEEE',
    description: '单栏 3.5in / 双栏 7.16in，Times New Roman',
    prompt: '请按照 IEEE 期刊的图表规范调整：单栏宽度 3.5 英寸，使用 Times New Roman 字体，字号 8-10pt。',
  },
]

// ── Template Card ────────────────────────────────────────────

function TemplateCard({ template, onUse }) {
  const Icon = template.icon
  const t = useT()
  const name = t(template.nameKey)
  const desc = t(template.descKey)
  return (
    <button
      onClick={() => onUse(template.prompt)}
      className="w-full text-left rounded-lg border p-3 transition group"
      style={{
        borderColor: '#CFE0ED',
        background: 'rgba(255,255,255,0.5)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = template.color
        e.currentTarget.style.background = `${template.color}08`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#CFE0ED'
        e.currentTarget.style.background = 'rgba(255,255,255,0.5)'
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: template.color }} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1A2B3C' }}>{name}</span>
        <span style={{ fontSize: 10, color: '#7A99AE', fontFamily: 'JetBrains Mono, monospace' }}>{template.nameEn}</span>
      </div>
      <div style={{ fontSize: 11, color: '#4A6478', lineHeight: 1.4 }}>
        {desc}
      </div>
      <div className="flex gap-1 mt-1.5">
        {template.tags.map(tag => (
          <span key={tag} className="px-1.5 py-0.5 rounded"
            style={{ fontSize: 9.5, background: '#DDF0FB', color: '#4A6478' }}>
            {tag}
          </span>
        ))}
      </div>
    </button>
  )
}

// ── Journal Preset Button ────────────────────────────────────

function JournalButton({ preset, onUse }) {
  return (
    <button
      onClick={() => onUse(preset.prompt)}
      className="text-left rounded-md border px-2.5 py-2 transition"
      style={{ borderColor: '#CFE0ED', background: 'rgba(255,255,255,0.4)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.background = 'rgba(124,58,237,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#CFE0ED'; e.currentTarget.style.background = 'rgba(255,255,255,0.4)' }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, color: '#1A2B3C' }}>{preset.name}</div>
      <div style={{ fontSize: 10, color: '#7A99AE', marginTop: 1 }}>{preset.description}</div>
    </button>
  )
}

// ── Main Template Panel ──────────────────────────────────────

export function TemplatePanel({ onSendMessage }) {
  const [section, setSection] = useState('charts')
  const t = useT()

  return (
    <div className="flex flex-col h-full">
      {/* Section tabs */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: '#CFE0ED' }}>
        <button onClick={() => setSection('charts')}
          className="flex-1 px-3 py-2 text-center transition"
          style={{
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: section === 'charts' ? '#1A2B3C' : '#7A99AE',
            borderBottom: section === 'charts' ? '2px solid #7C3AED' : '2px solid transparent',
          }}>
          {t('chartTemplates')}
        </button>
        <button onClick={() => setSection('journals')}
          className="flex-1 px-3 py-2 text-center transition"
          style={{
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: section === 'journals' ? '#1A2B3C' : '#7A99AE',
            borderBottom: section === 'journals' ? '2px solid #7C3AED' : '2px solid transparent',
          }}>
          {t('journalSpecs')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {section === 'charts' ? (
          <div className="flex flex-col gap-2.5">
            <div style={{ fontSize: 10, color: '#7A99AE', marginBottom: 2 }}>
              {t('templateHint')}
            </div>
            {TEMPLATES.map(tmpl => (
              <TemplateCard key={tmpl.id} template={tmpl} onUse={onSendMessage} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div style={{ fontSize: 10, color: '#7A99AE', marginBottom: 2 }}>
              {t('journalHint')}
            </div>
            {JOURNAL_PRESETS.map(p => (
              <JournalButton key={p.id} preset={p} onUse={onSendMessage} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
