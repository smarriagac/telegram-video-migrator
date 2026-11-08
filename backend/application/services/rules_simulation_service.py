from __future__ import annotations

import re
from typing import Any

from backend.domain.entities.caption_rules import CaptionRules
from backend.application.services.caption_transformer_service import CaptionTransformerService


class RulesSimulationService:
    """Evaluates caption transformation and video branding rules in real time without executing live jobs."""

    def __init__(self, transformer: CaptionTransformerService | None = None) -> None:
        self.transformer = transformer or CaptionTransformerService()

    def simulate(
        self,
        sample_caption: str = "",
        caption_rules: dict[str, Any] | None = None,
        video_width: int = 1920,
        video_height: int = 1080,
        filter_type: str = "watermark_text",
        filter_params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        params = filter_params or {}
        width = max(100, int(video_width))
        height = max(100, int(video_height))

        # 1. Caption Simulation
        rules_entity = CaptionRules.from_dict(caption_rules)
        raw_caption = sample_caption or ""

        urls_found = self.transformer.URL_PATTERN.findall(raw_caption)
        mentions_found = self.transformer.MENTION_PATTERN.findall(raw_caption)
        words_removed_count = 0
        if rules_entity.remove_words:
            for w in rules_entity.remove_words:
                if w.strip():
                    words_removed_count += len(re.findall(re.escape(w.strip()), raw_caption, re.IGNORECASE))

        transformed_caption = self.transformer.transform(raw_caption, rules_entity)

        caption_result = {
            "original_caption": raw_caption,
            "transformed_caption": transformed_caption,
            "original_length": len(raw_caption),
            "transformed_length": len(transformed_caption),
            "delta_length": len(transformed_caption) - len(raw_caption),
            "urls_detected": len(urls_found),
            "mentions_detected": len(mentions_found),
            "words_removed_count": words_removed_count,
        }

        # 2. Delogo Region Calculations
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

        if preset != "bottom_bar":
            max_w = int(width * 0.38)
            w = min(w, max_w)
        max_h = int(height * 0.20)
        h = min(h, max_h)
        x = max(min(x, width - w), 0)
        y = max(min(y, height - h), 0)

        delogo_result = {
            "preset": preset,
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "x_pct": round(x / width, 4),
            "y_pct": round(y / height, 4),
            "w_pct": round(w / width, 4),
            "h_pct": round(h / height, 4),
        }

        # 3. Watermark Overlay Calculations
        wm_text = str(
            params.get("watermark_text")
            or params.get("branding_text")
            or "@TelegramHub"
        )
        position = str(params.get("watermark_position", params.get("position", "bottom_right"))).lower()
        margin = max(10, int(params.get("margin", 20)))

        font_size = int(params.get("watermark_font_size", params.get("font_size", 0)))
        if font_size <= 0:
            font_size = max(18, min(48, int(height * 0.035)))

        font_color = str(params.get("font_color", "white@0.85"))
        with_box = bool(params.get("with_box", True))

        if position == "bottom_right":
            x_expr = f"w-tw-{margin}"
            y_expr = f"h-th-{margin}"
            wm_x_pct = 0.82
            wm_y_pct = 0.90
        elif position == "top_right":
            x_expr = f"w-tw-{margin}"
            y_expr = f"{margin}"
            wm_x_pct = 0.82
            wm_y_pct = 0.06
        elif position == "bottom_left":
            x_expr = f"{margin}"
            y_expr = f"h-th-{margin}"
            wm_x_pct = 0.04
            wm_y_pct = 0.90
        elif position == "top_left":
            x_expr = f"{margin}"
            y_expr = f"{margin}"
            wm_x_pct = 0.04
            wm_y_pct = 0.06
        elif position == "center":
            x_expr = "(w-tw)/2"
            y_expr = "(h-th)/2"
            wm_x_pct = 0.45
            wm_y_pct = 0.48
        else:
            x_expr = f"w-tw-{margin}"
            y_expr = f"h-th-{margin}"
            wm_x_pct = 0.82
            wm_y_pct = 0.90

        watermark_result = {
            "text": wm_text,
            "position": position,
            "font_size": font_size,
            "font_color": font_color,
            "with_box": with_box,
            "margin": margin,
            "x_expr": x_expr,
            "y_expr": y_expr,
            "preview_x_pct": wm_x_pct,
            "preview_y_pct": wm_y_pct,
        }

        # 4. Generate FFmpeg command preview string
        safe_wm_text = wm_text.replace("'", "").replace(":", "").replace("\\", "")
        box_opts = ":box=1:boxcolor=black@0.45:boxborderw=5" if with_box else ""
        drawtext_str = (
            f"drawtext=text='{safe_wm_text}':fontsize={font_size}:fontcolor={font_color}"
            f":x={x_expr}:y={y_expr}{box_opts}"
        )
        delogo_str = f"delogo=x={x}:y={y}:w={w}:h={h}:show=0"

        if filter_type in ("watermark_text", "watermark", "branding"):
            vf = drawtext_str
        elif filter_type == "blur":
            vf = f"[0:v]crop={w}:{h}:{x}:{y},boxblur=15[fg];[0:v][fg]overlay={x}:{y}"
        elif filter_type == "delogo_and_watermark":
            vf = f"{delogo_str},{drawtext_str}"
        else:
            vf = delogo_str

        return {
            "caption": caption_result,
            "delogo": delogo_result,
            "watermark": watermark_result,
            "video_dimensions": {"width": width, "height": height, "aspect_ratio": f"{width}:{height}"},
            "filter_type": filter_type,
            "ffmpeg_args": ["-vf", vf] if filter_type != "blur" else ["-filter_complex", vf],
            "ffmpeg_filter_string": vf,
        }
