from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.security import decode_token


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """Attaches a valid bearer-token subject to the request without enforcing access.

    Individual protected endpoints use the reusable dependency for enforcement.
    This keeps public routes public while making identity available to logging and
    future permission middleware.
    """

    async def dispatch(self, request: Request, call_next):
        request.state.user_id = None
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            try:
                request.state.user_id = decode_token(authorization[7:], "access")
            except ValueError:
                pass
        return await call_next(request)
