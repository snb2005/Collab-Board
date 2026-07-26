# Collab Board

A collaborative whiteboard application. Phases 1–5 deliver identity, role-based workspaces, persisted drawing boards, live collaboration, version history, comments, notifications, and export.

## Structure

- `frontend/` — React, TypeScript, Vite frontend with landing, auth, dashboard, and protected routing.
- `backend/app/api` — HTTP controllers only.
- `backend/app/services` — authentication business logic.
- `backend/app/repositories` — persistence boundary, ready for future modules.
- `backend/app/db` — MongoDB and Redis clients.
- `Reference files/` — supplied requirements and architecture notes.

## Run locally

1. Copy `.env.example` to `.env` and replace `JWT_SECRET_KEY`.
2. Start dependencies with `docker compose up mongodb redis`.
3. Backend: `cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/uvicorn app.main:app --reload`.
4. Frontend: `cd frontend && npm install && npm run dev`.

The frontend runs at `http://localhost:5173`; Swagger is at `http://localhost:8000/docs`.

## Current API

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me` (Bearer access token)
- `GET /health`

Workspace APIs require a Bearer access token:

- `POST /api/v1/workspaces`, `GET /api/v1/workspaces/mine`, `GET /api/v1/workspaces/search`
- `GET`, `PATCH`, and `DELETE /api/v1/workspaces/{workspace_id}`
- `POST /api/v1/workspaces/{workspace_id}/join` and `/leave`
- `GET /api/v1/workspaces/{workspace_id}/members`
- `PATCH` and `DELETE /api/v1/workspaces/{workspace_id}/members/{member_id}`

Whiteboards require workspace membership:

- `GET`/`POST /api/v1/workspaces/{workspace_id}/whiteboards`
- `GET`/`PATCH`/`DELETE /api/v1/whiteboards/{whiteboard_id}`
- WebSocket: `/ws/whiteboards/{whiteboard_id}?token=<access-token>`

For development without MongoDB, the API has a deliberately visible in-memory fallback so the auth, workspace, and whiteboard flows are usable. Run MongoDB for durable data. Redis powers presence when available.
