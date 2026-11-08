from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any
import cv2

from backend.application.services.watermark_detector import WatermarkDetector

logger = logging.getLogger("telegram_migrator.dynamic_watermark")


@dataclass
class WatermarkInterval:
    """Represents a localized watermark presence over a specific time window."""

    start_time_s: float
    end_time_s: float
    x_pct: float
    y_pct: float
    w_pct: float
    h_pct: float
    zone: str  # "top_left", "top_right", "bottom_left", "bottom_right", "center", "custom"
    text: str = ""
    confidence: float = 0.0

    def to_delogo_expr(self, video_width: int, video_height: int) -> str:
        """Constructs an FFmpeg delogo filter element for this interval."""
        x = max(0, min(int(self.x_pct * video_width), video_width - 10))
        y = max(0, min(int(self.y_pct * video_height), video_height - 10))
        w = max(10, min(int(self.w_pct * video_width), video_width - x))
        h = max(10, min(int(self.h_pct * video_height), video_height - y))

        # Clamp max size to prevent full screen blur
        w = min(w, int(video_width * 0.40))
        h = min(h, int(video_height * 0.25))

        if self.start_time_s > 0 or self.end_time_s > 0:
            enable_expr = f":enable='between(t,{self.start_time_s:.2f},{self.end_time_s:.2f})'"
        else:
            enable_expr = ""

        return f"delogo=x={x}:y={y}:w={w}:h={h}:show=0{enable_expr}"


@dataclass
class DynamicWatermarkResult:
    """Consolidated dynamic watermark detection report."""

    is_detected: bool = False
    is_dynamic: bool = False
    intervals: list[WatermarkInterval] = field(default_factory=list)
    ffmpeg_filter: str | None = None
    sample_count: int = 0
    duration_s: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_detected": self.is_detected,
            "is_dynamic": self.is_dynamic,
            "sample_count": self.sample_count,
            "duration_s": round(self.duration_s, 2),
            "ffmpeg_filter": self.ffmpeg_filter,
            "intervals": [
                {
                    "start_time_s": round(inv.start_time_s, 2),
                    "end_time_s": round(inv.end_time_s, 2),
                    "zone": inv.zone,
                    "x_pct": round(inv.x_pct, 4),
                    "y_pct": round(inv.y_pct, 4),
                    "w_pct": round(inv.w_pct, 4),
                    "h_pct": round(inv.h_pct, 4),
                    "confidence": round(inv.confidence, 2),
                    "text": inv.text,
                }
                for inv in self.intervals
            ],
        }


class DynamicWatermarkDetector:
    """Multi-sample temporal computer vision engine.

    Inspects multiple keyframes across a video's timeline to identify both static
    watermarks and moving / alternating watermarks (e.g. TikTok, Reels, Shorts).
    """

    @classmethod
    def detect_video(
        cls,
        video_path: str,
        num_samples: int = 5,
        confidence_threshold: float = 0.40,
    ) -> DynamicWatermarkResult:
        """Samples frames across video duration and computes temporal watermark tracks."""
        if not os.path.exists(video_path):
            return DynamicWatermarkResult()

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return DynamicWatermarkResult()

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_s = total_frames / fps if fps > 0 else 0.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        if duration_s <= 0 or total_frames <= 0 or width <= 0 or height <= 0:
            cap.release()
            return DynamicWatermarkResult()

        # Compute sample timestamps (e.g., 10%, 30%, 50%, 70%, 90% of duration)
        num_samples = max(2, min(num_samples, 10))
        percentages = [
            (i + 0.5) / num_samples for i in range(num_samples)
        ]

        frame_detections: list[dict[str, Any]] = []

        for pct in percentages:
            target_time_s = duration_s * pct
            cap.set(cv2.CAP_PROP_POS_MSEC, target_time_s * 1000.0)
            ret, frame = cap.read()
            if not ret or frame is None:
                continue

            det = WatermarkDetector.detect_from_bgr(frame)
            if det.get("detected"):
                norm = det.get("normalized_box", {})
                frame_detections.append({
                    "time_s": target_time_s,
                    "zone": det.get("zone", "custom"),
                    "x_pct": norm.get("x_pct", 0.0),
                    "y_pct": norm.get("y_pct", 0.0),
                    "w_pct": norm.get("w_pct", 0.0),
                    "h_pct": norm.get("h_pct", 0.0),
                    "confidence": det.get("confidence", 0.5),
                    "text": det.get("text", ""),
                })
            else:
                frame_detections.append({
                    "time_s": target_time_s,
                    "zone": "none",
                    "confidence": 0.0,
                })

        cap.release()

        valid_detections = [
            d for d in frame_detections
            if d.get("zone") != "none" and d.get("confidence", 0) >= confidence_threshold
        ]

        if not valid_detections:
            return DynamicWatermarkResult(
                is_detected=False,
                sample_count=len(frame_detections),
                duration_s=duration_s,
            )

        # Check if all detected zones are identical or varying
        zones_seen = {d["zone"] for d in valid_detections}
        is_dynamic = len(zones_seen) > 1

        # Group consecutive or localized detections into time intervals
        intervals: list[WatermarkInterval] = []
        step_duration = duration_s / num_samples

        if not is_dynamic:
            # Single static watermark spanning entire duration
            best_det = max(valid_detections, key=lambda d: d.get("confidence", 0))
            intervals.append(
                WatermarkInterval(
                    start_time_s=0.0,
                    end_time_s=duration_s,
                    x_pct=best_det["x_pct"],
                    y_pct=best_det["y_pct"],
                    w_pct=best_det["w_pct"],
                    h_pct=best_det["h_pct"],
                    zone=best_det["zone"],
                    text=best_det.get("text", ""),
                    confidence=best_det.get("confidence", 0.5),
                )
            )
        else:
            # Multi-zone / moving watermark: create discrete time segments
            for d in valid_detections:
                t = d["time_s"]
                start_t = max(0.0, t - step_duration / 2)
                end_t = min(duration_s, t + step_duration / 2)
                intervals.append(
                    WatermarkInterval(
                        start_time_s=start_t,
                        end_time_s=end_t,
                        x_pct=d["x_pct"],
                        y_pct=d["y_pct"],
                        w_pct=d["w_pct"],
                        h_pct=d["h_pct"],
                        zone=d["zone"],
                        text=d.get("text", ""),
                        confidence=d.get("confidence", 0.5),
                    )
                )

        # Construct combined FFmpeg filter
        delogo_parts = [
            inv.to_delogo_expr(width, height)
            for inv in intervals
        ]
        ffmpeg_filter = ",".join(delogo_parts) if delogo_parts else None

        return DynamicWatermarkResult(
            is_detected=True,
            is_dynamic=is_dynamic,
            intervals=intervals,
            ffmpeg_filter=ffmpeg_filter,
            sample_count=len(frame_detections),
            duration_s=duration_s,
        )
