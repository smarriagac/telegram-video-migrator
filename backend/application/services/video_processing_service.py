from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("telegram_migrator.video_processing")


class VideoProcessingService:
    def __init__(self, pg_repo: Any, gateway_provider: Any) -> None:
        self.pg_repo = pg_repo
        self.gateway_provider = gateway_provider
        self._running = False
        self._worker_task: asyncio.Task[None] | None = None
        self._semaphore = asyncio.Semaphore(1)  # Limit concurrent FFmpeg jobs to protect CPU

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._consumer_loop())
        logger.info("VideoProcessingService: Background worker started.")

    async def stop(self) -> None:
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("VideoProcessingService: Background worker stopped.")

    async def enqueue_job(
        self,
        tenant_id: str,
        source_channel_id: int,
        source_message_id: int,
        target_channel_id: int,
        filter_type: str = "delogo",
        filter_params: dict[str, Any] | None = None,
        source_channel_title: str | None = None,
        target_channel_title: str | None = None,
        account_id: int | None = None,
        new_caption: str | None = None,
    ) -> dict[str, Any]:
        """Enqueue a new video delogo / watermark removal processing job."""
        job_id = str(uuid.uuid4())
        params = filter_params or {"preset": "center"}
        now = datetime.now(timezone.utc)

        await self.pg_repo.connect()
        async with self.pg_repo.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO video_processing_jobs (
                    id, tenant_id, source_channel_id, source_channel_title,
                    source_message_id, target_channel_id, target_channel_title,
                    filter_type, filter_params, status, progress, new_caption,
                    account_id, created_at, updated_at
                ) VALUES (
                    $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::jsonb,
                    'PENDING', 0.0, $10, $11, $12, $12
                )
                """,
                job_id,
                tenant_id,
                source_channel_id,
                source_channel_title,
                source_message_id,
                target_channel_id,
                target_channel_title,
                filter_type,
                json.dumps(params),
                new_caption,
                account_id,
                now,
            )

        logger.info(
            f"VideoProcessing: Enqueued job {job_id} for channel {source_channel_id} msg #{source_message_id} -> {target_channel_id}"
        )
        return {
            "id": job_id,
            "status": "PENDING",
            "source_channel_id": source_channel_id,
            "source_message_id": source_message_id,
            "target_channel_id": target_channel_id,
            "filter_type": filter_type,
            "filter_params": params,
        }

    async def list_jobs(self, tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
        """List active and recent video processing jobs."""
        await self.pg_repo.connect()
        async with self.pg_repo.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, tenant_id, source_channel_id, source_channel_title,
                       source_message_id, target_channel_id, target_channel_title,
                       filter_type, filter_params, status, progress, original_caption,
                       new_caption, target_message_id, error_message, account_id,
                       created_at, updated_at
                FROM video_processing_jobs
                WHERE tenant_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT $2
                """,
                tenant_id,
                limit,
            )
            return [
                {
                    "id": str(r["id"]),
                    "tenant_id": str(r["tenant_id"]),
                    "source_channel_id": r["source_channel_id"],
                    "source_channel_title": r["source_channel_title"],
                    "source_message_id": r["source_message_id"],
                    "target_channel_id": r["target_channel_id"],
                    "target_channel_title": r["target_channel_title"],
                    "filter_type": r["filter_type"],
                    "filter_params": json.loads(r["filter_params"]) if isinstance(r["filter_params"], str) else (r["filter_params"] or {}),
                    "status": r["status"],
                    "progress": r["progress"],
                    "original_caption": r["original_caption"],
                    "new_caption": r["new_caption"],
                    "target_message_id": r["target_message_id"],
                    "error_message": r["error_message"],
                    "account_id": r["account_id"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                }
                for r in rows
            ]

    async def cancel_job(self, tenant_id: str, job_id: str) -> bool:
        """Cancel a pending or running job."""
        await self.pg_repo.connect()
        async with self.pg_repo.pool.acquire() as conn:
            res = await conn.execute(
                """
                UPDATE video_processing_jobs
                SET status = 'CANCELLED', updated_at = NOW()
                WHERE id = $1::uuid AND tenant_id = $2::uuid AND status IN ('PENDING', 'DOWNLOADING', 'PROCESSING')
                """,
                job_id,
                tenant_id,
            )
            return "UPDATE 1" in res

    async def delete_job(self, tenant_id: str, job_id: str) -> bool:
        """Delete a completed or failed job record."""
        await self.pg_repo.connect()
        async with self.pg_repo.pool.acquire() as conn:
            res = await conn.execute(
                """
                DELETE FROM video_processing_jobs
                WHERE id = $1::uuid AND tenant_id = $2::uuid
                """,
                job_id,
                tenant_id,
            )
            return "DELETE 1" in res

    async def _consumer_loop(self) -> None:
        """Background FIFO consumer loop."""
        while self._running:
            try:
                job = await self._fetch_next_pending()
                if not job:
                    await asyncio.sleep(2.0)
                    continue

                async with self._semaphore:
                    await self._execute_job(job)

            except asyncio.CancelledError:
                break
            except Exception as ex:
                logger.error(f"VideoProcessingService consumer error: {ex}", exc_info=True)
                await asyncio.sleep(3.0)

    async def _fetch_next_pending(self) -> dict[str, Any] | None:
        await self.pg_repo.connect()
        if not self.pg_repo.pool:
            return None
        async with self.pg_repo.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, tenant_id, source_channel_id, source_message_id,
                       target_channel_id, filter_type, filter_params, account_id, new_caption
                FROM video_processing_jobs
                WHERE status = 'PENDING'
                ORDER BY created_at ASC
                LIMIT 1
                """
            )
            if not row:
                return None
            return {
                "id": str(row["id"]),
                "tenant_id": str(row["tenant_id"]),
                "source_channel_id": row["source_channel_id"],
                "source_message_id": row["source_message_id"],
                "target_channel_id": row["target_channel_id"],
                "filter_type": row["filter_type"],
                "filter_params": json.loads(row["filter_params"]) if isinstance(row["filter_params"], str) else (row["filter_params"] or {}),
                "account_id": row["account_id"],
                "new_caption": row["new_caption"],
            }

    async def _update_job_status(
        self,
        job_id: str,
        status: str,
        progress: float,
        error_message: str | None = None,
        target_message_id: int | None = None,
    ) -> None:
        try:
            async with self.pg_repo.pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE video_processing_jobs
                    SET status = $2, progress = $3, error_message = $4,
                        target_message_id = COALESCE($5, target_message_id),
                        updated_at = NOW()
                    WHERE id = $1::uuid
                    """,
                    job_id,
                    status,
                    progress,
                    error_message,
                    target_message_id,
                )
        except Exception as ex:
            logger.warning(f"Error updating video job status: {ex}")

    async def _execute_job(self, job: dict[str, Any]) -> None:
        job_id = job["id"]
        source_channel_id = job["source_channel_id"]
        source_message_id = job["source_message_id"]
        target_channel_id = job["target_channel_id"]
        account_id = job.get("account_id")
        filter_type = job.get("filter_type", "delogo")
        filter_params = job.get("filter_params", {})
        new_caption = job.get("new_caption")

        tmp_dir = f"/tmp/sanitizer_{job_id}"
        os.makedirs(tmp_dir, exist_ok=True)
        input_path = os.path.join(tmp_dir, "input.mp4")
        output_path = os.path.join(tmp_dir, "output.mp4")

        try:
            logger.info(f"VideoProcessing: Starting job {job_id}...")
            await self._update_job_status(job_id, "DOWNLOADING", 10.0)

            # 1. Fetch Telegram Gateway client
            gateway = self.gateway_provider()
            client = await gateway._get_client(account_id)
            if not client:
                raise RuntimeError("Telegram client not available for download.")

            src_entity = await client.get_input_entity(source_channel_id)
            source_msg = await client.get_messages(src_entity, ids=source_message_id)
            if not source_msg or not source_msg.media:
                raise RuntimeError(f"Message #{source_message_id} has no media in channel {source_channel_id}")

            caption = new_caption if new_caption is not None else (source_msg.text or "")

            # 2. Download media
            logger.info(f"VideoProcessing: Downloading msg #{source_message_id} to {input_path}...")
            downloaded = await client.download_media(source_msg, file=input_path)
            if not downloaded or not os.path.exists(downloaded):
                raise RuntimeError(f"Failed to download media for msg #{source_message_id}")

            await self._update_job_status(job_id, "PROCESSING", 35.0)

            # 3. Probe video width and height using ffprobe
            width, height = await self._probe_video_dimensions(input_path)
            logger.info(f"VideoProcessing: Probed video dimensions: {width}x{height}")

            # 4. Compute filter coordinates
            delogo_filter = self._build_delogo_filter(filter_type, filter_params, width, height)
            logger.info(f"VideoProcessing: Applying filter: {delogo_filter}")

            # 5. Run FFmpeg
            ffmpeg_cmd = [
                "ffmpeg",
                "-y",
                "-i", input_path,
                *delogo_filter,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "copy",
                output_path,
            ]

            proc = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                err_msg = stderr.decode(errors="replace")[-500:]
                raise RuntimeError(f"FFmpeg processing failed (exit {proc.returncode}): {err_msg}")

            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                raise RuntimeError("FFmpeg generated empty output file.")

            await self._update_job_status(job_id, "UPLOADING", 80.0)

            # 6. Upload processed video to target channel
            logger.info(f"VideoProcessing: Uploading cleaned video to channel {target_channel_id}...")
            target_entity = await client.get_input_entity(target_channel_id)
            sent_msg = await client.send_file(
                target_entity,
                file=output_path,
                caption=caption,
                supports_streaming=True,
            )
            sent_msg_id = getattr(sent_msg, "id", None)

            await self._update_job_status(job_id, "COMPLETED", 100.0, target_message_id=sent_msg_id)
            logger.info(f"VideoProcessing: Job {job_id} COMPLETED successfully! Sent msg #{sent_msg_id}")

        except Exception as ex:
            logger.error(f"VideoProcessing: Job {job_id} failed: {ex}", exc_info=True)
            await self._update_job_status(job_id, "FAILED", 0.0, error_message=str(ex))
        finally:
            # Always cleanup temporary directory
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass

    async def _probe_video_dimensions(self, video_path: str) -> tuple[int, int]:
        """Use ffprobe to determine width and height."""
        try:
            cmd = [
                "ffprobe",
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "csv=s=x:p=0",
                video_path,
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            out_str = stdout.decode().strip()
            if "x" in out_str:
                parts = out_str.split("x")
                w, h = int(parts[0]), int(parts[1])
                return w, h
        except Exception as e:
            logger.warning(f"Could not probe video dimensions with ffprobe: {e}. Defaulting to 1080x1920.")

        return 1080, 1920

    def _build_delogo_filter(
        self, filter_type: str, params: dict[str, Any], width: int, height: int
    ) -> list[str]:
        preset = params.get("preset", "center")

        if preset == "center":
            w = max(int(width * 0.52), 60)
            h = max(int(height * 0.22), 40)
            x = max(int((width - w) / 2), 0)
            y = max(int((height - h) / 2), 0)
        elif preset == "top_right":
            w = max(int(width * 0.35), 60)
            h = max(int(height * 0.15), 40)
            x = max(width - w - 15, 0)
            y = 15
        elif preset == "bottom_right":
            w = max(int(width * 0.35), 60)
            h = max(int(height * 0.15), 40)
            x = max(width - w - 15, 0)
            y = max(height - h - 15, 0)
        elif preset == "bottom_bar":
            w = width
            h = max(int(height * 0.16), 40)
            x = 0
            y = max(height - h, 0)
        elif preset == "custom":
            x = int(params.get("x", 0))
            y = int(params.get("y", 0))
            w = int(params.get("w", 100))
            h = int(params.get("h", 100))
            # Bound check
            x = max(min(x, width - 10), 0)
            y = max(min(y, height - 10), 0)
            w = max(min(w, width - x), 10)
            h = max(min(h, height - y), 10)
        else:
            # Default center
            w = max(int(width * 0.50), 60)
            h = max(int(height * 0.20), 40)
            x = max(int((width - w) / 2), 0)
            y = max(int((height - h) / 2), 0)

        if filter_type == "blur":
            # Box blur over bounding box
            filter_str = f"[0:v]crop={w}:{h}:{x}:{y},boxblur=15[fg];[0:v][fg]overlay={x}:{y}"
            return ["-filter_complex", filter_str]

        # Default: delogo (intelligent gradient interpolation)
        filter_str = f"delogo=x={x}:y={y}:w={w}:h={h}:show=0"
        return ["-vf", filter_str]
