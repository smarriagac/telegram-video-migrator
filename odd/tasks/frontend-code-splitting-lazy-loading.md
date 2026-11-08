# Task: Frontend Route-based Code Splitting, Lazy Loading & Vendor Chunking

## Problem Statement
The frontend bundle currently builds as a single monolithic chunk (`dist/assets/index-DB6gz4bV.js`) weighing 1,121.40 kB (1.12 MB), exceeding Vite's 500 kB chunk threshold. Every user downloading the application pays the network and parsing cost of all feature modules simultaneously (video migration wizard, analytics, audit log, billing, channels, and live sync).

## Target Architecture & Solution
1. **Dynamic Route Imports (`React.lazy`)**:
   - Convert all top-level feature view imports in [`frontend/src/app/App.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/app/App.tsx) from static imports to dynamic imports using `React.lazy(() => import(...).then(m => ({ default: m.ViewName })))`.
2. **Accessible Suspense Fallback (`ViewLoadingFallback`)**:
   - Create [`frontend/src/shared/components/ViewLoadingFallback.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/shared/components/ViewLoadingFallback.tsx) featuring accessible skeleton placeholders (`animate-pulse`) for view headers, metric cards, and table content.
   - Wrap `<Outlet />` in [`frontend/src/app/AppLayout.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/app/AppLayout.tsx) and `<LoginView />` in `App.tsx` with `<Suspense>`.
3. **Vite Chunk Optimization (`manualChunks`)**:
   - Configure [`frontend/vite.config.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/vite.config.ts) with `rollupOptions.output.manualChunks` to isolate core vendors:
     - `vendor-react`: `react`, `react-dom`, `react-router-dom`
     - `vendor-ui`: `@radix-ui`, `cmdk`, `class-variance-authority`, `clsx`, `tailwind-merge`
     - `vendor-icons`: `lucide-react`
4. **Constraints**:
   - Max 2 `useState` hooks per component (0 in `ViewLoadingFallback`).
   - Clean production build with all chunks under 500 kB and zero warnings.

## Verification & Proof
- Run `npm run build` in `frontend/` and verify:
  - No single chunk > 500 kB.
  - Distinct `.js` chunks generated for each route view (`LoginView`, `MigrationView`, `AnalyticsView`, etc.).
  - Total initial load size reduced significantly.
- Deploy new bundle to Docker container `telegram_migrator_frontend`.
