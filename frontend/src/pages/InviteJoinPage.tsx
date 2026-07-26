import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layers, Loader2, AlertCircle, ArrowRight, Lock, Globe, Users } from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../features/auth/AuthContext'
import { useFeedback } from '../components/Feedback'

type InviteInfo = {
  workspace_id: string
  workspace_name: string
  workspace_description: string
  visibility: string
  expires_at: string
}

export function InviteJoinPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useFeedback()

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setError('No invite token provided'); setLoading(false); return }
    api.get(`/invites/${token}/validate`)
      .then(({ data }) => setInfo(data))
      .catch(err => setError(err.response?.data?.detail ?? 'Invalid or expired invite link'))
      .finally(() => setLoading(false))
  }, [token])

  async function join() {
    if (!token || !user) return
    setJoining(true)
    try {
      const { data } = await api.post(`/invites/${token}/join`)
      if (data.already_member) {
        toast('You are already a member of this workspace')
      } else {
        toast(`Joined "${data.workspace.name}" as ${data.workspace.role}`)
      }
      navigate(`/workspaces/${data.workspace.id}`)
    } catch (err: any) {
      toast(err.response?.data?.detail ?? 'Failed to join workspace', 'error')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner" /> Validating invite…
      </div>
    )
  }

  return (
    <main className="auth">
      <Link className="brand" to="/">
        <Layers size={18} /> Collab Board
      </Link>

      <div className="card">
        {error ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', marginBottom: '0.75rem' }}>
              <AlertCircle size={24} />
              <h1 style={{ fontSize: '1.3rem' }}>Invalid Invite</h1>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
            <Link to={user ? '/dashboard' : '/login'} className="button" style={{ width: '100%', textAlign: 'center' }}>
              {user ? 'Go to Dashboard' : 'Sign In'}
            </Link>
          </>
        ) : info && (
          <>
            <span className="eyebrow">WORKSPACE INVITE</span>
            <h1 style={{ fontSize: '1.4rem', marginTop: '0.5rem' }}>{info.workspace_name}</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              {info.workspace_description || 'No description'}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {info.visibility === 'private' ? <Lock size={13} /> : <Globe size={13} />}
                {info.visibility}
              </span>
            </div>

            {info.visibility === 'private' && (
              <div style={{
                background: 'var(--info-bg)', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)',
                padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#1e40af'
              }}>
                This is a private workspace. You'll join as a <strong>Viewer</strong> and can request Editor access later.
              </div>
            )}
            {info.visibility === 'public' && (
              <div style={{
                background: 'var(--success-bg)', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-md)',
                padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#065f46'
              }}>
                You'll join as an <strong>Editor</strong> with full drawing permissions.
              </div>
            )}

            {user ? (
              <button onClick={join} disabled={joining} style={{ width: '100%' }}>
                {joining ? <Loader2 size={16} className="spinner-icon" /> : <ArrowRight size={16} />}
                {joining ? 'Joining…' : 'Join Workspace'}
              </button>
            ) : (
              <>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                  Sign in or create an account to join this workspace.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link to={`/login?redirect=/invite/${token}`} className="button" style={{ flex: 1, textAlign: 'center' }}>
                    Sign In
                  </Link>
                  <Link to={`/register?redirect=/invite/${token}`} className="button btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
                    Register
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
