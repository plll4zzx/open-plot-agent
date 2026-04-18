import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

/**
 * Manages a WebSocket connection to the backend agent loop.
 * Returns { messages, send, generating, contextPct }.
 *
 * Message shape:
 *   { id, role: 'user'|'agent'|'tool_call'|'tool_result', content, meta }
 */
export function useAgentChat() {
  const { activeProjectId, activeTaskId, fetchSvg, fetchGitLog, setGitStatus } = useStore()
  const wsRef = useRef(null)
  const [messages, setMessages] = useState([])
  const [generating, setGenerating] = useState(false)
  const msgId = useRef(0)

  const nextId = () => String(++msgId.current)

  // ── Connect / reconnect when project+task change ──────────
  useEffect(() => {
    if (!activeProjectId || !activeTaskId) return

    const ws = new WebSocket(`ws://localhost:8000/ws/${activeProjectId}/${activeTaskId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setMessages([{
        id: nextId(), role: 'system',
        content: `已连接 · ${activeProjectId} / ${activeTaskId}`,
      }])
    }

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data)

      switch (event.type) {
        case 'text_delta':
          // Append to the last agent message, or create one
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
          setMessages(prev => {
            // Attach result to matching tool_call
            return prev.map(m =>
              m.role === 'tool_call' && m.meta?.call_id === event.call_id
                ? { ...m, meta: { ...m.meta, output: event.output, ok: event.ok } }
                : m
            )
          })
          // If we just rendered a chart, refresh SVG
          if (event.name === 'execute_python' && event.ok) {
            fetchSvg()
          }
          break

        case 'done':
          setGenerating(false)
          fetchSvg()
          fetchGitLog()
          setGitStatus('saving')
          setTimeout(() => setGitStatus('saved'), 800)
          break

        case 'error':
          setMessages(prev => [...prev, {
            id: nextId(), role: 'error', content: event.message,
          }])
          setGenerating(false)
          break
      }
    }

    ws.onclose = () => setGenerating(false)
    ws.onerror = () => {
      setMessages(prev => [...prev, {
        id: nextId(), role: 'error', content: 'WebSocket 连接失败，请检查后端是否运行',
      }])
      setGenerating(false)
    }

    return () => ws.close()
  }, [activeProjectId, activeTaskId])

  const send = useCallback((text) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    setMessages(prev => [...prev, { id: nextId(), role: 'user', content: text }])
    setGenerating(true)
    wsRef.current.send(JSON.stringify({ message: text }))
  }, [])

  return { messages, send, generating }
}
