from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("telegram_migrator.smart_transcoding")


@dataclass
class VideoProbeResult:
    """Metadata extracted from a video stream via ffprobe."""

    width: int = 0
    height: int = 0
    duration: float = 0.0
    size_bytes: int = 0
    video_codec: str = "unknown"
    audio_codec: str = "none"
    bitrate_kbps: int = 0
    fps: float = 30.0

    @property
    def is_hevc(self) -> bool:
        return self.video_codec.lower() in ("hevc", "h265")

    @property
    def is_h264(self) -> bool:
        return self.video_codec.lower() in ("h264", "avc", "avc1")

    @property
    def resolution_label(self) -> str:
        w = max(self.width, self.height)
        if w >= 3840:
            return "4K UHD"
        elif w >= 2560:
            return "1440p QHD"
        elif w >= 1920:
            return "1080p FHD"
        elif w >= 1280:
            return "720p HD"
        elif w >= 854:
            return "480p SD"
        return "Low-Res"


@dataclass
class TranscodingStrategy:
    """Actionable transcoding decision and FFmpeg parameters."""

    action: str  # "PASS_THROUGH", "DOWN_SCALE_H265", "COMPRESS_H265", "TRANSCODE_H264"
    target_codec: str  # "libx265", "libx264", "copy"
    target_width: int | None
    crf: int
    bitrate_cap_k: int | None
    audio_codec: str  # "aac", "copy"
    scale_filter: str | None
    codec_args: list[str] = field(default_factory=list)
    reason: str = ""


class SmartTranscodingEngine:
    """Probes video metrics and determines optimal mobile compression parameters."""

    @classmethod
    async def probe_video(cls, file_path: str) -> VideoProbeResult:
        """Executes ffprobe to inspect video resolution, bitrate, container and codecs."""
        if not os.path.exists(file_path):
            return VideoProbeResult()

        size_bytes = os.path.getsize(file_path)
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path,
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            if proc.returncode != 0 or not stdout:
                return VideoProbeResult(size_bytes=size_bytes)

            data = json.loads(stdout.decode(errors="replace"))
            streams = data.get("streams", [])
            fmt = data.get("format", {})

            video_stream = next(
                (s for s in streams if s.get("codec_type") == "video"), {}
            )
            audio_stream = next(
                (s for s in streams if s.get("codec_type") == "audio"), {}
            )

            width = int(video_stream.get("width", 0))
            height = int(video_stream.get("height", 0))
            duration = float(fmt.get("duration", video_stream.get("duration", 0.0)) or 0.0)

            # Extract bitrate
            bitrate_raw = fmt.get("bit_rate") or video_stream.get("bit_rate")
            bitrate_kbps = int(int(bitrate_raw) / 1000) if bitrate_raw else 0
            if bitrate_kbps == 0 and duration > 0 and size_bytes > 0:
                bitrate_kbps = int((size_bytes * 8) / (duration * 1000))

            # Extract FPS
            r_frame_rate = video_stream.get("r_frame_rate", "30/1")
            fps = 30.0
            if "/" in r_frame_rate:
                num, den = r_frame_rate.split("/")
                if float(den) > 0:
                    fps = round(float(num) / float(den), 2)

            return VideoProbeResult(
                width=width,
                height=height,
                duration=duration,
                size_bytes=size_bytes,
                video_codec=video_stream.get("codec_name", "unknown"),
                audio_codec=audio_stream.get("codec_name", "none"),
                bitrate_kbps=bitrate_kbps,
                fps=fps,
            )
        except Exception as e:
            logger.warning(f"ffprobe failed for {file_path}: {e}")
            return VideoProbeResult(size_bytes=size_bytes)

    @classmethod
    def build_aspect_ratio_filter(
        cls,
        mode: str | None,
        src_width: int,
        src_height: int,
        target_height: int = 1920,
    ) -> tuple[str | None, str | None]:
        """Builds FFmpeg filter for Telegram Stories (9:16 vertical video conversion).

        Modes:
          - "ORIGINAL" or None: No modification (returns None, None).
          - "9:16_CROP": Center-crops the video directly to 9:16 canvas.
          - "9:16_BLUR": Places video on a 9:16 canvas with blurred background wings/bars.
        Returns:
          tuple (filter_type, filter_string) where filter_type is "-vf" or "-filter_complex",
          or (None, None) if not applicable.
        """
        if not mode or mode.upper() in ("ORIGINAL", "NONE", ""):
            return None, None

        mode_upper = mode.upper()
        # Compute 9:16 dimensions (ensure even numbers for encoder compatibility)
        target_h = target_height if target_height % 2 == 0 else target_height + 1
        target_w = int(round(target_h * 9 / 16))
        if target_w % 2 != 0:
            target_w += 1

        if mode_upper in ("9:16_CROP", "CROP_9_16", "9_16_CROP"):
            crop_filter = (
                f"crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2',"
                f"scale={target_w}:{target_h}:flags=lanczos"
            )
            return "-vf", crop_filter

        if mode_upper in ("9:16_BLUR", "BLUR_9_16", "9_16_BLUR_BG", "STORIES"):
            complex_filter = (
                f"[0:v]split=2[bg_in][fg_in];"
                f"[bg_in]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
                f"crop={target_w}:{target_h},boxblur=20:10[bg];"
                f"[fg_in]scale={target_w}:-2[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2"
            )
            return "-filter_complex", complex_filter

        return None, None

    @classmethod
    def decide_strategy(
        cls,
        probe: VideoProbeResult,
        preset: str = "AUTO_MOBILE",
        custom_crf: int | None = None,
        force_reencode: bool = False,
    ) -> TranscodingStrategy:
        """Determines the most efficient encoding parameters for mobile delivery."""
        w = max(probe.width, probe.height)
        preset_upper = (preset or "AUTO_MOBILE").upper()

        # Handle AUTO_MOBILE dynamic logic
        if preset_upper == "AUTO_MOBILE":
            if w > 1920:
                # 4K or 1440p -> Downscale to 1080p H.265
                return cls._build_h265_strategy(
                    max_width=1920,
                    crf=custom_crf or 26,
                    bitrate_cap_k=3500,
                    action="DOWN_SCALE_H265",
                    reason=f"Source {probe.resolution_label} ({probe.width}x{probe.height}) downscaled to 1080p H.265",
                )
            elif w > 1280:
                # 1080p -> Downscale to 720p H.265 (Ideal mobile trade-off)
                return cls._build_h265_strategy(
                    max_width=1280,
                    crf=custom_crf or 27,
                    bitrate_cap_k=2200,
                    action="DOWN_SCALE_H265",
                    reason=f"Source 1080p ({probe.width}x{probe.height}) downscaled to 720p H.265 for mobile bandwidth optimization",
                )
            else:
                # Already <= 720p
                if (
                    not force_reencode
                    and probe.is_hevc
                    and 0 < probe.bitrate_kbps <= 1800
                ):
                    return TranscodingStrategy(
                        action="PASS_THROUGH",
                        target_codec="copy",
                        target_width=None,
                        crf=0,
                        bitrate_cap_k=None,
                        audio_codec="copy",
                        scale_filter=None,
                        codec_args=["-c:v", "copy", "-c:a", "copy"],
                        reason="Source already lean H.265; direct pass-through applied to preserve CPU",
                    )
                else:
                    return cls._build_h265_strategy(
                        max_width=None if w <= 1280 else 1280,
                        crf=custom_crf or 28,
                        bitrate_cap_k=1600,
                        action="COMPRESS_H265",
                        reason=f"Source {probe.resolution_label} compressed to lean H.265 @ {custom_crf or 28} CRF",
                    )

        # Explicit Presets
        if preset_upper in ("H265_1080P", "1080P_H265"):
            return cls._build_h265_strategy(
                max_width=1920,
                crf=custom_crf or 25,
                bitrate_cap_k=4000,
                action="DOWN_SCALE_H265",
                reason="Explicit H.265 1080p Full HD preset",
            )
        elif preset_upper in ("H265_720P", "720P_H265"):
            return cls._build_h265_strategy(
                max_width=1280,
                crf=custom_crf or 27,
                bitrate_cap_k=2200,
                action="DOWN_SCALE_H265",
                reason="Explicit H.265 720p HD Mobile preset",
            )
        elif preset_upper in ("H265_480P", "480P_H265"):
            return cls._build_h265_strategy(
                max_width=854,
                crf=custom_crf or 29,
                bitrate_cap_k=1000,
                action="DOWN_SCALE_H265",
                reason="Explicit H.265 480p Ultra-Saver preset",
            )
        elif preset_upper in ("1080P", "H264_1080P"):
            return cls._build_h264_strategy(
                max_width=1920,
                crf=custom_crf or 22,
                bitrate_cap_k=4500,
                reason="Legacy H.264 1080p preset",
            )
        elif preset_upper in ("720P", "H264_720P"):
            return cls._build_h264_strategy(
                max_width=1280,
                crf=custom_crf or 24,
                bitrate_cap_k=2500,
                reason="Legacy H.264 720p preset",
            )
        elif preset_upper in ("480P", "H264_480P"):
            return cls._build_h264_strategy(
                max_width=854,
                crf=custom_crf or 26,
                bitrate_cap_k=1200,
                reason="Legacy H.264 480p preset",
            )
        else:
            # ORIGINAL fallback
            return TranscodingStrategy(
                action="TRANSCODE_H264",
                target_codec="libx264",
                target_width=None,
                crf=custom_crf or 23,
                bitrate_cap_k=None,
                audio_codec="copy",
                scale_filter=None,
                codec_args=[
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", str(custom_crf or 23),
                    "-c:a", "copy",
                    "-movflags", "+faststart",
                ],
                reason="Original geometry with standard H.264 encoding",
            )

    @classmethod
    def _build_h265_strategy(
        cls,
        max_width: int | None,
        crf: int,
        bitrate_cap_k: int | None,
        action: str,
        reason: str,
    ) -> TranscodingStrategy:
        scale_filter = f"scale='min({max_width},iw)':-2" if max_width else None
        codec_args = [
            "-c:v", "libx265",
            "-tag:v", "hvc1",  # Required for Telegram iOS/Android inline playback
            "-preset", "fast",
            "-crf", str(crf),
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
        ]
        if bitrate_cap_k:
            codec_args.extend(["-maxrate", f"{bitrate_cap_k}k", "-bufsize", f"{bitrate_cap_k * 2}k"])

        codec_args.extend(["-c:a", "aac", "-b:a", "128k"])

        return TranscodingStrategy(
            action=action,
            target_codec="libx265",
            target_width=max_width,
            crf=crf,
            bitrate_cap_k=bitrate_cap_k,
            audio_codec="aac",
            scale_filter=scale_filter,
            codec_args=codec_args,
            reason=reason,
        )

    @classmethod
    def _build_h264_strategy(
        cls,
        max_width: int | None,
        crf: int,
        bitrate_cap_k: int | None,
        reason: str,
    ) -> TranscodingStrategy:
        scale_filter = f"scale='min({max_width},iw)':-2" if max_width else None
        codec_args = [
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", str(crf),
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
        ]
        if bitrate_cap_k:
            codec_args.extend(["-maxrate", f"{bitrate_cap_k}k", "-bufsize", f"{bitrate_cap_k * 2}k"])

        codec_args.extend(["-c:a", "aac", "-b:a", "128k"])

        return TranscodingStrategy(
            action="DOWN_SCALE_H264" if max_width else "TRANSCODE_H264",
            target_codec="libx264",
            target_width=max_width,
            crf=crf,
            bitrate_cap_k=bitrate_cap_k,
            audio_codec="aac",
            scale_filter=scale_filter,
            codec_args=codec_args,
            reason=reason,
        )
