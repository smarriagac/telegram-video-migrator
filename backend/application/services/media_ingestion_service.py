from __future__ import annotations

import asyncio
import inspect
import json
import logging
import os
import re
import shutil
import tempfile
import uuid
from typing import Any, Callable

import yt_dlp

from backend.application.services.smart_transcoding_engine import SmartTranscodingEngine
from backend.application.services.story_slicer_engine import StorySlicerEngine, StorySegment

logger = logging.getLogger("telegram_migrator.media_ingestion")


class MediaIngestionService:
    """Multi-platform media ingestion service.

    Downloads video content from TikTok, Instagram Reels, YouTube Shorts, X/Twitter,
    and formats them for Telegram (direct upload or content reservoir staging).
    """

    def __init__(
        self,
        gateway_provider: Callable[..., Any] | None = None,
        drip_service: Any = None,
    ) -> None:
        self.gateway_provider = gateway_provider
        self.drip_service = drip_service

    @staticmethod
    def identify_platform(url: str) -> str:
        """Determines originating platform from URL patterns."""
        clean = (url or "").lower()
        if "tiktok.com" in clean:
            return "tiktok"
        if "instagram.com" in clean:
            return "instagram"
        if "youtube.com" in clean or "youtu.be" in clean:
            return "youtube"
        if "twitter.com" in clean or "x.com" in clean:
            return "twitter"
        if "facebook.com" in clean or "fb.watch" in clean:
            return "facebook"
        return "generic"

    @classmethod
    def inspect_url(cls, url: str) -> dict[str, Any]:
        """Extracts metadata from remote video URL without downloading the media payload."""
        platform = cls.identify_platform(url)
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": False,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if not info:
                    return {
                        "success": False,
                        "error": "Could not extract metadata from URL",
                        "platform": platform,
                    }

                title = info.get("title") or info.get("description") or "Video"
                uploader = info.get("uploader") or info.get("creator") or info.get("channel") or ""
                duration = float(info.get("duration") or 0.0)
                thumbnail = info.get("thumbnail") or ""
                width = info.get("width") or 0
                height = info.get("height") or 0

                return {
                    "success": True,
                    "platform": platform,
                    "title": title[:200],
                    "uploader": uploader,
                    "duration": round(duration, 2),
                    "thumbnail": thumbnail,
                    "width": width,
                    "height": height,
                    "webpage_url": info.get("webpage_url") or url,
                }
        except Exception as e:
            logger.warning(f"MediaIngestionService: inspect_url failed for {url}: {e}")
            return {
                "success": False,
                "error": str(e),
                "platform": platform,
            }

    @classmethod
    def download_media(
        cls,
        url: str,
        output_dir: str,
    ) -> tuple[str, dict[str, Any]]:
        """Downloads best quality MP4 video to specified target directory."""
        os.makedirs(output_dir, exist_ok=True)
        unique_prefix = uuid.uuid4().hex[:8]
        outtmpl = os.path.join(output_dir, f"{unique_prefix}_%(id)s.%(ext)s")

        ydl_opts = {
            "outtmpl": outtmpl,
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "merge_output_format": "mp4",
            "quiet": True,
            "no_warnings": True,
            "restrictfilenames": True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if not info:
                raise RuntimeError("yt-dlp returned no metadata")

            # Resolve actual downloaded file path
            expected_fn = ydl.prepare_filename(info)
            base_no_ext, _ = os.path.splitext(expected_fn)
            final_mp4 = f"{base_no_ext}.mp4"

            actual_file = None
            if os.path.exists(final_mp4):
                actual_file = final_mp4
            elif os.path.exists(expected_fn):
                actual_file = expected_fn
            else:
                # Find any file created in output_dir
                for fn in os.listdir(output_dir):
                    if fn.startswith(unique_prefix):
                        actual_file = os.path.join(output_dir, fn)
                        break

            if not actual_file or not os.path.exists(actual_file):
                raise RuntimeError("Downloaded media file was not found on disk")

            meta = {
                "title": info.get("title") or "Ingested Media",
                "uploader": info.get("uploader") or "",
                "duration": float(info.get("duration") or 0.0),
                "platform": cls.identify_platform(url),
                "source_url": url,
            }
            return actual_file, meta

    @classmethod
    async def process_media_for_stories(
        cls,
        input_path: str,
        output_path: str,
        aspect_ratio_mode: str = "9:16_BLUR",
        target_height: int = 1920,
        branding_text: str | None = None,
    ) -> str:
        """Applies 9:16 auto-crop / blurred background and optional branding text via FFmpeg."""
        filter_type, filter_str = SmartTranscodingEngine.build_aspect_ratio_filter(
            mode=aspect_ratio_mode,
            src_width=1920,
            src_height=1080,
            target_height=target_height,
        )

        if not filter_str:
            # No aspect ratio transformation requested
            return input_path

        ffmpeg_cmd = ["ffmpeg", "-y", "-i", input_path]

        if filter_type == "-filter_complex":
            if branding_text:
                safe_text = branding_text.replace("'", "'\\\\\\''").replace(":", "\\:")
                drawtext = f"drawtext=text='{safe_text}':fontsize=36:fontcolor=white@0.85:x=w-tw-30:y=h-th-30:box=1:boxcolor=black@0.45"
                chained_complex = f"{filter_str}[merged];[merged]{drawtext}[outv]"
                ffmpeg_cmd.extend(["-filter_complex", chained_complex, "-map", "[outv]", "-map", "0:a?"])
            else:
                ffmpeg_cmd.extend(["-filter_complex", f"{filter_str}[outv]", "-map", "[outv]", "-map", "0:a?"])
        else:
            vf = filter_str
            if branding_text:
                safe_text = branding_text.replace("'", "'\\\\\\''").replace(":", "\\:")
                drawtext = f"drawtext=text='{safe_text}':fontsize=36:fontcolor=white@0.85:x=w-tw-30:y=h-th-30:box=1:boxcolor=black@0.45"
                vf = f"{vf},{drawtext}"
            ffmpeg_cmd.extend(["-vf", vf])

        ffmpeg_cmd.extend([
            "-c:v", "libx265",
            "-tag:v", "hvc1",
            "-preset", "fast",
            "-crf", "27",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            output_path,
        ])

        proc = await asyncio.create_subprocess_exec(
            *ffmpeg_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            err = stderr.decode(errors="replace")[-500:]
            raise RuntimeError(f"FFmpeg story transcode failed: {err}")

        return output_path

    async def ingest(
        self,
        tenant_id: str,
        url: str,
        target_channel_id: int,
        mode: str = "DIRECT",  # "DIRECT" or "RESERVOIR"
        caption_override: str | None = None,
        aspect_ratio_mode: str | None = None,  # "9:16_BLUR", "9:16_CROP", "ORIGINAL"
        branding_text: str | None = None,
        account_id: int | None = None,
        campaign_id: str | None = None,
        slice_stories: bool = False,
        slice_dispatch_mode: str = "ALBUM",  # "ALBUM" or "SEQUENTIAL"
        max_slice_seconds: float = 60.0,
        burn_subtitles: bool = False,
        subtitle_style: str = "KINETIC_YELLOW",
        generate_thumbnail: bool = True,
    ) -> dict[str, Any]:
        """Executes complete ingestion pipeline: download, optional 9:16 transcode, subtitles, 60s slicing, thumbnails, and posting."""
        tmp_dir = tempfile.mkdtemp(prefix="ingest_")
        try:
            # 1. Download source media
            downloaded_file, meta = await asyncio.to_thread(self.download_media, url, tmp_dir)

            # 2. Process for Telegram Stories (9:16 vertical) if requested
            media_to_upload = downloaded_file
            if aspect_ratio_mode and aspect_ratio_mode.upper() in ("9:16_BLUR", "9:16_CROP"):
                processed_output = os.path.join(tmp_dir, "story_9_16.mp4")
                media_to_upload = await self.process_media_for_stories(
                    input_path=downloaded_file,
                    output_path=processed_output,
                    aspect_ratio_mode=aspect_ratio_mode,
                    branding_text=branding_text,
                )

            # 3. Formulate caption
            caption = caption_override
            if caption is None:
                orig_title = meta.get("title", "")
                platform = meta.get("platform", "web")
                caption = f"{orig_title}\n\n#{platform}"

            # 3.5. Burn kinetic subtitles if requested
            if burn_subtitles:
                from backend.application.services.subtitle_engine import SubtitleEngine
                srt_path = os.path.join(tmp_dir, "ingest_subs.srt")
                await SubtitleEngine.generate_subtitles(
                    video_path=media_to_upload,
                    output_srt_path=srt_path,
                    caption_hint=caption,
                )
                burned_output = os.path.join(tmp_dir, "media_with_subtitles.mp4")
                media_to_upload = await SubtitleEngine.burn_subtitles_to_video(
                    input_path=media_to_upload,
                    output_path=burned_output,
                    srt_path=srt_path,
                    style=subtitle_style,
                )

            # 4. 60-Second Story Slicing if requested or if duration exceeds limit
            segments: list[StorySegment] = []
            if slice_stories:
                slices_dir = os.path.join(tmp_dir, "story_slices")
                segments = await StorySlicerEngine.slice_video(
                    input_path=media_to_upload,
                    output_dir=slices_dir,
                    max_segment_seconds=max_slice_seconds,
                    base_caption=caption,
                )

            # 5. Resolve Telegram Client
            if not self.gateway_provider:
                raise RuntimeError("Telegram gateway provider is not configured")

            if inspect.iscoroutinefunction(self.gateway_provider):
                gateway = await self.gateway_provider(tenant_id)
            else:
                gw_res = self.gateway_provider(tenant_id)
                if inspect.isawaitable(gw_res):
                    gateway = await gw_res
                else:
                    gateway = gw_res

            client = gateway._get_client(account_id)
            if inspect.isawaitable(client):
                client = await client

            if not client:
                raise RuntimeError("Telegram client is not connected or unauthorized")

            await gateway._ensure_connected(client)

            try:
                target_entity = await client.get_input_entity(target_channel_id)
            except Exception:
                target_entity = await client.get_entity(target_channel_id)

            # 5.5. Generate poster thumbnail to prevent black frame preview in Telegram
            thumb_path: str | None = None
            if generate_thumbnail:
                try:
                    from backend.application.services.thumbnail_engine import ThumbnailEngine
                    thumb_candidate = os.path.join(tmp_dir, "ingest_poster_thumb.jpg")
                    thumb_path = await ThumbnailEngine.extract_poster_frame(media_to_upload, thumb_candidate)
                except Exception as th_err:
                    logger.warning(f"Failed to generate thumbnail for ingestion: {th_err}")

            # 6. Upload / Stage
            has_multiple_slices = len(segments) > 1

            if mode.upper() == "DIRECT":
                if has_multiple_slices and slice_dispatch_mode.upper() == "ALBUM":
                    # Send as unified Telegram Media Group (Album)
                    file_list = [s.file_path for s in segments]
                    sent_msgs = await client.send_file(
                        target_entity,
                        file=file_list,
                        caption=caption,
                        supports_streaming=True,
                        thumb=thumb_path if thumb_path and os.path.exists(thumb_path) else None,
                    )
                    sent_ids = [getattr(m, "id", None) for m in sent_msgs] if isinstance(sent_msgs, list) else [getattr(sent_msgs, "id", None)]
                    return {
                        "success": True,
                        "mode": "DIRECT",
                        "dispatch": "ALBUM",
                        "target_channel_id": target_channel_id,
                        "message_ids": sent_ids,
                        "message_id": sent_ids[0] if sent_ids else None,
                        "segments_count": len(segments),
                        "meta": meta,
                        "aspect_ratio_mode": aspect_ratio_mode,
                        "burn_subtitles": burn_subtitles,
                        "subtitle_style": subtitle_style,
                        "thumbnail_generated": bool(thumb_path),
                    }
                elif has_multiple_slices:
                    # Sequential dispatch with part-labeled captions
                    sent_ids = []
                    for seg in segments:
                        s_msg = await client.send_file(
                            target_entity,
                            file=seg.file_path,
                            caption=seg.caption,
                            supports_streaming=True,
                            thumb=thumb_path if thumb_path and os.path.exists(thumb_path) else None,
                        )
                        sent_ids.append(getattr(s_msg, "id", None))
                        await asyncio.sleep(0.5)

                    return {
                        "success": True,
                        "mode": "DIRECT",
                        "dispatch": "SEQUENTIAL",
                        "target_channel_id": target_channel_id,
                        "message_ids": sent_ids,
                        "message_id": sent_ids[0] if sent_ids else None,
                        "segments_count": len(segments),
                        "meta": meta,
                        "aspect_ratio_mode": aspect_ratio_mode,
                        "burn_subtitles": burn_subtitles,
                        "subtitle_style": subtitle_style,
                        "thumbnail_generated": bool(thumb_path),
                    }
                else:
                    # Single video upload
                    sent_msg = await client.send_file(
                        target_entity,
                        file=media_to_upload,
                        caption=caption,
                        supports_streaming=True,
                        thumb=thumb_path if thumb_path and os.path.exists(thumb_path) else None,
                    )
                    sent_msg_id = getattr(sent_msg, "id", None)
                    return {
                        "success": True,
                        "mode": "DIRECT",
                        "dispatch": "SINGLE",
                        "target_channel_id": target_channel_id,
                        "message_id": sent_msg_id,
                        "meta": meta,
                        "aspect_ratio_mode": aspect_ratio_mode,
                        "burn_subtitles": burn_subtitles,
                        "subtitle_style": subtitle_style,
                        "thumbnail_generated": bool(thumb_path),
                    }

            elif mode.upper() == "RESERVOIR":
                if has_multiple_slices:
                    sent_ids = []
                    for seg in segments:
                        s_msg = await client.send_file(
                            target_entity,
                            file=seg.file_path,
                            caption=seg.caption,
                            supports_streaming=True,
                            thumb=thumb_path if thumb_path and os.path.exists(thumb_path) else None,
                        )
                        sent_ids.append(getattr(s_msg, "id", None))
                        await asyncio.sleep(0.5)

                    return {
                        "success": True,
                        "mode": "RESERVOIR",
                        "target_channel_id": target_channel_id,
                        "message_ids": sent_ids,
                        "message_id": sent_ids[0] if sent_ids else None,
                        "campaign_id": campaign_id,
                        "segments_count": len(segments),
                        "meta": meta,
                        "aspect_ratio_mode": aspect_ratio_mode,
                        "burn_subtitles": burn_subtitles,
                        "subtitle_style": subtitle_style,
                        "thumbnail_generated": bool(thumb_path),
                    }
                else:
                    sent_msg = await client.send_file(
                        target_entity,
                        file=media_to_upload,
                        caption=caption,
                        supports_streaming=True,
                        thumb=thumb_path if thumb_path and os.path.exists(thumb_path) else None,
                    )
                    sent_msg_id = getattr(sent_msg, "id", None)
                    return {
                        "success": True,
                        "mode": "RESERVOIR",
                        "target_channel_id": target_channel_id,
                        "message_id": sent_msg_id,
                        "campaign_id": campaign_id,
                        "meta": meta,
                        "aspect_ratio_mode": aspect_ratio_mode,
                        "burn_subtitles": burn_subtitles,
                        "subtitle_style": subtitle_style,
                        "thumbnail_generated": bool(thumb_path),
                    }
            else:
                raise ValueError(f"Unknown ingestion mode: {mode}")

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
