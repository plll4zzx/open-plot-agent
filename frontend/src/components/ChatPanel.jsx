import { useEffect, useRef, useState } from 'react'
import { Send, ChevronDown, ChevronRight } from 'lucide-react'

/** Renders one agent turn event from the WebSocket */
function ToolCallRow({ msg }) {
  const [open, setOpen] = useState(false)
  const ok = msg.meta?.ok
  const output = msg.meta?.output
  const hasResult = output !== undefined

  return (
    <div className="my-0.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded"
        style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: '#7C3AED', background: 'rgba(124,58,237,0.06)' }}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span>🔧 {msg.content}</span>
        {hasResult && (
          <span className="ml-auto" style={{ color: ok ? '#0F766E' : '#DC2626' }}>
            {ok ? '✓' : '✗'}
          </span>
        )}
        {!hasResult && (
          <span className="ml-auto pulse-soft" style={{ color: '#A8A29E' }}>…</span>
        )}
      </button>
      {open && (
        <div className="mt-1 ml-4 rounded p-2 text-left overflow-x-auto"
          style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(0,0,0,0.03)', color: '#57534E' }}>
          <div className="mb-1" style={{ color: '#A8A29E' }}>input</div>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(msg.meta?.input, null, 2)}</pre>
          {hasResult && (
            <>
              <div className="mt-2 mb-1" style={{ color: '#A8A29E' }}>output</div>
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(
                  // Truncate large svg_content for display
                  output?.svg_content ? { ...output, svg_content: '[svg …]' } : output,
                  null, 2
                )}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="px-3 py-2 rounded-xl max-w-xs"
          style={{ fontSize: 13, background: '#1C1917', color: '#F5F1EA', lineHeight: 1.5 }}>
          {msg.content}
        </div>
      </div>
    )
  }

  if (msg.role === 'tool_call') {
    return <ToolCallRow msg={msg} />
  }

  if (msg.role === 'agent') {
    return (
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-4 h-4 rounded flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.12)' }}>
            <span style={{ fontSize: 9, color: '#7C3AED' }}>✨</span>
          </div>
          <span style={{ fontSize: 10.5, color: '#7C3AED', fontWeight: 500 }}>Agent</span>
        </div>
        <div style={{ fontSize: 13, color: '#1C1917', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {msg.content}
        </div>
      </div>
    )
  }

  if (msg.role === 'error') {
    return (
      <div className="mb-2 px-3 py-2 rounded-md"
        style={{ fontSize: 12, background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
        {msg.content}
      </div>
    )
  }

  // system
  return (
    <div className="mb-2" style={{ fontSize: 11, color: '#A8A29E', fontStyle: 'italic' }}>
      {msg.content}
    </div>
  )
}

export function ChatPanel({ messages, send, generating }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = () => {
    if (!input.trim()) return
    send(input)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
        {generating && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-4 h-4 rounded flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.12)' }}>
              <span className="spin inline-block" style={{ fontSize: 9, color: '#7C3AED' }}>◌</span>
            </div>
            <span className="pulse-soft" style={{ fontSize: 11, color: '#7C3AED' }}>思考中…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t" style={{ borderColor: '#E7E0D1' }}>
        <div className="flex items-end gap-2 rounded-lg border p-2.5"
          style={{ background: '#FFFFFF', borderColor: '#E7E0D1' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
            placeholder="描述你想做什么图…"
            rows={2}
            className="flex-1 resize-none outline-none bg-transparent"
            style={{ fontSize: 13, color: '#1C1917', lineHeight: 1.5 }}
          />
          <button
            onClick={submit}
            disabled={generating || !input.trim()}
            className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition"
            style={{
              background: generating || !input.trim() ? '#E7E0D1' : '#1C1917',
              color: generating || !input.trim() ? '#A8A29E' : '#F5F1EA',
            }}
          >
            <Send size={13} />
          </button>
        </div>
        <div className="mt-1.5 text-right" style={{ fontSize: 10, color: '#C4BEB7', fontFamily: 'JetBrains Mono, monospace' }}>
          ⌘↵ 发送
        </div>
      </div>
    </div>
  )
}
