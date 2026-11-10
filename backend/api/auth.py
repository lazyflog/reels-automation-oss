import secrets

import bcrypt
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def get_redis():
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def verify_session(request: Request) -> str:
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    r = get_redis()
    try:
        user_id = await r.get(f"session:{token}")
    finally:
        await r.aclose()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return user_id


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    token = secrets.token_urlsafe(32)
    r = get_redis()
    try:
        await r.set(f"session:{token}", str(user.id), ex=settings.session_ttl_seconds)
    finally:
        await r.aclose()

    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
    )
    return {"username": user.username}


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session")
    if token:
        r = get_redis()
        try:
            await r.delete(f"session:{token}")
        finally:
            await r.aclose()
    response.delete_cookie("session")
    return {"ok": True}


@router.get("/me")
async def me(user_id: str = Depends(verify_session), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return {"id": str(user.id), "username": user.username}
