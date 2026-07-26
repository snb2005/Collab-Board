# Collab Board — Handoff Documentation

## Project Overview

Collab Board is a real-time collaborative whiteboard application built with a FastAPI backend and React (Vite + TypeScript) frontend. It supports multiple workspaces with role-based access, real-time drawing synchronization via WebSockets, version history, comments, and export features.

---

## Architecture

```
Frontend (React + Vite + TypeScript)
        │
   REST API + WebSocket
        │
FastAPI Backend (Python 3.12+)
        │
   ┌────┴────┐
MongoDB    Redis
```

### Frontend Stack
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| React Router | Client-side routing |
| Axios | REST API client |
| Lucide React | SVG icon library |
| Native WebSocket | Real-time communication |

### Backend Stack
| Technology | Purpose |
|---|---|
| FastAPI | ASGI web framework |
| Python 3.12+ | Backend runtime |
| Motor | Async MongoDB driver |
| Redis (async) | Presence, cursor caching |
| python-jose | JWT authentication |
| pwdlib (Argon2) | Password hashing |
| Pydantic | Request/response validation |
| Pillow | PNG export rendering |
| ReportLab | PDF export rendering |

---

## Project Structure

### Frontend (`frontend/src/`)

```
src/
├── App.tsx                    # Route definitions
├── main.tsx                   # Entry point with providers
├── styles.css                 # Complete CSS design system
├── components/
│   ├── Feedback.tsx           # Toast + Modal + Input dialog system
│   └── CollaborationPanel.tsx # Tabbed sidebar (Versions/Comments/Export)
├── features/
│   └── auth/AuthContext.tsx   # Authentication context & hooks
├── pages/
│   ├── Landing.tsx            # Public landing page
│   ├── AuthForm.tsx           # Login & Register forms
│   ├── Dashboard.tsx          # Workspace list, create, search & join
│   ├── WorkspaceHome.tsx      # Workspace details, members, boards
│   └── WhiteboardPage.tsx     # Full whiteboard with canvas & tools
├── routes/
│   └── ProtectedRoute.tsx     # Auth guard
├── services/
│   └── api.ts                 # Axios instance with auth interceptor
├── types/
│   ├── auth.ts                # User, AuthSession types
│   ├── workspace.ts           # Workspace, WorkspaceMember types
│   └── whiteboard.ts          # Whiteboard, BoardObject types
└── hooks/                     # (empty, ready for custom hooks)
```

### Backend (`backend/app/`)

```
app/
├── main.py                    # FastAPI app, middleware, routers
├── api/
│   ├── auth.py                # /auth/* endpoints
│   ├── workspaces.py          # /workspaces/* endpoints
│   ├── whiteboards.py         # /whiteboards/* endpoints
│   ├── collaboration.py       # Versions, comments, notifications, export
│   └── dependencies.py        # get_current_user dependency
├── core/
│   ├── config.py              # Settings from .env
│   └── security.py            # JWT, password hashing
├── db/
│   ├── mongodb.py             # MongoDB connection (with in-memory fallback)
│   └── redis.py               # Redis connection
├── middleware/
│   └── auth.py                # Auth middleware (non-enforcing)
├── models/
│   ├── user.py
│   ├── workspace.py
│   ├── whiteboard.py
│   └── collaboration.py       # Version, Comment, Notification
├── repositories/
│   ├── user_repository.py
│   ├── workspace_repository.py
│   ├── whiteboard_repository.py
│   └── collaboration_repository.py
├── schemas/
│   ├── auth.py
│   ├── workspace.py
│   ├── whiteboard.py
│   └── collaboration.py
├── services/
│   ├── auth_service.py
│   ├── workspace_service.py
│   ├── whiteboard_service.py
│   ├── permission_service.py
│   ├── collaboration_service.py
│   └── presence_service.py
└── websocket/
    ├── connection_manager.py  # Room & user metadata management
    └── handlers.py            # WebSocket event handler
```

---

## Features

### 1. Authentication
- JWT-based (access + refresh tokens)
- Argon2 password hashing
- Protected routes on frontend
- Token refresh flow

### 2. Workspaces
- **Public**: Anyone can find and join with Editor role
- **Private**: Requires a workspace code; joins as Viewer
- Workspace code is mandatory for private workspaces
- Search returns both public and private workspaces
- Owner can manage member roles from the member list

### 3. Role-Based Access Control
| Role | Capabilities |
|---|---|
| **Owner** | Full control, manage members, change roles, delete workspace |
| **Editor** | Create/edit whiteboards, draw, save versions, resolve comments |
| **Viewer** | View whiteboards, zoom/pan, view comments/versions, add comments |

### 4. Viewer Mode
- All drawing tools disabled (both UI and backend)
- Undo/redo disabled
- Delete disabled
- Zoom and pan allowed
- Comments and versions viewable
- Clear "Viewer Mode" badge in header
- WebSocket rejects `board:update` from viewers

### 5. Real-Time Collaboration
- WebSocket connection per whiteboard
- Live drawing sync via `board:update` events
- Cursor broadcasting with user name labels
- Consistent cursor colors (hash-based from user ID)
- ~30fps cursor throttling
- Cursors removed on disconnect

### 6. Version History
- Save with optional description/message
- Hash-based duplicate detection (no duplicate saves)
- Version list with: number, author name, timestamp, description
- Restore creates a new version (history is never overwritten)
- Restore confirmation dialog

### 7. Online Members
- Popover showing connected users in real-time
- User name, role badge, online indicator
- Current user highlighted with "(You)" tag
- Updated on join/leave events

### 8. Export
- **JSON**: Raw board data download
- **SVG**: Proper vector rendering of all shapes
- **PNG**: Raster rendering via Pillow
- **PDF**: Document rendering via ReportLab

### 9. Comments
- Add comments to whiteboards
- Resolve comments (editors/owners only)
- Delete comments
- Real-time notifications to board creator

### 10. Notifications
- Editor access requests
- Comment notifications
- Read/dismiss actions

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh tokens |
| GET | `/api/v1/auth/me` | Get current user |

### Workspaces
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/workspaces` | Create workspace |
| GET | `/api/v1/workspaces/mine` | List user's workspaces |
| GET | `/api/v1/workspaces/search?q=` | Search all workspaces |
| GET | `/api/v1/workspaces/:id` | Get workspace |
| PATCH | `/api/v1/workspaces/:id` | Update workspace |
| DELETE | `/api/v1/workspaces/:id` | Delete workspace |
| POST | `/api/v1/workspaces/:id/join` | Join workspace |
| POST | `/api/v1/workspaces/:id/leave` | Leave workspace |
| GET | `/api/v1/workspaces/:id/members` | List members |
| PATCH | `/api/v1/workspaces/:id/members/:mid` | Change role |
| DELETE | `/api/v1/workspaces/:id/members/:mid` | Remove member |
| POST | `/api/v1/workspaces/:id/editor-requests` | Request editor access |
| GET | `/api/v1/workspaces/:id/editor-requests` | List editor requests |
| POST | `/api/v1/workspaces/:id/editor-requests/:rid/:decision` | Approve/reject |

### Whiteboards
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/workspaces/:id/whiteboards` | List whiteboards |
| POST | `/api/v1/workspaces/:id/whiteboards` | Create whiteboard |
| GET | `/api/v1/whiteboards/:id` | Get whiteboard |
| PATCH | `/api/v1/whiteboards/:id` | Update whiteboard |
| DELETE | `/api/v1/whiteboards/:id` | Delete whiteboard |

### Collaboration
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/whiteboards/:id/versions` | Save version |
| GET | `/api/v1/whiteboards/:id/versions` | List versions |
| POST | `/api/v1/versions/:id/restore` | Restore version |
| POST | `/api/v1/whiteboards/:id/comments` | Add comment |
| GET | `/api/v1/whiteboards/:id/comments` | List comments |
| PATCH | `/api/v1/comments/:id/resolve` | Resolve comment |
| DELETE | `/api/v1/comments/:id` | Delete comment |
| GET | `/api/v1/whiteboards/:id/export/:format` | Export (json/svg/png/pdf) |
| GET | `/api/v1/notifications` | List notifications |
| PATCH | `/api/v1/notifications/:id/read` | Mark as read |
| DELETE | `/api/v1/notifications/:id` | Delete notification |

---

## WebSocket Events

**Connection**: `ws://<host>/ws/whiteboards/:id?token=<jwt>`

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `cursor` | `{type, x, y}` | Cursor position update |
| `board:update` | `{type, objects}` | Board state change (editor/owner only) |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `presence` | `{type, action, user_id, user_name, count, users}` | Join/leave/connected |
| `cursor` | `{type, user_id, user_name, x, y}` | Remote cursor update |
| `board:update` | `{type, user_id, objects}` | Board sync from another user |
| `error` | `{type, message}` | Permission denied etc. |

---

## Database Schema

### MongoDB Collections
- **users**: `{_id, name, email, password_hash, avatar, created_at, updated_at}`
- **workspaces**: `{_id, name, description, owner_id, visibility, password_hash, created_at, updated_at}`
- **workspace_members**: `{_id, workspace_id, user_id, role, joined_at}`
- **whiteboards**: `{_id, workspace_id, title, board_data, created_by, created_at, updated_at}`
- **versions**: `{_id, whiteboard_id, version_number, snapshot, snapshot_hash, message, created_by, created_at}`
- **comments**: `{_id, whiteboard_id, object_id, author_id, text, parent_comment_id, resolved, created_at, updated_at}`
- **notifications**: `{_id, user_id, type, title, message, metadata, read, created_at}`

### Redis Keys
- `whiteboard:{id}` → Set of online user IDs
- `cursor:{id}` → Hash of user_id → "x,y" (60s TTL)

---

## Setup Instructions

### Prerequisites
- Python 3.12+
- Node.js 18+
- MongoDB (Atlas or local)
- Redis (optional — app works without it)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables (`.env` in project root)
```
APP_NAME=Collab Board API
ENVIRONMENT=development
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=collab_board
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=<your-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS_RAW=http://localhost:5173
```

---

## Design Decisions

1. **In-memory fallback**: All repositories work without MongoDB/Redis for development
2. **No Fabric.js**: Custom SVG canvas for lightweight bundle and full control
3. **CSS-only design system**: No Tailwind; CSS custom properties for theming
4. **Lucide React**: Consistent, professional SVG icon set (tree-shakeable)
5. **Version history append-only**: Restoring creates a new version, never overwrites
6. **WebSocket permission enforcement**: Viewers can't send board updates at the protocol level
7. **Cursor TTL**: Redis cursors expire in 60s; WebSocket cursors removed on disconnect

---

## Production Checklist

- [ ] Replace JWT_SECRET_KEY with a strong random value
- [ ] Set ENVIRONMENT=production
- [ ] Configure CORS_ORIGINS_RAW for your domain
- [ ] Set up MongoDB replica set for durability
- [ ] Enable Redis persistence
- [ ] Add rate limiting middleware
- [ ] Set up HTTPS (nginx reverse proxy)
- [ ] Build frontend: `npm run build`
- [ ] Serve frontend via nginx or CDN
- [ ] Add monitoring/logging (Sentry, Datadog, etc.)
