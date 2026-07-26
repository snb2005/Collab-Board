import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layers, Loader2, ArrowRight, UserPlus, LogIn, Mail, KeyRound, User } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { api } from '../services/api'
import type { AuthSession } from '../types/auth'

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const { login } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = isRegister ? { name, email, password } : { email, password }
      const { data } = await api.post<AuthSession>(`/auth/${mode}`, payload)
      login(data)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth">
      {/* Background decoration */}
      <div className="auth-glow" />
      <div className="auth-glow-2" />

      <Link to="/" className="brand">
        <div className="nav-logo"><Layers size={18} /></div>
        <span>Collab Board</span>
      </Link>

      <section className="card auth-card">
        <div className="auth-icon-wrap">
          {isRegister ? <UserPlus size={24} /> : <LogIn size={24} />}
        </div>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-subtitle">{isRegister ? 'Start collaborating with your team in seconds.' : 'Sign in to continue to your workspaces.'}</p>

        <form onSubmit={submit}>
          {isRegister && (
            <label>
              <span className="label-text"><User size={14} /> Full Name</span>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                minLength={2}
                required
                autoComplete="name"
                placeholder="John Doe"
              />
            </label>
          )}
          <label>
            <span className="label-text"><Mail size={14} /> Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label>
            <span className="label-text"><KeyRound size={14} /> Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="••••••••"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={submitting} className="auth-submit">
            {submitting ? <><Loader2 size={16} className="spinner-icon" /> Please wait…</> : (
              <>{isRegister ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>{isRegister ? 'Already registered?' : 'New to Collab Board?'}</span>
          <Link to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Sign in' : 'Create an account'}
          </Link>
        </div>
      </section>
    </main>
  )
}
