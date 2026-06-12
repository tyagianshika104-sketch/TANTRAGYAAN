"""Startup opportunity scorer — IBM Watsonx first, Gemini fallback."""
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
    """Return fallback scoring result."""
    return {
        "score": 50,
        "confidence": "MEDIUM",
        "role_match": "Software Engineer",
        "reason": "Fallback score — AI scoring was unavailable.",
    }


def _build_prompt(startup: FundedStartup) -> str:
    """Build scoring prompt for a funded startup."""
    payload = {
        "startup": {
            "name": startup.name,
            "amount_inr": startup.amount_inr,
            "round_type": startup.round_type,
            "sector": startup.sector,
            "source": startup.source,
            "url": startup.url,
            "raw_text": (startup.raw_text or "")[:MAX_RAW_CHARS],
        }
    }
    instructions = (
        "Score this funded Indian startup as an opportunity for a fresher job seeker. "
        "Use only the supplied data. Prefer recently funded, credible, hiring-likely companies. "
        'Return JSON exactly: {"score": 0, "confidence": "HIGH|MEDIUM|LOW", '
        '"role_match": "best role title", "reason": "short reason"}. '
        "Respond ONLY in valid JSON"
    )
    return json.dumps(payload, ensure_ascii=False) + "\n\n" + instructions


def score_startup(startup: FundedStartup) -> Dict[str, Any]:
    """Score a startup opportunity using IBM Watsonx first, Gemini fallback."""
    default = _default_result()
    prompt = _build_prompt(startup)
    response_text = ""

    # 1) Try IBM Watsonx FIRST
    if is_watsonx_configured():
        logger.info("[AI] Using IBM Watsonx Granite for scoring: %s", startup.name)
        response_text = watsonx_generate(prompt)

    # 2) Fall back to Gemini
    if not response_text and GEMINI_API_KEY and genai is not None:
        logger.info("[AI] Falling back to Gemini for scoring: %s", startup.name)
        try:
            client = genai.Client(api_key=GEMINI_API_KEY)
            response = client.models.generate_content(
                model=GEMINI_MODEL, contents=prompt,
                config={"max_output_tokens": 500},
            )
            response_text = response.text
        except Exception as exc:
            logger.exception("score_startup: Gemini error for %s: %s", startup.url, exc)

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

        try:
            score = max(0, min(100, int(data.get("score", default["score"]))))
        except (TypeError, ValueError):
            score = default["score"]
        confidence = str(data.get("confidence", default["confidence"])).upper()
        if confidence not in {"HIGH", "MEDIUM", "LOW"}:
            confidence = default["confidence"]
        return {
            "score": score,
            "confidence": confidence,
            "role_match": str(data.get("role_match", default["role_match"])).strip() or default["role_match"],
            "reason": str(data.get("reason", default["reason"])).strip() or default["reason"],
        }
    except Exception as exc:
        logger.exception("score_startup: JSON parse error: %s", exc)
        return default


__all__ = ["score_startup"]
