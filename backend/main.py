from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.presentation.api.routers.channels import router as channels_router
from backend.presentation.api.routers.jobs import router as jobs_router
from backend.presentation.api.routers.dialogs import router as dialogs_router
from backend.presentation.dependencies import get_job_repository

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("telegram_migrator")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema on startup
    repo = await get_job_repository()
    if hasattr(repo, "initialize_schema"):
        await repo.initialize_schema()
    logger.info("Telegram Video Migrator Backend initialized successfully.")
    yield


app = FastAPI(
    title="Telegram Video Migrator API",
    description="Backend API for high-speed reference-based Telegram video migration.",
    version="1.0.0",
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
app.include_router(channels_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(dialogs_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "telegram-video-migrator"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
