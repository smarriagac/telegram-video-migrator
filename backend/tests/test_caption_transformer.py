from __future__ import annotations

import pytest
from backend.domain.entities.caption_rules import CaptionRules
from backend.application.services.caption_transformer_service import CaptionTransformerService


@pytest.fixture
def service() -> CaptionTransformerService:
    return CaptionTransformerService()


def test_no_rules_returns_original(service: CaptionTransformerService):
    text = "Gran video https://t.me/spam @canal_original"
    assert service.transform(text, None) == text
    assert service.transform(text, CaptionRules()) == text


def test_strip_links(service: CaptionTransformerService):
    text = "Mirá este video https://example.com/video y sumate a t.me/canal_spam para más contenido!"
    rules = CaptionRules(strip_links=True)
    result = service.transform(text, rules)
    assert "https://example.com" not in result
    assert "t.me/canal_spam" not in result
    assert "Mirá este video" in result
    assert "para más contenido!" in result


def test_replace_specific_mentions(service: CaptionTransformerService):
    text = "Publicado originalmente en @CanalViejo por @AdminViejo."
    rules = CaptionRules(
        replace_mentions={
            "@CanalViejo": "@CanalNuevo",
            "@AdminViejo": "@MiMarca",
        }
    )
    result = service.transform(text, rules)
    assert "@CanalNuevo" in result
    assert "@MiMarca" in result
    assert "@CanalViejo" not in result
    assert "@AdminViejo" not in result


def test_strip_all_mentions(service: CaptionTransformerService):
    text = "Seguinos en @canal_uno y hablá con @soporte_oficial para promos."
    rules = CaptionRules(strip_all_mentions=True)
    result = service.transform(text, rules)
    assert "@canal_uno" not in result
    assert "@soporte_oficial" not in result
    assert "Seguinos en" in result


def test_remove_blacklisted_words(service: CaptionTransformerService):
    text = "Descargá gratis! [PROMOCIÓN EXCLUSIVA] Video disponible en HD."
    rules = CaptionRules(remove_words=["[PROMOCIÓN EXCLUSIVA]", "Descargá gratis!"])
    result = service.transform(text, rules)
    assert "[PROMOCIÓN EXCLUSIVA]" not in result
    assert "Descargá gratis!" not in result
    assert "Video disponible en HD." in result


def test_header_and_signature_injection(service: CaptionTransformerService):
    text = "Video sobre táctica deportiva."
    rules = CaptionRules(
        prepend_header="⚡ EXCLUSIVO TELEGRAM HUB ⚡",
        append_signature="📢 Canal Oficial: @micanal\n🔗 Web: telegramhub.local",
    )
    result = service.transform(text, rules)
    assert result.startswith("⚡ EXCLUSIVO TELEGRAM HUB ⚡")
    assert "Video sobre táctica deportiva." in result
    assert result.endswith("🔗 Web: telegramhub.local")


def test_empty_caption_with_signature(service: CaptionTransformerService):
    rules = CaptionRules(append_signature="📢 Canal Oficial: @micanal")
    assert service.transform("", rules) == "📢 Canal Oficial: @micanal"
    assert service.transform(None, rules) == "📢 Canal Oficial: @micanal"


def test_full_pipeline_combination(service: CaptionTransformerService):
    text = """
    🔥 Video viral imperdible!
    Descargalo en https://sitio.com/download o en t.me/canal_trucho
    Contactar a @admin_trucho para canjes.
    PUBLICIDAD NO DESEADA
    """
    rules = CaptionRules(
        strip_links=True,
        replace_mentions={"@admin_trucho": "@admin_oficial"},
        remove_words=["PUBLICIDAD NO DESEADA"],
        append_signature="— Distribuido por Telegram Hub",
    )
    result = service.transform(text, rules)
    assert "https://sitio.com" not in result
    assert "t.me/canal_trucho" not in result
    assert "@admin_oficial" in result
    assert "@admin_trucho" not in result
    assert "PUBLICIDAD NO DESEADA" not in result
    assert "— Distribuido por Telegram Hub" in result
