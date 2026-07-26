from datetime import timedelta

from app.core.config import settings
from app.core.security import create_token, decode_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import user_repository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse


class AuthService:
    async def register(self, data: RegisterRequest) -> TokenResponse:
        user = await user_repository.create(data.name, str(data.email), hash_password(data.password))
        return self._tokens_for(user)

    async def login(self, data: LoginRequest) -> TokenResponse:
        user = await user_repository.find_by_email(str(data.email))
        if not user or not verify_password(data.password, user.password_hash):
            raise PermissionError("Invalid email or password")
        return self._tokens_for(user)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        user_id = decode_token(refresh_token, "refresh")
        user = await user_repository.find_by_id(user_id)
        if not user:
            raise ValueError("User no longer exists")
        return self._tokens_for(user)

    async def get_user(self, user_id: str) -> User:
        user = await user_repository.find_by_id(user_id)
        if not user:
            raise LookupError("User not found")
        return user

    @staticmethod
    def response_user(user: User) -> UserResponse:
        return UserResponse(id=user.id, name=user.name, email=user.email, avatar=user.avatar)

    def _tokens_for(self, user: User) -> TokenResponse:
        return TokenResponse(
            access_token=create_token(user.id, "access", timedelta(minutes=settings.access_token_expire_minutes)),
            refresh_token=create_token(user.id, "refresh", timedelta(days=settings.refresh_token_expire_days)),
            user=self.response_user(user),
        )


auth_service = AuthService()
