from fastapi import FastAPI
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from app.database import engine, Base
from app.routers import players, admin, groups, videos, auth, community, content
from app.services.scheduler import start_scheduler, stop_scheduler
import os
import logging

logging.basicConfig(level=logging.INFO)


async def ensure_users_schema():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE IF EXISTS users
            ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128),
            ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
        """))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await ensure_users_schema()
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(title="NightOwls Mythic+ API", version="2.0.0", lifespan=lifespan)

# API routes
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(players.router, prefix="/api", tags=["Players"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(groups.router, prefix="/api/groups", tags=["Groups"])
app.include_router(videos.router, prefix="/api/videos", tags=["Videos"])
app.include_router(community.router, prefix="/api/community", tags=["Community"])
app.include_router(content.router, prefix="/api/content", tags=["Content"])

# Serve static files
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/")
async def serve_index():
    index_path = os.path.join(static_dir, "index.html")
    return FileResponse(index_path)
