# Feature: Flutter Native Mobile Client Setup

Delivery strategy: single-pr

## Summary
Scaffold a native Flutter mobile client under `mobile/` in the `telegram-video-migrator` monorepo.
The application connects to the existing FastAPI backend (`http://localhost:7901` or LAN IP) and provides a clean, responsive chat experience following Feature-First Clean Architecture.

## Specs
- S1: Flutter Scaffold & Dependencies:
  - Initialize project in `mobile/` with package name `telegram_migrator_mobile`.
  - Add production dependencies: `flutter_bloc` (^9.1.1), `go_router` (^18.1.2), `get_it` (^9.3.0), `freezed_annotation` (^3.1.0), `json_annotation` (^4.12.0), `http` (^1.6.0), `intl` (^0.20.3).
  - Add dev dependencies: `build_runner` (^2.16.1), `freezed` (^4.0.1), `json_serializable` (^6.15.2), `flutter_lints` (^6.0.0).
- S2: ScreenUtil Responsive Sizing & Strict Engineering Rule:
  - Port `ScreenUtil` from `pet_care` into `mobile/lib/core/utils/screen_util.dart`.
  - Provide `.w`, `.h`, `.r`, `.sp` extensions for all dimensions, spacings, and typography.
  - Enforce rule via `.agents/rules/screen_util.md` prohibiting raw numeric dimensions in UI code.
- S3: Feature-First Clean Architecture Structure:
  - `mobile/lib/core/`:
    - `di/`: GetIt service locator.
    - `network/`: REST API client communicating with FastAPI dialogs/messages/pinned endpoints.
    - `router/`: GoRouter declarative routing.
    - `theme/`: Dark Cyber palette (#090A0F, #0E1015, #14161F, cian, esmeralda).
    - `utils/`: `screen_util.dart`.
  - `mobile/lib/features/chats/`:
    - `data/`: Dialog and message DTOs, remote data source, repository implementation.
    - `domain/`: Chat dialog and message entities, repository port, use cases.
    - `presentation/`: DialogsBloc / ChatMessagesBloc, chat list view, chat feed view.
- S4: Code Generation & Verification:
  - Run `dart run build_runner build --delete-conflicting-outputs` to generate Freezed and JSON models.
  - Run `flutter analyze` and `flutter test` to ensure zero compilation or architectural errors.

## Tasks
- [x] T1 (S1): Scaffold Flutter project in `mobile/` and update `pubspec.yaml` with latest dependencies [inline]
- [x] T2 (S2): Port `ScreenUtil` to `mobile/lib/core/utils/screen_util.dart` and register `.agents/rules/screen_util.md` [inline]
- [x] T3 (S3): Scaffold Core layer (GetIt DI, Dark Cyber Theme, GoRouter, API Client) [inline]
- [x] T4 (S3): Scaffold `features/chats` with Clean Architecture (Domain entities, Data models, Presentation) [inline]
- [x] T5 (S4): Generate models with `build_runner` and verify `flutter analyze` passes [inline]
- [x] T6 (S4): Write initial unit/widget tests and verify test suite passes [inline]

## Log
- L1: Initialized ODD task for Flutter native mobile client setup with BLoC, Clean Architecture, and ScreenUtils.
- L2: Scaffolded Flutter project under `mobile/` with package name `telegram_migrator_mobile`.
- L3: Added latest dependencies (`flutter_bloc: ^9.1.1`, `go_router: ^18.1.2`, `get_it: ^9.3.0`, `freezed_annotation: ^3.1.0`, `json_annotation: ^4.12.0`, `http: ^1.6.0`, `intl: ^0.20.3`).
- L4: Ported `ScreenUtil` into `mobile/lib/core/utils/screen_util.dart` and established mandatory rule in `.agents/rules/screen_util.md`.
- L5: Scaffolded Core layer with Dark Cyber Theme (`AppTheme`), `GetIt` DI container (`initDependencies`), declarative routing (`GoRouter`), and `ApiClient`.
- L6: Implemented Feature-First `features/chats` structure with Freezed DTOs (`ChatDialogModel`, `ChatMessageModel`), Domain entities (`ChatDialog`, `ChatMessage`), Repositories, Use Cases, `ChatDialogsBloc`, and UI widgets with pinned message banner and long-press pin support.
- L7: Generated Freezed and JSON serializable code using `dart run build_runner build`.
- L8: Executed `flutter analyze` (0 errors, 0 warnings) and `flutter test` (6/6 tests passed).
