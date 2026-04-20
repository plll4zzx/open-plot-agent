import { useEffect, useRef, useState } from 'react'
import { Send, ChevronDown, ChevronRight } from 'lucide-react'
import { useStore } from '../store'

// ── Think-tag parser ──────────────────────────────────────────

function parseContent(text) {
  const parts = []
  let remaining = text
  while (remaining.length > 0) {
    const start = remaining.indexOf('<think>')
    if (start === -1) {
      parts.push({ type: 'text', content: remaining })
      break
    }
    if (start > 0) {
      parts.push({ type: 'text', content: remaining.slice(0, start) })
    }
    remaining = remaining.slice(start + 7)
    const end = remaining.indexOf('</think>')
    if (end === -1) {
      // Incomplete think block — still streaming
      parts.push({ type: 'thinking', content: remaining, complete: false })
      break
    }
    parts.push({ type: 'thinking', content: remaining.slice(0, end), complete: true })
    remaining = remaining.slice(end + 8)
  }
  return parts
}

// ── ThinkingBlock ─────────────────────────────────────────────

function ThinkingBlock({ content, complete }) {
  const [open, setOpen] = useState(false)
  const lineCount = content.split('\n').length

  return (
    <div className="my-2 rounded-md overflow-hidden"
      style={{ border: '1px solid rgba(124,58,237,0.2)', fontSize: 11.5 }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
        style={{ background: 'rgba(124,58,237,0.06)', color: '#7C3AED' }}>
        <span style={{ fontSize: 12 }}>💭</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          {complete ? `思考过程 (${lineCount} 行)` : '思考中…'}
        </span>
        {!complete && <span className="pulse-soft" style={{ fontSize: 8 }}>●</span>}
        <ChevronDown size={11} style={{
          marginLeft: 'auto',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.15s',
        }} />
      </button>
      {open && (
        <div className="px-3 py-2"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            color: '#78716C',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.55,
            maxHeight: 320,
            overflowY: 'auto',
            background: 'rgba(124,58,237,0.02)',
          }}>
          {content}
        </div>
      )}
    </div>
  )
}

// ── ToolCallRow ───────────────────────────────────────────────

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

// ── MessageBubble ─────────────────────────────────────────────

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

  if (msg.role === 'thinking') {
    return <ThinkingBlock content={msg.content} complete={msg.complete ?? false} />
  }

  if (msg.role === 'agent') {
    const parts = parseContent(msg.content || '')
    return (
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-4 h-4 rounded flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.12)' }}>
            <span style={{ fontSize: 9, color: '#7C3AED' }}>✨</span>
          </div>
          <span style={{ fontSize: 10.5, color: '#7C3AED', fontWeight: 500 }}>Agent</span>
        </div>
        {parts.map((part, i) =>
          part.type === 'thinking'
            ? <ThinkingBlock key={i} content={part.content} complete={part.complete} />
            : part.content
              ? <div key={i} style={{ fontSize: 13, color: '#1C1917', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {part.content}
                </div>
              : null
        )}
      </div>
    )
  }

  if (msg.role === 'context_notice') {
    return (
      <div className="mb-2 px-3 py-2 rounded-md"
        style={{ fontSize: 11, background: 'rgba(15,118,110,0.06)', color: '#0F766E', border: '1px solid rgba(15,118,110,0.15)', lineHeight: 1.5 }}>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>🔄 上下文同步</div>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 10.5 }}>{msg.content}</div>
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

// ── Provider pill ─────────────────────────────────────────────

const PROVIDERS = [
  { id: 'ollama', label: 'Ollama' },
  { id: 'anthropic', label: 'Anthropic' },
]

function ProviderPill({ provider, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-md p-0.5"
      style={{ background: '#F1ECE0' }}>
      {PROVIDERS.map(p => (
        <button key={p.id} onClick={() => onChange(p.id)}
          className="px-2 py-0.5 rounded transition"
          style={{
            fontSize: 10.5,
            fontFamily: 'JetBrains Mono, monospace',
            background: provider === p.id ? '#FFFFFF' : 'transparent',
            color: provider === p.id ? '#1C1917' : '#78716C',
            fontWeight: provider === p.id ? 500 : 400,
          }}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ── ChatPanel ─────────────────────────────────────────────────

export function ChatPanel({ messages, send, generating, provider, onProviderChange }) {
  const { chatDraft, setChatDraft } = useStore()
  const input = chatDraft
  const setInput = setChatDraft
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-grow textarea to fit staged content (e.g. a big code block pasted in)
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 400) + 'px'
  }, [input])

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
        {generating && !messages.some(m => m.role === 'thinking' && !m.complete) && (
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
        <div className="rounded-lg border p-2.5"
          style={{ background: '#FFFFFF', borderColor: '#E7E0D1' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
            placeholder="描述你想做什么图…"
            rows={2}
            className="w-full outline-none bg-transparent"
            style={{ fontSize: 13, color: '#1C1917', lineHeight: 1.5, resize: 'vertical', minHeight: 52 }}
          />
          <div className="flex items-center justify-between mt-1.5">
            <ProviderPill provider={provider} onChange={onProviderChange} />
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 10, color: '#C4BEB7', fontFamily: 'JetBrains Mono, monospace' }}>⌘↵ 发送</span>
              <button
                onClick={submit}
                disabled={generating || !input.trim()}
                className="w-7 h-7 rounded-md flex items-center justify-center transition"
                style={{
                  background: generating || !input.trim() ? '#E7E0D1' : '#1C1917',
                  color: generating || !input.trim() ? '#A8A29E' : '#F5F1EA',
                }}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
