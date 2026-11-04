# Feature: Channel Metadata, Own Status Badge & Symmetrical Sidebar Collapse

Enhance chat and channel headers with real Telegram subscribers count, group member & online count, user online presence, and own channel/group badge ("Canal Propio" / "Grupo Propio"). Fix sidebar collapse layout in icon rail mode ensuring pixel-perfect symmetry and clean stacked footer.

Delivery strategy: single-pr

## Specs
- S1: Telegram Metadata Extraction (Backend):
  - Extend `TelegramDialog` entity and `DialogResponse` schema with:
    - `participants_count: int | None`
    - `online_count: int | None`
    - `is_creator: bool` (identifies own channel/group where user is creator)
    - `is_admin: bool`
    - `is_online: bool | None`
    - `status_text: str | None` (e.g., "18.497 suscriptores", "7.192 miembros, 430 en línea", "En línea", "Desconectado")
  - In `TelethonAdapter.get_dialogs`:
    - Check `entity.creator` for own group/channel identification.
    - Extract `participants_count` for channels and groups.
    - Check user presence (`UserStatusOnline`, `UserStatusOffline`, `UserStatusRecently`).
- S2: Frontend Chat Header Presentation (`ChatsView.tsx`):
  - Replace generic "MTProto Conectado" label with dynamic metadata:
    - Channel: Subscriber count with icon.
    - Group: Member count and online count.
    - User: Online presence dot and status ("En línea" / "Desconectado").
  - Add "Canal Propio" / "Grupo Propio" badge for chats where `is_creator: true` (or "Admin" if `is_admin: true`).
  - Maintain strict 2 `useState` hooks constraint in `ChatsView.tsx`.
- S3: Symmetrical Sidebar Collapse (`AppLayout.tsx` & `sidebar.tsx`):
  - Fix collapsed icon rail header and footer padding.
  - Center brand logo in `SidebarHeader` when collapsed without text overflow.
  - Stack avatar and theme toggle vertically in `SidebarFooter` when collapsed and hide overflowing email/logout buttons.
  - Ensure `h-16` pixel-perfect horizontal border alignment across both sidebar and inset top bar.
- S4: Automated Tests & Verification:
  - Add backend test cases verifying `TelegramDialog` metadata extraction and serialization.
  - Compile frontend with 0 TypeScript errors and deploy to Docker container.

## Tasks
- [x] T1 (S1): Update domain entity `TelegramDialog`, `DialogResponse` schema, and `telethon_adapter.py` [inline]
- [x] T2 (S4): Write automated test in `backend/tests/test_dialogs.py` verifying new metadata fields [inline]
- [x] T3 (S2): Update `frontend/src/features/chats/domain/types.ts` and `ChatsView.tsx` header layout [inline]
- [x] T4 (S3): Refactor `AppLayout.tsx` collapsed icon rail styles for symmetrical layout [inline]
- [x] T5 (S4): Run full frontend build (`npm run build`) and backend tests (`pytest`) [inline]
- [x] T6 (S4): Deploy build to Docker containers [inline]
- [x] T7 (S4): Git commit and push with conventional commit message [inline]

## Log
- L1: User requested replacing generic "MTProto Conectado" with real subscribers/members/online count and identifying own channels/groups.
- L2: User reported visual alignment issues when collapsing sidebar into icon rail mode.
- L3: Added `participants_count`, `online_count`, `is_creator`, `is_admin`, `is_online`, `status_text` to `TelegramDialog` and `DialogResponse`.
- L4: Implemented dynamic header presentation in `ChatsView.tsx` with subscriber counts, presence status, and "Canal Propio" / "Grupo Propio" crown badge.
- L5: Fixed collapsed icon rail padding in `AppLayout.tsx`, centering header logo and vertically stacking avatar and theme toggle without overflow.
- L6: All 109 automated tests passed cleanly and frontend bundle compiled with 0 errors.
- L7: Eliminated redundant module-level titles and subtitles (`ViewHeader`), preserving pure action toolbars and status badges since domain context is already established in the top Breadcrumb header.
