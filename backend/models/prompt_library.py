import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class PromptLibrary(Base):
    __tablename__ = "prompt_library"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(String, nullable=False)   # "hook" | "cta" | "script"
    content = Column(Text, nullable=False)
    persona = Column(String, nullable=True)      # null means shared across all personas
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
