from datetime import datetime
from pydantic import BaseModel, Field


class WhiteboardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class WhiteboardUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    board_data: dict | None = None


class WhiteboardResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    board_data: dict
    created_by: str
    is_locked: bool = False
    locked_by: str | None = None
    locked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
