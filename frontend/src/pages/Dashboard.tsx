import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Users, Lock, Globe, Loader2, FolderOpen,
  LogOut, Layers, ArrowRight, Sparkles, ChevronRight
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { api } from '../services/api'
import type { Workspace } from '../types/workspace'
import { useFeedback } from '../components/Feedback'

export function Dashboard() {
  const { user, logout } = useAuth()
  const { input, toast } = useFeedback()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [results, setResults] = useState<Workspace[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [joining, setJoining] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  /* Form — no defaults except visibility=private */
  const [form, setForm] = useState({ name: '', description: '', visibility: 'private', password: '' })

  const load = () => {
    api.get<Workspace[]>('/workspaces/mine')
      .then(({ data }) => setWorkspaces(data))
      .catch(() => setError('Unable to load workspaces.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function create(event: FormEvent) {
    event.preventDefault()
    setError('')
    setCreating(true)
    try {
      const payload: any = {
        name: form.name,
        description: form.description,
        visibility: form.visibility,
      }
      if (form.visibility === 'private') {
        payload.password = form.password
      }
      const { data } = await api.post<Workspace>('/workspaces', payload)
      setWorkspaces(items => [data, ...items])
      setForm({ name: '', description: '', visibility: 'private', password: '' })
      setShowCreate(false)
      toast('Workspace created successfully')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Unable to create workspace.')
      toast(err.response?.data?.detail ?? 'Unable to create workspace.', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function find(event: FormEvent) {
    event.preventDefault()
    if (!search.trim()) return
    setSearching(true)
    try {
      const { data } = await api.get<Workspace[]>('/workspaces/search', { params: { q: search } })
      setResults(data)
    } catch {
      toast('Unable to search workspaces.', 'error')
    } finally {
      setSearching(false)
    }
  }

  async function join(workspace: Workspace) {
    let password: string | undefined | null = undefined
    if (workspace.is_password_protected) {
      password = await input('Enter workspace code', 'This private workspace requires its code to join.')
      if (!password) return
    }
    setJoining(workspace.id)
    try {
      const { data } = await api.post<Workspace>(`/workspaces/${workspace.id}/join`, { password })
      load()
      setResults(items => items.map(item => item.id === workspace.id ? data : item))
      toast(`Joined "${workspace.name}" as ${data.role}`)
    } catch (err: any) {
      toast(err.response?.data?.detail ?? 'Unable to join workspace.', 'error')
    } finally {
      setJoining(null)
    }
  }

  return (
    <main className="dashboard">
      <header>
        <Link className="brand" to="/">
          <div className="nav-logo"><Layers size={18} /></div>
          <span>Collab Board</span>
        </Link>
        <div className="user-info">
          <span className="user-greeting">
            {user?.name}
          </span>
          <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
          <button className="btn-ghost btn-sm" onClick={logout}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <section>
        <div className="page-hero">
          <span className="section-badge"><Sparkles size={12} /> Dashboard</span>
          <h1>Your workspaces</h1>
          <p>Create a private team space or discover public ones.</p>
        </div>

        <div className="dash-actions">
          <button onClick={() => setShowCreate(v => !v)} className={showCreate ? 'btn-outline' : ''}>
            {showCreate ? 'Cancel' : <><Plus size={16} /> New workspace</>}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {/* Create Workspace Form */}
        {showCreate && (
          <form className="workspace-form" onSubmit={create}>
            <h3 className="form-title"><Plus size={16} /> Create workspace</h3>
            <label>
              Workspace Name
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                minLength={2}
                required
                placeholder="e.g., Product Design"
              />
            </label>
            <label>
              Description
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What is this workspace for?"
              />
            </label>
            <label>
              Visibility
              <select
                value={form.visibility}
                onChange={e => setForm({ ...form, visibility: e.target.value, password: '' })}
              >
                <option value="private">🔒 Private</option>
                <option value="public">🌐 Public</option>
              </select>
            </label>
            {form.visibility === 'private' && (
              <label>
                Workspace Code <span style={{ color: 'var(--danger)', fontWeight: 400 }}>*</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  minLength={4}
                  required
                  placeholder="Enter a code for members to join"
                />
              </label>
            )}
            <button disabled={creating} className="form-submit">
              {creating ? <><Loader2 size={16} className="spinner-icon" /> Creating…</> : <><ArrowRight size={16} /> Create workspace</>}
            </button>
          </form>
        )}

        {/* Workspace List */}
        {loading ? (
          <div className="centered" style={{ minHeight: '200px' }}>
            <div className="spinner" /> Loading workspaces…
          </div>
        ) : workspaces.length ? (
          <div className="workspace-list">
            {workspaces.map(workspace => (
              <Link className="workspace-card" key={workspace.id} to={`/workspaces/${workspace.id}`}>
                <div className="card-header">
                  <span className={`badge ${workspace.role === 'owner' ? 'badge-accent' : workspace.role === 'editor' ? 'badge-success' : 'badge-viewer'}`}>
                    {workspace.role}
                  </span>
                  {workspace.visibility === 'private' ? <Lock size={14} /> : <Globe size={14} />}
                </div>
                <h2>{workspace.name}</h2>
                <p>{workspace.description || 'No description'}</p>
                <div className="card-footer">
                  <Users size={14} />
                  <span>{workspace.member_count} member{workspace.member_count === 1 ? '' : 's'}</span>
                  <span>·</span>
                  <span>{workspace.visibility}</span>
                  <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon">
              <FolderOpen size={36} />
            </div>
            <h3>No workspaces yet</h3>
            <p>Create one to start collaborating with your team!</p>
          </div>
        )}

        {/* Discover Workspaces */}
        <div className="discover">
          <div className="discover-header">
            <span className="section-badge"><Search size={12} /> Discover</span>
            <h2>Find workspaces</h2>
          </div>
          <form className="search-bar" onSubmit={find}>
            <div className="search-input-wrap">
              <Search size={16} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search all workspaces…"
              />
            </div>
            <button type="submit" disabled={searching}>
              {searching ? <Loader2 size={16} className="spinner-icon" /> : <Search size={16} />}
              Search
            </button>
          </form>

          {results.map(workspace => (
            <div className="search-result" key={workspace.id}>
              <div className="result-info">
                <h3>
                  {workspace.name}
                  <span className={`badge ${workspace.visibility === 'public' ? 'badge-success' : 'badge-warning'}`}>
                    {workspace.visibility === 'public' ? <><Globe size={10} /> Public</> : <><Lock size={10} /> Private</>}
                  </span>
                </h3>
                <p>{workspace.description || 'No description'} · {workspace.member_count} members</p>
              </div>
              <div className="result-actions">
                {workspace.role ? (
                  <Link to={`/workspaces/${workspace.id}`} className="button btn-sm btn-secondary">
                    Open <ChevronRight size={14} />
                  </Link>
                ) : (
                  <button
                    className="btn-sm"
                    onClick={() => join(workspace)}
                    disabled={joining === workspace.id}
                  >
                    {joining === workspace.id ? <Loader2 size={14} className="spinner-icon" /> : null}
                    Join
                  </button>
                )}
              </div>
            </div>
          ))}

          {results.length === 0 && search && !searching && (
            <p style={{ color: 'var(--text-tertiary)', marginTop: '1rem', fontSize: '0.9rem' }}>
              No workspaces found. Try a different search term.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
