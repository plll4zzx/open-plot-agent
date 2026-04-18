import { useEffect, useState } from 'react'
import {
  BarChart3, Plus, Search, FolderOpen, Settings, ChevronRight,
  LayoutGrid, FileText, Star, GitBranch, MessageSquare,
  Sparkles, Check, Eye, EyeOff, SplitSquareHorizontal, Clock,
} from 'lucide-react'
import { useStore } from './store'
import { useAgentChat } from './hooks/useAgentChat'
import { ChatPanel } from './components/ChatPanel'
import { SvgPreview } from './components/SvgPreview'
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

  useEffect(() => { fetchProjects() }, [])

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
          <button onClick={onNew} className="flex items-center gap-2 px-4 py-2.5 rounded-md font-medium flex-shrink-0"
            style={{ fontSize: 13, background: '#1C1917', color: '#F5F1EA' }}>
            <Plus size={14} />新建项目
          </button>
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

// ── New Project Modal ────────────────────────────────────────

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

// ── New Task Modal ───────────────────────────────────────────

function NewTaskModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const { createTask } = useStore()

  const submit = async () => {
    if (!name.trim()) return
    await createTask(name.trim())
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
          className="w-full rounded-md px-3 py-2 outline-none mb-4"
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

// ── Workspace ────────────────────────────────────────────────

function WorkspaceView({ showToast, onNewTask }) {
  const { activeProjectId, activeTaskId, tasks, setActive, gitLog, fetchGitLog, gitStatus, svgContent } = useStore()
  const { messages, send, generating } = useAgentChat()
  const [showBorders, setShowBorders] = useState(true)
  const [rightTab, setRightTab] = useState('chat')

  useEffect(() => { fetchGitLog() }, [activeTaskId])

  const activeTask = tasks.find(t => t.task_id === activeTaskId)

  return (
    <div className="h-full grid overflow-hidden fade-in"
      style={{ gridTemplateColumns: '200px 1fr 340px 48px' }}>

      {/* Project Sidebar */}
      <aside className="flex flex-col border-r overflow-hidden" style={{ borderColor: '#E7E0D1' }}>
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: '#E7E0D1' }}>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em', color: '#A8A29E' }}>PROJECT</div>
          <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'Fraunces, serif', marginTop: 2 }}>{activeProjectId}</div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {tasks.map(t => (
            <button key={t.task_id}
              onClick={() => setActive(activeProjectId, t.task_id)}
              className="w-full text-left px-4 py-2.5 transition"
              style={{
                fontSize: 12.5,
                background: t.task_id === activeTaskId ? 'rgba(28,25,23,0.06)' : 'transparent',
                fontWeight: t.task_id === activeTaskId ? 500 : 400,
                color: t.task_id === activeTaskId ? '#1C1917' : '#57534E',
              }}>
              <span className="font-mono mr-2" style={{ fontSize: 10, color: '#A8A29E' }}>
                {t.has_plot ? '●' : '○'}
              </span>
              {t.task_id}
            </button>
          ))}
        </div>
        <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: '#E7E0D1' }}>
          <button onClick={onNewTask}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md"
            style={{ fontSize: 12, border: '1px solid #D6CFC2', color: '#44403C' }}>
            <Plus size={12} />新建任务
          </button>
        </div>
      </aside>

      {/* Preview + Timeline */}
      <main className="flex flex-col overflow-hidden">
        <SectionHeader num="01" title="预览"
          subtitle={activeTask ? activeTask.task_id : '—'}
          right={
            <div className="flex items-center gap-2">
              <GitStatusBadge status={gitStatus} />
              <button onClick={() => setShowBorders(b => !b)}
                className="w-6 h-6 flex items-center justify-center rounded"
                style={{ color: showBorders ? '#1C1917' : '#A8A29E' }}>
                {showBorders ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            </div>
          }
        />

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 flex flex-col p-6 pb-4">
            <div className="flex-1 rounded-xl overflow-hidden chart-shadow relative"
              style={{ background: '#FFFFFF', border: '1px solid #E7E0D1' }}>
              {!activeTaskId ? (
                <div className="flex-1 flex items-center justify-center h-full" style={{ color: '#A8A29E', fontSize: 13 }}>
                  选择或新建一个任务
                </div>
              ) : (
                <SvgPreview showBorders={showBorders} />
              )}
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

            {/* Git log mini-timeline */}
            {gitLog.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#78716C' }}>
                  <GitBranch size={11} /><span>历史</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {gitLog.slice(0, 8).map(c => (
                    <div key={c.hash} className="flex-shrink-0 rounded-lg px-3 py-2"
                      style={{ minWidth: 140, border: '1px solid #E7E0D1', background: '#FFFFFF' }}>
                      <div className="font-mono" style={{ fontSize: 10, color: '#A8A29E' }}>{c.hash}</div>
                      <div className="mt-0.5 truncate" style={{ fontSize: 11, color: '#57534E' }}>{c.message}</div>
                      <div className="font-mono mt-1" style={{ fontSize: 9.5, color: '#C4BEB7' }}>
                        {new Date(c.timestamp).toLocaleTimeString('zh', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Right panel body — tab content */}
      <div className="flex flex-col border-l overflow-hidden" style={{ borderColor: '#E7E0D1' }}>
        {rightTab === 'chat' && (
          <>
            <SectionHeader num="02" title="对话" />
            <div className="flex-1 overflow-hidden">
              <ChatPanel messages={messages} send={send} generating={generating} />
            </div>
          </>
        )}
        {rightTab === 'history' && (
          <>
            <SectionHeader num="02" title="历史" />
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {gitLog.map(c => (
                <div key={c.hash} className="flex items-start gap-2 mb-3">
                  <span className="font-mono mt-0.5" style={{ fontSize: 10, color: '#A8A29E', flexShrink: 0 }}>{c.hash}</span>
                  <div>
                    <div style={{ fontSize: 12, color: '#1C1917' }}>{c.message}</div>
                    <div className="font-mono" style={{ fontSize: 10, color: '#A8A29E' }}>
                      {new Date(c.timestamp).toLocaleString('zh')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Activity Rail */}
      <div className="flex flex-col items-center gap-1 py-3 border-l" style={{ borderColor: '#E7E0D1', background: 'rgba(255,255,255,0.3)' }}>
        {[
          ['chat', MessageSquare, '对话'],
          ['history', Clock, '历史'],
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
  const [showNewTask, setShowNewTask] = useState(false)
  const [toast, setToast] = useState(null)
  const { activeProjectId, setActive } = useStore()

  const showToast = (text) => {
    setToast(text)
    setTimeout(() => setToast(null), 2400)
  }

  const openProject = async (id) => {
    await setActive(id)
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
            <div className="flex items-center gap-2" style={{ fontSize: 12, color: '#78716C' }}>
              <ChevronRight size={12} />
              <button onClick={() => setView('dashboard')} className="hover:underline" style={{ color: '#44403C' }}>
                Projects
              </button>
              <ChevronRight size={12} />
              <span style={{ color: '#1C1917', fontWeight: 500 }}>{activeProjectId}</span>
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
          <button className="w-7 h-7 flex items-center justify-center rounded-md" style={{ color: '#78716C' }}>
            <Settings size={14} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {view === 'dashboard'
          ? <DashboardView onOpen={openProject} onNew={() => setShowNewProject(true)} />
          : <WorkspaceView showToast={showToast} onNewTask={() => setShowNewTask(true)} />
        }
      </div>

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={() => { setShowNewProject(false); showToast('项目已创建') }}
        />
      )}
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreate={() => { setShowNewTask(false); showToast('任务已创建') }}
        />
      )}
      {toast && <Toast text={toast} />}
    </div>
  )
}
