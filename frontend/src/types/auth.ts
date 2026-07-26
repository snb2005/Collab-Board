export type User = { id: string; name: string; email: string; avatar?: string | null }
export type AuthSession = { access_token: string; refresh_token: string; token_type: string; user: User }
