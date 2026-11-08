# Feature: Automated Video Watermarking & Branding Pipeline

Empower channel owners to automatically overlay custom branding (watermark text e.g. `@MiCanalVIP` or channel handles) on video and photo messages, with support for combined delogo sanitization (cleaning original watermark) + re-branding in a single FFmpeg pass.

Delivery strategy: single-pr

## Specs
- S1: FFmpeg Branding Filters in `VideoProcessingService`:
  - Extend `_build_delogo_filter` (and provide `build_video_filter`) to support:
    - `filter_type="watermark_text"`: inject dynamic handle / branding text using FFmpeg `drawtext` with position presets (`bottom_right`, `bottom_left`, `top_right`, `top_left`, `center`).
    - `filter_type="delogo_and_watermark"`: combined filter chain removing legacy logos via `delogo` and applying target channel branding via `drawtext`.
  - Ensure safe escaping of single quotes and colons in text strings for FFmpeg syntax.
- S2: API Schema & Validation in `video_processing.py`:
  - Allow `filter_type in ("delogo", "blur", "watermark_text", "delogo_and_watermark")`.
  - Pass `filter_params` with `watermark_text`, `watermark_position`, `watermark_font_size`, `with_box`.
- S3: UI Branding Controls in `VideoSanitizerModal.tsx`:
  - Add Branding tab / mode toggle: "Eliminar Marca (Delogo)" | "Añadir Branding (@Canal)" | "Limpiar + Re-marcar".
  - Auto-fill default watermark text with target channel title or handle if available.
  - Position selector: Esquina inferior derecha, Esquina superior derecha, etc.
  - Maintain strict React state limit (<= 2 `useState` hooks).
- S4: Automated Tests:
  - Unit tests in `backend/tests/test_video_branding_pipeline.py`.
  - Verification of full backend test suite.

## Tasks
- [x] T1 (S1): Enhance `VideoProcessingService` with `watermark_text` and `delogo_and_watermark` FFmpeg filter generation [inline]
- [x] T2 (S2): Update API schema in `backend/presentation/api/routers/video_processing.py` [inline]
- [x] T3 (S3): Update UI in `VideoSanitizerModal.tsx` and build frontend bundle [inline]
- [x] T4 (S4): Write automated tests in `backend/tests/test_video_branding_pipeline.py` [inline]
- [x] T5 (S4): Run full backend test suite & frontend build verification [inline]
- [x] T6 (S4): Git commit and push with conventional commit message [inline]

## Log
- L1: Task initialized following Gentle AI ODD protocol.
- L2: Enhanced VideoProcessingService with drawtext escaping, position calculation and filter chaining (delogo_and_watermark, watermark_text). Updated VideoSanitizerModal with Branding controls and 4-way filter mode. Built frontend bundle and deployed to nginx container. Added unit tests in test_video_branding_pipeline.py. 100% tests passed.
