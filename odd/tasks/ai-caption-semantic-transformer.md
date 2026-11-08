# ODD Task: AI Caption Semantic Transformer & Multilingual Auto-Translator

## Status: COMPLETED
**Assigned**: Senior Architect
**Scope**: Domain extension in `CaptionRules`, async `AICaptionEngine` with semantic translation, tone rewriting, spam cleansing, and hashtag extraction; pluggable providers (offline heuristic, Ollama, OpenAI); integration into `CloneChannelVideosUseCase`, `LiveSyncService`, and `RulesPlaygroundCard` ($\le 2$ `useState`).

---

## 1. Problem & Context
When syndicating and cloning Telegram channels across borders, captions often arrive in foreign languages (Russian, English, Arabic, Portuguese) or contaminated with competitor watermarks, promo tracking codes, and spam mentions.
Manual translation and rewriting are slow and unfeasible for automated migrations or real-time `LiveSync`.
A built-in AI semantic transformer allows operators to:
1. Automatically translate captions into their community's target language (Spanish, English, Portuguese, etc.).
2. Adapt tone (e.g. "ENGAGING", "PROFESSIONAL", "CONCISE", "VIRAL").
3. Automatically extract and append 3-5 relevant hashtags.
4. Clean competitor ads semantically while retaining original context.
5. Preview transformations in real time in the Rules Playground before launching batch jobs.

---

## 2. Technical Architecture & Design

### 2.1 Domain & Rules Entity (`backend/domain/entities/caption_rules.py`)
- Added fields and serialization in `CaptionRules`:
  - `ai_enabled: bool = False`
  - `ai_target_lang: Optional[str] = None` ("es", "en", "pt", "ru", "fr", "de")
  - `ai_tone: Optional[str] = None` ("NEUTRAL", "ENGAGING", "PROFESSIONAL", "CONCISE", "VIRAL")
  - `ai_auto_hashtags: bool = False`
  - `ai_clean_spam: bool = False`
  - `ai_summarize: bool = False`

### 2.2 AI Caption Engine (`backend/application/services/ai_caption_engine.py`)
- Core service with:
  - `OfflineHeuristicTranslator`: Deterministic heuristic translations & hashtag generators for 0-latency and 100% offline testability.
  - Pluggable HTTP provider (OpenAI / Ollama / Anthropic) with timeout, retry, and temperature controls.
  - In-memory LRU hashing cache to prevent duplicate calls.
  - `async transform(caption: str, rules: CaptionRules) -> str`

### 2.3 Integration in Pipeline
- In `CaptionTransformerService`:
  - `async transform_async(caption: str | None, rules: CaptionRules | None) -> str`
- In `CloneChannelVideosUseCase` & `LiveSyncService`:
  - Awaits `transform_async` when `rules.ai_enabled`.
- In `RulesSimulationService` & `/video-processing/simulate`:
  - Returns AI preview details (`ai_translation`, `ai_hashtags`, `ai_summary`, `ai_details`).

### 2.4 Frontend Integration
- In `RulesPlaygroundCard.tsx`:
  - AI Transformer toggles (Language, Tone, Auto-hashtags, Spam cleanse) and live preview diff.
  - Strict constraint: Maximum 2 `useState` hooks.

---

## 3. Verification & Results
1. Unit tests in [`test_ai_caption_transformer.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/tests/test_ai_caption_transformer.py): 6 passed.
2. Existing rules simulation tests in [`test_rules_simulation.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/tests/test_rules_simulation.py): 4 passed.
3. Existing caption transformer tests in [`test_caption_transformer.py`](file:///home/sm/proyectos/telegram-video-migrator/backend/tests/test_caption_transformer.py): 8 passed.
4. Frontend unit tests in [`RulesPlaygroundCard.test.tsx`](file:///home/sm/proyectos/telegram-video-migrator/frontend/src/features/migration/presentation/__tests__/RulesPlaygroundCard.test.tsx): 3 passed.
5. Full frontend test suite: 64 passed.
6. Production bundle `npm run build`: Succeeded.
7. Deployed to Docker containers and verified live.
