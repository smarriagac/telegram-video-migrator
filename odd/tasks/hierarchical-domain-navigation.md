# Feature: Official Shadcn/ui Sidebar Implementation & Hierarchical Domain Navigation

Migrate application layout navigation to the canonical shadcn/ui `Sidebar` primitive suite (`SidebarProvider`, `Sidebar`, `SidebarMenu`, `SidebarMenuSub`, `SidebarRail`, `SidebarTrigger`) with collapsible sub-menu tree lines, domain grouping, and icon rail collapse.

Delivery strategy: single-pr

## Specs
- S1: Canonical Shadcn/ui Primitives Installation:
  - Add `@radix-ui/react-tooltip` and `@radix-ui/react-separator` dependencies.
  - Implement `@/shared/components/ui/separator.tsx`, `@/shared/components/ui/tooltip.tsx`, and `@/shared/lib/use-mobile.ts`.
  - Create `@/shared/components/ui/sidebar.tsx` implementing full official shadcn/ui API.
  - Add sidebar color tokens in `index.css` and `tailwind.config.js`.
- S2: Domain-Driven Information Architecture & Tree Menus:
  - Group 10 modules into 3 macro domains:
    1. **Canales & Audiencia**: Chats & Mensajes (`/chats`), Administrar Canales (`/channels`).
    2. **Clonación & Pipeline**: Hierarchical sub-menu (`SidebarMenuSub`) with tree vertical branch containing Clonador (`/migration`), Sync (`/sync`), Pipeline (`/pipeline`), and Jobs (`/jobs`).
    3. **Plataforma & Control**: Analíticas (`/analytics`), Suscripción (`/billing`), Auditoría (`/audit`), Configuración (`/settings`).
- S3: Architectural Constraints:
  - Maintain strictly maximum 2 `useState` hooks in `AppLayout.tsx`.
  - Full keyboard accessibility (`Cmd+B` / `Ctrl+B` toggle), icon tooltips on collapse.
- S4: Automated Tests & Verification:
  - Verify complete TypeScript compilation (`npm run build`) and backend regression suite (`pytest`).

## Tasks
- [x] T1 (S1): Install Radix primitives and scaffold `separator.tsx`, `tooltip.tsx`, `use-mobile.ts` [inline]
- [x] T2 (S1): Create canonical `sidebar.tsx` and configure sidebar tokens [inline]
- [x] T3 (S2, S3): Refactor `AppLayout.tsx` using official `Sidebar` and `SidebarMenuSub` within 2-hook budget [inline]
- [x] T4 (S4): Compile frontend bundle and run backend test suite [inline]
- [x] T5 (S4): Deploy build to Docker container [inline]
- [x] T6 (S4): Commit and push to git [inline]

## Log
- L1: User requested domain organization of scattered modules following a hierarchical layout.
- L2: User requested integrating the official shadcn/ui Sidebar component with nested sub-menus (`SidebarMenuSub`).
- L3: Installed `@radix-ui/react-tooltip`, `@radix-ui/react-separator`, and scaffolded canonical UI components.
- L4: Implemented official shadcn/ui `Sidebar` suite with collapsible icon rail, `SidebarMenuSub` vertical tree lines, and `SidebarTrigger`.
- L5: Verified hook budget (exactly 1 `useState` hook in `AppLayout.tsx`), 0 TypeScript build errors, and all 108 backend tests passing.

