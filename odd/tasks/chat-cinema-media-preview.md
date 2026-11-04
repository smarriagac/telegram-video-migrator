# Feature: Immersive Cinema Fullscreen Media Lightbox in Chats

Unify the media preview experience across the application by replacing the boxy modal in `ChatsView.tsx` with the Cinema Fullscreen Media Lightbox from `MessageSelector.tsx` (swipeable chevrons, keyboard navigation, high-res viewport fit, and glass header/footer).

Delivery strategy: single-pr

## Specs
- S1: Cinema Lightbox State in `ChatsView.tsx`:
  - Store `previewModalMsg: Message | null` in `ExtraViewState` (0 new useState hooks).
  - Compute `previewableMessages` list for sequential navigation.
  - Implement `handlePrevPreview` / `handleNextPreview` with floating glass chevrons.
  - Listen to `ArrowLeft`, `ArrowRight`, and `Escape` keyboard shortcuts.
- S2: Viewport-Fit Media Stage:
  - Render full-height media (video player with controls/autoplay, or full image contain).
  - Top glass header with `Mensaje #{id}`, type badge, position counter (`{x} de {total}`), and quick-selection toggle for own channels.
  - Bottom glass footer with caption text, timestamp, and shortcuts hints.
- S3: Architectural Constraints:
  - Adhere strictly to the maximum 2 `useState` hooks constraint in `ChatsView.tsx`.
- S4: Automated Tests & Verification:
  - Compile frontend with 0 TypeScript errors and test responsive rendering.

## Tasks
- [x] T1 (S1): Add `previewModalMsg` to `ExtraViewState` and sequential navigation handlers in `ChatsView.tsx` [inline]
- [x] T2 (S2): Scaffold Cinema Fullscreen Lightbox Portal in `ChatsView.tsx` [inline]
- [x] T3 (S1): Connect `ChatMediaThumbnail` click and maximize events to Cinema Lightbox [inline]
- [x] T4 (S4): Compile frontend bundle and deploy to Docker container [inline]
- [x] T5 (S4): Run backend test suite [inline]
- [x] T6 (S4): Git commit and push with conventional commit message [inline]

## Log
- L1: User requested replacing the boxy message preview modal in ChatsView with the Cinema Fullscreen Media Lightbox from MessageSelector.
- L2: Integrated immersive Cinema Fullscreen Media Lightbox into `ChatsView.tsx` with floating navigation chevrons, keyboard controls (`← / → / Esc`), counter (`1 de N`), and selection toggle.
- L3: Preserved strict 2 `useState` hooks constraint in `ChatsView.tsx`.
- L4: Verified all 108 backend tests pass and frontend builds with 0 errors.
