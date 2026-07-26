import pytest
from fastapi import HTTPException

from app.schemas.auth import RegisterRequest
from app.schemas.workspace import WorkspaceCreate
from app.services.auth_service import auth_service
from app.services.workspace_service import workspace_service


@pytest.mark.asyncio
async def test_public_workspace_create_search_and_join():
    owner = await auth_service.register(RegisterRequest(name="Workspace Owner", email="workspace-owner@example.com", password="a-safe-password"))
    workspace = await workspace_service.create(WorkspaceCreate(name="Product planning", description="A public planning space", visibility="public"), owner.user.id)
    assert workspace.role == "owner"

    guest = await auth_service.register(RegisterRequest(name="Workspace Guest", email="workspace-guest@example.com", password="a-safe-password"))
    results = await workspace_service.search("planning", guest.user.id)
    assert any(item.id == workspace.id for item in results)
    joined = await workspace_service.join(await workspace_service.get(workspace.id), guest.user.id, None)
    assert joined.role == "editor"
    assert joined.member_count == 2


@pytest.mark.asyncio
async def test_private_workspace_requires_correct_password():
    owner = await auth_service.register(RegisterRequest(name="Private Owner", email="private-owner@example.com", password="a-safe-password"))
    workspace = await workspace_service.create(WorkspaceCreate(name="Private planning", visibility="private", password="team-pass"), owner.user.id)
    guest = await auth_service.register(RegisterRequest(name="Private Guest", email="private-guest@example.com", password="a-safe-password"))
    with pytest.raises(HTTPException, match="password"):
        await workspace_service.join(await workspace_service.get(workspace.id), guest.user.id, "wrong-pass")
    joined = await workspace_service.join(await workspace_service.get(workspace.id), guest.user.id, "team-pass")
    assert joined.role == "viewer"
