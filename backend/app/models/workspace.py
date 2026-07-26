from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

WorkspaceRole = Literal["owner", "editor", "viewer"]
WorkspaceVisibility = Literal["public", "private"]


class Workspace(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: str
    description: str = ""
    owner_id: str
    visibility: WorkspaceVisibility
    password_hash: str | None = None
    created_at: datetime
    updated_at: datetime


class WorkspaceMember(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    workspace_id: str
    user_id: str
    role: WorkspaceRole
    joined_at: datetime
