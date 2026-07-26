from datetime import datetime, timezone
from uuid import uuid4

from pymongo.errors import DuplicateKeyError

from app.db.mongodb import database
from app.models.user import User


class UserRepository:
    _memory: dict[str, dict] = {}

    async def find_by_email(self, email: str) -> User | None:
        normalized = email.lower()
        if database.db is not None:
            record = await database.db.users.find_one({"email": normalized})
        else:
            record = next((item for item in self._memory.values() if item["email"] == normalized), None)
        return self._to_user(record) if record else None

    async def find_by_id(self, user_id: str) -> User | None:
        if database.db is not None:
            record = await database.db.users.find_one({"_id": user_id})
        else:
            record = self._memory.get(user_id)
        return self._to_user(record) if record else None

    async def create(self, name: str, email: str, password_hash: str) -> User:
        now = datetime.now(timezone.utc)
        record = {"_id": str(uuid4()), "name": name.strip(), "email": email.lower(), "password_hash": password_hash,
                  "avatar": None, "created_at": now, "updated_at": now}
        if database.db is not None:
            try:
                await database.db.users.insert_one(record)
            except DuplicateKeyError as exc:
                raise ValueError("Email is already registered") from exc
        else:
            if await self.find_by_email(email):
                raise ValueError("Email is already registered")
            self._memory[record["_id"]] = record
        return self._to_user(record)

    @staticmethod
    def _to_user(record: dict) -> User:
        return User.model_validate(record)


user_repository = UserRepository()
