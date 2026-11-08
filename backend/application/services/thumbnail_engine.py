from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from backend.application.services.smart_transcoding_engine import SmartTranscodingEngine

logger = logging.getLogger("telegram_migrator.thumbnails")


class ThumbnailEngine:
    """Extracts, scales, and prepares high-quality poster frames and thumbnails for Telegram."""

    @classmethod
    async def probe_duration(cls, video_path: str) -> float:
        """Probes video duration in seconds via SmartTranscodingEngine / ffprobe."""
        if not os.path.exists(video_path):
            return 0.0
        probe = await SmartTranscodingEngine.probe_video(video_path)
        return probe.duration if probe.duration > 0 else 0.0

    @classmethod
    async def extract_poster_frame(
        cls,
        video_path: str,
        output_jpg_path: str,
        timestamp_s: float | None = None,
        percent: float = 0.25,
        max_dim: int = 320,
    ) -> str:
        """Extracts a sharp representative poster frame from video to prevent black-frame previews.

        Telegram recommends thumbnail images <= 320px bounding box for optimal in-chat performance.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        duration = await cls.probe_duration(video_path)

        if timestamp_s is not None:
            seek_time = max(0.0, min(timestamp_s, duration)) if duration > 0 else max(0.0, timestamp_s)
        else:
            # Pick a frame at the chosen percentage, avoiding the first and last half-second
            if duration > 1.0:
                seek_time = max(0.5, min(duration * percent, duration - 0.5))
            else:
                seek_time = 0.0

        os.makedirs(os.path.dirname(os.path.abspath(output_jpg_path)), exist_ok=True)

        scale_expr = f"scale=w='if(gt(iw,ih),{max_dim},-2)':h='if(gt(iw,ih),-2,{max_dim})'"

        cmd = [
            "ffmpeg",
            "-y",
            "-ss", f"{seek_time:.2f}",
            "-i", video_path,
            "-frames:v", "1",
            "-vf", scale_expr,
            "-q:v", "3",
            output_jpg_path,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()

        if proc.returncode != 0 or not os.path.exists(output_jpg_path) or os.path.getsize(output_jpg_path) == 0:
            err = stderr.decode(errors="replace")[-400:]
            logger.warning(f"Thumbnail extraction failed at {seek_time:.2f}s: {err}")
            # Fallback to absolute frame 0 if fast seek failed
            fallback_cmd = [
                "ffmpeg",
                "-y",
                "-i", video_path,
                "-frames:v", "1",
                "-vf", scale_expr,
                "-q:v", "3",
                output_jpg_path,
            ]
            fb_proc = await asyncio.create_subprocess_exec(
                *fallback_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await fb_proc.communicate()

        if not os.path.exists(output_jpg_path) or os.path.getsize(output_jpg_path) == 0:
            raise RuntimeError(f"Failed to generate thumbnail for {video_path}")

        logger.info(
            f"ThumbnailEngine: Generated thumbnail ({os.path.getsize(output_jpg_path)}B) "
            f"at {seek_time:.2f}s -> {output_jpg_path}"
        )
        return output_jpg_path

    @classmethod
    async def extract_frame_candidates(
        cls,
        video_path: str,
        output_dir: str,
        count: int = 4,
        max_dim: int = 320,
    ) -> list[dict[str, Any]]:
        """Extracts candidate frames across the video timeline for preview and manual cover selection."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        duration = await cls.probe_duration(video_path)
        os.makedirs(output_dir, exist_ok=True)

        # Generate evenly spaced percentages (e.g., [15%, 35%, 60%, 85%])
        step = 1.0 / (count + 1)
        percentages = [round(step * (i + 1), 2) for i in range(count)]

        candidates: list[dict[str, Any]] = []
        for idx, pct in enumerate(percentages, start=1):
            target_time = duration * pct if duration > 0 else idx * 1.0
            out_file = os.path.join(output_dir, f"cand_{idx}_{int(pct * 100)}.jpg")
            try:
                thumb_path = await cls.extract_poster_frame(
                    video_path=video_path,
                    output_jpg_path=out_file,
                    timestamp_s=target_time,
                    max_dim=max_dim,
                )
                candidates.append(
                    {
                        "index": idx,
                        "percent": int(pct * 100),
                        "timestamp_s": round(target_time, 2),
                        "file_path": thumb_path,
                        "file_name": os.path.basename(thumb_path),
                        "size_bytes": os.path.getsize(thumb_path),
                    }
                )
            except Exception as e:
                logger.warning(f"Could not extract candidate frame #{idx}: {e}")

        return candidates

    @classmethod
    async def generate_segment_thumbnails(
        cls,
        segment_paths: list[str],
        output_dir: str,
        percent: float = 0.25,
    ) -> list[str]:
        """Generates matching thumbnail JPEG files for a list of video segments."""
        os.makedirs(output_dir, exist_ok=True)
        thumbnails: list[str] = []
        for idx, seg_path in enumerate(segment_paths, start=1):
            out_jpg = os.path.join(output_dir, f"seg_thumb_{idx}.jpg")
            try:
                t_path = await cls.extract_poster_frame(
                    video_path=seg_path,
                    output_jpg_path=out_jpg,
                    percent=percent,
                )
                thumbnails.append(t_path)
            except Exception as e:
                logger.warning(f"Failed to generate thumbnail for segment {seg_path}: {e}")
                thumbnails.append("")
        return thumbnails
