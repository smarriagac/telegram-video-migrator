<div align="center">

<img src="docs/assets/logo.svg" alt="Telegram Video Migrator Logo" width="130" height="130" />

# Telegram Video Migrator (Telegram Hub)

**High-performance technical dashboard and microservice suite for seamless Telegram MTProto video migration, dialog inspection, watermark sanitation, VIP gatekeeper automation, and secure credential orchestration.**

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Telethon](https://img.shields.io/badge/Telethon-MTProto-2CA5E0?style=flat-square&logo=telegram&logoColor=white)](https://telethon.dev)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-7.1-007808?style=flat-square&logo=ffmpeg&logoColor=white)](https://ffmpeg.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)

</div>

---

## 🚀 Key Features

- **Zero-Download Video Migration**: Direct MTProto server-side file reference copying (`InputDocument`) without local disk buffering or bandwidth consumption.
- **Asynchronous FFmpeg Video Sanitizer**: Isolated background processing queue with `delogo` and Gaussian `boxblur` filters to remove burned-in watermarks, text overlays, and channel branding. Controlled via `asyncio.Semaphore(1)` to safeguard VPS resources without slowing down cloud migrations.
- **VIP Gatekeeper & Auto-Kick**: Integrated channel and supergroup access control. Generates single-use expiring invite links, tracks membership deadlines, handles pending join requests, and performs automated or manual expulsion with custom eviction reason logging.
- **Channel & Supergroup Administration**: Full MTProto management for both Broadcast Channels and Discussion Supergroups/Mega-groups.
- **Delta Sync & Deduplication**: Real-time diff detection comparing source and destination channels, allowing granular synchronization of only newly published messages.
- **Clean Cloning Protocol**: Strips "Forwarded from" headers while preserving video captions, entity styles, and metadata.
- **Caption Rules Engine & Media Filters**: Rule-based caption transformations (regex find/replace, tag stripping, watermark text removal) and granular file-type filtering.
- **Interactive MTProto Connection**: Dedicated CLI assistant (`scripts/login_telegram.py`) supporting phone auth, verification codes, and 2FA passwords with multi-account support.
- **AES-256 At-Rest Encryption**: Stores Telegram `api_id`, `api_hash`, and `session_string` encrypted in PostgreSQL with dynamic in-memory decryption and runtime hot-swapping.
- **Role-Based Access Control (RBAC)**: Secure multi-user management with JWT authentication (`ADMIN`, `OPERATOR`, `VIEWER`).
- **Global Skeletons & Responsive High-Density UI**: Tailored dark mode dashboard with consistent loading skeletons across galleries, dialogs, and queues.
- **Strict Clean Architecture**: Decoupled Domain Entities/Ports, Application Use Cases, Infrastructure Adapters, and Presentation layers across both backend and frontend.

---

## 🌐 Microservices & Port Map

| Service | Port | Description | Healthcheck / Endpoint |
|---|---|---|---|
| **Frontend SPA** | `7900` | React 19 + Vite + Tailwind technical dashboard | [http://localhost:7900](http://localhost:7900) |
| **Backend API** | `7901` | FastAPI + Telethon MTProto engine + FFmpeg worker | [http://localhost:7901/docs](http://localhost:7901/docs) |
| **PostgreSQL 18** | `7902` | Persistent store for users, RBAC, jobs, and encrypted secrets | `localhost:7902` (`telegram_migrator_db`) |

---

## ⚡ Quick Start

### 1. Clone & Configure
```bash
git clone https://github.com/smarriagac/telegram-video-migrator.git
cd telegram-video-migrator
cp .env.example .env
```

### 2. Connect Your Real Telegram Account
Follow the comprehensive guide at [docs/TELEGRAM_AUTHENTICATION_GUIDE.md](docs/TELEGRAM_AUTHENTICATION_GUIDE.md):
```bash
# Run the interactive login assistant
python3 scripts/login_telegram.py
```
This script exports your `TELEGRAM_SESSION_STRING` to `.env` or allows you to paste it into the Web UI.

### 3. Launch Services with Docker Compose
```bash
docker compose up -d --build
```

Access the dashboard at **[http://localhost:7900](http://localhost:7900)**.

---

## 🏛️ System Architecture

### Backend Clean Architecture
```text
backend/
├── domain/                    # Pure Python business entities and ports (zero framework dependencies)
│   ├── entities/              # Channel, VideoMessage, MigrationJob, User, TelegramCredential, VideoProcessingJob
│   ├── ports/                 # TelegramGatewayPort, JobRepositoryPort, UserRepositoryPort, CredentialRepositoryPort
│   └── exceptions/            # Domain-specific exception hierarchy
├── application/               # Application Use Cases & Services
│   ├── use_cases/             # MigrateVideosUseCase, ListChannelsUseCase, AuthenticateUserUseCase, etc.
│   ├── services/              # LiveSyncService, VideoProcessingService (FFmpeg background worker)
│   └── dtos/                  # Request/Response data transfer contracts
├── infrastructure/            # Outward adapters & concrete drivers
│   ├── telegram/              # Telethon MTProto gateway adapter & client pool
│   ├── persistence/           # PostgreSQL asyncpg & SQLite aiosqlite repositories
│   └── security/              # Fernet AES-256 encryption & Argon2/PBKDF2 password hashing
└── presentation/              # Inward adapters & HTTP delivery
    └── api/routers/           # Migration, Video Processing, Channels, Gatekeeper, Dialogs, Users, and Settings
```

### Frontend Architecture
- **Framework**: React 19 + TypeScript 5.6 + Vite 6.
- **Styling**: Tailwind CSS with compact high-density dark mode.
- **State Management**: Zustand store (`useMigrationStore`, `useAuthStore`, `useJobsStore`, `useUserStore`).
- **Strict Rule**: Maximum 2 `useState` hooks per view component (reserved strictly for ephemeral UI transitions).

---

## 🎬 Video Sanitizer & Delogo Module

The sanitizer allows stripping burned-in text logos without hurting zero-bandwidth migrations:
1. **Selection**: Click the magic wand icon (**Quitar Marca**) on any video in the channel gallery or lightbox preview.
2. **Preset or Coordinates**: Select presets (`Center`, `Top Right`, `Bottom Right`, `Bottom Bar`, or `Custom Coordinates`).
3. **Filter Pipeline**:
   - `delogo`: Replaces the bounding box by interpolating neighboring pixels.
   - `boxblur`: Applies a Gaussian/box blur overlay over the region.
4. **Queue Lifecycle**: Jobs transition through `PENDING` → `DOWNLOADING` (10%) → `PROCESSING` (50%) → `UPLOADING` (80%) → `COMPLETED` (100%).
5. **Worker Queue**: Supervised in the **Cola FFmpeg Sanitizador** tab in the Jobs view.

---

## 🛡️ VIP Gatekeeper & Access Control

- **Expiring Access Passes**: Generate single-use invite links valid for hours, days, or months.
- **Pending Join Requests**: Approve or reject users requesting access.
- **Auto-Kick Engine**: Flags members whose membership has expired and purges them with logged eviction reasons.
- **Audit Logs**: View membership duration, join dates, and user status.

---

## 📚 Documentation & Specifications

- **[Telegram MTProto Authentication Guide](docs/TELEGRAM_AUTHENTICATION_GUIDE.md)**: End-to-end setup guide for API ID, API Hash, StringSession, and 2FA.
- **[OpenSpec Architecture Specifications](openspec/project.md)**: Living technical specifications and acceptance scenarios:
  - [Telegram Session Auth Spec](openspec/specs/telegram-session-auth/spec.md)
  - [Encrypted Credentials Storage Spec](openspec/specs/encrypted-telegram-credentials-storage/spec.md)
  - [Role-Based Access Control Spec](openspec/specs/role-based-access-control/spec.md)
  - [Clean Video Cloning Spec](openspec/specs/clean-video-cloning/spec.md)

---

## 🧪 Testing

```bash
# Run backend test suite (90 unit & integration tests)
pytest backend/tests -v

# Run frontend typecheck and production build
cd frontend && npm run build
```

---

## 📄 License

MIT © [smarriagac](https://github.com/smarriagac)
