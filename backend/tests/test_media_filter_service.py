import pytest
from backend.application.services.media_filter_service import MediaFilterService
from backend.domain.entities.media_filter_rules import MediaFilterRules
from backend.domain.entities.video_message import VideoMessage


def test_filter_accepts_when_no_rules():
    svc = MediaFilterService()
    video = VideoMessage(message_id=1, media_type="video", duration=120, height=1080)
    passed, reason = svc.evaluate(video, None)
    assert passed is True
    assert reason is None


def test_filter_rejects_disallowed_media_type():
    svc = MediaFilterService()
    rules = MediaFilterRules(allowed_media_types=["video"])
    photo = VideoMessage(message_id=2, media_type="photo")
    passed, reason = svc.evaluate(photo, rules)
    assert passed is False
    assert "no permitido" in reason


def test_filter_rejects_short_duration():
    svc = MediaFilterService()
    rules = MediaFilterRules(min_duration_seconds=15)
    short_clip = VideoMessage(message_id=3, media_type="video", duration=8)
    passed, reason = svc.evaluate(short_clip, rules)
    assert passed is False
    assert "menor al mínimo" in reason

    long_clip = VideoMessage(message_id=4, media_type="video", duration=30)
    passed2, reason2 = svc.evaluate(long_clip, rules)
    assert passed2 is True
    assert reason2 is None


def test_filter_rejects_low_resolution():
    svc = MediaFilterService()
    rules = MediaFilterRules(min_height=720)  # At least 720p HD
    low_res = VideoMessage(message_id=5, media_type="video", height=480, width=854)
    passed, reason = svc.evaluate(low_res, rules)
    assert passed is False
    assert "Resolución vertical" in reason

    hd_video = VideoMessage(message_id=6, media_type="video", height=1080, width=1920)
    passed2, reason2 = svc.evaluate(hd_video, rules)
    assert passed2 is True
    assert reason2 is None


def test_filter_file_size_limits():
    svc = MediaFilterService()
    # 5MB to 100MB
    rules = MediaFilterRules(
        min_file_size_bytes=5 * 1024 * 1024, max_file_size_bytes=100 * 1024 * 1024
    )
    too_small = VideoMessage(message_id=7, media_type="video", file_size=2 * 1024 * 1024)
    passed, reason = svc.evaluate(too_small, rules)
    assert passed is False
    assert "menor al mínimo" in reason

    too_big = VideoMessage(message_id=8, media_type="video", file_size=200 * 1024 * 1024)
    passed2, reason2 = svc.evaluate(too_big, rules)
    assert passed2 is False
    assert "excede el límite" in reason2

    ok_video = VideoMessage(message_id=9, media_type="video", file_size=50 * 1024 * 1024)
    passed3, reason3 = svc.evaluate(ok_video, rules)
    assert passed3 is True
    assert reason3 is None
