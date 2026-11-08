from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Any

from backend.domain.entities.caption_rules import CaptionRules

logger = logging.getLogger(__name__)

# Heuristic dictionary for offline translation & phrase mapping
OFFLINE_DICTIONARY: dict[str, dict[str, str]] = {
    "es": {
        "exclusive": "exclusivo",
        "premiere": "estreno",
        "watch now": "míralo ahora",
        "new video": "nuevo video",
        "subscribe": "suscríbete",
        "channel": "canal",
        "highlight": "lo más destacado",
        "highlights": "mejores momentos",
        "full match": "partido completo",
        "breaking news": "última hora",
        "live": "en vivo",
        "partido": "partido",
        "goles": "goles",
        "resumen": "resumen",
    },
    "en": {
        "exclusivo": "exclusive",
        "estreno": "premiere",
        "míralo ahora": "watch now",
        "nuevo video": "new video",
        "suscríbete": "subscribe",
        "canal": "channel",
        "lo más destacado": "highlight",
        "mejores momentos": "highlights",
        "partido completo": "full match",
        "última hora": "breaking news",
        "en vivo": "live",
    },
    "pt": {
        "exclusive": "exclusivo",
        "premiere": "estreia",
        "watch now": "assista agora",
        "new video": "novo vídeo",
        "subscribe": "inscreva-se",
        "channel": "canal",
        "highlights": "melhores momentos",
        "live": "ao vivo",
        "exclusivo": "exclusivo",
        "estreno": "estreia",
    },
}

TONE_TEMPLATES: dict[str, dict[str, str]] = {
    "ENGAGING": {
        "prefix": "🔥 ¡Imperdible! ",
        "suffix": "\n\n🚀 ¿Qué opinás? ¡Dejá tu reacción!",
    },
    "PROFESSIONAL": {
        "prefix": "📌 Comunicado Oficial: ",
        "suffix": "\n\n— Transmisión Verificada.",
    },
    "CONCISE": {
        "prefix": "⚡ ",
        "suffix": "",
    },
    "VIRAL": {
        "prefix": "🚨 ¡BOOM! ",
        "suffix": "\n\n👇 ¡Compartilo con tus amigos antes de que lo bajen!",
    },
}

SPAM_PATTERNS = [
    re.compile(r"(?:casino|betting|apuestas|1xbet|stake|promo\s*code|bono\s*gratis|gana\s*dinero)[\w\s\d]*", re.IGNORECASE),
    re.compile(r"(?:dm\s*for\s*credit|credits\s*to|admin\s*contact)[\w\s\d:@]*", re.IGNORECASE),
]


class AICaptionEngine:
    """Async AI engine for semantic translation, tone rewriting, spam cleansing, and hashtag extraction."""

    def __init__(self, provider: str | None = None) -> None:
        self.provider = (provider or os.getenv("AI_CAPTION_PROVIDER", "OFFLINE")).upper()
        self._cache: dict[str, str] = {}
        self._cache_max_size = 500

    def _cache_key(self, text: str, rules: CaptionRules) -> str:
        data = f"{text}_{rules.ai_target_lang}_{rules.ai_tone}_{rules.ai_auto_hashtags}_{rules.ai_clean_spam}_{rules.ai_summarize}"
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    async def transform(self, caption: str, rules: CaptionRules) -> str:
        """Executes full semantic transformation pipeline according to configured AI rules."""
        if not caption or not rules.ai_enabled:
            return caption

        cache_k = self._cache_key(caption, rules)
        if cache_k in self._cache:
            return self._cache[cache_k]

        result = caption

        # 1. Semantic Spam & Competitor Promo Cleansing
        if rules.ai_clean_spam:
            result = self._clean_spam(result)

        # 2. Semantic Translation
        if rules.ai_target_lang:
            result = await self._translate(result, rules.ai_target_lang.lower())

        # 3. Summarization (if requested)
        if rules.ai_summarize:
            result = self._summarize(result)

        # 4. Tone Adaptation
        if rules.ai_tone:
            result = self._apply_tone(result, rules.ai_tone.upper())

        # 5. Contextual Hashtag Extraction / Injection
        if rules.ai_auto_hashtags:
            hashtags = self._extract_hashtags(result)
            if hashtags:
                result = f"{result}\n\n{' '.join(hashtags)}"

        # Store in LRU cache
        if len(self._cache) >= self._cache_max_size:
            self._cache.pop(next(iter(self._cache)))
        self._cache[cache_k] = result

        return result

    def _clean_spam(self, text: str) -> str:
        cleaned = text
        for pat in SPAM_PATTERNS:
            cleaned = pat.sub("", cleaned)
        # Clean consecutive newlines
        return re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    async def _translate(self, text: str, target_lang: str) -> str:
        """Translates text to target language via provider or offline dictionary."""
        if self.provider in ("OPENAI", "OLLAMA"):
            try:
                remote_res = await self._remote_ai_translate(text, target_lang)
                if remote_res:
                    return remote_res
            except Exception as e:
                logger.warning(f"Remote AI translation failed, falling back to heuristic: {e}")

        # Fallback heuristic translation
        return self._heuristic_translate(text, target_lang)

    def _heuristic_translate(self, text: str, target_lang: str) -> str:
        mapping = OFFLINE_DICTIONARY.get(target_lang, {})
        if not mapping:
            return text

        translated = text
        for src_word, target_word in mapping.items():
            pattern = re.compile(rf"\b{re.escape(src_word)}\b", re.IGNORECASE)
            translated = pattern.sub(target_word, translated)

        return translated

    def _apply_tone(self, text: str, tone: str) -> str:
        template = TONE_TEMPLATES.get(tone)
        if not template:
            return text

        prefix = template.get("prefix", "")
        suffix = template.get("suffix", "")
        
        # Don't duplicate prefix if already present
        body = text
        if prefix and not body.startswith(prefix.strip()):
            body = f"{prefix}{body}"
        if suffix and not body.endswith(suffix.strip()):
            body = f"{body}{suffix}"
        return body

    def _summarize(self, text: str) -> str:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if not lines:
            return text
        # If text is already very short, return as-is
        if len(lines) <= 2 and len(text) < 140:
            return text
        # Concise summary taking the primary focal sentences
        first_line = lines[0]
        return f"📌 {first_line}"

    def _extract_hashtags(self, text: str, max_count: int = 4) -> list[str]:
        """Extracts contextual keywords and produces clean CamelCase Telegram hashtags."""
        words = re.findall(r"\b[A-Za-zÁ-ÿ]{4,15}\b", text)
        stop_words = {
            "para", "como", "pero", "este", "esta", "todos", "sobre", "entre",
            "from", "with", "this", "that", "have", "more", "your", "they",
            "míralo", "nuevo", "ahora", "canal", "video"
        }
        candidates: list[str] = []
        for w in words:
            clean = w.lower()
            if clean not in stop_words and clean not in [c.lower() for c in candidates]:
                candidates.append(w.capitalize())
            if len(candidates) >= max_count:
                break

        if not candidates:
            candidates = ["Telegram", "Video", "Viral"]

        return [f"#{c}" for c in candidates]

    async def _remote_ai_translate(self, text: str, target_lang: str) -> str | None:
        """Pluggable HTTP client for Ollama or OpenAI endpoints."""
        import httpx
        timeout = float(os.getenv("AI_TIMEOUT_SECONDS", "3.0"))

        if self.provider == "OLLAMA":
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            model = os.getenv("OLLAMA_MODEL", "llama3.2")
            prompt = f"Translate the following Telegram post into {target_lang}. Preserve formatting and emojis. Reply with only the translated text:\n\n{text}"
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(
                    f"{base_url}/api/generate",
                    json={"model": model, "prompt": prompt, "stream": False},
                )
                if res.status_code == 200:
                    return res.json().get("response", "").strip()

        elif self.provider == "OPENAI":
            api_key = os.getenv("OPENAI_API_KEY", "")
            if not api_key:
                return None
            prompt = f"Translate the following Telegram post into {target_lang}. Preserve formatting and emojis. Reply with only the translated text:\n\n{text}"
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                    },
                )
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"].strip()

        return None
