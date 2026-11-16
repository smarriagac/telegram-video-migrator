# Feature: Dashboard PWA & Full Mobile-Responsive Adaptation

Delivery strategy: single-pr

## Summary
Transform the existing React/Vite web dashboard into an installable, high-performance Progressive Web App (PWA) with a mobile-first responsive architecture:
1. Service worker & web app manifest via `vite-plugin-pwa` supporting standalone installation, splash icon branding, and offline caching.
2. Mobile viewport optimizations (`viewport-fit=cover`, theme-color `#090A0F`, safe-area insets).
3. Mobile bottom navigation bar (`md:hidden`) offering instant thumb reach to primary operational domains (Chats, Clonación, Canales, Trabajos, Más).
4. Responsive layout refactoring across core operational views to eliminate horizontal overflow and awkward mobile clipping.

## Specs
- S1: PWA Configuration & Service Worker:
  - Configure `vite-plugin-pwa` with manifest, theme colors, standalone display mode, and service worker caching strategies.
  - Enhance `index.html` with mobile meta tags (`viewport-fit=cover`, `apple-mobile-web-app-capable`, `theme-color`).
- S2: Mobile Navigation & Bottom Bar:
  - Implement mobile bottom navigation (`MobileBottomNav`) in `AppLayout.tsx` with active route indicators, badge alerts, and safe-area insets.
  - Ensure desktop sidebar collapses seamlessly while mobile drawer remains accessible via the "Más" bottom tab or header trigger.
- S3: Viewport & Safe Area Styling:
  - Adjust main container paddings (`pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0`) to prevent bottom nav occlusion.
  - Implement touch-friendly targets (minimum 44px touch targets).
- S4: Core Views Responsive Polish:
  - Verify and harden responsive flex/grid layouts across `/chats`, `/migration`, `/jobs`, `/channels`, and `/settings`.
- S5: Verification & Quality:
  - Zero TypeScript build errors (`npm run build`).
  - Unit tests pass (`npm test`).
  - Verify PWA assets generated in `dist/`.

## Tasks
- [x] T1 (S1): Configure `vite-plugin-pwa` in `vite.config.ts` and enhance `index.html` with PWA meta tags [inline]
- [x] T2 (S1): Generate PWA icons and web manifest assets [inline]
- [x] T3 (S2): Implement `MobileBottomNav` component and integrate into `AppLayout.tsx` [inline]
- [x] T4 (S3): Configure safe-area insets and responsive view containers [inline]
- [x] T5 (S4): Audit and polish responsive breakpoints on key dashboard views [inline]
- [x] T6 (S5): Run `npm run build` and `npm test` verifying zero errors and valid service worker generation [inline]

## Log
- L1: Initialized ODD task for Dashboard PWA and full responsive mobile adaptation.
- L2: Installed `vite-plugin-pwa`, configured auto-updating service worker, and generated 192x192, 512x512, and 180x180 maskable PWA icons from vector branding.
- L3: Enhanced `index.html` with `viewport-fit=cover`, `theme-color #090A0F`, and standalone display metadata.
- L4: Implemented `MobileBottomNav` with primary quick-access buttons (Chats, Clonar, Canales, Trabajos, Más) and safe-area inset bottom padding.
- L5: Integrated `usePwaInstall` hook providing native browser installation prompt in the header.
- L6: Updated `nginx.conf` caching headers for `sw.js` and `manifest.webmanifest`. Verified 20/20 test suites pass (73 tests) and live deployed into frontend container on port 7900.
- L7: Fixed mobile conversation header collision in `ChatsView.tsx`: grouped secondary actions (TikTok ingestion, Feeds, Hashtag index, VIP pass, selection) into a unified `Popover`, trimmed badges onto a single line without wrapping collisions, hid top list toolbar when conversation is active on mobile, and enabled edge-to-edge chat viewport in `AppLayout.tsx`. Verified 73/73 tests pass and redeployed.
