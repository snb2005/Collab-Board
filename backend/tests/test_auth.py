import pytest
from app.core.security import decode_token
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.auth_service import auth_service


@pytest.mark.asyncio
async def test_register_login_and_token_round_trip():
    registered = await auth_service.register(RegisterRequest(name="Test User", email="test@example.com", password="a-safe-password"))
    assert registered.user.email == "test@example.com"
    assert decode_token(registered.access_token, "access") == registered.user.id

    logged_in = await auth_service.login(LoginRequest(email="test@example.com", password="a-safe-password"))
    assert logged_in.user.id == registered.user.id


@pytest.mark.asyncio
async def test_duplicate_email_is_rejected():
    await auth_service.register(RegisterRequest(name="Other User", email="duplicate@example.com", password="a-safe-password"))
    with pytest.raises(ValueError, match="already registered"):
        await auth_service.register(RegisterRequest(name="Other User", email="duplicate@example.com", password="a-safe-password"))

