from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.voice import Voice
from api.auth import verify_session

router = APIRouter(prefix="/api/voices", tags=["voices"])


# ── Pydantic schemas ────────────────────────────────────────

class VoiceCreateRequest(BaseModel):
    id: str                    # ElevenLabs voice ID
    name: str
    is_active: bool = True


class VoiceUpdateRequest(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


# ── Endpoints ───────────────────────────────────────────────

@router.get("")
async def list_voices(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    result = await db.execute(select(Voice).order_by(Voice.created_at.asc()))
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": v.id,
                "name": v.name,
                "is_active": v.is_active,
                "created_at": v.created_at.isoformat() if v.created_at else None,
                "updated_at": v.updated_at.isoformat() if v.updated_at else None,
            }
            for v in items
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_voice(
    req: VoiceCreateRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    existing = await db.execute(select(Voice).where(Voice.id == req.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Voice ID is already registered")

    voice = Voice(id=req.id, name=req.name, is_active=req.is_active)
    db.add(voice)
    await db.commit()
    await db.refresh(voice)
    return {"id": voice.id, "name": voice.name, "is_active": voice.is_active}


@router.patch("/{voice_id}")
async def update_voice(
    voice_id: str,
    req: VoiceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    result = await db.execute(select(Voice).where(Voice.id == voice_id))
    voice = result.scalar_one_or_none()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")

    if req.name is not None:
        voice.name = req.name
    if req.is_active is not None:
        voice.is_active = req.is_active

    await db.commit()
    await db.refresh(voice)
    return {"id": voice.id, "name": voice.name, "is_active": voice.is_active}


@router.delete("/{voice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_voice(
    voice_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    result = await db.execute(select(Voice).where(Voice.id == voice_id))
    voice = result.scalar_one_or_none()
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    await db.delete(voice)
    await db.commit()
