# Specifications: video-migration-core

## Capability: telegram-session-auth

### Requirement: Telegram MTProto Authentication
The system MUST authenticate against the Telegram MTProto API using the user's `api_id`, `api_hash`, and a persistent session (file or string).

#### Scenario: Active Session Connected
- **Given** valid `api_id`, `api_hash`, and an existing authenticated session string/file,
- **When** the backend client initializes,
- **Then** the client connects to Telegram and verifies the user is authorized.

#### Scenario: Missing or Invalid Session
- **Given** missing or invalid credentials,
- **When** the backend client attempts to initialize,
- **Then** it returns an `AuthenticationRequired` status with instructions to submit auth code or QR login.

---

## Capability: channel-discovery

### Requirement: List Accessible Source and Destination Channels
The system MUST list channels where the authenticated user is an administrator or creator with message read and post permissions.

#### Scenario: Retrieve Managed Channels
- **Given** an authenticated user session,
- **When** the frontend requests available channels via `GET /api/channels`,
- **Then** the API returns a list of channels with `id`, `title`, `username`, and `can_post_messages` flag.

---

## Capability: clean-video-cloning

### Requirement: Copy Video Messages by Server Reference
The system MUST copy video messages from the source channel to the destination channel without downloading/re-uploading video files to disk and without including the "Forwarded from" header.

#### Scenario: Video Message Cloned with Full Caption and Entities
- **Given** a message in the source channel containing a video with caption text and styling entities (bold, hashtags, links),
- **When** the worker processes this message,
- **Then** it sends a new message to the destination channel using the video's `InputDocument` reference,
- **And** the destination message contains the identical caption and formatting entities,
- **And** the destination message does NOT have a `fwd_from` header.

#### Scenario: Non-Video Message Encountered
- **Given** a message in the source channel that does not contain a video,
- **When** the worker evaluates the message,
- **Then** it skips the message and records a `SKIPPED_NOT_VIDEO` log event without halting the queue.

---

## Capability: resilient-migration-worker

### Requirement: Rate-Limited Queue with FloodWait Backoff and Idempotency
The worker MUST process migrations sequentially with a deliberate delay between operations and recover gracefully from Telegram rate limits.

#### Scenario: Enforced Rate Limiting Delay
- **Given** a migration job with multiple video messages,
- **When** a video is successfully posted to the destination channel,
- **Then** the worker sleeps for an interval between 1.5 and 2.0 seconds before dispatching the next message.

#### Scenario: Handling Telegram FloodWait
- **Given** Telegram returns a `FloodWaitError` with a cooldown period of `N` seconds,
- **When** the worker catches the error,
- **Then** it emits a `FLOOD_WAIT` progress status with the remaining wait time,
- **And** sleeps for `N + 2` seconds,
- **And** automatically resumes migration from the exact failed message without failing the job.

#### Scenario: Job Resumption from Checkpoint
- **Given** an active migration job interrupted at video index 230 out of 500,
- **When** the user clicks "Resume Migration" or restarts the server,
- **Then** the worker queries the checkpoint database for `last_processed_message_id`,
- **And** resumes processing from message index 231, preventing duplicate posts in the destination channel.

---

## Capability: realtime-progress-stream

### Requirement: Server-Sent Events (SSE) Progress Reporting
The system MUST provide an SSE endpoint `GET /api/jobs/{job_id}/stream` that broadcasts live progress events to connected clients.

#### Scenario: Emitting Real-Time Progress Updates
- **Given** a running migration job with 500 videos,
- **When** each video is processed,
- **Then** the SSE stream emits a JSON event containing:
  - `job_id`: string
  - `status`: `RUNNING` | `PAUSED_FLOOD_WAIT` | `COMPLETED` | `FAILED`
  - `total_videos`: integer
  - `processed_videos`: integer
  - `percentage`: float
  - `current_caption`: string
  - `timestamp`: ISO-8601 string

---

## Capability: migration-dashboard-ui

### Requirement: React 19 Feature-First UI with Zustand Store
The frontend MUST render a responsive dark-mode view allowing the user to select channels, start/pause migration, and view real-time progress.

#### Scenario: Strict useState Limit
- **Given** the `MigrationView` component,
- **When** state is initialized,
- **Then** `MigrationView` utilizes at most two `useState` hooks for local UI state (e.g., `isConfirmModalOpen`, `filterQuery`),
- **And** all domain, stream, channel, and job state is consumed from `useMigrationStore`.

#### Scenario: Single-Click Migration Trigger
- **Given** valid source and destination channels selected in the UI,
- **When** the user clicks "Start Migration" and confirms,
- **Then** the UI dispatches a `POST /api/jobs` request,
- **And** connects to the SSE stream, updating the progress bar and terminal logs dynamically.
