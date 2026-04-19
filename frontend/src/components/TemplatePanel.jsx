import { useState } from 'react'
import { BarChart3, TrendingUp, Grid3X3, BoxSelect, ScatterChart, PieChart, Activity, Layers } from 'lucide-react'

// ── Template definitions ─────────────────────────────────────

const TEMPLATES = [
  {
    id: 'grouped_bar',
    name: '分组柱状图',
    nameEn: 'Grouped Bar Chart',
    icon: BarChart3,
    color: '#E69F00',
    description: '比较多组数据的均值差异，支持误差线',
    tags: ['对比', '分类'],
    prompt: '请画一个分组柱状图。X轴是分类变量，不同颜色表示不同组，Y轴是数值。请加上误差线（标准差）和显著性标注。使用 Okabe-Ito 配色。',
  },
  {
    id: 'line_plot',
    name: '折线图',
    nameEn: 'Line Plot',
    icon: TrendingUp,
    color: '#56B4E9',
    description: '展示趋势变化，支持多条线和置信区间',
    tags: ['趋势', '时间序列'],
    prompt: '请画一个折线图。X轴是时间或序列变量，Y轴是数值。如果有多组数据，用不同颜色和线型区分。加上图例和数据点标记。',
  },
  {
    id: 'heatmap',
    name: '热力图',
    nameEn: 'Heatmap',
    icon: Grid3X3,
    color: '#009E73',
    description: '展示矩阵数据或相关性，支持聚类',
    tags: ['矩阵', '相关性'],
    prompt: '请画一个热力图。将数值数据以颜色深浅表示。请加上色标(colorbar)、行列标签，并在每个格子中标注数值。使用 RdYlBu 配色。',
  },
  {
    id: 'box_plot',
    name: '箱线图',
    nameEn: 'Box Plot',
    icon: BoxSelect,
    color: '#F0E442',
    description: '展示数据分布、中位数、四分位数和异常值',
    tags: ['分布', '统计'],
    prompt: '请画一个箱线图（box plot）。按分类变量分组，展示数值的分布。显示中位数、四分位数、须和异常值。可以叠加散点（jitter）显示原始数据点。',
  },
  {
    id: 'scatter',
    name: '散点图',
    nameEn: 'Scatter Plot',
    icon: ScatterChart,
    color: '#0072B2',
    description: '展示两变量关系，支持回归线和分组',
    tags: ['相关', '回归'],
    prompt: '请画一个散点图。X轴和Y轴分别是两个数值变量。如果有分组变量，用不同颜色区分。添加回归拟合线和 R² 值。',
  },
  {
    id: 'violin',
    name: '小提琴图',
    nameEn: 'Violin Plot',
    icon: Activity,
    color: '#D55E00',
    description: '展示数据分布密度，比箱线图信息更丰富',
    tags: ['分布', '密度'],
    prompt: '请画一个小提琴图（violin plot）。按分类变量分组，展示数值分布的密度估计。内部叠加箱线图显示中位数和四分位数。',
  },
  {
    id: 'stacked_bar',
    name: '堆叠柱状图',
    nameEn: 'Stacked Bar Chart',
    icon: Layers,
    color: '#CC79A7',
    description: '展示各部分占总体的比例',
    tags: ['比例', '组成'],
    prompt: '请画一个堆叠柱状图。X轴是分类变量，每个柱子内部按不同类别堆叠，Y轴是数值或百分比。加上图例标注各层含义。',
  },
  {
    id: 'pie_donut',
    name: '环形图',
    nameEn: 'Donut Chart',
    icon: PieChart,
    color: '#7C3AED',
    description: '展示比例关系，中心可标注总数',
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
  return (
    <button
      onClick={() => onUse(template.prompt)}
      className="w-full text-left rounded-lg border p-3 transition group"
      style={{
        borderColor: '#E7E0D1',
        background: 'rgba(255,255,255,0.5)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = template.color
        e.currentTarget.style.background = `${template.color}08`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#E7E0D1'
        e.currentTarget.style.background = 'rgba(255,255,255,0.5)'
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: template.color }} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1C1917' }}>{template.name}</span>
        <span style={{ fontSize: 10, color: '#A8A29E', fontFamily: 'JetBrains Mono, monospace' }}>{template.nameEn}</span>
      </div>
      <div style={{ fontSize: 11, color: '#78716C', lineHeight: 1.4 }}>
        {template.description}
      </div>
      <div className="flex gap-1 mt-1.5">
        {template.tags.map(tag => (
          <span key={tag} className="px-1.5 py-0.5 rounded"
            style={{ fontSize: 9.5, background: '#F1ECE0', color: '#78716C' }}>
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
      style={{ borderColor: '#E7E0D1', background: 'rgba(255,255,255,0.4)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.background = 'rgba(124,58,237,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E7E0D1'; e.currentTarget.style.background = 'rgba(255,255,255,0.4)' }}
    >
      <div style={{ fontSize: 12, fontWeight: 500, color: '#1C1917' }}>{preset.name}</div>
      <div style={{ fontSize: 10, color: '#A8A29E', marginTop: 1 }}>{preset.description}</div>
    </button>
  )
}

// ── Main Template Panel ──────────────────────────────────────

export function TemplatePanel({ onSendMessage }) {
  const [section, setSection] = useState('charts')

  return (
    <div className="flex flex-col h-full">
      {/* Section tabs */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: '#E7E0D1' }}>
        <button onClick={() => setSection('charts')}
          className="flex-1 px-3 py-2 text-center transition"
          style={{
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: section === 'charts' ? '#1C1917' : '#A8A29E',
            borderBottom: section === 'charts' ? '2px solid #7C3AED' : '2px solid transparent',
          }}>
          图表模板
        </button>
        <button onClick={() => setSection('journals')}
          className="flex-1 px-3 py-2 text-center transition"
          style={{
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: section === 'journals' ? '#1C1917' : '#A8A29E',
            borderBottom: section === 'journals' ? '2px solid #7C3AED' : '2px solid transparent',
          }}>
          期刊规范
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {section === 'charts' ? (
          <div className="flex flex-col gap-2.5">
            <div style={{ fontSize: 10, color: '#A8A29E', marginBottom: 2 }}>
              点击模板，Agent 会基于你的数据生成对应图表
            </div>
            {TEMPLATES.map(t => (
              <TemplateCard key={t.id} template={t} onUse={onSendMessage} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div style={{ fontSize: 10, color: '#A8A29E', marginBottom: 2 }}>
              点击期刊规范，Agent 会按要求调整图表格式
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
