from sqlalchemy import Column, Integer, String, DateTime, Boolean, func, Text, ForeignKey
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
    description = Column(String, default="")
    youtube_url = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CommunityMember(Base):
    __tablename__ = "community_members"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    main_class = Column(String, nullable=False)
    guild_rank = Column(String, nullable=True)
    bio = Column(Text, default="")
    image_path = Column(String, nullable=True)
    position_seed = Column(Integer, default=9999, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SiteSetting(Base):
    __tablename__ = "site_settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
