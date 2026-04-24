import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Settings, Eye, EyeOff,
  Check, Square, Search,
  Sparkles, Braces, Table2, Layers,
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

// ── LogoMark ─────────────────────────────────────────────────────

function LogoMark({ size = 22 }) {
  const dots = useState(() => {
    const pts = []
    const rng = (s => () => { s = (s * 9301 + 49297) % 233280; return s / 233280 })(42)
    const gauss = () => { const u = Math.max(rng(), 1e-6), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
    for (let i = 0; i < 28; i++) pts.push({ x: 11 + gauss() * 2.2, y: 22 + gauss() * 1.7, r: 0.5 + rng() * 0.45, o: 0.5 + rng() * 0.45 })
    for (let i = 0; i < 28; i++) pts.push({ x: 22 + gauss() * 2.2, y: 11 + gauss() * 1.7, r: 0.5 + rng() * 0.45, o: 0.5 + rng() * 0.45 })
    return pts
  })[0]

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="5" fill="var(--accent)" style={{ filter: 'drop-shadow(0 0 6px var(--accent-glow))' }} />
      <g stroke="var(--bg-0)" strokeWidth="0.3" opacity="0.18">
        {[12, 18, 24].map(x => <line key={`v${x}`} x1={x} y1="6" x2={x} y2="26" />)}
        {[12, 18, 24].map(y => <line key={`h${y}`} x1="6" y1={y} x2="26" y2={y} />)}
      </g>
      <g stroke="var(--bg-0)" strokeWidth="1" strokeLinecap="round" opacity="0.9">
        <line x1="6" y1="26" x2="6" y2="6" />
        <line x1="6" y1="26" x2="26" y2="26" />
      </g>
      <line x1="6.5" y1="25.5" x2="25.5" y2="6.5" stroke="var(--bg-0)" strokeWidth="0.7" strokeDasharray="1.2 1" opacity="0.65" />
      <g fill="var(--bg-0)">
        {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={d.o} />)}
      </g>
    </svg>
  )
}

function Wordmark({ onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>
      <LogoMark size={22} />
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: 'var(--f-disp)', fontStyle: 'italic', fontWeight: 500, fontSize: 15, color: 'var(--fg-0)', letterSpacing: '-0.01em' }}>
          OpenPlot<span style={{ color: 'var(--accent)' }}>Agent</span>
        </div>
        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 8.5, color: 'var(--fg-3)', letterSpacing: '0.28em', marginTop: 2 }}>
          SPATIAL · v2
        </div>
      </div>
    </button>
  )
}

// ── Command palette ───────────────────────────────────────────────

function CommandPalette({ open, onClose, onAction }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef(null)
  const t = useT()

  useEffect(() => {
    if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  if (!open) return null

  const items = [
    { grp: t('cmdGrpGenerate'), ic: '✦', label: t('cmdRegen'),        shr: '↵',   action: 'regen' },
    { grp: t('cmdGrpView'),     ic: '◉',  label: t('cmdNewTask'),      shr: '',    action: 'new-task' },
    { grp: t('cmdGrpView'),     ic: '◈',  label: t('cmdNewExp'),       shr: '',    action: 'new-exp' },
    { grp: t('cmdGrpExport'),   ic: '⤓',  label: t('cmdExportPdf'),    shr: '⌘P',  action: 'export-pdf' },
    { grp: t('cmdGrpExport'),   ic: '⤓',  label: t('cmdExportSvg'),    shr: '',    action: 'export-svg' },
    { grp: t('cmdGrpHistory'),  ic: '⟲',  label: t('cmdUndo'),         shr: '⌘Z',  action: 'undo' },
  ]
  const filtered = q ? items.filter(i => i.label.toLowerCase().includes(q.toLowerCase())) : items
  const groups = [...new Set(filtered.map(i => i.grp))]
  let flatIdx = 0

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-box" onClick={e => e.stopPropagation()}>
        <input ref={inputRef} className="cmd-search"
          placeholder={t('cmdPlaceholder')}
          value={q} onChange={e => { setQ(e.target.value); setSel(0) }}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'ArrowDown') setSel(s => Math.min(s + 1, filtered.length - 1))
            if (e.key === 'ArrowUp') setSel(s => Math.max(s - 1, 0))
            if (e.key === 'Enter' && filtered[sel]) { onAction?.(filtered[sel].action); onClose() }
          }} />
        <div className="cmd-results">
          {groups.map(g => (
            <div key={g}>
              <div className="cmd-grp">{g}</div>
              {filtered.filter(i => i.grp === g).map(i => {
                const idx = flatIdx++
                return (
                  <div key={i.label} className={`cmd-item ${sel === idx ? 'sel' : ''}`}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => { onAction?.(i.action); onClose() }}>
                    <span className="ci-ic">{i.ic}</span>
                    <span>{i.label}</span>
                    {i.shr && <span className="ci-shr">{i.shr}</span>}
                  </div>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 20, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-3)', textAlign: 'center' }}>
              no matches
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── useDraggable ──────────────────────────────────────────────────

function useDraggable(initial) {
  const [pos, setPos] = useState(initial)
  const [size, setSize] = useState(null)
  const posRef = useRef(pos)
  const sizeRef = useRef(size)
  posRef.current = pos; sizeRef.current = size

  const onDragStart = useCallback((e) => {
    e.preventDefault()
    const ox = e.clientX - posRef.current.x, oy = e.clientY - posRef.current.y
    const onMove = (ev) => setPos({ x: ev.clientX - ox, y: ev.clientY - oy })
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const onResizeStart = useCallback((e, initW, initH) => {
    e.preventDefault(); e.stopPropagation()
    const sx = e.clientX, sy = e.clientY
    const ow = sizeRef.current?.w ?? initW, oh = sizeRef.current?.h ?? initH
    const onMove = (ev) => setSize({ w: Math.max(200, ow + ev.clientX - sx), h: Math.max(120, oh + ev.clientY - sy) })
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return { pos, size, onDragStart, onResizeStart }
}

// ── useZStack ─────────────────────────────────────────────────────

function useZStack(ids) {
  const [order, setOrder] = useState(ids)
  const bringToFront = useCallback((id) => {
    setOrder(prev => [...prev.filter(x => x !== id), id])
  }, [])
  const getZ = useCallback((id) => 40 + order.indexOf(id), [order])
  return { bringToFront, getZ }
}

// ── FloatPanel ────────────────────────────────────────────────────

function FloatPanel({ title, icon, onClose, defaultPos, defaultW, defaultH, zIndex, onFocus, children }) {
  const { pos, size, onDragStart, onResizeStart } = useDraggable(defaultPos)
  const w = size?.w ?? defaultW
  const h = size?.h ?? defaultH
  return (
    <div
      className="float-panel"
      style={{ left: pos.x, top: pos.y, width: w, height: h, zIndex }}
      onMouseDown={onFocus}
    >
      <div className="float-panel-head" onMouseDown={onDragStart}>
        {icon && <span style={{ fontSize: 11, color: 'var(--fg-3)', marginRight: 2 }}>{icon}</span>}
        <span className="float-panel-title">{title}</span>
        {onClose && (
          <button
            onClick={e => { e.stopPropagation(); onClose() }}
            style={{
              marginLeft: 'auto', fontFamily: 'var(--f-mono)', fontSize: 12,
              color: 'var(--fg-3)', width: 20, height: 20,
              display: 'grid', placeItems: 'center', borderRadius: 3,
            }}
          >
            ✕
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      <div className="resize-grip" onMouseDown={e => onResizeStart(e, w, h)} />
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────

function Toast({ text }) {
  return (
    <div className="toast">
      <Check size={12} color="var(--accent)" />
      <span>{text}</span>
    </div>
  )
}

// ── Language toggle ───────────────────────────────────────────────

function LangToggle() {
  const { lang, setLang } = useStore()
  return (
    <div className="lang-toggle">
      {[['zh', '中'], ['en', 'EN']].map(([l, label]) => (
        <button key={l} onClick={() => setLang(l)} className={`lang-btn ${lang === l ? 'on' : ''}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Status bar ────────────────────────────────────────────────────

function StatusBar({ gitStatus }) {
  const { gitLog } = useStore()
  const latestHash = gitLog[0]?.hash?.slice(0, 7) ?? ''
  return (
    <div className="status-bar">
      <div className="status-pill active">
        <span className="live-dot" style={{ width: 5, height: 5 }} />
        <span>agent.loop</span>
      </div>
      <div className="status-pill">
        <span style={{ color: 'var(--ok)', fontSize: 8 }}>●</span>
        <span>venv · py 3</span>
      </div>
      <div className={`status-pill ${gitStatus === 'saved' ? 'active' : ''}`}>
        <span>git</span>
        {latestHash && <span style={{ color: 'var(--accent-dim)', fontFamily: 'var(--f-mono)', fontSize: 9.5 }}>· {latestHash}</span>}
      </div>
      <div className="status-stream" />
      <div className="status-tokens" style={{ fontFamily: 'var(--f-mono)', fontSize: 10 }}>
        <span style={{ color: 'var(--fg-4)' }}>MEM</span>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────

function inferBranch(msg = '') {
  const m = msg.toLowerCase()
  if (m.startsWith('agent') || m.includes('[agent]')) return 'agent'
  if (m.startsWith('manual') || m.includes('[manual]') || /^title|^legend|^xlabel|^ylabel/.test(m)) return 'manual'
  return 'main'
}

function Sidebar({ onNewTask, onNewExperiment, showToast }) {
  const {
    activeProjectId, activeExperimentId, activeTaskId,
    experiments, tasks, gitLog, fetchGitLog, fetchSvg, updateSvgContent,
    setActive, setActiveExperiment, setActiveTask,
  } = useStore()
  const t = useT()
  const [gitOpen, setGitOpen] = useState(true)
  const [restoring, setRestoring] = useState(null)

  const clickExperiment = async (eid) => {
    if (eid !== activeExperimentId) await setActiveExperiment(eid)
  }
  const clickTask = (eid, tid) => setActive(activeProjectId, eid, tid)

  const restoreCommit = async (hash) => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    setRestoring(hash)
    try {
      const r = await fetch(
        `/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/git/restore`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash }) }
      )
      if (r.ok) {
        const data = await r.json()
        if (data.svg_content) updateSvgContent(data.svg_content)
        fetchSvg(); fetchGitLog()
        showToast?.(t('restoredTo', { hash: hash.slice(0, 7) }))
      } else showToast?.(t('restoreFailed'))
    } catch { showToast?.(t('restoreFailed')) } finally { setRestoring(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Project card */}
      {activeProjectId && (
        <div className="proj-card">
          <div className="proj-name">{activeProjectId}</div>
          <div className="proj-sub">WORKSPACE</div>
        </div>
      )}

      {/* Experiment / task tree */}
      <div className="side-section" style={{ flexShrink: 0 }}>
        <div className="side-head">
          <span className="side-label">EXPERIMENT</span>
          <span className="side-count">{experiments.length}</span>
        </div>
        {experiments.map(exp => {
          const isActiveExp = exp.experiment_id === activeExperimentId
          const expTasks = isActiveExp ? tasks : []
          return (
            <div key={exp.experiment_id}>
              <div className={`exp-row ${isActiveExp ? 'active' : ''}`}
                onClick={() => clickExperiment(exp.experiment_id)}>
                <span>{exp.experiment_id}</span>
                <span style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>{expTasks.length || ''}</span>
              </div>
              {isActiveExp && expTasks.map(tk => (
                <div key={tk.task_id}
                  className={`task-item ${tk.task_id === activeTaskId ? 'active' : ''} ${!tk.has_plot ? 'final' : ''}`}
                  onClick={() => clickTask(exp.experiment_id, tk.task_id)}>
                  <span className="task-dot" style={tk.has_plot ? {} : { background: 'var(--fg-4)' }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tk.task_id}
                  </span>
                  <span className="task-meta">{tk.has_plot ? 'v' + expTasks.indexOf(tk) : ''}</span>
                </div>
              ))}
            </div>
          )
        })}
        {experiments.length === 0 && (
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-4)', padding: '6px 2px' }}>
            {t('noExperiments')}
          </div>
        )}
      </div>

      {/* Git tree */}
      <div className="side-sec" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', borderTop: '1px solid var(--line)' }}>
        <div className="side-sec-head" onClick={() => setGitOpen(o => !o)} style={{ cursor: 'pointer', flexShrink: 0 }}>
          <span className="s-chev" style={{ transform: gitOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}>▶</span>
          <span className="s-title" style={{ flex: 1 }}>GIT TREE</span>
          <span className="s-badge">{gitLog.length}</span>
          <span className="s-spacer" />
          {gitOpen && activeTaskId && (
            <>
              <button className="s-btn" onClick={e => { e.stopPropagation(); restoreCommit(gitLog[0]?.hash) }}
                disabled={!gitLog[0]}>RESTORE</button>
              <button className="s-btn" style={{ marginLeft: 4 }} onClick={e => e.stopPropagation()}>DIFF</button>
            </>
          )}
        </div>
        {gitOpen && (
          <div className="git-tree-body">
            {gitLog.map((c, i) => {
              const branch = c.branch || inferBranch(c.message)
              const hm = (() => { try { return new Date(c.timestamp).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } })()
              const isCurrent = i === 0
              return (
                <div key={c.hash} className={`git-row ${isCurrent ? 'current' : ''}`}
                  onClick={() => restoreCommit(c.hash)}>
                  <span className="git-time">{hm}</span>
                  <div className="git-graph-col">
                    {i < gitLog.length - 1 && <div className="git-vline" />}
                    <div className={`git-dot ${branch}`} />
                    {restoring === c.hash && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="pulse-soft" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                      </div>
                    )}
                  </div>
                  <div className="git-msg">
                    <span className={`branch-tag ${branch}`}>{branch}</span>
                    {c.message}
                  </div>
                </div>
              )
            })}
            {gitLog.length === 0 && (
              <div style={{ padding: '12px 14px', fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--fg-4)' }}>
                no commits yet
              </div>
            )}
          </div>
        )}
      </div>

      {/* New task button */}
      <button className="new-btn-sidebar" onClick={onNewTask} style={{ flexShrink: 0 }}>
        <span style={{ fontSize: 13 }}>+</span> {t('newTask')}
      </button>
    </div>
  )
}

// ── Dashboard sidebar (project list) ─────────────────────────────

function DashboardSidebar({ onOpen }) {
  const { projects, fetchProjects, projectsLoading } = useStore()
  const t = useT()

  useEffect(() => { fetchProjects() }, [])

  return (
    <div className={`side-sec grow open`}>
      <div className="side-sec-head">
        <span className="s-chev">▶</span>
        <span className="s-title">{t('sideProjects')}</span>
        <span className="s-badge">{projects.length}</span>
      </div>
      <div className="side-sec-body">
        {projectsLoading
          ? <div style={{ padding: 12, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-4)' }}>{t('loading')}</div>
          : (
            <div className="tree">
              {projects.map(p => (
                <div key={p.project_id}
                  className="tree-row type-proj leaf"
                  onClick={() => onOpen(p.project_id)}>
                  <span className="tr-chev" />
                  <span className="tr-icon">◆</span>
                  <span className="tr-name">{p.project_id}</span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────

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
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">{t('newProjectTitle')}</div>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={t('newProjectNamePh')} className="modal-input"
          onKeyDown={e => e.key === 'Enter' && submit()} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder={t('newProjectDescPh')} rows={2}
          className="modal-input" style={{ resize: 'none' }} />
        <div className="modal-actions">
          <button onClick={onClose} className="modal-btn ghost">{t('cancel')}</button>
          <button onClick={submit} className="modal-btn primary">{t('create')}</button>
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
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">{t('newExperimentTitle')}</div>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={t('newExperimentNamePh')} className="modal-input"
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {experiments.length > 0 && (
          <>
            <label className="modal-label">{t('copyDataFrom')}</label>
            <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)} className="modal-select">
              <option value="">{t('noCopy')}</option>
              {experiments.map(e => <option key={e.experiment_id} value={e.experiment_id}>{e.experiment_id}</option>)}
            </select>
          </>
        )}
        <div className="modal-actions">
          <button onClick={onClose} className="modal-btn ghost">{t('cancel')}</button>
          <button onClick={submit} className="modal-btn primary">{t('create')}</button>
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
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-title">{t('newTaskTitle')}</div>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={t('newTaskNamePh')} className="modal-input"
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {tasks.length > 0 && (
          <>
            <label className="modal-label">{t('copyScriptFrom')}</label>
            <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)} className="modal-select">
              <option value="">{t('noCopy')}</option>
              {tasks.map(tk => <option key={tk.task_id} value={tk.task_id}>{tk.task_id}</option>)}
            </select>
          </>
        )}
        <div className="modal-actions">
          <button onClick={onClose} className="modal-btn ghost">{t('cancel')}</button>
          <button onClick={submit} className="modal-btn primary">{t('create')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard view ────────────────────────────────────────────────

const PALETTES = [
  { name: 'Okabe-Ito', colors: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2'] },
  { name: 'Tab10',     colors: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD'] },
  { name: 'Set2',      colors: ['#66C2A5', '#FC8D62', '#8DA0CB', '#E78AC3', '#A6D854'] },
  { name: 'Dark2',     colors: ['#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E'] },
]

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
    } finally { setLoadingDemo(false) }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }} className="fade-in">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--fg-3)', marginBottom: 10, textTransform: 'uppercase' }}>
              WORKSPACE · {projects.length} {t('projects')}
            </div>
            <h1 style={{ fontFamily: 'var(--f-disp)', fontSize: 38, lineHeight: 1.1, letterSpacing: '-0.02em', fontWeight: 400, margin: 0, color: 'var(--fg-0)' }}>
              {t('dashboardTitle')} <em style={{ fontStyle: 'italic', fontWeight: 500 }}>{t('dashboardTitleEm')}</em>
            </h1>
            <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--fg-2)', lineHeight: 1.6 }}>
              {t('dashboardSubtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
            <button onClick={loadDemo} disabled={loadingDemo}
              style={{
                fontFamily: 'var(--f-mono)', fontSize: 11.5, padding: '8px 14px', borderRadius: 5,
                border: '1px solid var(--line-strong)', color: 'var(--fg-2)',
                letterSpacing: '0.04em', opacity: loadingDemo ? 0.5 : 1,
              }}>
              {loadingDemo ? t('loading') : t('loadDemo')}
            </button>
            <button onClick={onNew}
              style={{
                fontFamily: 'var(--f-mono)', fontSize: 11.5, padding: '8px 14px', borderRadius: 5,
                background: 'var(--fg-0)', color: 'var(--bg-1)',
                display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '0.04em',
              }}>
              <Plus size={13} />{t('newProject')}
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, marginBottom: 20,
        }}>
          <Search size={13} style={{ color: 'var(--fg-4)', flexShrink: 0 }} />
          <input placeholder={t('searchProjects')} style={{ flex: 1, fontSize: 13, color: 'var(--fg-0)', background: 'transparent', border: 0, outline: 'none' }} />
        </div>

        {projectsLoading ? (
          <div className="pulse-soft" style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--fg-4)' }}>{t('loading')}</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--fg-4)' }}>{t('noProjects')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {projects.map(p => (
              <button key={p.project_id} onClick={() => onOpen(p.project_id)} className="dash-proj-card">
                <div className="dash-proj-name">{p.project_id}</div>
                <div className="dash-proj-path">{p.path}</div>
              </button>
            ))}
            <button onClick={onNew} className="dash-new-card">
              <Plus size={16} />
              <span style={{ fontFamily: 'var(--f-disp)', fontStyle: 'italic', fontSize: 13 }}>{t('newProject')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Git status badge ──────────────────────────────────────────────

function GitStatusBadge({ status }) {
  const t = useT()
  const cfg = {
    saved:   { color: 'var(--accent)', label: t('gitSaved') },
    saving:  { color: 'var(--accent-dim)', label: t('gitSaving') },
    pending: { color: 'var(--fg-4)', label: t('gitPending') },
  }[status] ?? { color: 'var(--fg-4)', label: status }
  return (
    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: cfg.color, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 8 }}>●</span>{cfg.label}
    </span>
  )
}

// ── Task main area ────────────────────────────────────────────────

const PIPE_NODES = [
  { id: 'data',   label: '① DATA',   icon: '▦' },
  { id: 'agent',  label: '② AGENT',  icon: '✦' },
  { id: 'code',   label: '③ CODE',   icon: '{}' },
  { id: 'chart',  label: '④ CHART',  icon: '◉' },
  { id: 'export', label: '⑤ EXPORT', icon: '⤓' },
]

function TaskMainArea({ showToast, send,
  loopNode, setDockOpen, setDockTab, setCodeOpen, setDataOpen, setChartVisible,
  showBorders, setShowBorders,
}) {
  const { activeProjectId, activeExperimentId, activeTaskId, svgContent, gitLog, gitStatus, fetchGitLog, updateSvgContent } = useStore()
  const t = useT()
  const [pdfName, setPdfName] = useState('')
  const [showPdfBar, setShowPdfBar] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [selTool, setSelTool] = useState('select')

  useEffect(() => {
    if (activeProjectId && activeExperimentId && activeTaskId)
      setPdfName(`${activeProjectId}-${activeExperimentId}-${activeTaskId}.pdf`)
  }, [activeProjectId, activeExperimentId, activeTaskId])

  const downloadPdf = async () => {
    setExportingPdf(true)
    try {
      const r = await fetch(`/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/chart/export-pdf`)
      if (!r.ok) { showToast(t('pdfFailed')); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = pdfName || 'output.pdf'; a.click()
      URL.revokeObjectURL(url); setShowPdfBar(false)
    } finally { setExportingPdf(false) }
  }

  const handlePipeClick = (id) => {
    if (id === 'data')   { setDataOpen(d => !d); setDockOpen(false) }
    if (id === 'agent')  { setDataOpen(false); setCodeOpen(false); setDockOpen(true); setDockTab('chat') }
    if (id === 'code')   { setCodeOpen(c => !c); setDockOpen(false) }
    if (id === 'chart')  { setChartVisible(v => !v) }
    if (id === 'export') { setShowPdfBar(b => !b) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Pipeline bar ── */}
      <div className="pipe-bar">
        {PIPE_NODES.map((n, i) => (
          <div key={n.id} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={`pipe-node ${loopNode === n.id ? 'on' : ''}`}
              onClick={() => handlePipeClick(n.id)}>
              <div className="pn-label">
                <span className="pn-dot" />
                {n.label}
              </div>
              <div className="pn-meta">
                {n.id === 'data'   && (gitLog.length ? '7 × 5' : '—')}
                {n.id === 'agent'  && (gitLog.length ? `${gitLog.length} turns` : '—')}
                {n.id === 'code'   && 'plot.py'}
                {n.id === 'chart'  && (svgContent ? '24 elem' : '—')}
                {n.id === 'export' && 'PGF · 88mm'}
              </div>
            </div>
            {i < PIPE_NODES.length - 1 && <div className="pipe-arrow">→</div>}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {/* palette pickers inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 14 }}>
          {PALETTES.map(p => (
            <button key={p.name} title={t('applyPalette', { name: p.name })}
              onClick={() => applyPaletteDirect({
                svgContent, palette: p.colors,
                activeProjectId, activeExperimentId, activeTaskId,
                updateSvgContent, fetchGitLog,
                onNotice: (n) => showToast(n.text),
                msgs: { noColors: t('noColorsDetected'), writeFailed: t('paletteWriteFailed'), replaced: (n) => t('colorsReplaced', { n }), backendError: t('backendError') },
              })}
              style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 5px', borderRadius: 3, border: '1px solid var(--line)' }}>
              {p.colors.slice(0, 4).map(c => (
                <span key={c} style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 1, background: c }} />
              ))}
            </button>
          ))}
          <button onClick={() => setShowBorders(b => !b)}
            style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, color: showBorders ? 'var(--fg-1)' : 'var(--fg-4)' }}>
            {showBorders ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
          <GitStatusBadge status={gitStatus} />
        </div>
      </div>

      {/* ── Toolbar bar ── */}
      <div className="toolbar-bar">
        <button className={`tool-btn ${selTool === 'select' ? 'on' : ''}`} onClick={() => setSelTool('select')}>
          ▽ SELECT <span className="tk">V</span>
        </button>
        <button className={`tool-btn ${selTool === 'pan' ? 'on' : ''}`} onClick={() => setSelTool('pan')}>
          ⊕ PAN <span className="tk">H</span>
        </button>
        <span className="tool-div" />
        <button className="tool-btn" onClick={() => send('重新生成图表')}>
          ▶ RENDER <span className="tk">⇧P</span>
        </button>
        <span className="tool-div" />
        <button className="tool-btn" onClick={() => setShowPdfBar(b => !b)}>
          ⤓ EXPORT PDF
        </button>
      </div>

      {/* PDF filename bar */}
      {showPdfBar && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0, background: 'var(--bg-2)' }}>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>{t('filename')}</span>
          <input value={pdfName} onChange={e => setPdfName(e.target.value)}
            style={{ flex: 1, fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-0)', padding: '3px 8px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-1)' }} />
          <button onClick={downloadPdf} disabled={exportingPdf}
            style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, padding: '3px 10px', borderRadius: 4, background: exportingPdf ? 'var(--bg-2)' : 'var(--fg-0)', color: exportingPdf ? 'var(--fg-3)' : 'var(--bg-1)' }}>
            {exportingPdf ? t('generating') : t('download')}
          </button>
        </div>
      )}

      {/* ── Canvas workspace (float panels render over this) ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--bg-0)' }}>
        {!activeTaskId && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--fg-4)' }}>
            {t('selectOrCreateTask')}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Floating agent dock (draggable) ───────────────────────────────

function AgentDock({ open, onClose, dockTab, setDockTab,
  messages, send, generating, stop,
  selectedEl, setSelectedEl,
  provider, onProviderChange,
  zIndex, onFocus,
}) {
  const { appendChatDraft } = useStore()
  const t = useT()
  const { pos, size, onDragStart, onResizeStart } = useDraggable({ x: window.innerWidth - 480, y: window.innerHeight - 520 })

  if (!open) return null

  const TABS = [
    ['chat',       t('tabChat')],
    ['edit',       t('tabEdit')],
    ['properties', t('tabProperties')],
    ['palette',    t('tabPalette')],
    ['memory',     t('tabMemory')],
    ['template',   t('tabTemplate')],
  ]

  const w = size?.w ?? 420
  const h = size?.h ?? 480

  return (
    <div className="float-panel" style={{ left: pos.x, top: pos.y, width: w, height: h, zIndex }} onMouseDown={onFocus}>
      <div className="float-panel-head" onMouseDown={onDragStart}>
        <span className="live-dot" />
        <span className="float-panel-title">AGENT · <b style={{ color: 'var(--accent)', fontWeight: 400 }}>CLAUDE-SONNET-4-6</b></span>
        <div className="dock-actions">
          {generating && (
            <button className="dock-act" onClick={stop} style={{ color: 'var(--err)' }}>
              <Square size={9} fill="currentColor" style={{ display: 'inline-block', marginRight: 3, verticalAlign: 'middle' }} />
              {t('stop')}
            </button>
          )}
          <button className="dock-act" onClick={onClose}>×</button>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', paddingLeft: 8, background: 'var(--bg-2)', flexShrink: 0 }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setDockTab(id)}
            style={{
              fontFamily: 'var(--f-mono)', fontSize: 10, padding: '5px 8px', letterSpacing: '0.04em',
              color: dockTab === id ? 'var(--accent)' : 'var(--fg-3)',
              borderBottom: dockTab === id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {dockTab === 'chat' && (
          <ChatPanel messages={messages} send={send} generating={generating} provider={provider} onProviderChange={onProviderChange} />
        )}
        {dockTab === 'edit' && (
          <ElementEditor selected={selectedEl} onClose={() => setDockTab('chat')}
            onSendMessage={(msg) => { send(msg); setDockTab('chat') }} />
        )}
        {dockTab === 'properties' && <PropertiesPanel />}
        {dockTab === 'palette' && <PalettePanel />}
        {dockTab === 'memory' && <MemoryPanel />}
        {dockTab === 'template' && (
          <TemplatePanel onSendMessage={(msg) => { appendChatDraft(msg); setDockTab('chat') }} />
        )}
      </div>
      <div className="resize-grip" onMouseDown={(e) => onResizeStart(e, w, h)} />
    </div>
  )
}

// ── SVG chart float panel ─────────────────────────────────────────

function SvgChartPanel({ onClose, onElementClick, showBorders, generating, zIndex, onFocus }) {
  return (
    <FloatPanel
      title="◉ CHART" onClose={onClose}
      defaultPos={{ x: 80, y: 90 }} defaultW={700} defaultH={520}
      zIndex={zIndex} onFocus={onFocus}
    >
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <SvgPreview showBorders={showBorders} onElementClick={onElementClick} />
        {generating && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'oklch(100% 0 0 / 0.82)',
            backdropFilter: 'blur(3px)', zIndex: 5,
          }}>
            <div className="pulse-soft" style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--accent)', letterSpacing: '0.08em', textAlign: 'center' }}>
              <span className="live-dot" style={{ marginRight: 8 }} />generating…
            </div>
          </div>
        )}
      </div>
    </FloatPanel>
  )
}

// ── Code float panel ──────────────────────────────────────────────

function CodeFloatPanel({ onClose, onStageToChat, zIndex, onFocus }) {
  return (
    <FloatPanel
      title="{} CODE" onClose={onClose}
      defaultPos={{ x: Math.max(20, window.innerWidth - 560), y: 90 }} defaultW={520} defaultH={480}
      zIndex={zIndex} onFocus={onFocus}
    >
      <ScriptTab onStageToChat={onStageToChat} />
    </FloatPanel>
  )
}

// ── Data float panel ──────────────────────────────────────────────

function DataFloatPanel({ onClose, onStageToChat, zIndex, onFocus }) {
  return (
    <FloatPanel
      title="▦ DATA" onClose={onClose}
      defaultPos={{ x: Math.max(20, window.innerWidth - 560), y: 180 }} defaultW={560} defaultH={440}
      zIndex={zIndex} onFocus={onFocus}
    >
      <ProcessedTab onStageToChat={onStageToChat} onTableReady={onClose} />
    </FloatPanel>
  )
}

// ── Layers panel (functional, draggable) ─────────────────────────

const LAYER_DEFS = [
  { gid: 'title',    name: 'Title',    dotColor: 'var(--fg-1)' },
  { gid: 'xlabel',   name: 'X Label',  dotColor: 'var(--fg-2)' },
  { gid: 'ylabel',   name: 'Y Label',  dotColor: 'var(--fg-2)' },
  { gid: 'legend',   name: 'Legend',   dotColor: 'var(--accent)' },
  { gid: 'xaxis',    name: 'X Axis',   dotColor: 'var(--fg-2)' },
  { gid: 'yaxis',    name: 'Y Axis',   dotColor: 'var(--fg-2)' },
  { gid: 'suptitle', name: 'Suptitle', dotColor: 'var(--fg-1)' },
]

const LAYER_GID_PREFIXES = ['bar_', 'line_', 'scatter_', 'patch_', 'annotation_']

function LayersPanel({ onClose, onLayerClick, zIndex, onFocus }) {
  const { svgContent } = useStore()

  const layers = useMemo(() => {
    if (!svgContent) return LAYER_DEFS
    const idRegex = /\bid="([^"]+)"/g
    const seen = new Set()
    const result = []
    let m
    while ((m = idRegex.exec(svgContent)) !== null) {
      const id = m[1]
      if (!id || id.startsWith('_') || seen.has(id)) continue
      const knownDef = LAYER_DEFS.find(d => d.gid === id)
      const isDynamic = LAYER_GID_PREFIXES.some(p => id.startsWith(p))
      if (knownDef || isDynamic) {
        seen.add(id)
        result.push(knownDef || { gid: id, name: id, dotColor: 'var(--accent)' })
      }
    }
    return result.length ? result : LAYER_DEFS
  }, [svgContent])

  return (
    <FloatPanel
      title="LAYERS" onClose={onClose}
      defaultPos={{ x: 20, y: 120 }} defaultW={220} defaultH={340}
      zIndex={zIndex} onFocus={onFocus}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
        {layers.map(layer => (
          <div
            key={layer.gid}
            className="layer-item"
            style={{ cursor: 'pointer' }}
            onClick={() => onLayerClick?.(layer.gid)}
            title={`Edit ${layer.name}`}
          >
            <span className="layer-glyph" style={{ background: layer.dotColor }} />
            <span style={{ flex: 1 }}>{layer.name}</span>
            <Eye size={11} style={{ color: 'var(--fg-4)', flexShrink: 0 }} />
          </div>
        ))}
        {layers.length === 0 && (
          <div style={{ padding: '12px 8px', fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--fg-4)' }}>
            no layers yet
          </div>
        )}
      </div>
    </FloatPanel>
  )
}

// ── Element edit float panel ──────────────────────────────────────

function ElementEditFloat({ selected, onClose, onSendMessage, zIndex, onFocus }) {
  if (!selected) return null
  return (
    <FloatPanel
      title={`EDIT · ${selected.gid}`} onClose={onClose}
      defaultPos={{ x: 260, y: 120 }} defaultW={360} defaultH={440}
      zIndex={zIndex} onFocus={onFocus}
    >
      <ElementEditor
        selected={selected}
        onClose={onClose}
        onSendMessage={onSendMessage}
      />
    </FloatPanel>
  )
}

// ── Workspace view ────────────────────────────────────────────────

function WorkspaceView({
  showToast, onNewExperiment, onNewTask,
  dockOpen, setDockOpen, dockTab, setDockTab,
  codeOpen, setCodeOpen, dataOpen, setDataOpen,
  layersVisible, setLayersVisible,
}) {
  const { activeExperimentId, activeTaskId, fetchGitLog, fetchSvgOrRender, appendChatDraft } = useStore()
  const t = useT()
  const [provider, setProvider] = useState('ollama')
  const { messages, send, generating, stop } = useAgentChat(provider)
  const [selectedEl, setSelectedEl] = useState(null)
  const [editVisible, setEditVisible] = useState(false)
  const [chartVisible, setChartVisible] = useState(false)
  const [showBorders, setShowBorders] = useState(true)

  // z-stack: last in array = highest z-index
  const { bringToFront, getZ } = useZStack(['data', 'code', 'chart', 'layers', 'edit', 'agent'])

  // Auto-open chart panel when task becomes active
  useEffect(() => {
    if (activeTaskId) setChartVisible(true)
  }, [activeTaskId])

  useEffect(() => {
    fetchGitLog()
    if (activeTaskId) fetchSvgOrRender()
  }, [activeTaskId])

  // Clicking an SVG element directly opens the agent dock's edit tab
  const onElementClick = useCallback(({ gid, element, container }) => {
    setSelectedEl({ gid, element, container })
    setDockTab('edit')
    setDockOpen(true)
    bringToFront('agent')
  }, [setDockOpen, setDockTab, bringToFront])

  // Clicking a layer in LayersPanel opens the standalone ElementEditFloat
  const onLayerClick = useCallback((gid) => {
    const container = document.querySelector('[data-role="svg-preview"]')
    if (!container) return
    let element = null
    try {
      element = container.querySelector(`#${CSS.escape(gid)}`)
    } catch {
      element = container.querySelector(`[id="${gid}"]`)
    }
    setSelectedEl({ gid, element, container })
    setEditVisible(true)
    bringToFront('edit')
  }, [bringToFront])

  const stageToChat = useCallback((text) => {
    appendChatDraft(text)
    setDockTab('chat')
    setDockOpen(true)
    bringToFront('agent')
  }, [appendChatDraft, setDockOpen, setDockTab, bringToFront])

  const loopNode = dataOpen ? 'data'
    : codeOpen ? 'code'
    : dockOpen ? 'agent'
    : chartVisible ? 'chart'
    : undefined

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', flex: 1, position: 'relative' }}>
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {activeTaskId
          ? <TaskMainArea
              showToast={showToast} send={send}
              loopNode={loopNode}
              setDockOpen={setDockOpen} setDockTab={setDockTab}
              setCodeOpen={setCodeOpen} setDataOpen={setDataOpen}
              setChartVisible={setChartVisible}
              showBorders={showBorders} setShowBorders={setShowBorders}
            />
          : activeExperimentId
            ? <ExperimentPanel />
            : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--fg-4)' }}>
                {t('selectOrCreateExperiment')}
              </div>
            )
        }
      </main>

      {/* ── Floating panels ── */}

      {activeTaskId && chartVisible && (
        <SvgChartPanel
          onClose={() => setChartVisible(false)}
          onElementClick={onElementClick}
          showBorders={showBorders}
          generating={generating}
          zIndex={getZ('chart')}
          onFocus={() => bringToFront('chart')}
        />
      )}

      {activeTaskId && codeOpen && (
        <CodeFloatPanel
          onClose={() => setCodeOpen(false)}
          onStageToChat={stageToChat}
          zIndex={getZ('code')}
          onFocus={() => bringToFront('code')}
        />
      )}

      {activeTaskId && dataOpen && (
        <DataFloatPanel
          onClose={() => setDataOpen(false)}
          onStageToChat={stageToChat}
          zIndex={getZ('data')}
          onFocus={() => bringToFront('data')}
        />
      )}

      {layersVisible && (
        <LayersPanel
          onClose={() => setLayersVisible(false)}
          onLayerClick={onLayerClick}
          zIndex={getZ('layers')}
          onFocus={() => bringToFront('layers')}
        />
      )}

      {editVisible && selectedEl && (
        <ElementEditFloat
          selected={selectedEl}
          onClose={() => setEditVisible(false)}
          onSendMessage={(msg) => { stageToChat(msg); setEditVisible(false) }}
          zIndex={getZ('edit')}
          onFocus={() => bringToFront('edit')}
        />
      )}

      <AgentDock
        open={dockOpen} onClose={() => setDockOpen(false)}
        dockTab={dockTab} setDockTab={setDockTab}
        messages={messages} send={send} generating={generating} stop={stop}
        selectedEl={selectedEl} setSelectedEl={setSelectedEl}
        provider={provider} onProviderChange={setProvider}
        zIndex={getZ('agent')} onFocus={() => bringToFront('agent')}
      />
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNewExperiment, setShowNewExperiment] = useState(false)
  const [showNewTask, setShowNewTask] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState(null)
  // workspace panel state — hoisted so actions rail can control them
  const [dockOpen, setDockOpen] = useState(false)
  const [dockTab, setDockTab] = useState('chat')
  const [codeOpen, setCodeOpen] = useState(false)
  const [dataOpen, setDataOpen] = useState(false)
  const [layersVisible, setLayersVisible] = useState(false)
  const { activeProjectId, activeExperimentId, activeTaskId, setActive, setActiveTask, gitStatus } = useStore()
  const t = useT()

  const showToast = (text) => { setToast(text); setTimeout(() => setToast(null), 2400) }

  const openProject = async (id, eid = null, tid = null) => {
    await setActive(id, eid, tid)
    setView('workspace')
  }

  // ⌘K shortcut
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true) }
      if (e.key === 'Escape') setCmdOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleCmdAction = (action) => {
    if (action === 'new-task') setShowNewTask(true)
    if (action === 'new-exp') setShowNewExperiment(true)
  }

  return (
    <>
      {/* ambient grid layer */}
      <div className="ambient" />

      {/* app grid shell */}
      <div className={`app ${sidebarCollapsed ? 'sb-collapsed' : ''}`}>

        {/* ── Topbar ── */}
        <div className="topbar">
          <button className="sb-toggle" onClick={() => setSidebarCollapsed(c => !c)} title={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
              <line x1="5.5" y1="2.5" x2="5.5" y2="11.5" />
              {sidebarCollapsed
                ? <path d="M 8 5 L 10 7 L 8 9" strokeLinecap="round" />
                : <path d="M 10 5 L 8 7 L 10 9" strokeLinecap="round" />}
            </svg>
          </button>

          <Wordmark onClick={() => setView('dashboard')} />

          <div className="topbar-sep" />

          {view === 'workspace' && activeProjectId && (
            <div className="breadcrumb">
              <button className="bc-btn" onClick={() => setView('dashboard')}>Projects</button>
              <span className="bc-sep">/</span>
              <button className="bc-btn" onClick={() => { setActive(activeProjectId); setView('workspace') }}>
                {activeProjectId}
              </button>
              {activeExperimentId && (
                <>
                  <span className="bc-sep">/</span>
                  <button className="bc-btn" onClick={() => setActiveTask(null)}>{activeExperimentId}</button>
                </>
              )}
              {activeTaskId && (
                <>
                  <span className="bc-sep">/</span>
                  <span className="bc-active">{activeTaskId}</span>
                </>
              )}
            </div>
          )}

          <div className="topbar-spacer" />

          <LangToggle />
          <button className="kbd-hint" onClick={() => setCmdOpen(true)}>
            <b>⌘K</b>
          </button>
          <button onClick={() => setShowSettings(true)}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, color: 'var(--fg-3)', transition: 'color 0.12s, background 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--fg-1)'; e.currentTarget.style.background = 'var(--bg-2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-3)'; e.currentTarget.style.background = 'transparent' }}>
            <Settings size={14} />
          </button>
        </div>

        {/* ── Sidebar ── */}
        <div className="sidebar">
          {view === 'workspace'
            ? <Sidebar
                onNewExperiment={() => setShowNewExperiment(true)}
                onNewTask={() => setShowNewTask(true)}
                showToast={showToast}
              />
            : <DashboardSidebar onOpen={openProject} />
          }
        </div>

        {/* ── Canvas ── */}
        <div className="canvas">
          {view === 'dashboard'
            ? <DashboardView onOpen={openProject} onNew={() => setShowNewProject(true)} />
            : <WorkspaceView
                showToast={showToast}
                onNewExperiment={() => setShowNewExperiment(true)}
                onNewTask={() => setShowNewTask(true)}
                dockOpen={dockOpen} setDockOpen={setDockOpen}
                dockTab={dockTab} setDockTab={setDockTab}
                codeOpen={codeOpen} setCodeOpen={setCodeOpen}
                dataOpen={dataOpen} setDataOpen={setDataOpen}
                layersVisible={layersVisible} setLayersVisible={setLayersVisible}
              />
          }
        </div>

        {/* ── Status bar ── */}
        <StatusBar gitStatus={gitStatus} />

        {/* ── Actions rail (right grid column) ── */}
        <div className="actions">
          <button className={`act-btn ${dockOpen && view === 'workspace' ? 'on' : ''}`}
            title="Agent" onClick={() => setDockOpen(d => !d)}>
            <Sparkles size={15} />
          </button>
          <button className={`act-btn ${codeOpen && view === 'workspace' ? 'on' : ''}`}
            title="Code" onClick={() => setCodeOpen(c => !c)}>
            <Braces size={15} />
          </button>
          <button className={`act-btn ${dataOpen && view === 'workspace' ? 'on' : ''}`}
            title="Data" onClick={() => setDataOpen(d => !d)}>
            <Table2 size={15} />
          </button>
          <span className="act-div" />
          <button className={`act-btn ${layersVisible && view === 'workspace' ? 'on' : ''}`}
            title="Layers" onClick={() => setLayersVisible(v => !v)}>
            <Layers size={15} />
          </button>
          <span className="act-div" />
          <button className="act-btn" title="Settings" onClick={() => setShowSettings(true)}>
            <Settings size={15} />
          </button>
        </div>

      </div>

      {/* Command palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onAction={handleCmdAction} />

      {/* Modals */}
      {showNewProject && (
        <NewProjectModal onClose={() => setShowNewProject(false)} onCreate={() => { setShowNewProject(false); showToast(t('projectCreated')) }} />
      )}
      {showNewExperiment && (
        <NewExperimentModal onClose={() => setShowNewExperiment(false)} onCreate={() => { setShowNewExperiment(false); showToast(t('experimentCreated')) }} />
      )}
      {showNewTask && (
        <NewTaskModal onClose={() => setShowNewTask(false)} onCreate={() => { setShowNewTask(false); showToast(t('taskCreated')) }} />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {toast && <Toast text={toast} />}
    </>
  )
}
