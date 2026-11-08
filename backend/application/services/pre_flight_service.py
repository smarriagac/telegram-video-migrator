from __future__ import annotations

from dataclasses import dataclass, field
import logging
import os
import shutil
import tempfile
from typing import Any

from backend.domain.ports.job_repository_port import JobRepositoryPort
from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.infrastructure.telegram.telegram_client_pool import TelegramClientPool

logger = logging.getLogger(__name__)


@dataclass
class PreFlightRequest:
    """Input parameters for migration pre-flight validation."""

    source_channel_id: int
    target_channel_id: int
    selected_message_ids: list[int] | None = None
    source_account_id: int | None = None
    target_account_id: int | None = None
    watermark_enabled: bool = False
    drip_delay_seconds: int = 0
    tenant_id: str | None = None


@dataclass
class PreFlightReport:
    """Pre-flight verification report assessing readiness, deltas, and resource limits."""

    can_proceed: bool = True
    source_channel_id: int = 0
    target_channel_id: int = 0
    source_title: str | None = None
    target_title: str | None = None
    total_requested_items: int = 0
    already_cloned_items: int = 0
    new_items_to_migrate: int = 0
    target_writable: bool = True
    account_ready: bool = True
    cooldown_seconds: int = 0
    estimated_disk_required_mb: float = 0.0
    disk_space_available_mb: float = 0.0
    estimated_duration_seconds: int = 0
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "can_proceed": self.can_proceed,
            "source_channel_id": self.source_channel_id,
            "target_channel_id": self.target_channel_id,
            "source_title": self.source_title,
            "target_title": self.target_title,
            "total_requested_items": self.total_requested_items,
            "already_cloned_items": self.already_cloned_items,
            "new_items_to_migrate": self.new_items_to_migrate,
            "target_writable": self.target_writable,
            "account_ready": self.account_ready,
            "cooldown_seconds": self.cooldown_seconds,
            "estimated_disk_required_mb": round(self.estimated_disk_required_mb, 1),
            "disk_space_available_mb": round(self.disk_space_available_mb, 1),
            "estimated_duration_seconds": self.estimated_duration_seconds,
            "warnings": self.warnings,
            "errors": self.errors,
        }


class PreFlightService:
    """
    Validates migration parameters before job creation.
    Performs dry-run checks on permissions, FloodWait cooldowns, duplicate items, and disk storage.
    """

    def __init__(
        self,
        job_repo: JobRepositoryPort,
        gateway: TelegramGatewayPort,
        client_pool: TelegramClientPool | None = None,
    ) -> None:
        self.repo = job_repo
        self.gateway = gateway
        self.pool = client_pool

    async def validate(self, req: PreFlightRequest) -> PreFlightReport:
        report = PreFlightReport(
            source_channel_id=req.source_channel_id,
            target_channel_id=req.target_channel_id,
        )

        # 1. Fetch channel info & verify target channel posting permissions
        try:
            channels = await self.gateway.get_managed_channels(account_id=req.target_account_id)
            target_ch = None
            source_ch = None

            for ch in channels:
                if ch.id == req.target_channel_id or str(ch.id).endswith(str(abs(req.target_channel_id))[-10:]):
                    target_ch = ch
                if ch.id == req.source_channel_id or str(ch.id).endswith(str(abs(req.source_channel_id))[-10:]):
                    source_ch = ch

            if source_ch:
                report.source_title = source_ch.title

            if target_ch:
                report.target_title = target_ch.title
                if not getattr(target_ch, "can_post", True):
                    report.target_writable = False
                    report.errors.append(
                        f"La cuenta no tiene permisos de publicación ('can_post') en el canal destino '{target_ch.title}'."
                    )
            else:
                report.warnings.append(
                    "No se pudo verificar la membresía administrativa en el canal destino en la lista gestionada."
                )
        except Exception as e:
            logger.warning(f"PreFlight: Error checking managed channels: {e}")
            report.warnings.append("No se pudieron verificar los permisos del canal en vivo.")

        # 2. Check FloodWait cooldown for target account
        if self.pool and req.target_account_id is not None:
            is_cooling, remaining = self.pool.is_account_on_cooldown(req.target_account_id)
            if is_cooling:
                report.account_ready = False
                report.cooldown_seconds = remaining
                report.warnings.append(
                    f"La cuenta #{req.target_account_id} está en FloodWait ({remaining}s restantes). La migración rotará de cuenta automáticamente si hay alternativas."
                )

        # 3. Deduplication and Delta Analysis
        try:
            cloned_ids = await self.repo.get_cloned_source_message_ids(
                req.source_channel_id, req.target_channel_id
            )
            if req.selected_message_ids:
                selected_set = set(req.selected_message_ids)
                already_cloned = selected_set.intersection(cloned_ids)
                report.total_requested_items = len(selected_set)
                report.already_cloned_items = len(already_cloned)
                report.new_items_to_migrate = len(selected_set) - len(already_cloned)

                if len(already_cloned) > 0:
                    report.warnings.append(
                        f"{len(already_cloned)} de {len(selected_set)} mensajes seleccionados ya existen en el canal destino y se omitirán."
                    )
                if report.new_items_to_migrate == 0 and len(selected_set) > 0:
                    report.warnings.append("Todos los videos seleccionados ya han sido migrados previamente.")
            else:
                report.total_requested_items = 0
                report.already_cloned_items = len(cloned_ids)
                report.new_items_to_migrate = 0
        except Exception as e:
            logger.warning(f"PreFlight: Error calculating cloned delta: {e}")

        # 4. Host disk space verification & Time estimation
        try:
            usage = shutil.disk_usage(tempfile.gettempdir())
            report.disk_space_available_mb = usage.free / (1024 * 1024)
        except Exception:
            report.disk_space_available_mb = 1024.0

        items_count = report.new_items_to_migrate or (
            report.total_requested_items if report.total_requested_items > 0 else 20
        )

        # Approximate 30 MB per video buffer, or 60 MB if watermarking requires re-encoding
        per_item_mb = 60.0 if req.watermark_enabled else 30.0
        report.estimated_disk_required_mb = min(per_item_mb * min(items_count, 5), 500.0)

        if report.estimated_disk_required_mb > (report.disk_space_available_mb * 0.9):
            report.warnings.append(
                f"Espacio temporal ajustado: se estiman ~{report.estimated_disk_required_mb:.0f} MB pero solo quedan {report.disk_space_available_mb:.0f} MB libres."
            )

        # Time estimation: base ~4s copy + 12s if watermark + drip delay
        sec_per_item = (16 if req.watermark_enabled else 4) + max(0, req.drip_delay_seconds)
        report.estimated_duration_seconds = items_count * sec_per_item

        # 5. Evaluate final proceed decision
        report.can_proceed = len(report.errors) == 0

        return report
