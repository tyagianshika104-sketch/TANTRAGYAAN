"""Career co-pilot agent — IBM Watsonx first, Gemini fallback."""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from config import GEMINI_API_KEY, GEMINI_MODEL
from agents.ibm_watsonx import generate_text as watsonx_generate, is_watsonx_configured

try:
    from google import genai
except Exception:
    genai = None

logger = logging.getLogger(__name__)


def ask_copilot(query: str, user_profile: Dict[str, Any], startups: List[Dict[str, Any]]) -> str:
    """Answer user queries using their profile + startup context. IBM Watsonx first, Gemini fallback."""
    skills = user_profile.get("skills", "")
    target_role = user_profile.get("role_target", "")
    experience = user_profile.get("experience", "")

    top_startups = startups[:5] if startups else []
    startup_context = ""
    for s in top_startups:
        amt = int(s.get("amount_inr", 0) or 0) / 10_000_000
        startup_context += f"- {s.get('name')} ({s.get('sector')}): ₹{amt:.1f}Cr {s.get('round_type', '')}. Match: {s.get('role_match', 'N/A')}. Score: {s.get('score', 'N/A')}/100\n"

    prompt = f"""You are 'FundedFirst Co-Pilot', an expert AI career advisor powered by IBM Watsonx.
You help candidates land jobs at recently funded startups.

CANDIDATE CONTEXT:
Target Role: {target_role}
Skills: {skills}
Experience: {experience}

STARTUP CONTEXT (Top Matches):
{startup_context}

USER QUESTION:
{query}

Provide a concise, encouraging, and highly specific answer. Reference the startup data above when relevant.
ANSWER:"""

    response_text = ""

    # 1) Try IBM Watsonx FIRST
    if is_watsonx_configured():
        logger.info("[AI] Using IBM Watsonx Granite for co-pilot")
        response_text = watsonx_generate(prompt)

    # 2) Fall back to Gemini
    if not response_text and GEMINI_API_KEY and genai is not None:
        logger.info("[AI] Falling back to Gemini for co-pilot")
        try:
            client = genai.Client(api_key=GEMINI_API_KEY)
            resp = client.models.generate_content(
                model=GEMINI_MODEL, contents=prompt,
                config={"max_output_tokens": 500},
            )
            response_text = resp.text
        except Exception as exc:
            logger.error("Co-Pilot Gemini fallback error: %s", exc)

    if not response_text:
        return "I'm unable to connect to IBM Watsonx right now. Please check your WATSONX_API_KEY in .env."

    return response_text.strip()


__all__ = ["ask_copilot"]
