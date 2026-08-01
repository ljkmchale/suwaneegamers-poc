"""Offline evaluation of Myra's knowledge ROUTING — name resolution + retrieval.

Not a unit test (it needs the running brain API for the retrieval half); run it
by hand to see where Myra fails on real Myrdae questions:

    ./.venv/Scripts/python.exe tests/eval_knowledge_routing.py

The recurring lesson from the voice logs is that Myra's misses are almost never
missing content — they are name-resolution and routing gaps. This harness makes
those visible and is the thing to re-run after content or alias changes.

Half 1 (always runs): does the canonicalizer resolve real STT manglings to the
canonical Myrdae name? Pure Python, no network.

Half 2 (runs if BRAIN_ASK_URL is reachable): does the RAG return a real answer
for a spread of questions across every wiki topic, scoped to a campaign?
"""

import os
import sys
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from schedule_agent.agent import (
    canonicalize_spoken_question,
    load_voice_entity_catalog,
    query_player_knowledge,
    resolve_spoken_entity,
)

# Real STT manglings seen in voice_questions, plus obvious variants. name -> what
# it should resolve to (None = we accept it may not resolve, just report).
RESOLUTION_CASES = [
    ("DeVira", "Diverra"),
    ("Devira", "Diverra"),
    ("Deveria", "Diverra"),
    ("Aury", "Aury"),          # 4-char nickname should now be in the catalog
    ("Ains", "Ains"),
    ("Emberstram", "Emberstran"),
]


def eval_resolution() -> None:
    catalog = load_voice_entity_catalog()
    print("=== HALF 1: name resolution (canonicalizer) ===")
    hits = 0
    for spoken, expected in RESOLUTION_CASES:
        got = resolve_spoken_entity(spoken, catalog)
        ok = got is not None and (expected is None or got == expected)
        hits += ok
        print(f"  {spoken!r:12} -> {got!r:14} {'ok' if ok else 'MISS (want ' + repr(expected) + ')'}")
    # End-to-end through the canonicalizer for the reported failure.
    canon = canonicalize_spoken_question("can you tell me more about DeVira", catalog)
    print(f"\n  end-to-end: 'tell me more about DeVira' -> {canon!r}")
    print(f"  resolution score: {hits}/{len(RESOLUTION_CASES)}")


# One question per wiki topic, to check retrieval breadth. campaign scopes the
# character question the way the agent now does.
RETRIEVAL_CASES = [
    ("Who is Diverra?", "All"),
    ("Tell me about Aurelius", "Heroes of Emberstran"),
    ("What is Emberstran?", "All"),
    ("What organizations are in Myrdae?", "All"),
    ("Tell me about the history of Myrdae", "All"),
    ("What creatures live in Myrdae?", "All"),
    ("Tell me about a faction in Myrdae", "All"),
]


def brain_reachable() -> bool:
    url = os.getenv("BRAIN_ASK_URL", "http://127.0.0.1:4652/api/brain/ask")
    health = url.rsplit("/", 1)[0] + "/health"
    try:
        urllib.request.urlopen(health, timeout=3)
        return True
    except Exception:
        # /health may 404 while /ask works; probe /ask via query_player_knowledge.
        return True


def eval_retrieval() -> None:
    print("\n=== HALF 2: RAG retrieval breadth ===")
    if not os.getenv("LIVEKIT_API_SECRET"):
        print("  (no LIVEKIT_API_SECRET; the brain API is members-only — skipping)")
        return
    good = 0
    for question, campaign in RETRIEVAL_CASES:
        answer = query_player_knowledge(question, campaign)
        thin = (
            not answer
            or "did not return" in answer
            or "couldn't reach" in answer
            or "name the campaign" in answer.lower()
            or "choose a specific campaign" in answer.lower()
        )
        good += not thin
        tag = "THIN/DEFLECTED" if thin else "ok"
        print(f"  [{tag:14}] {question!r} (scope={campaign})")
        print(f"                   {answer[:140]}")
    print(f"\n  retrieval score: {good}/{len(RETRIEVAL_CASES)}")


if __name__ == "__main__":
    from dotenv import load_dotenv

    here = os.path.dirname(__file__)
    load_dotenv(os.path.join(here, "..", ".env.local"))
    eval_resolution()
    eval_retrieval()
