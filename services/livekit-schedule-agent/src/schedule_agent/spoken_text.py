"""Make assistant text safe to say out loud.

Spoken delivery is a different medium from a chat window: a URL, a file path or
an opaque ID is "unbearable aloud and carries no meaning by ear" (the same
lesson jaredrhod/backtalk's DISCIPLINE encodes in a prompt). The prompt rules in
the persona ask the model not to produce these; this module is the safety net
that guarantees they are never *spoken* even when the model does.

It is a LiveKit ``tts_text_transforms`` entry, so it affects only what the TTS
engine says. The on-screen transcript keeps the original text.

Streaming-safe: text arrives in arbitrary chunks, so a URL can be split across
two of them. The transform holds back only the trailing partial word (and any
unterminated ``<<stage direction>>``) until the next chunk resolves it.
"""

from __future__ import annotations

import re
from collections.abc import AsyncIterable, AsyncIterator

# <<anything>> is a stage direction for something watching the bus, never speech.
_DIRECTION = re.compile(r"<<.*?>>", re.DOTALL)
# Ends on a non-punctuation character so a sentence-final "." stays as the pause.
_URL = re.compile(
    r"(?:https?://|www\.)[^\s<>()\[\]]*[^\s<>()\[\].,;:!?'\"]", re.IGNORECASE
)
_WINDOWS_PATH = re.compile(r"(?<![\w])[A-Za-z]:\\[^\s]*[^\s.,;:!?]")
# An absolute path with at least two segments (/media/images/x.png, /api/brain).
# Must start at a token boundary, so "and/or", "24/7" and "1/2" are untouched.
_UNIX_PATH = re.compile(r"(?<![\w/.:-])/(?:[\w.\-]+/)+(?:[\w.\-]*[\w\-])?")
_UUID = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE
)
# 20+ chars of letters+digits (and _ -), e.g. call ids and hashes. Requires at
# least one digit and one letter so ordinary long words are never replaced.
_LONG_ID = re.compile(r"\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{20,}\b")
_HEX_RUN = re.compile(r"\b[0-9a-f]{16,}\b", re.IGNORECASE)
_SPACES = re.compile(r"[ \t]{2,}")

# A direction longer than this without a closing ">>" is treated as plain text.
_MAX_OPEN_DIRECTION = 240


def clean_spoken(text: str) -> str:
    """Remove or rename everything in ``text`` that should not be read aloud."""
    cleaned = _DIRECTION.sub("", text)
    cleaned = _URL.sub("the link", cleaned)
    cleaned = _WINDOWS_PATH.sub("that file", cleaned)
    cleaned = _UNIX_PATH.sub("that page", cleaned)
    cleaned = _UUID.sub("that ID", cleaned)
    cleaned = _HEX_RUN.sub("that ID", cleaned)
    cleaned = _LONG_ID.sub("that ID", cleaned)
    return _SPACES.sub(" ", cleaned)


def _safe_cut(buffer: str) -> int:
    """How many leading characters of ``buffer`` can be processed now."""
    open_direction = buffer.rfind("<<")
    if (
        open_direction != -1
        and buffer.find(">>", open_direction) == -1
        and len(buffer) - open_direction < _MAX_OPEN_DIRECTION
    ):
        return open_direction  # wait for the closing >>
    # Everything up to the last whitespace is whole words; hold the partial tail.
    last_space = max(buffer.rfind(" "), buffer.rfind("\n"), buffer.rfind("\t"))
    return last_space + 1 if last_space != -1 else 0


async def spoken_cleanup(text: AsyncIterable[str]) -> AsyncIterator[str]:
    """LiveKit ``tts_text_transforms`` entry: clean text as it streams."""
    pending = ""
    last = " "  # last character emitted; avoids doubled spaces across chunks

    def finish(piece: str) -> str:
        cleaned = clean_spoken(piece)
        if cleaned and last.isspace():
            cleaned = cleaned.lstrip(" 	")
        return cleaned

    async for chunk in text:
        pending += chunk
        cut = _safe_cut(pending)
        if cut <= 0:
            continue
        ready, pending = pending[:cut], pending[cut:]
        cleaned = finish(ready)
        if cleaned:
            last = cleaned[-1]
            yield cleaned
    if pending:
        cleaned = finish(pending)
        if cleaned:
            yield cleaned


__all__ = ["clean_spoken", "spoken_cleanup"]
