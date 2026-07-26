import pytest

from app.schemas.auth import RegisterRequest
from app.schemas.whiteboard import WhiteboardCreate, WhiteboardUpdate
from app.schemas.workspace import WorkspaceCreate
from app.services.auth_service import auth_service
from app.services.whiteboard_service import whiteboard_service
from app.services.workspace_service import workspace_service


@pytest.mark.asyncio
async def test_whiteboard_create_save_load_and_delete():
    owner = await auth_service.register(RegisterRequest(name="Board Owner", email="board-owner@example.com", password="a-safe-password"))
    workspace = await workspace_service.create(WorkspaceCreate(name="Board workspace", password="board-code"), owner.user.id)
    board = await whiteboard_service.create(workspace.id, WhiteboardCreate(title="Roadmap"), owner.user.id)
    assert board.board_data["objects"] == []
    saved = await whiteboard_service.update(board, WhiteboardUpdate(board_data={"objects": [{"type": "rect", "x": 12}], "background": "#f0f0f0", "zoom": 1.2}))
    assert saved.board_data["objects"][0]["type"] == "rect"
    assert saved.board_data["zoom"] == 1.2
    assert len(await whiteboard_service.list(workspace.id)) == 1
    await whiteboard_service.delete(board.id)
    assert await whiteboard_service.list(workspace.id) == []
