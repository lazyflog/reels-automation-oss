from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime

from database import Base


class Voice(Base):
    __tablename__ = "voices"

    id = Column(String, primary_key=True)          # ElevenLabs voice ID
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
