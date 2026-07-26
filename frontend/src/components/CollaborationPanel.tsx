import { useEffect, useState } from 'react'
import {
  History, MessageSquare, Download, Save, RotateCcw,
  CheckCircle, Send, FileJson, FileImage, FileText, FileType,
  Clock, User, Loader2
} from 'lucide-react'
import { api } from '../services/api'
import { useFeedback } from './Feedback'

type Version = {
  id: string
  version_number: number
  message: string
  created_by: string
  created_by_name?: string
  created_at: string
}

type Comment = {
  id: string
  text: string
  author_id: string
  resolved: boolean
  created_at: string
}

type Tab = 'versions' | 'comments' | 'export'

const EXPORT_FORMATS = [
  { key: 'json', icon: FileJson, label: 'JSON', desc: 'Raw board data' },
  { key: 'svg', icon: FileType, label: 'SVG', desc: 'Vector graphic' },
  { key: 'png', icon: FileImage, label: 'PNG', desc: 'Raster image' },
  { key: 'pdf', icon: FileText, label: 'PDF', desc: 'Document format' },
]

export function CollaborationPanel({ boardId, role }: { boardId: string; role: string }) {
  const { toast, confirm: askConfirm, input } = useFeedback()
  const [tab, setTab] = useState<Tab>('versions')
  const [versions, setVersions] = useState<Version[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  const canEdit = role === 'owner' || role === 'editor'

  const loadVersions = () => {
    api.get<Version[]>(`/whiteboards/${boardId}/versions`)
      .then(r => setVersions(r.data))
      .catch(() => {})
  }

  const loadComments = () => {
    api.get<Comment[]>(`/whiteboards/${boardId}/comments`)
      .then(r => setComments(r.data))
      .catch(() => {})
  }

  useEffect(() => {
    loadVersions()
    loadComments()
  }, [boardId])

  async function saveVersion() {
    if (!canEdit) return
    setSaving(true)
    try {
      const message = await input('Save version', 'Add an optional description for this version')
      if (message === null) { setSaving(false); return }
      await api.post(`/whiteboards/${boardId}/versions`, { message: message || 'Manual save' })
      loadVersions()
      toast('Version saved')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (detail === 'No changes since the latest version') {
        toast('No changes to save', 'info')
      } else {
        toast('Failed to save version', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  async function restoreVersion(versionId: string, versionNum: number) {
    if (!canEdit) return
    const confirmed = await askConfirm(
      `Restore version ${versionNum}?`,
      'The current board will be replaced with this version. A new version will be created to preserve history.'
    )
    if (!confirmed) return
    setRestoring(versionId)
    try {
      await api.post(`/versions/${versionId}/restore`)
      toast(`Restored to version ${versionNum}`)
      loadVersions()
      // Reload the page to get new board data
      window.location.reload()
    } catch {
      toast('Failed to restore version', 'error')
    } finally {
      setRestoring(null)
    }
  }

  async function addComment() {
    if (!commentText.trim()) return
    try {
      await api.post(`/whiteboards/${boardId}/comments`, { text: commentText })
      setCommentText('')
      loadComments()
      toast('Comment added')
    } catch {
      toast('Failed to add comment', 'error')
    }
  }

  async function resolveComment(id: string) {
    if (!canEdit) return
    try {
      await api.patch(`/comments/${id}/resolve`)
      loadComments()
    } catch {
      toast('Failed to resolve comment', 'error')
    }
  }

  async function exportBoard(format: string) {
    setExporting(format)
    try {
      const response = await api.get(`/whiteboards/${boardId}/export/${format}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `whiteboard.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast(`Export failed for ${format.toUpperCase()}`, 'error')
    } finally {
      setExporting(null)
    }
  }

  return (
    <aside className="collab-panel">
      {/* Tabs */}
      <div className="panel-tabs">
        <button className={tab === 'versions' ? 'active' : ''} onClick={() => setTab('versions')}>
          <History size={15} /> Versions
        </button>
        <button className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}>
          <MessageSquare size={15} /> Comments
        </button>
        <button className={tab === 'export' ? 'active' : ''} onClick={() => setTab('export')}>
          <Download size={15} /> Export
        </button>
      </div>

      <div className="panel-body">
        {/* ── Versions Tab ── */}
        {tab === 'versions' && (
          <>
            {canEdit && (
              <button
                onClick={saveVersion}
                disabled={saving}
                style={{ width: '100%', marginBottom: '1rem' }}
              >
                {saving ? <Loader2 size={15} className="spinner-icon" /> : <Save size={15} />}
                Save Version
              </button>
            )}
            {versions.length > 0 ? (
              <div className="version-list">
                {versions.map(v => (
                  <div className="version-item" key={v.id}>
                    <div className="version-header">
                      <span className="version-num">v{v.version_number}</span>
                      <div className="version-meta">
                        <Clock size={12} />
                        {new Date(v.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {v.created_by_name && (
                      <div className="version-meta">
                        <User size={12} /> {v.created_by_name}
                      </div>
                    )}
                    {v.message && <div className="version-msg">"{v.message}"</div>}
                    {canEdit && (
                      <div className="version-actions">
                        <button
                          className="btn-xs btn-outline"
                          onClick={() => restoreVersion(v.id, v.version_number)}
                          disabled={restoring === v.id}
                        >
                          {restoring === v.id ? <Loader2 size={12} className="spinner-icon" /> : <RotateCcw size={12} />}
                          Restore
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                No versions saved yet.
              </p>
            )}
          </>
        )}

        {/* ── Comments Tab ── */}
        {tab === 'comments' && (
          <>
            {comments.length > 0 ? (
              <div className="comment-list">
                {comments.map(c => (
                  <div className={`comment-item ${c.resolved ? 'resolved' : ''}`} key={c.id}>
                    <div className="comment-header">
                      <span>{new Date(c.created_at).toLocaleString()}</span>
                      {!c.resolved && canEdit && (
                        <button className="btn-xs btn-ghost" onClick={() => resolveComment(c.id)}>
                          <CheckCircle size={12} /> Resolve
                        </button>
                      )}
                    </div>
                    <div className="comment-text">{c.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                No comments yet.
              </p>
            )}
            <div className="comment-form">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment()}
                placeholder="Add a comment…"
              />
              <button className="btn-sm" onClick={addComment} disabled={!commentText.trim()}>
                <Send size={14} />
              </button>
            </div>
          </>
        )}

        {/* ── Export Tab ── */}
        {tab === 'export' && (
          <div className="export-list">
            {EXPORT_FORMATS.map(fmt => (
              <div
                className="export-item"
                key={fmt.key}
                onClick={() => !exporting && exportBoard(fmt.key)}
                style={exporting === fmt.key ? { opacity: 0.6 } : undefined}
              >
                {exporting === fmt.key ? <Loader2 size={20} className="spinner-icon" /> : <fmt.icon size={20} />}
                <div className="export-info">
                  <h4>{fmt.label}</h4>
                  <p>{fmt.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
