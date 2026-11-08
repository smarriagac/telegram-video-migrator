# Task: Audit Trail & Performance Metrics Report Exporter (ODD Spec)

## Context & Objectives
In enterprise multi-channel operations, system administrators and compliance auditors need to extract security audit trails, operational events, and system throughput metrics for compliance reporting, SLA tracking, and external business intelligence (BI) pipelines.

This task implements a dedicated Report Exporter Engine for Telegram Hub:
1. **Multi-Format Audit Export Engine**:
   - **CSV**: RFC 4180 compliant export with columns `id`, `timestamp`, `user_email`, `action`, `resource`, `ip_address`, and sanitized `details`.
   - **JSON**: Full hierarchical JSON export including parsed event payloads.
   - **HTML / PDF Printable Report**: Clean, corporate-styled, self-contained printable HTML document with KPI summary boxes and print-friendly CSS rules (`@media print`).
2. **Analytics & Performance Metrics Export Engine**:
   - **CSV & JSON**: Structured report capturing migration throughput, bandwidth saved (GB), deduplication statistics, daily migration volumes, and top channel rankings.
3. **REST API Endpoints**:
   - `GET /api/audit/export?format=csv|json|html&action=...&user_email=...&limit=...`: Streams formatted audit reports with appropriate headers (`text/csv`, `application/json`, or `text/html`).
   - `GET /api/analytics/export?format=csv|json`: Streams analytics and performance summaries with RFC 4180 compliance.
4. **Frontend Integration**:
   - In [`AuditView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/audit/presentation/AuditView.tsx): Export action menu allowing instantaneous CSV, JSON, and Printable HTML report download, respecting active filters and `<= 2 useState` architectural constraint.
   - In [`AnalyticsView.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/analytics/presentation/AnalyticsView.tsx): Export buttons for CSV and JSON metrics summaries, respecting `<= 2 useState` constraint.
5. **Automated Verification**:
   - Pytest suite testing CSV formatting, JSON serialization, HTML generation, and REST endpoint streaming.
   - Vitest suite testing UI export interactions and download triggers.
