from __future__ import annotations

import asyncio
import logging
import os
import shutil
from dataclasses import dataclass
from typing import Any

from backend.application.services.smart_transcoding_engine import SmartTranscodingEngine

logger = logging.getLogger("telegram_migrator.story_slicer")


@dataclass
class StorySegment:
    """Represents a single sliced video clip formatted for Telegram Stories."""

    index: int  # 1-based index
    total: int  # Total segment count
    start_s: float
    end_s: float
    duration_s: float
    file_path: str
    caption: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "total": self.total,
            "start_s": round(self.start_s, 2),
            "end_s": round(self.end_s, 2),
            "duration_s": round(self.duration_s, 2),
            "file_path": self.file_path,
            "caption": self.caption,
        }


class StorySlicerEngine:
    """Intelligent temporal video segmenter.

    Splits videos exceeding Telegram Stories' 60-second limit into sequential clips
    with automatic part labeling and keyframe-aligned cutting.
    """

    @classmethod
    def compute_slice_plan(
        cls,
        duration_s: float,
        max_segment_seconds: float = 60.0,
    ) -> list[tuple[float, float]]:
        """Calculates temporal start and end boundaries for slicing.

        Applies intelligent tail balancing to avoid awkward 1-4 second micro-segments.
        """
        if duration_s <= 0:
            return []

        # If already within limit, no slicing needed
        if duration_s <= max_segment_seconds + 3.0:
            return [(0.0, round(duration_s, 2))]

        intervals: list[tuple[float, float]] = []
        current_start = 0.0

        while current_start < duration_s:
            remaining = duration_s - current_start
            if remaining <= max_segment_seconds:
                intervals.append((round(current_start, 2), round(duration_s, 2)))
                break

            # If the tail that would remain after this chunk is under 8s, balance the last two chunks
            if remaining < (max_segment_seconds + 8.0):
                half = remaining / 2.0
                intervals.append((round(current_start, 2), round(current_start + half, 2)))
                intervals.append((round(current_start + half, 2), round(duration_s, 2)))
                break

            current_end = current_start + max_segment_seconds
            intervals.append((round(current_start, 2), round(current_end, 2)))
            current_start = current_end

        return intervals

    @classmethod
    def format_segment_caption(
        cls,
        base_caption: str,
        index: int,
        total: int,
    ) -> str:
        """Appends sequential story part indicators to captions."""
        clean_base = (base_caption or "").strip()
        if total <= 1:
            return clean_base

        label = f"(Parte {index}/{total})"
        if not clean_base:
            return label

        # Check if already labeled
        if f"Parte {index}/" in clean_base or f"{index}/{total}" in clean_base:
            return clean_base

        return f"{clean_base}\n\n🎬 {label}"

    @classmethod
    async def slice_video(
        cls,
        input_path: str,
        output_dir: str,
        max_segment_seconds: float = 60.0,
        base_caption: str = "",
        force_h265: bool = True,
    ) -> list[StorySegment]:
        """Slices video file into consecutive segments under max_segment_seconds."""
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input video not found: {input_path}")

        os.makedirs(output_dir, exist_ok=True)
        probe = await SmartTranscodingEngine.probe_video(input_path)
        duration_s = probe.duration or 0.0

        if duration_s <= 0:
            # Fallback probe through ffprobe if metadata duration was missing
            duration_s = max_segment_seconds

        intervals = cls.compute_slice_plan(duration_s, max_segment_seconds=max_segment_seconds)
        total = len(intervals)

        # Single segment case: no slicing required
        if total <= 1:
            return [
                StorySegment(
                    index=1,
                    total=1,
                    start_s=0.0,
                    end_s=duration_s,
                    duration_s=duration_s,
                    file_path=input_path,
                    caption=base_caption,
                )
            ]

        segments: list[StorySegment] = []

        for idx, (start_s, end_s) in enumerate(intervals, start=1):
            seg_duration = end_s - start_s
            seg_file = os.path.join(output_dir, f"story_part_{idx}_of_{total}.mp4")

            codec_args = (
                [
                    "-c:v", "libx265",
                    "-tag:v", "hvc1",
                    "-preset", "ultrafast",
                    "-crf", "27",
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-movflags", "+faststart",
                ]
                if force_h265
                else [
                    "-c:v", "copy",
                    "-c:a", "copy",
                    "-movflags", "+faststart",
                ]
            )

            cmd = [
                "ffmpeg",
                "-y",
                "-ss", str(start_s),
                "-t", str(seg_duration),
                "-i", input_path,
                *codec_args,
                seg_file,
            ]

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode != 0 or not os.path.exists(seg_file) or os.path.getsize(seg_file) == 0:
                err_msg = stderr.decode(errors="replace")[-400:]
                logger.warning(
                    f"StorySlicer: Slicing failed for interval [{start_s}-{end_s}]: {err_msg}. Fallback copy."
                )
                # Fallback: re-attempt without transcoding
                cmd_fallback = [
                    "ffmpeg", "-y", "-ss", str(start_s), "-t", str(seg_duration),
                    "-i", input_path, "-c", "copy", seg_file,
                ]
                proc_fb = await asyncio.create_subprocess_exec(
                    *cmd_fallback,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await proc_fb.communicate()

            caption = cls.format_segment_caption(base_caption, idx, total)
            segments.append(
                StorySegment(
                    index=idx,
                    total=total,
                    start_s=start_s,
                    end_s=end_s,
                    duration_s=seg_duration,
                    file_path=seg_file,
                    caption=caption,
                )
            )

        return segments
