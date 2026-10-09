# Change Proposal: video-migration-core

## Why
Users managing multiple personal Telegram channels frequently need to migrate or clone large media libraries (e.g., ~500 videos) from a source channel to a target channel. Manual forwarding leaks the original source via the "Forwarded from" header and cannot be automated at scale. Downloading and re-uploading hundreds of gigabytes locally or through traditional servers is infeasible due to bandwidth, disk constraints, and Telegram Bot API limits (50 MB cap).

## What
Implement an automated, one-click Telegram Video Migration tool composed of:
1. **Backend (Python / FastAPI Clean Architecture)**:
   - Uses Telegram Client API (MTProto via Telethon) with user credentials (`api_id`, `api_hash`).
   - Copies videos directly by internal server reference (`InputDocument`), uploading zero video bytes to our servers.
   - Preserves original captions, hashtags, entities (bold, links, italics), and metadata without adding "Forwarded from" labels.
   - Implements safe rate-limiting delays (1.5s–2.5s) and automatic `FloodWaitError` backoff handling.
   - Provides Server-Sent Events (SSE) or WebSockets to stream real-time progress (`processed_count`, `total_count`, `current_video_title`, `status`).
   - Persists state and idempotency records (SQLite) so interrupted migrations resume without duplicates.
2. **Frontend (React 19 / Feature-First Clean Architecture / Zustand)**:
   - Modern Dark-mode dashboard built with Tailwind CSS.
   - Strict constraint: Maximum of 2 `useState` hooks per view (all domain and stream state managed via Zustand store).
   - Single-click action to initiate migration, visual progress bar, real-time log stream, and channel selectors.

## Capabilities
- `capability:telegram-session-auth`: Authenticate and manage active Telegram user session via MTProto.
- `capability:channel-discovery`: List owned and accessible channels to select source and destination.
- `capability:clean-video-cloning`: Copy videos by reference, keeping original captions and tags without forward headers.
- `capability:resilient-migration-worker`: Background worker with rate-limit protection, flood-wait pause/resume, and SQLite idempotency checkpointing.
- `capability:realtime-progress-stream`: Stream migration events and logs to the frontend via SSE.
- `capability:migration-dashboard-ui`: React 19 UI with Zustand store, real-time progress bar, and zero clutter.

## Impact & Risks
- **Telegram Rate Limits (`FloodWait`)**: Aggressive message posting triggers temporary Telegram account cooldowns. Mitigated by enforced 1.5s–2.0s delays and automatic wait-and-resume loops.
- **Session Security**: MTProto session strings or `.session` files grant account access. Mitigated by keeping credentials strictly local/server-side and ignored in Git.
- **Large Batches (~500 videos)**: Network interruptions could orphan jobs. Mitigated by persisting `last_processed_message_id` in SQLite.

## Non-Goals
- Transcoding, compressing, or modifying video payloads.
- Downloading video bytes to the local filesystem or cloud storage.
- Support for third-party channels where the user lacks admin/posting permissions.
