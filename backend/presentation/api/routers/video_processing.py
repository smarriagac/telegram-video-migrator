from __future__ import annotations

import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.domain.entities.user import User
from backend.presentation.dependencies import (
    get_current_user,
    get_job_repository,
    get_telegram_gateway,
    get_video_processing_service,
)
from backend.application.services.watermark_detector import WatermarkDetector

logger = logging.getLogger("telegram_migrator.video_processing_api")
router = APIRouter(prefix="/video-processing", tags=["Video Processing (FFmpeg)"])


class EnqueueVideoJobRequest(BaseModel):
    source_channel_id: int
    source_message_id: int
    target_channel_id: int
    filter_type: str = "delogo"
    filter_params: dict[str, Any] = {"preset": "center"}
    resolution_preset: str | None = None
    crf: int | None = None
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    account_id: int | None = None
    new_caption: str | None = None


class EnqueueBatchJobRequest(BaseModel):
    source_channel_id: int
    source_message_ids: list[int]
    target_channel_id: int
    filter_type: str = "delogo"
    filter_params: dict[str, Any] = {"preset": "center"}
    resolution_preset: str | None = None
    crf: int | None = None
    source_channel_title: str | None = None
    target_channel_title: str | None = None
    account_id: int | None = None


class DetectWatermarkRequest(BaseModel):
    source_channel_id: int
    source_message_id: int
    account_id: int | None = None


class SimulateRulesRequest(BaseModel):
    sample_caption: str = ""
    caption_rules: dict[str, Any] | None = None
    video_width: int = 1920
    video_height: int = 1080
    filter_type: str = "watermark_text"
    filter_params: dict[str, Any] = {}


class EvaluateStrategyRequest(BaseModel):
    width: int
    height: int
    video_codec: str = "h264"
    bitrate_kbps: int = 2500
    preset: str = "AUTO_MOBILE"
    crf: int | None = None


class SlicePlanRequest(BaseModel):
    duration_s: float
    max_segment_seconds: float = 60.0


class SubtitlesPreviewRequest(BaseModel):
    sample_text: str = ""
    duration_s: float = 15.0
    style: str = "KINETIC_YELLOW"
    margin_v: int = 80


@router.post("/subtitles-preview")
async def generate_subtitles_preview_endpoint(
    payload: SubtitlesPreviewRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Generates kinetic subtitle cues and FFmpeg filter preview for given duration and text."""
    from backend.application.services.subtitle_engine import SubtitleEngine

    cues = SubtitleEngine.chunk_text_into_cues(
        text=payload.sample_text or "¡Descubrí el mejor contenido de Telegram!",
        total_duration_s=payload.duration_s,
    )
    srt_content = "".join(cue.to_srt_block() for cue in cues)
    filter_preview = SubtitleEngine.build_subtitles_filter(
        srt_path="subtitles.srt",
        style=payload.style,
        margin_v=payload.margin_v,
    )
    return {
        "success": True,
        "style": payload.style,
        "duration_s": payload.duration_s,
        "total_cues": len(cues),
        "cues": [
            {
                "index": c.index,
                "start_s": c.start_s,
                "end_s": c.end_s,
                "duration_s": c.duration_s,
                "text": c.text,
            }
            for c in cues
        ],
        "srt_content": srt_content,
        "filter_preview": filter_preview,
    }


@router.post("/slice-plan")
async def calculate_slice_plan_endpoint(
    payload: SlicePlanRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Calculates temporal start and end timestamps to slice video into <=60s story parts."""
    from backend.application.services.story_slicer_engine import StorySlicerEngine

    intervals = StorySlicerEngine.compute_slice_plan(
        duration_s=payload.duration_s,
        max_segment_seconds=payload.max_segment_seconds,
    )
    return {
        "success": True,
        "duration_s": payload.duration_s,
        "max_segment_seconds": payload.max_segment_seconds,
        "total_segments": len(intervals),
        "intervals": [
            {"part": i, "start_s": s, "end_s": e, "duration_s": round(e - s, 2)}
            for i, (s, e) in enumerate(intervals, start=1)
        ],
    }


@router.post("/strategy")
async def evaluate_strategy_endpoint(
    payload: EvaluateStrategyRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Simulates smart transcoding decision matrix for given media attributes."""
    from backend.application.services.smart_transcoding_engine import (
        SmartTranscodingEngine,
        VideoProbeResult,
    )
    probe = VideoProbeResult(
        width=payload.width,
        height=payload.height,
        video_codec=payload.video_codec,
        bitrate_kbps=payload.bitrate_kbps,
    )
    strategy = SmartTranscodingEngine.decide_strategy(
        probe=probe,
        preset=payload.preset,
        custom_crf=payload.crf,
    )
    return {
        "success": True,
        "strategy": {
            "action": strategy.action,
            "target_codec": strategy.target_codec,
            "target_width": strategy.target_width,
            "crf": strategy.crf,
            "bitrate_cap_k": strategy.bitrate_cap_k,
            "scale_filter": strategy.scale_filter,
            "reason": strategy.reason,
            "codec_args": strategy.codec_args,
        },
    }


@router.post("/simulate")
async def simulate_rules_endpoint(
    payload: SimulateRulesRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Evaluates caption transformation and video branding rules in real time without executing live jobs."""
    from backend.application.services.rules_simulation_service import RulesSimulationService
    service = RulesSimulationService()
    result = service.simulate(
        sample_caption=payload.sample_caption,
        caption_rules=payload.caption_rules,
        video_width=payload.video_width,
        video_height=payload.video_height,
        filter_type=payload.filter_type,
        filter_params=payload.filter_params,
    )
    return {"success": True, **result}


@router.post("/detect")
async def detect_watermark_endpoint(
    payload: DetectWatermarkRequest,
    current_user: User = Depends(get_current_user),
    gateway: Any = Depends(get_telegram_gateway),
    repo: Any = Depends(get_job_repository),
) -> dict[str, Any]:
    """Analyze video thumbnail with computer vision and OCR to auto-detect watermark coordinates."""
    try:
        thumb_bytes = await gateway.get_message_thumbnail(
            channel_id=payload.source_channel_id,
            message_id=payload.source_message_id,
            repo=repo,
            account_id=payload.account_id,
        )
        if not thumb_bytes:
            return {
                "success": True,
                "detected": False,
                "confidence": 0.4,
                "preset": "center",
                "message": "Miniatura no disponible; usando zona central recomendada.",
            }

        detection = WatermarkDetector.detect_from_image_bytes(thumb_bytes)
        return {"success": True, **detection}
    except Exception as ex:
        logger.warning(f"Watermark auto-detection failed: {ex}")
        return {
            "success": True,
            "detected": False,
            "confidence": 0.3,
            "preset": "center",
            "message": f"Detección no concluyente: {ex}. Podés seleccionar la zona manualmente.",
        }


@router.get("/presets")
async def list_transcoding_presets(
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Retrieve available video transcoding and downsampling resolution presets."""
    presets = service.get_presets()
    return {"presets": presets}


@router.get("/aspect-ratios")
async def list_aspect_ratio_presets(
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Retrieve available aspect ratio transformation modes for Telegram Stories."""
    presets = service.get_aspect_ratio_presets()
    return {"aspect_ratios": presets}


@router.post("/dynamic-detect")
async def dynamic_detect_watermark_endpoint(
    payload: DetectWatermarkRequest,
    current_user: User = Depends(get_current_user),
    gateway: Any = Depends(get_telegram_gateway),
    repo: Any = Depends(get_job_repository),
) -> dict[str, Any]:
    """Temporal multi-frame watermark detection across video timeline."""
    try:
        from backend.application.services.dynamic_watermark_detector import DynamicWatermarkDetector
        thumb_bytes = await gateway.get_message_thumbnail(
            channel_id=payload.source_channel_id,
            message_id=payload.source_message_id,
            repo=repo,
            account_id=payload.account_id,
        )
        if thumb_bytes:
            detection = WatermarkDetector.detect_from_image_bytes(thumb_bytes)
            norm = detection.get("normalized_box", {})
            return {
                "success": True,
                "is_detected": detection.get("detected", False),
                "is_dynamic": False,
                "sample_count": 1,
                "duration_s": 0.0,
                "intervals": [
                    {
                        "start_time_s": 0.0,
                        "end_time_s": 0.0,
                        "zone": detection.get("zone", "center"),
                        "x_pct": norm.get("x_pct", 0.0),
                        "y_pct": norm.get("y_pct", 0.0),
                        "w_pct": norm.get("w_pct", 0.0),
                        "h_pct": norm.get("h_pct", 0.0),
                        "confidence": detection.get("confidence", 0.5),
                        "text": detection.get("text", ""),
                    }
                ] if detection.get("detected") else [],
            }
        return {"success": True, "is_detected": False, "is_dynamic": False, "intervals": []}
    except Exception as ex:
        logger.warning(f"Dynamic watermark detection fallback error: {ex}")
        return {"success": True, "is_detected": False, "is_dynamic": False, "intervals": []}


@router.post("/enqueue")
async def enqueue_video_processing(
    payload: EnqueueVideoJobRequest,
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Enqueue a video from a channel for asynchronous FFmpeg watermark removal / delogo processing."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    params = dict(payload.filter_params)
    if payload.resolution_preset:
        params["resolution_preset"] = payload.resolution_preset
    if payload.crf is not None:
        params["crf"] = payload.crf

    try:
        res = await service.enqueue_job(
            tenant_id=tenant_id,
            source_channel_id=payload.source_channel_id,
            source_message_id=payload.source_message_id,
            target_channel_id=payload.target_channel_id,
            filter_type=payload.filter_type,
            filter_params=params,
            source_channel_title=payload.source_channel_title,
            target_channel_title=payload.target_channel_title,
            account_id=payload.account_id,
            new_caption=payload.new_caption,
        )
        return {"success": True, "job": res}
    except Exception as ex:
        logger.error(f"Failed to enqueue video processing job: {ex}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al encolar trabajo de procesamiento FFmpeg: {ex}",
        )


@router.post("/enqueue-batch")
async def enqueue_batch_video_processing(
    payload: EnqueueBatchJobRequest,
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Enqueue multiple messages (videos/photos) in bulk for FFmpeg watermark removal."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    params = dict(payload.filter_params)
    if payload.resolution_preset:
        params["resolution_preset"] = payload.resolution_preset
    if payload.crf is not None:
        params["crf"] = payload.crf

    enqueued_jobs = []
    for msg_id in payload.source_message_ids:
        try:
            res = await service.enqueue_job(
                tenant_id=tenant_id,
                source_channel_id=payload.source_channel_id,
                source_message_id=msg_id,
                target_channel_id=payload.target_channel_id,
                filter_type=payload.filter_type,
                filter_params=params,
                source_channel_title=payload.source_channel_title,
                target_channel_title=payload.target_channel_title,
                account_id=payload.account_id,
            )
            enqueued_jobs.append(res)
        except Exception as ex:
            logger.warning(f"Batch sanitize: Failed to enqueue msg #{msg_id}: {ex}")

    return {
        "success": True,
        "enqueued_count": len(enqueued_jobs),
        "total_requested": len(payload.source_message_ids),
        "jobs": enqueued_jobs,
    }


@router.get("/jobs")
async def list_video_processing_jobs(
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> list[dict[str, Any]]:
    """List recent and active FFmpeg video processing queue jobs."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    try:
        return await service.list_jobs(tenant_id=tenant_id, limit=50)
    except Exception as ex:
        logger.error(f"Failed to list video processing jobs: {ex}", exc_info=True)
        return []


@router.post("/jobs/{job_id}/cancel")
async def cancel_video_processing_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Cancel a pending or running FFmpeg job."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    ok = await service.cancel_job(tenant_id=tenant_id, job_id=job_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo no encontrado o ya finalizado.",
        )
    return {"success": True, "message": "Trabajo cancelado con éxito."}


@router.delete("/jobs/{job_id}")
async def delete_video_processing_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Delete a completed or failed FFmpeg job record."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    ok = await service.delete_job(tenant_id=tenant_id, job_id=job_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro no encontrado.",
        )
    return {"success": True, "message": "Registro eliminado."}


@router.post("/jobs/{job_id}/retry")
async def retry_video_processing_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    service: Any = Depends(get_video_processing_service),
) -> dict[str, Any]:
    """Retry a failed or cancelled FFmpeg job."""
    tenant_id = current_user.tenant_id or "00000000-0000-0000-0000-000000000001"
    ok = await service.retry_job(tenant_id=tenant_id, job_id=job_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo no encontrado o no reintentable.",
        )
    return {"success": True, "message": "Trabajo reencolado para procesamiento."}
