import { create } from 'zustand'

const API = ''  // proxied via vite

const DARK_EDITOR_THEMES = new Set(['one-dark-pro', 'dracula', 'nord', 'monokai'])

// Apply initial theme on module load
;(function applyInitialTheme() {
  const t = localStorage.getItem('editorTheme') || 'openplot-light'
  document.documentElement.setAttribute('data-theme', DARK_EDITOR_THEMES.has(t) ? 'dark' : 'light')
})()

export const useStore = create((set, get) => ({
  // ── Projects ──────────────────────────────────────────────
  projects: [],
  projectsLoading: false,

  fetchProjects: async () => {
    set({ projectsLoading: true })
    try {
      const r = await fetch(`${API}/api/projects`)
      const { projects } = await r.json()
      set({ projects })
    } finally {
      set({ projectsLoading: false })
    }
  },

  createProject: async (name, description = '') => {
    const r = await fetch(`${API}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    const data = await r.json()
    await get().fetchProjects()
    return data
  },

  // ── Active project / experiment / task ────────────────────
  activeProjectId: null,
  activeExperimentId: null,
  activeTaskId: null,

  experiments: [],
  experimentsLoading: false,
  tasks: [],

  setActive: async (projectId, experimentId = null, taskId = null) => {
    set({
      activeProjectId: projectId,
      activeExperimentId: experimentId,
      activeTaskId: taskId,
      experiments: [],
      tasks: [],
      svgContent: null,
    })
    if (!projectId) return

    // Fetch experiments
    set({ experimentsLoading: true })
    try {
      const r = await fetch(`${API}/api/projects/${projectId}/experiments`)
      const { experiments } = await r.json()
      set({ experiments })

      // Auto-select experiment
      const eid = experimentId || experiments[0]?.experiment_id || null
      if (eid) {
        set({ activeExperimentId: eid })
        const r2 = await fetch(`${API}/api/projects/${projectId}/experiments/${eid}/tasks`)
        const { tasks } = await r2.json()
        set({ tasks })
        if (!taskId && tasks.length > 0) {
          set({ activeTaskId: tasks[0].task_id })
        }
      }
    } finally {
      set({ experimentsLoading: false })
    }
  },

  setActiveTask: (taskId) => {
    set({ activeTaskId: taskId, svgContent: null })
    if (taskId) setTimeout(() => get().fetchSvgOrRender(), 0)
  },

  setActiveExperiment: async (experimentId) => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    set({ activeExperimentId: experimentId, activeTaskId: null, tasks: [] })
    const r = await fetch(`${API}/api/projects/${activeProjectId}/experiments/${experimentId}/tasks`)
    const { tasks } = await r.json()
    set({ tasks })
  },

  createExperiment: async (name, copyFrom = null, description = '') => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    const body = { name, description }
    if (copyFrom) body.copy_from = copyFrom
    const r = await fetch(`${API}/api/projects/${activeProjectId}/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json()
    // Refresh experiments list
    const r2 = await fetch(`${API}/api/projects/${activeProjectId}/experiments`)
    const { experiments } = await r2.json()
    set({ experiments, activeExperimentId: data.experiment_id, tasks: [], activeTaskId: null })
    return data
  },

  createTask: async (name, copyFrom = null) => {
    const { activeProjectId, activeExperimentId } = get()
    if (!activeProjectId || !activeExperimentId) return
    const body = { name }
    if (copyFrom) body.copy_from = copyFrom
    const r = await fetch(
      `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await r.json()
    const r2 = await fetch(
      `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks`
    )
    const { tasks } = await r2.json()
    set({ tasks, activeTaskId: data.task_id })
    return data
  },

  // ── SVG preview ───────────────────────────────────────────
  svgContent: null,
  svgLoading: false,

  fetchSvg: async () => {
    const { activeProjectId, activeExperimentId, activeTaskId } = get()
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    set({ svgLoading: true })
    try {
      const r = await fetch(
        `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/chart/svg`
      )
      if (r.ok) {
        const { svg_content } = await r.json()
        set({ svgContent: svg_content })
      } else {
        set({ svgContent: null })
      }
    } catch {
      set({ svgContent: null })
    } finally {
      set({ svgLoading: false })
    }
  },

  // ── Git history ───────────────────────────────────────────
  gitLog: [],

  fetchGitLog: async () => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    const r = await fetch(`${API}/api/projects/${activeProjectId}/git/log`)
    if (r.ok) {
      const { commits } = await r.json()
      set({ gitLog: commits })
    }
  },

  updateSvgContent: (svg) => set({ svgContent: svg }),

  // Called whenever a task is opened. Re-runs plot.py if output.svg is missing
  // or older than plot.py, then loads the SVG into the preview.
  fetchSvgOrRender: async () => {
    const { activeProjectId, activeExperimentId, activeTaskId } = get()
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return
    set({ svgLoading: true })
    try {
      const r = await fetch(
        `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/chart/auto-render`,
        { method: 'POST' },
      )
      if (r.ok) {
        const data = await r.json()
        if (data.ok && data.svg_content) {
          set({ svgContent: data.svg_content })
          return
        }
      }
      // Fallback: try to load whatever SVG exists on disk
      const r2 = await fetch(
        `${API}/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}/chart/svg`
      )
      if (r2.ok) {
        const { svg_content } = await r2.json()
        set({ svgContent: svg_content || null })
      }
    } catch {
      // Network error — leave preview empty
    } finally {
      set({ svgLoading: false })
    }
  },

  // ── Git status badge ──────────────────────────────────────
  gitStatus: 'saved',   // 'pending' | 'saving' | 'saved'
  setGitStatus: (s) => set({ gitStatus: s }),

  // ── Per-task chat sessions ────────────────────────────────
  chatSessions: {},   // { [taskId]: Message[] }
  setChatSession: (taskId, messages) =>
    set(state => ({ chatSessions: { ...state.chatSessions, [taskId]: messages } })),

  // ── Chat composer draft ───────────────────────────────────────
  chatDraftText: '',
  chatDraftContext: [],  // [{id, type, source, content}]

  setChatDraftText: (text) => set({ chatDraftText: text }),

  appendChatDraft: (text) => {
    // Detect structured context blocks by XML tag
    const m = text.match(/^<(table_selection|code_selection|version_reference)(?:\s+source="([^"]*)")?/)
    if (m) {
      const type = m[1]
      const source = m[2] || (type === 'version_reference' ? '版本记录' : '来源')
      const id = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      set(state => ({ chatDraftContext: [...state.chatDraftContext, { id, type, source, content: text.trim() }] }))
    } else {
      set(state => ({
        chatDraftText: state.chatDraftText
          ? `${state.chatDraftText.replace(/\s+$/, '')}\n\n${text}\n`
          : `${text}\n`,
      }))
    }
  },

  removeChatContext: (id) => set(state => ({
    chatDraftContext: state.chatDraftContext.filter(c => c.id !== id),
  })),

  clearChatContext: () => set({ chatDraftContext: [] }),

  // ── Editor theme (client-side preference) ────────────────
  editorTheme: localStorage.getItem('editorTheme') || 'openplot-light',
  setEditorTheme: (theme) => {
    localStorage.setItem('editorTheme', theme)
    document.documentElement.setAttribute('data-theme', DARK_EDITOR_THEMES.has(theme) ? 'dark' : 'light')
    set({ editorTheme: theme })
  },

  // ── Agent turn signal (incremented after each agent turn) ──
  agentTurnCount: 0,
  incrementAgentTurn: () => set(state => ({ agentTurnCount: state.agentTurnCount + 1 })),

  // ── UI language ───────────────────────────────────────────
  lang: localStorage.getItem('lang') || 'zh',
  setLang: (lang) => {
    localStorage.setItem('lang', lang)
    set({ lang })
  },
}))
