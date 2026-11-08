# Task: Automated Disaster Recovery & Database Backups (ODD Spec)

## Context & Objectives
In enterprise video migration and multi-channel synchronization, unexpected host crashes, hardware failures, database corruption, or operator errors can lead to critical data loss (e.g. migration history, deduplication fingerprints, scheduled campaigns, and tenant configurations).

This task implements a unified, automated Disaster Recovery & Backup Engine for Telegram Hub:
1. **Self-Contained Database Snapshotting**:
   - Dumps PostgreSQL core tables (`users`, `roles`, `telegram_accounts`, `audit_logs`, `migration_jobs`, `migration_items`, `migration_queue`, `channel_sync_bindings`, `migrated_media_fingerprints`, `video_processing_jobs`, `scheduled_broadcasts`, `app_notifications`).
   - Captures local SQLite database files if active.
   - Generates a cryptographic `manifest.json` containing timestamp, record counts per table, sha256 checksums, and version metadata.
   - Bundles everything into a compressed `.tar.gz` archive stored in the backup directory (`/app/backups` or configurable via `BACKUPS_DIR`).
2. **Automated Retention & Pruning Policy**:
   - Maintains an automated rolling window (default 7 snapshots).
   - Prunes older archives safely when creating new snapshots to prevent disk exhaustion.
3. **Restoration & Verification Engine**:
   - Provides dry-run integrity verification (`POST /api/backups/{snapshot_id}/verify`) to validate archive checksums and schema compatibility without altering live state.
4. **REST API**:
   - `GET /api/backups`: Lists existing snapshots with sizes, timestamps, and table statistics.
   - `POST /api/backups`: Triggers a manual snapshot creation on-demand.
   - `GET /api/backups/{snapshot_id}/download`: Streams the compressed `.tar.gz` archive for off-site disaster recovery storage.
   - `POST /api/backups/{snapshot_id}/verify`: Performs dry-run validation of the backup.
   - `DELETE /api/backups/{snapshot_id}`: Purges an individual backup archive.
5. **Frontend Management Console**:
   - Dedicated "Copias de Seguridad" tab in [`SettingsView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/SettingsView.tsx).
   - Component [`BackupManagerCard.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/settings/presentation/components/BackupManagerCard.tsx) strictly adhering to the `<= 2 useState` architectural rule.
   - Direct download, instant dry-run verification badge, creation trigger, and deletion confirmation modal.
6. **Automated Test Coverage**:
   - Backend pytest suite testing snapshot generation, compression, table counts, retention pruning, and REST endpoints.
   - Frontend Vitest suite testing component rendering, snapshot creation, verification, and deletion.
