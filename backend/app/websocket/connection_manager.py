from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # whiteboard_id -> { user_id -> WebSocket }
        self.rooms: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        # whiteboard_id -> { user_id -> {user_name, role} }
        self.user_meta: dict[str, dict[str, dict]] = defaultdict(dict)

    async def connect(self, whiteboard_id: str, user_id: str, socket: WebSocket, user_name: str = "", role: str = "viewer") -> None:
        await socket.accept()
        self.rooms[whiteboard_id][user_id] = socket
        self.user_meta[whiteboard_id][user_id] = {"user_name": user_name, "role": role}

    def disconnect(self, whiteboard_id: str, user_id: str) -> None:
        self.rooms[whiteboard_id].pop(user_id, None)
        self.user_meta[whiteboard_id].pop(user_id, None)
        if not self.rooms[whiteboard_id]:
            self.rooms.pop(whiteboard_id, None)
            self.user_meta.pop(whiteboard_id, None)

    async def broadcast(self, whiteboard_id: str, event: dict, exclude_user_id: str | None = None) -> None:
        stale = []
        for user_id, socket in self.rooms.get(whiteboard_id, {}).items():
            if user_id == exclude_user_id:
                continue
            try:
                await socket.send_json(event)
            except Exception:
                stale.append(user_id)
        for user_id in stale:
            self.disconnect(whiteboard_id, user_id)

    def connected_count(self, whiteboard_id: str) -> int:
        return len(self.rooms.get(whiteboard_id, {}))

    def connected_users(self, whiteboard_id: str) -> list[dict]:
        """Return list of currently connected users with their metadata."""
        result = []
        for user_id, meta in self.user_meta.get(whiteboard_id, {}).items():
            result.append({
                "user_id": user_id,
                "user_name": meta.get("user_name", user_id[:6]),
                "role": meta.get("role", "viewer"),
            })
        return result


connection_manager = ConnectionManager()
