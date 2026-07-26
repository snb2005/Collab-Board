from datetime import datetime, timezone

from fastapi import HTTPException, status
from app.models.whiteboard import Whiteboard
from app.repositories.whiteboard_repository import whiteboard_repository
from app.schemas.whiteboard import WhiteboardCreate, WhiteboardUpdate


class WhiteboardService:
    async def create(self, workspace_id: str, data: WhiteboardCreate, user_id: str) -> Whiteboard:
        return await whiteboard_repository.create(workspace_id, data.title.strip(), user_id)

    async def get(self, whiteboard_id: str) -> Whiteboard:
        board = await whiteboard_repository.find(whiteboard_id)
        if not board:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Whiteboard not found")
        return board

    async def list(self, workspace_id: str) -> list[Whiteboard]:
        return await whiteboard_repository.list_for_workspace(workspace_id)

    async def update(self, board: Whiteboard, data: WhiteboardUpdate) -> Whiteboard:
        changes = data.model_dump(exclude_unset=True)
        if "title" in changes:
            changes["title"] = changes["title"].strip()
        if "board_data" in changes:
            value = changes["board_data"]
            if not isinstance(value.get("objects", []), list):
                raise HTTPException(status_code=422, detail="board_data.objects must be a list")
            changes["board_data"] = {
                "objects": value.get("objects", []),
                "background": value.get("background", "#ffffff"),
                "zoom": value.get("zoom", 1),
            }
        return await whiteboard_repository.update(board.id, changes)

    async def delete(self, board_id: str) -> None:
        await whiteboard_repository.delete(board_id)

    async def lock(self, whiteboard_id: str, user_id: str) -> Whiteboard:
        """Lock a whiteboard. Owner-only check is done at the API layer."""
        board = await self.get(whiteboard_id)
        if board.is_locked:
            raise HTTPException(status_code=400, detail="Board is already locked")
        return await whiteboard_repository.update(whiteboard_id, {
            "is_locked": True,
            "locked_by": user_id,
            "locked_at": datetime.now(timezone.utc),
        })

    async def unlock(self, whiteboard_id: str, user_id: str) -> Whiteboard:
        """Unlock a whiteboard. Owner-only check is done at the API layer."""
        board = await self.get(whiteboard_id)
        if not board.is_locked:
            raise HTTPException(status_code=400, detail="Board is not locked")
        return await whiteboard_repository.update(whiteboard_id, {
            "is_locked": False,
            "locked_by": None,
            "locked_at": None,
        })

    async def require_unlocked(self, whiteboard_id: str) -> Whiteboard:
        """Check that a whiteboard is not locked. Raises 403 if locked."""
        board = await self.get(whiteboard_id)
        if board.is_locked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Board is locked. No edits are allowed.",
            )
        return board


whiteboard_service = WhiteboardService()
