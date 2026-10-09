from backend.presentation.api.routers.channels import router as channels_router
from backend.presentation.api.routers.jobs import router as jobs_router
from backend.presentation.api.routers.dialogs import router as dialogs_router
from backend.presentation.api.routers.auth import router as auth_router
from backend.presentation.api.routers.settings_credentials import router as credentials_router

__all__ = [
    "channels_router",
    "jobs_router",
    "dialogs_router",
    "auth_router",
    "credentials_router",
]
