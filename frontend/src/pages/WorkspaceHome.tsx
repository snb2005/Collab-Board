import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Loader2, LogOut, ShieldCheck,
  FileText, Lock, Globe, Users, Search, Bell,
  Check, X, Clock, Link2, Copy, Trash2, ChevronDown,
  Layers, ChevronRight, Sparkles, PenLine
} from 'lucide-react'
import { api } from '../services/api'
import type { Workspace, WorkspaceMember } from '../types/workspace'
import type { Whiteboard, EditorAccessRequest, InviteToken } from '../types/whiteboard'
import { useFeedback } from '../components/Feedback'
import { useAuth } from '../features/auth/AuthContext'

export function WorkspaceHome() {
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { input, confirm: askConfirm, toast } = useFeedback()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [boards, setBoards] = useState<Whiteboard[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Members search
  const [memberSearch, setMemberSearch] = useState('')

  // Editor access requests
  const [editorRequests, setEditorRequests] = useState<EditorAccessRequest[]>([])
  const [myRequestStatus, setMyRequestStatus] = useState<string | null>(null)
  const [requestingAccess, setRequestingAccess] = useState(false)

  // Invite links
  const [invites, setInvites] = useState<InviteToken[]>([])
  const [showInvites, setShowInvites] = useState(false)
  const [inviteExpiration, setInviteExpiration] = useState<string>('24h')
  const [generatingInvite, setGeneratingInvite] = useState(false)

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([])

  const load = () => {
    if (!workspaceId) return
    setLoading(true)
    api.get<Workspace>(`/workspaces/${workspaceId}`)
      .then(({ data }) => {
        setWorkspace(data)
        return Promise.all([
          api.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),
          api.get<Whiteboard[]>(`/workspaces/${workspaceId}/whiteboards`),
        ])
      })
      .then(([membersRes, boardsRes]) => {
        setMembers(membersRes.data)
        setBoards(boardsRes.data)
      })
      .catch(err => setError(err.response?.data?.detail ?? 'Unable to load this workspace'))
      .finally(() => setLoading(false))
  }

  const loadEditorRequests = () => {
    if (!workspaceId) return
    if (workspace?.role === 'owner') {
      api.get(`/workspaces/${workspaceId}/editor-requests`)
        .then(({ data }) => setEditorRequests(data))
        .catch(() => {})
    }
  }

  const loadMyStatus = () => {
    if (!workspaceId) return
    api.get(`/workspaces/${workspaceId}/editor-requests/my-status`)
      .then(({ data }) => setMyRequestStatus(data.status))
      .catch(() => {})
  }

  const loadInvites = () => {
    if (!workspaceId || workspace?.role !== 'owner') return
    api.get(`/workspaces/${workspaceId}/invites`)
      .then(({ data }) => setInvites(data))
      .catch(() => {})
  }

  const loadNotifications = () => {
    api.get('/notifications')
      .then(({ data }) => setNotifications(data.filter((n: any) =>
        !n.read && n.metadata?.workspace_id === workspaceId
      )))
      .catch(() => {})
  }

  useEffect(() => { load() }, [workspaceId])

  useEffect(() => {
    if (!workspace) return
    loadMyStatus()
    loadEditorRequests()
    loadInvites()
    loadNotifications()

    const interval = setInterval(() => {
      loadEditorRequests()
      loadNotifications()
      loadMyStatus()
    }, 10000)
    return () => clearInterval(interval)
  }, [workspace?.id, workspace?.role])

  async function createBoard() {
    if (!workspaceId) return
    const title = await input('Create whiteboard', 'Enter a name for your new board')
    if (!title) return
    try {
      const { data } = await api.post<Whiteboard>(
        `/workspaces/${workspaceId}/whiteboards`,
        { title }
      )
      setBoards(items => [data, ...items])
      toast('Whiteboard created')
    } catch (err: any) {
      toast(err.response?.data?.detail ?? 'Unable to create whiteboard', 'error')
    }
  }

  async function leave() {
    if (!workspaceId) return
    const confirmed = await askConfirm(
      'Leave workspace?',
      'You will lose access to all whiteboards in this workspace.'
    )
    if (!confirmed) return
    try {
      await api.post(`/workspaces/${workspaceId}/leave`)
      toast('Left workspace')
      navigate('/dashboard')
    } catch (err: any) {
      toast(err.response?.data?.detail ?? 'Unable to leave workspace', 'error')
    }
  }

  async function requestEditor() {
    if (!workspaceId) return
    setRequestingAccess(true)
    try {
      await api.post(`/workspaces/${workspaceId}/editor-requests`)
      setMyRequestStatus('pending')
      toast('Editor access request sent to workspace owner')
    } catch (e: any) {
      toast(e.response?.data?.detail ?? 'Request failed', 'error')
    } finally {
      setRequestingAccess(false)
    }
  }

  async function decideRequest(requestId: string, decision: 'approve' | 'reject') {
    if (!workspaceId) return
    try {
      await api.post(`/workspaces/${workspaceId}/editor-requests/${requestId}/${decision}`)
      toast(decision === 'approve' ? 'Request approved — user is now an Editor' : 'Request rejected')
      loadEditorRequests()
      load()
    } catch (e: any) {
      toast(e.response?.data?.detail ?? 'Action failed', 'error')
    }
  }

  async function changeRole(memberId: string, role: string) {
    if (!workspaceId) return
    try {
      await api.patch(`/workspaces/${workspaceId}/members/${memberId}`, { role })
      setMembers(items =>
        items.map(m => m.user_id === memberId ? { ...m, role: role as any } : m)
      )
      toast('Member role updated')
    } catch (e: any) {
      toast(e.response?.data?.detail ?? 'Update failed', 'error')
    }
  }

  async function generateInvite() {
    if (!workspaceId) return
    setGeneratingInvite(true)
    try {
      const { data } = await api.post(`/workspaces/${workspaceId}/invites`, { expiration: inviteExpiration })
      setInvites(prev => [data, ...prev])
      const link = `${window.location.origin}/invite/${data.token}`
      await navigator.clipboard.writeText(link)
      toast('Invite link generated & copied!')
    } catch (e: any) {
      toast(e.response?.data?.detail ?? 'Failed to generate invite', 'error')
    } finally {
      setGeneratingInvite(false)
    }
  }

  async function revokeInvite(token: string) {
    if (!workspaceId) return
    try {
      await api.delete(`/workspaces/${workspaceId}/invites/${token}`)
      setInvites(prev => prev.filter(inv => inv.token !== token))
      toast('Invite revoked')
    } catch (e: any) {
      toast(e.response?.data?.detail ?? 'Revoke failed', 'error')
    }
  }

  async function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invite/${token}`
    await navigator.clipboard.writeText(link)
    toast('Link copied!')
  }

  async function dismissNotification(notificationId: string) {
    try {
      await api.patch(`/notifications/${notificationId}/read`)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch {
      // Silently fail
    }
  }

  // Members filtering
  const filteredMembers = members.filter(m => {
    if (!memberSearch.trim()) return true
    const q = memberSearch.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  if (error) {
    return (
      <main className="workspace">
        <header>
          <Link className="brand" to="/dashboard">
            <div className="nav-logo"><Layers size={18} /></div>
            <span>Collab Board</span>
          </Link>
        </header>
        <section>
          <p className="error">{error}</p>
        </section>
      </main>
    )
  }

  if (loading || !workspace) {
    return (
      <div className="centered">
        <div className="spinner" /> Loading workspace…
      </div>
    )
  }

  const canEdit = workspace.role === 'owner' || workspace.role === 'editor'

  return (
    <main className="workspace">
      <header>
        <Link className="brand" to="/dashboard">
          <div className="nav-logo"><Layers size={18} /></div>
          <span>Collab Board</span>
        </Link>
        <span className={`badge ${workspace.role === 'owner' ? 'badge-accent' : workspace.role === 'editor' ? 'badge-success' : 'badge-viewer'}`}>
          {workspace.role}
        </span>
      </header>

      <section>
        <div className="page-hero">
          <span className="section-badge">
            {workspace.visibility === 'private' ? <><Lock size={11} /> Private</> : <><Globe size={11} /> Public</>} Workspace
          </span>
          <h1>{workspace.name}</h1>
          <p>{workspace.description || 'No description yet.'}</p>
        </div>

        {/* Request Editor Access button */}
        {workspace.role === 'viewer' && (
          <button
            className="btn-outline request-editor-btn"
            onClick={requestEditor}
            disabled={requestingAccess || myRequestStatus === 'pending'}
          >
            {requestingAccess ? (
              <><Loader2 size={16} className="spinner-icon" /> Sending…</>
            ) : myRequestStatus === 'pending' ? (
              <><Clock size={16} /> Request Pending</>
            ) : (
              <><ShieldCheck size={16} /> Request Editor Access</>
            )}
          </button>
        )}

        {/* Notifications / Editor Requests Panel (Owner) */}
        {workspace.role === 'owner' && editorRequests.length > 0 && (
          <article className="panel notification-panel">
            <h2><Bell size={16} /> Pending Requests</h2>
            <div className="notification-list">
              {editorRequests.map(req => (
                <div className="notification-item" key={req.id}>
                  <div className="notification-avatar">
                    {req.requester_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">
                      <strong>{req.requester_name}</strong> wants Editor access
                    </div>
                    <div className="notification-time">
                      <Clock size={11} /> {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="notification-actions">
                    <button className="btn-sm approve-btn" onClick={() => decideRequest(req.id, 'approve')}>
                      <Check size={14} /> Approve
                    </button>
                    <button className="btn-sm btn-outline" onClick={() => decideRequest(req.id, 'reject')}>
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        )}

        <div className="workspace-grid">
          {/* Whiteboards Panel */}
          <article className="panel">
            <div className="panel-title">
              <h2><PenLine size={16} /> Whiteboards</h2>
              {canEdit && (
                <button className="btn-sm" onClick={createBoard}>
                  <Plus size={14} /> New board
                </button>
              )}
            </div>
            {boards.length ? (
              <div className="board-list">
                {boards.map(board => (
                  <Link key={board.id} to={`/whiteboards/${board.id}`}>
                    <FileText size={18} />
                    <div className="board-info">
                      {board.title}
                      <small>Updated {new Date(board.updated_at).toLocaleDateString()}</small>
                    </div>
                    {board.is_locked && <Lock size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />}
                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0, opacity: 0.5 }} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ padding: '2rem 1rem' }}>
                <div className="empty-icon"><FileText size={28} /></div>
                <h3>No whiteboards yet</h3>
                <p>{canEdit ? 'Create one to start drawing!' : 'No boards have been created.'}</p>
              </div>
            )}
          </article>

          {/* Members Panel */}
          <article className="panel">
            <h2><Users size={16} /> Members <span className="count-badge">{members.length}</span></h2>

            {/* Members Search */}
            <div className="members-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
              />
            </div>

            <div className="members-list">
              {filteredMembers.length > 0 ? filteredMembers.map(member => (
                <div className="member-item" key={member.user_id}>
                  <div className="member-avatar">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="member-info">
                    <div className="member-name">
                      {member.name}
                      {member.user_id === user?.id && <span className="you-tag">(You)</span>}
                    </div>
                    <div className="member-email">{member.email}</div>
                  </div>
                  {workspace.role === 'owner' && member.role !== 'owner' ? (
                    <select
                      className="member-role-select"
                      value={member.role}
                      onChange={e => changeRole(member.user_id, e.target.value)}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                  ) : (
                    <span className={`badge ${member.role === 'owner' ? 'badge-accent' : member.role === 'editor' ? 'badge-success' : 'badge-neutral'}`}>
                      {member.role}
                    </span>
                  )}
                </div>
              )) : (
                <p style={{ padding: '1rem 0', fontSize: '0.85rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  No members match "{memberSearch}"
                </p>
              )}
            </div>
          </article>
        </div>

        {/* Invite Links Section (Owner) */}
        {workspace.role === 'owner' && (
          <article className="panel invite-panel">
            <div className="panel-title" onClick={() => setShowInvites(v => !v)} style={{ cursor: 'pointer' }}>
              <h2><Link2 size={16} /> Invite Links</h2>
              <ChevronDown size={16} style={{ transform: showInvites ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
            </div>
            {showInvites && (
              <div className="invite-section">
                <div className="invite-generate">
                  <label style={{ fontSize: '0.82rem', fontWeight: 500 }}>
                    Expiration
                    <select value={inviteExpiration} onChange={e => setInviteExpiration(e.target.value)} style={{ width: 'auto', marginTop: '0.25rem' }}>
                      <option value="1h">1 hour</option>
                      <option value="24h">24 hours</option>
                      <option value="7d">7 days</option>
                    </select>
                  </label>
                  <button className="btn-sm" onClick={generateInvite} disabled={generatingInvite} style={{ alignSelf: 'flex-end' }}>
                    {generatingInvite ? <Loader2 size={14} className="spinner-icon" /> : <Link2 size={14} />}
                    Generate Link
                  </button>
                </div>

                {invites.length > 0 && (
                  <div className="invite-list">
                    {invites.map(inv => (
                      <div className="invite-item" key={inv.token}>
                        <div className="invite-info">
                          <code className="invite-token">{inv.token.slice(0, 16)}…</code>
                          <span className="invite-expires">
                            <Clock size={11} /> Expires {new Date(inv.expires_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="invite-actions">
                          <button className="btn-xs btn-ghost" onClick={() => copyInviteLink(inv.token)} title="Copy link">
                            <Copy size={12} />
                          </button>
                          <button className="btn-xs btn-ghost" onClick={() => revokeInvite(inv.token)} title="Revoke" style={{ color: 'var(--danger)' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </article>
        )}

        {/* General notifications (for viewers - approval/rejection) */}
        {notifications.length > 0 && workspace.role !== 'owner' && (
          <article className="panel notification-panel">
            <h2><Bell size={16} /> Notifications</h2>
            <div className="notification-list">
              {notifications.map(n => (
                <div className="notification-item" key={n.id}>
                  <div className="notification-content">
                    <div className="notification-title">{n.title}</div>
                    <div className="notification-message">{n.message}</div>
                    <div className="notification-time">
                      <Clock size={11} /> {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button className="btn-xs btn-ghost" onClick={() => dismissNotification(n.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </article>
        )}

        {workspace.role !== 'owner' && (
          <button className="btn-danger leave-btn" onClick={leave}>
            <LogOut size={16} /> Leave workspace
          </button>
        )}
      </section>
    </main>
  )
}
