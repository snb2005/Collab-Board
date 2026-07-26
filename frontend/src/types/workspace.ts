export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer'
export type Workspace = { id: string; name: string; description: string; owner_id: string; visibility: 'public' | 'private'; is_password_protected: boolean; role?: WorkspaceRole | null; member_count: number; created_at: string; updated_at: string }
export type WorkspaceMember = { user_id: string; name: string; email: string; role: WorkspaceRole; joined_at: string }
