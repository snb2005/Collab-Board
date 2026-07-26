export type BoardObject = {
  id: string
  type: 'path' | 'rect' | 'circle' | 'arrow' | 'text'
  points?: number[]
  x?: number
  y?: number
  width?: number
  height?: number
  text?: string
  color: string
  rotation?: number
  fontSize?: number
}

export type Whiteboard = {
  id: string
  workspace_id: string
  title: string
  board_data: { objects: BoardObject[]; background: string; zoom: number }
  created_by: string
  is_locked: boolean
  locked_by: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
}

export type EditorAccessRequest = {
  id: string
  workspace_id: string
  requester_id: string
  requester_name: string
  requester_email: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  handled_by: string | null
  handled_at: string | null
}

export type InviteToken = {
  id: string
  token: string
  workspace_id: string
  created_by: string
  expires_at: string
  revoked: boolean
  created_at: string
}
