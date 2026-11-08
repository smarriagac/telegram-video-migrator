# Feature: AI Subtitles & Kinetic Captions Burner

Audio extraction, synchronized subtitle generation, and FFmpeg subtitle burning engine with high-contrast social media styles (Kinetic Yellow, Classic White, Boxed Black) optimized for Stories, Reels, and muted feeds.

Delivery strategy: single-pr

## Specs
- S1: Subtitle Engine (`SubtitleEngine`):
  - In `backend/application/services/subtitle_engine.py`:
    - `SubtitleCue` dataclass with `index`, `start_s`, `end_s`, `text`.
    - `extract_audio(video_path: str, output_wav_path: str) -> str`
    - `generate_subtitles(video_path: str, caption_hint: str | None = None, language: str = "es", style: str = "KINETIC_YELLOW") -> tuple[str, list[SubtitleCue]]`
    - `build_subtitles_filter(srt_path: str, style: str = "KINETIC_YELLOW", margin_v: int = 80, font_size: int = 24) -> str`
    - `burn_subtitles_to_video(input_path: str, output_path: str, srt_path: str, style: str = "KINETIC_YELLOW") -> str`
- S2: Integration in `MediaIngestionService` and `VideoProcessingService`:
  - `MediaIngestionService`: support `burn_subtitles: bool = False`, `subtitle_style: str = "KINETIC_YELLOW"`.
  - `VideoProcessingService`: support `burn_subtitles: bool = False`, `subtitle_style: str = "KINETIC_YELLOW"` in `filter_params`.
  - Endpoint `POST /api/video-processing/generate-subtitles-preview` in `video_processing.py`.
- S3: Frontend UI:
  - Add subtitle burner controls in `MediaIngestionModal.tsx` and `VideoSanitizerModal.tsx`.
  - Update `mediaIngestionApi.ts` with subtitle parameters.
  - Strictly maintain $\le 2$ `useState` hooks per component.
- S4: Testing & Verification:
  - Unit and integration tests in `backend/tests/test_subtitle_burner.py`.
  - Full backend pytest suite passing.
  - Frontend Vitest suite passing and Vite build passing.
  - Container deployment and live API verification.
  - Conventional commit and push.

## Tasks
- [x] T1 (S1): Implement `SubtitleEngine` with audio extraction, SRT generator, style formatting, and FFmpeg filter building [inline]
- [x] T2 (S2): Integrate `SubtitleEngine` into `MediaIngestionService` and `VideoProcessingService` [inline]
- [x] T3 (S2): Expose `/api/video-processing/subtitles-preview` in `video_processing.py` router [inline]
- [x] T4 (S4): Write automated backend tests in `backend/tests/test_subtitle_burner.py` [inline]
- [x] T5 (S3): Update `mediaIngestionApi.ts`, `MediaIngestionModal.tsx`, and `VideoSanitizerModal.tsx` [inline]
- [x] T6 (S4): Run Vitest tests and production build [inline]
- [x] T7 (S4): Deploy to Docker containers and test live endpoints [inline]
- [x] T8 (S4): Mark ODD tasks completed, commit and push [inline]

## Log
- L1: Initialized ODD task for AI Subtitles & Kinetic Captions Burner.
- L2: Implemented `SubtitleEngine` in `backend/application/services/subtitle_engine.py` with `SubtitleCue` time formatting, kinetic phrase segmentation, SRT creation, DejaVu Sans styling presets (Kinetic Yellow, Classic White, Boxed Black), and FFmpeg path escaping.
- L3: Integrated subtitle generation & burning into `MediaIngestionService` (chained before story slicing) and `VideoProcessingService` (injected into video filtergraph).
- L4: Exposed `POST /api/video-processing/subtitles-preview` in `video_processing.py` and added `burn_subtitles` to `StageIngestionRequest`.
- L5: Created comprehensive unit tests in `backend/tests/test_subtitle_burner.py` (7/7 tests passing).
- L6: Added visual controls for subtitles in `MediaIngestionModal.tsx` and `VideoSanitizerModal.tsx` adhering to the strict <= 2 useState constraint.
- L7: Verified Vitest suite (19 test files / 68 tests passing) and Vite production build. Deployed to Docker frontend and restarted backend. Live tested endpoint with JWT auth.
