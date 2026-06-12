"""IBM Watson Natural Language Understanding agent.

Provides sentiment analysis, keyword extraction, and market signal
inference for startup funding articles.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from config import IBM_NLU_API_KEY, IBM_NLU_URL

logger = logging.getLogger(__name__)


def is_nlu_configured() -> bool:
    """Return True when NLU credentials are set."""
    return bool(IBM_NLU_API_KEY and IBM_NLU_URL)


def analyze_startup_article(text: str) -> Dict[str, Any]:
    """Analyze article text using Watson NLU to extract keywords and sentiment."""
    if not is_nlu_configured() or not text or len(text.strip()) < 20:
        return {}

    try:
        from ibm_watson import NaturalLanguageUnderstandingV1
        from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
        from ibm_watson.natural_language_understanding_v1 import (
            Features, SentimentOptions, KeywordsOptions,
        )

        authenticator = IAMAuthenticator(IBM_NLU_API_KEY)
        nlu = NaturalLanguageUnderstandingV1(
            version="2022-04-07",
            authenticator=authenticator,
        )
        nlu.set_service_url(IBM_NLU_URL)

        response = nlu.analyze(
            text=text[:5000],
            features=Features(
                sentiment=SentimentOptions(),
                keywords=KeywordsOptions(limit=5),
            ),
        ).get_result()

        sentiment_doc = response.get("sentiment", {}).get("document", {})
        return {
            "nlu_sentiment": sentiment_doc.get("label", "neutral"),
            "nlu_score": sentiment_doc.get("score", 0.0),
            "nlu_keywords": [kw.get("text") for kw in response.get("keywords", [])],
        }
    except Exception as exc:
        logger.error("Watson NLU analysis failed: %s", exc)
        return {}


def get_market_signal(text: str) -> str:
    """Return 'BULLISH', 'NEUTRAL', or 'BEARISH' based on NLU sentiment."""
    result = analyze_startup_article(text)
    if not result:
        return "NEUTRAL"
    score = result.get("nlu_score", 0.0)
    if score > 0.25:
        return "BULLISH"
    elif score < -0.25:
        return "BEARISH"
    return "NEUTRAL"


__all__ = ["is_nlu_configured", "analyze_startup_article", "get_market_signal"]
