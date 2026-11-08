from __future__ import annotations

import csv
from datetime import datetime, timezone
import io
import json
from typing import Any

from backend.domain.entities.audit_log import AuditLog


class ReportExporterService:
    """Generates structured CSV, JSON, and printable HTML reports for audit trails and analytics."""

    @staticmethod
    def generate_audit_csv(logs: list[AuditLog]) -> str:
        """Serializes a list of audit logs into an RFC 4180 compliant CSV string."""
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Write header
        writer.writerow(["id", "timestamp", "user_email", "action", "resource", "ip_address", "details"])

        for log in logs:
            details_str = ""
            if log.details:
                try:
                    details_str = json.dumps(log.details, ensure_ascii=False)
                except Exception:
                    details_str = str(log.details)

            writer.writerow([
                log.id or "",
                log.created_at or "",
                log.user_email or "",
                log.action or "",
                log.resource or "",
                log.ip_address or "",
                details_str,
            ])

        return output.getvalue()

    @staticmethod
    def generate_audit_json(logs: list[AuditLog]) -> str:
        """Serializes a list of audit logs into a clean JSON array."""
        payload = [
            {
                "id": log.id,
                "timestamp": log.created_at,
                "user_email": log.user_email,
                "action": log.action,
                "resource": log.resource,
                "ip_address": log.ip_address,
                "details": log.details,
            }
            for log in logs
        ]
        return json.dumps(payload, indent=2, ensure_ascii=False)

    @staticmethod
    def generate_audit_html(
        logs: list[AuditLog],
        title: str = "Telegram Hub — Registro de Auditoría y Seguridad",
    ) -> str:
        """Generates a professional, self-contained printable HTML report."""
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        total_logs = len(logs)
        unique_users = len({l.user_email for l in logs if l.user_email})
        auth_events = sum(1 for l in logs if l.action in ("LOGIN", "LOGIN_FAILED"))
        migration_events = sum(1 for l in logs if l.action.startswith("MIGRATION_"))

        rows_html = []
        for log in logs:
            details_formatted = ""
            if log.details:
                try:
                    details_formatted = json.dumps(log.details, indent=1, ensure_ascii=False)
                except Exception:
                    details_formatted = str(log.details)

            badge_color = "#3b82f6"
            if "FAIL" in log.action or "DELETE" in log.action or "ERROR" in log.action:
                badge_color = "#ef4444"
            elif "LOGIN" in log.action or "CREATE" in log.action or "SUCCESS" in log.action:
                badge_color = "#10b981"
            elif "MIGRATION" in log.action:
                badge_color = "#6366f1"

            rows_html.append(f"""
            <tr>
              <td class="font-mono">{log.id or '-'}</td>
              <td class="whitespace-nowrap">{log.created_at or '-'}</td>
              <td><strong>{log.user_email or 'Sistema / Bot'}</strong></td>
              <td><span class="badge" style="background-color: {badge_color}1a; color: {badge_color}; border: 1px solid {badge_color}40;">{log.action}</span></td>
              <td class="font-mono text-xs">{log.resource or '-'}</td>
              <td class="font-mono text-xs">{log.ip_address or '-'}</td>
              <td class="details-cell"><pre>{details_formatted or '-'}</pre></td>
            </tr>
            """)

        table_content = "\n".join(rows_html)

        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>{title}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      line-height: 1.5;
      padding: 32px;
    }}
    .header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }}
    .title h1 {{ font-size: 20px; font-weight: 700; color: #0284c7; }}
    .title p {{ font-size: 12px; color: #64748b; margin-top: 4px; }}
    .btn-print {{
      background-color: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }}
    .btn-print:hover {{ background-color: #0369a1; }}
    .kpi-grid {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }}
    .kpi-card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }}
    .kpi-label {{ font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; }}
    .kpi-value {{ font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 4px; }}
    table {{
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      font-size: 12px;
    }}
    th {{
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }}
    td {{
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }}
    tr:nth-child(even) {{ background: #fafafa; }}
    .font-mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }}
    .text-xs {{ font-size: 11px; }}
    .whitespace-nowrap {{ white-space: nowrap; }}
    .badge {{
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      font-family: ui-monospace, monospace;
    }}
    .details-cell pre {{
      font-size: 10px;
      font-family: ui-monospace, monospace;
      color: #334155;
      background: #f8fafc;
      padding: 4px 6px;
      border-radius: 4px;
      max-width: 320px;
      white-space: pre-wrap;
      word-break: break-all;
    }}
    @media print {{
      body {{ background: #ffffff; padding: 0; font-size: 10px; }}
      .btn-print {{ display: none; }}
      .kpi-card {{ border: 1px solid #cbd5e1; }}
      table {{ border: 1px solid #cbd5e1; }}
      th, td {{ padding: 6px 8px; }}
      tr {{ page-break-inside: avoid; }}
    }}
  </style>
</head>
<body>
  <div class="header">
    <div class="title">
      <h1>{title}</h1>
      <p>Generado el {now_str} • Telegram Hub Enterprise Suite</p>
    </div>
    <button class="btn-print" onclick="window.print()">Imprimir / Guardar en PDF</button>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total de Eventos</div>
      <div class="kpi-value">{total_logs}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Usuarios Únicos</div>
      <div class="kpi-value">{unique_users}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Eventos de Autenticación</div>
      <div class="kpi-value">{auth_events}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Operaciones de Migración</div>
      <div class="kpi-value">{migration_events}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Fecha y Hora</th>
        <th>Usuario</th>
        <th>Acción</th>
        <th>Recurso</th>
        <th>IP Origen</th>
        <th>Detalles</th>
      </tr>
    </thead>
    <tbody>
      {table_content}
    </tbody>
  </table>
</body>
</html>
"""
        return html

    @staticmethod
    def generate_analytics_csv(analytics: dict[str, Any]) -> str:
        """Serializes comprehensive analytics and throughput metrics into an RFC 4180 CSV."""
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # 1. Executive Summary
        writer.writerow(["=== RESUMEN EJECUTIVO DE RENDIMIENTO ==="])
        writer.writerow(["Métrica", "Valor"])
        writer.writerow(["Total Videos/Items Migrados", analytics.get("total_items_migrated", 0)])
        writer.writerow(["Ancho de Banda Ahorrado (GB)", analytics.get("total_bandwidth_saved_gb", 0.0)])
        writer.writerow(["Duplicados Prevenidos", analytics.get("duplicates_prevented", 0)])
        writer.writerow(["Total Trabajos de Migración", analytics.get("total_jobs", 0)])
        writer.writerow(["Canales con Sync Activo", analytics.get("active_sync_bindings", 0)])
        writer.writerow(["Eficiencia de Pipeline (%)", analytics.get("efficiency_percent", 99.8)])
        writer.writerow([])

        # 2. Daily Volume
        writer.writerow(["=== VOLUMEN DIARIO DE TRANSFERENCIAS ==="])
        writer.writerow(["Fecha", "Cantidad de Items", "Volumen Estimado (MB)"])
        for dp in analytics.get("daily_volume", []):
            writer.writerow([
                dp.get("date", ""),
                dp.get("count", 0),
                dp.get("estimated_mb", 0.0),
            ])
        writer.writerow([])

        # 3. Top Channels
        writer.writerow(["=== TOP CANALES POR TRÁFICO ==="])
        writer.writerow(["Channel ID", "Título de Canal", "Total Items", "Volumen (GB)"])
        for ch in analytics.get("top_channels", []):
            writer.writerow([
                ch.get("channel_id", ""),
                ch.get("title", ""),
                ch.get("total_items", 0),
                ch.get("volume_gb", 0.0),
            ])
        writer.writerow([])

        # 4. Recent Transfers
        writer.writerow(["=== TRANSFERENCIAS RECIENTES ==="])
        writer.writerow(["Job ID", "Canal Origen", "Canal Destino", "Estado", "Videos Totales", "Videos Procesados", "Fecha Creación"])
        for tr in analytics.get("recent_transfers", []):
            writer.writerow([
                tr.get("job_id", ""),
                tr.get("source_title", ""),
                tr.get("target_title", ""),
                tr.get("status", ""),
                tr.get("total_videos", 0),
                tr.get("processed_videos", 0),
                tr.get("created_at", ""),
            ])

        return output.getvalue()

    @staticmethod
    def generate_analytics_json(analytics: dict[str, Any]) -> str:
        """Serializes analytics overview into indented JSON."""
        return json.dumps(analytics, indent=2, ensure_ascii=False)
