# Project: Telegram Video Migrator

## Overview
A web-based dashboard and backend worker to clone/migrate videos between Telegram channels owned by the user.

## Stack & Architecture
- **Backend**: Python 3.12+, FastAPI (latest, Pydantic v2), Telethon (MTProto), SQLite (idempotency & job tracking).
  - Architecture: Clean Architecture (Domain, Application/Use Cases, Infrastructure, Presentation/API).
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand.
  - Architecture: Feature-First Clean Architecture.
  - Constraint: Max 2 `useState` per view (ephemeral UI state only; domain/page state strictly in Zustand).
- **Protocol**: MTProto reference-based clean cloning (`send_file`/`InputDocument`), no server downloads/re-uploads, no "Forwarded from" header, preserving caption and formatting tags.
