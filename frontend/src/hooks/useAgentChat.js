import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

export function useAgentChat(provider = 'ollama') {
  const { activeProjectId, activeExperimentId, activeTaskId, fetchSvg, fetchGitLog, setGitStatus } = useStore()
  const wsRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [generating, setGenerating] = useState(false)
  const [wsKey, setWsKey] = useState(0)
  const msgId = useRef(0)

  const nextId = () => String(++msgId.current)

  // Keep a ref that always tracks the latest messages (avoids stale closures in cleanup)
  const messagesRef = useRef([])
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Stop: send a cancel signal over the existing WS so the backend can abort the current turn.
  // Fallback: if WS is not open, force a reconnect (old behavior).
  const stop = useCallback(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'stop' }))
      } catch {
        setWsKey(k => k + 1)
      }
    } else {
      setWsKey(k => k + 1)
    }
    // Generating flag will be cleared by the 'stopped' / 'done' event; clear it
    // optimistically here so the UI reacts immediately.
    setGenerating(false)
  }, [])

  // ── Persist chat history to backend ──────────────────────────────────────
  const saveHistory = useCallback(async (msgs, projectId, experimentId, taskId) => {
    if (!projectId || !experimentId || !taskId) return
    try {
      await fetch(
        `/api/projects/${projectId}/experiments/${experimentId}/tasks/${taskId}/chat-history`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgs }),
        },
      )
    } catch { /* best-effort */ }
  }, [])

  // ── Connect / reconnect when project+experiment+task+provider change ──────
  useEffect(() => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return

    const taskId = activeTaskId  // capture for cleanup closure
    const projectId = activeProjectId
    const experimentId = activeExperimentId

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/ws/${projectId}/${experimentId}/${taskId}?provider=${provider}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = async () => {
      // Load persisted history from backend, fall back to in-memory session cache
      let history = []
      try {
        const r = await fetch(
          `/api/projects/${projectId}/experiments/${experimentId}/tasks/${taskId}/chat-history`
        )
        if (r.ok) {
          const data = await r.json()
          if (data.ok && data.messages?.length) history = data.messages
        }
      } catch { /* ignore */ }

      // Fall back to in-memory session if backend returned nothing
      if (!history.length) {
        history = useStore.getState().chatSessions[taskId] || []
      }

      const systemMsg = {
        id: nextId(), role: 'system',
        content: `已连接 · ${projectId} / ${experimentId} / ${taskId} · ${provider}`,
      }
      setMessages([...history, systemMsg])
    }

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data)

      switch (event.type) {
        case 'context_notice':
          // Agent loop injected context (external file changes, pending GUI edits)
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'context_notice',
            content: event.content,
          }])
          break

        case 'think_delta':
          setMessages(prev => {
            const last = prev[prev.length - 1]
            if (last?.role === 'thinking') {
              return [...prev.slice(0, -1), { ...last, content: last.content + event.content }]
            }
            return [...prev, { id: nextId(), role: 'thinking', content: event.content, complete: false }]
          })
          break

        case 'text_delta':
          setMessages(prev => {
            // Mark any in-flight thinking block as complete once text starts flowing
            const marked = prev.map(m =>
              m.role === 'thinking' && !m.complete ? { ...m, complete: true } : m
            )
            const last = marked[marked.length - 1]
            if (last?.role === 'agent') {
              return [...marked.slice(0, -1), { ...last, content: last.content + event.content }]
            }
            return [...marked, { id: nextId(), role: 'agent', content: event.content }]
          })
          break

        case 'tool_call':
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'tool_call',
            content: event.name,
            meta: { call_id: event.call_id, input: event.input },
          }])
          break

        case 'tool_result':
          setMessages(prev =>
            prev.map(m =>
              m.role === 'tool_call' && m.meta?.call_id === event.call_id
                ? { ...m, meta: { ...m.meta, output: event.output, ok: event.ok } }
                : m
            )
          )
          if (event.name === 'execute_python' && event.ok) fetchSvg()
          break

        case 'done':
          setMessages(prev => {
            const next = prev.map(m => m.role === 'thinking' && !m.complete ? { ...m, complete: true } : m)
            saveHistory(next, projectId, experimentId, taskId)
            return next
          })
          setGenerating(false)
          fetchSvg()
          fetchGitLog()
          setGitStatus('saving')
          setTimeout(() => setGitStatus('saved'), 800)
          break

        case 'stopped':
          setMessages(prev => {
            const next = [...prev, { id: nextId(), role: 'system', content: '已停止生成' }]
            saveHistory(next, projectId, experimentId, taskId)
            return next
          })
          setGenerating(false)
          fetchSvg()
          fetchGitLog()
          break

        case 'error':
          setMessages(prev => [...prev, { id: nextId(), role: 'error', content: event.message }])
          setGenerating(false)
          break
      }
    }

    ws.onclose = () => setGenerating(false)
    ws.onerror = () => {
      setMessages(prev => [...prev, {
        id: nextId(), role: 'error',
        content: `WebSocket 连接失败 (${url})，请检查后端是否运行`,
      }])
      setGenerating(false)
    }

    return () => {
      ws.close()
      const msgs = messagesRef.current
      if (msgs.length > 0) {
        // Keep in-memory session cache for fast restore within the same page session
        useStore.getState().setChatSession(taskId, msgs)
        // Persist to backend so history survives page refresh
        saveHistory(msgs, projectId, experimentId, taskId)
      }
    }
  }, [activeProjectId, activeExperimentId, activeTaskId, provider, wsKey, saveHistory])

  const send = useCallback((text) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setMessages(prev => [...prev, { id: nextId(), role: 'user', content: text }])
    setGenerating(true)
    wsRef.current.send(JSON.stringify({ message: text }))
  }, [])

  return { messages, send, generating, stop }
}
