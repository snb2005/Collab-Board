# Collab Board handoff — Phases 1 to 5

## What runs now

The application has a React/Vite frontend and FastAPI backend. The backend supports MongoDB-backed registration/login, workspaces and RBAC, persisted whiteboards, real-time board rooms, versions, comments, notifications, and exports.

| Area | Delivered |
| --- | --- |
| Identity | Argon2 passwords, access/refresh JWTs, `/auth/me`, protected frontend routes |
| Workspaces | Public/private creation, optional passwords, search/join/leave, member roles, RBAC |
| Whiteboards | Workspace-scoped CRUD, JSON board persistence, drawing UI and save/load |
| Real time | Authenticated board WebSockets, rooms, drawing sync, cursors, presence count |
| Collaboration | Version snapshots/restores, threaded comments, notifications, JSON/SVG/PNG/PDF exports |

## Local URLs

- Frontend: `http://localhost:5173`
- Backend/API docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

## Run locally

```bash
# Terminal 1
cd backend
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal 2
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

MongoDB is configured through the ignored root `.env`, populated from the provided `cred.txt`; credentials are not committed or reproduced here. MongoDB Atlas connectivity and a persisted register/login flow were verified. Redis remains optional locally; it adds durable presence state when available.

## Verify

```bash
cd backend && .venv/bin/pytest -q
cd frontend && npm run build
```

Current verification result: 5 backend tests pass, frontend production build succeeds, local frontend/backend return HTTP 200, and MongoDB-backed registration/login succeeds.

## Next phase

Phase 6 adds rate limiting, expanded test coverage, production deployment, monitoring, and UI polish.
