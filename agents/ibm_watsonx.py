"""IBM Watsonx.ai inference agent using the ibm-watsonx-ai SDK.

Provides ``generate_text`` and ``generate_text_stream`` helpers that the rest
of the codebase calls as the PRIMARY AI engine, with Gemini as fallback.
"""
from __future__ import annotations

import logging
from typing import Generator, Optional

from config import WATSONX_API_KEY, WATSONX_PROJECT_ID, WATSONX_URL, WATSONX_MODEL

logger = logging.getLogger(__name__)

_model_cache: dict = {}


def is_watsonx_configured() -> bool:
    """Return True when all required Watsonx env vars are set."""
    return bool(WATSONX_API_KEY and WATSONX_PROJECT_ID)


def _get_model(model_id: Optional[str] = None, max_tokens: int = 1024):
    """Lazily initialise and cache a ModelInference instance."""
    mid = model_id or WATSONX_MODEL or "ibm/granite-13b-chat-v2"
    cache_key = f"{mid}:{max_tokens}"
    if cache_key in _model_cache:
        return _model_cache[cache_key]

    if not is_watsonx_configured():
        return None

    try:
        from ibm_watsonx_ai import Credentials
        from ibm_watsonx_ai.foundation_models import ModelInference
        from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

        credentials = Credentials(url=WATSONX_URL, api_key=WATSONX_API_KEY)
        params = {
            GenParams.DECODING_METHOD: "greedy",
            GenParams.MAX_NEW_TOKENS: max_tokens,
            GenParams.MIN_NEW_TOKENS: 1,
            GenParams.REPETITION_PENALTY: 1.05,
        }
        model = ModelInference(
            model_id=mid,
            credentials=credentials,
            project_id=WATSONX_PROJECT_ID,
            params=params,
        )
        _model_cache[cache_key] = model
        logger.info("[AI] IBM Watsonx model '%s' initialised", mid)
        return model
    except Exception as exc:
        logger.error("[AI] Failed to initialise Watsonx model: %s", exc)
        return None


def generate_text(prompt: str, model_id: Optional[str] = None, max_tokens: int = 1024) -> str:
    """Generate text using IBM Watsonx Granite. Returns empty string on failure."""
    model = _get_model(model_id, max_tokens)
    if model is None:
        logger.warning("[AI] Watsonx not configured or model init failed")
        return ""
    try:
        response = model.generate_text(prompt=prompt)
        return (response or "").strip()
    except Exception as exc:
        logger.error("[AI] Watsonx text generation failed: %s", exc)
        return ""


def generate_text_stream(prompt: str, model_id: Optional[str] = None) -> Generator[str, None, None]:
    """Stream text chunks from IBM Watsonx. Yields empty on failure."""
    model = _get_model(model_id)
    if model is None:
        return
    try:
        for chunk in model.generate_text_stream(prompt=prompt):
            yield chunk
    except Exception as exc:
        logger.error("[AI] Watsonx streaming failed: %s", exc)


__all__ = ["is_watsonx_configured", "generate_text", "generate_text_stream"]
