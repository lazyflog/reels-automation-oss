from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth import verify_session
from database import get_db
from models.persona import Persona

router = APIRouter(prefix="/api/personas", tags=["personas"])


# ── Pydantic schemas ────────────────────────────────────────

class PersonaCreateRequest(BaseModel):
    name: str
    description: str = ""
    speech_style: str = ""
    is_active: bool = True
    sort_order: int = 0


class PersonaUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    speech_style: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


# ── Endpoints ───────────────────────────────────────────────

@router.get("")
async def list_personas(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    q = select(Persona).order_by(Persona.sort_order.asc(), Persona.created_at.asc())
    if active_only:
        q = q.where(Persona.is_active == True)  # noqa: E712
    result = await db.execute(q)
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "speech_style": p.speech_style,
                "is_active": p.is_active,
                "sort_order": p.sort_order,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in items
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_persona(
    req: PersonaCreateRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    existing = await db.execute(select(Persona).where(Persona.name == req.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Persona name is already registered")

    persona = Persona(
        name=req.name,
        description=req.description,
        speech_style=req.speech_style,
        is_active=req.is_active,
        sort_order=req.sort_order,
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return {
        "id": persona.id,
        "name": persona.name,
        "description": persona.description,
        "speech_style": persona.speech_style,
        "is_active": persona.is_active,
        "sort_order": persona.sort_order,
    }


@router.patch("/{persona_id}")
async def update_persona(
    persona_id: str,
    req: PersonaUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    result = await db.execute(select(Persona).where(Persona.id == persona_id))
    persona = result.scalar_one_or_none()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    if req.name is not None:
        persona.name = req.name
    if req.description is not None:
        persona.description = req.description
    if req.speech_style is not None:
        persona.speech_style = req.speech_style
    if req.is_active is not None:
        persona.is_active = req.is_active
    if req.sort_order is not None:
        persona.sort_order = req.sort_order

    await db.commit()
    await db.refresh(persona)
    return {
        "id": persona.id,
        "name": persona.name,
        "description": persona.description,
        "speech_style": persona.speech_style,
        "is_active": persona.is_active,
        "sort_order": persona.sort_order,
    }


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_persona(
    persona_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    result = await db.execute(select(Persona).where(Persona.id == persona_id))
    persona = result.scalar_one_or_none()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")
    await db.delete(persona)
    await db.commit()
