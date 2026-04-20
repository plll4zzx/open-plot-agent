import { useEffect, useRef, useState } from 'react'
import { Send, ChevronDown, ChevronRight, X, Table2, Code2, Clock } from 'lucide-react'
import { useStore } from '../store'

// ── Think-tag parser ──────────────────────────────────────────

function parseContent(text) {
  const parts = []
  let remaining = text
  while (remaining.length > 0) {
    const start = remaining.indexOf('<think>')
    if (start === -1) { parts.push({ type: 'text', content: remaining }); break }
    if (start > 0) parts.push({ type: 'text', content: remaining.slice(0, start) })
    remaining = remaining.slice(start + 7)
    const end = remaining.indexOf('</think>')
    if (end === -1) { parts.push({ type: 'thinking', content: remaining, complete: false }); break }
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
        <ChevronDown size={11} style={{ marginLeft: 'auto', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div className="px-3 py-2"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--c-text-3, #4A6478)', whiteSpace: 'pre-wrap', lineHeight: 1.55, maxHeight: 320, overflowY: 'auto', background: 'rgba(124,58,237,0.02)' }}>
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
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded"
        style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, monospace', color: '#7C3AED', background: 'rgba(124,58,237,0.06)' }}>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span>🔧 {msg.content}</span>
        {hasResult && <span className="ml-auto" style={{ color: ok ? '#1A7DC4' : '#DC2626' }}>{ok ? '✓' : '✗'}</span>}
        {!hasResult && <span className="ml-auto pulse-soft" style={{ color: 'var(--c-text-muted, #7A99AE)' }}>…</span>}
      </button>
      {open && (
        <div className="mt-1 ml-4 rounded p-2 text-left overflow-x-auto"
          style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(0,0,0,0.03)', color: 'var(--c-text-2, #2E4A5E)' }}>
          <div className="mb-1" style={{ color: 'var(--c-text-muted, #7A99AE)' }}>input</div>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(msg.meta?.input, null, 2)}</pre>
          {hasResult && (
            <>
              <div className="mt-2 mb-1" style={{ color: 'var(--c-text-muted, #7A99AE)' }}>output</div>
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(output?.svg_content ? { ...output, svg_content: '[svg …]' } : output, null, 2)}
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
          style={{ fontSize: 13, background: '#1A2B3C', color: '#EBF4FA', lineHeight: 1.5 }}>
          {msg.content}
        </div>
      </div>
    )
  }
  if (msg.role === 'tool_call') return <ToolCallRow msg={msg} />
  if (msg.role === 'thinking') return <ThinkingBlock content={msg.content} complete={msg.complete ?? false} />
  if (msg.role === 'agent') {
    const parts = parseContent(msg.content || '')
    return (
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <span style={{ fontSize: 9, color: '#7C3AED' }}>✨</span>
          </div>
          <span style={{ fontSize: 10.5, color: '#7C3AED', fontWeight: 500 }}>Agent</span>
        </div>
        {parts.map((part, i) =>
          part.type === 'thinking'
            ? <ThinkingBlock key={i} content={part.content} complete={part.complete} />
            : part.content
              ? <div key={i} style={{ fontSize: 13, color: 'var(--c-text, #1A2B3C)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{part.content}</div>
              : null
        )}
      </div>
    )
  }
  if (msg.role === 'context_notice') {
    return (
      <div className="mb-2 px-3 py-2 rounded-md"
        style={{ fontSize: 11, background: 'rgba(26,125,196,0.06)', color: '#1A7DC4', border: '1px solid rgba(26,125,196,0.15)', lineHeight: 1.5 }}>
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
  return <div className="mb-2" style={{ fontSize: 11, color: 'var(--c-text-muted, #7A99AE)', fontStyle: 'italic' }}>{msg.content}</div>
}

// ── Context type metadata ─────────────────────────────────────

const CTX_META = {
  table_selection: { icon: Table2, color: '#1A7DC4', bg: 'rgba(26,125,196,0.08)', border: 'rgba(26,125,196,0.2)' },
  code_selection:  { icon: Code2,  color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
  version_reference: { icon: Clock, color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.2)' },
}

// ── ContextChip ───────────────────────────────────────────────

function ContextChip({ ctx, onRemove }) {
  const meta = CTX_META[ctx.type] || CTX_META.table_selection
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md flex-shrink-0"
      style={{ background: meta.bg, border: `1px solid ${meta.border}`, maxWidth: 200 }}>
      <Icon size={11} style={{ color: meta.color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: meta.color, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {ctx.source}
      </span>
      <button onClick={() => onRemove(ctx.id)}
        className="flex-shrink-0 rounded p-0.5 transition hover:opacity-70"
        style={{ color: meta.color }}>
        <X size={10} />
      </button>
    </div>
  )
}

// ── Provider pill ─────────────────────────────────────────────

const PROVIDERS = [
  { id: 'ollama', label: 'Ollama' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'litellm', label: 'LiteLLM' },
]

function ProviderPill({ provider, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-md p-0.5"
      style={{ background: 'var(--c-border, #CFE0ED)' }}>
      {PROVIDERS.map(p => (
        <button key={p.id} onClick={() => onChange(p.id)}
          className="px-2 py-0.5 rounded transition"
          style={{
            fontSize: 10.5,
            fontFamily: 'JetBrains Mono, monospace',
            background: provider === p.id ? 'var(--c-card, #FFFFFF)' : 'transparent',
            color: provider === p.id ? 'var(--c-text, #1A2B3C)' : 'var(--c-text-3, #4A6478)',
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
  const { chatDraftText, chatDraftContext, setChatDraftText, removeChatContext, clearChatContext } = useStore()
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 240) + 'px'
  }, [chatDraftText])

  const submit = () => {
    if (!chatDraftText.trim() && chatDraftContext.length === 0) return
    const contextParts = chatDraftContext.map(c => c.content).join('\n\n')
    const fullText = contextParts
      ? `${contextParts}\n\n${chatDraftText}`.trim()
      : chatDraftText.trim()
    send(fullText)
    setChatDraftText('')
    clearChatContext()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
        {generating && !messages.some(m => m.role === 'thinking' && !m.complete) && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
              <span className="spin inline-block" style={{ fontSize: 9, color: '#7C3AED' }}>◌</span>
            </div>
            <span className="pulse-soft" style={{ fontSize: 11, color: '#7C3AED' }}>思考中…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose area */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--c-border, #CFE0ED)' }}>
        <div className="rounded-lg border overflow-hidden"
          style={{ background: 'var(--c-card, #FFFFFF)', borderColor: 'var(--c-border, #CFE0ED)' }}>

          {/* Context chips */}
          {chatDraftContext.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-2.5 pt-2">
              {chatDraftContext.map(ctx => (
                <ContextChip key={ctx.id} ctx={ctx} onRemove={removeChatContext} />
              ))}
            </div>
          )}

          <div className="p-2.5">
            <textarea
              ref={textareaRef}
              value={chatDraftText}
              onChange={e => setChatDraftText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
              placeholder="描述你想做什么图…"
              rows={2}
              className="w-full outline-none bg-transparent"
              style={{ fontSize: 13, color: 'var(--c-text, #1A2B3C)', lineHeight: 1.5, resize: 'none', minHeight: 44 }}
            />
            <div className="flex items-center justify-between mt-1.5">
              <ProviderPill provider={provider} onChange={onProviderChange} />
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 10, color: 'var(--c-text-faint, #9DB5C7)', fontFamily: 'JetBrains Mono, monospace' }}>⌘↵ 发送</span>
                <button
                  onClick={submit}
                  disabled={generating || (!chatDraftText.trim() && chatDraftContext.length === 0)}
                  className="w-7 h-7 rounded-md flex items-center justify-center transition"
                  style={{
                    background: (generating || (!chatDraftText.trim() && chatDraftContext.length === 0)) ? 'var(--c-border, #CFE0ED)' : '#1A2B3C',
                    color: (generating || (!chatDraftText.trim() && chatDraftContext.length === 0)) ? 'var(--c-text-muted, #7A99AE)' : '#EBF4FA',
                  }}>
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
