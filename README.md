<div align="center">

<img src="docs/assets/logo.svg" alt="Telegram Video Migrator Logo" width="130" height="130" />

# Telegram Video Migrator (Telegram Hub)

**High-performance technical dashboard and microservice suite for seamless Telegram MTProto video migration, dialog inspection, and secure credential orchestration.**

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Telethon](https://img.shields.io/badge/Telethon-MTProto-2CA5E0?style=flat-square&logo=telegram&logoColor=white)](https://telethon.dev)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)

</div>

---

## 🚀 Key Features

- **Zero-Download Video Migration**: Direct MTProto server-side file reference copying (`InputDocument`) without local disk buffering or bandwidth consumption.
- **Clean Cloning Protocol**: Strips "Forwarded from" headers while preserving video captions, entity styles, and metadata.
- **Interactive MTProto Connection**: Dedicated CLI assistant (`scripts/login_telegram.py`) supporting phone auth, verification codes, and 2FA passwords.
- **AES-256 At-Rest Encryption**: Stores Telegram `api_id`, `api_hash`, and `session_string` encrypted in PostgreSQL with dynamic in-memory decryption and runtime hot-swapping.
- **Role-Based Access Control (RBAC)**: Secure multi-user management with JWT authentication (`ADMIN`, `OPERATOR`, `VIEWER`).
- **Live Dialogs & Message Inspection**: Inspect chats, supergroups, direct messages, and real-time streaming migration progress.
- **Strict Clean Architecture**: Decoupled Domain Entities/Ports, Application Use Cases, Infrastructure Adapters, and Presentation layers across both backend and frontend.

---

## 🌐 Microservices & Port Map

| Service | Port | Description | Healthcheck / Endpoint |
|---|---|---|---|
| **Frontend SPA** | `7900` | React 19 + Vite + Tailwind technical dashboard | [http://localhost:7900](http://localhost:7900) |
| **Backend API** | `7901` | FastAPI + Telethon MTProto engine | [http://localhost:7901/docs](http://localhost:7901/docs) |
| **PostgreSQL 18** | `7902` | Persistent store for users, RBAC, and encrypted secrets | `localhost:7902` (`telegram_migrator_db`) |

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
│   ├── entities/              # Channel, VideoMessage, MigrationJob, User, TelegramCredential
│   ├── ports/                 # TelegramGatewayPort, JobRepositoryPort, UserRepositoryPort, CredentialRepositoryPort
│   └── exceptions/            # Domain-specific exception hierarchy
├── application/               # Application Use Cases
│   ├── use_cases/             # MigrateVideosUseCase, ListChannelsUseCase, AuthenticateUserUseCase, etc.
│   └── dtos/                  # Request/Response data transfer contracts
├── infrastructure/            # Outward adapters & concrete drivers
│   ├── telegram/              # Telethon MTProto gateway adapter & client factory
│   ├── persistence/           # PostgreSQL asyncpg & SQLite aiosqlite repositories
│   └── security/              # Fernet AES-256 encryption & Argon2/PBKDF2 password hashing
└── presentation/              # Inward adapters & HTTP delivery
    └── api/routers/           # Migration, Channels, Dialogs, Users, and Settings routers
```

### Frontend Architecture
- **Framework**: React 19 + TypeScript 5.6 + Vite 6.
- **Styling**: Tailwind CSS with compact high-density dark mode.
- **State Management**: Zustand store (`useMigrationStore`, `useAuthStore`, `useUserStore`) for domain and global state.
- **Strict Rule**: Maximum 2 `useState` hooks per view component (reserved strictly for ephemeral UI transitions).

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
# Run backend test suite (unit tests & in-memory integration)
pytest backend/tests -v

# Run frontend typecheck and production build
cd frontend && npm run build
```

---

## 📄 License

MIT © [smarriagac](https://github.com/smarriagac)
