import pytest
from unittest.mock import MagicMock
from backend.application.services.video_processing_service import VideoProcessingService


class TestVideoBrandingPipeline:
    @pytest.fixture
    def service(self):
        pg_repo = MagicMock()
        gateway = MagicMock()
        return VideoProcessingService(pg_repo=pg_repo, gateway_provider=gateway)

    def test_drawtext_filter_escaping_and_defaults(self, service):
        params = {
            "watermark_text": "VIP's: 100% Free",
            "watermark_position": "bottom_right",
        }
        res = service._build_drawtext_filter_str(params, width=1920, height=1080)
        assert "drawtext=" in res
        # Colon must be escaped as \:
        assert "\\:" in res
        # Percent must be escaped as \%
        assert "\\%" in res
        # Text enclosed in quotes
        assert "VIP" in res and "Free" in res
        # Position expressions for bottom_right
        assert "x=w-tw-20" in res
        assert "y=h-th-20" in res

    def test_drawtext_positions(self, service):
        for pos, expected_x, expected_y in [
            ("top_right", "x=w-tw-20", "y=20"),
            ("bottom_left", "x=20", "y=h-th-20"),
            ("top_left", "x=20", "y=20"),
            ("center", "x=(w-tw)/2", "y=(h-th)/2"),
        ]:
            params = {"watermark_text": "@CanalVIP", "watermark_position": pos}
            res = service._build_drawtext_filter_str(params, width=1280, height=720)
            assert expected_x in res
            assert expected_y in res

    def test_filter_type_watermark_text(self, service):
        params = {
            "watermark_text": "@SuperCanal",
            "watermark_position": "top_right",
            "watermark_font_size": 28,
        }
        filters = service._build_delogo_filter("watermark_text", params, width=1920, height=1080)
        assert filters[0] == "-vf"
        assert "drawtext=" in filters[1]
        assert "delogo=" not in filters[1]
        assert "fontsize=28" in filters[1]

    def test_filter_type_delogo_and_watermark_combined(self, service):
        params = {
            "preset": "center",
            "watermark_text": "@CanalLimpio",
            "watermark_position": "bottom_right",
        }
        filters = service._build_delogo_filter("delogo_and_watermark", params, width=1920, height=1080)
        assert filters[0] == "-vf"
        filter_str = filters[1]
        assert "delogo=" in filter_str
        assert "drawtext=" in filter_str
        # Delogo and drawtext chained by comma
        assert "delogo=" in filter_str.split(",drawtext=")[0]

    def test_delogo_auto_appends_branding_when_watermark_text_present(self, service):
        params = {
            "preset": "top_right",
            "watermark_text": "@BrandingTag",
        }
        filters = service._build_delogo_filter("delogo", params, width=1920, height=1080)
        assert filters[0] == "-vf"
        assert "delogo=" in filters[1]
        assert "drawtext=" in filters[1]

    def test_blur_filter_remains_complex(self, service):
        params = {"preset": "center"}
        filters = service._build_delogo_filter("blur", params, width=1920, height=1080)
        assert filters[0] == "-filter_complex"
        assert "boxblur=15" in filters[1]
