import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.database import Base, engine
from app.routers import admin, auth, community, groups, players, rules, videos
from app.services.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="NightOwls Mythic+ API", version="2.0.0", lifespan=lifespan)
app.include_router(players.router, prefix="/api", tags=["Players"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(groups.router, prefix="/api/groups", tags=["Groups"])
app.include_router(videos.router, prefix="/api/videos", tags=["Videos"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(community.router, prefix="/api/community", tags=["Community"])
app.include_router(rules.router, prefix="/api/rules", tags=["Rules"])

static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))
