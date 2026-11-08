# Task: Frontend Automated Testing Harness with Vitest & Testing Library

## Problem Statement
While the backend has 146 automated tests with 100% coverage, the frontend codebase currently lacks an automated test runner (`npm test` does not exist). Without automated regression testing for UI state stores, role-based access, and critical presentation components, changes risk introducing silent UI regressions in production.

## Target Architecture & Solution
1. **Testing Infrastructure Configuration**:
   - Configure Vitest in [`frontend/vitest.config.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/vitest.config.ts) with `jsdom` environment and path aliases matching `vite.config.ts`.
   - Create test setup file [`frontend/src/test/setup.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/test/setup.ts) importing `@testing-library/jest-dom/vitest` and mocking browser APIs (e.g. `matchMedia`, `ResizeObserver`).
   - Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json`.
2. **Unit & Store Test Coverage**:
   - [`frontend/src/features/auth/application/__tests__/useAuthStore.test.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/auth/application/__tests__/useAuthStore.test.ts):
     - Authentication lifecycle (login, persist token, logout).
     - RBAC helper and initial state.
   - [`frontend/src/shared/lib/__tests__/useThemeStore.test.ts`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/shared/lib/__tests__/useThemeStore.test.ts):
     - Theme toggling between light and dark modes.
3. **Component & Accessibility Test Coverage**:
   - [`frontend/src/shared/components/__tests__/ViewLoadingFallback.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/shared/components/__tests__/ViewLoadingFallback.test.tsx):
     - Accessible role `status`, live region, and custom loading messages.
   - [`frontend/src/shared/components/__tests__/NotificationBell.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/shared/components/__tests__/NotificationBell.test.tsx):
     - Dynamic unread count badge display.
     - Dropdown feed rendering and mark-as-read integration.
4. **Verification**:
   - `npm test` runs all tests cleanly in under 5 seconds.
   - Production build `npm run build` continues to succeed without type or bundling errors.
