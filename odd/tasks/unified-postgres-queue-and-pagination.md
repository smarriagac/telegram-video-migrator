# Feature: Unified Postgres Queue & Message Pagination
Unify migration queue and jobs in PostgreSQL 18 (ACID guarantees, remove dual-DB tech debt) and add cursor-based pagination for Telegram channel messages.
Delivery strategy: single-pr

## Specs
- S1: Unify migration jobs and queue into PostgreSQL 18 via PostgresJobRepository implementing JobRepositoryPort.
- S2: Implement cursor-based pagination in frontend and API to load messages in 100-item chunks with "Cargar más".

## Tasks
- [x] T1 (S1): Write tests for PostgresJobRepository in backend/tests/test_postgres_job_repository.py [inline]
- [x] T2 (S1): Implement PostgresJobRepository in backend/infrastructure/persistence/postgres_job_repository.py [inline]
- [x] T3 (S1): Wire get_job_repository in dependencies.py and main.py lifespan [inline]
- [x] T4 (S2): Update useMigrationStore with loadMoreSourceMessages and pagination state [inline]
- [x] T5 (S2): Add "Cargar más mensajes (+100)" button and pagination controls to MessageSelector [inline]
- [x] T6 (S1, S2): Verify test suite (backend pytest: 30 tests passing) and build frontend [inline]
- [x] T7 (S1, S2): Deploy to Docker and commit with Conventional Commits [inline]

## Log
- L1: User approved migrating queue to PostgreSQL and implementing message pagination.
- L2: Implementado PostgresJobRepository con esquemas migration_jobs, migration_items, migration_queue e índices ACID en PostgreSQL 18.
- L3: Conectado PostgresJobRepository al contenedor de dependencias (dependencies.py). Verificadas tablas creadas en PostgreSQL del contenedor telegram_migrator_postgres.
- L4: Implementada paginación por cursor en useMigrationStore.ts y botón 'Cargar más mensajes (+100)' en MessageSelector.tsx.
- L5: Frontend compilado en 2.29s sin errores y desplegado en contenedor Nginx. 30 tests unitarios y de integración de backend pasando con 100% de éxito.
