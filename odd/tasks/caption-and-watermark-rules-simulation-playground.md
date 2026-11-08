# Task: Caption Transformation & Watermarking Interactive Playground (ODD Spec)

## Context & Objectives
Configuring caption sanitization rules (link stripping, mention replacement, blacklists) and video branding (delogo bounding boxes, text watermarking, placement) without instant feedback causes operator errors and failed migration runs.

This task implements a unified, interactive **Rules & Branding Simulation Playground**:
1. **Rules Simulation Engine**:
   - Evaluates caption transformation in real time using [`CaptionTransformerService`](file:///home/sm/proyectos/telegram-video-migrator/backend/application/services/caption_transformer_service.py).
   - Computes diff statistics: character count reduction, detected links, replaced handles, blacklisted words.
   - Computes exact mathematical coordinates for video delogo presets and text watermark overlays across standard aspect ratios (16:9, 9:16 vertical, 1:1 square).
   - Generates exact FFmpeg `-vf` filter arguments for production auditability.
2. **REST API Endpoint**:
   - `POST /api/video-processing/simulate`: Returns transformed caption, diff metrics, computed watermark/delogo coordinates, and FFmpeg filter command arguments.
3. **Frontend Visual Playground**:
   - Dedicated tab in [`PipelineModulesView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/migration/presentation/PipelineModulesView.tsx) and reusable component [`RulesPlaygroundCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/migration/presentation/components/RulesPlaygroundCard.tsx).
   - Strict architectural rule: `<= 2 useState` hooks.
   - Live visual frame rendering the video aspect ratio, watermark position, background box, and delogo masking zone.
   - Side-by-side caption diff viewer.
   - Copyable FFmpeg filter string.
4. **Automated Verification**:
   - Pytest suite testing simulation logic, geometry calculations, and API endpoint.
   - Vitest suite testing UI frame rendering, real-time updates, and aspect ratio switching.
