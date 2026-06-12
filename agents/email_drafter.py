"""Cold email drafting agent — IBM Watsonx first, Gemini fallback."""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, Mapping

from config import GEMINI_API_KEY, GEMINI_MODEL, setup_logging
from utils.cgpa_handler import get_cgpa_strategy
from agents.ibm_watsonx import generate_text as watsonx_generate, is_watsonx_configured

try:
    from google import genai
except Exception:
    genai = None

setup_logging()
logger = logging.getLogger(__name__)


def _default_result(startup: Mapping[str, Any] | None = None, profile: Mapping[str, Any] | None = None) -> Dict[str, Any]:
    """Return a template email when AI is unavailable."""
    startup = startup or {}
    profile = profile or {}
    startup_name = str(startup.get("name") or "your startup")
    role = str(
        startup.get("role_match")
        or profile.get("role_target")
        or profile.get("best_role")
        or "Software Engineer"
    )
    name = str(profile.get("name") or "Student")
    skills = str(profile.get("skills") or "Python, problem solving, and backend development")
    summary = str(startup.get("summary_what") or startup.get("summary_why") or "your recent funding and growth")
    return {
        "subject": f"Application for {role} at {startup_name}",
        "body": (
            f"Hi {startup_name} team,\n\n"
            f"I came across {startup_name} and was excited by {summary}. "
            f"I am {name}, and I am interested in {role} opportunities where I can contribute using "
            f"{skills}.\n\n"
            "I would be grateful for a chance to share my profile and explore whether there is a fit.\n\n"
            f"Regards,\n{name}"
        ),
        "tone": "warm",
        "generated_with_ai": False,
    }


def _parse_json_response(text: str) -> Dict[str, Any]:
    """Parse JSON even when it returns fenced markdown."""
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


def _build_prompt(startup: Mapping[str, Any], profile: Mapping[str, Any]) -> str:
    """Build cold email drafting prompt with CGPA strategy and profile."""
    try:
        cgpa_value = float(profile.get("cgpa") or 0.0)
    except (TypeError, ValueError):
        cgpa_value = 0.0
    strategy = profile.get("cgpa_strategy") or get_cgpa_strategy(cgpa_value)
    payload = {
        "startup": {
            "name": startup.get("name"),
            "sector": startup.get("sector"),
            "round_type": startup.get("round_type"),
            "amount_inr": startup.get("amount_inr"),
            "url": startup.get("url"),
            "summary_what": startup.get("summary_what"),
            "summary_why": startup.get("summary_why"),
            "role_match": startup.get("role_match"),
        },
        "user": {
            "name": profile.get("name", "Student"),
            "degree": profile.get("degree", ""),
            "cgpa": profile.get("cgpa", ""),
            "year": profile.get("year", ""),
            "skills": profile.get("skills", ""),
            "experience": profile.get("experience", ""),
            "location": profile.get("location", ""),
            "github": profile.get("github", ""),
            "linkedin": profile.get("linkedin", ""),
            "resume_link": profile.get("resume_link", ""),
            "role_target": profile.get("role_target", profile.get("best_role", "")),
        },
        "selected_profile": dict(profile),
        "cgpa_strategy": strategy,
    }
    instructions = (
        "Write a short cold email to a founder or CTO of this Indian startup from a fresh graduate. "
        "Use under 180 words, sound human and specific, not generic. "
        "Use the cgpa_strategy precisely for whether to mention CGPA. "
        "Reference 1-2 skills or projects that match the profile and sector. "
        'Return JSON exactly: {"subject": "...", "body": "...", "tone": "warm|ambitious|humble|neutral"}. '
        "Respond ONLY in valid JSON"
    )
    return json.dumps(payload, ensure_ascii=False) + "\n\n" + instructions


def draft_cold_email(startup: Mapping[str, Any], profile: Mapping[str, Any]) -> Dict[str, Any]:
    """Draft a personalized cold email. IBM Watsonx first, Gemini fallback."""
    default = _default_result(startup, profile)
    prompt = _build_prompt(startup, profile)
    response_text = ""

    # 1) Try IBM Watsonx FIRST
    if is_watsonx_configured():
        logger.info("[AI] Using IBM Watsonx Granite for email drafting")
        response_text = watsonx_generate(prompt)

    # 2) Fall back to Gemini
    if not response_text and GEMINI_API_KEY and genai is not None:
        logger.info("[AI] Falling back to Gemini for email drafting")
        try:
            client = genai.Client(api_key=GEMINI_API_KEY)
            response = client.models.generate_content(
                model=GEMINI_MODEL, contents=prompt,
                config={"max_output_tokens": 500},
            )
            response_text = response.text
        except Exception as exc:
            logger.exception("draft_cold_email: Gemini error: %s", exc)

    if not response_text:
        return default

    try:
        data = _parse_json_response(response_text)
        return {
            "subject": str(data.get("subject", default["subject"])).strip() or default["subject"],
            "body": str(data.get("body", default["body"])).strip() or default["body"],
            "tone": str(data.get("tone", default["tone"])).strip() or default["tone"],
            "generated_with_ai": True,
        }
    except Exception as exc:
        logger.exception("draft_cold_email: JSON parse error: %s", exc)
        return default


__all__ = ["draft_cold_email"]
