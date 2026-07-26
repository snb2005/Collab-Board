from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class VersionCreate(BaseModel):
    message: str = Field(default="", max_length=250)


class VersionResponse(BaseModel):
    id: str
    version_number: int
    snapshot_hash: str
    message: str
    created_by: str
    created_by_name: str = "Unknown"
    created_at: datetime


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    object_id: str | None = None
    parent_comment_id: str | None = None


class CommentResponse(BaseModel):
    id: str
    whiteboard_id: str
    object_id: str | None
    author_id: str
    text: str
    parent_comment_id: str | None
    resolved: bool
    created_at: datetime
    updated_at: datetime


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    metadata: dict
    read: bool
    created_at: datetime


class EditorAccessRequestResponse(BaseModel):
    id: str
    workspace_id: str
    requester_id: str
    requester_name: str = "Unknown"
    requester_email: str = ""
    status: str
    created_at: datetime
    handled_by: str | None = None
    handled_at: datetime | None = None


class InviteCreateRequest(BaseModel):
    expiration: Literal["1h", "24h", "7d"]


class InviteResponse(BaseModel):
    id: str
    token: str
    workspace_id: str
    created_by: str
    expires_at: datetime
    revoked: bool = False
    created_at: datetime
