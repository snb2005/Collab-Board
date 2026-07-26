import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { api } from '../../services/api'
import type { AuthSession, User } from '../../types/auth'

type AuthContextValue = { user: User | null; loading: boolean; login: (session: AuthSession) => void; logout: () => void }
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const login = (session: AuthSession) => {
    localStorage.setItem('access_token', session.access_token)
    localStorage.setItem('refresh_token', session.refresh_token)
    setUser(session.user)
  }
  const logout = () => { localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); setUser(null) }
  useEffect(() => {
    if (!localStorage.getItem('access_token')) { setLoading(false); return }
    api.get<User>('/auth/me').then(({ data }) => setUser(data)).catch(logout).finally(() => setLoading(false))
  }, [])
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value }
