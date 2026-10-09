# Project: Telegram Video Migrator (Telegram Hub)

## Overview
A high-performance technical dashboard and microservice suite to clone/migrate videos between Telegram channels via MTProto reference copying, inspect live Telegram dialogs, manage role-based user access (RBAC), and securely manage Telegram credentials encrypted at rest.

## Stack & Architecture
- **Backend**: Python 3.12+, FastAPI, Telethon (MTProto), PostgreSQL 18 Alpine (`asyncpg`), SQLite (`aiosqlite` for migration idempotency & job event tracking).
  - Architecture: Strict Clean Architecture (Domain Entities/Ports, Application Use Cases, Infrastructure Adapters/Persistence, Presentation API Routers).
  - Encryption: Fernet AES-256 for at-rest credential encryption (`api_id`, `api_hash`, `session_string`).
  - Auth & RBAC: JWT with Argon2/PBKDF2 hashing, roles `ADMIN`, `OPERATOR`, `VIEWER`.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, Radix UI / shadcn primitives.
  - Architecture: Feature-First Clean Architecture (`features/`, `shared/`, `app/`).
  - Constraint: Strictly maximum 2 `useState` hooks per view (domain/page state strictly in Zustand, form data in native `FormData`).
  - Design: High-density, compact dark-mode technical dashboard (Linear/shadcn aesthetics) with custom brand vector identity.
- **Protocol**: MTProto reference-based clean cloning (`InputDocument`), zero disk download, no "Forwarded from" header, preserving original captions, formatting tags, and rate-limiting safeguards.
- **Infrastructure**: Docker Compose multi-container setup with dedicated port assignments:
  - Frontend SPA: Port `7900`
  - Backend API: Port `7901`
  - PostgreSQL 18: Port `7902`
