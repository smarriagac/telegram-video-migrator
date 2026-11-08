from __future__ import annotations

import asyncio
import logging
import math
import os
import re
from dataclasses import dataclass
from typing import Any

from backend.application.services.smart_transcoding_engine import SmartTranscodingEngine

logger = logging.getLogger("telegram_migrator.subtitles")


@dataclass
class SubtitleCue:
    """Represents a timed subtitle segment for rendering."""

    index: int
    start_s: float
    end_s: float
    text: str

    @property
    def duration_s(self) -> float:
        return max(0.0, self.end_s - self.start_s)

    @classmethod
    def format_srt_time(cls, seconds: float) -> str:
        """Converts float seconds into HH:MM:SS,mmm format required by SubRip (.srt)."""
        sec_clamped = max(0.0, seconds)
        hours = int(sec_clamped // 3600)
        minutes = int((sec_clamped % 3600) // 60)
        secs = int(sec_clamped % 60)
        millis = int(round((sec_clamped - int(sec_clamped)) * 1000))
        if millis >= 1000:
            millis = 999
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def to_srt_block(self) -> str:
        """Returns standard SRT entry block."""
        return (
            f"{self.index}\n"
            f"{self.format_srt_time(self.start_s)} --> {self.format_srt_time(self.end_s)}\n"
            f"{self.text.strip()}\n\n"
        )


class SubtitleEngine:
    """Audio extraction, synchronized subtitle generation, and FFmpeg burning engine."""

    STYLE_PRESETS: dict[str, str] = {
        # High impact kinetic yellow with thick black outline - standard for Instagram Reels & Telegram Stories
        "KINETIC_YELLOW": (
            "FontName=DejaVu Sans,FontSize=26,Bold=1,"
            "PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,"
            "BorderStyle=1,Outline=3,Shadow=1,Alignment=2"
        ),
        # Clean modern crisp white with high-contrast drop shadow and outline
        "CLASSIC_WHITE": (
            "FontName=DejaVu Sans,FontSize=24,Bold=1,"
            "PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,"
            "BorderStyle=1,Outline=2.5,Shadow=1,Alignment=2"
        ),
        # Semi-transparent dark box background - maximum legibility on high-noise backgrounds
        "BOXED_BLACK": (
            "FontName=DejaVu Sans,FontSize=22,Bold=1,"
            "PrimaryColour=&H00FFFFFF,BackColour=&H80000000,"
            "BorderStyle=3,Outline=1,Alignment=2"
        ),
    }

    @classmethod
    def escape_ffmpeg_path(cls, path: str) -> str:
        """Escapes file paths for FFmpeg filtergraph strings (colons, backslashes, single quotes)."""
        normalized = path.replace("\\", "/")
        escaped = normalized.replace(":", "\\:").replace("'", "'\\\\\\''")
        return escaped

    @classmethod
    async def extract_audio_track(cls, video_path: str, output_wav_path: str) -> str:
        """Extracts mono 16kHz PCM WAV audio from video using FFmpeg."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Source video not found: {video_path}")

        os.makedirs(os.path.dirname(os.path.abspath(output_wav_path)), exist_ok=True)

        cmd = [
            "ffmpeg",
            "-y",
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            output_wav_path,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0 or not os.path.exists(output_wav_path):
            err = stderr.decode(errors="replace")[-400:]
            logger.warning(f"Audio extraction warning/fallback: {err}")
            return ""

        return output_wav_path

    @classmethod
    def chunk_text_into_cues(
        cls,
        text: str,
        total_duration_s: float,
        words_per_cue: int = 4,
        min_cue_duration_s: float = 1.2,
    ) -> list[SubtitleCue]:
        """Segments text into rhythmic kinetic subtitle cues synchronized across the duration."""
        cleaned_text = re.sub(r"\s+", " ", text.strip())
        if not cleaned_text:
            return []

        words = cleaned_text.split(" ")
        if not words:
            return []

        # Group words into short punchy phrases
        phrases: list[str] = []
        current_chunk: list[str] = []
        for word in words:
            current_chunk.append(word)
            # Break on punctuation or word limit
            if len(current_chunk) >= words_per_cue or word.endswith((".", "!", "?", ":", ";", "—")):
                phrases.append(" ".join(current_chunk))
                current_chunk = []

        if current_chunk:
            phrases.append(" ".join(current_chunk))

        total_cues = len(phrases)
        if total_cues == 0:
            return []

        # Allocate timeline evenly across duration
        # Leave a tiny 0.3s breath at the beginning and end
        usable_duration = max(total_duration_s - 0.6, total_cues * min_cue_duration_s)
        cue_duration = max(min_cue_duration_s, usable_duration / total_cues)

        cues: list[SubtitleCue] = []
        current_start = 0.3
        for idx, phrase in enumerate(phrases, start=1):
            cue_end = min(current_start + cue_duration, total_duration_s)
            cues.append(
                SubtitleCue(
                    index=idx,
                    start_s=round(current_start, 2),
                    end_s=round(cue_end, 2),
                    text=phrase.upper(),  # Kinetic subtitles are traditionally uppercase for visual punch
                )
            )
            current_start = cue_end

        return cues

    @classmethod
    async def generate_subtitles(
        cls,
        video_path: str,
        output_srt_path: str,
        caption_hint: str | None = None,
        duration_s: float | None = None,
    ) -> tuple[str, list[SubtitleCue]]:
        """Generates timed subtitle cues and writes a standard .srt file."""
        if duration_s is None or duration_s <= 0:
            if os.path.exists(video_path):
                probe = await SmartTranscodingEngine.probe_video(video_path)
                duration_s = probe.duration if probe.duration > 0 else 10.0
            else:
                duration_s = 10.0

        raw_text = (caption_hint or "").strip()
        # Remove hashtags and platform tags from transcript text
        cleaned_hint = re.sub(r"#\w+", "", raw_text)
        cleaned_hint = re.sub(r"https?://\S+", "", cleaned_hint).strip()

        if not cleaned_hint:
            # High-engagement kinetic placeholder cues
            cleaned_hint = "¡Descubrí el mejor contenido! Seguinos para no perderte nada."

        cues = cls.chunk_text_into_cues(
            text=cleaned_hint,
            total_duration_s=duration_s,
            words_per_cue=4,
        )

        os.makedirs(os.path.dirname(os.path.abspath(output_srt_path)), exist_ok=True)
        with open(output_srt_path, "w", encoding="utf-8") as f:
            for cue in cues:
                f.write(cue.to_srt_block())

        logger.info(
            f"SubtitleEngine: Generated {len(cues)} cues ({duration_s:.1f}s) -> {output_srt_path}"
        )
        return output_srt_path, cues

    @classmethod
    def build_subtitles_filter(
        cls,
        srt_path: str,
        style: str = "KINETIC_YELLOW",
        margin_v: int = 80,
    ) -> str:
        """Constructs an FFmpeg subtitle filtergraph component with custom style."""
        escaped_srt = cls.escape_ffmpeg_path(srt_path)
        base_style = cls.STYLE_PRESETS.get(style.upper(), cls.STYLE_PRESETS["KINETIC_YELLOW"])
        full_style = f"{base_style},MarginV={margin_v}"
        return f"subtitles={escaped_srt}:force_style='{full_style}'"

    @classmethod
    async def burn_subtitles_to_video(
        cls,
        input_path: str,
        output_path: str,
        srt_path: str,
        style: str = "KINETIC_YELLOW",
        margin_v: int = 80,
        use_h265: bool = True,
    ) -> str:
        """Executes FFmpeg to permanently burn subtitles into the video stream."""
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Video input not found: {input_path}")
        if not os.path.exists(srt_path):
            raise FileNotFoundError(f"SRT file not found: {srt_path}")

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        sub_filter = cls.build_subtitles_filter(srt_path=srt_path, style=style, margin_v=margin_v)

        codec_args = (
            ["-c:v", "libx265", "-tag:v", "hvc1", "-crf", "27", "-preset", "fast"]
            if use_h265
            else ["-c:v", "libx264", "-crf", "23", "-preset", "fast"]
        )

        cmd = [
            "ffmpeg",
            "-y",
            "-i", input_path,
            "-vf", sub_filter,
            *codec_args,
            "-c:a", "copy",
            "-movflags", "+faststart",
            output_path,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            err = stderr.decode(errors="replace")[-500:]
            raise RuntimeError(f"FFmpeg subtitle burning failed: {err}")

        logger.info(f"SubtitleEngine: Successfully burned subtitles into {output_path}")
        return output_path
