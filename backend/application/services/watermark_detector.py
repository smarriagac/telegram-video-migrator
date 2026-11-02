from __future__ import annotations

import logging
import os
from typing import Any
import cv2
import numpy as np

logger = logging.getLogger("telegram_migrator.watermark_detector")


class WatermarkDetector:
    """Intelligent watermark detector combining zone-based edge clustering,

    color segmentation, and OCR to locate video watermarks automatically.
    """

    @staticmethod
    def detect_from_image_bytes(image_bytes: bytes) -> dict[str, Any]:
        """Detect watermark coordinates from image bytes (thumbnail or keyframe)."""
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return {"detected": False, "error": "Could not decode image bytes"}

        return WatermarkDetector.detect_from_bgr(img)

    @staticmethod
    def detect_from_file(image_path: str) -> dict[str, Any]:
        """Detect watermark coordinates from an image file path."""
        if not os.path.exists(image_path):
            return {"detected": False, "error": "File does not exist"}
        img = cv2.imread(image_path)
        if img is None:
            return {"detected": False, "error": "Could not read image"}
        return WatermarkDetector.detect_from_bgr(img)

    @staticmethod
    def detect_from_bgr(img: np.ndarray) -> dict[str, Any]:
        """Core detection pipeline evaluating high-probability watermark zones."""
        h, w, _ = img.shape
        if h < 40 or w < 40:
            return {"detected": False, "error": "Image too small for watermark detection"}

        detected_candidates: list[dict[str, Any]] = []

        # 1. First, try OCR if pytesseract is installed and readable
        try:
            import pytesseract
            ocr_data = pytesseract.image_to_data(
                img,
                output_type=pytesseract.Output.DICT,
                lang="spa+eng",
                config="--psm 11",
            )
            words = []
            boxes = []
            for i in range(len(ocr_data["text"])):
                txt = ocr_data["text"][i].strip()
                conf = int(ocr_data["conf"][i])
                if txt and conf > 35 and len(txt) > 2:
                    words.append(txt)
                    boxes.append((
                        ocr_data["left"][i],
                        ocr_data["top"][i],
                        ocr_data["width"][i],
                        ocr_data["height"][i],
                        conf,
                    ))

            if boxes:
                min_x = min(b[0] for b in boxes)
                min_y = min(b[1] for b in boxes)
                max_x = max(b[0] + b[2] for b in boxes)
                max_y = max(b[1] + b[3] for b in boxes)
                bw = max_x - min_x
                bh = max_y - min_y
                avg_conf = sum(b[4] for b in boxes) / len(boxes)

                if bw > 40 and bh > 18:
                    detected_candidates.append({
                        "method": "ocr",
                        "text": " ".join(words),
                        "box": (min_x, min_y, bw, bh),
                        "preset": "center",
                        "confidence": min(0.96, avg_conf / 100.0),
                    })
        except Exception as ocr_err:
            logger.debug(f"WatermarkDetector: OCR pass skipped or failed: {ocr_err}")

        # 2. Zone-based Computer Vision Scanning
        # Evaluates isolated sub-regions to prevent full-screen UI borders from skewing contours
        zones = [
            # name, y_start_pct, y_end_pct, x_start_pct, x_end_pct, base_priority
            ("center", 0.22, 0.65, 0.08, 0.92, 0.90),
            ("top_right", 0.02, 0.35, 0.55, 0.98, 0.85),
            ("bottom_right", 0.65, 0.96, 0.55, 0.98, 0.82),
            ("bottom_bar", 0.75, 0.95, 0.05, 0.95, 0.78),
            ("top_left", 0.02, 0.35, 0.02, 0.45, 0.75),
        ]

        for zone_name, ys_pct, ye_pct, xs_pct, xe_pct, zone_weight in zones:
            y1 = int(h * ys_pct)
            y2 = int(h * ye_pct)
            x1 = int(w * xs_pct)
            x2 = int(w * xe_pct)

            crop = img[y1:y2, x1:x2]
            ch, cw, _ = crop.shape
            if ch < 20 or cw < 30:
                continue

            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            # High-pass edge detection
            edges = cv2.Canny(gray, 40, 160)

            # Dilate to connect letters into word blocks
            kw = max(8, int(cw * 0.06))
            kh = max(4, int(ch * 0.04))
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
            dilated = cv2.dilate(edges, kernel, iterations=2)

            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                cx, cy, cbw, cbh = cv2.boundingRect(cnt)
                area = cbw * cbh
                crop_area = cw * ch
                aspect = cbw / float(cbh) if cbh > 0 else 1.0

                # Watermarks are prominent blocks, aspect usually 1.2 to 5.0
                if cbw > 35 and cbh > 18 and (area / crop_area) >= 0.03:
                    # Calculate edge density inside the candidate
                    candidate_edges = edges[cy : cy + cbh, cx : cx + cbw]
                    edge_density = np.count_nonzero(candidate_edges) / float(area) if area > 0 else 0

                    if edge_density > 0.04:
                        # Global coordinates in original image
                        gx = x1 + cx
                        gy = y1 + cy

                        # Add smooth padding for delogo filter
                        pad_x = int(cbw * 0.08)
                        pad_y = int(cbh * 0.08)
                        fx = max(0, gx - pad_x)
                        fy = max(0, gy - pad_y)
                        fw = min(w - fx, cbw + (pad_x * 2))
                        fh = min(h - fy, cbh + (pad_y * 2))

                        aspect_bonus = 0.10 if (1.3 <= aspect <= 5.0) else 0.0
                        density_bonus = min(0.15, edge_density)
                        score = zone_weight + aspect_bonus + density_bonus

                        detected_candidates.append({
                            "method": "vision_cluster",
                            "text": None,
                            "preset": zone_name,
                            "box": (fx, fy, fw, fh),
                            "confidence": min(0.98, score),
                        })

        if not detected_candidates:
            # Fallback heuristic: Default center watermark region
            def_w = int(w * 0.65)
            def_h = int(h * 0.22)
            def_x = int((w - def_w) / 2)
            def_y = int((h - def_h) / 2)
            return {
                "detected": False,
                "confidence": 0.45,
                "preset": "center",
                "box": {"x": def_x, "y": def_y, "w": def_w, "h": def_h},
                "normalized_box": {
                    "x_pct": round(def_x / w, 3),
                    "y_pct": round(def_y / h, 3),
                    "w_pct": round(def_w / w, 3),
                    "h_pct": round(def_h / h, 3),
                },
                "message": "No se detectó una marca de agua prominente; usando región central por defecto.",
            }

        # Select candidate with highest confidence
        detected_candidates.sort(key=lambda c: c["confidence"], reverse=True)
        best = detected_candidates[0]
        bx, by, bw, bh = best["box"]

        return {
            "detected": True,
            "method": best["method"],
            "confidence": round(best["confidence"], 2),
            "text": best.get("text"),
            "preset": best.get("preset", "center"),
            "box": {"x": bx, "y": by, "w": bw, "h": bh},
            "normalized_box": {
                "x_pct": round(bx / w, 3),
                "y_pct": round(by / h, 3),
                "w_pct": round(bw / w, 3),
                "h_pct": round(bh / h, 3),
            },
            "frame_size": {"width": w, "height": h},
        }
