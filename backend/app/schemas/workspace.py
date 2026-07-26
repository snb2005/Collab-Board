from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.workspace import WorkspaceRole, WorkspaceVisibility


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default="", max_length=500)
    visibility: WorkspaceVisibility = "private"
    password: str | None = Field(default=None, min_length=4, max_length=128)

    @model_validator(mode="after")
    def password_is_only_for_private_workspaces(self):
        if self.visibility == "private" and not self.password:
            raise ValueError("A workspace code is required for private workspaces")
        if self.visibility == "public" and self.password:
            raise ValueError("Public workspaces cannot have a password")
        return self


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    visibility: WorkspaceVisibility | None = None
    password: str | None = Field(default=None, min_length=4, max_length=128)
    clear_password: bool = False


class JoinWorkspaceRequest(BaseModel):
    password: str | None = Field(default=None, max_length=128)


class MemberRoleUpdate(BaseModel):
    role: Literal["editor", "viewer"]


class WorkspaceMemberResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: WorkspaceRole
    joined_at: datetime


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: str
    owner_id: str
    visibility: WorkspaceVisibility
    is_password_protected: bool
    role: WorkspaceRole | None = None
    member_count: int = 0
    created_at: datetime
    updated_at: datetime
