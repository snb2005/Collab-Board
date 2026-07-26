# Phase 4 — Real-time collaboration

Each board has an authenticated native WebSocket room at `/ws/whiteboards/{whiteboard_id}?token=<access-token>`.

- JWT authentication and workspace-membership authorization happen before the socket is accepted.
- `ConnectionManager` manages per-whiteboard rooms and broadcasts drawing changes.
- The frontend broadcasts board updates and pointer positions; peers receive live board changes and rendered cursor indicators.
- Presence count is shown in the board header.
- `PresenceService` stores board membership and cursor coordinates in Redis when Redis is available. The in-process connection manager keeps local development usable without Redis.

This uses FastAPI’s native WebSocket protocol instead of Socket.IO. The event boundary is isolated in `app/websocket/`, so a Socket.IO transport can be substituted later without changing board persistence or UI state.
