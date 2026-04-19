import { useEffect, useState } from 'react'
import { X, Check, Loader, ExternalLink } from 'lucide-react'

const API = ''

const ANTHROPIC_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-5-20251001',
]

// ── Inline field ──────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div className="mb-4">
      <label style={{ fontSize: 12, fontWeight: 500, color: '#44403C', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: '#A8A29E', marginTop: 3 }}>{hint}</p>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', mono = false }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className="w-full rounded-md px-3 py-1.5 outline-none"
      style={{
        fontSize: 12.5,
        fontFamily: mono ? 'JetBrains Mono, monospace' : undefined,
        border: '1px solid #D6CFC2',
        background: '#FFFFFF',
        color: '#1C1917',
      }}
    />
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-md px-3 py-1.5 outline-none"
      style={{
        fontSize: 12.5,
        fontFamily: 'JetBrains Mono, monospace',
        border: '1px solid #D6CFC2',
        background: '#FFFFFF',
        color: '#1C1917',
      }}>
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  )
}

// ── Provider tabs ─────────────────────────────────────────────

function OllamaTab({ form, setForm }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const base = form.ollama_base_url.replace(/\/v1\/?$/, '')
      const r = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(4000) })
      if (r.ok) {
        const data = await r.json()
        const models = (data.models ?? []).map(m => m.name)
        setTestResult({ ok: true, models })
      } else {
        setTestResult({ ok: false, error: `HTTP ${r.status}` })
      }
    } catch (e) {
      setTestResult({ ok: false, error: e.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div>
      <Field label="Base URL" hint="Ollama OpenAI-compatible endpoint">
        <TextInput
          value={form.ollama_base_url}
          onChange={v => setForm(f => ({ ...f, ollama_base_url: v }))}
          placeholder="http://localhost:11434/v1"
          mono
        />
      </Field>

      <Field label="模型名称">
        <TextInput
          value={form.ollama_model}
          onChange={v => setForm(f => ({ ...f, ollama_model: v }))}
          placeholder="qwen3.6:35b"
          mono
        />
      </Field>

      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={testConnection}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs"
          style={{ border: '1px solid #D6CFC2', color: '#44403C', background: testing ? '#F5F1EA' : 'transparent' }}>
          {testing ? <Loader size={11} className="spin" /> : null}
          {testing ? '测试中…' : '测试连接'}
        </button>
        {testResult && (
          <span style={{ fontSize: 11.5, color: testResult.ok ? '#0F766E' : '#DC2626', fontFamily: 'JetBrains Mono, monospace' }}>
            {testResult.ok
              ? `✓ 已连接，${testResult.models.length} 个模型`
              : `✗ ${testResult.error}`}
          </span>
        )}
      </div>

      {testResult?.ok && testResult.models.length > 0 && (
        <div className="mt-3 rounded-md p-2.5"
          style={{ background: 'rgba(15,118,110,0.05)', border: '1px solid rgba(15,118,110,0.15)' }}>
          <div style={{ fontSize: 10.5, color: '#A8A29E', fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>
            已安装的模型
          </div>
          <div className="flex flex-wrap gap-1">
            {testResult.models.map(m => (
              <button key={m}
                onClick={() => setForm(f => ({ ...f, ollama_model: m }))}
                className="px-1.5 py-0.5 rounded text-xs font-mono transition"
                style={{
                  border: `1px solid ${form.ollama_model === m ? '#0F766E' : '#D6CFC2'}`,
                  background: form.ollama_model === m ? 'rgba(15,118,110,0.08)' : 'transparent',
                  color: form.ollama_model === m ? '#0F766E' : '#57534E',
                }}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AnthropicTab({ form, setForm, apiKeySet }) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div>
      <Field
        label="模型"
        hint="选择或输入模型 ID">
        <SelectInput
          value={ANTHROPIC_MODELS.includes(form.anthropic_model) ? form.anthropic_model : '__custom__'}
          onChange={v => v !== '__custom__' && setForm(f => ({ ...f, anthropic_model: v }))}
          options={[
            ...ANTHROPIC_MODELS.map(m => ({ value: m, label: m })),
            { value: '__custom__', label: '自定义…' },
          ]}
        />
        {!ANTHROPIC_MODELS.includes(form.anthropic_model) && (
          <TextInput
            value={form.anthropic_model}
            onChange={v => setForm(f => ({ ...f, anthropic_model: v }))}
            placeholder="claude-…"
            mono
          />
        )}
      </Field>

      <Field
        label="API Key"
        hint={apiKeySet ? '已配置（留空则保留现有 key）' : '尚未配置'}>
        <div className="flex gap-2">
          <TextInput
            type={showKey ? 'text' : 'password'}
            value={form.anthropic_api_key}
            onChange={v => setForm(f => ({ ...f, anthropic_api_key: v }))}
            placeholder={apiKeySet ? '●●●●●●●● (已设置)' : 'sk-ant-…'}
            mono
          />
          <button
            onClick={() => setShowKey(s => !s)}
            className="flex-shrink-0 px-2 rounded-md"
            style={{ border: '1px solid #D6CFC2', fontSize: 11, color: '#78716C' }}>
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>
      </Field>

      <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: 11, color: '#A8A29E' }}>
        <ExternalLink size={10} />
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"
          style={{ color: '#A8A29E', textDecoration: 'underline' }}>
          获取 API Key
        </a>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────

export function SettingsModal({ onClose }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [apiKeySet, setApiKeySet] = useState(false)
  const [activeTab, setActiveTab] = useState('ollama')

  const [form, setForm] = useState({
    max_tool_rounds: 8,
    default_provider: 'ollama',
    anthropic_model: 'claude-sonnet-4-6',
    anthropic_api_key: '',
    ollama_model: 'qwen3.6:35b',
    ollama_base_url: 'http://localhost:11434/v1',
  })

  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(d => {
        setForm({
          max_tool_rounds: d.max_tool_rounds ?? 8,
          default_provider: d.default_provider ?? 'ollama',
          anthropic_model: d.anthropic?.model ?? 'claude-sonnet-4-6',
          anthropic_api_key: '',  // never pre-fill key
          ollama_model: d.ollama?.model ?? 'qwen3.6:35b',
          ollama_base_url: d.ollama?.base_url ?? 'http://localhost:11434/v1',
        })
        setApiKeySet(d.anthropic?.api_key_set ?? false)
        setActiveTab(d.default_provider ?? 'ollama')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`${API}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const TABS = [
    { id: 'ollama', label: 'Ollama' },
    { id: 'anthropic', label: 'Anthropic' },
  ]

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(28,25,23,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-xl w-full overflow-hidden"
        style={{
          maxWidth: 460,
          margin: '0 24px',
          background: '#FAF6ED',
          border: '1px solid #E7E0D1',
          boxShadow: '0 20px 60px rgba(28,25,23,0.2)',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: '#E7E0D1' }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em', color: '#A8A29E' }}>
              CONFIG
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Fraunces, serif', fontStyle: 'italic', marginTop: 1 }}>
              模型设置
            </h3>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md"
            style={{ color: '#78716C', border: '1px solid #E7E0D1' }}>
            <X size={13} />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center pulse-soft" style={{ fontSize: 13, color: '#A8A29E' }}>
            加载中…
          </div>
        ) : (
          <div className="px-5 py-4">
            {/* Default provider */}
            <Field label="默认模型提供商">
              <div className="flex gap-2">
                {TABS.map(t => (
                  <button key={t.id}
                    onClick={() => setForm(f => ({ ...f, default_provider: t.id }))}
                    className="flex-1 py-1.5 rounded-md text-sm transition"
                    style={{
                      border: '1px solid',
                      borderColor: form.default_provider === t.id ? '#1C1917' : '#D6CFC2',
                      background: form.default_provider === t.id ? '#1C1917' : 'transparent',
                      color: form.default_provider === t.id ? '#F5F1EA' : '#57534E',
                      fontWeight: form.default_provider === t.id ? 500 : 400,
                      fontSize: 12.5,
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Provider-specific tabs */}
            <div className="flex border-b mb-4" style={{ borderColor: '#E7E0D1' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="px-3 py-2 transition"
                  style={{
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: activeTab === t.id ? '#1C1917' : '#A8A29E',
                    fontWeight: activeTab === t.id ? 500 : 400,
                    borderBottom: activeTab === t.id ? '2px solid #1C1917' : '2px solid transparent',
                    marginBottom: -1,
                    background: 'transparent',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'ollama' && <OllamaTab form={form} setForm={setForm} />}
            {activeTab === 'anthropic' && <AnthropicTab form={form} setForm={setForm} apiKeySet={apiKeySet} />}

            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E7E0D1' }}>
              <Field label="最大工具轮次" hint="Agent 每次响应最多可调用工具的轮数。若出现超出轮次错误请调大此值。">
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={4} max={40} step={1}
                    value={form.max_tool_rounds}
                    onChange={e => setForm(f => ({ ...f, max_tool_rounds: Number(e.target.value) }))}
                    className="flex-1"
                  />
                  <span style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', minWidth: 24, textAlign: 'right' }}>
                    {form.max_tool_rounds}
                  </span>
                </div>
              </Field>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: '#E7E0D1', background: 'rgba(255,255,255,0.4)' }}>
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-md"
            style={{ fontSize: 12.5, border: '1px solid #D6CFC2', color: '#57534E' }}>
            关闭
          </button>
          <button onClick={save} disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md font-medium"
            style={{
              fontSize: 12.5,
              background: saved ? '#0F766E' : saving ? '#E7E0D1' : '#1C1917',
              color: saving ? '#A8A29E' : '#F5F1EA',
            }}>
            {saving ? <Loader size={12} className="spin" /> : saved ? <Check size={12} /> : null}
            {saving ? '保存中…' : saved ? '已保存' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
