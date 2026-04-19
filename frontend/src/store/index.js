import { create } from 'zustand'

const API = ''  // proxied via vite

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

  setActiveTask: (taskId) => set({ activeTaskId: taskId }),

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

  // ── Git status badge ──────────────────────────────────────
  gitStatus: 'saved',   // 'pending' | 'saving' | 'saved'
  setGitStatus: (s) => set({ gitStatus: s }),

  // ── Per-task chat sessions ────────────────────────────────
  chatSessions: {},   // { [taskId]: Message[] }
  setChatSession: (taskId, messages) =>
    set(state => ({ chatSessions: { ...state.chatSessions, [taskId]: messages } })),
}))
