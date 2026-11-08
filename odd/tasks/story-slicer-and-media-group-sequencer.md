# Feature: Story Slicer 60s & Media Group Sequencer Suite

Smart temporal segmentation engine that slices videos longer than 60 seconds into consecutive 60s clips optimized for Telegram Stories, with automatic Media Group (album) grouping and sequential reservoir staging.

Delivery strategy: single-pr

## Specs
- S1: Story Slicer Engine (`StorySlicerEngine`):
  - In `backend/application/services/story_slicer_engine.py`:
    - `compute_slice_plan(duration_s: float, max_segment_seconds: float = 60.0) -> list[tuple[float, float]]`
    - `slice_video(input_path: str, output_dir: str, max_segment_seconds: float = 60.0, base_caption: str = "", target_height: int = 1920) -> list[StorySegment]`
    - Fast FFmpeg stream slicing with `-ss` and `-to` using H.265 / AAC parameters.
    - Automatic sequential caption appending: `"{caption} (Parte 1/N)"`, etc.
- S2: Integration in `MediaIngestionService` and `VideoProcessingService`:
  - Support `slice_stories: bool = True` and `slice_dispatch_mode: "ALBUM" | "SEQUENTIAL"` in ingestion and processing jobs.
  - When `mode == "DIRECT"`:
    - If `ALBUM`: sends as a unified Telegram Media Group via `client.send_file(target, file=[...])`.
    - If `SEQUENTIAL`: sends each segment consecutively with its part label.
  - When `mode == "RESERVOIR"`: stages each segment as consecutive reservoir items with scheduled spacing.
- S3: REST Endpoints in `video_processing.py` & `ingestion.py`:
  - `POST /api/video-processing/slice-plan`: calculates slice count and timeline for a given duration.
- S4: Frontend UI:
  - Add Story Slicer switch/options in `MediaIngestionModal.tsx` and `VideoSanitizerModal.tsx`.
  - Display automatic slice indicator badge if video duration > 60s.
  - Maintain strict $\le 2$ `useState` constraint per component.
- S5: Testing & Verification:
  - Unit tests in `backend/tests/test_story_slicer.py`.
  - Full pytest suite passing.
  - Full Vitest suite passing.
  - Production build & Docker deployment.

## Tasks
- [x] T1 (S1): Implement `StorySlicerEngine` with temporal cutting and sequential numbering [inline]
- [x] T2 (S2): Integrate `StorySlicerEngine` into `MediaIngestionService` for Album & Sequential dispatch [inline]
- [x] T3 (S2): Integrate slice support in `VideoProcessingService` [inline]
- [x] T4 (S3): Expose `/api/video-processing/slice-plan` endpoint [inline]
- [x] T5 (S5): Write backend automated unit tests in `backend/tests/test_story_slicer.py` [inline]
- [x] T6 (S4): Update `MediaIngestionModal.tsx` and `VideoSanitizerModal.tsx` with Story Slicer controls [inline]
- [x] T7 (S5): Run Vitest tests and production build [inline]
- [x] T8 (S5): Deploy to Docker containers and test live endpoints [inline]
- [x] T9 (S5): Commit and push with conventional commit [inline]

## Log
- L1: Initialized ODD task for Story Slicer 60s & Media Group Sequencer Suite.
- L2: Implemented `StorySlicerEngine` in `backend/application/services/story_slicer_engine.py` with intelligent tail balancing, FFmpeg precision cutting, and dynamic caption labeling.
- L3: Integrated slicing into `MediaIngestionService` and `VideoProcessingService`, supporting ALBUM (Telegram Media Group) and SEQUENTIAL dispatch with Content Reservoir compatibility.
- L4: Exposed `/api/video-processing/slice-plan` and added unit test suite `backend/tests/test_story_slicer.py` (8/8 tests passed, 244/244 total backend tests passing).
- L5: Integrated Story Slicer toggle, duration detector, and dispatch mode selector in `MediaIngestionModal.tsx` and `VideoSanitizerModal.tsx` while adhering to the <= 2 useState constraint.
- L6: Verified Vitest suite (19 files / 68 tests passing) and Vite production build.
- L7: Deployed assets to frontend container and reloaded nginx. Live tested REST endpoints against running backend container.
