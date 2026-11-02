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
        """Detect watermark coordinates from an image or video file path."""
        if not os.path.exists(image_path):
            return {"detected": False, "error": "File does not exist"}

        ext = os.path.splitext(image_path)[1].lower()
        if ext in (".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"):
            try:
                cap = cv2.VideoCapture(image_path)
                # Sample at 1.5s or beginning to grab a representative frame
                cap.set(cv2.CAP_PROP_POS_MSEC, 1500)
                ret, frame = cap.read()
                if not ret or frame is None:
                    cap.set(cv2.CAP_PROP_POS_MSEC, 200)
                    ret, frame = cap.read()
                cap.release()
                if not ret or frame is None:
                    return {"detected": False, "error": "Could not extract frame from video"}
                return WatermarkDetector.detect_from_bgr(frame)
            except Exception as vid_err:
                logger.warning(f"WatermarkDetector: Failed to read video frame: {vid_err}")
                return {"detected": False, "error": str(vid_err)}

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
            word_candidates = []
            for i in range(len(ocr_data["text"])):
                txt = ocr_data["text"][i].strip()
                conf = int(ocr_data["conf"][i])
                if txt and conf > 35 and len(txt) >= 2:
                    bx = ocr_data["left"][i]
                    by = ocr_data["top"][i]
                    bw = ocr_data["width"][i]
                    bh = ocr_data["height"][i]
                    # Discard if individual word box is unreasonably large
                    if bw > w * 0.35 or bh > h * 0.18:
                        continue
                    lower = txt.lower()
                    is_handle = "@" in txt or "vip" in lower or "baba" in lower or ".com" in lower or "t.me" in lower
                    score = (conf / 100.0) + (0.50 if is_handle else 0.0)
                    word_candidates.append({
                        "text": txt,
                        "box": (bx, by, bw, bh),
                        "score": score,
                        "is_handle": is_handle,
                    })

            # Cluster nearby words (within horizontal 70px, vertical 25px)
            clusters: list[list[dict[str, Any]]] = []
            for wc in word_candidates:
                added = False
                for cluster in clusters:
                    for member in cluster:
                        mx, my, mw, mh = member["box"]
                        cx, cy, cw, ch = wc["box"]
                        if abs(cy - my) < max(30, ch) and (abs(cx - (mx + mw)) < 70 or abs(mx - (cx + cw)) < 70):
                            cluster.append(wc)
                            added = True
                            break
                    if added:
                        break
                if not added:
                    clusters.append([wc])

            for cluster in clusters:
                min_x = min(c["box"][0] for c in cluster)
                min_y = min(c["box"][1] for c in cluster)
                max_x = max(c["box"][0] + c["box"][2] for c in cluster)
                max_y = max(c["box"][1] + c["box"][3] for c in cluster)
                bw = max_x - min_x
                bh = max_y - min_y
                # Reject clusters that span too much of the screen
                if bw > w * 0.35 or bh > h * 0.18:
                    continue
                if bw < 30 or bh < 14:
                    continue

                pad_x = int(bw * 0.08)
                pad_y = int(bh * 0.10)
                fx = max(0, min_x - pad_x)
                fy = max(0, min_y - pad_y)
                fw = min(w - fx, bw + (pad_x * 2))
                fh = min(h - fy, bh + (pad_y * 2))

                text_str = " ".join(c["text"] for c in cluster)
                has_handle = any(c["is_handle"] for c in cluster)

                # Expand handle box to prevent truncating suffixes like '2vip'
                if has_handle or "baba" in text_str.lower() or "@" in text_str or "vip" in text_str.lower():
                    expected_min_w = int(bh * 4.2)
                    if bw < expected_min_w:
                        bw = expected_min_w
                    pad_right = int(bw * 0.35)
                    fw = min(w - fx, bw + pad_x + pad_right)

                avg_score = sum(c["score"] for c in cluster) / len(cluster)
                final_score = min(0.99, avg_score + (0.35 if has_handle else 0.0))

                detected_candidates.append({
                    "method": "ocr",
                    "text": text_str,
                    "box": (fx, fy, fw, fh),
                    "preset": "custom",
                    "confidence": final_score,
                })
        except Exception as ocr_err:
            logger.debug(f"WatermarkDetector: OCR pass skipped or failed: {ocr_err}")

        # 2. Zone-based Computer Vision Scanning
        # Evaluates isolated sub-regions to prevent full-screen UI borders from skewing contours
        zones = [
            # name, y_start_pct, y_end_pct, x_start_pct, x_end_pct, base_priority
            ("top_right", 0.02, 0.35, 0.50, 0.98, 0.90),
            ("bottom_right", 0.65, 0.96, 0.50, 0.98, 0.85),
            ("center", 0.28, 0.60, 0.15, 0.85, 0.70),
            ("bottom_bar", 0.78, 0.96, 0.05, 0.95, 0.75),
            ("top_left", 0.02, 0.35, 0.02, 0.45, 0.72),
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
            kw = max(6, int(cw * 0.04))
            kh = max(3, int(ch * 0.03))
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
            dilated = cv2.dilate(edges, kernel, iterations=1)

            contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                cx, cy, cbw, cbh = cv2.boundingRect(cnt)
                area = cbw * cbh
                crop_area = cw * ch
                aspect = cbw / float(cbh) if cbh > 0 else 1.0

                # Strict dimension filter: ignore huge blocks or background edges
                if cbw < 35 or cbh < 16:
                    continue
                if cbw > w * 0.35 or cbh > h * 0.16:
                    continue
                if (area / crop_area) > 0.25:
                    continue

                candidate_edges = edges[cy : cy + cbh, cx : cx + cbw]
                edge_density = np.count_nonzero(candidate_edges) / float(area) if area > 0 else 0

                if edge_density > 0.05:
                    gx = x1 + cx
                    gy = y1 + cy

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
                        "confidence": min(0.95, score),
                    })

        if not detected_candidates:
            # Safe Fallback: subtle top-right watermark region, NEVER huge screen-filling box
            def_w = int(w * 0.28)
            def_h = int(h * 0.08)
            def_x = int(w * 0.68)
            def_y = int(h * 0.03)
            return {
                "detected": False,
                "confidence": 0.0,
                "preset": "top_right",
                "box": {"x": def_x, "y": def_y, "w": def_w, "h": def_h},
                "normalized_box": {
                    "x_pct": round(def_x / w, 3),
                    "y_pct": round(def_y / h, 3),
                    "w_pct": round(def_w / w, 3),
                    "h_pct": round(def_h / h, 3),
                },
                "message": "No se detectó una marca de agua prominente.",
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
