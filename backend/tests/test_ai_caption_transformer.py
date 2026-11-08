from __future__ import annotations

import pytest
from backend.domain.entities.caption_rules import CaptionRules
from backend.application.services.ai_caption_engine import AICaptionEngine
from backend.application.services.caption_transformer_service import CaptionTransformerService
from backend.application.services.rules_simulation_service import RulesSimulationService


def test_ai_caption_rules_serialization():
    rules = CaptionRules(
        strip_links=True,
        ai_enabled=True,
        ai_target_lang="es",
        ai_tone="ENGAGING",
        ai_auto_hashtags=True,
        ai_clean_spam=True,
        ai_summarize=False,
    )

    data = rules.to_dict()
    assert data["ai_enabled"] is True
    assert data["ai_target_lang"] == "es"
    assert data["ai_tone"] == "ENGAGING"
    assert data["ai_auto_hashtags"] is True
    assert data["ai_clean_spam"] is True

    restored = CaptionRules.from_dict(data)
    assert restored.ai_enabled is True
    assert restored.ai_target_lang == "es"
    assert restored.ai_tone == "ENGAGING"
    assert restored.ai_auto_hashtags is True
    assert restored.ai_clean_spam is True


@pytest.mark.asyncio
async def test_ai_engine_offline_translation():
    engine = AICaptionEngine()
    rules = CaptionRules(ai_enabled=True, ai_target_lang="es")

    raw_text = "Exclusive premiere on this channel!"
    result = await engine.transform(raw_text, rules)

    assert "exclusivo" in result.lower()
    assert "estreno" in result.lower()
    assert "canal" in result.lower()


@pytest.mark.asyncio
async def test_ai_engine_tone_and_hashtags():
    engine = AICaptionEngine()
    rules = CaptionRules(
        ai_enabled=True,
        ai_tone="ENGAGING",
        ai_auto_hashtags=True,
    )

    raw_text = "Resumen del superclásico con los goles decisivos."
    result = await engine.transform(raw_text, rules)

    assert "¡Imperdible!" in result
    assert "¿Qué opinás?" in result
    assert "#" in result


@pytest.mark.asyncio
async def test_ai_engine_spam_cleansing():
    engine = AICaptionEngine()
    rules = CaptionRules(
        ai_enabled=True,
        ai_clean_spam=True,
    )

    raw_text = "Gran jugada de Messi. Bono gratis 1xbet casino apuestas promo code 2026."
    result = await engine.transform(raw_text, rules)

    assert "Gran jugada de Messi" in result
    assert "1xbet" not in result
    assert "casino" not in result


@pytest.mark.asyncio
async def test_caption_transformer_service_async():
    service = CaptionTransformerService()
    rules = CaptionRules(
        strip_links=True,
        ai_enabled=True,
        ai_target_lang="es",
        ai_tone="CONCISE",
        ai_auto_hashtags=True,
    )

    raw_text = "Exclusive highlights from yesterday! Watch at https://t.me/spam_link"
    result = await service.transform_async(raw_text, rules)

    # Link should be stripped
    assert "https://t.me" not in result
    # AI translation and tone
    assert "⚡" in result
    assert "mejores momentos" in result or "lo más destacado" in result or "exclusivo" in result
    assert "#" in result


def test_rules_simulation_with_ai():
    service = RulesSimulationService()
    res = service.simulate(
        sample_caption="New video and exclusive highlights from the match.",
        caption_rules={
            "ai_enabled": True,
            "ai_target_lang": "es",
            "ai_tone": "VIRAL",
            "ai_auto_hashtags": True,
        },
    )

    caption_info = res["caption"]
    assert caption_info["ai_details"] is not None
    assert caption_info["ai_details"]["enabled"] is True
    assert caption_info["ai_details"]["target_lang"] == "es"
    assert "BOOM" in caption_info["transformed_caption"]
    assert len(caption_info["ai_details"]["hashtags_generated"]) > 0
