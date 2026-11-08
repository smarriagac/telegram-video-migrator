# ODD Task: Multi-Resolution Video Transcoding Presets (720p / 1080p / 4K Downsampling & Adaptive Bitrate)

## Status: COMPLETED
**Assigned**: Senior Architect
**Completed At**: 2026-11-08
**Verification**: Backend unit & integration tests (3/3 in test_video_processing.py, 6/6 in test_video_branding_pipeline.py), full frontend vitest (55/55 passed across 15 files), production bundle build, deployment to Docker container, and live curl verification on port 7901.

---

## 1. Problem & Context
When migrating video content between Telegram channels:
- Source videos are frequently encoded in uncompressed 4K or high-bitrate formats that exceed Telegram upload/streaming bandwidth and cause playback buffering on mobile devices.
- Unnecessary large file sizes slow down migration workers and increase storage consumption.
- Currently, [`VideoProcessingService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/video_processing_service.py) re-encodes videos at their original resolution with fixed CRF 23, lacking intelligent downsampling presets.

---

## 2. Technical Architecture & Design

### 2.1 Presets Catalog & Constraints
- **Presets**:
  - `ORIGINAL`: Preserves source geometry. Fixed CRF 23, `fast` preset.
  - `1080p` (Full HD): Downsample when $w > 1920$, `scale='min(1920,iw)':-2`, CRF 22, cap bitrate at 4500k.
  - `720p` (HD / Balanced): Downsample when $w > 1280$, `scale='min(1280,iw)':-2`, CRF 24, cap bitrate at 2500k.
  - `480p` (Bandwidth Saver / Mobile): Downsample when $w > 854$, `scale='min(854,iw)':-2`, CRF 26, cap bitrate at 1200k.
- **Divisible-by-2 guarantee**: `-2` scale ensures even macroblocks required by `libx264`.
- **No upscaling guard**: `min(target, iw)` prevents degrading smaller clips by blowing them up.
- **Combined Filter Chains**: When watermark/delogo filters are requested together with resolution scaling, they chain seamlessly in FFmpeg `-vf`.

### 2.2 Backend Layers
1. **Service**:
   - `TRANSCODING_PRESETS` dictionary with metadata.
   - `_build_transcoding_args(resolution_preset, source_width, source_height)` helper in `VideoProcessingService`.
   - Update `_execute_job` to apply scale and bitrate constraints.
2. **API Router**:
   - `GET /api/video-processing/presets`: Returns list of available presets and specifications.
   - Updated request schemas (`EnqueueVideoJobRequest`, `EnqueueBatchJobRequest`) with `resolution_preset`.

### 2.3 Frontend Layers
1. `videoProcessingApi.ts`:
   - Interfaces updated with `resolution_preset?: "ORIGINAL" | "1080p" | "720p" | "480p"`.
   - `fetchPresets()` client method.
2. `VideoSanitizerModal.tsx` & `BatchSanitizerModal.tsx`:
   - Resolution selector with visual indicators (720p HD, 1080p FHD, 480p Mobile, Original).
   - Strict adherence to $\le 2$ `useState` hooks.

---

## 3. Verification Plan
1. Unit tests in `test_video_processing.py` validating preset resolution strings, downsampling filter strings, and API endpoints.
2. Frontend tests and production bundle build verification (`npm run build`).
3. Deploy to Docker container, reload nginx, restart backend, and verify live via curl.
