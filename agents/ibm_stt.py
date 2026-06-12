"""IBM Speech-to-Text agent."""
from __future__ import annotations

import logging
from typing import Optional

from config import IBM_STT_API_KEY, IBM_STT_URL

logger = logging.getLogger(__name__)


def is_stt_configured() -> bool:
    """Return True when STT credentials are set."""
    return bool(IBM_STT_API_KEY and IBM_STT_URL)


def transcribe_audio(audio_bytes: bytes, content_type: str = "audio/webm") -> str:
    """Transcribe audio to text using IBM Speech-to-Text. Returns empty string on failure."""
    if not is_stt_configured() or not audio_bytes:
        return ""
    try:
        from ibm_watson import SpeechToTextV1
        from ibm_cloud_sdk_core.authenticators import IAMAuthenticator

        authenticator = IAMAuthenticator(IBM_STT_API_KEY)
        stt = SpeechToTextV1(authenticator=authenticator)
        stt.set_service_url(IBM_STT_URL)

        response = stt.recognize(
            audio=audio_bytes,
            content_type=content_type,
            model="en-US_BroadbandModel",
        ).get_result()

        results = response.get("results", [])
        transcript = " ".join(
            alt["transcript"]
            for r in results
            for alt in r.get("alternatives", [])
        )
        return transcript.strip()
    except Exception as exc:
        logger.error("IBM STT failed: %s", exc)
        return ""


__all__ = ["is_stt_configured", "transcribe_audio"]
