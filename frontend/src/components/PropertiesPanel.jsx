import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../store'
import { useT, PROP_KEY_MAP, GROUP_KEY_MAP } from '../i18n'

// ── Grouping metadata ──────────────────────────────────────────────────────

const GROUP_MAP = {
  figsize:       'layout',
  title:         'text',
  xlabel:        'text',
  ylabel:        'text',
  suptitle:      'text',
  title_size:    'typography',
  label_size:    'typography',
  tick_size:     'typography',
  font_size:     'typography',
  palette:       'color',
  bar_alpha:     'chart',
  bar_width:     'chart',
  line_width:    'chart',
  line_style:    'chart',
  marker_size:   'chart',
  scatter_alpha: 'chart',
  violin_alpha:  'chart',
  fill_alpha:    'chart',
  cap_size:      'chart',
  error_width:   'chart',
  heatmap_cmap:  'chart',
  grid:          'axes',
  grid_alpha:    'axes',
  xlim:          'axes',
  ylim:          'axes',
  xscale:        'axes',
  yscale:        'axes',
  legend_loc:    'legend',
  legend_size:   'legend',
  legend_alpha:  'legend',
}

const GROUP_ORDER = ['layout', 'text', 'typography', 'color', 'chart', 'axes', 'legend', 'other']


// ── Python value serialization ─────────────────────────────────────────────

function toPython(type, value) {
  switch (type) {
    case 'bool':         return value ? 'True' : 'False'
    case 'str':
    case 'enum':
    case 'color':        return JSON.stringify(String(value))
    case 'float':        return String(parseFloat(value))
    case 'int':          return String(parseInt(value, 10))
    case 'tuple2f':
      return `(${parseFloat(value[0])}, ${parseFloat(value[1])})`
    case 'tuple2f_opt':
      return value == null ? 'None' : `(${parseFloat(value[0])}, ${parseFloat(value[1])})`
    case 'list_color':   return JSON.stringify(value)
    default:             return JSON.stringify(value)
  }
}

// ── Shared toggle switch ───────────────────────────────────────────────────

function PropToggle({ enabled, onToggle }) {
  const t = useT()
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      title={enabled ? t('propToggleDisable') : t('propToggleEnable')}
      style={{
        width: 28, height: 16, borderRadius: 8, flexShrink: 0,
        background: enabled ? '#1A7DC4' : '#CFE0ED',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        position: 'absolute', width: 12, height: 12, borderRadius: '50%',
        background: '#FFFFFF', top: 2,
        left: enabled ? 14 : 2,
        transition: 'left 0.12s',
      }} />
    </button>
  )
}

// ── Shared row wrapper ─────────────────────────────────────────────────────

function PropRow({ propKey, saving, error, enabled = true, onToggle, showToggle = true, children }) {
  const t = useT()
  const labelKey = PROP_KEY_MAP[propKey]
  const label = labelKey ? t(labelKey) : propKey
  return (
    <div className="px-4 py-2.5 border-b"
      style={{ borderColor: 'rgba(207,224,237,0.5)', opacity: enabled ? 1 : 0.55 }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 11.5, color: enabled ? '#1F3547' : '#9DB5C7', fontWeight: 500 }}>
            {label}
          </span>
          <span style={{ fontSize: 9.5, color: '#9DB5C7', fontFamily: 'JetBrains Mono, monospace' }}>
            {propKey}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span style={{ fontSize: 9.5, color: '#7A99AE', fontFamily: 'JetBrains Mono, monospace' }}>
              {t('propSaving')}
            </span>
          )}
          {showToggle && (
            <PropToggle enabled={enabled} onToggle={onToggle ?? (() => {})} />
          )}
        </div>
      </div>
      {enabled && children}
      {error && (
        <div className="mt-1" style={{ fontSize: 10, color: '#DC2626' }}>{error}</div>
      )}
    </div>
  )
}

// ── Float / int control ────────────────────────────────────────────────────

function FloatProp({ propKey, prop, onSave }) {
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [local, setLocal] = useState(Number(prop.value))

  useEffect(() => { setLocal(Number(prop.value)) }, [prop.value])

  const [min, max] = prop.extra
    ? prop.extra.split(',').map(Number)
    : [null, null]

  const commit = useCallback(async (v) => {
    const n = prop.type === 'int' ? Math.round(v) : parseFloat(v)
    if (isNaN(n)) return
    setSaving(true); setError(null)
    const res = await onSave(propKey, toPython(prop.type, n))
    if (!res.ok) { setError(res.error?.slice(0, 80)); setLocal(Number(prop.value)) }
    setSaving(false)
  }, [propKey, prop, onSave])

  const step = max != null && min != null ? (max - min) / 200 : 0.1
  const decimals = step < 0.1 ? 2 : (step < 1 ? 1 : 0)

  return (
    <PropRow propKey={propKey} saving={saving} error={error}
      enabled={enabled} onToggle={() => setEnabled(e => !e)}>
      {min != null && max != null ? (
        <div className="flex items-center gap-2">
          <input
            type="range" min={min} max={max} step={step}
            value={local}
            onChange={e => setLocal(parseFloat(e.target.value))}
            onPointerUp={e => commit(parseFloat(e.target.value))}
            className="flex-1"
            style={{ accentColor: '#1A7DC4' }}
          />
          <span style={{
            fontSize: 11, minWidth: 32, textAlign: 'right',
            fontFamily: 'JetBrains Mono, monospace', color: '#1A2B3C',
          }}>
            {local.toFixed(decimals)}
          </span>
        </div>
      ) : (
        <input
          type="number"
          value={local}
          onChange={e => setLocal(parseFloat(e.target.value))}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value) }}
          className="w-full rounded px-2 py-1 outline-none"
          style={{ fontSize: 12, border: '1px solid #CFE0ED', fontFamily: 'JetBrains Mono, monospace' }}
        />
      )}
    </PropRow>
  )
}

// ── String control ─────────────────────────────────────────────────────────

function StringProp({ propKey, prop, onSave }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const initVal = String(prop.value ?? '')
  const [local, setLocal] = useState(initVal)
  const [enabled, setEnabled] = useState(initVal !== '')
  // Remember last non-empty value so toggling back on can restore it
  const lastNonEmpty = useRef(initVal || propKey)

  useEffect(() => {
    const v = String(prop.value ?? '')
    setLocal(v)
    setEnabled(v !== '')
    if (v) lastNonEmpty.current = v
  }, [prop.value])

  const commit = useCallback(async (v) => {
    setSaving(true); setError(null)
    const res = await onSave(propKey, toPython('str', v))
    if (!res.ok) { setError(res.error?.slice(0, 80)); setLocal(String(prop.value ?? '')) }
    setSaving(false)
  }, [propKey, prop.value, onSave])

  const handleToggle = useCallback(async () => {
    if (enabled) {
      if (local) lastNonEmpty.current = local
      setEnabled(false)
      setLocal('')
      await commit('')
    } else {
      const restore = lastNonEmpty.current
      setEnabled(true)
      setLocal(restore)
      await commit(restore)
    }
  }, [enabled, local, commit])

  return (
    <PropRow propKey={propKey} saving={saving} error={error}
      enabled={enabled} onToggle={handleToggle}>
      <input
        type="text"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={e => { if (e.target.value !== String(prop.value ?? '')) commit(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') commit(e.target.value) }}
        className="w-full rounded px-2 py-1 outline-none"
        style={{ fontSize: 12, border: '1px solid #CFE0ED' }}
      />
    </PropRow>
  )
}

// ── Bool toggle ────────────────────────────────────────────────────────────

function BoolProp({ propKey, prop, onSave }) {
  const t = useT()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [local, setLocal] = useState(Boolean(prop.value))

  useEffect(() => { setLocal(Boolean(prop.value)) }, [prop.value])

  const toggle = useCallback(async () => {
    const next = !local
    setLocal(next)
    setSaving(true); setError(null)
    const res = await onSave(propKey, toPython('bool', next))
    if (!res.ok) { setError(res.error?.slice(0, 80)); setLocal(local) }
    setSaving(false)
  }, [propKey, local, onSave])

  return (
    <PropRow propKey={propKey} saving={saving} error={error} showToggle={false}>
      <button onClick={toggle} className="flex items-center gap-2">
        <div
          className="rounded-full flex-shrink-0 transition-colors"
          style={{
            width: 34, height: 18,
            background: local ? '#1A7DC4' : '#CFE0ED',
            position: 'relative',
            transition: 'background 0.15s',
          }}
        >
          <div style={{
            position: 'absolute', width: 14, height: 14, borderRadius: '50%',
            top: 2, left: local ? 18 : 2,
            background: '#FFFFFF',
            transition: 'left 0.15s',
          }} />
        </div>
        <span style={{ fontSize: 12, color: local ? '#1A2B3C' : '#7A99AE' }}>
          {local ? t('on') : t('off')}
        </span>
      </button>
    </PropRow>
  )
}

// ── Enum dropdown ──────────────────────────────────────────────────────────

function EnumProp({ propKey, prop, onSave }) {
  const options = prop.extra ? prop.extra.split('|').map(s => s.trim()) : []
  const initVal = String(prop.value ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [local, setLocal] = useState(initVal)
  const [enabled, setEnabled] = useState(initVal !== '')
  const lastNonEmpty = useRef(initVal || options[0] || '')

  useEffect(() => {
    const v = String(prop.value ?? '')
    setLocal(v)
    setEnabled(v !== '')
    if (v) lastNonEmpty.current = v
  }, [prop.value])

  const commit = useCallback(async (v) => {
    setLocal(v)
    setSaving(true); setError(null)
    const res = await onSave(propKey, toPython('enum', v))
    if (!res.ok) { setError(res.error?.slice(0, 80)); setLocal(String(prop.value ?? '')) }
    setSaving(false)
  }, [propKey, prop.value, onSave])

  const handleToggle = useCallback(async () => {
    if (enabled) {
      if (local) lastNonEmpty.current = local
      setEnabled(false)
      setLocal('')
      await commit('')
    } else {
      const restore = lastNonEmpty.current || options[0] || ''
      setEnabled(true)
      setLocal(restore)
      await commit(restore)
    }
  }, [enabled, local, commit, options])

  return (
    <PropRow propKey={propKey} saving={saving} error={error}
      enabled={enabled} onToggle={handleToggle}>
      <select
        value={local}
        onChange={e => commit(e.target.value)}
        className="w-full rounded px-2 py-1 outline-none"
        style={{ fontSize: 12, border: '1px solid #CFE0ED', background: '#FFFFFF' }}
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </PropRow>
  )
}

// ── Single color ────────────────────────────────────────────────────────────

function ColorProp({ propKey, prop, onSave }) {
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [local, setLocal] = useState(String(prop.value ?? '#000000'))
  const debounceRef = useRef(null)

  useEffect(() => { setLocal(String(prop.value ?? '#000000')) }, [prop.value])

  const commit = useCallback(async (v) => {
    setSaving(true); setError(null)
    const res = await onSave(propKey, toPython('color', v))
    if (!res.ok) { setError(res.error?.slice(0, 80)) }
    setSaving(false)
  }, [propKey, onSave])

  const handleChange = (v) => {
    setLocal(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => commit(v), 600)
  }

  return (
    <PropRow propKey={propKey} saving={saving} error={error}
      enabled={enabled} onToggle={() => setEnabled(e => !e)}>
      <div className="flex items-center gap-2">
        <input
          type="color" value={local}
          onChange={e => handleChange(e.target.value)}
          style={{ width: 32, height: 28, borderRadius: 4, border: '1px solid #CFE0ED', padding: 2, cursor: 'pointer' }}
        />
        <input
          type="text" value={local}
          onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setLocal(e.target.value) }}
          onBlur={e => { if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) commit(e.target.value) }}
          className="flex-1 rounded px-2 py-1 outline-none"
          style={{ fontSize: 12, border: '1px solid #CFE0ED', fontFamily: 'JetBrains Mono, monospace' }}
        />
      </div>
    </PropRow>
  )
}

// ── Tuple (W × H) ──────────────────────────────────────────────────────────

function Tuple2fProp({ propKey, prop, onSave }) {
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const init = Array.isArray(prop.value) ? prop.value : [6, 4]
  const [w, setW] = useState(init[0])
  const [h, setH] = useState(init[1])

  useEffect(() => {
    if (Array.isArray(prop.value)) { setW(prop.value[0]); setH(prop.value[1]) }
  }, [prop.value])

  const commit = useCallback(async (newW, newH) => {
    setSaving(true); setError(null)
    const res = await onSave(propKey, `(${parseFloat(newW)}, ${parseFloat(newH)})`)
    if (!res.ok) { setError(res.error?.slice(0, 80)) }
    setSaving(false)
  }, [propKey, onSave])

  return (
    <PropRow propKey={propKey} saving={saving} error={error}
      enabled={enabled} onToggle={() => setEnabled(e => !e)}>
      <div className="flex items-center gap-2">
        <input
          type="number" step="0.5" min="1" value={w}
          onChange={e => setW(e.target.value)}
          onBlur={() => commit(w, h)}
          onKeyDown={e => { if (e.key === 'Enter') commit(w, h) }}
          className="flex-1 rounded px-2 py-1 outline-none"
          style={{ fontSize: 12, border: '1px solid #CFE0ED', fontFamily: 'JetBrains Mono, monospace' }}
        />
        <span style={{ fontSize: 12, color: '#7A99AE' }}>×</span>
        <input
          type="number" step="0.5" min="1" value={h}
          onChange={e => setH(e.target.value)}
          onBlur={() => commit(w, h)}
          onKeyDown={e => { if (e.key === 'Enter') commit(w, h) }}
          className="flex-1 rounded px-2 py-1 outline-none"
          style={{ fontSize: 12, border: '1px solid #CFE0ED', fontFamily: 'JetBrains Mono, monospace' }}
        />
        <span style={{ fontSize: 10, color: '#9DB5C7' }}>in</span>
      </div>
    </PropRow>
  )
}

// ── Optional range (None | (lo, hi)) ──────────────────────────────────────

function Tuple2fOptProp({ propKey, prop, onSave }) {
  const t = useT()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [enabled, setEnabled] = useState(prop.value != null)
  const [lo, setLo] = useState(Array.isArray(prop.value) ? prop.value[0] : 0)
  const [hi, setHi] = useState(Array.isArray(prop.value) ? prop.value[1] : 1)

  useEffect(() => {
    setEnabled(prop.value != null)
    if (Array.isArray(prop.value)) { setLo(prop.value[0]); setHi(prop.value[1]) }
  }, [prop.value])

  const commit = useCallback(async (en, newLo, newHi) => {
    setSaving(true); setError(null)
    const pyVal = en ? `(${parseFloat(newLo)}, ${parseFloat(newHi)})` : 'None'
    const res = await onSave(propKey, pyVal)
    if (!res.ok) setError(res.error?.slice(0, 80))
    setSaving(false)
  }, [propKey, onSave])

  const toggleEnabled = () => {
    const next = !enabled
    setEnabled(next)
    commit(next, lo, hi)
  }

  return (
    <PropRow propKey={propKey} saving={saving} error={error}
      enabled={enabled} onToggle={toggleEnabled}>
      <div className="flex items-center gap-2">
        {enabled ? (
          <>
            <input
              type="number" value={lo}
              onChange={e => setLo(e.target.value)}
              onBlur={() => commit(true, lo, hi)}
              onKeyDown={e => { if (e.key === 'Enter') commit(true, lo, hi) }}
              className="flex-1 rounded px-1.5 py-1 outline-none"
              style={{ fontSize: 12, border: '1px solid #CFE0ED', fontFamily: 'JetBrains Mono, monospace' }}
            />
            <span style={{ fontSize: 10, color: '#9DB5C7' }}>—</span>
            <input
              type="number" value={hi}
              onChange={e => setHi(e.target.value)}
              onBlur={() => commit(true, lo, hi)}
              onKeyDown={e => { if (e.key === 'Enter') commit(true, lo, hi) }}
              className="flex-1 rounded px-1.5 py-1 outline-none"
              style={{ fontSize: 12, border: '1px solid #CFE0ED', fontFamily: 'JetBrains Mono, monospace' }}
            />
          </>
        ) : (
          <span style={{ fontSize: 11, color: '#9DB5C7' }}>{t('auto')}</span>
        )}
      </div>
    </PropRow>
  )
}

// ── Palette editor ─────────────────────────────────────────────────────────

function PaletteProp({ propKey, prop, onSave }) {
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [colors, setColors] = useState(Array.isArray(prop.value) ? prop.value : [])
  const debounceRef = useRef(null)

  useEffect(() => {
    if (Array.isArray(prop.value)) setColors(prop.value)
  }, [prop.value])

  const commitColors = useCallback(async (next) => {
    setSaving(true); setError(null)
    const res = await onSave(propKey, JSON.stringify(next))
    if (!res.ok) setError(res.error?.slice(0, 80))
    setSaving(false)
  }, [propKey, onSave])

  const handleColorChange = (idx, color) => {
    const next = [...colors]
    next[idx] = color
    setColors(next)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => commitColors(next), 700)
  }

  const removeColor = (idx) => {
    if (colors.length <= 1) return
    const next = colors.filter((_, i) => i !== idx)
    setColors(next)
    commitColors(next)
  }

  const addColor = () => {
    const next = [...colors, '#888888']
    setColors(next)
    commitColors(next)
  }

  return (
    <PropRow propKey={propKey} saving={saving} error={error}
      enabled={enabled} onToggle={() => setEnabled(e => !e)}>
      <div className="flex flex-wrap gap-1.5 mt-0.5">
        {colors.map((c, i) => (
          <div key={i} className="relative" style={{ width: 26 }}>
            <input
              type="color" value={c}
              onChange={e => handleColorChange(i, e.target.value)}
              title={`${i + 1}: ${c}`}
              style={{
                width: 26, height: 26, borderRadius: 4,
                border: '1.5px solid #CFE0ED',
                padding: 1, cursor: 'pointer', display: 'block',
              }}
            />
            {colors.length > 1 && (
              <button
                onClick={() => removeColor(i)}
                style={{
                  position: 'absolute', top: -5, right: -5,
                  width: 13, height: 13, borderRadius: '50%',
                  background: '#DC2626', color: '#FFF',
                  fontSize: 9, display: 'none',
                  alignItems: 'center', justifyContent: 'center',
                  border: 'none', cursor: 'pointer', lineHeight: 1,
                }}
                onMouseOver={e => e.currentTarget.style.display = 'flex'}
                className="swatch-del"
              >×</button>
            )}
          </div>
        ))}
        <button
          onClick={addColor}
          className="flex items-center justify-center rounded"
          style={{
            width: 26, height: 26,
            border: '1.5px dashed #BDCFDF',
            fontSize: 16, lineHeight: 1,
            color: '#7A99AE', cursor: 'pointer',
            background: 'transparent',
          }}
        >+</button>
      </div>
    </PropRow>
  )
}

// ── Dispatch to correct control ────────────────────────────────────────────

function PropControl({ propKey, prop, onSave }) {
  switch (prop.type) {
    case 'float':
    case 'int':          return <FloatProp    propKey={propKey} prop={prop} onSave={onSave} />
    case 'bool':         return <BoolProp     propKey={propKey} prop={prop} onSave={onSave} />
    case 'str':          return <StringProp   propKey={propKey} prop={prop} onSave={onSave} />
    case 'enum':         return <EnumProp     propKey={propKey} prop={prop} onSave={onSave} />
    case 'color':        return <ColorProp    propKey={propKey} prop={prop} onSave={onSave} />
    case 'tuple2f':      return <Tuple2fProp  propKey={propKey} prop={prop} onSave={onSave} />
    case 'tuple2f_opt':  return <Tuple2fOptProp propKey={propKey} prop={prop} onSave={onSave} />
    case 'list_color':   return <PaletteProp  propKey={propKey} prop={prop} onSave={onSave} />
    default:             return <StringProp   propKey={propKey} prop={prop} onSave={onSave} />
  }
}

// ── Group section ──────────────────────────────────────────────────────────

function GroupSection({ label, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2"
        style={{
          fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: '#4A6478',
          background: 'rgba(207,224,237,0.3)',
          borderBottom: '1px solid rgba(207,224,237,0.6)',
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 8, color: '#9DB5C7' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ children }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center"
      style={{ color: '#9DB5C7', fontSize: 12, gap: 8 }}>
      <div style={{ fontSize: 28 }}>⚙️</div>
      <div>{children}</div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const t = useT()
  const {
    activeProjectId, activeExperimentId, activeTaskId,
    svgContent, updateSvgContent, fetchGitLog,
  } = useStore()

  const [props, setProps] = useState({})
  const [loading, setLoading] = useState(false)
  const [hasConfig, setHasConfig] = useState(false)

  // When we update svgContent ourselves (via patchProp), we don't want the
  // useEffect below to trigger a full re-fetch that resets the panel.
  const skipNextSvgFetch = useRef(false)

  const baseUrl = activeProjectId && activeExperimentId && activeTaskId
    ? `/api/projects/${activeProjectId}/experiments/${activeExperimentId}/tasks/${activeTaskId}`
    : null

  // Re-fetch when task changes or the agent updates the chart from outside.
  // When WE update svgContent via patchProp, we skip the re-fetch and patch
  // local state directly instead.
  useEffect(() => {
    if (!baseUrl) { setProps({}); setHasConfig(false); return }
    if (skipNextSvgFetch.current) {
      skipNextSvgFetch.current = false
      return
    }
    setLoading(true)
    fetch(`${baseUrl}/config-props`)
      .then(r => r.json())
      .then(data => {
        setHasConfig(!!data.ok)
        setProps(data.ok ? data.props : {})
      })
      .catch(() => { setHasConfig(false); setProps({}) })
      .finally(() => setLoading(false))
  }, [activeTaskId, svgContent])

  const patchProp = useCallback(async (key, pythonValue) => {
    if (!baseUrl) return { ok: false, error: 'No active task' }
    try {
      const r = await fetch(`${baseUrl}/config-props`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: pythonValue }),
      })
      const data = await r.json()
      if (data.ok) {
        // Patch local props state for this key so the panel doesn't reset.
        if (data.prop) {
          skipNextSvgFetch.current = true
          setProps(prev => ({ ...prev, [key]: data.prop }))
        }
        if (data.svg_content) updateSvgContent(data.svg_content)
        fetchGitLog?.()
      }
      return data
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }, [baseUrl, updateSvgContent, fetchGitLog])

  // ── Empty states ──────────────────────────────────────────────────────────

  if (!activeTaskId) {
    return (
      <div className="flex flex-col h-full">
        <EmptyState>{t('selectTaskForProps')}</EmptyState>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <EmptyState>{t('loading')}</EmptyState>
      </div>
    )
  }

  if (!hasConfig || Object.keys(props).length === 0) {
    return (
      <div className="flex flex-col h-full">
        <EmptyState>
          {t('noChartYet')}<br />
          <span style={{ fontSize: 11, color: '#BDCFDF', marginTop: 4, display: 'block' }}>
            {t('noChartDesc')}
          </span>
        </EmptyState>
      </div>
    )
  }

  // ── Group props ───────────────────────────────────────────────────────────

  const groups = {}
  for (const [key, prop] of Object.entries(props)) {
    const g = GROUP_MAP[key] || 'other'
    if (!groups[g]) groups[g] = []
    groups[g].push([key, prop])
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {GROUP_ORDER.filter(g => groups[g]).map(g => (
        <GroupSection key={g} label={t(GROUP_KEY_MAP[g] || g)}>
          {groups[g].map(([key, prop]) => (
            <PropControl key={key} propKey={key} prop={prop} onSave={patchProp} />
          ))}
        </GroupSection>
      ))}
    </div>
  )
}
