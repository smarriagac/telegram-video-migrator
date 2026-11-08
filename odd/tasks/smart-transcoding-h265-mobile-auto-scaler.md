# Feature: Smart Transcoding & H.265 Mobile Auto-Scaler

Implement an intelligent FFmpeg video analysis and transcoding auto-scaler that dynamically probes source media, detects bloated bitrates or excessive resolutions (4K/1080p), and re-encodes to H.265 (HEVC) with the `hvc1` MP4 tag for native iOS/Android Telegram streaming, saving 40-60% bandwidth and upload latency while protecting CPU with pass-through detection.

Delivery strategy: single-pr

## Specs
- S1: Core Engine (`SmartTranscodingEngine`):
  - In `backend/application/services/smart_transcoding_engine.py`:
    - `probe_video(file_path: str) -> VideoProbeResult` using `ffprobe` (width, height, duration, size, video codec, audio codec, bitrate, fps).
    - `decide_strategy(probe: VideoProbeResult, target_preset: str = "AUTO_MOBILE") -> TranscodingStrategy`.
    - Strategy supports:
      - `AUTO_MOBILE`: 4K -> 1080p H.265, 1080p -> 720p H.265, 720p -> optimize or pass-through.
      - `H265_1080P`, `H265_720P`, `H265_480P` with `libx265`, `-tag:v hvc1`, `-pix_fmt yuv420p`, `-movflags +faststart`.
      - `PASS_THROUGH`: When video is already well-compressed H.265 and within resolution limits, skip re-encoding.
    - Build FFmpeg filter and codec args compatible with existing delogo and branding filters.
- S2: Integration into `VideoProcessingService`:
  - Update `TRANSCODING_PRESETS` catalog with new H.265 and Auto-Mobile presets.
  - In `_execute_job`:
    - Run probe and decide strategy.
    - Execute FFmpeg with `libx265` (or fallback to `libx264` if unavailable).
    - Measure file size difference and record `original_size`, `transcoded_size`, and `savings_pct`.
- S3: REST API Endpoints:
  - Update `GET /api/video-processing/presets` with detailed H.265 metadata.
  - Add `POST /api/video-processing/probe` for inspecting video metrics.
- S4: Frontend UI Updates:
  - In `videoProcessingApi.ts`: add new presets and types.
  - In `VideoSanitizerModal.tsx` and `BatchSanitizerModal.tsx`: add H.265 Auto Mobile preset with visual badges, preserving $\le 2$ `useState` hooks.
  - In `JobsView.tsx`: display savings badge (e.g. "-54% H.265") on completed FFmpeg jobs.
- S5: Testing & Verification:
  - Automated tests in `backend/tests/test_smart_transcoding.py`.
  - Frontend test suites green, build production bundle, deploy to Docker.

## Tasks
- [x] T1 (S1): Implement `SmartTranscodingEngine` with `ffprobe` analysis, decision matrix, and H.265 `hvc1` arguments [inline]
- [x] T2 (S2): Update `VideoProcessingService` with `TRANSCODING_PRESETS` and execution pipeline [inline]
- [x] T3 (S3): Update API endpoints in `video_processing.py` [inline]
- [x] T4 (S5): Write backend unit tests in `backend/tests/test_smart_transcoding.py` and run pytest [inline]
- [x] T5 (S4): Update frontend `videoProcessingApi.ts`, modals, and `JobsView.tsx` within 2-hook budget [inline]
- [x] T6 (S5): Run full frontend test suite and build production bundle [inline]
- [x] T7 (S5): Deploy to Docker containers and test live [inline]
- [x] T8 (S5): Git commit and push with conventional commit message [inline]

## Log
- L1: Initialized ODD task for Smart Transcoding & H.265 Mobile Auto-Scaler.
- L2: Implemented `SmartTranscodingEngine` in `backend/application/services/smart_transcoding_engine.py` with `ffprobe` parsing, mobile decision matrix, HEVC `hvc1` tag, and pass-through detection.
- L3: Integrated engine into `VideoProcessingService` and updated presets catalog (`AUTO_MOBILE`, `H265_1080P`, `H265_720P`, `H265_480P`).
- L4: Added `/api/video-processing/strategy` evaluation endpoint in `video_processing.py`.
- L5: Verified backend unit tests (8/8 in `test_smart_transcoding.py` and `test_video_processing.py`, 6/6 in `test_video_branding_pipeline.py`).
- L6: Updated `videoProcessingApi.ts`, `VideoSanitizerModal.tsx`, `BatchSanitizerModal.tsx`, and `JobsView.tsx` with H.265 Auto Mobile badges adhering to the 2-hook budget.
- L7: Built production bundle, deployed to containers, and verified live via curl with JWT authentication.
