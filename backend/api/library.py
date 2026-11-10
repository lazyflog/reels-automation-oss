from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.prompt_library import PromptLibrary
from api.auth import verify_session

router = APIRouter(prefix="/api/library", tags=["library"])


# ── Pydantic schemas ────────────────────────────────────────

class LibraryItemRequest(BaseModel):
    category: str       # hook | cta | script
    content: str
    persona: Optional[str] = None
    is_active: bool = True


class LibraryItemResponse(BaseModel):
    id: str
    category: str
    content: str
    persona: Optional[str]
    is_active: bool
    created_at: str
    updated_at: str


class LibraryItemUpdate(BaseModel):
    category: Optional[str] = None
    content: Optional[str] = None
    persona: Optional[str] = None
    is_active: Optional[bool] = None


# ── Endpoints ───────────────────────────────────────────────

@router.get("")
async def list_library(
    category: Optional[str] = Query(None),
    persona: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    query = select(PromptLibrary).order_by(PromptLibrary.created_at.desc())
    if category:
        query = query.where(PromptLibrary.category == category)
    if persona:
        query = query.where(
            (PromptLibrary.persona == persona) | (PromptLibrary.persona == None)  # noqa: E711
        )
    result = await db.execute(query)
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": str(item.id),
                "category": item.category,
                "content": item.content,
                "persona": item.persona,
                "is_active": item.is_active,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "updated_at": item.updated_at.isoformat() if item.updated_at else None,
            }
            for item in items
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_library_item(
    req: LibraryItemRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    if req.category not in ("hook", "cta", "script"):
        raise HTTPException(status_code=400, detail="category must be hook, cta, or script")
    item = PromptLibrary(
        category=req.category,
        content=req.content,
        persona=req.persona,
        is_active=req.is_active,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {
        "id": str(item.id),
        "category": item.category,
        "content": item.content,
        "persona": item.persona,
        "is_active": item.is_active,
    }


@router.patch("/{item_id}")
async def update_library_item(
    item_id: str,
    req: LibraryItemUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    result = await db.execute(select(PromptLibrary).where(PromptLibrary.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if req.category is not None:
        if req.category not in ("hook", "cta", "script"):
            raise HTTPException(status_code=400, detail="category must be hook, cta, or script")
        item.category = req.category
    if req.content is not None:
        item.content = req.content
    if req.persona is not None:
        item.persona = req.persona if req.persona else None
    if req.is_active is not None:
        item.is_active = req.is_active
    await db.commit()
    await db.refresh(item)
    return {
        "id": str(item.id),
        "category": item.category,
        "content": item.content,
        "persona": item.persona,
        "is_active": item.is_active,
    }


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_library_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_session),
):
    result = await db.execute(select(PromptLibrary).where(PromptLibrary.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()
