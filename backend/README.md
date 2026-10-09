# Telegram Video Migrator - Backend

Backend service implementing Clean Architecture for Telegram video migration.

## Architecture Layers
- `domain`: Pure business entities, value objects, exceptions, and port interfaces.
- `application`: Use cases and orchestration logic.
- `infrastructure`: External adapters (Telethon MTProto client, aiosqlite repository).
- `presentation`: FastAPI routers, SSE endpoints, and dependencies.
