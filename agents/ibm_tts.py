"""IBM Text-to-Speech agent."""
from __future__ import annotations

import logging
from typing import Optional

from config import IBM_TTS_API_KEY, IBM_TTS_URL

logger = logging.getLogger(__name__)


def is_tts_configured() -> bool:
    """Return True when TTS credentials are set."""
    return bool(IBM_TTS_API_KEY and IBM_TTS_URL)


def text_to_speech(text: str, voice: str = "en-US_AllisonV3Voice") -> Optional[bytes]:
    """Convert text to MP3 audio bytes using IBM TTS. Returns None on failure."""
    if not is_tts_configured() or not text:
        return None
    try:
        from ibm_watson import TextToSpeechV1
        from ibm_cloud_sdk_core.authenticators import IAMAuthenticator

        authenticator = IAMAuthenticator(IBM_TTS_API_KEY)
        tts = TextToSpeechV1(authenticator=authenticator)
        tts.set_service_url(IBM_TTS_URL)

        response = tts.synthesize(
            text[:5000],
            voice=voice,
            accept="audio/mp3",
        ).get_result()
        return response.content
    except Exception as exc:
        logger.error("IBM TTS failed: %s", exc)
        return None


__all__ = ["is_tts_configured", "text_to_speech"]
