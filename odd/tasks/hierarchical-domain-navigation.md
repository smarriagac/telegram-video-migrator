# Feature: Hierarchical Domain Navigation & Information Architecture

Reorganize the flat navigation list in `AppLayout.tsx` into 3 cohesive macro-domains with collapsible section accordions to reduce cognitive load and establish domain-driven information architecture.

Delivery strategy: single-pr

## Specs
- S1: Navigation Domain Schema & Structure:
  - Define `NavDomain` interface clustering navigation items into 3 clear domains:
    1. **Canales & Audiencia**: Chats & Mensajes (`/chats`), Administrar Canales (`/channels`).
    2. **Motor de Clonación & Pipeline**: Clonador de Videos (`/migration`), Sincronización en Vivo (`/sync`), Pipeline & Módulos (`/pipeline`), Cola de Trabajos (`/jobs`).
    3. **Plataforma & Control**: Analíticas (`/analytics`), Suscripción (`/billing`), Auditoría (`/audit`), Configuración (`/settings`).
- S2: Collapsible Accordion & Active State Indicator:
  - Collapsible domain headers with chevron toggle and domain icons.
  - Automatic active route detection that highlights parent domain when a child route is active.
  - Persistent or clean default expansion with smooth accordion toggle.
- S3: Architectural Constraints:
  - Adhere strictly to the maximum 2 `useState` hooks budget in `AppLayout.tsx`.
  - Use canonical shadcn/ui and Lucide icons without raw ad-hoc colors.
- S4: Automated Tests & Verification:
  - Component tests or end-to-end verification ensuring all routes render and active state reflects correctly.

## Tasks
- [x] T1 (S1): Create ODD task specification [inline]
- [x] T2 (S1, S2): Refactor `AppLayout.tsx` with `NavDomain` clustering and accordion toggle within 2-hook budget [inline]
- [x] T3 (S4): Verify and add navigation layout automated tests [inline]
- [x] T4 (S3): Run full frontend build (`npm run build`) and backend tests (`pytest`) [inline]
- [x] T5 (S3): Deploy built assets to Docker container [inline]
- [x] T6 (S3): Git commit and push with conventional commit message [inline]

## Log
- L1: User requested domain organization of scattered modules following a hierarchical layout (Option B - single grouped accordion sidebar).
- L2: Refactored `AppLayout.tsx` into 3 canonical domains (Canales & Audiencia, Clonación & Pipeline, Plataforma & Control) with collapsible accordions and active indicator.
- L3: Verified hook budget constraint (strictly 2 `useState` hooks) and compiled frontend bundle with 0 errors.
