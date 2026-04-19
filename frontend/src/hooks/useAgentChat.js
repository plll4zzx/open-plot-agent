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

  // Stop: close WS and force reconnect via wsKey
  const stop = useCallback(() => {
    setGenerating(false)
    setWsKey(k => k + 1)
  }, [])

  // ── Connect / reconnect when project+experiment+task+provider change ──────
  useEffect(() => {
    if (!activeProjectId || !activeExperimentId || !activeTaskId) return

    const taskId = activeTaskId  // capture for cleanup closure

    // Restore saved session for this task
    const saved = useStore.getState().chatSessions[taskId] || []

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/ws/${activeProjectId}/${activeExperimentId}/${taskId}?provider=${provider}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      const systemMsg = {
        id: nextId(), role: 'system',
        content: `已连接 · ${activeProjectId} / ${activeExperimentId} / ${taskId} · ${provider}`,
      }
      setMessages([...saved, systemMsg])
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

        case 'text_delta':
          setMessages(prev => {
            const last = prev[prev.length - 1]
            if (last?.role === 'agent') {
              return [...prev.slice(0, -1), { ...last, content: last.content + event.content }]
            }
            return [...prev, { id: nextId(), role: 'agent', content: event.content }]
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
          setGenerating(false)
          fetchSvg()
          fetchGitLog()
          setGitStatus('saving')
          setTimeout(() => setGitStatus('saved'), 800)
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
      // Save this task's messages before switching away
      if (messagesRef.current.length > 0) {
        useStore.getState().setChatSession(taskId, messagesRef.current)
      }
    }
  }, [activeProjectId, activeExperimentId, activeTaskId, provider, wsKey])

  const send = useCallback((text) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setMessages(prev => [...prev, { id: nextId(), role: 'user', content: text }])
    setGenerating(true)
    wsRef.current.send(JSON.stringify({ message: text }))
  }, [])

  return { messages, send, generating, stop }
}
