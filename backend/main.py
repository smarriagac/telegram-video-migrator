from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.presentation.api.routers.channels import router as channels_router
from backend.presentation.api.routers.jobs import router as jobs_router
from backend.presentation.api.routers.dialogs import router as dialogs_router
from backend.presentation.api.routers.auth import router as auth_router
from backend.presentation.api.routers.audit import router as audit_router
from backend.presentation.api.routers.settings_credentials import router as credentials_router
from backend.presentation.api.routers.analytics import router as analytics_router
from backend.presentation.api.routers.sync import router as sync_router
from backend.presentation.api.routers.billing import router as billing_router
from backend.presentation.dependencies import get_job_repository, get_postgres_repository

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("telegram_migrator")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema for jobs
    repo = await get_job_repository()
    if hasattr(repo, "initialize_schema"):
        await repo.initialize_schema()

    # Reconcile orphaned jobs on startup (zombies from previous crashes or container restarts)
    try:
        reconciled_count = await repo.reconcile_orphaned_jobs()
        if reconciled_count > 0:
            logger.info(f"Startup reconciliation: marked {reconciled_count} orphaned RUNNING jobs as PAUSED.")
    except Exception as e:
        logger.warning(f"Failed to reconcile orphaned jobs during startup: {e}")

    # Initialize PostgreSQL schema for Users, Roles, and Accounts
    pg_repo = await get_postgres_repository()
    if hasattr(pg_repo, "initialize_schema"):
        await pg_repo.initialize_schema()

    # Initialize Telegram Client Pool across all active accounts
    from backend.presentation.dependencies import refresh_telegram_client_pool, get_live_sync_service
    try:
        await refresh_telegram_client_pool()
        logger.info("Telegram Client Pool initialized successfully.")
    except Exception as e:
        logger.warning(f"Failed to initialize Telegram Client Pool during startup: {e}")

    # Initialize Live MTProto Auto-Sync Service
    try:
        live_sync = await get_live_sync_service()
        await live_sync.start()
        logger.info("LiveSyncService started successfully.")
    except Exception as e:
        logger.warning(f"Failed to start LiveSyncService during startup: {e}")

    logger.info("Telegram Video Migrator Backend initialized successfully.")
    yield

    try:
        live_sync = await get_live_sync_service()
        await live_sync.stop()
    except Exception:
        pass


app = FastAPI(
    title="Telegram Video Migrator API",
    description="Backend API for high-speed reference-based Telegram video migration and Hub admin.",
    version="1.1.0",
    lifespan=lifespan,
)

# Configure CORS for local development and dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register presentation routers
app.include_router(auth_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(credentials_router, prefix="/api")
app.include_router(channels_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(dialogs_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(sync_router, prefix="/api")
app.include_router(billing_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "telegram-video-migrator"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
