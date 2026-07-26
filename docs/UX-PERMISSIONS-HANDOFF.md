# UX and permissions handoff

## Delivered

- Root `.env` is loaded reliably by the backend, and MongoDB-backed login was previously verified.
- Public workspace joins now grant `editor`; private workspace joins require a workspace code and grant `viewer`.
- The backend role set is `owner`, `editor`, and `viewer`. Viewer write attempts remain rejected by the whiteboard and collaboration APIs.
- Private viewers can request editor access; owners can retrieve requests and approve or reject them via the new workspace request endpoints.
- Workspace search includes public and private workspaces, with the response visibility preserved for the UI.
- Native browser `prompt()` and `confirm()` use has been removed. A shared `FeedbackProvider` supplies toast, input-dialog, and confirmation-dialog behavior.
- Whiteboard viewer mode remains backend-enforced; frontend tools should be disabled using the board’s workspace role before production release.

## New workspace endpoints

- `POST /workspaces/{workspace_id}/editor-requests`
- `GET /workspaces/{workspace_id}/editor-requests` (owner)
- `POST /workspaces/{workspace_id}/editor-requests/{request_id}/approve` (owner)
- `POST /workspaces/{workspace_id}/editor-requests/{request_id}/reject` (owner)

## Verification

- `pytest -q`: 5 passing tests
- `npm run build`: successful
- Browser-alert search: no native `alert`, `confirm`, or `prompt` calls remain

The local services are restarted at `http://127.0.0.1:8000` and `http://127.0.0.1:5173`.
