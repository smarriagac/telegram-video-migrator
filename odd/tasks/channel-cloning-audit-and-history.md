# Feature: Channel Cloning Audit and History
Record and expose how many times a channel has been cloned, whether it was a full or selective migration, and the exact content that was cloned.
Delivery strategy: single-pr

## Specs
- S1: Backend persistence & repository methods to query channel cloning history, full/selective clone flags, and audit log of cloned items.
- S2: API endpoints GET /api/channels/{channel_id}/cloning-history and GET /api/channels/{channel_id}/cloned-content.
- S3: Frontend UI component for Channel Cloning Audit & History Modal with execution log and content explorer.
- S4: Visual indicators on media cards showing if an item was previously cloned.

## Tasks
- [x] T1 (S1): Add channel history and cloned content queries to JobRepositoryPort, PostgresJobRepository, and SQLiteJobRepository [inline]
- [x] T2 (S1): Write tests in test_channel_cloning_history.py verifying count, full-clone detection, and cloned content retrieval [inline]
- [x] T3 (S2): Expose API endpoints in channels.py router with Pydantic response models [inline]
- [x] T4 (S3): Create ChannelCloningHistoryModal.tsx in frontend and wire trigger button in MigrationControlPanel.tsx [inline]
- [x] T5 (S4): Wire previously cloned message indicators into MessageSelector.tsx [inline]
- [x] T6 (S1-S4): Run backend test suite (pytest: 32 tests passing) and frontend build (vite) [inline]
- [x] T7 (S1-S4): Deploy to Docker and commit with Conventional Commits [inline]

## Log
- L1: User requested audit trail for how many times a channel was cloned, whether it was a full clone, and what content was cloned.
- L2: Implementadas entidades ChannelCloningHistory y ClonedContentItem; campos is_full_migration, source_title y target_title añadidos a migration_jobs.
- L3: Métodos get_channel_cloning_history y get_cloned_content_for_channel implementados en PostgresJobRepository y SQLiteJobRepository.
- L4: Test suites verificados con test_channel_cloning_history.py (32 tests pasando en 6.04s).
- L5: Creados endpoints GET /api/channels/{channel_id}/cloning-history y GET /api/channels/{channel_id}/cloned-content.
- L6: Creado modal ChannelCloningHistoryModal.tsx con métricas de ejecuciones, alcance de clonación (completo vs parcial) y visor de contenido copiado.
- L7: Añadido botón "Auditar →" en MigrationControlPanel y badge "✓ Clonado" en tarjetas y lightbox de MessageSelector.
- L8: Frontend compilado en 2.35s y desplegado en contenedor Nginx.
