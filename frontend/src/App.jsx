import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3, Plus, Search, Settings, ChevronRight,
  LayoutGrid, FileText, MessageSquare, Eye, EyeOff,
  GitBranch, Clock, Check, ChevronDown, Pencil, Palette, Square,
} from 'lucide-react'
import { useStore } from './store'
import { useAgentChat } from './hooks/useAgentChat'
import { ChatPanel } from './components/ChatPanel'
import { SvgPreview } from './components/SvgPreview'
import { ProcessedTab, ScriptTab } from './components/DataPanel'
import { ElementEditor } from './components/ElementEditor'
import { PalettePanel } from './components/PalettePanel'
import { MemoryPanel } from './components/MemoryPanel'
import { TemplatePanel } from './components/TemplatePanel'
import { ExperimentPanel } from './components/ExperimentPanel'
import { SettingsModal } from './components/SettingsModal'
import './index.css'

// ── Shared atoms ────────────────────────────────────────────

function SectionHeader({ num, title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
      style={{ borderColor: '#E7E0D1', background: 'rgba(255,255,255,0.4)' }}>
      <div className="flex items-center gap-2">
        <span className="font-mono" style={{ fontSize: 10, color: '#A8A29E' }}>{num}</span>
        <span style={{ fontSize: 14, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: '#A8A29E' }}>· {subtitle}</span>}
      </div>
      {right}
    </div>
  )
}

function GitStatusBadge({ status }) {
  const cfg = {
    saved:   { color: '#0F766E', label: '已保存' },
    saving:  { color: '#B45309', label: '保存中…' },
    pending: { color: '#A8A29E', label: '等待提交' },
  }[status] ?? { color: '#A8A29E', label: status }
  return (
    <span className="font-mono flex items-center gap-1"
      style={{ fontSize: 10.5, color: cfg.color }}>
      <span style={{ fontSize: 8 }}>●</span>{cfg.label}
    </span>
  )
}

function Toast({ text }) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-md flex items-center gap-2 slide-in z-50"
      style={{ background: '#1C1917', color: '#F5F1EA', fontSize: 12.5, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
      <Check size={13} color="#0F766E" /><span>{text}</span>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────

function DashboardView({ onOpen, onNew }) {
  const { projects, fetchProjects, projectsLoading } = useStore()
  const [loadingDemo, setLoadingDemo] = useState(false)

  useEffect(() => { fetchProjects() }, [])

  const loadDemo = async () => {
    setLoadingDemo(true)
    try {
      const r = await fetch('/api/toy-example', { method: 'POST' })
      const { project_id, experiment_id, task_id } = await r.json()
      await onOpen(project_id, experiment_id, task_id)
    } finally {
      setLoadingDemo(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto fade-in">
      <div className="max-w-5xl mx-auto px-10 py-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="mb-2" style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em', color: '#A8A29E' }}>
              WORKSPACE · {projects.length} PROJECTS
            </div>
            <h1 style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.02em', fontFamily: 'Fraunces, serif', fontWeight: 400, margin: 0 }}>
              学术图表 <em style={{ fontStyle: 'italic', fontWeight: 500 }}>工作室</em>
            </h1>
            <p className="mt-3" style={{ fontSize: 14, color: '#57534E' }}>
              用 matplotlib + PGF 输出投稿级 PDF。每次编辑 git 自动留痕。
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={loadDemo} disabled={loadingDemo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md"
              style={{ fontSize: 13, border: '1px solid #D6CFC2', color: '#44403C', background: loadingDemo ? '#F5F1EA' : 'transparent' }}>
              {loadingDemo ? '加载中…' : '加载 Demo'}
            </button>
            <button onClick={onNew} className="flex items-center gap-2 px-4 py-2.5 rounded-md font-medium"
              style={{ fontSize: 13, background: '#1C1917', color: '#F5F1EA' }}>
              <Plus size={14} />新建项目
            </button>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-2 rounded-md px-3 py-2"
          style={{ background: '#FFFFFF', border: '1px solid #E7E0D1' }}>
          <Search size={14} style={{ color: '#A8A29E' }} />
          <input placeholder="搜索项目…" className="flex-1 outline-none bg-transparent" style={{ fontSize: 13 }} />
        </div>

        {projectsLoading ? (
          <div className="text-center py-20 pulse-soft" style={{ fontSize: 13, color: '#A8A29E' }}>加载中…</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20" style={{ fontSize: 13, color: '#A8A29E' }}>还没有项目，点击新建开始</div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {projects.map(p => (
              <button key={p.project_id} onClick={() => onOpen(p.project_id)}
                className="text-left rounded-xl p-5 transition hover:-translate-y-0.5"
                style={{ background: '#FFFFFF', border: '1px solid #E7E0D1' }}>
                <h3 style={{ fontSize: 16, fontFamily: 'Fraunces, serif', fontWeight: 500 }}>{p.project_id}</h3>
                <p className="mt-1 font-mono" style={{ fontSize: 11, color: '#A8A29E' }}>{p.path}</p>
              </button>
            ))}
            <button onClick={onNew}
              className="rounded-xl flex flex-col items-center justify-center gap-2 py-12"
              style={{ border: '1.5px dashed #D6CFC2', background: 'rgba(255,255,255,0.3)' }}>
              <Plus size={18} style={{ color: '#78716C' }} />
              <span style={{ fontSize: 13, fontFamily: 'Fraunces, serif', fontStyle: 'italic', color: '#44403C' }}>新建项目</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modals ───────────────────────────────────────────────────

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const { createProject } = useStore()

  const submit = async () => {
    if (!name.trim()) return
    await createProject(name.trim(), desc.trim())
    onCreate()
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(28,25,23,0.4)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-xl p-6 w-full max-w-sm mx-6"
        style={{ background: '#FAF6ED', border: '1px solid #E7E0D1' }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Fraunces, serif', marginBottom: 16 }}>新建项目</h3>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="项目名称（如 Nature 2026）"
          className="w-full rounded-md px-3 py-2 outline-none mb-3"
          style={{ fontSize: 13, border: '1px solid #D6CFC2', background: '#FFFFFF' }} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="描述（可选）" rows={2}
          className="w-full rounded-md px-3 py-2 outline-none resize-none mb-4"
          style={{ fontSize: 13, border: '1px solid #D6CFC2', background: '#FFFFFF' }} />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-md"
            style={{ fontSize: 12.5, border: '1px solid #D6CFC2', color: '#57534E' }}>取消</button>
          <button onClick={submit} className="flex-1 py-2 rounded-md font-medium"
            style={{ fontSize: 12.5, background: '#1C1917', color: '#F5F1EA' }}>创建</button>
        </div>
      </div>
    </div>
  )
}

function NewExperimentModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const { createExperiment, experiments } = useStore()

  const submit = async () => {
    if (!name.trim()) return
    await createExperiment(name.trim(), copyFrom || null)
    onCreate()
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(28,25,23,0.4)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-xl p-6 w-full max-w-sm mx-6"
        style={{ background: '#FAF6ED', border: '1px solid #E7E0D1' }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Fraunces, serif', marginBottom: 16 }}>新建实验</h3>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="实验名称（如 exp-baseline）"
          className="w-full rounded-md px-3 py-2 outline-none mb-3"
          style={{ fontSize: 13, border: '1px solid #D6CFC2', background: '#FFFFFF' }} />
        {experiments.length > 0 && (
          <div className="mb-4">
            <label style={{ fontSize: 11, color: '#78716C', display: 'block', marginBottom: 4 }}>复制原始数据自（可选）</label>
            <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)}
              className="w-full rounded-md px-3 py-2 outline-none"
              style={{ fontSize: 12.5, border: '1px solid #D6CFC2', background: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace' }}>
              <option value="">不复制</option>
              {experiments.map(e => (
                <option key={e.experiment_id} value={e.experiment_id}>{e.experiment_id}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-md"
            style={{ fontSize: 12.5, border: '1px solid #D6CFC2', color: '#57534E' }}>取消</button>
          <button onClick={submit} className="flex-1 py-2 rounded-md font-medium"
            style={{ fontSize: 12.5, background: '#1C1917', color: '#F5F1EA' }}>创建</button>
        </div>
      </div>
    </div>
  )
}

function NewTaskModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const { createTask, tasks } = useStore()

  const submit = async () => {
    if (!name.trim()) return
    await createTask(name.trim(), copyFrom || null)
    onCreate()
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(28,25,23,0.4)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-xl p-6 w-full max-w-sm mx-6"
        style={{ background: '#FAF6ED', border: '1px solid #E7E0D1' }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Fraunces, serif', marginBottom: 16 }}>新建任务</h3>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="任务名称（如 Fig.2 时间演化）"
          className="w-full rounded-md px-3 py-2 outline-none mb-3"
          style={{ fontSize: 13, border: '1px solid #D6CFC2', background: '#FFFFFF' }} />
        {tasks.length > 0 && (
          <div className="mb-4">
            <label style={{ fontSize: 11, color: '#78716C', display: 'block', marginBottom: 4 }}>复制数据/脚本自（可选）</label>
            <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)}
              className="w-full rounded-md px-3 py-2 outline-none"
              style={{ fontSize: 12.5, border: '1px solid #D6CFC2', background: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace' }}>
              <option value="">不复制</option>
              {tasks.map(t => (
                <option key={t.task_id} value={t.task_id}>{t.task_id}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-md"
            style={{ fontSize: 12.5, border: '1px solid #D6CFC2', color: '#57534E' }}>取消</button>
          <button onClick={submit} className="flex-1 py-2 rounded-md font-medium"
            style={{ fontSize: 12.5, background: '#1C1917', color: '#F5F1EA' }}>创建</button>
        </div>
      </div>
    </div>
  )
}

// ── 3-level Sidebar ──────────────────────────────────────────

function Sidebar({ onNewExperiment, onNewTask }) {
  const {
    activeProjectId, activeExperimentId, activeTaskId,
    experiments, tasks,
    setActive, setActiveExperiment, setActiveTask,
  } = useStore()

  // Track which experiments are expanded in the tree
  const [expanded, setExpanded] = useState({})

  // Auto-expand active experiment
  useEffect(() => {
    if (activeExperimentId) {
      setExpanded(prev => ({ ...prev, [activeExperimentId]: true }))
    }
  }, [activeExperimentId])

  const clickExperiment = async (eid) => {
    // Always navigate to experiment view (clears any active task)
    if (eid !== activeExperimentId) {
      await setActiveExperiment(eid)
    } else {
      setActiveTask(null)  // same experiment: just clear task to show ExperimentPanel
    }
    // Always expand (don't collapse on click — use chevron for that)
    setExpanded(prev => ({ ...prev, [eid]: true }))
  }

  const toggleExpand = (e, eid) => {
    e.stopPropagation()
    setExpanded(prev => ({ ...prev, [eid]: !prev[eid] }))
  }

  const clickTask = (eid, tid) => {
    setActive(activeProjectId, eid, tid)
  }

  return (
    <aside className="flex flex-col border-r overflow-hidden" style={{ borderColor: '#E7E0D1' }}>
      {/* Project name */}
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#E7E0D1' }}>
        <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em', color: '#A8A29E' }}>PROJECT</div>
        <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'Fraunces, serif', marginTop: 2 }}>{activeProjectId}</div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {experiments.map(exp => {
          const isActiveExp = exp.experiment_id === activeExperimentId
          const isOpen = expanded[exp.experiment_id]
          const expTasks = isActiveExp ? tasks : []

          return (
            <div key={exp.experiment_id}>
              {/* Experiment row */}
              <div className="flex items-center group"
                style={{ background: isActiveExp && !activeTaskId ? 'rgba(28,25,23,0.05)' : 'transparent' }}>
                <button
                  onClick={() => clickExperiment(exp.experiment_id)}
                  className="flex-1 flex items-center gap-1.5 px-3 py-2 text-left transition min-w-0"
                  style={{ color: isActiveExp ? '#1C1917' : '#78716C' }}>
                  <ChevronDown
                    size={10}
                    onClick={(e) => toggleExpand(e, exp.experiment_id)}
                    style={{
                      flexShrink: 0,
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.15s',
                      color: '#A8A29E',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.05em',
                    fontWeight: isActiveExp ? 600 : 400,
                    textTransform: 'uppercase',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {exp.experiment_id}
                  </span>
                </button>
                {/* Inline + button on hover */}
                <button
                  onClick={async (e) => { e.stopPropagation(); await setActiveExperiment(exp.experiment_id); onNewTask() }}
                  title="新建任务"
                  className="opacity-0 group-hover:opacity-100 mr-2 w-5 h-5 flex items-center justify-center rounded transition"
                  style={{ color: '#A8A29E', border: '1px solid #D6CFC2', flexShrink: 0 }}>
                  <Plus size={9} />
                </button>
              </div>

              {/* Task rows (shown when expanded) */}
              {isOpen && isActiveExp && expTasks.map(t => (
                <button key={t.task_id}
                  onClick={() => clickTask(exp.experiment_id, t.task_id)}
                  className="w-full text-left flex items-center gap-2 py-2 transition"
                  style={{
                    paddingLeft: 24,
                    paddingRight: 12,
                    fontSize: 12,
                    background: t.task_id === activeTaskId ? 'rgba(28,25,23,0.06)' : 'transparent',
                    fontWeight: t.task_id === activeTaskId ? 500 : 400,
                    color: t.task_id === activeTaskId ? '#1C1917' : '#57534E',
                  }}>
                  <span style={{ fontSize: 8, color: t.has_plot ? '#0F766E' : '#C4BEB7', flexShrink: 0 }}>
                    {t.has_plot ? '●' : '○'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.task_id}
                  </span>
                </button>
              ))}
            </div>
          )
        })}

        {experiments.length === 0 && (
          <div className="px-4 py-3 text-center" style={{ fontSize: 12, color: '#C4BEB7' }}>
            还没有实验
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t flex-shrink-0 flex gap-2" style={{ borderColor: '#E7E0D1' }}>
        <button onClick={onNewExperiment}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md"
          style={{ fontSize: 11, border: '1px solid #D6CFC2', color: '#44403C' }}>
          <Plus size={11} />新建实验
        </button>
      </div>
    </aside>
  )
}

// ── Task main area ────────────────────────────────────────────

const TASK_TABS = [
  { id: 'processed', label: 'Processed' },
  { id: 'script',    label: 'Script' },
  { id: 'preview',   label: '预览' },
]

const PALETTES = [
  { name: 'Okabe-Ito', colors: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2'] },
  { name: 'Tab10',     colors: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD'] },
  { name: 'Set2',      colors: ['#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854'] },
  { name: 'Dark2',     colors: ['#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E'] },
]

function TaskMainArea({ showToast, generating, send, onElementClick }) {
  const { activeProjectId, activeExperimentId, activeTaskId, gitLog, gitStatus, fetchSvg, fetchGitLog, updateSvgContent } = useStore()
  const [tab, setTab] = useState('preview')
  const [showBorders, setShowBorders] = useState(true)
  const [pdfName, setPdfName] = useState('')
  const [showPdfBar, setShowPdfBar] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [restoringHash, setRestoringHash] = useState(null)

  useEffect(() => {
    if (activeProjectId && activeExperimentId && activeTaskId) {
      setPdfName(`${activeProjectId}-${activeExperimentId}-${activeTaskId}.pdf`)
    }
  }, [activeProjectId, activeExperimentId, activeTaskId])

  const downloadPdf = async () => {
    setExportingPdf(true)
    try {
      const r = await fetch(
        `/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/chart/export-pdf`
      )
      if (!r.ok) { showToast('PDF 生成失败'); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = pdfName || 'output.pdf'; a.click()
      URL.revokeObjectURL(url)
      setShowPdfBar(false)
    } finally {
      setExportingPdf(false)
    }
  }

  const restoreVersion = async (hash) => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    setRestoringHash(hash)
    try {
      const r = await fetch(
        `/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/git/restore`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hash }),
        }
      )
      if (r.ok) {
        const data = await r.json()
        if (data.svg_content) updateSvgContent(data.svg_content)
        fetchSvg()
        fetchGitLog()
        showToast(`已恢复到 ${hash}`)
        // Notify the agent about the restore via a chat message
        send?.(`[系统] 用户已将图表恢复到 git commit ${hash}，请注意 plot.py 内容已变更`)
      } else {
        showToast('恢复失败')
      }
    } catch {
      showToast('恢复失败')
    } finally {
      setRestoringHash(null)
    }
  }

  const handleTableReady = () => {
    showToast('表格已保存，切到预览让 agent 生成图表')
    setTab('preview')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b flex-shrink-0"
        style={{ borderColor: '#E7E0D1', background: 'rgba(255,255,255,0.4)' }}>
        <div className="px-4 py-3 flex-shrink-0">
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#A8A29E' }}>TASK</span>
          <span className="ml-2" style={{ fontSize: 14, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic' }}>
            {activeTaskId ?? '—'}
          </span>
        </div>
        <div className="flex items-center ml-2">
          {TASK_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-3 py-3 transition"
              style={{
                fontSize: 11.5,
                fontFamily: 'JetBrains Mono, monospace',
                color: tab === t.id ? '#1C1917' : '#A8A29E',
                fontWeight: tab === t.id ? 500 : 400,
                borderBottom: tab === t.id ? '2px solid #1C1917' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'preview' && (
          <div className="ml-auto px-4 flex items-center gap-2">
            <GitStatusBadge status={gitStatus} />
            {/* Palette chips */}
            {PALETTES.map(p => (
              <button key={p.name} title={p.name}
                onClick={() => send?.(`请将配色方案改为 ${p.name} 调色板`)}
                className="flex items-center gap-0.5 px-1.5 py-1 rounded-md transition"
                style={{ border: '1px solid #E7E0D1' }}>
                {p.colors.slice(0, 4).map(c => (
                  <span key={c} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: c }} />
                ))}
              </button>
            ))}
            <div className="w-px h-4 mx-0.5" style={{ background: '#E7E0D1' }} />
            <button onClick={() => setShowBorders(b => !b)}
              className="w-6 h-6 flex items-center justify-center rounded"
              style={{ color: showBorders ? '#1C1917' : '#A8A29E' }}>
              {showBorders ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button onClick={() => setShowPdfBar(b => !b)}
              className="px-2 py-1 rounded-md"
              style={{ fontSize: 11, border: '1px solid #D6CFC2', color: '#57534E' }}>
              下载 PDF
            </button>
          </div>
        )}
      </div>

      {/* Tab content — Processed and Pipeline stay mounted (CSS-hidden) to preserve state */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div style={{ display: tab === 'processed' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <ProcessedTab onTableReady={handleTableReady} onSendToAgent={(text) => send?.(`${text}\n\n请根据上面选中的内容回答或操作。`)} />
        </div>
        <div style={{ display: tab === 'script' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <ScriptTab onSendToAgent={(text) => send?.(`${text}\n\n请根据上面选中的代码回答或操作。`)} />
        </div>
        {tab === 'preview' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {showPdfBar && (
              <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0"
                style={{ borderColor: '#E7E0D1', background: 'rgba(255,255,255,0.6)' }}>
                <span style={{ fontSize: 11, color: '#A8A29E', fontFamily: 'JetBrains Mono, monospace' }}>文件名</span>
                <input value={pdfName} onChange={e => setPdfName(e.target.value)}
                  className="flex-1 rounded px-2 py-1 outline-none"
                  style={{ fontSize: 11.5, border: '1px solid #D6CFC2', background: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace' }} />
                <button onClick={downloadPdf} disabled={exportingPdf}
                  className="px-3 py-1 rounded-md text-xs font-medium flex-shrink-0"
                  style={{ background: exportingPdf ? '#E7E0D1' : '#1C1917', color: exportingPdf ? '#A8A29E' : '#F5F1EA' }}>
                  {exportingPdf ? '生成中…' : '下载'}
                </button>
              </div>
            )}
            <div className="flex-1 relative overflow-hidden">
              <div className="absolute inset-0 flex flex-col p-6 pb-4">
                <div className="flex-1 rounded-xl overflow-hidden chart-shadow relative"
                  style={{ background: '#FFFFFF', border: '1px solid #E7E0D1' }}>
                  {!activeTaskId
                    ? <div className="flex items-center justify-center h-full" style={{ color: '#A8A29E', fontSize: 13 }}>选择或新建一个任务</div>
                    : <SvgPreview showBorders={showBorders} onElementClick={onElementClick} />
                  }
                  {generating && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(245,241,234,0.75)', backdropFilter: 'blur(2px)' }}>
                      <div className="text-center pulse-soft">
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Agent 正在生成…</div>
                        <div className="mt-1 font-mono" style={{ fontSize: 11, color: '#78716C' }}>分析 → 生成代码 → 执行</div>
                      </div>
                    </div>
                  )}
                </div>
                {gitLog.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#78716C' }}>
                      <GitBranch size={11} /><span>历史</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {gitLog.slice(0, 8).map((c, idx) => (
                        <div key={c.hash} className="flex-shrink-0 rounded-lg px-3 py-2 group relative"
                          style={{ minWidth: 140, border: '1px solid #E7E0D1', background: '#FFFFFF' }}>
                          <div className="font-mono" style={{ fontSize: 10, color: '#A8A29E' }}>{c.hash}</div>
                          <div className="mt-0.5 truncate" style={{ fontSize: 11, color: '#57534E' }}>{c.message}</div>
                          <div className="font-mono mt-1 flex items-center justify-between" style={{ fontSize: 9.5, color: '#C4BEB7' }}>
                            <span>{new Date(c.timestamp).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' })}</span>
                            {idx > 0 && (
                              <button
                                onClick={() => restoreVersion(c.hash)}
                                disabled={restoringHash === c.hash}
                                className="opacity-0 group-hover:opacity-100 transition px-1.5 py-0.5 rounded"
                                style={{
                                  fontSize: 9,
                                  color: restoringHash === c.hash ? '#A8A29E' : '#0F766E',
                                  border: '1px solid #D6CFC2',
                                  background: 'rgba(255,255,255,0.9)',
                                }}>
                                {restoringHash === c.hash ? '恢复中…' : '恢复'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Drag handle ──────────────────────────────────────────────

function DragHandle({ onDragStart }) {
  return (
    <div
      onMouseDown={onDragStart}
      className="flex-shrink-0 relative group"
      style={{ width: 5, cursor: 'col-resize', zIndex: 10 }}>
      <div className="absolute inset-y-0"
        style={{
          left: 2, width: 1,
          background: '#E7E0D1',
          transition: 'background 0.1s',
        }} />
      <div className="absolute inset-y-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ left: 1, width: 3, background: 'rgba(28,25,23,0.15)' }} />
    </div>
  )
}

// ── Workspace ────────────────────────────────────────────────

function WorkspaceView({ showToast, onNewExperiment, onNewTask }) {
  const { activeExperimentId, activeTaskId, gitLog, fetchGitLog } = useStore()
  const [provider, setProvider] = useState('ollama')
  const { messages, send, generating, stop } = useAgentChat(provider)
  const [rightTab, setRightTab] = useState('chat')
  const [selectedEl, setSelectedEl] = useState(null)
  const [sidebarW, setSidebarW] = useState(200)
  const [rightW, setRightW] = useState(340)

  useEffect(() => { fetchGitLog() }, [activeTaskId])

  const onElementClick = useCallback(({ gid, element, container }) => {
    setSelectedEl({ gid, element, container })
    setRightTab('edit')
  }, [])

  const startDrag = (e, type) => {
    e.preventDefault()
    const startX = e.clientX
    const startSW = sidebarW
    const startRW = rightW
    const onMove = (me) => {
      const dx = me.clientX - startX
      if (type === 'sidebar') {
        setSidebarW(Math.max(140, Math.min(380, startSW + dx)))
      } else {
        setRightW(Math.max(240, Math.min(560, startRW - dx)))
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="h-full flex overflow-hidden fade-in">

      {/* Sidebar */}
      <div className="flex flex-col overflow-hidden flex-shrink-0" style={{ width: sidebarW }}>
        <Sidebar onNewExperiment={onNewExperiment} onNewTask={onNewTask} />
      </div>

      <DragHandle onDragStart={e => startDrag(e, 'sidebar')} />

      {/* Main area */}
      <main className="flex flex-col overflow-hidden flex-1 min-w-0">
        {activeTaskId
          ? <TaskMainArea showToast={showToast} generating={generating} send={send} onElementClick={onElementClick} />
          : activeExperimentId
            ? <ExperimentPanel />
            : (
              <div className="flex-1 flex items-center justify-center" style={{ color: '#A8A29E', fontSize: 13 }}>
                选择或新建一个实验
              </div>
            )
        }
      </main>

      <DragHandle onDragStart={e => startDrag(e, 'right')} />

      {/* Right panel */}
      <div className="flex flex-col overflow-hidden flex-shrink-0" style={{ width: rightW, borderLeft: '1px solid #E7E0D1' }}>
        {rightTab === 'chat' && (
          <>
            <SectionHeader num="02" title="PlotAgent" right={
              generating
                ? <button onClick={stop}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                    style={{ fontSize: 11, border: '1px solid #DC2626', color: '#DC2626', background: 'rgba(220,38,38,0.06)' }}>
                    <Square size={9} fill="currentColor" />停止
                  </button>
                : null
            } />
            <div className="flex-1 overflow-hidden">
              <ChatPanel messages={messages} send={send} generating={generating}
                provider={provider} onProviderChange={setProvider} />
            </div>
          </>
        )}
        {rightTab === 'edit' && (
          <>
            <SectionHeader num="03" title={selectedEl ? `编辑 · ${selectedEl.gid}` : '元素编辑'} />
            <div className="flex-1 overflow-hidden">
              <ElementEditor selected={selectedEl} onClose={() => setRightTab('chat')}
                onSendMessage={(msg) => { send(msg); setRightTab('chat') }} />
            </div>
          </>
        )}
        {rightTab === 'palette' && (
          <>
            <SectionHeader num="04" title="配色方案" />
            <div className="flex-1 overflow-hidden">
              <PalettePanel />
            </div>
          </>
        )}
        {rightTab === 'memory' && (
          <>
            <SectionHeader num="05" title="记忆" />
            <div className="flex-1 overflow-hidden">
              <MemoryPanel />
            </div>
          </>
        )}
        {rightTab === 'template' && (
          <>
            <SectionHeader num="06" title="模板" />
            <div className="flex-1 overflow-hidden">
              <TemplatePanel onSendMessage={(msg) => { send(msg); setRightTab('chat') }} />
            </div>
          </>
        )}
        {rightTab === 'history' && (
          <>
            <SectionHeader num="07" title="历史" />
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {gitLog.map((c, idx) => (
                <div key={c.hash} className="flex items-start gap-2 mb-3 group">
                  <span className="font-mono mt-0.5" style={{ fontSize: 10, color: '#A8A29E', flexShrink: 0 }}>{c.hash}</span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12, color: '#1C1917' }}>{c.message}</div>
                    <div className="font-mono flex items-center gap-2" style={{ fontSize: 10, color: '#A8A29E' }}>
                      <span>{new Date(c.timestamp).toLocaleString('zh')}</span>
                      {idx > 0 && (
                        <button
                          onClick={() => {
                            const { activeProjectId, activeExperimentId, activeTaskId, fetchSvg: fSvg, fetchGitLog: fLog, updateSvgContent: uSvg } = useStore.getState()
                            if (!activeProjectId || !activeExperimentId || !activeTaskId) return
                            fetch(
                              `/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/git/restore`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ hash: c.hash }),
                              }
                            ).then(r => r.json()).then(data => {
                              if (data.ok) {
                                if (data.svg_content) uSvg(data.svg_content)
                                fSvg()
                                fLog()
                                send?.(`[系统] 用户已将图表恢复到 git commit ${c.hash}，请注意 plot.py 内容已变更`)
                              }
                            })
                          }}
                          className="opacity-0 group-hover:opacity-100 transition px-1.5 py-0.5 rounded"
                          style={{ fontSize: 9, color: '#0F766E', border: '1px solid #D6CFC2' }}>
                          恢复此版本
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Activity Rail */}
      <div className="flex flex-col items-center gap-1 py-3 border-l flex-shrink-0"
        style={{ width: 48, borderColor: '#E7E0D1', background: 'rgba(255,255,255,0.3)' }}>
        {[
          ['chat',     MessageSquare, '对话'],
          ['edit',     Pencil,        '元素编辑'],
          ['palette',  Palette,       '配色方案'],
          ['memory',   FileText,      '记忆'],
          ['template', LayoutGrid,    '模板'],
          ['history',  Clock,         '历史'],
        ].map(([id, Icon, label]) => (
          <button key={id} onClick={() => setRightTab(id)} title={label}
            className="w-9 h-9 flex items-center justify-center rounded-md transition relative"
            style={{
              background: rightTab === id ? '#FFFFFF' : 'transparent',
              color: rightTab === id ? '#1C1917' : '#A8A29E',
            }}>
            {rightTab === id && (
              <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r"
                style={{ background: '#1C1917' }} />
            )}
            <Icon size={15} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState('dashboard')
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNewExperiment, setShowNewExperiment] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState(null)
  const { activeProjectId, activeExperimentId, activeTaskId, setActive, setActiveTask } = useStore()

  const showToast = (text) => {
    setToast(text)
    setTimeout(() => setToast(null), 2400)
  }

  const openProject = async (id, eid = null, tid = null) => {
    await setActive(id, eid, tid)
    setView('workspace')
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col relative"
      style={{
        background: '#F5F1EA',
        backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(180,83,9,0.04), transparent 40%), radial-gradient(circle at 80% 90%, rgba(15,118,110,0.04), transparent 40%)',
        color: '#1C1917',
        fontFamily: 'Geist, -apple-system, sans-serif',
      }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b z-20 flex-shrink-0"
        style={{ borderColor: '#E7E0D1', background: 'rgba(245,241,234,0.85)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-5">
          <button onClick={() => setView('dashboard')} className="flex items-center gap-2.5 transition hover:opacity-70">
            <div className="w-7 h-7 flex items-center justify-center rounded" style={{ background: '#1C1917' }}>
              <BarChart3 size={15} color="#F5F1EA" strokeWidth={2.2} />
            </div>
            <span style={{ fontSize: 17, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic' }}>
              OpenPlotAgent
            </span>
          </button>
          {view === 'workspace' && activeProjectId && (
            <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 11.5, color: '#78716C' }}>
              <ChevronRight size={11} />
              <button onClick={() => setView('dashboard')} className="hover:underline transition"
                style={{ color: '#57534E' }}>
                Projects
              </button>
              <ChevronRight size={11} />
              <button onClick={() => { setActive(activeProjectId); setView('workspace') }}
                className="hover:underline transition"
                style={{ color: '#44403C', fontWeight: activeExperimentId ? 400 : 500 }}>
                {activeProjectId}
              </button>
              {activeExperimentId && (
                <>
                  <ChevronRight size={11} />
                  <button
                    onClick={() => setActiveTask(null)}
                    className="hover:underline transition"
                    style={{ color: '#44403C', fontWeight: activeTaskId ? 400 : 500 }}>
                    {activeExperimentId}
                  </button>
                </>
              )}
              {activeTaskId && (
                <>
                  <ChevronRight size={11} />
                  <span style={{ color: '#1C1917', fontWeight: 500 }}>{activeTaskId}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md p-0.5" style={{ background: '#E7E0D1' }}>
            {[['dashboard', LayoutGrid, '项目'], ['workspace', FileText, '工作台']].map(([k, I, l]) => (
              <button key={k} onClick={() => setView(k)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded transition"
                style={{
                  fontSize: 11.5,
                  background: view === k ? '#FFFFFF' : 'transparent',
                  color: view === k ? '#1C1917' : '#78716C',
                  fontWeight: view === k ? 500 : 400,
                }}>
                <I size={11} />{l}
              </button>
            ))}
          </div>
          <div className="w-px h-5 mx-1" style={{ background: '#D6CFC2' }} />
          <button onClick={() => setShowSettings(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:opacity-70"
            style={{ color: '#78716C' }}>
            <Settings size={14} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {view === 'dashboard'
          ? <DashboardView onOpen={openProject} onNew={() => setShowNewProject(true)} />
          : <WorkspaceView
              showToast={showToast}
              onNewExperiment={() => setShowNewExperiment(true)}
              onNewTask={() => setShowNewTask(true)}
            />
        }
      </div>

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={() => { setShowNewProject(false); showToast('项目已创建') }}
        />
      )}
      {showNewExperiment && (
        <NewExperimentModal
          onClose={() => setShowNewExperiment(false)}
          onCreate={() => { setShowNewExperiment(false); showToast('实验已创建') }}
        />
      )}
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreate={() => { setShowNewTask(false); showToast('任务已创建') }}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {toast && <Toast text={toast} />}
    </div>
  )
}
