import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3, Plus, Search, Settings, ChevronRight,
  LayoutGrid, FileText, MessageSquare, Eye, EyeOff,
  GitBranch, Clock, Check, ChevronDown, Pencil, Palette, Square, SlidersHorizontal,
} from 'lucide-react'
import { useStore } from './store'
import { useT } from './i18n'
import { useAgentChat } from './hooks/useAgentChat'
import { ChatPanel } from './components/ChatPanel'
import { SvgPreview } from './components/SvgPreview'
import { ProcessedTab, ScriptTab } from './components/DataPanel'
import { ElementEditor } from './components/ElementEditor'
import { PalettePanel, applyPaletteDirect } from './components/PalettePanel'
import { ExperimentPanel } from './components/ExperimentPanel'
import { SettingsModal } from './components/SettingsModal'
import { MemoryPanel } from './components/MemoryPanel'
import { TemplatePanel } from './components/TemplatePanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import './index.css'

// ── Shared atoms ────────────────────────────────────────────

function SectionHeader({ num, title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
      style={{ borderColor: '#CFE0ED', background: 'rgba(255,255,255,0.4)' }}>
      <div className="flex items-center gap-2">
        <span className="font-mono" style={{ fontSize: 10, color: '#7A99AE' }}>{num}</span>
        <span style={{ fontSize: 14, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: '#7A99AE' }}>· {subtitle}</span>}
      </div>
      {right}
    </div>
  )
}

function GitStatusBadge({ status }) {
  const t = useT()
  const cfg = {
    saved:   { color: '#1A7DC4', label: t('gitSaved') },
    saving:  { color: '#1668A8', label: t('gitSaving') },
    pending: { color: '#7A99AE', label: t('gitPending') },
  }[status] ?? { color: '#7A99AE', label: status }
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
      style={{ background: '#1A2B3C', color: '#EBF4FA', fontSize: 12.5, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
      <Check size={13} color="#1A7DC4" /><span>{text}</span>
    </div>
  )
}

// ── Language toggle ──────────────────────────────────────────

function LangToggle() {
  const { lang, setLang } = useStore()
  return (
    <div className="flex items-center rounded-md p-0.5" style={{ background: '#CFE0ED' }}>
      {[['zh', '中'], ['en', 'EN']].map(([l, label]) => (
        <button key={l} onClick={() => setLang(l)}
          className="px-2 py-0.5 rounded transition"
          style={{
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            background: lang === l ? '#FFFFFF' : 'transparent',
            color: lang === l ? '#1A2B3C' : '#4A6478',
            fontWeight: lang === l ? 600 : 400,
          }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────

function DashboardView({ onOpen, onNew }) {
  const { projects, fetchProjects, projectsLoading } = useStore()
  const t = useT()
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
            <div className="mb-2" style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em', color: '#7A99AE' }}>
              WORKSPACE · {projects.length} PROJECTS
            </div>
            <h1 style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.02em', fontFamily: 'Fraunces, serif', fontWeight: 400, margin: 0 }}>
              学术图表 <em style={{ fontStyle: 'italic', fontWeight: 500 }}>工作室</em>
            </h1>
            <p className="mt-3" style={{ fontSize: 14, color: '#2E4A5E' }}>
              {t('dashboardSubtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={loadDemo} disabled={loadingDemo}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md"
              style={{ fontSize: 13, border: '1px solid #BDCFDF', color: '#1F3547', background: loadingDemo ? '#EBF4FA' : 'transparent' }}>
              {loadingDemo ? t('loading') : t('loadDemo')}
            </button>
            <button onClick={onNew} className="flex items-center gap-2 px-4 py-2.5 rounded-md font-medium"
              style={{ fontSize: 13, background: '#1A2B3C', color: '#EBF4FA' }}>
              <Plus size={14} />{t('newProject')}
            </button>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-2 rounded-md px-3 py-2"
          style={{ background: '#FFFFFF', border: '1px solid #CFE0ED' }}>
          <Search size={14} style={{ color: '#7A99AE' }} />
          <input placeholder={t('searchProjects')} className="flex-1 outline-none bg-transparent" style={{ fontSize: 13 }} />
        </div>

        {projectsLoading ? (
          <div className="text-center py-20 pulse-soft" style={{ fontSize: 13, color: '#7A99AE' }}>{t('loading')}</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20" style={{ fontSize: 13, color: '#7A99AE' }}>{t('noProjects')}</div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {projects.map(p => (
              <button key={p.project_id} onClick={() => onOpen(p.project_id)}
                className="text-left rounded-xl p-5 transition hover:-translate-y-0.5"
                style={{ background: '#FFFFFF', border: '1px solid #CFE0ED' }}>
                <h3 style={{ fontSize: 16, fontFamily: 'Fraunces, serif', fontWeight: 500 }}>{p.project_id}</h3>
                <p className="mt-1 font-mono" style={{ fontSize: 11, color: '#7A99AE' }}>{p.path}</p>
              </button>
            ))}
            <button onClick={onNew}
              className="rounded-xl flex flex-col items-center justify-center gap-2 py-12"
              style={{ border: '1.5px dashed #BDCFDF', background: 'rgba(255,255,255,0.3)' }}>
              <Plus size={18} style={{ color: '#4A6478' }} />
              <span style={{ fontSize: 13, fontFamily: 'Fraunces, serif', fontStyle: 'italic', color: '#1F3547' }}>{t('newProject')}</span>
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
  const t = useT()

  const submit = async () => {
    if (!name.trim()) return
    await createProject(name.trim(), desc.trim())
    onCreate()
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(26,43,60,0.4)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-xl p-6 w-full max-w-sm mx-6"
        style={{ background: '#F0F7FC', border: '1px solid #CFE0ED' }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Fraunces, serif', marginBottom: 16 }}>{t('newProjectTitle')}</h3>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={t('newProjectNamePh')}
          className="w-full rounded-md px-3 py-2 outline-none mb-3"
          style={{ fontSize: 13, border: '1px solid #BDCFDF', background: '#FFFFFF' }} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder={t('newProjectDescPh')} rows={2}
          className="w-full rounded-md px-3 py-2 outline-none resize-none mb-4"
          style={{ fontSize: 13, border: '1px solid #BDCFDF', background: '#FFFFFF' }} />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-md"
            style={{ fontSize: 12.5, border: '1px solid #BDCFDF', color: '#2E4A5E' }}>{t('cancel')}</button>
          <button onClick={submit} className="flex-1 py-2 rounded-md font-medium"
            style={{ fontSize: 12.5, background: '#1A2B3C', color: '#EBF4FA' }}>{t('create')}</button>
        </div>
      </div>
    </div>
  )
}

function NewExperimentModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const { createExperiment, experiments } = useStore()
  const t = useT()

  const submit = async () => {
    if (!name.trim()) return
    await createExperiment(name.trim(), copyFrom || null)
    onCreate()
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(26,43,60,0.4)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-xl p-6 w-full max-w-sm mx-6"
        style={{ background: '#F0F7FC', border: '1px solid #CFE0ED' }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Fraunces, serif', marginBottom: 16 }}>{t('newExperimentTitle')}</h3>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={t('newExperimentNamePh')}
          className="w-full rounded-md px-3 py-2 outline-none mb-3"
          style={{ fontSize: 13, border: '1px solid #BDCFDF', background: '#FFFFFF' }} />
        {experiments.length > 0 && (
          <div className="mb-4">
            <label style={{ fontSize: 11, color: '#4A6478', display: 'block', marginBottom: 4 }}>{t('copyDataFrom')}</label>
            <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)}
              className="w-full rounded-md px-3 py-2 outline-none"
              style={{ fontSize: 12.5, border: '1px solid #BDCFDF', background: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace' }}>
              <option value="">{t('noCopy')}</option>
              {experiments.map(e => (
                <option key={e.experiment_id} value={e.experiment_id}>{e.experiment_id}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-md"
            style={{ fontSize: 12.5, border: '1px solid #BDCFDF', color: '#2E4A5E' }}>{t('cancel')}</button>
          <button onClick={submit} className="flex-1 py-2 rounded-md font-medium"
            style={{ fontSize: 12.5, background: '#1A2B3C', color: '#EBF4FA' }}>{t('create')}</button>
        </div>
      </div>
    </div>
  )
}

function NewTaskModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const { createTask, tasks } = useStore()
  const t = useT()

  const submit = async () => {
    if (!name.trim()) return
    await createTask(name.trim(), copyFrom || null)
    onCreate()
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(26,43,60,0.4)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-xl p-6 w-full max-w-sm mx-6"
        style={{ background: '#F0F7FC', border: '1px solid #CFE0ED' }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Fraunces, serif', marginBottom: 16 }}>{t('newTaskTitle')}</h3>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={t('newTaskNamePh')}
          className="w-full rounded-md px-3 py-2 outline-none mb-3"
          style={{ fontSize: 13, border: '1px solid #BDCFDF', background: '#FFFFFF' }} />
        {tasks.length > 0 && (
          <div className="mb-4">
            <label style={{ fontSize: 11, color: '#4A6478', display: 'block', marginBottom: 4 }}>{t('copyScriptFrom')}</label>
            <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)}
              className="w-full rounded-md px-3 py-2 outline-none"
              style={{ fontSize: 12.5, border: '1px solid #BDCFDF', background: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace' }}>
              <option value="">{t('noCopy')}</option>
              {tasks.map(t => (
                <option key={t.task_id} value={t.task_id}>{t.task_id}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-md"
            style={{ fontSize: 12.5, border: '1px solid #BDCFDF', color: '#2E4A5E' }}>{t('cancel')}</button>
          <button onClick={submit} className="flex-1 py-2 rounded-md font-medium"
            style={{ fontSize: 12.5, background: '#1A2B3C', color: '#EBF4FA' }}>{t('create')}</button>
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
  const t = useT()

  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    if (activeExperimentId) {
      setExpanded(prev => ({ ...prev, [activeExperimentId]: true }))
    }
  }, [activeExperimentId])

  const clickExperiment = async (eid) => {
    if (eid !== activeExperimentId) {
      await setActiveExperiment(eid)
    } else {
      setActiveTask(null)
    }
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
    <aside className="flex flex-col border-r overflow-hidden" style={{ borderColor: '#CFE0ED' }}>
      <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#CFE0ED' }}>
        <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em', color: '#7A99AE' }}>PROJECT</div>
        <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'Fraunces, serif', marginTop: 2 }}>{activeProjectId}</div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {experiments.map(exp => {
          const isActiveExp = exp.experiment_id === activeExperimentId
          const isOpen = expanded[exp.experiment_id]
          const expTasks = isActiveExp ? tasks : []

          return (
            <div key={exp.experiment_id}>
              <div className="flex items-center group"
                style={{ background: isActiveExp && !activeTaskId ? 'rgba(26,43,60,0.05)' : 'transparent' }}>
                <button
                  onClick={() => clickExperiment(exp.experiment_id)}
                  className="flex-1 flex items-center gap-1.5 px-3 py-2 text-left transition min-w-0"
                  style={{ color: isActiveExp ? '#1A2B3C' : '#4A6478' }}>
                  <ChevronDown
                    size={10}
                    onClick={(e) => toggleExpand(e, exp.experiment_id)}
                    style={{
                      flexShrink: 0,
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.15s',
                      color: '#7A99AE',
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
                <button
                  onClick={async (e) => { e.stopPropagation(); await setActiveExperiment(exp.experiment_id); onNewTask() }}
                  title={t('newTask')}
                  className="opacity-0 group-hover:opacity-100 mr-2 w-5 h-5 flex items-center justify-center rounded transition"
                  style={{ color: '#7A99AE', border: '1px solid #BDCFDF', flexShrink: 0 }}>
                  <Plus size={9} />
                </button>
              </div>

              {isOpen && isActiveExp && expTasks.map(tk => (
                <button key={tk.task_id}
                  onClick={() => clickTask(exp.experiment_id, tk.task_id)}
                  className="w-full text-left flex items-center gap-2 py-2 transition"
                  style={{
                    paddingLeft: 24,
                    paddingRight: 12,
                    fontSize: 12,
                    background: tk.task_id === activeTaskId ? 'rgba(26,43,60,0.06)' : 'transparent',
                    fontWeight: tk.task_id === activeTaskId ? 500 : 400,
                    color: tk.task_id === activeTaskId ? '#1A2B3C' : '#2E4A5E',
                  }}>
                  <span style={{ fontSize: 8, color: tk.has_plot ? '#1A7DC4' : '#9DB5C7', flexShrink: 0 }}>
                    {tk.has_plot ? '●' : '○'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tk.task_id}
                  </span>
                </button>
              ))}
            </div>
          )
        })}

        {experiments.length === 0 && (
          <div className="px-4 py-3 text-center" style={{ fontSize: 12, color: '#9DB5C7' }}>
            {t('noExperiments')}
          </div>
        )}
      </div>

      <div className="px-3 py-3 border-t flex-shrink-0 flex gap-2" style={{ borderColor: '#CFE0ED' }}>
        <button onClick={onNewExperiment}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md"
          style={{ fontSize: 11, border: '1px solid #BDCFDF', color: '#1F3547' }}>
          <Plus size={11} />{t('newExperiment')}
        </button>
      </div>
    </aside>
  )
}

// ── Task main area ────────────────────────────────────────────

const PALETTES = [
  { name: 'Okabe-Ito', colors: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2'] },
  { name: 'Tab10',     colors: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD'] },
  { name: 'Set2',      colors: ['#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854'] },
  { name: 'Dark2',     colors: ['#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E'] },
]

function TaskMainArea({ showToast, generating, send, onElementClick, onStageToChat }) {
  const { activeProjectId, activeExperimentId, activeTaskId, svgContent, gitLog, gitStatus, fetchSvg, fetchGitLog, updateSvgContent } = useStore()
  const t = useT()
  const [tab, setTab] = useState('preview')
  const [showBorders, setShowBorders] = useState(true)
  const [pdfName, setPdfName] = useState('')
  const [showPdfBar, setShowPdfBar] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [restoringHash, setRestoringHash] = useState(null)

  const TASK_TABS = [
    { id: 'processed', label: 'Processed' },
    { id: 'script',    label: 'Script' },
    { id: 'preview',   label: t('previewTab') },
  ]

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
      if (!r.ok) { showToast(t('pdfFailed')); return }
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
        showToast(t('restoredTo', { hash }))
      } else {
        showToast(t('restoreFailed'))
      }
    } catch {
      showToast(t('restoreFailed'))
    } finally {
      setRestoringHash(null)
    }
  }

  const handleTableReady = () => {
    showToast(t('tableSaved'))
    setTab('preview')
  }

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="flex items-center border-b flex-shrink-0"
        style={{ borderColor: '#CFE0ED', background: 'rgba(255,255,255,0.4)' }}>
        <div className="px-4 py-3 flex-shrink-0">
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#7A99AE' }}>TASK</span>
          <span className="ml-2" style={{ fontSize: 14, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic' }}>
            {activeTaskId ?? '—'}
          </span>
        </div>
        <div className="flex items-center ml-2">
          {TASK_TABS.map(tk => (
            <button key={tk.id} onClick={() => setTab(tk.id)}
              className="px-3 py-3 transition"
              style={{
                fontSize: 11.5,
                fontFamily: 'JetBrains Mono, monospace',
                color: tab === tk.id ? '#1A2B3C' : '#7A99AE',
                fontWeight: tab === tk.id ? 500 : 400,
                borderBottom: tab === tk.id ? '2px solid #1A2B3C' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {tk.label}
            </button>
          ))}
        </div>
        {tab === 'preview' && (
          <div className="ml-auto px-4 flex items-center gap-2">
            <GitStatusBadge status={gitStatus} />
            {PALETTES.map(p => (
              <button key={p.name} title={t('applyPalette', { name: p.name })}
                onClick={() => applyPaletteDirect({
                  svgContent, palette: p.colors,
                  activeProjectId, activeExperimentId, activeTaskId,
                  updateSvgContent, fetchGitLog,
                  onNotice: (n) => showToast(n.text),
                  msgs: {
                    noColors: t('noColorsDetected'),
                    writeFailed: t('paletteWriteFailed'),
                    replaced: (n) => t('colorsReplaced', { n }),
                    backendError: t('backendError'),
                  },
                })}
                className="flex items-center gap-0.5 px-1.5 py-1 rounded-md transition hover:bg-black/5"
                style={{ border: '1px solid #CFE0ED' }}>
                {p.colors.slice(0, 4).map(c => (
                  <span key={c} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: c }} />
                ))}
              </button>
            ))}
            <div className="w-px h-4 mx-0.5" style={{ background: '#CFE0ED' }} />
            <button onClick={() => setShowBorders(b => !b)}
              className="w-6 h-6 flex items-center justify-center rounded"
              style={{ color: showBorders ? '#1A2B3C' : '#7A99AE' }}>
              {showBorders ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button onClick={() => setShowPdfBar(b => !b)}
              className="px-2 py-1 rounded-md"
              style={{ fontSize: 11, border: '1px solid #BDCFDF', color: '#2E4A5E' }}>
              {t('downloadPdf')}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div style={{ display: tab === 'processed' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <ProcessedTab onTableReady={handleTableReady} onStageToChat={onStageToChat} />
        </div>
        <div style={{ display: tab === 'script' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          <ScriptTab onStageToChat={onStageToChat} />
        </div>
        {tab === 'preview' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {showPdfBar && (
              <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0"
                style={{ borderColor: '#CFE0ED', background: 'rgba(255,255,255,0.6)' }}>
                <span style={{ fontSize: 11, color: '#7A99AE', fontFamily: 'JetBrains Mono, monospace' }}>{t('filename')}</span>
                <input value={pdfName} onChange={e => setPdfName(e.target.value)}
                  className="flex-1 rounded px-2 py-1 outline-none"
                  style={{ fontSize: 11.5, border: '1px solid #BDCFDF', background: '#FFFFFF', fontFamily: 'JetBrains Mono, monospace' }} />
                <button onClick={downloadPdf} disabled={exportingPdf}
                  className="px-3 py-1 rounded-md text-xs font-medium flex-shrink-0"
                  style={{ background: exportingPdf ? '#CFE0ED' : '#1A2B3C', color: exportingPdf ? '#7A99AE' : '#EBF4FA' }}>
                  {exportingPdf ? t('generating') : t('download')}
                </button>
              </div>
            )}
            <div className="flex-1 relative overflow-hidden">
              <div className="absolute inset-0 flex flex-col p-6 pb-4">
                <div className="flex-1 rounded-xl overflow-hidden chart-shadow relative"
                  style={{ background: '#FFFFFF', border: '1px solid #CFE0ED' }}>
                  {!activeTaskId
                    ? <div className="flex items-center justify-center h-full" style={{ color: '#7A99AE', fontSize: 13 }}>{t('selectOrCreateTask')}</div>
                    : <SvgPreview showBorders={showBorders} onElementClick={onElementClick} />
                  }
                  {generating && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(235,244,250,0.75)', backdropFilter: 'blur(2px)' }}>
                      <div className="text-center pulse-soft">
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{t('agentGenerating')}</div>
                        <div className="mt-1 font-mono" style={{ fontSize: 11, color: '#4A6478' }}>{t('agentPipeline')}</div>
                      </div>
                    </div>
                  )}
                </div>
                {gitLog.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#4A6478' }}>
                      <GitBranch size={11} /><span>{t('history')}</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {gitLog.slice(0, 8).map((c, idx) => {
                        const stripTime = new Date(c.timestamp).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' })
                        const versionRef = `<version_reference>\nhash: ${c.hash}\nmessage: ${c.message}\ntime: ${stripTime}\n</version_reference>`
                        return (
                          <div key={c.hash} className="flex-shrink-0 rounded-lg px-3 py-2 group relative"
                            style={{ minWidth: 140, border: '1px solid #CFE0ED', background: '#FFFFFF' }}>
                            <div className="font-mono" style={{ fontSize: 10, color: '#7A99AE' }}>{c.hash}</div>
                            <div className="mt-0.5 truncate" style={{ fontSize: 11, color: '#2E4A5E' }}>{c.message}</div>
                            <div className="font-mono mt-1 flex items-center justify-between" style={{ fontSize: 9.5, color: '#9DB5C7' }}>
                              <span>{stripTime}</span>
                              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                                {idx > 0 && (
                                  <button
                                    onClick={() => restoreVersion(c.hash)}
                                    disabled={restoringHash === c.hash}
                                    className="px-1.5 py-0.5 rounded"
                                    style={{
                                      fontSize: 9,
                                      color: restoringHash === c.hash ? '#7A99AE' : '#1A7DC4',
                                      border: '1px solid #BDCFDF',
                                      background: 'rgba(255,255,255,0.9)',
                                    }}>
                                    {restoringHash === c.hash ? t('restoring') : t('restore')}
                                  </button>
                                )}
                                <button
                                  onClick={() => onStageToChat?.(versionRef)}
                                  className="px-1.5 py-0.5 rounded"
                                  style={{
                                    fontSize: 9,
                                    color: '#4A6478',
                                    border: '1px solid #BDCFDF',
                                    background: 'rgba(255,255,255,0.9)',
                                  }}>
                                  {t('reference')}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
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
          background: '#CFE0ED',
          transition: 'background 0.1s',
        }} />
      <div className="absolute inset-y-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ left: 1, width: 3, background: 'rgba(26,43,60,0.15)' }} />
    </div>
  )
}

// ── Workspace ────────────────────────────────────────────────

function WorkspaceView({ showToast, onNewExperiment, onNewTask }) {
  const { activeExperimentId, activeTaskId, gitLog, fetchGitLog, fetchSvgOrRender, appendChatDraft } = useStore()
  const t = useT()
  const [provider, setProvider] = useState('ollama')
  const { messages, send, generating, stop } = useAgentChat(provider)
  const [rightTab, setRightTab] = useState('chat')
  const [selectedEl, setSelectedEl] = useState(null)
  const [sidebarW, setSidebarW] = useState(200)
  const [rightW, setRightW] = useState(340)
  const [restoringHash, setRestoringHash] = useState(null)

  const restoreVersion = useCallback(async (hash) => {
    const store = useStore.getState()
    const { activeProjectId, activeExperimentId: eid, activeTaskId: tid } = store
    if (!activeProjectId || !eid || !tid) return
    setRestoringHash(hash)
    try {
      const r = await fetch(
        `/api/projects/${activeProjectId}/experiments/${eid}/tasks/${tid}/git/restore`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash }) }
      )
      if (r.ok) {
        const data = await r.json()
        if (data.svg_content) store.updateSvgContent(data.svg_content)
        store.fetchSvg()
        store.fetchGitLog()
        showToast(t('restoredTo', { hash: hash.slice(0, 7) }))
      } else {
        showToast(t('restoreFailed'))
      }
    } catch {
      showToast(t('restoreFailed'))
    } finally {
      setRestoringHash(null)
    }
  }, [send, showToast, t])

  useEffect(() => {
    fetchGitLog()
    if (activeTaskId) fetchSvgOrRender()
  }, [activeTaskId])

  const onElementClick = useCallback(({ gid, element, container }) => {
    setSelectedEl({ gid, element, container })
    setRightTab('edit')
  }, [])

  const stageToChat = useCallback((text) => {
    appendChatDraft(text)
    setRightTab('chat')
  }, [appendChatDraft])

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

      <div className="flex flex-col overflow-hidden flex-shrink-0" style={{ width: sidebarW }}>
        <Sidebar onNewExperiment={onNewExperiment} onNewTask={onNewTask} />
      </div>

      <DragHandle onDragStart={e => startDrag(e, 'sidebar')} />

      <main className="flex flex-col overflow-hidden flex-1 min-w-0">
        {activeTaskId
          ? <TaskMainArea showToast={showToast} generating={generating} send={send} onElementClick={onElementClick} onStageToChat={stageToChat} />
          : activeExperimentId
            ? <ExperimentPanel />
            : (
              <div className="flex-1 flex items-center justify-center" style={{ color: '#7A99AE', fontSize: 13 }}>
                {t('selectOrCreateExperiment')}
              </div>
            )
        }
      </main>

      <DragHandle onDragStart={e => startDrag(e, 'right')} />

      <div className="flex flex-col overflow-hidden flex-shrink-0" style={{ width: rightW, borderLeft: '1px solid #CFE0ED' }}>
        {rightTab === 'chat' && (
          <>
            <SectionHeader num="02" title="PlotAgent" right={
              generating
                ? <button onClick={stop}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                    style={{ fontSize: 11, border: '1px solid #DC2626', color: '#DC2626', background: 'rgba(220,38,38,0.06)' }}>
                    <Square size={9} fill="currentColor" />{t('stop')}
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
            <SectionHeader num="03" title={selectedEl ? `${t('tabEdit')} · ${selectedEl.gid}` : t('tabEdit')} />
            <div className="flex-1 overflow-hidden">
              <ElementEditor selected={selectedEl} onClose={() => setRightTab('chat')}
                onSendMessage={(msg) => { send(msg); setRightTab('chat') }} />
            </div>
          </>
        )}
        {rightTab === 'properties' && (
          <>
            <SectionHeader num="04" title={t('sectionProperties')} />
            <div className="flex-1 overflow-hidden">
              <PropertiesPanel />
            </div>
          </>
        )}
        {rightTab === 'palette' && (
          <>
            <SectionHeader num="05" title={t('tabPalette')} />
            <div className="flex-1 overflow-hidden">
              <PalettePanel />
            </div>
          </>
        )}
        {rightTab === 'memory' && (
          <>
            <SectionHeader num="06" title={t('tabMemory')} />
            <div className="flex-1 overflow-hidden">
              <MemoryPanel />
            </div>
          </>
        )}
        {rightTab === 'template' && (
          <>
            <SectionHeader num="07" title={t('tabTemplate')} />
            <div className="flex-1 overflow-hidden">
              <TemplatePanel onSendMessage={(msg) => { appendChatDraft(msg); setRightTab('chat') }} />
            </div>
          </>
        )}
        {rightTab === 'history' && (
          <>
            <SectionHeader num="08" title={t('tabHistory')} subtitle={`${gitLog.length} ${t('tabHistory')}`} />
            <div className="flex-1 overflow-y-auto py-3">
              {gitLog.length === 0 && (
                <div className="text-center py-10" style={{ fontSize: 12, color: '#9DB5C7' }}>{t('noHistory')}</div>
              )}
              {gitLog.map((c, idx) => {
                const isCurrent = idx === 0
                const isRestoring = restoringHash === c.hash
                const formattedTime = new Date(c.timestamp).toLocaleString('zh', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                const versionRef = `<version_reference>\nhash: ${c.hash}\nmessage: ${c.message}\ntime: ${formattedTime}\n</version_reference>`
                return (
                  <div
                    key={c.hash}
                    className="w-full flex items-start gap-3 px-4 py-2.5 group"
                    style={{
                      background: isCurrent ? 'rgba(26,43,60,0.04)' : 'transparent',
                      opacity: isRestoring ? 0.5 : 1,
                    }}>
                    <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: 3 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: isCurrent ? '#1A2B3C' : '#BDCFDF',
                        border: `2px solid ${isCurrent ? '#1A2B3C' : '#BDCFDF'}`,
                      }} />
                      {idx < gitLog.length - 1 && (
                        <div style={{ width: 1, flex: 1, minHeight: 20, background: '#CFE0ED', margin: '3px 0' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono" style={{ fontSize: 9.5, color: '#7A99AE' }}>{c.hash}</span>
                        {isCurrent && (
                          <span style={{
                            fontSize: 9, borderRadius: 3, padding: '1px 5px',
                            background: '#1A2B3C', color: '#EBF4FA',
                          }}>{t('currentVersion')}</span>
                        )}
                      </div>
                      <div className="mt-0.5" style={{
                        fontSize: 12, color: '#1A2B3C',
                        fontWeight: isCurrent ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{c.message}</div>
                      <div className="font-mono mt-0.5" style={{ fontSize: 9.5, color: '#7A99AE' }}>
                        {formattedTime}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button
                          onClick={() => !isCurrent && restoreVersion(c.hash)}
                          disabled={isCurrent || isRestoring}
                          className="px-2 py-0.5 rounded transition"
                          style={{
                            fontSize: 10,
                            color: isCurrent ? '#9DB5C7' : '#1A7DC4',
                            border: '1px solid #BDCFDF',
                            background: 'rgba(255,255,255,0.9)',
                            cursor: isCurrent ? 'default' : 'pointer',
                          }}>
                          {isRestoring ? t('restoring') : t('restore')}
                        </button>
                        <button
                          onClick={() => { appendChatDraft(versionRef); setRightTab('chat') }}
                          className="px-2 py-0.5 rounded transition"
                          style={{
                            fontSize: 10,
                            color: '#4A6478',
                            border: '1px solid #BDCFDF',
                            background: 'rgba(255,255,255,0.9)',
                            cursor: 'pointer',
                          }}>
                          {t('reference')}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Activity Rail */}
      <div className="flex flex-col items-center gap-1 py-3 border-l flex-shrink-0"
        style={{ width: 48, borderColor: '#CFE0ED', background: 'rgba(255,255,255,0.3)' }}>
        {[
          ['chat',       MessageSquare,    t('tabChat')],
          ['edit',       Pencil,           t('tabEdit')],
          ['properties', SlidersHorizontal, t('tabProperties')],
          ['palette',    Palette,          t('tabPalette')],
          ['memory',     FileText,         t('tabMemory')],
          ['template',   LayoutGrid,       t('tabTemplate')],
          ['history',    Clock,            t('tabHistory')],
        ].map(([id, Icon, label]) => (
          <button key={id} onClick={() => setRightTab(id)} title={label}
            className="w-9 h-9 flex items-center justify-center rounded-md transition relative"
            style={{
              background: rightTab === id ? '#FFFFFF' : 'transparent',
              color: rightTab === id ? '#1A2B3C' : '#7A99AE',
            }}>
            {rightTab === id && (
              <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r"
                style={{ background: '#1A2B3C' }} />
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
  const t = useT()

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
        background: 'var(--c-bg, #EBF4FA)',
        backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(22,104,168,0.04), transparent 40%), radial-gradient(circle at 80% 90%, rgba(26,125,196,0.04), transparent 40%)',
        color: 'var(--c-text, #1A2B3C)',
        fontFamily: 'Geist, -apple-system, sans-serif',
      }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b z-20 flex-shrink-0"
        style={{ borderColor: 'var(--c-border, #CFE0ED)', background: 'var(--c-header, rgba(235,244,250,0.85))', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-5">
          <button onClick={() => setView('dashboard')} className="flex items-center gap-2.5 transition hover:opacity-70">
            <div className="w-7 h-7 flex items-center justify-center rounded" style={{ background: '#1A2B3C' }}>
              <BarChart3 size={15} color="#EBF4FA" strokeWidth={2.2} />
            </div>
            <span style={{ fontSize: 17, fontFamily: 'Fraunces, serif', fontWeight: 500, fontStyle: 'italic' }}>
              OpenPlotAgent
            </span>
          </button>
          {view === 'workspace' && activeProjectId && (
            <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 11.5, color: '#4A6478' }}>
              <ChevronRight size={11} />
              <button onClick={() => setView('dashboard')} className="hover:underline transition"
                style={{ color: '#2E4A5E' }}>
                Projects
              </button>
              <ChevronRight size={11} />
              <button onClick={() => { setActive(activeProjectId); setView('workspace') }}
                className="hover:underline transition"
                style={{ color: '#1F3547', fontWeight: activeExperimentId ? 400 : 500 }}>
                {activeProjectId}
              </button>
              {activeExperimentId && (
                <>
                  <ChevronRight size={11} />
                  <button
                    onClick={() => setActiveTask(null)}
                    className="hover:underline transition"
                    style={{ color: '#1F3547', fontWeight: activeTaskId ? 400 : 500 }}>
                    {activeExperimentId}
                  </button>
                </>
              )}
              {activeTaskId && (
                <>
                  <ChevronRight size={11} />
                  <span style={{ color: '#1A2B3C', fontWeight: 500 }}>{activeTaskId}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md p-0.5" style={{ background: '#CFE0ED' }}>
            {[['dashboard', LayoutGrid, t('navProjects')], ['workspace', FileText, t('navWorkspace')]].map(([k, I, l]) => (
              <button key={k} onClick={() => setView(k)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded transition"
                style={{
                  fontSize: 11.5,
                  background: view === k ? '#FFFFFF' : 'transparent',
                  color: view === k ? '#1A2B3C' : '#4A6478',
                  fontWeight: view === k ? 500 : 400,
                }}>
                <I size={11} />{l}
              </button>
            ))}
          </div>
          <div className="w-px h-5 mx-1" style={{ background: '#BDCFDF' }} />
          <LangToggle />
          <div className="w-px h-5 mx-1" style={{ background: '#BDCFDF' }} />
          <button onClick={() => setShowSettings(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:opacity-70"
            style={{ color: '#4A6478' }}>
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
          onCreate={() => { setShowNewProject(false); showToast(t('projectCreated')) }}
        />
      )}
      {showNewExperiment && (
        <NewExperimentModal
          onClose={() => setShowNewExperiment(false)}
          onCreate={() => { setShowNewExperiment(false); showToast(t('experimentCreated')) }}
        />
      )}
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreate={() => { setShowNewTask(false); showToast(t('taskCreated')) }}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {toast && <Toast text={toast} />}
    </div>
  )
}
