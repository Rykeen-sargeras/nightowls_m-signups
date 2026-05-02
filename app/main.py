from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from app.database import engine, Base
from app.routers import players, admin, groups, videos, auth, community, content, attendance
from app.services.scheduler import start_scheduler, stop_scheduler
import os
import logging

logging.basicConfig(level=logging.INFO)


async def ensure_users_schema():
    async with engine.begin() as conn:
        # Create any entirely missing tables first.
        await conn.run_sync(Base.metadata.create_all)

        # Repair legacy users table shapes.
        await conn.execute(text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
            ) THEN
                -- Legacy schema used email instead of username.
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username'
                ) THEN
                    ALTER TABLE users RENAME COLUMN email TO username;
                END IF;

                -- Legacy schema may have stored plain password instead of password_hash.
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password'
                ) AND NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'
                ) THEN
                    ALTER TABLE users RENAME COLUMN password TO password_hash;
                END IF;
            END IF;
        END $$;
        """))

        # Add any missing modern columns.
        await conn.execute(text("""
            ALTER TABLE IF EXISTS users
            ADD COLUMN IF NOT EXISTS username VARCHAR(50),
            ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
            ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
        """))

        # Backfill username for any legacy/null rows before NOT NULL / unique constraints.
        await conn.execute(text("""
            UPDATE users
            SET username = CONCAT('user_', id)
            WHERE username IS NULL OR BTRIM(username) = ''
        """))

        # Backfill password_hash placeholder if needed. These users should reset their password.
        await conn.execute(text("""
            UPDATE users
            SET password_hash = 'RESET_REQUIRED'
            WHERE password_hash IS NULL OR BTRIM(password_hash) = ''
        """))

        await conn.execute(text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
            ) THEN
                BEGIN
                    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
                EXCEPTION WHEN others THEN
                    NULL;
                END;

                BEGIN
                    ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
                EXCEPTION WHEN others THEN
                    NULL;
                END;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE schemaname = 'public' AND indexname = 'ix_users_username'
                ) THEN
                    CREATE INDEX ix_users_username ON users (username);
                END IF;

                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'uq_users_username'
                ) THEN
                    BEGIN
                        ALTER TABLE users ADD CONSTRAINT uq_users_username UNIQUE (username);
                    EXCEPTION WHEN duplicate_table OR duplicate_object THEN
                        NULL;
                    END;
                END IF;
            END IF;
        END $$;
        """))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add new columns if they don't exist
        await conn.execute(text("""
            ALTER TABLE IF EXISTS players
            ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) DEFAULT 'mythicplus',
            ADD COLUMN IF NOT EXISTS signup_status VARCHAR(20) DEFAULT 'available'
        """))
        await conn.execute(text("""
            ALTER TABLE IF EXISTS archived_players
            ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) DEFAULT 'mythicplus',
            ADD COLUMN IF NOT EXISTS signup_status VARCHAR(20) DEFAULT 'available'
        """))
        # Drop old unique constraint on username (allow same name for different event types)
        await conn.execute(text("""
            DO $$
            BEGIN
                -- Drop unique index if it exists
                IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ix_players_username' AND schemaname = 'public') THEN
                    DROP INDEX ix_players_username;
                END IF;
                -- Drop any unique constraint on username alone
                IF EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'players_username_key' AND conrelid = 'players'::regclass
                ) THEN
                    ALTER TABLE players DROP CONSTRAINT players_username_key;
                END IF;
                -- Add composite unique constraint if it doesn't exist
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_player_username_event'
                ) THEN
                    ALTER TABLE players ADD CONSTRAINT uq_player_username_event UNIQUE (username, event_type);
                END IF;
                -- Re-create a non-unique index on username for queries
                IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ix_players_username_lookup' AND schemaname = 'public') THEN
                    CREATE INDEX ix_players_username_lookup ON players (username);
                END IF;
            END $$;
        """))
    await ensure_users_schema()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="NightOwls Mythic+ API", version="3.0.0", lifespan=lifespan)


class ForceHTTPSRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if response.status_code in (301, 302, 307, 308):
            location = response.headers.get("location", "")
            if location.startswith("http://") and request.headers.get("x-forwarded-proto") == "https":
                response.headers["location"] = location.replace("http://", "https://", 1)
        return response


app.add_middleware(ForceHTTPSRedirectMiddleware)

# API routes
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(players.router, prefix="/api", tags=["Players"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(groups.router, prefix="/api/groups", tags=["Groups"])
app.include_router(videos.router, prefix="/api/videos", tags=["Videos"])
app.include_router(community.router, prefix="/api/community", tags=["Community"])
app.include_router(content.router, prefix="/api/content", tags=["Content"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])

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
