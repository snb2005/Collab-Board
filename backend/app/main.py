from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request, WebSocket
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.api.workspaces import router as workspace_router
from app.api.whiteboards import router as whiteboard_router
from app.api.collaboration import router as collaboration_router
from app.core.config import settings
from app.db.mongodb import database
from app.db.redis import redis_client
from app.middleware.auth import AuthenticationMiddleware
from app.websocket.handlers import whiteboard_socket
from app.services.invite_service import invite_service

logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await database.connect()
    await redis_client.connect()
    yield
    await redis_client.close()
    await database.close()


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(AuthenticationMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": "Invalid request data", "errors": exc.errors()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.exception("Unhandled application error")
    return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred"})


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "app": settings.app_name}


# ── Invite join endpoint (standalone, not under /workspaces) ──
from typing import Annotated
from fastapi import Depends
from app.api.dependencies import get_current_user
from app.models.user import User


@app.get(f"{settings.api_v1_prefix}/invites/{{token}}/validate")
async def validate_invite(token: str):
    """Validate an invite token and return workspace info (no auth required to peek)."""
    return await invite_service.validate_token(token)


@app.post(f"{settings.api_v1_prefix}/invites/{{token}}/join")
async def join_via_invite(token: str, user: Annotated[User, Depends(get_current_user)]):
    """Join a workspace via invite token."""
    return await invite_service.join_via_invite(token, user.id)


app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(workspace_router, prefix=settings.api_v1_prefix)
app.include_router(whiteboard_router, prefix=settings.api_v1_prefix)
app.include_router(collaboration_router, prefix=settings.api_v1_prefix)


@app.websocket("/ws/whiteboards/{whiteboard_id}")
async def whiteboard_websocket(websocket: WebSocket, whiteboard_id: str):
    await whiteboard_socket(websocket, whiteboard_id)
