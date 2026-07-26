from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    name: str
    email: EmailStr
    password_hash: str
    avatar: str | None = None
    created_at: datetime
    updated_at: datetime
