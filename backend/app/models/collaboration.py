from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class Version(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id"); whiteboard_id: str; version_number: int; snapshot: dict; snapshot_hash: str; message: str; created_by: str; created_at: datetime
class Comment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id"); whiteboard_id: str; object_id: str | None = None; author_id: str; text: str; parent_comment_id: str | None = None; resolved: bool = False; created_at: datetime; updated_at: datetime
class Notification(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id"); user_id: str; type: str; title: str; message: str; metadata: dict = {}; read: bool = False; created_at: datetime
