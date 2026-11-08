from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any

from backend.domain.ports.telegram_gateway_port import TelegramGatewayPort
from backend.presentation.dependencies import get_telegram_gateway

logger = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024  # 5 MB standard slice


class BigMediaUploadService:
    """Manages chunked, resumable ingestion of large media files (>2GB) for Telegram MTProto."""

    def __init__(
        self,
        base_dir: str | None = None,
        chunk_size_bytes: int = DEFAULT_CHUNK_SIZE,
    ) -> None:
        self.base_dir = base_dir or os.path.join(tempfile.gettempdir(), "migrator_uploads")
        self.default_chunk_size = chunk_size_bytes
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_session_dir(self, upload_id: str) -> str:
        return os.path.join(self.base_dir, upload_id)

    def _get_meta_path(self, upload_id: str) -> str:
        return os.path.join(self._get_session_dir(upload_id), "meta.json")

    def _read_meta(self, upload_id: str) -> dict[str, Any]:
        meta_path = self._get_meta_path(upload_id)
        if not os.path.exists(meta_path):
            raise ValueError(f"Upload session '{upload_id}' not found.")
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_meta(self, upload_id: str, meta: dict[str, Any]) -> None:
        meta_path = self._get_meta_path(upload_id)
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

    def _get_completed_chunks(self, upload_id: str) -> list[int]:
        session_dir = self._get_session_dir(upload_id)
        if not os.path.exists(session_dir):
            return []
        completed = []
        for entry in os.scandir(session_dir):
            if entry.is_file() and entry.name.startswith("part_") and entry.name.endswith(".bin"):
                try:
                    idx_str = entry.name.replace("part_", "").replace(".bin", "")
                    completed.append(int(idx_str))
                except ValueError:
                    pass
        completed.sort()
        return completed

    async def init_session(
        self,
        filename: str,
        file_size_bytes: int,
        mime_type: str,
        target_channel_id: int,
        caption: str | None = None,
        account_id: int | None = None,
        chunk_size: int | None = None,
    ) -> dict[str, Any]:
        """Initialize a new resumable chunked upload session."""
        upload_id = str(uuid.uuid4())
        session_dir = self._get_session_dir(upload_id)
        os.makedirs(session_dir, exist_ok=True)

        actual_chunk_size = chunk_size or self.default_chunk_size
        total_chunks = max(1, math.ceil(file_size_bytes / actual_chunk_size))

        meta = {
            "upload_id": upload_id,
            "filename": filename,
            "file_size_bytes": file_size_bytes,
            "mime_type": mime_type,
            "target_channel_id": target_channel_id,
            "caption": caption or "",
            "account_id": account_id,
            "chunk_size": actual_chunk_size,
            "total_chunks": total_chunks,
            "created_at": time.time(),
            "status": "UPLOADING",
        }
        self._write_meta(upload_id, meta)

        logger.info(
            f"BigMediaUpload: Initialized session {upload_id} for '{filename}' "
            f"({round(file_size_bytes / (1024**2), 2)} MB, {total_chunks} chunks)."
        )

        return meta

    async def save_chunk(
        self,
        upload_id: str,
        chunk_index: int,
        chunk_bytes: bytes,
    ) -> dict[str, Any]:
        """Save a single chunk to the upload session scratchpad."""
        meta = self._read_meta(upload_id)
        if chunk_index < 0 or chunk_index >= meta["total_chunks"]:
            raise ValueError(
                f"Chunk index {chunk_index} out of bounds (total chunks: {meta['total_chunks']})."
            )

        session_dir = self._get_session_dir(upload_id)
        chunk_filename = f"part_{chunk_index:05d}.bin"
        chunk_path = os.path.join(session_dir, chunk_filename)

        # Write chunk bytes directly to disk
        with open(chunk_path, "wb") as f:
            f.write(chunk_bytes)

        # Apply network bandwidth shaper
        try:
            from backend.application.services.rate_governor_service import get_rate_governor_service
            gov = get_rate_governor_service()
            await gov.throttle_bandwidth(len(chunk_bytes))
        except Exception:
            pass

        completed = self._get_completed_chunks(upload_id)
        progress = round((len(completed) / meta["total_chunks"]) * 100.0, 1)

        return {
            "upload_id": upload_id,
            "chunk_index": chunk_index,
            "completed_chunks": completed,
            "progress_percent": progress,
        }

    async def get_session_status(self, upload_id: str) -> dict[str, Any]:
        """Retrieve progress, completed and missing chunks for resume capability."""
        meta = self._read_meta(upload_id)
        completed = self._get_completed_chunks(upload_id)
        completed_set = set(completed)
        total_chunks = meta["total_chunks"]

        missing = [i for i in range(total_chunks) if i not in completed_set]
        progress = round((len(completed) / total_chunks) * 100.0, 1)

        return {
            "upload_id": upload_id,
            "filename": meta["filename"],
            "file_size_bytes": meta["file_size_bytes"],
            "chunk_size": meta["chunk_size"],
            "total_chunks": total_chunks,
            "completed_chunks": completed,
            "missing_chunks": missing,
            "progress_percent": progress,
            "status": meta.get("status", "UPLOADING"),
        }

    async def complete_and_transmit(
        self,
        upload_id: str,
        gateway: TelegramGatewayPort | None = None,
    ) -> dict[str, Any]:
        """Assemble received chunks into a continuous stream and dispatch to Telegram MTProto."""
        meta = self._read_meta(upload_id)
        completed = self._get_completed_chunks(upload_id)
        total_chunks = meta["total_chunks"]

        if len(completed) < total_chunks:
            missing = [i for i in range(total_chunks) if i not in set(completed)]
            raise ValueError(
                f"Cannot complete upload: {len(missing)} chunks missing ({missing[:5]}...)."
            )

        meta["status"] = "ASSEMBLING"
        self._write_meta(upload_id, meta)

        session_dir = self._get_session_dir(upload_id)
        clean_name = Path(meta["filename"]).name
        assembled_path = os.path.join(session_dir, f"assembled_{clean_name}")

        # Assemble chunks sequentially using 64KB buffer streaming
        logger.info(f"BigMediaUpload: Assembling {total_chunks} chunks for '{clean_name}'...")
        with open(assembled_path, "wb") as out_f:
            for idx in range(total_chunks):
                chunk_file = os.path.join(session_dir, f"part_{idx:05d}.bin")
                with open(chunk_file, "rb") as in_f:
                    shutil.copyfileobj(in_f, out_f, length=64 * 1024)

        meta["status"] = "TRANSMITTING"
        self._write_meta(upload_id, meta)

        target_channel_id = meta["target_channel_id"]
        caption = meta.get("caption")

        if gateway is None:
            gateway = await get_telegram_gateway()

        try:
            logger.info(
                f"BigMediaUpload: Transmitting '{clean_name}' to Telegram channel {target_channel_id}..."
            )
            msg = await gateway.send_local_media(
                channel_id=target_channel_id,
                file_path=assembled_path,
                caption=caption,
            )

            meta["status"] = "COMPLETED"
            self._write_meta(upload_id, meta)

            raw_text = getattr(msg, "text", None)
            result = {
                "success": True,
                "upload_id": upload_id,
                "message_id": msg.id,
                "channel_id": msg.channel_id,
                "file_size": msg.file_size or meta["file_size_bytes"],
                "text": str(raw_text) if isinstance(raw_text, str) else None,
            }

            # Cleanup session directory
            self.cancel_session_sync(upload_id)
            return result

        except Exception as e:
            meta["status"] = "FAILED"
            self._write_meta(upload_id, meta)
            logger.error(f"BigMediaUpload: Transmission failed for session {upload_id}: {e}", exc_info=True)
            raise

    def cancel_session_sync(self, upload_id: str) -> bool:
        session_dir = self._get_session_dir(upload_id)
        if os.path.exists(session_dir):
            try:
                shutil.rmtree(session_dir, ignore_errors=True)
                return True
            except Exception as e:
                logger.warning(f"Failed to cleanup session dir {session_dir}: {e}")
        return False

    async def cancel_session(self, upload_id: str) -> bool:
        """Cancel an in-progress upload session and free scratch storage."""
        return await asyncio.to_thread(self.cancel_session_sync, upload_id)


_big_media_service: BigMediaUploadService | None = None


def get_big_media_upload_service() -> BigMediaUploadService:
    global _big_media_service
    if _big_media_service is None:
        _big_media_service = BigMediaUploadService()
    return _big_media_service
