"""Spoken-text safety net: nothing unreadable is ever sent to the TTS engine."""

import pytest

from schedule_agent.spoken_text import clean_spoken, spoken_cleanup


@pytest.mark.parametrize(
    ("raw", "spoken"),
    [
        ("Open https://suwaneegamers.net/campaigns/hoe now.", "Open the link now."),
        ("See www.example.com/page for more.", "See the link for more."),
        (r"It is at C:\Users\Larry\notes.md.", "It is at that file."),
        ("The file is /apps/web/media/images/map.webp.", "The file is that page."),
        ("Call 3f2504e0-4f89-11d3-9a0c-0305e82c3301 again.", "Call that ID again."),
        ("The call id is cc_8f1a2b3c4d5e6f7a8b9c0d1e.", "The call id is that ID."),
        ("Smile <<happy>> and wave.", "Smile and wave."),
    ],
)
def test_unreadable_things_are_replaced(raw, spoken):
    assert clean_spoken(raw) == spoken


@pytest.mark.parametrize(
    "text",
    [
        "Bring salt and/or pepper, about 1/2 cup.",
        "We play 24/7 on the 10/13 schedule.",
        "Souls of Destiny meets at 7:00 PM on Friday.",
        "The extraordinarily-long-hyphenated-compound-word stays.",
        "Email larry@example.com for help.",
    ],
)
def test_ordinary_text_is_untouched(text):
    assert clean_spoken(text) == text


async def run(chunks):
    async def source():
        for chunk in chunks:
            yield chunk

    return "".join([piece async for piece in spoken_cleanup(source())])


@pytest.mark.asyncio
async def test_url_split_across_chunks_is_still_removed():
    out = await run(["Go to https://suw", "aneegamers.net/campa", "igns/hoe to see it."])
    assert out == "Go to the link to see it."


@pytest.mark.asyncio
async def test_direction_split_across_chunks_is_removed():
    out = await run(["Sure thing. <<wa", "ve>> Here you go."])
    assert out == "Sure thing. Here you go."


@pytest.mark.asyncio
async def test_plain_streaming_text_passes_through_whole():
    out = await run(["Yep — the next ", "game is Sunday", " at one."])
    assert out == "Yep — the next game is Sunday at one."


@pytest.mark.asyncio
async def test_trailing_partial_word_is_flushed_at_the_end():
    assert await run(["Done"]) == "Done"
