# Feature: Message Selection and Queue System
Interactive message listing before migration and persistent queued execution.
Delivery strategy: single-pr

## Specs
- S1: "necesito tambien poder listar los mensajes antes de clonar para poder decidir cual quiero reenviar al nuevo canal"
- S2: "ademas disenhiar un sistema de encolado para guardar el progreso que se vaya teniendo"
- S3: "actualiza la forma de trabajo usa, odd con tdd de gentle-ai"

## Tasks
- [x] T1 (S1): Add channel message listing port & adapter with metadata (media type, size, date, text) [inline] (commit: 7fa9454)
- [x] T2 (S1): Expose GET /channels/{channel_id}/messages API endpoint with pagination and unit tests [inline] (commit: 7fa9454)
- [x] T3 (S2): Design SQLite persistent queue schema and repository methods for queue items (PENDING, IN_PROGRESS, COMPLETED, FAILED) with TDD [inline] (commit: 7fa9454)
- [x] T4 (S2): Update migration use case to build queue and execute migrations item-by-item from queue [inline] (commit: 7fa9454)
- [x] T5 (S1, S2): Expose queue status & selective start in POST /jobs API endpoint [inline] (commit: 7fa9454)
- [x] T6 (S1, S2): Implement frontend message selector table/grid with checkboxes, select-all, and queue progress view [inline] (commit: 7fa9454)
- [x] T7 (S3): End-to-end verification and full test suite execution [inline] (commit: 7fa9454)

## Log
- L1: "necesito tambien poder listar los mensajes antes de clonar para poder decidir cual quiero reenviar al nuevo canal, ademas disenhiar un sistema de encolado para guardar el progreso que se vaya teniendo, actualiza la forma de trabajo usa, odd con tdd de gentle-ai"
