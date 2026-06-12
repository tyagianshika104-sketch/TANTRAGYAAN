"""Startup researcher agent — IBM Watsonx first, Gemini fallback."""
from __future__ import annotations

import json
import logging
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
    """Return fallback research result."""
    return {
        "what_they_do": "Indian startup that has recently raised funding.",
        "why_apply_now": "Fresh capital usually triggers hiring across tech and product roles.",
    }


def _build_prompt(startup: FundedStartup) -> str:
    """Build research prompt for summarizing startup."""
    raw_text = (startup.raw_text or "")[:MAX_RAW_CHARS]
    payload = {
        "startup": {
            "name": startup.name,
            "sector": startup.sector,
            "raw_text": raw_text,
            "url": startup.url,
        }
    }
    instructions = (
        "Use ONLY the facts in the provided article text. "
        "If you cannot find a detail, return 'Unknown'. "
        "Keep each answer <= 140 characters, no newlines. "
        'Return JSON exactly: {"what_they_do": "...", "why_apply_now": "..."} '
        "Respond ONLY in valid JSON"
    )
    return json.dumps(payload, ensure_ascii=False) + "\n\n" + instructions


def _parse_json(text: str) -> Dict[str, Any]:
    """Parse JSON from possibly markdown-fenced response."""
    import re
    cleaned = (text or "").strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def research_startup(startup: FundedStartup) -> Dict[str, Any]:
    """Research and summarize a startup using IBM Watsonx first, Gemini fallback."""
    default = _default_result()
    prompt = _build_prompt(startup)
    response_text = ""

    # 1) Try IBM Watsonx FIRST
    if is_watsonx_configured():
        logger.info("[AI] Using IBM Watsonx Granite for research: %s", startup.name)
        response_text = watsonx_generate(prompt)

    # 2) Fall back to Gemini
    if not response_text and GEMINI_API_KEY and genai is not None:
        logger.info("[AI] Falling back to Gemini for research: %s", startup.name)
        try:
            client = genai.Client(api_key=GEMINI_API_KEY)
            response = client.models.generate_content(
                model=GEMINI_MODEL, contents=prompt,
                config={"max_output_tokens": 500},
            )
            response_text = response.text
        except Exception as exc:
            logger.exception("research_startup: Gemini error for %s: %s", startup.url, exc)

    if not response_text:
        return default

    try:
        data = _parse_json(response_text)
        what = str(data.get("what_they_do", default["what_they_do"])).strip()
        why = str(data.get("why_apply_now", default["why_apply_now"])).strip()
        return {
            "what_they_do": (what or default["what_they_do"])[:180],
            "why_apply_now": (why or default["why_apply_now"])[:180],
        }
    except Exception as exc:
        logger.exception("research_startup: JSON parse error: %s", exc)
        return default


__all__ = ["research_startup"]
