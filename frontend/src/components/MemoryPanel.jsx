import { useEffect, useState, useCallback } from 'react'
import { Save, RefreshCw, FileText, BookOpen } from 'lucide-react'
import { useStore } from '../store'

const API = ''

// ── Memory file editor ──────────────────────────────────────

function MemoryFile({ label, icon: Icon, filePath, projectId, experimentId, taskId }) {
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const basePath = taskId
    ? `/api/projects/${projectId}/experiments/${experimentId}/tasks/${taskId}/files`
    : `/api/projects/${projectId}/experiments/${experimentId}/tasks/_/files`

  const load = useCallback(async () => {
    if (!projectId || !experimentId) return
    setLoading(true)
    setError(null)
    try {
      // For experiment-level files, we need to read from the experiment dir
      let url
      if (filePath === 'EXPERIMENT.md') {
        // Read experiment-level file via a direct approach
        url = `/api/projects/${projectId}/experiments/${experimentId}/files/${filePath}`
      } else if (taskId) {
        url = `${API}/api/projects/${projectId}/experiments/${experimentId}/tasks/${taskId}/files/${filePath}`
      } else {
        return
      }
      const r = await fetch(url)
      if (r.ok) {
        const d = await r.json()
        setContent(d.content || '')
        setSavedContent(d.content || '')
      } else if (r.status === 404) {
        // File doesn't exist yet — show placeholder
        const placeholder = filePath === 'TASK.md'
          ? '# Task Memory\n\n记录这个图表任务的关键决策和偏好。\n\n## 用户偏好\n\n## 设计决策\n\n## Reviewer 意见\n'
          : '# Experiment Memory\n\n记录这组实验的背景信息和共享约定。\n\n## 实验背景\n\n## 数据说明\n\n## 共享样式\n'
        setContent(placeholder)
        setSavedContent('')
      }
    } catch (e) {
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }, [projectId, experimentId, taskId, filePath])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!projectId || !experimentId) return
    setSaving(true)
    try {
      let url
      if (filePath === 'EXPERIMENT.md') {
        url = `/api/projects/${projectId}/experiments/${experimentId}/files/${filePath}`
      } else if (taskId) {
        url = `${API}/api/projects/${projectId}/experiments/${experimentId}/tasks/${taskId}/files/${filePath}`
      } else {
        return
      }
      const r = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (r.ok) {
        setSavedContent(content)
      }
    } catch {
      setError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const isModified = content !== savedContent

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: '#E7E0D1' }}>
        <div className="flex items-center gap-1.5">
          <Icon size={12} style={{ color: '#7C3AED' }} />
          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#57534E' }}>
            {label}
          </span>
          {isModified && (
            <span style={{ fontSize: 9, color: '#B45309', fontFamily: 'JetBrains Mono, monospace' }}>● 未保存</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={load} title="刷新"
            className="w-5 h-5 flex items-center justify-center rounded"
            style={{ color: '#A8A29E', border: '1px solid #E7E0D1' }}>
            <RefreshCw size={9} />
          </button>
          {isModified && (
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ fontSize: 10, border: '1px solid #D6CFC2', color: '#44403C' }}>
              <Save size={9} />
              {saving ? '…' : '保存'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: '#A8A29E', fontSize: 11 }}>
          加载中…
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: '#DC2626', fontSize: 11 }}>
          {error}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault()
              save()
            }
          }}
          spellCheck={false}
          className="flex-1 overflow-auto px-3 py-2 outline-none resize-none"
          style={{
            fontSize: 11.5,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#44403C',
            background: 'transparent',
            lineHeight: 1.6,
          }}
        />
      )}
    </div>
  )
}

// ── Main Memory Panel ────────────────────────────────────────

export function MemoryPanel() {
  const { activeProjectId, activeExperimentId, activeTaskId } = useStore()
  const [tab, setTab] = useState('task')

  if (!activeProjectId || !activeExperimentId) {
    return (
      <div className="flex-1 flex items-center justify-center px-4"
        style={{ color: '#C4BEB7', fontSize: 12, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
          <div>选择一个实验或任务</div>
          <div style={{ marginTop: 4, fontSize: 11 }}>Memory 会记录 agent 和用户的关键决策</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: '#E7E0D1' }}>
        {activeTaskId && (
          <button onClick={() => setTab('task')}
            className="flex-1 px-3 py-2 text-center transition"
            style={{
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              color: tab === 'task' ? '#1C1917' : '#A8A29E',
              borderBottom: tab === 'task' ? '2px solid #7C3AED' : '2px solid transparent',
            }}>
            Task 记忆
          </button>
        )}
        <button onClick={() => setTab('experiment')}
          className="flex-1 px-3 py-2 text-center transition"
          style={{
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: tab === 'experiment' ? '#1C1917' : '#A8A29E',
            borderBottom: tab === 'experiment' ? '2px solid #7C3AED' : '2px solid transparent',
          }}>
          Experiment 记忆
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'task' && activeTaskId ? (
          <MemoryFile
            label="TASK.md"
            icon={FileText}
            filePath="TASK.md"
            projectId={activeProjectId}
            experimentId={activeExperimentId}
            taskId={activeTaskId}
          />
        ) : (
          <MemoryFile
            label="EXPERIMENT.md"
            icon={BookOpen}
            filePath="EXPERIMENT.md"
            projectId={activeProjectId}
            experimentId={activeExperimentId}
            taskId={null}
          />
        )}
      </div>

      {/* Info footer */}
      <div className="px-3 py-2 border-t flex-shrink-0"
        style={{ borderColor: '#E7E0D1', fontSize: 10, color: '#A8A29E', lineHeight: 1.5 }}>
        Agent 对话摘要会自动写入 Task 记忆。你也可以手动记录偏好和决策。
      </div>
    </div>
  )
}
