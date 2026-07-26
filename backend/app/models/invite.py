from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class InviteToken(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    token: str
    workspace_id: str
    created_by: str
    expires_at: datetime
    revoked: bool = False
    created_at: datetime
