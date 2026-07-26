import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { Dashboard } from './pages/Dashboard'
import { Landing } from './pages/Landing'
import { AuthForm } from './pages/AuthForm'
import { WorkspaceHome } from './pages/WorkspaceHome'
import { WhiteboardPage } from './pages/WhiteboardPage'
import { InviteJoinPage } from './pages/InviteJoinPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthForm mode="login" />} />
      <Route path="/register" element={<AuthForm mode="register" />} />
      <Route path="/invite/:token" element={<InviteJoinPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workspaces/:workspaceId" element={<WorkspaceHome />} />
        <Route path="/whiteboards/:whiteboardId" element={<WhiteboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
