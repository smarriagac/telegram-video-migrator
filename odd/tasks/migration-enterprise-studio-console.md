# Feature: Enterprise Studio Console for Video Cloning (Linear / Vercel Grade)

Eliminate amateur design habits (nested cards, numbered circles, floating down-arrows, emoji labels) and elevate the Video Cloner into an authoritative, enterprise-grade dual-terminal console with hairline grid dividers, horizontal origin/destination symmetry, and a minimal industrial step track.

Delivery strategy: single-pr

## Specs
- S1: Industrial Step Track (`StepperHeader`):
  - Minimal hairline step bar with discrete active indicators (`Canales ──── Selección de Contenido ──── Confirmación y Despacho`).
  - No puffy pill buttons; clean typography with active accent bar.
- S2: Symmetrical Dual-Console for Step 1 (Channels):
  - Side-by-side symmetrical workstation layout:
    - Left wing: Canal Origen with real MTProto avatar, subscriber count, and history badge.
    - Central transfer divider: hairline vertical rule with subtle transfer icon.
    - Right wing: Canal Destino with real MTProto avatar and local upload trigger.
  - Lower shelf: Compact horizontal parameter bar for pipeline rules (captions, drip pacing, auto-sync).
- S3: Step 2 - Full-Width Media Selection:
  - 100% canvas width gallery with crisp grid/list toggle and formal navigation actions.
- S4: Step 3 - Unified Technical Dispatch Sheet:
  - Single-surface executive summary with clear origin/target comparison, media scope, and formal launch button (`Iniciar Clonación MTProto`).
- S5: Architectural Constraints:
  - Maintain strictly maximum 2 `useState` hooks in `MigrationView.tsx`.
  - Zero browser alerts, zero emojis in buttons.
  - 100% automated test compliance.

## Tasks
- [x] T1 (S1): Create ODD task specification [inline]
- [x] T2 (S1, S2): Implement industrial step track and symmetrical dual-console in `MigrationView.tsx` [inline]
- [x] T3 (S4): Implement formal dispatch sheet for Step 3 [inline]
- [x] T4 (S5): Compile frontend bundle and deploy to Docker container [inline]
- [x] T5 (S5): Run full pytest test suite [inline]
- [x] T6 (S5): Git commit and push with conventional commit message [inline]

## Log
- L1: User critiqued the prior wizard design as basic and amateur (nested cards, numbered circles, emojis).
- L2: Upgrading to formal enterprise studio console following Vercel/Linear design principles.
- L3: Removed nested cards, circular numbered badges, and emojis.
- L4: Built industrial hairline step track (`Canales ─── Selección de Videos ─── Confirmación`).
- L5: Implemented symmetrical dual-terminal workstation (Canal Origen | Canal Destino) with lower pipeline parameters shelf.
- L6: Implemented single-surface technical dispatch sheet for Step 3 and verified full test suite.
