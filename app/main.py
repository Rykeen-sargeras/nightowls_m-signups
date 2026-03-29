from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from app.database import engine, Base
from app.routers import players, admin, groups, videos
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="NightOwls Mythic+ API", version="1.0.0", lifespan=lifespan)

# API routes
app.include_router(players.router, prefix="/api", tags=["Players"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(groups.router, prefix="/api/groups", tags=["Groups"])
app.include_router(videos.router, prefix="/api/videos", tags=["Videos"])

# Serve static files (CSS, JS, images)
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Health check (Koyeb pings this to verify the app is alive)
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Serve index.html at root
@app.get("/")
async def serve_index():
    index_path = os.path.join(static_dir, "index.html")
    return FileResponse(index_path)
