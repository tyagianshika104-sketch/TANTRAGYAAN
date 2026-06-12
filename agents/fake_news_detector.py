"""Fake news / credibility checker — IBM Watsonx first, Gemini fallback."""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict

from config import GEMINI_API_KEY, GEMINI_MODEL, setup_logging
from extractor import FundedStartup
from agents.ibm_watsonx import generate_text as watsonx_generate, is_watsonx_configured

try:
    from google import genai
except Exception:
    genai = None

setup_logging()
logger = logging.getLogger(__name__)

MAX_RAW_CHARS = 1800


def _default_result() -> Dict[str, Any]:
    """Return fallback credibility result."""
    return {
        "credibility": "HIGH",
        "is_confirmed": True,
        "red_flags": [],
        "recommendation": "APPLY",
    }


def _build_prompt(startup: FundedStartup) -> str:
    """Build fake news evaluation prompt for funding article."""
    raw_text = (startup.raw_text or "")[:MAX_RAW_CHARS]
    payload = {
        "startup": {
            "name": startup.name,
            "amount_inr": startup.amount_inr,
            "round_type": startup.round_type,
            "sector": startup.sector,
            "raw_text": raw_text,
            "url": startup.url,
        },
        "red_flags_to_detect": [
            "\"reportedly\", \"sources say\", \"plans to raise\", \"in talks\" -> UNCONFIRMED",
            "No investor name -> SUSPICIOUS",
            "Seed round above INR 100 Cr -> SUSPICIOUS",
            "Press release language -> PAID PR",
            "Amount exactly round number -> PR LIKELY",
        ],
    }
    instructions = (
        "You are checking if a startup funding news article is credible. "
        "Use ONLY the supplied text and URL metadata; do not guess investor names or amounts. "
        "Return JSON exactly: "
        '{"credibility": "HIGH|MEDIUM|LOW", '
        '"is_confirmed": true, '
        '"red_flags": ["..."], '
        '"recommendation": "APPLY|VERIFY_FIRST|SKIP"}. '
        "Respond ONLY in valid JSON"
    )
    return json.dumps(payload, ensure_ascii=False) + "\n\n" + instructions


def evaluate_fake_news(startup: FundedStartup) -> Dict[str, Any]:
    """Evaluate credibility of a startup funding article. IBM Watsonx first, Gemini fallback."""
    default = _default_result()
    prompt = _build_prompt(startup)
    response_text = ""

    # 1) Try IBM Watsonx FIRST
    if is_watsonx_configured():
        logger.info("[AI] Using IBM Watsonx Granite for credibility check: %s", startup.name)
        response_text = watsonx_generate(prompt)

    # 2) Fall back to Gemini
    if not response_text and GEMINI_API_KEY and genai is not None:
        logger.info("[AI] Falling back to Gemini for credibility check: %s", startup.name)
        try:
            client = genai.Client(api_key=GEMINI_API_KEY)
            response = client.models.generate_content(
                model=GEMINI_MODEL, contents=prompt,
                config={"max_output_tokens": 500},
            )
            response_text = response.text
        except Exception as exc:
            logger.exception("evaluate_fake_news: Gemini error for %s: %s", startup.url, exc)

    if not response_text:
        return default

    try:
        cleaned = re.sub(r"^```(?:json)?\s*", "", response_text.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
            if not match:
                return default
            data = json.loads(match.group(0))

        credibility = str(data.get("credibility", default["credibility"])).upper()
        if credibility not in {"HIGH", "MEDIUM", "LOW"}:
            credibility = "MEDIUM"
        is_confirmed = bool(data.get("is_confirmed", default["is_confirmed"]))
        red_flags = data.get("red_flags", default["red_flags"])
        if not isinstance(red_flags, list):
            red_flags = default["red_flags"]
        recommendation = str(data.get("recommendation", default["recommendation"])).upper()
        if recommendation not in {"APPLY", "VERIFY_FIRST", "SKIP"}:
            recommendation = "VERIFY_FIRST"
        return {
            "credibility": credibility,
            "is_confirmed": is_confirmed,
            "red_flags": red_flags,
            "recommendation": recommendation,
        }
    except Exception as exc:
        logger.exception("evaluate_fake_news: JSON parse error: %s", exc)
        return default


__all__ = ["evaluate_fake_news"]
