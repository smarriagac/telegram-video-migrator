# Feature: Smart Thumbnail & Poster Frame Generator

Intelligent poster frame extractor and thumbnail generator that prevents black-frame video previews in Telegram channels, generating optimized lightweight JPEG covers (<=320px) and injecting `thumb=` into Telethon's `send_file` across ingestion, processing, and channel cloning.

Delivery strategy: single-pr

## Specs
- S1: Smart Thumbnail Engine (`ThumbnailEngine`):
  - In `backend/application/services/thumbnail_engine.py`:
    - `extract_poster_frame(video_path: str, output_jpg_path: str, timestamp_s: float | None = None, percent: float = 0.25, max_dim: int = 320) -> str`
    - `extract_frame_candidates(video_path: str, output_dir: str, count: int = 4) -> list[dict[str, Any]]`
    - Fast frame seeking via FFmpeg (`-ss` before `-i`), resolution bounding preserving aspect ratio, and compression quality tuning (`-q:v 3`).
- S2: Integration in `MediaIngestionService` and `VideoProcessingService`:
  - `MediaIngestionService`: automatically generate and pass `thumb=thumb_path` to `client.send_file(...)` in both single, album, and reservoir modes.
  - `VideoProcessingService`: extract poster thumbnail from sanitized video and supply `thumb=thumb_path` to `client.send_file(...)`.
  - Endpoint `POST /api/video-processing/thumbnail-preview` in `video_processing.py`.
- S3: Frontend UI:
  - Add Smart Cover / Thumbnail switch in `MediaIngestionModal.tsx` and `VideoSanitizerModal.tsx`.
  - Strictly maintain $\le 2$ `useState` hooks per component.
- S4: Testing & Verification:
  - Unit and integration tests in `backend/tests/test_thumbnail_engine.py`.
  - Full backend pytest suite passing.
  - Frontend Vitest suite passing and Vite build passing.
  - Container deployment and live API verification.
  - Conventional commit and push.

## Tasks
- [x] T1 (S1): Implement `ThumbnailEngine` with duration probing, fast keyframe seeking, and scaled JPEG generation [inline]
- [x] T2 (S2): Integrate `ThumbnailEngine` into `MediaIngestionService` and `VideoProcessingService` with `thumb=` in Telethon [inline]
- [x] T3 (S2): Expose `/api/video-processing/thumbnail-preview` in `video_processing.py` router [inline]
- [x] T4 (S4): Write automated backend tests in `backend/tests/test_thumbnail_engine.py` [inline]
- [x] T5 (S3): Update `mediaIngestionApi.ts`, `MediaIngestionModal.tsx`, and `VideoSanitizerModal.tsx` [inline]
- [x] T6 (S4): Run Vitest tests and production build [inline]
- [x] T7 (S4): Deploy to Docker containers and test live endpoints [inline]
- [x] T8 (S4): Mark ODD tasks completed, commit and push [inline]

## Log
- L1: Initialized ODD task for Smart Thumbnail & Poster Frame Generator.
- L2: Implemented `ThumbnailEngine` in `backend/application/services/thumbnail_engine.py` with fast keyframe seeking, aspect ratio bounding (<=320px bounding box), frame candidate generation, and multi-segment thumbnail extraction.
- L3: Integrated thumbnail generation into `MediaIngestionService` (single, album, and reservoir modes) and `VideoProcessingService` (single and album dispatch) supplying `thumb=` to Telethon's `send_file`.
- L4: Exposed `POST /api/video-processing/thumbnail-preview` and forwarded `generate_thumbnail` in `StageIngestionRequest`.
- L5: Created automated unit & integration tests in `backend/tests/test_thumbnail_engine.py` (5/5 tests passing).
- L6: Added visual controls for Smart Poster Frame (Anti-blackframe) in `MediaIngestionModal.tsx` and `VideoSanitizerModal.tsx` while adhering to the strict <= 2 useState constraint.
- L7: Verified Vitest suite (19 test files / 68 tests passing) and Vite production build. Deployed to Docker frontend and restarted backend. Live tested endpoint with JWT auth.
