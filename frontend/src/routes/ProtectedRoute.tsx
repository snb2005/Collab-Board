import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner spinner-lg" />
        <span>Loading your workspace…</span>
      </div>
    )
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />
}
