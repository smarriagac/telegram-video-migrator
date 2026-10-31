# Feature: Three Column Layout Redesign
Restructure layout to match user wireframe: Sidebar + Migration Controls ("de", "para") + Full Media Canvas.
Delivery strategy: single-pr

## Specs
- S1: "quisier un disenhio organizado mas o menos asi como en la imagen reestruturalo"

## Tasks
- [x] T1 (S1): Refactor ChannelSelector into a vertical "Migrar Canal" panel with "De" and "Para" controls [inline]
- [x] T2 (S1): Restructure MigrationView into a two-panel desktop layout (Controls Panel + Media Gallery Canvas) [inline]
- [x] T3 (S1): Enhance MessageSelector to fit the media canvas with 4-column responsive grid matching sketch [inline]
- [x] T4 (S1): Move progress bar, queue status, and action triggers into the control panel for cohesive workflow [inline]
- [x] T5 (S1): Test frontend build and verify responsive layout [inline]

## Log
- L1: "quisier un disenhio organizado mas o menos asi como en la imagen reestruturalo"
- L2: Implementado MigrationControlPanel.tsx agrupando verticalmente "De", "Para", botón de acción, barra de progreso, métricas de cola y terminal.
- L3: Actualizado MessageSelector.tsx con título exacto "Mensajes, videos e imágenes del canal a copiar", cuadrícula responsive de 4 columnas en desktop y estado wireframe inicial.
- L4: Reestructurado MigrationView.tsx respetando la restricción arquitectónica (máximo 2 useState hooks) en grid 12 columnas (4 cols panel control, 8 cols canvas de medios).
- L5: Frontend compilado con Vite y desplegado en contenedor Nginx (puerto 7900). 26 tests backend pasando.
