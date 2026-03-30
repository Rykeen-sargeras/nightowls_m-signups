from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, func
from app.database import Base


class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    wow_class = Column(String, nullable=False)
    specialization = Column(String, nullable=False)
    role = Column(String, nullable=False)
    group_index = Column(String, default="")
    signed_up_at = Column(DateTime(timezone=True), server_default=func.now())


class EventState(Base):
    __tablename__ = "event_state"
    id = Column(Integer, primary_key=True, default=1)
    is_locked = Column(Boolean, default=False)
    locked_at = Column(DateTime(timezone=True), nullable=True)


class ArchivedPlayer(Base):
    __tablename__ = "archived_players"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False)
    wow_class = Column(String, nullable=False)
    specialization = Column(String, nullable=False)
    role = Column(String, nullable=False)
    group_index = Column(String, default="")
    event_date = Column(DateTime(timezone=True), server_default=func.now())


class Video(Base):
    __tablename__ = "videos"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False, index=True)
    boss_name = Column(String, nullable=False)
    description = Column(Text, default="")
    youtube_url = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ========== NEW: User Auth System ==========

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ========== NEW: Community Profiles ==========

class MemberProfile(Base):
    __tablename__ = "member_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, unique=True, index=True)
    display_name = Column(String(50), nullable=False)
    main_class = Column(String(50), default="")
    guild_rank = Column(String(50), default="")
    bio = Column(Text, default="")
    profile_image = Column(Text, default="")  # base64 encoded
    seed = Column(Integer, default=100)  # lower = first in directory
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ========== NEW: Rules / Site Content ==========

class SiteContent(Base):
    __tablename__ = "site_content"
    id = Column(Integer, primary_key=True, index=True)
    content_key = Column(String(50), unique=True, nullable=False, index=True)  # e.g. "rules", "community_banner", "rules_banner"
    content_value = Column(Text, default="")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
