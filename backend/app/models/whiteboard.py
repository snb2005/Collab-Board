from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Whiteboard(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    workspace_id: str
    title: str
    board_data: dict
    created_by: str
    is_locked: bool = False
    locked_by: str | None = None
    locked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
