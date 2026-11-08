from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("telegram_migrator.video_processing")

TRANSCODING_PRESETS: dict[str, dict[str, Any]] = {
    "ORIGINAL": {
        "id": "ORIGINAL",
        "label": "Original (Sin Escalar)",
        "description": "Mantiene resolución original del archivo fuente.",
        "max_width": None,
        "default_crf": 23,
        "max_bitrate_k": None,
        "audio_codec": "copy",
    },
    "1080p": {
        "id": "1080p",
        "label": "1080p Full HD",
        "description": "Ideal para contenido de alta fidelidad. Downsampling inteligente si supera 1920px.",
        "max_width": 1920,
        "default_crf": 22,
        "max_bitrate_k": 4500,
        "audio_codec": "aac",
        "audio_bitrate": "160k",
    },
    "720p": {
        "id": "720p",
        "label": "720p HD (Recomendado)",
        "description": "Equilibrio óptimo entre velocidad de migración, consumo de ancho de banda y nitidez en móviles.",
        "max_width": 1280,
        "default_crf": 24,
        "max_bitrate_k": 2500,
        "audio_codec": "aac",
        "audio_bitrate": "128k",
    },
    "480p": {
        "id": "480p",
        "label": "480p SD (Ahorro Máximo)",
        "description": "Reduce drásticamente el peso y el tiempo de carga para canales masivos o redes lentas.",
        "max_width": 854,
        "default_crf": 26,
        "max_bitrate_k": 1200,
        "audio_codec": "aac",
        "audio_bitrate": "96k",
    },
}


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

    async def retry_job(self, tenant_id: str, job_id: str) -> bool:
        """Retry a failed or cancelled job."""
        await self.pg_repo.connect()
        async with self.pg_repo.pool.acquire() as conn:
            res = await conn.execute(
                """
                UPDATE video_processing_jobs
                SET status = 'PENDING', progress = 0.0, error_message = NULL, updated_at = NOW()
                WHERE id = $1::uuid AND tenant_id = $2::uuid AND status IN ('FAILED', 'CANCELLED')
                """,
                job_id,
                tenant_id,
            )
            return "UPDATE 1" in res

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
    ) -> bool:
        try:
            async with self.pg_repo.pool.acquire() as conn:
                res = await conn.execute(
                    """
                    UPDATE video_processing_jobs
                    SET status = $2, progress = $3, error_message = $4,
                        target_message_id = COALESCE($5, target_message_id),
                        updated_at = NOW()
                    WHERE id = $1::uuid AND status != 'CANCELLED'
                    """,
                    job_id,
                    status,
                    progress,
                    error_message,
                    target_message_id,
                )
                return "UPDATE 1" in res
        except Exception as ex:
            logger.warning(f"Error updating video job status: {ex}")
            return False

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

        try:
            logger.info(f"VideoProcessing: Starting job {job_id}...")
            await self._update_job_status(job_id, "DOWNLOADING", 10.0)

            # 1. Fetch Telegram Gateway client
            tenant_id = job.get("tenant_id")
            if inspect.iscoroutinefunction(self.gateway_provider):
                gateway = await self.gateway_provider(tenant_id)
            else:
                gw_res = self.gateway_provider(tenant_id)
                if inspect.isawaitable(gw_res):
                    gateway = await gw_res
                else:
                    gateway = gw_res

            client = gateway._get_client(account_id)
            if not client:
                raise RuntimeError("Telegram client not available for download.")

            await gateway._ensure_connected(client)

            try:
                src_entity = await client.get_input_entity(source_channel_id)
            except Exception:
                src_entity = await client.get_entity(source_channel_id)

            source_msg = await client.get_messages(src_entity, ids=source_message_id)
            if not source_msg or not source_msg.media:
                raise RuntimeError(f"Message #{source_message_id} has no media in channel {source_channel_id}")

            caption = new_caption if new_caption is not None else (source_msg.text or "")

            # 2. Download media (supports both photos and videos)
            logger.info(f"VideoProcessing: Downloading msg #{source_message_id} to {tmp_dir}...")
            downloaded = await client.download_media(source_msg, file=tmp_dir)
            if not downloaded or not os.path.exists(downloaded):
                raise RuntimeError(f"Failed to download media for msg #{source_message_id}")

            ext = os.path.splitext(downloaded)[1].lower()
            is_image = ext in (".jpg", ".jpeg", ".png", ".webp")
            output_ext = ext if ext else (".jpg" if is_image else ".mp4")
            output_path = os.path.join(tmp_dir, f"sanitized_output{output_ext}")

            await self._update_job_status(job_id, "PROCESSING", 35.0)

            # 3. Dynamic Auto-Detection pass if requested
            if filter_params.get("preset") == "auto" or filter_params.get("auto_detect", False):
                try:
                    from backend.application.services.watermark_detector import WatermarkDetector
                    detection = WatermarkDetector.detect_from_file(downloaded)
                    if detection.get("detected") and detection.get("normalized_box"):
                        filter_params = {**filter_params, "normalized_box": detection["normalized_box"]}
                        logger.info(f"VideoProcessing: Auto-detected watermark box: {detection['normalized_box']}")
                except Exception as det_err:
                    logger.warning(f"Auto-detection during job execution failed: {det_err}")

            # 4. Probe video/image width and height
            width, height = await self._probe_video_dimensions(downloaded)
            logger.info(f"VideoProcessing: Probed media dimensions: {width}x{height} (is_image={is_image})")

            # 5. Compute filter coordinates & transcoding parameters
            resolution_preset = filter_params.get("resolution_preset")
            custom_crf = filter_params.get("crf")
            scale_filter_str, transcode_codec_args = self._build_transcoding_args(
                resolution_preset=resolution_preset,
                source_width=width,
                source_height=height,
                crf=custom_crf,
            )

            delogo_filter = self._build_delogo_filter(filter_type, filter_params, width, height)

            # Combine video filters (delogo / watermark / scaling)
            if delogo_filter and len(delogo_filter) >= 2 and delogo_filter[0] == "-vf":
                base_vf = delogo_filter[1]
                combined_filter = ["-vf", f"{base_vf},{scale_filter_str}"] if scale_filter_str else ["-vf", base_vf]
            elif delogo_filter and len(delogo_filter) >= 2 and delogo_filter[0] == "-filter_complex":
                combined_filter = [
                    "-filter_complex",
                    f"{delogo_filter[1]}[v_out];[v_out]{scale_filter_str}",
                ] if scale_filter_str else delogo_filter
            elif scale_filter_str:
                combined_filter = ["-vf", scale_filter_str]
            else:
                combined_filter = []

            logger.info(f"VideoProcessing: Applying filter: {combined_filter}")

            # 6. Run FFmpeg
            if is_image:
                ffmpeg_cmd = [
                    "ffmpeg",
                    "-y",
                    "-i", downloaded,
                    *combined_filter,
                    output_path,
                ]
            else:
                ffmpeg_cmd = [
                    "ffmpeg",
                    "-y",
                    "-i", downloaded,
                    *combined_filter,
                    *transcode_codec_args,
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

            # 7. Upload processed media to target channel
            logger.info(f"VideoProcessing: Uploading cleaned media to channel {target_channel_id}...")
            try:
                target_entity = await client.get_input_entity(target_channel_id)
            except Exception:
                target_entity = await client.get_entity(target_channel_id)

            sent_msg = await client.send_file(
                target_entity,
                file=output_path,
                caption=caption,
                supports_streaming=not is_image,
            )
            sent_msg_id = getattr(sent_msg, "id", None)

            await self._update_job_status(job_id, "COMPLETED", 100.0, target_message_id=sent_msg_id)
            logger.info(f"VideoProcessing: Job {job_id} COMPLETED successfully! Sent msg #{sent_msg_id}")
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

    @classmethod
    def get_presets(cls) -> list[dict[str, Any]]:
        """List available transcoding resolution presets."""
        return list(TRANSCODING_PRESETS.values())

    def _build_transcoding_args(
        self,
        resolution_preset: str | None,
        source_width: int,
        source_height: int,
        crf: int | None = None,
    ) -> tuple[str | None, list[str]]:
        """Build downsampling scale filter and FFmpeg video/audio encoding parameters."""
        raw_key = str(resolution_preset or "ORIGINAL").strip()
        matched_key = "ORIGINAL"

        for k in TRANSCODING_PRESETS:
            if k.upper() == raw_key.upper() or k.lower() == raw_key.lower():
                matched_key = k
                break

        cfg = TRANSCODING_PRESETS[matched_key]
        max_w = cfg.get("max_width")
        scale_filter: str | None = None

        if max_w is not None:
            # Intelligent downsampling guard: only downscale, never upscale smaller content
            scale_filter = f"scale='min({max_w},iw)':-2"

        active_crf = crf if crf is not None else cfg.get("default_crf", 23)
        codec_args = [
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", str(active_crf),
        ]

        max_bitrate = cfg.get("max_bitrate_k")
        if max_bitrate:
            codec_args.extend(["-maxrate", f"{max_bitrate}k", "-bufsize", f"{max_bitrate * 2}k"])

        if cfg.get("audio_codec") == "aac":
            codec_args.extend(["-c:a", "aac", "-b:a", cfg.get("audio_bitrate", "128k")])
        else:
            codec_args.extend(["-c:a", "copy"])

        return scale_filter, codec_args

    def _build_drawtext_filter_str(
        self, params: dict[str, Any], width: int, height: int
    ) -> str:
        """Construct a robust FFmpeg drawtext filter string for branding overlay."""
        raw_text = str(
            params.get("watermark_text")
            or params.get("text")
            or params.get("branding_text")
            or "@Canal"
        ).strip()

        # Escape special characters for FFmpeg drawtext filter syntax
        safe_text = (
            raw_text.replace("\\", "\\\\")
            .replace("'", "'\\\\\\''")
            .replace(":", "\\:")
            .replace("%", "\\%")
        )

        position = params.get("watermark_position", params.get("position", "bottom_right"))
        margin = max(10, int(params.get("margin", 20)))

        if position == "bottom_right":
            x_expr = f"w-tw-{margin}"
            y_expr = f"h-th-{margin}"
        elif position == "top_right":
            x_expr = f"w-tw-{margin}"
            y_expr = f"{margin}"
        elif position == "bottom_left":
            x_expr = f"{margin}"
            y_expr = f"h-th-{margin}"
        elif position == "top_left":
            x_expr = f"{margin}"
            y_expr = f"{margin}"
        elif position == "center":
            x_expr = "(w-tw)/2"
            y_expr = "(h-th)/2"
        else:
            x_expr = f"w-tw-{margin}"
            y_expr = f"h-th-{margin}"

        # Proportional font size if not explicitly specified
        font_size = int(params.get("watermark_font_size", params.get("font_size", 0)))
        if font_size <= 0:
            font_size = max(18, min(48, int(height * 0.035)))

        font_color = str(params.get("font_color", "white@0.85"))
        with_box = params.get("with_box", True)

        box_opts = ":box=1:boxcolor=black@0.45:boxborderw=5" if with_box else ""
        font_file_opt = ""
        for font_candidate in (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        ):
            if os.path.exists(font_candidate):
                font_file_opt = f":fontfile='{font_candidate}'"
                break

        return f"drawtext=text='{safe_text}'{font_file_opt}:fontsize={font_size}:fontcolor={font_color}:x={x_expr}:y={y_expr}{box_opts}"

    def _build_delogo_filter(
        self, filter_type: str, params: dict[str, Any], width: int, height: int
    ) -> list[str]:
        if filter_type in ("watermark_text", "watermark", "branding"):
            drawtext_str = self._build_drawtext_filter_str(params, width, height)
            return ["-vf", drawtext_str]

        preset = params.get("preset", "center")
        norm = params.get("normalized_box")

        if norm and isinstance(norm, dict) and norm.get("w_pct", 0) > 0:
            x = int(norm.get("x_pct", 0.2) * width)
            y = int(norm.get("y_pct", 0.3) * height)
            w = int(norm.get("w_pct", 0.6) * width)
            h = int(norm.get("h_pct", 0.25) * height)
            x = max(min(x, width - 10), 0)
            y = max(min(y, height - 10), 0)
            w = max(min(w, width - x), 10)
            h = max(min(h, height - y), 10)
        elif preset == "center":
            w = max(int(width * 0.32), 60)
            h = max(int(height * 0.12), 40)
            x = max(int((width - w) / 2), 0)
            y = max(int((height - h) / 2), 0)
        elif preset == "top_right":
            w = max(int(width * 0.30), 60)
            h = max(int(height * 0.10), 40)
            x = max(width - w - 15, 0)
            y = 15
        elif preset == "bottom_right":
            w = max(int(width * 0.30), 60)
            h = max(int(height * 0.10), 40)
            x = max(width - w - 15, 0)
            y = max(height - h - 15, 0)
        elif preset == "bottom_bar":
            w = width
            h = max(int(height * 0.12), 40)
            x = 0
            y = max(height - h, 0)
        elif preset == "custom":
            x = int(params.get("x", 0))
            y = int(params.get("y", 0))
            w = int(params.get("w", 100))
            h = int(params.get("h", 100))
        else:
            w = max(int(width * 0.30), 60)
            h = max(int(height * 0.10), 40)
            x = max(int((width - w) / 2), 0)
            y = max(int((height - h) / 2), 0)

        # STRICT SAFETY CLAMPING:
        # Delogo gradient interpolation across large regions destroys content and creates streaks.
        if preset != "bottom_bar":
            max_w = int(width * 0.38)
            w = min(w, max_w)
        max_h = int(height * 0.20)
        h = min(h, max_h)
        x = max(min(x, width - w), 0)
        y = max(min(y, height - h), 0)

        if filter_type == "blur":
            # Box blur over bounding box
            filter_str = f"[0:v]crop={w}:{h}:{x}:{y},boxblur=15[fg];[0:v][fg]overlay={x}:{y}"
            return ["-filter_complex", filter_str]

        # Check if caller requested both delogo AND watermark branding overlay
        has_branding = bool(
            filter_type == "delogo_and_watermark"
            or params.get("watermark_text")
            or params.get("branding_text")
        )

        delogo_str = f"delogo=x={x}:y={y}:w={w}:h={h}:show=0"
        if has_branding:
            drawtext_str = self._build_drawtext_filter_str(params, width, height)
            return ["-vf", f"{delogo_str},{drawtext_str}"]

        # Default: delogo (intelligent gradient interpolation)
        return ["-vf", delogo_str]
