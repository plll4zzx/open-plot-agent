import { useEffect, useState } from 'react'
import { X, Check, Loader, ExternalLink } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { EDITOR_THEMES } from './CodeEditor'

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
      <label style={{ fontSize: 12, fontWeight: 500, color: '#1F3547', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 11, color: '#7A99AE', marginTop: 3 }}>{hint}</p>}
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
        border: '1px solid #BDCFDF',
        background: '#FFFFFF',
        color: '#1A2B3C',
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
        border: '1px solid #BDCFDF',
        background: '#FFFFFF',
        color: '#1A2B3C',
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
  const t = useT()

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

      <Field label={t('ollamaModelName')}>
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
          style={{ border: '1px solid #BDCFDF', color: '#1F3547', background: testing ? '#EBF4FA' : 'transparent' }}>
          {testing ? <Loader size={11} className="spin" /> : null}
          {testing ? t('testing') : t('testConnection')}
        </button>
        {testResult && (
          <span style={{ fontSize: 11.5, color: testResult.ok ? '#1A7DC4' : '#DC2626', fontFamily: 'JetBrains Mono, monospace' }}>
            {testResult.ok
              ? t('connectedModels', { n: testResult.models.length })
              : `✗ ${testResult.error}`}
          </span>
        )}
      </div>

      {testResult?.ok && testResult.models.length > 0 && (
        <div className="mt-3 rounded-md p-2.5"
          style={{ background: 'rgba(26,125,196,0.05)', border: '1px solid rgba(26,125,196,0.15)' }}>
          <div style={{ fontSize: 10.5, color: '#7A99AE', fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>
            {t('installedModels')}
          </div>
          <div className="flex flex-wrap gap-1">
            {testResult.models.map(m => (
              <button key={m}
                onClick={() => setForm(f => ({ ...f, ollama_model: m }))}
                className="px-1.5 py-0.5 rounded text-xs font-mono transition"
                style={{
                  border: `1px solid ${form.ollama_model === m ? '#1A7DC4' : '#BDCFDF'}`,
                  background: form.ollama_model === m ? 'rgba(26,125,196,0.08)' : 'transparent',
                  color: form.ollama_model === m ? '#1A7DC4' : '#2E4A5E',
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

function LiteLLMTab({ form, setForm, apiKeySet }) {
  const [showKey, setShowKey] = useState(false)
  const t = useT()
  return (
    <div>
      <Field
        label={t('litellmModelString')}
        hint={t('litellmHint')}>
        <TextInput
          value={form.litellm_model}
          onChange={v => setForm(f => ({ ...f, litellm_model: v }))}
          placeholder="openai/gpt-4o"
          mono
        />
      </Field>
      <Field
        label="API Key"
        hint={apiKeySet ? t('apiKeyConfigured') : t('apiKeyHint')}>
        <div className="flex gap-2">
          <TextInput
            type={showKey ? 'text' : 'password'}
            value={form.litellm_api_key}
            onChange={v => setForm(f => ({ ...f, litellm_api_key: v }))}
            placeholder={apiKeySet ? '●●●●●●●● (已设置)' : 'sk-…'}
            mono
          />
          <button
            onClick={() => setShowKey(s => !s)}
            className="flex-shrink-0 px-2 rounded-md"
            style={{ border: '1px solid #BDCFDF', fontSize: 11, color: '#4A6478' }}>
            {showKey ? t('hideKey') : t('showKey')}
          </button>
        </div>
      </Field>
      <div className="rounded-md px-3 py-2.5 mt-1"
        style={{ background: 'rgba(26,125,196,0.05)', border: '1px solid rgba(26,125,196,0.15)', fontSize: 11, color: '#1F3547', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>{t('supportedProviders')}</div>
        {[
          ['openai/gpt-4o', 'OPENAI_API_KEY'],
          ['gemini/gemini-2.0-flash', 'GEMINI_API_KEY'],
          ['groq/llama-3.3-70b-versatile', 'GROQ_API_KEY'],
          ['anthropic/claude-opus-4-7', 'ANTHROPIC_API_KEY'],
        ].map(([m, env]) => (
          <div key={m} className="flex items-center gap-2">
            <button onClick={() => setForm(f => ({ ...f, litellm_model: m }))}
              style={{ fontFamily: 'JetBrains Mono, monospace', color: form.litellm_model === m ? '#1A7DC4' : '#1A2B3C', cursor: 'pointer', textDecoration: form.litellm_model === m ? 'none' : 'underline dotted' }}>
              {m}
            </button>
            <span style={{ color: '#7A99AE' }}>→ {env}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnthropicTab({ form, setForm, apiKeySet }) {
  const [showKey, setShowKey] = useState(false)
  const t = useT()

  return (
    <div>
      <Field
        label={t('anthropicModel')}
        hint={t('anthropicModelHint')}>
        <SelectInput
          value={ANTHROPIC_MODELS.includes(form.anthropic_model) ? form.anthropic_model : '__custom__'}
          onChange={v => v !== '__custom__' && setForm(f => ({ ...f, anthropic_model: v }))}
          options={[
            ...ANTHROPIC_MODELS.map(m => ({ value: m, label: m })),
            { value: '__custom__', label: t('anthropicCustom') },
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
        hint={apiKeySet ? t('apiKeyConfigured') : t('apiKeyNotConfigured')}>
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
            style={{ border: '1px solid #BDCFDF', fontSize: 11, color: '#4A6478' }}>
            {showKey ? t('hideKey') : t('showKey')}
          </button>
        </div>
      </Field>

      <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: 11, color: '#7A99AE' }}>
        <ExternalLink size={10} />
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer"
          style={{ color: '#7A99AE', textDecoration: 'underline' }}>
          {t('getApiKey')}
        </a>
      </div>
    </div>
  )
}

// ── Editor theme picker ───────────────────────────────────────

function ThemePicker() {
  const { editorTheme, setEditorTheme } = useStore()
  const t = useT()

  return (
    <Field label={t('settingsEditorTheme')}>
      <div className="grid grid-cols-4 gap-1.5">
        {EDITOR_THEMES.map(th => {
          const active = editorTheme === th.id
          return (
            <button
              key={th.id}
              onClick={() => setEditorTheme(th.id)}
              title={th.label}
              style={{
                padding: '6px 4px',
                borderRadius: 6,
                border: active ? '2px solid #1A7DC4' : '1px solid #CFE0ED',
                background: active ? 'rgba(26,125,196,0.06)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div style={{
                width: 40, height: 26, borderRadius: 3,
                background: th.bg,
                border: '1px solid rgba(0,0,0,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                flexShrink: 0,
              }}>
                {th.swatchColors.map((c, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: `#${c}` }} />
                ))}
              </div>
              <span style={{ fontSize: 9.5, fontFamily: 'JetBrains Mono, monospace', color: active ? '#1A7DC4' : '#4A6478', lineHeight: 1.2, textAlign: 'center' }}>
                {th.label}
              </span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}

// ── Language picker ───────────────────────────────────────────

function LanguagePicker() {
  const { lang, setLang } = useStore()
  const t = useT()
  return (
    <Field label={t('language')}>
      <div className="flex gap-2">
        {[['zh', '中文'], ['en', 'English']].map(([l, label]) => (
          <button key={l} onClick={() => setLang(l)}
            className="flex-1 py-1.5 rounded-md text-sm transition"
            style={{
              border: '1px solid',
              borderColor: lang === l ? '#1A2B3C' : '#BDCFDF',
              background: lang === l ? '#1A2B3C' : 'transparent',
              color: lang === l ? '#EBF4FA' : '#2E4A5E',
              fontWeight: lang === l ? 500 : 400,
              fontSize: 12.5,
            }}>
            {label}
          </button>
        ))}
      </div>
    </Field>
  )
}

// ── Main modal ────────────────────────────────────────────────

export function SettingsModal({ onClose }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [apiKeySet, setApiKeySet] = useState(false)
  const [activeTab, setActiveTab] = useState('ollama')
  const t = useT()

  const [form, setForm] = useState({
    max_tool_rounds: 8,
    default_provider: 'ollama',
    anthropic_model: 'claude-sonnet-4-6',
    anthropic_api_key: '',
    ollama_model: 'qwen3.6:35b',
    ollama_base_url: 'http://localhost:11434/v1',
    litellm_model: 'openai/gpt-4o',
    litellm_api_key: '',
  })
  const [litelmKeySet, setLitelmKeySet] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(d => {
        setForm({
          max_tool_rounds: d.max_tool_rounds ?? 8,
          default_provider: d.default_provider ?? 'ollama',
          anthropic_model: d.anthropic?.model ?? 'claude-sonnet-4-6',
          anthropic_api_key: '',
          ollama_model: d.ollama?.model ?? 'qwen3.6:35b',
          ollama_base_url: d.ollama?.base_url ?? 'http://localhost:11434/v1',
          litellm_model: d.litellm?.model ?? 'openai/gpt-4o',
          litellm_api_key: '',
        })
        setApiKeySet(d.anthropic?.api_key_set ?? false)
        setLitelmKeySet(d.litellm?.api_key_set ?? false)
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
    { id: 'litellm', label: 'LiteLLM' },
  ]

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(26,43,60,0.45)', backdropFilter: 'blur(6px)' }}>
      <div className="rounded-xl w-full overflow-hidden"
        style={{
          maxWidth: 460,
          margin: '0 24px',
          background: '#F0F7FC',
          border: '1px solid #CFE0ED',
          boxShadow: '0 20px 60px rgba(26,43,60,0.2)',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: '#CFE0ED' }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em', color: '#7A99AE' }}>
              CONFIG
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Fraunces, serif', fontStyle: 'italic', marginTop: 1 }}>
              {t('settingsTitle')}
            </h3>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md"
            style={{ color: '#4A6478', border: '1px solid #CFE0ED' }}>
            <X size={13} />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center pulse-soft" style={{ fontSize: 13, color: '#7A99AE' }}>
            {t('loading')}
          </div>
        ) : (
          <div className="px-5 py-4">
            {/* Default provider */}
            <Field label={t('settingsDefaultProvider')}>
              <div className="flex gap-2">
                {TABS.map(tab => (
                  <button key={tab.id}
                    onClick={() => setForm(f => ({ ...f, default_provider: tab.id }))}
                    className="flex-1 py-1.5 rounded-md text-sm transition"
                    style={{
                      border: '1px solid',
                      borderColor: form.default_provider === tab.id ? '#1A2B3C' : '#BDCFDF',
                      background: form.default_provider === tab.id ? '#1A2B3C' : 'transparent',
                      color: form.default_provider === tab.id ? '#EBF4FA' : '#2E4A5E',
                      fontWeight: form.default_provider === tab.id ? 500 : 400,
                      fontSize: 12.5,
                    }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Provider-specific tabs */}
            <div className="flex border-b mb-4" style={{ borderColor: '#CFE0ED' }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="px-3 py-2 transition"
                  style={{
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: activeTab === tab.id ? '#1A2B3C' : '#7A99AE',
                    fontWeight: activeTab === tab.id ? 500 : 400,
                    borderBottom: activeTab === tab.id ? '2px solid #1A2B3C' : '2px solid transparent',
                    marginBottom: -1,
                    background: 'transparent',
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'ollama' && <OllamaTab form={form} setForm={setForm} />}
            {activeTab === 'anthropic' && <AnthropicTab form={form} setForm={setForm} apiKeySet={apiKeySet} />}
            {activeTab === 'litellm' && <LiteLLMTab form={form} setForm={setForm} apiKeySet={litelmKeySet} />}

            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#CFE0ED' }}>
              <Field label={t('settingsMaxRounds')} hint={t('settingsMaxRoundsHint')}>
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

            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#CFE0ED' }}>
              <ThemePicker />
            </div>

            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#CFE0ED' }}>
              <LanguagePicker />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: '#CFE0ED', background: 'rgba(255,255,255,0.4)' }}>
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-md"
            style={{ fontSize: 12.5, border: '1px solid #BDCFDF', color: '#2E4A5E' }}>
            {t('close')}
          </button>
          <button onClick={save} disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md font-medium"
            style={{
              fontSize: 12.5,
              background: saved ? '#1A7DC4' : saving ? '#CFE0ED' : '#1A2B3C',
              color: saving ? '#7A99AE' : '#EBF4FA',
            }}>
            {saving ? <Loader size={12} className="spin" /> : saved ? <Check size={12} /> : null}
            {saving ? t('saving') : saved ? t('saved') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
