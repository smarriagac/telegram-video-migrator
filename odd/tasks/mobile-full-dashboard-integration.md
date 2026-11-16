# Feature: Mobile Full Dashboard Integration (Shell Navigation & Jobs Queue)

Delivery strategy: single-pr

## Summary
Transform the mobile client from a standalone chat viewer into a multi-tab operations center mirroring the web dashboard:
1. `StatefulShellRoute` with bottom navigation (`ScaffoldWithNavBar`) supporting 4 primary branches: Chats, Migrations & Jobs, Channels, and Settings.
2. Complete `features/jobs` module following Clean Architecture: live migration queue monitoring, progress bars, pause/resume/cancel controls, and new migration modal.
3. Complete `features/channels` module listing managed channels, permissions, and status.
4. Settings & Network Diagnostics hub with live server latency test.
5. Strict adherence to ScreenUtil responsive scaling across all new widgets and pages.

## Specs
- S1: Navigation Shell & GoRouter Architecture:
  - Implement `ScaffoldWithNavBar` with cyber-dark bottom navigation bar.
  - Configure `StatefulShellRoute.indexedStack` with 4 branches (`/chats`, `/jobs`, `/channels`, `/settings`).
- S2: Jobs & Migration Domain & Data Layers:
  - Entities: `MigrationJob` (`job_id`, `source_id`, `target_id`, `source_title`, `target_title`, `status`, `total_videos`, `processed_videos`, `progress_percent`, `created_at`).
  - Use cases: `GetJobsUseCase`, `PauseJobUseCase`, `ResumeJobUseCase`, `CancelJobUseCase`, `CreateJobUseCase`.
  - Data: `MigrationJobModel` (Freezed + JSON), `JobsRemoteDataSource`, `JobsRepositoryImpl`.
- S3: Jobs Presentation & Reactive State:
  - `JobsBloc` handling load, refresh, pause, resume, cancel, and create actions.
  - `JobsPage` with active jobs summary, status badge (RUNNING, PAUSED, COMPLETED, FAILED), live progress bar, and action buttons.
  - `NewMigrationModal` with source & destination channel selectors.
- S4: Channels & Settings Modules:
  - `ChannelsPage` listing managed channels with role badges and clone history.
  - `SettingsPage` with interactive server IP config, live ping test, and version info.
- S5: ScreenUtil & UI Craft:
  - Zero raw numeric dimension literals. Every size, gap, radius, font uses `.w`, `.h`, `.r`, `.sp`.
- S6: Verification & Automated Tests:
  - Unit tests for `JobsBloc`, Freezed code generation, `flutter analyze` 0 issues, and `flutter test`.

## Tasks
- [x] T1 (S1): Implement `ScaffoldWithNavBar` and configure `StatefulShellRoute` in `app_router.dart` [inline]
- [x] T2 (S2): Create `features/jobs` Domain entities and Data layer (Freezed model, datasource, repository) [inline]
- [x] T3 (S2): Implement Jobs use cases (`GetJobsUseCase`, `ControlJobUseCase`, `CreateJobUseCase`) [inline]
- [x] T4 (S3): Implement `JobsBloc`, `JobsPage`, `JobCard`, and `NewMigrationModal` [inline]
- [x] T5 (S4): Implement `features/channels` and `features/settings` pages [inline]
- [x] T6 (S5): Register dependencies in `injection.dart` and run `build_runner` [inline]
- [x] T7 (S6): Write unit tests for `JobsBloc` and `ChannelsBloc`, and verify with `flutter test` and `flutter analyze` [inline]
- [x] T8 (S6): Rebuild release APKs and distribute to Telegram channel via `send_to_telegram.sh` [inline]

## Log
- L1: Initialized ODD task for mobile dashboard modules integration.
- L2: Implemented `features/jobs` domain, data, and presentation layers with cyber-dark UI cards, progress bars, and modal sheet.
- L3: Implemented `features/channels` and `features/settings` modules with live server ping test and channels directory.
- L4: Implemented `ScaffoldWithNavBar` and `StatefulShellRoute.indexedStack` across 4 persistent tabs. Verified 11/11 flutter tests pass and `flutter analyze` 0 issues.
- L5: Verified 283/283 backend tests pass in Docker. Compiled release APKs (`app-arm64-v8a-release.apk` 18MB, `app-armeabi-v7a-release.apk` 15MB) and distributed both to Telegram channel `-1003926247405` via bot.
