# Task: Resumable Chunked Big Media Direct Upload (>2GB via MTProto Parts)

## Context & Motivation
Telegram channels frequently host high-definition video archives, course packages, and cinematographic content that exceed standard HTTP single-request payloads (often between 1.5 GB and 4 GB).

Uploading large files via conventional HTTP POST (`multipart/form-data`) fails in production due to:
1. Memory spikes from reading entire multi-gigabyte files into server RAM (`file.read()`), causing Docker OOM kills.
2. Reverse proxy payload limits and timeout terminations (e.g., Nginx 413 "Request Entity Too Large" and 504 Gateway Timeouts).
3. Zero fault tolerance: any momentary TCP packet drop forces the operator to restart a 3GB upload from 0%.
4. Telegram MTProto requirements: files $> 10 \text{ MB}$ must use chunked `upload.saveBigFilePart` with 512KB slices and `InputFileBig`.

---

## Architectural Specification

### 1. Backend Application Layer (`BigMediaUploadService`)
- File: `backend/application/services/big_media_upload_service.py`
- Scratch Directory: `/tmp/migrator_uploads/{upload_id}/`
- Methods:
  - `init_session(filename, file_size_bytes, mime_type, target_channel_id, caption, account_id) -> UploadSessionMeta`
    - Creates scratch directory and metadata file.
    - Slices file into fixed 5MB chunks (`chunk_size = 5 * 1024 * 1024`).
    - Calculates `total_chunks`.
  - `save_chunk(upload_id, chunk_index, chunk_bytes) -> ChunkUploadResult`
    - Atomically writes `part_{chunk_index:05d}.bin`.
    - Tracks completed parts in metadata.
  - `get_session_status(upload_id) -> UploadSessionStatus`
    - Scans scratch directory to list completed chunks and compute percentage.
    - Enables frontend client to resume from interrupted chunk index.
  - `complete_and_transmit(upload_id) -> CompletedUploadResult`
    - Validates all chunks `0..total_chunks-1` are present.
    - Sequentially stitches chunks into an assembled media file using low-memory 64KB stream buffers.
    - Resolves target MTProto client and acquires Rate Governor token.
    - Dispatches to Telegram via `TelethonAdapter` with `supports_streaming=True`, invoking progress callback.
    - Emits real-time SSE progress events (`BIG_MEDIA_UPLOAD_PROGRESS`).
    - Cleans up scratch directory on success.
  - `cancel_session(upload_id) -> bool`
    - Safely purges scratch files for aborted session.

### 2. Presentation Layer (API Router)
- File: `backend/presentation/api/routers/big_media_upload.py`
- Endpoints:
  - `POST /api/media/upload/init`: Initializes resumable upload session.
  - `POST /api/media/upload/{upload_id}/chunk`: Uploads a single 5MB chunk.
  - `GET /api/media/upload/{upload_id}/status`: Polls session status and completed chunks.
  - `POST /api/media/upload/{upload_id}/complete`: Assembles and uploads to Telegram MTProto.
  - `DELETE /api/media/upload/{upload_id}`: Aborts and cleans up session.

### 3. Nginx Reverse Proxy Update
- Update `frontend/nginx.conf`: Add `client_max_body_size 50M;` to `/api/` block.

### 4. Frontend Architecture
- API Client: `frontend/src/features/migration/infrastructure/bigMediaUploadApi.ts`
  - Resumable orchestrator slicing files via `File.prototype.slice()`.
  - Auto-retries on failed chunk with exponential backoff.
- Component: `frontend/src/features/migration/presentation/components/BigMediaUploadModal.tsx`
  - Constraint: Strictly $\le 2$ `useState` hooks.
  - Visual chunking and MTProto transmission progress indicators.
  - Pause, Resume, and Cancel actions.

---

## Verification Criteria
1. Backend unit tests in `backend/tests/test_big_media_upload.py` verifying full lifecycle, chunk persistence, resume detection, and cancellation.
2. Full backend test suite passing.
3. Frontend unit tests in `frontend/src/features/migration/presentation/__tests__/BigMediaUploadModal.test.tsx`.
4. Production build compiled cleanly and deployed to Docker.
5. End-to-end curl verification of init, chunk upload, status resume check, and assembly.
