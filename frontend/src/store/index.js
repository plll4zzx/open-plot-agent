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

  // ── Active project / task ─────────────────────────────────
  activeProjectId: null,
  activeTaskId: null,
  tasks: [],

  setActive: async (projectId, taskId = null) => {
    set({ activeProjectId: projectId, activeTaskId: taskId, tasks: [] })
    if (projectId) {
      const r = await fetch(`${API}/api/projects/${projectId}/tasks`)
      const { tasks } = await r.json()
      set({ tasks })
      if (!taskId && tasks.length > 0) {
        set({ activeTaskId: tasks[0].task_id })
      }
    }
  },

  createTask: async (name) => {
    const { activeProjectId } = get()
    if (!activeProjectId) return
    const r = await fetch(`${API}/api/projects/${activeProjectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await r.json()
    const r2 = await fetch(`${API}/api/projects/${activeProjectId}/tasks`)
    const { tasks } = await r2.json()
    set({ tasks, activeTaskId: data.task_id })
    return data
  },

  // ── SVG preview ───────────────────────────────────────────
  svgContent: null,
  svgLoading: false,

  fetchSvg: async () => {
    const { activeProjectId, activeTaskId } = get()
    if (!activeProjectId || !activeTaskId) return
    set({ svgLoading: true })
    try {
      const r = await fetch(`${API}/api/projects/${activeProjectId}/tasks/${activeTaskId}/render`)
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

  // ── Git status badge ──────────────────────────────────────
  gitStatus: 'saved',   // 'pending' | 'saving' | 'saved'
  setGitStatus: (s) => set({ gitStatus: s }),
}))
