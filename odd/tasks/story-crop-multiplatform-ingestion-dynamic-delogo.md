# Feature: Story Auto-Crop 9:16, Multi-Platform Ingestion & Dynamic Delogo Suite

Comprehensive expansion suite containing three high-value capabilities:
1. **Vertical 9:16 Auto-Crop & Cinematic Blur for Telegram Stories**: Converts horizontal 16:9 videos to 9:16 canvas with blurred background letterbox or center crop.
2. **Multi-Platform Ingestor (`yt-dlp`)**: Ingests TikTok, Instagram Reels, and YouTube Shorts into the Content Reservoir or posts directly to Telegram channels.
3. **Dynamic Delogo Tracking & Multi-Frame OCR**: Multi-sample computer vision that tracks static and time-shifted watermarks across video frames.

Delivery strategy: single-pr

## Specs
- S1: Story Auto-Crop & 9:16 Transformer:
  - Add `build_aspect_ratio_filter` in `SmartTranscodingEngine`.
  - Support `aspect_ratio_mode`: `"ORIGINAL"`, `"9:16_BLUR"`, `"9:16_CROP"`.
  - Connect with `VideoProcessingService` filter complex pipeline.
- S2: Multi-Platform Media Ingestion Service (`MediaIngestionService`):
  - In `backend/application/services/media_ingestion_service.py`:
    - `inspect_url(url: str) -> dict[str, Any]` (title, uploader, thumbnail, duration).
    - `download_media(url: str, output_dir: str) -> tuple[str, dict[str, Any]]`.
    - `ingest(url: str, target_channel_id: int, mode: str, ...)` to post or stage into reservoir.
  - REST endpoints in `backend/presentation/api/routers/ingestion.py`.
- S3: Dynamic Delogo Tracking Engine:
  - In `backend/application/services/dynamic_watermark_detector.py`:
    - Multi-sample video frame extraction at intervals (10%, 30%, 50%, 70%, 90%).
    - OpenCV contour & variance tracking to identify static vs animated/time-shifted watermarks.
- S4: Frontend UI:
  - `MediaIngestionModal.tsx` for URL inspection and one-click ingestion into Telegram/Reservoir.
  - Aspect ratio toggle in `VideoSanitizerModal.tsx` and `BatchSanitizerModal.tsx`.
  - Strict adherence to $\le 2$ `useState` hooks per component.
- S5: Testing & Verification:
  - Unit tests for 9:16 filter generation, URL inspection, and dynamic watermark tracking.
  - Full backend pytest suite passing.
  - Frontend production build & container deployment.

## Tasks
- [x] T1 (S1): Implement 9:16 aspect ratio filter generator and integrate into `VideoProcessingService` [inline]
- [x] T2 (S2): Implement `MediaIngestionService` with `yt-dlp` inspection and downloading [inline]
- [x] T3 (S3): Implement `DynamicWatermarkDetector` with multi-frame sampling [inline]
- [x] T4 (S2): Implement REST API endpoints in `ingestion.py` and register in `main.py` [inline]
- [x] T5 (S5): Write backend automated unit tests in `backend/tests/test_ingestion_and_stories.py` [inline]
- [x] T6 (S4): Implement `MediaIngestionModal.tsx`, update client API, and wire into UI within 2-hook budget [inline]
- [x] T7 (S5): Run full frontend test suite and compile production build [inline]
- [x] T8 (S5): Deploy to Docker containers and test live [inline]
- [x] T9 (S5): Git commit and push with conventional commit message [inline]

## Log
- L1: Initialized ODD task for Story Auto-Crop 9:16, Multi-Platform Ingestion & Dynamic Delogo Suite.
- L2: Completed implementation of 9:16 aspect ratio filter, multi-platform media ingestion, dynamic delogo tracking, backend unit tests (7/7 passed), frontend modal & vitest tests (68/68 passed), production build and Docker deployment.
