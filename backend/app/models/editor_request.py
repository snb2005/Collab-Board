from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EditorRequestStatus = Literal["pending", "approved", "rejected"]


class EditorAccessRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    workspace_id: str
    requester_id: str
    status: EditorRequestStatus = "pending"
    created_at: datetime
    handled_by: str | None = None
    handled_at: datetime | None = None
