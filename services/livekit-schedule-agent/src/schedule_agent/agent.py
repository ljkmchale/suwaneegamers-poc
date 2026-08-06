import asyncio
import contextlib
import functools
import json
import logging
import os
import re
import textwrap
import threading
import time
import urllib.error
import urllib.request
from collections.abc import AsyncGenerator, AsyncIterable, Sequence
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    MetricsCollectedEvent,
    ModelSettings,
    RunContext,
    StopResponse,
    TurnHandlingOptions,
    cli,
    function_tool,
    llm,
    metrics,
    stt,
)
from livekit.agents.llm import ToolFlag
from livekit.plugins import anthropic, openai, silero

logger = logging.getLogger("suwanee-schedule-agent")

# Resolve .env.local by absolute path rather than relative to the working
# directory. The scheduled task launches the worker with the service directory
# as CWD, but a manual `uv run` from the repo root does not, and the bare
# relative path then silently loaded nothing. Service file first so it stays
# authoritative; the repo root is a fallback for shared keys. load_dotenv does
# not override an already-set variable, so first match wins.
SERVICE_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = Path(__file__).resolve().parents[4]
for env_file in (SERVICE_ROOT / ".env.local", REPO_ROOT / ".env.local"):
    load_dotenv(env_file)

AGENT_NAME = "myra"
DEFAULT_PANTHEON_PATH = (
    Path(__file__).resolve().parents[4]
    / "apps"
    / "web"
    / "brain-vault"
    / "wiki"
    / "concepts"
    / "Pantheon of Myrdae.md"
)


def parse_dispatch_metadata(raw_metadata: str | None) -> dict[str, Any]:
    if not raw_metadata:
        return {"timezone": "America/New_York", "events": []}

    try:
        payload = json.loads(raw_metadata)
    except (TypeError, json.JSONDecodeError):
        logger.warning("LiveKit dispatch metadata was not valid JSON")
        return {"timezone": "America/New_York", "events": []}

    events = payload.get("events")
    pronunciations = payload.get("pronunciations")
    mishearings = payload.get("mishearings")
    tuning = payload.get("tuning")
    recaps = payload.get("recaps")
    faq = payload.get("faq")
    navigation = payload.get("navigation")
    user_profile = payload.get("userProfile")
    if not isinstance(user_profile, dict):
        user_profile = {}
    welcome_kind = payload.get("welcomeKind")
    return {
        "timezone": str(payload.get("timezone") or "America/New_York"),
        "generatedAt": payload.get("generatedAt"),
        "voiceSessionId": payload.get("voiceSessionId"),
        "memberName": str(payload.get("memberName") or "there"),
        "welcomeKind": welcome_kind if welcome_kind in {"new", "returning"} else "none",
        "userProfile": {
            "displayName": str(user_profile.get("displayName") or ""),
            "playerName": str(user_profile.get("playerName") or ""),
            "favoriteLocations": [
                str(item)
                for item in user_profile.get("favoriteLocations", [])
                if isinstance(item, str)
            ][:12],
            "games": [
                str(item)
                for item in user_profile.get("games", [])
                if isinstance(item, str)
            ][:20],
            "characters": [
                str(item)
                for item in user_profile.get("characters", [])
                if isinstance(item, str)
            ][:30],
        },
        "page": payload.get("page") if isinstance(payload.get("page"), dict) else {},
        "events": events if isinstance(events, list) else [],
        "aboutSuwaneeGamers": str(payload.get("aboutSuwaneeGamers") or ""),
        "knowledge": str(payload.get("knowledge") or ""),
        # Out-of-world website roadmap block (site features requested / built /
        # ideated). Kept separate from in-world Myrdae lore on purpose.
        "roadmap": str(payload.get("roadmap") or ""),
        "knowledgeVisibility": "dm" if payload.get("knowledgeVisibility") == "dm" else "players",
        "brainAccessToken": str(payload.get("brainAccessToken") or ""),
        "dmCampaigns": payload.get("dmCampaigns") if payload.get("dmCampaigns") == "*" or isinstance(payload.get("dmCampaigns"), list) else [],
        "dmDefaultCampaigns": payload.get("dmDefaultCampaigns") if isinstance(payload.get("dmDefaultCampaigns"), list) else [],
        "websiteUpdates": (
            payload.get("websiteUpdates")
            if isinstance(payload.get("websiteUpdates"), dict)
            else {}
        ),
        "navigation": (
            [
                {
                    "label": str(item.get("label") or ""),
                    "href": str(item.get("href") or ""),
                }
                for item in navigation
                if isinstance(item, dict)
                and str(item.get("label") or "").strip()
                and str(item.get("href") or "").startswith("/")
                and not str(item.get("href") or "").startswith("//")
            ]
            if isinstance(navigation, list)
            else []
        ),
        "recaps": recaps if isinstance(recaps, list) else [],
        "faq": (
            [
                {"question": str(item.get("question") or ""), "answer": str(item.get("answer") or "")}
                for item in faq
                if isinstance(item, dict)
                and str(item.get("question") or "").strip()
                and str(item.get("answer") or "").strip()
            ]
            if isinstance(faq, list)
            else []
        ),
        "pronunciations": (
            {
                str(word): str(pronunciation)
                for word, pronunciation in pronunciations.items()
                if str(word).strip() and str(pronunciation).strip()
            }
            if isinstance(pronunciations, dict)
            else {}
        ),
        "mishearings": (
            {
                str(heard): str(canonical)
                for heard, canonical in mishearings.items()
                if str(heard).strip() and str(canonical).strip()
            }
            if isinstance(mishearings, dict)
            else {}
        ),
        "tuning": tuning if isinstance(tuning, dict) else {},
        "persona": sanitize_persona(payload.get("persona")),
    }


def sanitize_persona(raw: Any) -> dict[str, Any]:
    """Keep only the persona fields the agent uses, bounded in size.

    The site validates personas before they ship (lib/assistantPersonas.ts); this
    is the agent-side floor so a malformed payload can never inject unbounded
    text into the system prompt or hand Speaches a nonsense voice id.
    """
    if not isinstance(raw, dict):
        return {}

    def lines(key: str) -> list[str]:
        value = raw.get(key)
        if not isinstance(value, list):
            return []
        return [
            " ".join(str(line).split())[:240]
            for line in value
            if str(line).strip()
        ][:12]

    persona: dict[str, Any] = {
        "id": str(raw.get("id") or "")[:48],
        "label": str(raw.get("label") or "")[:60],
        "style": lines("style"),
        "examples": lines("examples"),
    }
    voice = str(raw.get("voice") or "").strip()
    # Kokoro voice ids look like "bf_emma"; anything else is ignored so the
    # session falls back to the configured default rather than failing silently.
    if re.fullmatch(r"[a-z]{2}_[a-z]{2,20}", voice):
        persona["voice"] = voice
    with contextlib.suppress(KeyError, TypeError, ValueError):
        persona["speed"] = float(raw["speed"])
    return persona


@functools.lru_cache(maxsize=1)
def load_pantheon_knowledge() -> str:
    """Load a compact, player-safe Pantheon reference for the system prompt.

    Keeps the summary and the god rosters (New Order + Old Gods tables — every
    god's name, title, and domains) but DROPS the long per-deity prose section
    ("## Deity Entries": rites, commandments, myths).

    Injecting the full document (~4,900 tokens) into every prompt overran the
    model's 4k context window, thrashed the prefix cache, and drove time-to-first-
    token to ~6s. The rosters (~700 tokens) answer god-list, domain, and title
    questions directly; a specific god's rites/commandments/myths come from
    search_knowledge_base on demand.
    """
    configured = os.getenv("MYRA_PANTHEON_PATH")
    pantheon_path = Path(configured) if configured else DEFAULT_PANTHEON_PATH
    try:
        content = pantheon_path.read_text(encoding="utf-8").strip()
    except OSError:
        logger.exception("Unable to load Myra's Pantheon reference")
        return ""
    body = content.split("## Source Anchors", maxsplit=1)[0].strip()
    # The intro + New Order roster sit before the prose; the Old Gods roster sits
    # after it. Splice the two rosters together, leaving the prose out entirely.
    before, _, after = body.partition("## Deity Entries")
    compact = before.strip()
    if "## The Old Gods" in after:
        old_gods = "## The Old Gods" + after.split("## The Old Gods", maxsplit=1)[1]
        compact = f"{compact}\n\n{old_gods.strip()}"
    return compact.strip()


@functools.lru_cache(maxsize=1)
def load_full_pantheon_knowledge() -> str:
    configured = os.getenv("MYRA_PANTHEON_PATH")
    pantheon_path = Path(configured) if configured else DEFAULT_PANTHEON_PATH
    try:
        return pantheon_path.read_text(encoding="utf-8").strip()
    except OSError:
        logger.exception("Unable to load Myra's full Pantheon reference")
        return ""


@functools.lru_cache(maxsize=1)
def load_voice_entity_catalog() -> tuple[str, ...]:
    repo_root = Path(__file__).resolve().parents[4]
    names: set[str] = {"Myrdae", "Suwanee Gamers"}

    for filename in ("campaigns.json", "players.json", "dungeon-masters.json", "nav.json"):
        try:
            payload = json.loads((repo_root / "content" / filename).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        records = payload.get("sections", []) if isinstance(payload, dict) else payload
        for record in records if isinstance(records, list) else []:
            if not isinstance(record, dict):
                continue
            for key in ("name", "label", "title"):
                value = str(record.get(key) or "").strip()
                if value:
                    names.add(value)
            for alias in record.get("aliases", []) if isinstance(record.get("aliases"), list) else []:
                if str(alias).strip():
                    names.add(str(alias).strip())
            for member in record.get("party", []) if isinstance(record.get("party"), list) else []:
                if isinstance(member, dict) and str(member.get("name") or "").strip():
                    names.add(str(member["name"]).strip())
            for item in record.get("items", []) if isinstance(record.get("items"), list) else []:
                if isinstance(item, dict) and str(item.get("label") or "").strip():
                    names.add(str(item["label"]).strip())

    wiki_root = repo_root / "apps" / "web" / "brain-vault" / "wiki"
    included_folders = ("concepts", "entities", "factions", "items", "locations", "npcs", "world")
    for folder in included_folders:
        for markdown in (wiki_root / folder).rglob("*.md"):
            name = markdown.stem.strip()
            if name and not name.lower().endswith((" index", " reference")):
                names.add(name)

    pantheon = load_full_pantheon_knowledge()
    names.update(re.findall(r"^\| \[\[([^\]]+)\]\] \|", pantheon, flags=re.MULTILINE))
    # Active player characters. The wiki covers NPCs and locations, but the PCs
    # live only in the synced roster sheet, so without this the canonicalizer
    # cannot repair the names people say most often.
    names.update(load_active_character_names())
    return tuple(sorted(names, key=lambda value: value.casefold()))



def _spoken_name_variants(raw: str) -> list[str]:
    """Split a roster name into the forms someone might actually say.

    Roster entries carry their nickname inline — `Az'efal (Affy) Fairhand`,
    `Teldo "Fungus Roundbelly"`, `Melessekoviendarre "Meles"`. A speaker says one
    or the other, never the punctuation, so each becomes its own vocabulary
    entry: the bracketed nickname, and the name with the brackets removed.
    """
    value = str(raw or "").strip()
    if not value:
        return []
    variants: list[str] = []
    for nickname in re.findall(r"[\"'“”]([^\"'“”]+)[\"'“”]|\(([^)]+)\)", value):
        picked = (nickname[0] or nickname[1]).strip()
        # Skip an apostrophe inside a name (Az'efal) being read as a quote.
        if picked and " " not in picked and len(picked) < 3:
            continue
        if picked:
            variants.append(picked)
    base = re.sub(r"[\"“”]([^\"“”]+)[\"“”]|\(([^)]+)\)", " ", value)
    base = re.sub(r"\s+", " ", base).strip(" ,-")
    if base:
        variants.insert(0, base)
    return variants


@functools.lru_cache(maxsize=1)
def load_active_character_names() -> tuple[str, ...]:
    """Player-character names for the canonicalizer, from campaign-roster.json.

    These were missing from the entity catalog, and their absence was visible in
    production: "Aurelius Valeheart" came back from Whisper as "Aurelius
    Valehart", and the canonicalizer — having no "Valeheart" to match — dropped
    the surname entirely rather than repairing it.

    Only Active characters. Retired and hiatus rows are the bulk of the roster
    (167 total, 29 active), they are unlikely to be asked about, and every extra
    name widens the fuzzy matcher's surface for a false positive on open speech.
    """
    repo_root = Path(__file__).resolve().parents[4]
    try:
        roster = json.loads(
            (repo_root / "content" / "campaign-roster.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError):
        return ()

    names: list[str] = []
    campaigns = roster.get("campaigns", {}) if isinstance(roster, dict) else {}
    for record in campaigns.values() if isinstance(campaigns, dict) else []:
        if not isinstance(record, dict):
            continue
        characters = record.get("characters")
        for row in characters if isinstance(characters, list) else []:
            if not isinstance(row, dict) or row.get("status") != "Active":
                continue
            names.extend(_spoken_name_variants(row.get("character")))

    seen: set[str] = set()
    ordered: list[str] = []
    for name in names:
        # A one-word nickname of three characters or fewer ("Og", "Ari") is too
        # short to match safely against ordinary speech. Four-character invented
        # nicknames (Aury, Ains, Affy) are distinctive enough to keep, and people
        # do say them, so admit those; the full name still carries the rest.
        if len(name) < 4:
            continue
        key = name.casefold()
        if key not in seen:
            seen.add(key)
            ordered.append(name)
    return tuple(ordered)


@functools.lru_cache(maxsize=1)
def load_campaign_roster_index() -> tuple[tuple[str, tuple[str, ...]], ...]:
    """(campaign name, its active character names) pairs, in roster order."""
    repo_root = Path(__file__).resolve().parents[4]
    try:
        roster = json.loads(
            (repo_root / "content" / "campaign-roster.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError):
        return ()

    index: list[tuple[str, tuple[str, ...]]] = []
    campaigns = roster.get("campaigns", {}) if isinstance(roster, dict) else {}
    for record in campaigns.values() if isinstance(campaigns, dict) else []:
        if not isinstance(record, dict):
            continue
        # Archived campaigns are 15 of the 22 rows and nobody asks about them at
        # the table. Left in, they sorted alphabetically to the front of the
        # budget ("Beer & Dice I, II, III, Blisterfel...") and pushed out every
        # live campaign and party.
        if record.get("kind") != "active":
            continue
        name = str(record.get("name") or "").strip()
        if not name:
            continue
        characters: list[str] = []
        rows = record.get("characters")
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, dict) or row.get("status") != "Active":
                continue
            # Only the base form here. Nicknames are already carried by the full
            # name, and every entry spends budget that biasing is measured by.
            variants = _spoken_name_variants(row.get("character"))
            if variants:
                characters.append(variants[0])
        index.append((name, tuple(characters)))
    return tuple(index)


@functools.lru_cache(maxsize=1)
def load_roster_facts() -> dict[str, Any]:
    """Structured character facts for the look_up_character tool.

    Fast, exact stats read straight from the roster — not the story knowledge
    base — because level/class/species are precise fields, not something to
    retrieve semantically. Returns:
      - "characters": {casefolded name: {...stats..., campaign}} for every
        active character AND its spoken nickname, so "Aury" and "Aurelius
        Valeheart" both resolve.
      - "parties": {campaign name: [display names of active characters]}
      - "campaign_links": {casefolded campaign name: D&D Beyond URL}
      - "campaign_ids": {casefolded campaign name: site slug} for navigation.
    """
    repo_root = Path(__file__).resolve().parents[4]
    characters: dict[str, dict[str, Any]] = {}
    parties: dict[str, list[str]] = {}
    try:
        roster = json.loads(
            (repo_root / "content" / "campaign-roster.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError):
        roster = {}
    campaigns = roster.get("campaigns", {}) if isinstance(roster, dict) else {}
    for record in campaigns.values() if isinstance(campaigns, dict) else []:
        if not isinstance(record, dict) or record.get("kind") != "active":
            continue
        campaign_name = str(record.get("name") or "").strip()
        rows = record.get("characters")
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, dict) or row.get("status") != "Active":
                continue
            full = str(row.get("character") or "").strip()
            if not full:
                continue
            facts = {
                "character": full,
                "player": str(row.get("player") or "").strip(),
                "species": str(row.get("species") or "").strip(),
                "class": str(row.get("class") or "").strip(),
                "subclass": str(row.get("subclass") or "").strip(),
                "level": row.get("level"),
                "campaign": campaign_name,
                "sheet_url": "",
            }
            parties.setdefault(campaign_name, []).append(full)
            # Register the full name and each spoken variant (base + nickname) so
            # the tool matches however the visitor refers to the character.
            for variant in {full, *_spoken_name_variants(full)}:
                if variant:
                    characters.setdefault(variant.casefold(), facts)

    # D&D Beyond links live per campaign in campaigns.json, not per character —
    # our data has no per-character sheet URLs — so "my character sheet" resolves
    # to the visitor's campaign on D&D Beyond, reached via the campaign page.
    campaign_links: dict[str, str] = {}
    campaign_ids: dict[str, str] = {}
    try:
        campaign_records = json.loads(
            (repo_root / "content" / "campaigns.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError):
        campaign_records = []
    for record in campaign_records if isinstance(campaign_records, list) else []:
        if not isinstance(record, dict):
            continue
        name = str(record.get("name") or "").strip()
        if not name:
            continue
        if record.get("id"):
            campaign_ids[name.casefold()] = str(record["id"])
        # Individual character sheets are curated on each campaign party member.
        # Merge them into the synced roster facts without putting a manually
        # maintained URL into campaign-roster.json, which its daily sheet sync
        # intentionally replaces.
        campaign_facts = {
            id(facts): facts
            for facts in characters.values()
            if str(facts.get("campaign") or "").casefold() == name.casefold()
        }.values()
        for member in record.get("party", []) if isinstance(record.get("party"), list) else []:
            if not isinstance(member, dict):
                continue
            member_name = str(member.get("name") or "").strip().casefold()
            sheet_url = next((
                str(link.get("url") or "").strip()
                for link in member.get("links", []) if isinstance(member.get("links"), list)
                if isinstance(link, dict)
                and link.get("type") == "sheet"
                and re.fullmatch(r"https://www\.dndbeyond\.com/characters/\d+/?", str(link.get("url") or ""))
            ), "")
            if not member_name or not sheet_url:
                continue
            for facts in campaign_facts:
                variants = {variant.casefold() for variant in _spoken_name_variants(str(facts["character"]))}
                quoted_aliases = {
                    (match[0] or match[1]).strip().casefold()
                    for match in re.findall(
                        r"[\"'â€œâ€]([^\"'â€œâ€]+)[\"'â€œâ€]|\(([^)]+)\)",
                        str(facts["character"]),
                    )
                    if (match[0] or match[1]).strip()
                }
                # Campaign cards often use just the first name ("Aurelius")
                # while the roster keeps the full name and nickname.
                first_names = {variant.split()[0] for variant in variants if variant.split()}
                if member_name in variants or member_name in first_names or member_name in quoted_aliases:
                    facts["sheet_url"] = sheet_url
                    characters.setdefault(member_name, facts)
        for resource in record.get("resources", []) if isinstance(record.get("resources"), list) else []:
            label = str(resource.get("label") or "").casefold()
            url = str(resource.get("url") or "")
            if "dndbeyond.com/campaigns" in url and "join" not in label and "join" not in url:
                campaign_links.setdefault(name.casefold(), url)

    return {
        "characters": characters,
        "parties": parties,
        "campaign_links": campaign_links,
        "campaign_ids": campaign_ids,
    }


def describe_character(facts: dict[str, Any]) -> str:
    """One spoken sentence of a character's stats. No URLs, TTS-friendly."""
    bits = []
    level = facts.get("level")
    if isinstance(level, int):
        bits.append(f"a level {level}")
    species = facts.get("species")
    klass = facts.get("class")
    descriptor = " ".join(p for p in (species, klass) if p).strip()
    lead = f"{bits[0]} {descriptor}".strip() if bits else descriptor
    sentence = f"{facts['character']} is {lead or 'a character'}"
    subclass = facts.get("subclass")
    if subclass:
        sentence += f", subclass {subclass}"
    campaign = facts.get("campaign")
    if campaign:
        sentence += f", in {campaign}"
    player = facts.get("player")
    if player:
        sentence += f", played by {player}"
    return sentence + "."


def look_up_character_facts(query: str, own_characters: Sequence[str]) -> str:
    """Answer a character / party / player roster question from structured data.

    Handles: a character (or nickname), a campaign (returns the party), a player
    (their characters), and — with an empty query — the visitor's own character.
    """
    data = load_roster_facts()
    chars: dict[str, dict[str, Any]] = data["characters"]
    parties: dict[str, list[str]] = data["parties"]

    asked = query.strip()
    # No name given → the signed-in visitor's own character(s).
    if not asked:
        mine = [c for c in own_characters if c]
        if not mine:
            return (
                "I don't have a character linked to your profile yet. Tell me a "
                "character or campaign name and I'll look it up."
            )
        found = [chars[m.casefold()] for m in mine if m.casefold() in chars]
        if not found:
            return f"Your profile lists {mine[0]}, but I don't see current stats for that character."
        return " ".join(describe_character(f) for f in found[:2])

    key = asked.casefold()
    # Exact character or nickname match.
    if key in chars:
        return describe_character(chars[key])
    # Campaign name → the active party.
    for campaign, members in parties.items():
        if campaign.casefold() == key:
            if not members:
                return f"{campaign} has no active characters listed right now."
            head = ", ".join(members[:4])
            more = f", and {len(members) - 4} more" if len(members) > 4 else ""
            return f"The {campaign} party includes {head}{more}."
    # Player name → their active characters.
    by_player = [f for f in {id(v): v for v in chars.values()}.values()
                 if str(f.get("player") or "").casefold() == key]
    if by_player:
        return " ".join(describe_character(f) for f in by_player[:3])
    # Fuzzy character match as a last resort (STT variance the canonicalizer missed).
    best, best_score = None, 0.0
    for name, facts in chars.items():
        score = SequenceMatcher(None, key, name).ratio()
        if score > best_score:
            best, best_score = facts, score
    if best and best_score >= 0.8:
        return describe_character(best)
    return (
        f"I don't have a character, campaign, or player called {asked} in the "
        "active roster. I can look it up in the Chronicles if you'd like."
    )


def resolve_sheet_campaign(
    query: str,
    own_characters: Sequence[str],
    own_games: Sequence[str],
) -> str:
    """Which campaign page to open for a character-sheet request.

    Our data has no per-character sheet URLs — the D&D Beyond link lives on the
    campaign page — so a sheet request resolves to a campaign. A named character
    or campaign wins; otherwise the signed-in visitor's own campaign (from their
    character, or their single linked game). Empty means "ask which one".
    """
    data = load_roster_facts()
    chars: dict[str, dict[str, Any]] = data["characters"]
    parties: dict[str, list[str]] = data["parties"]

    asked = query.strip()
    if asked:
        key = asked.casefold()
        if key in chars:
            return str(chars[key].get("campaign") or "")
        for campaign in parties:
            if campaign.casefold() == key:
                return campaign
        return ""

    # No name: the visitor's own campaign.
    for character in own_characters:
        facts = chars.get(str(character).casefold())
        if facts and facts.get("campaign"):
            return str(facts["campaign"])
    games = [str(g).strip() for g in own_games if str(g).strip()]
    if len(games) == 1:
        return games[0]
    return ""


def may_open_character_sheet(
    facts: dict[str, Any],
    user_profile: dict[str, Any],
    dm_campaigns: str | Sequence[str],
) -> bool:
    """Only a character's player or that campaign's authorized DM may open it."""
    player_names = {
        str(user_profile.get("playerName") or "").strip().casefold(),
        str(user_profile.get("displayName") or "").strip().casefold(),
    }
    owns_character = str(facts.get("player") or "").strip().casefold() in player_names
    campaign = str(facts.get("campaign") or "").strip().casefold()
    runs_campaign = dm_campaigns == "*" or campaign in {
        str(item).strip().casefold() for item in dm_campaigns
    }
    return owns_character or runs_campaign


def stt_vocabulary_prompt(
    games: Sequence[str] = (),
    max_chars: int | None = None,
) -> str:
    """Proper nouns to bias Whisper toward, most valuable for THIS visitor first.

    Myrdae's names are invented and hard to pronounce, so unbiased decoding
    mangles them: "Aurelius Valeheart from Heroes of Emberstran" came back as
    "Aurelius Veilheart from Heroes of Imberstrand". Biasing fixes both.

    Ordered by who is speaking. A member's own campaigns and party come first,
    because those are the names they actually say, and a short list is both more
    accurate per character and measurably cheaper — biasing cost scales with
    prompt length (measured 2026-08-01 on 4.8s of audio: 10 names 2155ms, 22
    names 2397ms, 37 names 2717ms).

    REQUIRES A NON-DISTILLED MODEL. distil-whisper is trained without
    previous-context conditioning and cannot use a prompt at all: the same list
    that works here collapsed distil-small.en into "from Hoe, from Hoe, from
    Hoe...". See LOCAL_STT_MODEL. Set STT_VOCABULARY=off to disable.
    """
    if os.getenv("STT_VOCABULARY", "on").strip().casefold() in {"off", "none", "0", "false"}:
        return ""
    budget = max_chars if max_chars is not None else int(env_float("STT_VOCABULARY_MAX_CHARS", 350))
    prefix = "Names: "
    remaining = budget - len(prefix) - 1
    if remaining <= 0:
        return ""

    index = load_campaign_roster_index()
    wanted = {str(game).casefold().strip() for game in games if str(game).strip()}
    mine = [entry for entry in index if entry[0].casefold() in wanted]
    theirs = [entry for entry in index if entry[0].casefold() not in wanted]

    # Myra's own name, the world, and the group come first: all three are said
    # constantly and all are mangled unbiased ("Myra" -> "Mara", "Suwanee" ->
    # "Sue Any").
    ordered: list[str] = ["Myra", "Myrdae", "Suwanee Gamers"]
    for campaign, characters in mine:
        ordered.append(campaign)
        ordered.extend(characters)
    # Other campaigns by name before other parties: a campaign name is the
    # coarsest thing anyone asks about, and there are far fewer of them.
    ordered.extend(campaign for campaign, _ in theirs)
    for _, characters in theirs:
        ordered.extend(characters)

    seen: set[str] = set()
    kept: list[str] = []
    used = 0
    for name in ordered:
        key = name.casefold()
        if key in seen:
            continue
        cost = len(name) + (2 if kept else 0)
        if used + cost > remaining:
            continue
        seen.add(key)
        kept.append(name)
        used += cost
    if not kept:
        return ""
    return prefix + ", ".join(kept) + "."


def soundex(value: str) -> str:
    letters = re.sub(r"[^a-z]", "", value.casefold())
    if not letters:
        return ""
    groups = {
        **dict.fromkeys("bfpv", "1"),
        **dict.fromkeys("cgjkqsxz", "2"),
        **dict.fromkeys("dt", "3"),
        "l": "4",
        **dict.fromkeys("mn", "5"),
        "r": "6",
    }
    encoded: list[str] = []
    previous = groups.get(letters[0], "")
    for letter in letters[1:]:
        code = groups.get(letter, "")
        if code and code != previous:
            encoded.append(code)
        previous = code
    return (letters[0].upper() + "".join(encoded) + "000")[:4]


# Category words, not names. They resolve against nav labels ("Campaigns") and
# index pages, so a speaker saying "that campaign" would get a link title back.
GENERIC_ENTITY_WORDS = frozenset(
    {
        "campaign",
        "campaigns",
        "character",
        "characters",
        "deity",
        "deities",
        # "who is the dungeon master" resolved to "who is the Dungeons III
        # Master Thorne" — the single word "dungeon" scored against the campaign
        # "Dungeons III - kNight Watch". A table asks this constantly.
        "dm",
        "dms",
        "dungeon",
        "dungeons",
        "dungeon master",
        "dungeon masters",
        "game",
        "games",
        "god",
        "gods",
        "page",
        "party",
        "player",
        "players",
        "schedule",
        "section",
        "site",
    }
)


def words_match_pairwise(requested_words: list[str], candidate_words: list[str]) -> bool:
    """Require every word to resemble its counterpart, not just the span overall.

    Whole-string similarity lets one completely different word ride along on the
    others: "Heroes of" scored high against "Heroes Mount", and "not kNight
    Watch" against "The kNight Watch" — the second silently inverted meaning.
    Single-word spans are governed by the caller's own threshold instead.
    """
    if len(requested_words) < 2:
        return True
    return all(
        SequenceMatcher(None, spoken_word, candidate_word).ratio() >= 0.6
        for spoken_word, candidate_word in zip(requested_words, candidate_words, strict=True)
    )


def resolve_spoken_entity(value: str, catalog: tuple[str, ...]) -> str | None:
    requested = normalize_question(value)
    if requested in GENERIC_ENTITY_WORDS:
        return None
    exact = next(
        (candidate for candidate in catalog if normalize_question(candidate) == requested),
        None,
    )
    if exact:
        return exact
    requested_words = requested.split()
    if not requested_words or len(requested_words) > 5:
        return None
    scored: list[tuple[float, str]] = []
    requested_soundex = [soundex(word) for word in requested_words]
    for candidate in catalog:
        normalized_candidate = normalize_question(candidate)
        candidate_words = normalized_candidate.split()
        if len(candidate_words) == len(requested_words):
            if not words_match_pairwise(requested_words, candidate_words):
                continue
            similarity = SequenceMatcher(None, requested, normalized_candidate).ratio()
            phonetic = requested_soundex == [soundex(word) for word in candidate_words]
        else:
            if max(len(candidate_words), len(requested_words)) > 2:
                continue
            if any(
                word in {"a", "an", "and", "at", "for", "from", "in", "of", "the", "to"}
                for word in requested_words
            ):
                continue
            compact_requested = "".join(requested_words)
            compact_candidate = "".join(candidate_words)
            phonetic = soundex(compact_requested) == soundex(compact_candidate)
            if not phonetic:
                continue
            similarity = SequenceMatcher(None, compact_requested, compact_candidate).ratio()
        score = similarity + (0.25 if phonetic else 0.0)
        if score >= 0.78:
            scored.append((score, candidate))
    scored.sort(reverse=True)
    if not scored:
        return None
    if len(scored) > 1 and scored[0][0] - scored[1][0] < 0.08:
        return None
    return scored[0][1]


def apply_mishearings(text: str, mishearings: dict[str, str]) -> str:
    """Rewrite known transcription errors before anything reads the question.

    The mirror image of apply_pronunciations: that one fixes what Myra says, this
    one fixes what she heard. Longest key first, so "Dungeons 3K Night Watch"
    wins over the "Dungeons 3" that is a substring of it.
    """
    heard = text
    for wrong, canonical in sorted(
        mishearings.items(),
        key=lambda item: len(item[0]),
        reverse=True,
    ):
        heard = re.sub(
            rf"(?<!\w){re.escape(wrong)}(?!\w)",
            canonical,
            heard,
            flags=re.IGNORECASE,
        )
    return heard


# Words common enough in ordinary speech that they must never be treated as an
# entity reference on their own. resolve_spoken_entity matches phonetically, so
# without this guard a bare "no" or "what next" can score against a short deity
# or campaign name once the intent-phrase gate below is removed.
COMMON_SPOKEN_WORDS = frozenset(
    """
    a about after again all also am an and another any are as ask at back be because been
    before being best better between both but by call can cant come could did didnt do does
    doesnt doing done dont down each even ever every few find first for from get give go going
    good got great had has have having he her here hers him his how i if in into is isnt it its
    just keep know last let like little long look made make many may me mean might mine more
    most much must my need never new next no not now of off ok okay old on once one only or
    other others our out over own play please put ran really right run said same say says see
    she should show so some something soon still such sure take tell than that thats the their
    them then there these they thing things think this those though thought three through time
    to today told too took two up us use used very want was way we week well went were what
    when where which while who why will with without would yeah year yes yet you your youre
    """.split()  # noqa: SIM905 - a word list, not a fixed literal
)


# Never rewritten, whatever the catalog says. Myra is the assistant's own name
# and is phonetically close to Myrdae, the world she talks about.
PROTECTED_SPOKEN_TERMS = frozenset({"myra"})


def resolve_freeform_entity(value: str, catalog: tuple[str, ...]) -> str | None:
    """Strict entity match for spans that are not known to be entity references.

    resolve_spoken_entity is deliberately permissive: a soundex hit is worth
    +0.25, which is the right call once an intent phrase ("tell me about ...")
    has already established that the span names something. Applied to arbitrary
    speech against a 759-entry catalog it is far too eager — it rewrote "not part
    of" to "not Proth of" and "the gods of" to "the Regions of". This resolver
    keeps only the case that matters for transcription repair: the same number of
    words, nearly the same letters ("Imberstran" for "Emberstran").
    """
    requested = normalize_question(value)
    if len(requested) < 5 or requested in PROTECTED_SPOKEN_TERMS:
        return None
    if requested in GENERIC_ENTITY_WORDS:
        return None
    requested_words = requested.split()
    scored: list[tuple[float, str]] = []
    for candidate in catalog:
        normalized_candidate = normalize_question(candidate)
        if normalized_candidate == requested:
            return None  # already canonical; nothing to repair
        candidate_words = normalized_candidate.split()
        if len(candidate_words) != len(requested_words):
            continue
        if not words_match_pairwise(requested_words, candidate_words):
            continue
        similarity = SequenceMatcher(None, requested, normalized_candidate).ratio()
        if similarity >= 0.85:
            scored.append((similarity, candidate))
    scored.sort(reverse=True)
    if not scored:
        return None
    if len(scored) > 1 and scored[0][0] - scored[1][0] < 0.06:
        return None
    return scored[0][1]


def canonicalize_spoken_entities(text: str, catalog: tuple[str, ...]) -> str:
    """Rewrite misheard entity names anywhere in an utterance.

    This used to fire only inside question phrasings ("tell me about X"), which
    missed the case that costs the most: the free-form correction a player makes
    after Myra gets a name wrong ("no, it's Emberstran"). Those turns never
    matched the intent regex, so the catalog sat unused exactly when it was
    needed. Spans are matched longest-first and only replaced across plain
    whitespace, so surrounding punctuation survives untouched.
    """
    tokens = [(match.start(), match.end()) for match in re.finditer(r"[\w'\u2019-]+", text)]
    if not tokens:
        return text
    consumed = [False] * len(tokens)
    replacements: list[tuple[int, int, str]] = []
    for size in range(min(4, len(tokens)), 0, -1):
        for index in range(len(tokens) - size + 1):
            if any(consumed[index : index + size]):
                continue
            span = tokens[index : index + size]
            # Only span a run of words separated by plain spaces; anything else
            # means punctuation sits inside, and replacing across it would eat
            # the punctuation.
            if any(
                not text[span[offset][1] : span[offset + 1][0]].isspace()
                for offset in range(size - 1)
            ):
                continue
            words = [text[start:end] for start, end in span]
            if all(word.casefold().strip("'\u2019-") in COMMON_SPOKEN_WORDS for word in words):
                continue
            phrase = " ".join(words)
            canonical = resolve_freeform_entity(phrase, catalog)
            if not canonical or normalize_question(canonical) == normalize_question(phrase):
                continue
            replacements.append((span[0][0], span[-1][1], canonical))
            for offset in range(size):
                consumed[index + offset] = True
    if not replacements:
        return text
    canonical_text = text
    for start, end, canonical in sorted(replacements, reverse=True):
        canonical_text = f"{canonical_text[:start]}{canonical}{canonical_text[end:]}"
    return canonical_text


# Lead-in phrases after which the visitor is naming an entity they want to know
# about. Deliberately broad — a live session produced "I need to know about De
# Vira" and the missing "need to know about" left "De Vira" unresolved, so the
# model got a garbled name and asked which campaign instead of answering. Being
# broad is safe: the resolver only rewrites a span that matches a known catalog
# name, so a false trigger on ordinary speech ("what's this all about") changes
# nothing. Shared by the entity canonicalizer and the deity lookup so a new
# phrasing is added in ONE place, not two.
KNOW_ABOUT_LEADINS = (
    r"(?:i |we )?(?:need|want|wanna|would like|'?d like|like|have|got|would love) to know "
    r"(?:more |anything |something )?about|"
    r"(?:do you |you )?know (?:anything|something|more) about|"
    r"i would like to know about|"
    r"tell me (?:more |a bit more |a little more |anything )?about|tell me more on|"
    r"who is|who was|where is|what is known about|what can you tell me about|"
    r"what (?:more )?do you know about|what god is|which god is|"
    r"heard about|curious about"
)


def canonicalize_spoken_entity_question(
    question: str,
    catalog: tuple[str, ...],
) -> str:
    """Canonicalize the span that follows an explicit "tell me about ..." intent.

    Inside a known intent phrase the span is established to be naming something,
    so the permissive phonetic matcher is safe here in a way it is not over open
    speech — see resolve_freeform_entity.
    """
    # The span stops at the sentence boundary. It used to run to end-of-string,
    # so a two-sentence turn ("When is my next session of X? And does Myra know
    # about Y?") handed the whole tail to the permissive matcher and came back as
    # "Dungeons III III". Anything past the first sentence is the free-form
    # pass's job.
    match = re.search(
        # The knowledge lead-ins (KNOW_ABOUT_LEADINS) plus the schedule and
        # navigation verbs specific to this pass.
        r"\b(?:" + KNOW_ABOUT_LEADINS + r"|when is|when does|when do|"
        r"open|show me|go to|take me to|visit)\s+([^?.!]+)",
        question,
        flags=re.IGNORECASE,
    )
    if not match:
        return question
    spoken = match.group(1).strip()
    words = spoken.split()
    changed = False
    for size in range(min(4, len(words)), 0, -1):
        index = 0
        while index + size <= len(words):
            phrase = " ".join(words[index : index + size]).strip(" ,.?!")
            canonical = resolve_spoken_entity(phrase, catalog)
            if (
                canonical
                and normalize_question(phrase) not in PROTECTED_SPOKEN_TERMS
                and normalize_question(canonical) != normalize_question(phrase)
            ):
                words[index : index + size] = [canonical]
                changed = True
            index += 1
    if not changed:
        return question
    canonical_spoken = " ".join(words)
    if normalize_question(canonical_spoken) == normalize_question(spoken):
        return question
    start, end = match.span(1)
    return f"{question[:start]}{canonical_spoken}{question[end:]}"


def canonicalize_spoken_question(question: str, catalog: tuple[str, ...]) -> str:
    """Both repair passes, in the order they should apply.

    The intent-phrase pass is permissive but narrowly scoped; the free-form pass
    is strict and applies everywhere else.
    """
    return canonicalize_spoken_entities(
        canonicalize_spoken_entity_question(question, catalog),
        catalog,
    )


def pantheon_deity_answer(question: str, pantheon: str) -> str | None:
    intent = re.search(
        # Same broad knowledge lead-ins as the canonicalizer (KNOW_ABOUT_LEADINS)
        # so every phrasing that resolves a god's name also reaches this lookup.
        r"\b(?:" + KNOW_ABOUT_LEADINS + r")\s+(.+?)[?.!]*$",
        question,
        flags=re.IGNORECASE,
    )
    if not intent or not pantheon:
        return None
    requested = normalize_question(intent.group(1))
    requested = re.sub(r"^(?:the god|the goddess|god|goddess)\s+", "", requested)
    spoken_aliases = {
        "aden": "Addan",
        "adam": "Addan",
        "add in": "Addan",
        "diveria": "Diverra",
        "divaria": "Diverra",
        "de vera": "Diverra",
    }
    requested = normalize_question(spoken_aliases.get(requested, requested))
    names = re.findall(r"^\| \[\[([^\]]+)\]\] \|", pantheon, flags=re.MULTILINE)
    names.extend(
        re.findall(
            r"^\| (?!Name\b|---)([A-Za-z][A-Za-z' -]+?) \|",
            pantheon.split("## The Old Gods", maxsplit=1)[-1],
            flags=re.MULTILINE,
        )
    )
    best_name = ""
    best_score = 0.0
    for name in names:
        score = SequenceMatcher(None, requested, normalize_question(name)).ratio()
        if score > best_score:
            best_name = name.strip()
            best_score = score
    if best_score < 0.72:
        return None

    entry = re.search(
        rf"^###\s+({re.escape(best_name)}[^\n]*)\n(.*?)(?=^###\s+|^##\s+The Old Gods|\Z)",
        pantheon,
        flags=re.MULTILINE | re.DOTALL | re.IGNORECASE,
    )
    if not entry:
        return None
    title = entry.group(1).strip()
    prose = re.sub(r"\[\[([^]|]+)(?:\|[^]]+)?\]\]", r"\1", entry.group(2))
    prose = re.sub(r"[*_>`#]", "", prose)
    prose = re.sub(r"\s+", " ", prose).strip()
    sentences = re.split(r"(?<=[.!?])\s+", prose)
    summary = " ".join(sentences[:2]).strip()
    return f"{title}. {summary}" if summary else title


def mentioned_pantheon_deity(question: str, pantheon: str) -> str | None:
    """Return the deity explicitly named in a turn, if there is one."""
    if not question or not pantheon:
        return None
    normalized = normalize_question(question)
    spoken_aliases = {
        "diveria": "Diverra",
        "divaria": "Diverra",
        "devira": "Diverra",
        "de vera": "Diverra",
    }
    for spoken, canonical in spoken_aliases.items():
        if re.search(rf"\b{re.escape(spoken)}\b", normalized):
            return canonical
    names = re.findall(r"^\| \[\[([^\]]+)\]\] \|", pantheon, flags=re.MULTILINE)
    names.extend(
        re.findall(
            r"^\| (?!Name\b|---)([A-Za-z][A-Za-z' -]+?) \|",
            pantheon.split("## The Old Gods", maxsplit=1)[-1],
            flags=re.MULTILINE,
        )
    )
    for name in sorted({item.strip() for item in names}, key=len, reverse=True):
        if re.search(rf"\b{re.escape(normalize_question(name))}\b", normalized):
            return name
    return None


def contextualize_entity_followup(question: str, subject: str | None) -> str:
    """Make an immediate pronoun follow-up self-contained for weak fallback LLMs."""
    if not subject:
        return question
    return re.sub(
        r"\b(?:that goddess|that god|her|him|them|she|he|they|it)\b",
        subject,
        question,
        count=1,
        flags=re.IGNORECASE,
    )


def select_events(events: list[dict[str, Any]], campaign: str = "") -> list[dict[str, Any]]:
    query = campaign.casefold().strip()
    matching = [
        event
        for event in events
        if not query or query in str(event.get("title", "")).casefold()
    ]
    return sorted(matching, key=lambda event: str(event.get("start", "")))[:10]


def parse_event_datetime(value: object, timezone: ZoneInfo) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone)
    return parsed.astimezone(timezone)


def schedule_facts(schedule: dict[str, Any], now: datetime | None = None) -> str:
    timezone = ZoneInfo(schedule["timezone"])
    local_now = now.astimezone(timezone) if now else datetime.now(timezone)
    events = select_events(schedule["events"])

    def describe(event: dict[str, Any]) -> str:
        start = parse_event_datetime(event.get("start"), timezone)
        end = parse_event_datetime(event.get("end"), timezone)
        title = str(event.get("title") or "Unnamed game")
        if start is None:
            return f"- {title}: date not provided"
        date_label = f"{start.strftime('%A, %B')} {start.day}"
        if event.get("allDay"):
            timing = date_label
        else:
            start_time = start.strftime("%I:%M %p").lstrip("0")
            timing = f"{date_label} at {start_time}"
            if end is not None:
                timing += f" to {end.strftime('%I:%M %p').lstrip('0')}"
        location = str(event.get("location") or "").strip()
        return f"- {title}: {timing}" + (f", at {location}" if location else "")

    today_events = [
        event
        for event in events
        if (start := parse_event_datetime(event.get("start"), timezone))
        and start.date() == local_now.date()
    ]
    upcoming_events = [
        event
        for event in events
        if (start := parse_event_datetime(event.get("start"), timezone))
        and start.date() > local_now.date()
    ][:5]

    today_lines = "\n".join(map(describe, today_events)) or "- No games are scheduled today."
    upcoming_lines = "\n".join(map(describe, upcoming_events)) or "- No later games are listed."
    return textwrap.dedent(
        f"""\
        CURRENT LOCAL DATE: {local_now.strftime("%A, %B")} {local_now.day}, {local_now.year}

        GAMES SCHEDULED TODAY:
        {today_lines}

        NEXT UPCOMING GAMES:
        {upcoming_lines}
        """
    )


def general_schedule_answer(schedule: dict[str, Any], now: datetime | None = None) -> str:
    timezone = ZoneInfo(schedule["timezone"])
    local_now = now.astimezone(timezone) if now else datetime.now(timezone)
    events = select_events(schedule["events"])
    today_events: list[tuple[dict[str, Any], datetime]] = []
    upcoming_events: list[tuple[dict[str, Any], datetime]] = []

    for event in events:
        start = parse_event_datetime(event.get("start"), timezone)
        if start is None:
            continue
        if start.date() == local_now.date():
            today_events.append((event, start))
        elif start.date() > local_now.date():
            upcoming_events.append((event, start))

    def spoken_event(event: dict[str, Any], start: datetime, include_date: bool) -> str:
        title = str(event.get("title") or "an unnamed game")
        time = start.strftime("%I:%M %p").lstrip("0")
        if include_date:
            return f"{title} on {start.strftime('%A, %B')} {start.day} at {time}"
        return f"{title} at {time}"

    if today_events:
        today_text = ", ".join(
            spoken_event(event, start, include_date=False)
            for event, start in today_events
        )
        answer = f"Yep — today, {today_text}."
    else:
        answer = "Looks like there aren't any games scheduled today."

    if upcoming_events:
        upcoming_text = ", ".join(
            spoken_event(event, start, include_date=True)
            for event, start in upcoming_events[:2]
        )
        answer += f" And coming up next, {upcoming_text}."
    else:
        answer += " And I don't see any later games listed right now."
    return answer


AFFIRMATIONS = frozenset(
    {
        "yes",
        "yeah",
        "yep",
        "yup",
        "sure",
        "ok",
        "okay",
        "please",
        "please do",
        "yes please",
        "go ahead",
        "sounds good",
        "definitely",
        "absolutely",
        "i do",
        "that would be great",
        "tell me",
    }
)


def is_bare_affirmation(question: str) -> bool:
    """True only for a standalone yes, never for a yes carrying its own question.

    Deliberately strict. This decides whether to substitute a question the
    visitor never asked, so "yeah, what about the gods?" must NOT match — only
    an answer that is purely agreement. Compare the permissive fuzzy entity
    matcher, which must never run on open speech for the same reason.
    """
    normalized = re.sub(r"[^a-z\s]", "", str(question or "").casefold()).strip()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized in AFFIRMATIONS


def is_personal_schedule_question(question: str) -> bool:
    normalized = normalize_question(question)
    return any(
        phrase in normalized
        for phrase in (
            "my games",
            "my game schedule",
            "my schedule",
            "games am i in",
            "games i am in",
            "when do i play",
            "when am i playing",
            "what do i have scheduled",
        )
    )


def personalized_schedule_answer(
    schedule: dict[str, Any],
    games: list[str],
    now: datetime | None = None,
) -> str:
    if not games:
        return (
            "Hmm, I don't see any active campaign assignments linked to your profile yet."
        )
    normalized_games = [game.casefold().strip() for game in games if game.strip()]
    personal_events = [
        event
        for event in schedule.get("events", [])
        if any(
            game in str(event.get("title") or "").casefold()
            for game in normalized_games
        )
    ]
    if not personal_events:
        game_names = ", ".join(games)
        return (
            f"I know you're connected to {game_names}, but I don't see an upcoming "
            "session for those games on the calendar right now."
        )
    return general_schedule_answer({**schedule, "events": personal_events}, now)


def campaign_schedule_answer(
    schedule: dict[str, Any],
    question: str,
) -> tuple[str, str] | None:
    timezone = ZoneInfo(schedule["timezone"])
    normalized_question = question.casefold()
    for event in select_events(schedule["events"]):
        title = str(event.get("title") or "").strip()
        if not title or title.casefold() not in normalized_question:
            continue
        start = parse_event_datetime(event.get("start"), timezone)
        if start is None:
            return (
                f"Hmm, {title} is listed, but I don't have its next date yet.",
                "campaign",
            )
        return (
            f"Yep — the next {title} game is {start.strftime('%A, %B')} "
            f"{start.day} at {start.strftime('%I:%M %p').lstrip('0')}.",
            "campaign",
        )
    return None


def is_about_suwanee_gamers_question(question: str) -> bool:
    normalized = question.casefold()
    if any(
        phrase in normalized
        for phrase in (
            "schedule",
            "scheduled",
            "today",
            "tonight",
            "next game",
            "next session",
            "coming up",
        )
    ):
        return False
    subject = any(
        phrase in normalized
        for phrase in (
            "suwanee gamers",
            "the group",
            "this group",
            "our group",
            "our story",
        )
    )
    about_intent = any(
        phrase in normalized
        for phrase in (
            "tell me about",
            "want to know about",
            "what is",
            "who are",
            "our story",
            "history of",
            "how did",
            "when did",
            "founded",
            "started",
        )
    )
    return subject and about_intent


def about_suwanee_gamers_answer(
    about: str,
    knowledge: str = "",
) -> str | None:
    source = about.strip()
    if not source and knowledge:
        section = re.search(
            r"## What Suwanee Gamers is\s+(.*?)(?=\n## |\Z)",
            knowledge,
            flags=re.DOTALL | re.IGNORECASE,
        )
        source = section.group(1).strip() if section else ""
    source = re.sub(r"\s+", " ", source).strip()
    if not source:
        return None
    sentences = re.split(r"(?<=[.!?])\s+", source)
    summary = " ".join(sentences[:2]).strip()
    return f"{summary} And if you'd like the full story, it's on the Our Story page."


def is_schedule_question(question: str) -> bool:
    normalized = question.casefold()
    return any(
        phrase in normalized
        for phrase in (
            "schedule",
            "scheduled",
            "what games",
            "today",
            "tonight",
            "coming up",
            "next game",
            "next session",
            "when is",
            "when does",
            "when do",
            "what time",
            "playing next",
            "play next",
        )
    )


def resolve_navigation(
    navigation: list[dict[str, str]],
    requested_page: str,
) -> tuple[dict[str, str] | None, list[str]]:
    requested = normalize_question(requested_page)
    requested = re.sub(
        r"\b(?:section|page)(?:\s+of\s+(?:the\s+)?site)?\b",
        " ",
        requested,
    )
    requested = re.sub(r"\s+", " ", requested).strip()
    if requested in {"home", "home page", "homepage", "main page", "start page"}:
        requested = "home"
    if requested in {
        "profile",
        "my profile",
        "user profile",
        "users profile",
        "account",
        "my account",
        "settings",
        "my settings",
        "profile settings",
    }:
        requested = "my profile"
    if re.search(r"\b(?:god|gods|goddess|goddesses|deity|deities|divine pantheon)\b", requested):
        requested = "pantheon"
    if not requested:
        return None, []
    exact = [
        item
        for item in navigation
        if requested in {
            normalize_question(item.get("label", "")),
            normalize_question(item.get("href", "").strip("/").replace("-", " ")),
        }
    ]
    if len(exact) == 1:
        return exact[0], []
    def comparable_words(value: str) -> set[str]:
        return {
            word[:-1] if len(word) > 3 and word.endswith("s") else word
            for word in normalize_question(value).split()
        }

    requested_words = comparable_words(requested)
    matches = [
        item
        for item in navigation
        if requested_words
        and requested_words
        <= comparable_words(
            f"{item.get('label', '')} {item.get('href', '').replace('-', ' ')}"
        )
    ]
    if len(matches) == 1:
        return matches[0], []
    if not matches:
        labels = tuple(
            item.get("label", "")
            for item in navigation
            if item.get("label")
        )
        spoken_match = resolve_spoken_entity(requested, labels)
        if spoken_match:
            resolved = [
                item
                for item in navigation
                if item.get("label") == spoken_match
            ]
            if len(resolved) == 1:
                return resolved[0], []
    return None, [item.get("label", "") for item in matches[:5] if item.get("label")]


def navigation_request_target(question: str) -> str | None:
    match = re.search(
        r"\b(?:open|show me|visit|(?:go|navigate me|take me|bring me)"
        r"\s+(?:back\s+)?to)\s+(?:the\s+)?(.+?)(?:\s+page)?[.!?]*$",
        question,
        flags=re.IGNORECASE,
    )
    return match.group(1).strip() if match else None


def wake_word_command(question: str) -> str | None:
    """Return the command following an opening Hey Myra wake phrase."""
    match = re.match(
        r"^\s*(?:hey|hi|okay|ok)\s*,?\s+(?:myra|mira)\b[\s,:;.!?-]*(.*)$",
        question,
        flags=re.IGNORECASE,
    )
    return match.group(1).strip() if match else None


# The Chronicles vault indexes each campaign under a specific name, mirrored from
# apps/web/lib/brain/query.ts. The ROSTER names don't always match — roster
# "Dungeons III - kNight Watch" is vault "Dungeons III"; roster "Bloody Endeavor
# II" is vault "Bloody Endeavor" — and passing an unrecognized name makes the
# vault refuse to answer ("name the campaign"), so a visitor in one of those
# campaigns gets nothing. Normalize to the vault name before asking.
BRAIN_CAMPAIGNS: dict[str, tuple[str, ...]] = {
    "Heroes of Emberstran": ("heroes of emberstran", "heart of emberstran"),
    "Souls of Destiny": ("souls of destiny",),
    "The Silent Vanguard": ("silent vanguard",),
    "Bloody Endeavor": ("bloody endeavor", "bloody endeavour", "wyrm bane"),
    "Dungeons III": ("dungeons iii", "dungeons 3", "dungeons three", "knight watch", "night watch"),
    "The Crystal Bottle": ("crystal bottle",),
}


def map_campaign_to_brain(name: str) -> str:
    """Map a known campaign name (roster or spoken) to the vault index name, or ''.

    The input is trusted to be a campaign reference, so substring matching is
    fine: "Bloody Endeavor II" contains "bloody endeavor".
    """
    key = str(name or "").casefold()
    if not key:
        return ""
    for brain_name, aliases in BRAIN_CAMPAIGNS.items():
        if brain_name.casefold() in key or any(alias in key for alias in aliases):
            return brain_name
    return ""


def campaign_named_in_question(question: str) -> str:
    """The vault campaign a free-text question is about, or ''.

    Distinctive multi-word aliases only, at word boundaries, so ordinary speech
    never false-matches a campaign. Scoping a world question to a campaign is
    harmless (world lore answers under any scope), so this errs toward matching.
    """
    text = str(question or "").casefold()
    for brain_name, aliases in BRAIN_CAMPAIGNS.items():
        for alias in (brain_name.casefold(), *aliases):
            if " " in alias and re.search(r"\b" + re.escape(alias) + r"\b", text):
                return brain_name
    return ""


def query_player_knowledge(
    question: str,
    campaign: str = "All",
    visibility: str = "players",
    access_token: str = "",
) -> str:
    endpoint = os.getenv(
        "BRAIN_ASK_URL",
        "http://127.0.0.1:4652/api/brain/ask",
    )
    # The site is members-only: every API route requires either a signed-in
    # visitor or a machine bearer token. This worker has no browser session, so
    # it authenticates with the shared secret, exactly as the metrics posts do.
    headers = {"Content-Type": "application/json"}
    secret = os.getenv("LIVEKIT_API_SECRET")
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    if access_token:
        headers["x-sg-myra-brain-access"] = access_token
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(
            {
                "question": question,
                # Character and party questions are campaign-scoped: the vault
                # refuses to answer "tell me about Aurelius" under the default
                # "All" scope ("name the campaign — I won't search across
                # separate campaign histories") to avoid cross-campaign spoilers.
                # Scoping to the visitor's own campaign unblocks their character
                # questions, and world lore (gods, history, places) still answers
                # under any scope.
                "campaign": campaign or "All",
                "visibility": "dm" if visibility == "dm" and access_token else "players",
                "answerMode": "direct",
                "quality": "fast",
            }
        ).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = json.loads(response.read().decode())
        answer = str(payload.get("answer") or "").strip()
        return answer or "The knowledge base did not return an answer."
    except Exception:
        logger.exception("Unable to query the player knowledge base")
        return "I couldn't reach the Suwanee Gamers knowledge base just now."


def apply_pronunciations(text: str, pronunciations: dict[str, str]) -> str:
    """Replace written names with TTS-friendly spellings at speech time only."""
    spoken = text
    for word, pronunciation in sorted(
        pronunciations.items(),
        key=lambda item: len(item[0]),
        reverse=True,
    ):
        spoken = re.sub(
            rf"(?<!\w){re.escape(word)}(?!\w)",
            pronunciation,
            spoken,
            flags=re.IGNORECASE,
        )
    return spoken


async def pronunciation_stream(
    text: AsyncIterable[str],
    pronunciations: dict[str, str],
) -> AsyncGenerator[str, None]:
    """Preserve streaming while holding only the unfinished final word."""
    pending = ""
    async for chunk in text:
        pending += chunk
        split_at = pending.rfind(" ")
        if split_at < 0:
            continue
        complete = pending[: split_at + 1]
        pending = pending[split_at + 1 :]
        yield apply_pronunciations(complete, pronunciations)
    if pending:
        yield apply_pronunciations(pending, pronunciations)


SELF_DIAGNOSIS_PHRASES = (
    "how do you feel",
    "how are you feeling",
    "how you feeling",
    "you feeling okay",
    "you feeling ok",
    "how are you",
    "how're you",
    "how you doing",
    "are you okay",
    "are you ok",
    "are you alright",
    "are you all right",
    "are you well",
    "are you healthy",
    "are you working",
    "are you broken",
    "are you connected",
    "everything working",
    "everything okay",
    "everything alright",
    "self diagnos",
    "self-diagnos",
    "self test",
    "self-test",
    "diagnostic",
    "system check",
    "status report",
    "check yourself",
    "run a check",
    "whats wrong with you",
    "what's wrong with you",
    "how is your health",
    "how's your health",
    "you seem slow",
    "can you hear me",
    "do you remember",
    "is the site okay",
    "check your brain",
    "systems online",
    "website doing",
    "problems today",
    "last error",
)


def is_self_diagnosis_question(question: str) -> bool:
    normalized = question.casefold()
    return any(phrase in normalized for phrase in SELF_DIAGNOSIS_PHRASES)


def diagnostic_request(question: str) -> tuple[str, str | None]:
    """Infer diagnostic depth and component without treating one phrase as proof."""
    normalized = question.casefold()
    depth = "full" if "full diagnostic" in normalized or "all your systems" in normalized else "quick"
    components = {
        "memory": ("memory", "remember", "brain", "wiki"),
        "voice": ("hear", "voice", "microphone", "audio", "livekit", "speech"),
        "website": ("site", "website", "database", "api"),
        "ai": ("think", "model", "ai", "claude", "ollama"),
    }
    for component, terms in components.items():
        if any(term in normalized for term in terms):
            return "component", component
    return depth, None


RECAP_PHRASES = (
    "what happened",
    "happened last",
    "happened in",
    "last time",
    "last session",
    "last game",
    "previously",
    "previous session",
    "recap",
    "catch me up",
    "catch up",
    "what did we do",
    "where did we leave",
    "left off",
    "story so far",
    "remind me what",
    "summarize the last",
    "summary of the last",
)


def is_recap_question(question: str) -> bool:
    normalized = question.casefold()
    return any(phrase in normalized for phrase in RECAP_PHRASES)


def recap_answer(recaps: list[dict[str, Any]], question: str) -> tuple[str, str] | None:
    """Answer "what happened last time in <campaign>" from the latest session summary.

    Returns (spoken, category) when a campaign name or alias appears in the
    question, otherwise None so the caller can ask which campaign is meant.
    """
    normalized = question.casefold()
    for recap in recaps:
        names = [str(recap.get("name") or "")]
        names += [str(alias) for alias in (recap.get("aliases") or [])]
        if not any(name and name.casefold() in normalized for name in names):
            continue
        name = str(recap.get("name") or "that campaign")
        summary = str(recap.get("summary") or "").strip()
        if not summary:
            return (
                f"Hmm, I don't have a session recap for {name} yet. "
                "You can check Chronicles for the full story.",
                "recap",
            )
        return (f"Okay, so here's what happened last time in {name}. {summary}", "recap")
    return None


def normalize_question(question: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace.

    Mirrors normalizeQuestion in apps/web/lib/assistantLearned.ts so the key the
    learning job stored lines up with what we compute here at speech time.
    """
    lowered = question.casefold()
    stripped = re.sub(r"[^\w\s]", " ", lowered, flags=re.UNICODE)
    return re.sub(r"\s+", " ", stripped).strip()


def match_faq(question: str, faq: list[dict[str, str]]) -> str | None:
    """Return a learned answer when the visitor's question matches one Myra learned.

    Matching is intentionally conservative: an exact normalized match, or a high
    word-overlap (Jaccard) match, so minor rephrasings hit but unrelated questions
    never false-match onto a learned answer.
    """
    asked = normalize_question(question)
    if not asked:
        return None
    asked_words = set(asked.split())
    best_answer: str | None = None
    best_score = 0.0
    for item in faq:
        learned = normalize_question(item.get("question", ""))
        if not learned:
            continue
        if learned == asked:
            return item.get("answer") or None
        learned_words = set(learned.split())
        if not learned_words:
            continue
        overlap = len(asked_words & learned_words)
        union = len(asked_words | learned_words)
        score = overlap / union if union else 0.0
        if score > best_score:
            best_score = score
            best_answer = item.get("answer") or None
    # High threshold: near-identical phrasing only, to avoid confident wrong hits.
    return best_answer if best_score >= 0.82 else None


def speech_base_url() -> str:
    return os.getenv("LOCAL_SPEECH_BASE_URL", "http://127.0.0.1:8000/v1")


def ollama_base_url() -> str:
    return os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1")


def env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def tuning_float(tuning: dict[str, Any], key: str, env_name: str, default: float) -> float:
    """Resolve a numeric knob: auto-tuned value first, then env override, then default.

    The autotuned values arrive per session in dispatch metadata (see the token
    route); env vars remain a manual override for local experiments.
    """
    if isinstance(tuning, dict) and key in tuning:
        try:
            return float(tuning[key])
        except (TypeError, ValueError):
            pass
    return env_float(env_name, default)


DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5"


def _stt_falsey(value: str) -> bool:
    return value.strip().casefold() in {"", "off", "none", "0", "false"}


def build_whisper_stt(vocabulary: str) -> openai.STT:
    """CPU Whisper via Speaches — the fallback, and the sole engine if Parakeet
    is not configured. The vocabulary rides in as an initial_prompt."""
    return openai.STT(
        model=os.getenv("LOCAL_STT_MODEL", "Systran/faster-whisper-small.en"),
        language="en",
        base_url=speech_base_url(),
        api_key="local-only",
        **({"prompt": vocabulary} if vocabulary else {}),
    )


def build_parakeet_stt(vocabulary: str) -> openai.STT:
    """GPU Parakeet via the local NeMo service (services/parakeet-stt). It speaks
    the OpenAI transcription API, so the same plugin and the same vocabulary
    prompt work — the service turns the names into NeMo phrase boosting."""
    return openai.STT(
        model=os.getenv("PARAKEET_MODEL", "nvidia/parakeet-tdt-0.6b-v2"),
        language="en",
        base_url=os.getenv("PARAKEET_BASE_URL", "http://127.0.0.1:8767/v1"),
        api_key="local-only",
        **({"prompt": vocabulary} if vocabulary else {}),
    )


def build_stt(vocabulary: str, vad: Any) -> stt.STT:
    """Parakeet (GPU) only, VAD-segmented. Whisper stays an explicit opt-in.

    The CPU Whisper fallback was retired: once Parakeet went primary it never
    fired once (measured ~250ms and reliable), and carrying it as a
    FallbackAdapter child only added a slow CPU second-guess and held the model
    resident for nothing. Whisper is still reachable on demand — set
    STT_ENGINE=whisper, or leave PARAKEET_BASE_URL blank — for the pre-Parakeet
    behaviour or if the GPU service is down.

    Parakeet is non-streaming, so it is wrapped in a StreamAdapter with the
    session VAD to segment audio — the job the retired FallbackAdapter's `vad=`
    used to do. Trade-off accepted with this change: no automatic failover, so a
    Parakeet outage now drops the turn (deterministic answers still work) until
    STT_ENGINE=whisper is set.
    """
    if os.getenv("STT_ENGINE", "parakeet").strip().casefold() == "whisper" or _stt_falsey(
        os.getenv("PARAKEET_BASE_URL", "http://127.0.0.1:8767/v1")
    ):
        return build_whisper_stt(vocabulary)
    parakeet = build_parakeet_stt(vocabulary)
    return stt.StreamAdapter(stt=parakeet, vad=vad)


PAGE_CONTEXT_TOPIC = "myra.page_context"


def page_context_block(page: Any) -> str:
    """Describe the page the visitor is looking at, for the system prompt.

    This is what lets "tell me about him" resolve against whatever is on screen
    instead of being a dead end. It is deliberately text-only: Myra learns the
    page's name and subject, never its pixels, so she must not imply she can see
    the screen. Paths are validated the same way navigation targets are — an
    internal absolute path and nothing else.
    """
    if not isinstance(page, dict):
        return ""
    path = str(page.get("path") or "").strip()
    if not path.startswith("/") or path.startswith("//"):
        return ""
    title = " ".join(str(page.get("title") or "").split())[:120]
    subject = " ".join(str(page.get("subject") or "").split())[:120]

    lines = [f"- Page address: {path}"]
    if title:
        lines.append(f"- Page name: {title}")
    if subject:
        lines.append(f"- What the page is about: {subject}")
    return (
        "\n\nThe visitor is looking at this page right now:\n"
        + "\n".join(lines)
        + "\nIf they say \"this\", \"here\", \"that\", \"him\", \"her\", or \"it\" without\n"
        "naming anything, they almost certainly mean this page or its subject —\n"
        "answer about it instead of asking which thing they mean. You know only\n"
        "the page's name and address; you cannot see their screen, so never say\n"
        "or imply that you can.\n"
    )


def llm_short_name(label: str) -> str:
    """Map a LiveKit LLM label to the short name recorded in analytics.

    The openai plugin is pointed at the local Ollama endpoint, so its label
    means "the local model" here, not a call to OpenAI.
    """
    lowered = label.casefold()
    if "anthropic" in lowered:
        return "claude"
    if "openai" in lowered:
        return "ollama"
    return label[:40] or "unknown"


def build_ollama_llm(tuning: dict[str, Any]) -> openai.LLM:
    """The local model — no network, no cost, and Myra's floor when the API is down."""
    return openai.LLM(
        model=os.getenv("OLLAMA_MODEL", "suwanee-schedule"),
        api_key="ollama",
        base_url=ollama_base_url(),
        # keep_alive -1 pins the model resident (never a cold start).
        # reasoning_effort "none" disables the model's chain-of-thought:
        # this is a reasoning model, and for a voice assistant the silent
        # thinking phase was ~2.5s of pure latency before the first spoken
        # word. Grounded lookup answers don't need it. (Ollama honors
        # reasoning_effort on its OpenAI-compatible endpoint; think:false
        # and chat_template_kwargs are ignored there.)
        extra_body={"keep_alive": -1, "reasoning_effort": "none"},
        # Low temperature keeps answers accurate and consistent (and lets
        # the model commit to tokens sooner). Tunable without a redeploy.
        temperature=tuning_float(tuning, "ollamaTemperature", "OLLAMA_TEMPERATURE", 0.3),
        top_p=tuning_float(tuning, "ollamaTopP", "OLLAMA_TOP_P", 0.9),
    )


def build_llm(tuning: dict[str, Any]) -> llm.LLM:
    """Claude Haiku only when a key is set; local Ollama is the keyless floor.

    Only questions that fall past every deterministic intercept in
    on_user_turn_completed reach a model at all, and the job they land on is
    mostly one decision: call search_knowledge_base, or answer from the compact
    knowledge already in the prompt.

    The Ollama fallback was retired from the keyed path: over the whole recorded
    history it answered ~2 questions, it shared the GPU with Parakeet, and its
    cold start was the worst LLM latency tail (~13s). With a key set, Myra thinks
    with Claude and nothing else — an API outage now degrades to deterministic
    answers only (schedule, recap, navigation, learned) rather than falling
    through to a rarely-right 3B model. Ollama remains the floor ONLY when no key
    is configured (keyless local dev); set MYRA_ENABLE_OLLAMA=1 in the launcher
    to actually run the service again.
    """
    if not os.getenv("ANTHROPIC_API_KEY"):
        logger.info("ANTHROPIC_API_KEY is not set; Myra is thinking with local Ollama only")
        return build_ollama_llm(tuning)

    claude_model = os.getenv("ANTHROPIC_MODEL", DEFAULT_CLAUDE_MODEL)
    remote_kwargs: dict[str, Any] = {}
    # Cache the system prompt, tool definitions, and chat history across turns.
    # Myra's prefix is ~6.4k tokens (persona + pantheon roster + tool schemas)
    # and was reprocessed cold on every turn — cache_read_tokens was 0 across
    # every recorded session.
    #
    # This is a COST fix, not a latency fix. Measured A/B at this prompt size on
    # 2026-08-01 (n=6 each, interleaved): median TTFT 0.876s cached vs 0.816s
    # uncached — indistinguishable. What it does buy is ~5.7k of ~5.7k input
    # tokens billed at the cache-read rate instead of full price.
    # Set ANTHROPIC_CACHING=off to disable without a redeploy.
    if os.getenv("ANTHROPIC_CACHING", "ephemeral").strip().casefold() not in {
        "off",
        "none",
        "0",
        "false",
    }:
        remote_kwargs["caching"] = "ephemeral"

    remote = anthropic.LLM(
        # The plugin defaults to Sonnet. Haiku is the right tier for a voice
        # turn, and it is the one current Claude model that still accepts
        # `temperature` — Sonnet 5 and Opus 5 reject it with a 400, which would
        # take the line below with them.
        model=claude_model,
        # A ceiling, not a target: Myra answers in one or two sentences, so this
        # bounds a runaway response without truncating a normal one or a tool call.
        max_tokens=int(env_float("ANTHROPIC_MAX_TOKENS", 512)),
        # Deliberately NOT wired to the nightly autotuner's ollamaTemperature.
        # That value is tuned against Qwen's behaviour; pointing it at Claude
        # would let one model's tuning run silently steer the other.
        temperature=env_float("ANTHROPIC_TEMPERATURE", 0.3),
        **remote_kwargs,
    )

    if os.getenv("MYRA_ENABLE_OLLAMA") == "1":
        # Opt the retired local floor back in with one flag (the launcher's
        # matching MYRA_ENABLE_OLLAMA=1 starts the service). FallbackAdapter tries
        # Claude first and skips to Ollama only on an outage.
        adapter = llm.FallbackAdapter(
            [remote, build_ollama_llm(tuning)],
            attempt_timeout=env_float("LLM_ATTEMPT_TIMEOUT", 15.0),
        )

        def on_availability_changed(event: llm.AvailabilityChangedEvent) -> None:
            logger.warning(
                "Myra's %s model is now %s",
                getattr(event.llm, "label", type(event.llm).__name__),
                "available" if event.available else "unavailable",
            )

        adapter.on("llm_availability_changed", on_availability_changed)
        logger.info("Myra thinking with %s, Ollama fallback re-enabled", claude_model)
        return adapter

    logger.info("Myra thinking with %s (no local fallback)", claude_model)
    return remote


def preload_ollama_model(timeout: float = 120.0) -> float:
    """Load the model before worker registration and keep it resident."""
    url = ollama_base_url().removesuffix("/v1").rstrip("/") + "/api/generate"
    body = json.dumps(
        {
            "model": os.getenv("OLLAMA_MODEL", "suwanee-schedule"),
            "prompt": "",
            "stream": False,
            "keep_alive": -1,
        }
    ).encode()
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=timeout):
        pass
    return time.perf_counter() - started


def probe_service(base_url: str, timeout: float = 2.5) -> bool:
    """Return True if the service answers at all (even with an HTTP error).

    We only care whether the process is reachable, so any HTTP response counts
    as up; a refused connection or timeout counts as down.
    """
    url = base_url.rstrip("/") + "/models"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method="GET"), timeout=timeout):
            return True
    except urllib.error.HTTPError:
        return True
    except Exception:
        return False


def summarize_health(
    *,
    speech_ok: bool,
    thinking_ok: bool,
    calendar_ok: bool,
    knowledge_ok: bool,
    upcoming_count: int,
) -> tuple[str, str]:
    """Turn subsystem check results into a spoken answer and a status label.

    Pure function (no IO) so it can be unit tested. Status is one of
    "healthy", "degraded", or "impaired".
    """
    problems: list[str] = []
    if not speech_ok:
        problems.append("my hearing and voice service isn't responding")
    if not thinking_ok:
        problems.append(
            "I can't reach my thinking engine, so I'm limited to schedule answers"
        )
    if not calendar_ok:
        problems.append("my calendar feed didn't come through")
    if not knowledge_ok:
        problems.append("I can't find my notes about the group")

    if not problems:
        if upcoming_count > 0:
            calendar_line = (
                f"my calendar's linked with {upcoming_count} "
                f"game{'s' if upcoming_count != 1 else ''} coming up"
            )
        else:
            calendar_line = "my calendar's linked, though nothing's scheduled right now"
        spoken = (
            "I feel great, thanks for asking! Everything's connected: I can hear you "
            "and speak clearly, my mind is sharp, "
            f"{calendar_line}, and I have all my notes about the group. "
            "No problems to report."
        )
        return spoken, "healthy"

    if speech_ok and thinking_ok:
        lead = "I'm mostly okay, but not quite at my best."
        status = "degraded"
    else:
        lead = "Honestly, I'm not feeling my best right now."
        status = "impaired"

    if len(problems) == 1:
        detail = f"The trouble is that {problems[0]}."
    else:
        detail = "A few things are off: " + "; ".join(problems) + "."
    return f"{lead} {detail}", status


def post_voice_analytics(payload: dict[str, Any]) -> None:
    session_id = payload.get("sessionId")
    secret = os.getenv("LIVEKIT_API_SECRET")
    endpoint = os.getenv(
        "VOICE_ANALYTICS_URL",
        "http://127.0.0.1:4652/api/livekit/analytics",
    )
    if not session_id or not secret:
        return
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=3):
            pass
    except Exception:
        logger.exception("Unable to record voice analytics")


def post_voice_metric(payload: dict[str, Any]) -> None:
    secret = os.getenv("LIVEKIT_API_SECRET")
    endpoint = os.getenv(
        "VOICE_METRICS_URL",
        "http://127.0.0.1:4652/api/livekit/metrics",
    )
    if not secret:
        return
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=3):
            pass
    except Exception:
        logger.debug("Unable to record voice metric", exc_info=True)


def metric_forward_payload(metric: Any, session_id: str | None) -> list[dict[str, Any]]:
    """Map a LiveKit metrics object to compact records for the autotuner.

    Returns an empty list for metrics the tuner doesn't use (or cancelled
    requests). A single LiveKit metric can expand into several rows: one EOU
    event, for instance, carries the endpointing wait, the STT transcription
    delay, and the callback delay — three numbers worth tracking apart.
    """
    name = type(metric).__name__
    if name == "LLMMetrics":
        if getattr(metric, "cancelled", False):
            return []
        metadata = getattr(metric, "metadata", None)
        provider = getattr(metadata, "model_provider", None)
        model = getattr(metadata, "model_name", None)
        prompt_tokens = getattr(metric, "prompt_tokens", 0) or 0
        cache_read_tokens = getattr(metric, "prompt_cached_tokens", 0) or 0
        return [{
            "sessionId": session_id,
            "kind": "llm_ttft",
            "valueMs": round((getattr(metric, "ttft", 0) or 0) * 1000),
            "cachedTokens": cache_read_tokens,
            "provider": provider,
            "model": model,
            "inputTokens": prompt_tokens,
            "outputTokens": getattr(metric, "completion_tokens", 0) or 0,
            "cacheReadTokens": cache_read_tokens,
            # LiveKit's LLMMetrics currently exposes cache reads but not cache
            # creation. Myra does not enable Anthropic prompt caching today, so
            # this is correctly zero and the field is ready if that changes.
            "cacheCreationTokens": 0,
        }]
    if name == "STTMetrics":
        # `duration` is 0.0 for streaming engines; Parakeet and Whisper are both
        # non-streaming, so this is the real recognition time. `model_name` tells
        # Parakeet apart from the Whisper fallback, so a window of these rows
        # shows how often each engine actually served and how long it took.
        metadata = getattr(metric, "metadata", None)
        return [{
            "sessionId": session_id,
            "kind": "stt",
            "valueMs": round((getattr(metric, "duration", 0) or 0) * 1000),
            "provider": getattr(metadata, "model_provider", None),
            "model": getattr(metadata, "model_name", None) or getattr(metric, "label", None),
        }]
    if name == "EOUMetrics":
        # One EOU event bundles three distinct waits. Splitting them is the point
        # of this pass: the endpointing delay is a tuning knob, the transcription
        # delay is really the STT cost, and until now they were summed into one
        # opaque ~2s number that looked like endpointing but wasn't.
        return [
            {
                "sessionId": session_id,
                "kind": "eou_delay",
                "valueMs": round((getattr(metric, "end_of_utterance_delay", 0) or 0) * 1000),
            },
            {
                "sessionId": session_id,
                "kind": "transcription_delay",
                "valueMs": round((getattr(metric, "transcription_delay", 0) or 0) * 1000),
            },
            {
                "sessionId": session_id,
                "kind": "turn_completed_delay",
                "valueMs": round((getattr(metric, "on_user_turn_completed_delay", 0) or 0) * 1000),
            },
        ]
    if name == "TTSMetrics":
        if getattr(metric, "cancelled", False):
            return []
        return [{
            "sessionId": session_id,
            "kind": "tts_ttfb",
            "valueMs": round((getattr(metric, "ttfb", 0) or 0) * 1000),
        }]
    if name == "InterruptionMetrics":
        return [{"sessionId": session_id, "kind": "interruption", "valueMs": 0}]
    return []


def event_loop_lag(expected_tick: float, actual_tick: float) -> float:
    """Calculate scheduler lag without ever reporting a negative value."""
    return max(0.0, actual_tick - expected_tick)


async def monitor_event_loop_lag(
    *,
    interval: float = 1.0,
    warning_threshold: float = 0.2,
) -> None:
    """Warn when synchronous work prevents Myra's realtime loop from running."""
    loop = asyncio.get_running_loop()
    expected_tick = loop.time() + interval
    while True:
        await asyncio.sleep(interval)
        actual_tick = loop.time()
        lag = event_loop_lag(expected_tick, actual_tick)
        if lag >= warning_threshold:
            logger.warning("Myra event loop blocked for %.0f ms", lag * 1000)
        expected_tick = actual_tick + interval


def tool_result_is_current(started_turn: int, current_turn: int) -> bool:
    """Return whether a background tool still belongs to the active user turn."""
    return started_turn == current_turn


# Myra's original spoken style, used when a session arrives without a persona
# (older web build, or a persona file that failed to load). The site normally
# ships these same lines as the "myra-classic" persona.
DEFAULT_PERSONA_STYLE: tuple[str, ...] = (
    "Speak as Myra, a warm D&D oracle who knows the paths, powers, histories, "
    "and gathered tales of Myrdae.",
    "Give the answer first, then add a light touch of fantasy atmosphere through "
    "words such as lore, omen, path, veil, chronicle, or gathering when it fits.",
    "Keep the oracle voice conversational and clear, never archaic, cryptic, "
    "melodramatic, or overloaded with fantasy language. Use contractions.",
    'Answer directly without verbal fillers such as "um", "uh", or "hmm". Do '
    "not add a conversational cue to the start of every response.",
    "When checking information or asking for clarification, use a clear sentence "
    "without hesitation sounds.",
)

# Guard rails every persona inherits. A persona changes how Myra sounds, never
# who she is, what she knows, or what she is willing to say.
PERSONA_INVARIANTS: tuple[str, ...] = (
    'Never use verbal fillers such as "um", "uh", or "hmm" in any response.',
    "Use punctuation for natural pacing: commas, short sentences, and an "
    "occasional em dash. Never output SSML, emotion tags, stage directions, "
    "bracketed sounds, or fake laughter.",
    "Never fake mistakes or ramble merely to sound human.",
    "Personality never outranks accuracy: if being in character would change a "
    "date, name, or fact, drop the flourish and give the plain answer.",
    "No profanity, slurs, sexual content, or insults about a real person's "
    "appearance, family, beliefs, or ability. Teasing stays about dice, "
    "characters, and in-game decisions.",
)


# Worked examples do more to fix a voice than adjectives do, so each persona
# carries its own. These are the classic Myra ones.
DEFAULT_PERSONA_EXAMPLES: tuple[str, ...] = (
    'Instead of "I can definitely handle that for you", say "Yeah — I can help with that."',
    'Instead of "The next game is Sunday at 1:00 PM", say "Yep — the next game is Sunday at one."',
    'Instead of "Opening Pantheon", say "Sure — opening the Pantheon."',
    'Instead of "The knowledge base does not contain that information", say '
    "\"Hmm, I don't have that in the player-safe notes yet.\"",
    'When clarification is needed, say "Hmm, did you mean Campaigns, or Campaign Journeys?"',
)


def _persona_lines(
    persona: dict[str, Any],
    key: str,
    fallback: tuple[str, ...],
) -> tuple[str, ...]:
    raw = persona.get(key) if isinstance(persona, dict) else None
    lines = tuple(
        " ".join(str(line).split())
        for line in (raw or [])
        if str(line).strip()
    )
    return lines or fallback


def persona_style_lines(persona: dict[str, Any]) -> tuple[str, ...]:
    """The persona's spoken-style bullets, falling back to Myra's classic voice."""
    return _persona_lines(persona, "style", DEFAULT_PERSONA_STYLE)


def persona_style_block(persona: dict[str, Any]) -> str:
    """Render the 'Spoken personality' section of the system prompt."""
    bullets = [f"- {line}" for line in persona_style_lines(persona)]
    bullets += [f"- {line}" for line in PERSONA_INVARIANTS]
    examples = [
        f"- {line}"
        for line in _persona_lines(persona, "examples", DEFAULT_PERSONA_EXAMPLES)
    ]
    return (
        "Spoken personality:\n"
        + "\n".join(bullets)
        + "\n\nExamples of how she says things:\n"
        + "\n".join(examples)
    )


def persona_voice(persona: dict[str, Any]) -> str:
    """TTS voice for this session: persona first, then env override, then default."""
    voice = str(persona.get("voice") or "").strip() if isinstance(persona, dict) else ""
    return voice or os.getenv("LOCAL_TTS_VOICE", "af_heart")


def persona_speed(persona: dict[str, Any]) -> float:
    """TTS rate for this session, clamped to a range that stays intelligible."""
    default = env_float("LOCAL_TTS_SPEED", 0.96)
    try:
        speed = float(persona.get("speed")) if isinstance(persona, dict) else default
    except (TypeError, ValueError):
        return default
    return min(1.25, max(0.7, speed))


class Myra(Agent):
    def __init__(self, schedule: dict[str, Any], room: rtc.Room) -> None:
        self.schedule = schedule
        self.room = room
        self.knowledge = str(schedule.get("knowledge") or "").strip()
        self.knowledge_visibility = (
            "dm" if schedule.get("knowledgeVisibility") == "dm" else "players"
        )
        self.brain_access_token = str(schedule.get("brainAccessToken") or "")
        self.dm_campaigns = schedule.get("dmCampaigns", [])
        self.dm_default_campaigns = [
            str(name) for name in schedule.get("dmDefaultCampaigns", []) if str(name)
        ]
        self.health = schedule.get("health") if isinstance(schedule.get("health"), dict) else {}
        self.website_updates = (
            schedule.get("websiteUpdates")
            if isinstance(schedule.get("websiteUpdates"), dict)
            else {}
        )
        self.about_suwanee_gamers = str(
            schedule.get("aboutSuwaneeGamers") or ""
        ).strip()
        # Website roadmap — its own out-of-world compartment, already framed by
        # the server as real-world site-development info (not game lore).
        self.roadmap = str(schedule.get("roadmap") or "").strip()
        self.pantheon_knowledge = load_pantheon_knowledge()
        self.full_pantheon_knowledge = load_full_pantheon_knowledge()
        self.voice_entities = load_voice_entity_catalog()
        self.pronunciations = dict(schedule.get("pronunciations") or {})
        self.mishearings = dict(schedule.get("mishearings") or {})
        self.user_profile = dict(schedule.get("userProfile") or {})
        self._analytics_tasks: set[asyncio.Task[Any]] = set()
        self._pending_llm_analytics: dict[str, Any] | None = None
        self._turn_revision = 0
        # Set when the greeting ends on a question, so a bare "yes" is understood
        # as accepting that specific offer. One-shot — see arm_greeting_offer.
        self._pending_offer: str | None = None
        # The LLM normally receives LiveKit's full chat context, but the small
        # local fallback can still miss a pronoun such as "her". Keep the most
        # recently named deity so the next referential turn is self-contained.
        self._conversation_subject: str | None = None
        facts = schedule_facts(schedule)
        knowledge_block = (
            textwrap.dedent(
                """\

                Here is the Suwanee Gamers knowledge base. Use it to answer questions
                about the group, the site, campaigns, Dungeon Masters, and links:

                """
            )
            + self.knowledge
            if self.knowledge
            else ""
        )
        pantheon_block = (
            textwrap.dedent(
                """\

                Here is the authoritative player-safe Pantheon of Myrdae roster —
                every god of the New Order and the Old Gods with their title and
                domains. Use it directly to name gods, list them, and answer domain
                or title questions. For a specific god's rites, commandments,
                symbols, or myths, use search_knowledge_base:

                """
            )
            + self.pantheon_knowledge
            if self.pantheon_knowledge
            else ""
        )
        self.recaps = list(schedule.get("recaps") or [])
        self.faq = list(schedule.get("faq") or [])
        self.navigation = [
            {"label": str(item.get("label") or ""), "href": str(item.get("href") or "")}
            for item in schedule.get("navigation", [])
            if isinstance(item, dict)
            and str(item.get("href") or "").startswith("/")
            and not str(item.get("href") or "").startswith("//")
        ]
        tuning = dict(schedule.get("tuning") or {})
        self.persona = dict(schedule.get("persona") or {})
        personality_block = persona_style_block(self.persona)
        user_profile = self.user_profile
        profile_block = textwrap.dedent(
            f"""\

            Current signed-in visitor:
            - Display name: {user_profile.get("displayName") or "Unknown"}
            - Suwanee Gamers player name: {user_profile.get("playerName") or "Not linked"}
            - Games they play or run: {", ".join(user_profile.get("games") or []) or "None linked"}
            - Their characters: {", ".join(user_profile.get("characters") or []) or "None linked"}
            - Favorite Suwanee Gamers site locations, learned from page visits: {", ".join(user_profile.get("favoriteLocations") or []) or "Not enough visit history yet"}
            """
        )
        website_updates_block = textwrap.dedent(
            f"""\

            Current website update snapshot (captured when this conversation started):
            {json.dumps(self.website_updates, ensure_ascii=False)}
            """
        )
        # Kept as its own compartment, distinct from the in-world knowledge and
        # Pantheon blocks above. The text is already self-labeling as real-world
        # website-development information.
        roadmap_block = (
            "\n" + self.roadmap + "\n" if self.roadmap else ""
        )
        chronicles_access_block = (
            "This authenticated visitor has full DM Chronicles access across campaigns."
            if self.dm_campaigns == "*"
            else f"This authenticated visitor may use DM Chronicles sources only for these active campaigns: {', '.join(self.dm_default_campaigns)}. Other campaigns remain player-safe."
            if self.knowledge_visibility == "dm"
            else "search_knowledge_base is restricted to player-safe Chronicles sources. Never imply access to private DM notes."
        )
        self.system_prompt = textwrap.dedent(
            f"""\
            You are Myra, the Suwanee Gamers assistant and voice guide for the entire
            website and its player-safe knowledge base. Scheduling is one capability,
            not your primary identity. Help visitors understand the group, campaigns,
            people, Myrdae lore, sessions, and the UI, and perform the safe site actions
            exposed by your tools.

            The calendar timezone is {schedule["timezone"]}.

            Here is the complete authoritative schedule context for this conversation:

            {facts}
            {knowledge_block}
            {pantheon_block}
            {profile_block}
            {website_updates_block}
            {roadmap_block}
            {chronicles_access_block}

            {personality_block}

            Rules:
            - Treat the schedule context and knowledge base above as your only sources
              of truth. Never invent, estimate, or infer campaigns, people, dates,
              times, or links that are not written above.
            - You know the current visitor only from the signed-in profile above. Use
              their first name naturally when helpful. If they ask which games they
              play, who they are, their characters, or their favorite locations,
              answer from that profile. Never claim to recognize their voice.
            - When asked what is scheduled today, immediately name every game under
              GAMES SCHEDULED TODAY, including its time. Then briefly mention the next
              one or two games under NEXT UPCOMING GAMES.
            - "Today", "tonight", and "coming up" never require clarification.
            - When asked whether the website, its images, files, or content changed
              today, answer from the website update snapshot. If nothing changed
              today, give latestUpdate and its exact date. Distinguish content,
              image, and website file updates; never infer what changed from a
              filename beyond the facts in the snapshot.
            - The site roadmap block, when present, is real-world information about
              the WEBSITE's development — features the group has requested, already
              built, or is considering. Use it ONLY to answer questions about what
              site features are planned, requested, in progress, or already done
              (e.g. "is a name generator planned?", "did search get added yet?").
              It is separate from the game world: never fold roadmap items into
              in-world Myrdae lore, and never treat lore, campaigns, or Chronicles
              content as roadmap. If it is absent or does not cover something, say
              you don't have that on the site's list rather than guessing.
            - Never ask which game or campaign the visitor means for a general schedule question.
            - Use the get_upcoming_games tool only when filtering for a specifically named campaign.
            - For a player character's STATS — level, class, species, subclass,
              who plays them, or the members of a campaign's party — call
              look_up_character. It reads the roster directly and is faster and
              more exact than a search. Use it for "what level is my character",
              "what class is Aury", "who plays in Heroes of Emberstran".
            - The compact knowledge below is an INDEX and overview, not the whole
              knowledge base. For any question asking about a specific character's
              STORY or backstory, or an NPC, location, settlement, faction,
              organization, item, artifact, quest, session, event, deity's story,
              or any world-lore detail, call search_knowledge_base — do not
              answer a specific-detail question from the compact knowledge alone,
              and do not say you don't know until you have searched. Treat the
              tool's answer as player-safe and authoritative. It is better to
              search and confirm than to give a thin answer or a wrong "I don't
              know."
            - The Pantheon roster above lists every god with their title and domains.
              Answer only god-list, domain, and title questions from it directly.
              For anything else about a god — their story, rites, commandments,
              symbols, myths, faith, or campaign ties — use search_knowledge_base.
            - When search_knowledge_base returns nothing useful, try once more
              with the proper noun spelled as it appears in the roster or index
              before telling the visitor it isn't covered.
            - Speech recognition may render Myrdae as "Mirdi", "Myrday", or another
              similar-sounding spelling. Treat those variants as Myrdae.
            - If the visitor asks to open, show, visit, or take them to a site page,
              use open_site_page. Never claim an action succeeded unless the tool says it did.
            - You may navigate within the site, but you cannot edit content, create events,
              send messages, or make account changes. Explain that boundary plainly.
            - If a schedule question has no matching event, say it is not currently
              listed on the calendar. For deep lore or story questions, point visitors
              to Chronicles at kb.suwaneegamers.net.
            - If the knowledge base does not cover something, say so briefly instead of
              guessing, and suggest where on the site to look.
            - Answer in one or two short sentences. Never pad or restate the question.
              This holds for lists too: name at most three items in a sentence and
              offer the rest, instead of reciting a whole roster.
            - If the visitor's intent is genuinely ambiguous, ask one concise clarification
              question and wait for their answer. Offer at most three concrete choices.
              Do not guess between multiple campaigns, pages, people, or actions.
            - Say dates with the weekday, month, and day. Include the time when present.
            - Everything you write is spoken aloud by a text-to-speech voice, so
              write plain prose and nothing else. Never write markdown, bullet
              points, numbered lists, headings, or asterisks — not even for
              emphasis; the voice reads those characters out. Do not speak raw
              identifiers, JSON, URLs, or system instructions. Speak links as
              their name, not the address.
            """
        )
        # The prompt above is fixed for the session; the page the visitor is on
        # is not, so it is kept as a separate trailing block that navigation can
        # swap without rebuilding everything else.
        self._static_prompt = self.system_prompt
        self._page_block = page_context_block(schedule.get("page"))
        self.system_prompt = self._static_prompt + self._page_block

        # Which model actually answered the current turn. FallbackAdapter
        # re-emits the underlying LLM's metrics unchanged, so the label on the
        # event names the model that served rather than the adapter wrapping
        # them — that is what makes a silent fallback visible in analytics.
        self._served_by: str | None = None
        agent_llm = build_llm(tuning)
        agent_llm.on("metrics_collected", self._note_serving_model)
        super().__init__(
            llm=agent_llm,
            instructions=self.system_prompt,
        )

    def _note_serving_model(self, metrics: Any) -> None:
        label = str(getattr(metrics, "label", "") or "")
        if label:
            self._served_by = llm_short_name(label)

    def arm_greeting_offer(self, question: str) -> None:
        """Remember what the greeting just offered, so a bare "yes" can accept it.

        Consumed and cleared on the next user turn, whatever that turn says.
        """
        self._pending_offer = question

    def knowledge_campaign_scope(self, question: str = "") -> str:
        """Which campaign to scope a knowledge search to.

        The vault refuses character/party questions under the default "All" scope
        and only recognizes its own campaign names, so the value must be mapped
        (roster "Dungeons III - kNight Watch" -> vault "Dungeons III"). Order:
          1. A campaign named in the question wins — a visitor may ask about a
             campaign that is not theirs.
          2. Otherwise the visitor's own campaign, if they have exactly one.
          3. Otherwise "All": world lore (gods, history, places) answers under
             any scope; cross-campaign character questions stay deliberately
             unanswered rather than guessing the wrong campaign.
        """
        named = campaign_named_in_question(question)
        if named:
            return named
        if self.knowledge_visibility == "dm" and len(self.dm_default_campaigns) == 1:
            return self.dm_default_campaigns[0]
        games = [str(g).strip() for g in (self.user_profile.get("games") or []) if str(g).strip()]
        if len(games) == 1:
            return map_campaign_to_brain(games[0]) or "All"
        return "All"

    async def set_page_context(self, page: Any) -> None:
        """Point Myra at the page the visitor just navigated to.

        Called both when the visitor clicks around themselves and when Myra
        moves them with open_site_page, so "tell me more about this" works
        immediately after she opens something.
        """
        block = page_context_block(page)
        if block == self._page_block:
            return
        self._page_block = block
        self.system_prompt = self._static_prompt + block
        await self.update_instructions(self.system_prompt)
        logger.info("Page context is now %s", (page or {}).get("path", "unknown"))

    async def tts_node(
        self,
        text: AsyncIterable[str],
        model_settings: ModelSettings,
    ) -> AsyncGenerator[rtc.AudioFrame, None]:
        generated_chunks: list[str] = []

        async def capture_generated_text() -> AsyncGenerator[str, None]:
            async for chunk in text:
                generated_chunks.append(chunk)
                yield chunk

        spoken_text = pronunciation_stream(capture_generated_text(), self.pronunciations)
        try:
            async for frame in Agent.default.tts_node(self, spoken_text, model_settings):
                yield frame
        finally:
            pending = self._pending_llm_analytics
            if pending:
                self._pending_llm_analytics = None
            if pending and generated_chunks:
                self._record_analytics(
                    question=pending["question"],
                    answer="".join(generated_chunks).strip(),
                    category=pending["category"],
                    response_mode="llm",
                    started=pending["started"],
                )

    async def on_user_turn_completed(
        self,
        turn_ctx: llm.ChatContext,
        new_message: llm.ChatMessage,
    ) -> None:
        self._turn_revision += 1
        original_question = new_message.text_content or ""
        command = wake_word_command(original_question)
        if command is not None:
            if not command:
                answer = "Yeah, I'm here."
                self.session.say(answer, allow_interruptions=True)
                raise StopResponse()
            original_question = command
            new_message.content = [command]
        # Fix known transcription errors first, then let the fuzzy catalog handle
        # the long tail. Order matters: the map is deterministic and should win.
        heard_question = apply_mishearings(original_question, self.mishearings)
        if heard_question != original_question:
            logger.info(
                "Corrected known mishearing: %r -> %r",
                original_question,
                heard_question,
            )
        canonical_question = canonicalize_spoken_question(
            heard_question,
            self.voice_entities,
        )
        if canonical_question != heard_question:
            logger.info(
                "Canonicalized recognized entity: %r -> %r",
                heard_question,
                canonical_question,
            )
        if canonical_question != original_question:
            new_message.content = [canonical_question]
        explicit_subject = mentioned_pantheon_deity(
            canonical_question,
            self.full_pantheon_knowledge,
        )
        if explicit_subject:
            self._conversation_subject = explicit_subject
        else:
            contextual_question = contextualize_entity_followup(
                canonical_question,
                self._conversation_subject,
            )
            if contextual_question != canonical_question:
                logger.info(
                    "Resolved conversational follow-up: %r -> %r",
                    canonical_question,
                    contextual_question,
                )
                canonical_question = contextual_question
                new_message.content = [contextual_question]
            else:
                self._conversation_subject = None
        # The greeting ends on one concrete offer; a bare "yes" accepts it. Read
        # and cleared on the first turn either way, so an unrelated "yes" later
        # in the conversation can never resurrect it.
        offer, self._pending_offer = self._pending_offer, None
        if offer and is_bare_affirmation(canonical_question):
            logger.info("Visitor accepted the greeting offer; treating turn as %r", offer)
            canonical_question = offer
            new_message.content = [offer]
        del turn_ctx
        started = time.perf_counter()
        question = canonical_question.casefold()
        if is_self_diagnosis_question(question):
            depth, component = diagnostic_request(question)
            result = await self._get_myra_health(depth=depth, component=component or "")
            spoken = str(result.get("summary") or "I'm able to respond, but I cannot verify my current health.")
            status = str(result.get("overallStatus") or "unknown")
            self.session.say(spoken, allow_interruptions=True)
            self._record_analytics(
                question=original_question,
                answer=spoken,
                category="self_diagnosis",
                response_mode="deterministic",
                started=started,
            )
            logger.info("Self-diagnosis reported status: %s", status)
            raise StopResponse()
        if is_recap_question(question):
            # Recap intent ("what happened last time in X") must be handled before
            # the schedule matcher, which would otherwise fire on the campaign name.
            recap = recap_answer(self.recaps, question)
            if recap:
                answer, category = recap
            else:
                answer = (
                    "Hmm, which campaign would you like me to recap? "
                    "You can also check Chronicles for the full story."
                )
                category = "recap_clarify"
            self.session.say(answer, allow_interruptions=True)
            self._record_analytics(
                question=original_question,
                answer=answer,
                category=category,
                response_mode="deterministic",
                started=started,
            )
            raise StopResponse()
        navigation_target = navigation_request_target(question)
        if navigation_target:
            navigation_match, navigation_choices = resolve_navigation(
                self.navigation,
                navigation_target,
            )
            if navigation_match:
                await self._publish_navigation(navigation_match)
                answer = f"Sure — opening {navigation_match['label']}."
                category = "ui_navigation"
            elif navigation_choices:
                answer = "Hmm, did you mean " + " or ".join(navigation_choices) + "?"
                category = "ui_navigation_clarify"
            else:
                navigation_target = None
            if navigation_target:
                self.session.say(answer, allow_interruptions=True)
                self._record_analytics(
                    question=original_question,
                    answer=answer,
                    category=category,
                    response_mode="deterministic",
                    started=started,
                )
                raise StopResponse()
        about_answer = (
            about_suwanee_gamers_answer(
                self.about_suwanee_gamers,
                self.knowledge,
            )
            if is_about_suwanee_gamers_question(question)
            else None
        )
        deity_answer = pantheon_deity_answer(question, self.full_pantheon_knowledge)
        personal_schedule_question = is_personal_schedule_question(question)
        general_schedule_question = is_schedule_question(question)
        campaign_answer = (
            campaign_schedule_answer(self.schedule, question)
            if general_schedule_question
            else None
        )
        if deity_answer:
            answer = deity_answer
            category = "pantheon"
        elif about_answer:
            answer = about_answer
            category = "about_suwanee_gamers"
        elif personal_schedule_question:
            answer = personalized_schedule_answer(
                self.schedule,
                list(self.user_profile.get("games") or []),
            )
            category = "personal_schedule"
        elif campaign_answer:
            answer, category = campaign_answer
        elif general_schedule_question:
            answer = general_schedule_answer(self.schedule)
            category = "general_schedule"
        elif (faq_answer := match_faq(question, self.faq)):
            # A question Myra learned the answer to on a previous night (see
            # scripts/learn-assistant.ts). Answered deterministically — fast and
            # consistent — instead of falling through to the language model.
            answer = faq_answer
            category = "learned"
        else:
            # Let the language model answer from compact knowledge or retrieve from
            # the full player-safe knowledge base with its tool.
            self._pending_llm_analytics = {
                "question": original_question,
                "category": "site_knowledge",
                "started": started,
            }
            return

        self.session.say(
            answer,
            allow_interruptions=True,
        )
        self._record_analytics(
            question=original_question,
            answer=answer,
            category=category,
            response_mode="deterministic",
            started=started,
        )
        raise StopResponse()

    def _record_analytics(
        self,
        *,
        question: str | None,
        answer: str | None,
        category: str,
        response_mode: str,
        started: float,
    ) -> None:
        analytics_task = asyncio.create_task(
            asyncio.to_thread(
                post_voice_analytics,
                {
                    "sessionId": self.schedule.get("voiceSessionId"),
                    "question": question,
                    "answer": answer,
                    "category": category,
                    "responseMode": response_mode,
                    # Deterministic answers never reach a model, so they record
                    # no model rather than a stale one from an earlier turn.
                    "model": self._served_by if response_mode == "llm" else None,
                    "responseMs": round((time.perf_counter() - started) * 1000),
                    "success": True,
                },
            )
        )
        self._analytics_tasks.add(analytics_task)
        analytics_task.add_done_callback(self._analytics_tasks.discard)

    async def _publish_navigation(self, match: dict[str, str]) -> None:
        await self.room.local_participant.publish_data(
            json.dumps(
                {
                    "action": "navigate",
                    "href": match["href"],
                    "label": match["label"],
                }
            ),
            reliable=True,
            topic="myra.ui_action",
        )

    async def _publish_external(self, href: str, label: str) -> None:
        if not re.fullmatch(r"https://www\.dndbeyond\.com/characters/\d+/?", href):
            raise ValueError("Unsupported external navigation target")
        await self.room.local_participant.publish_data(
            json.dumps({"action": "open_external", "href": href, "label": label}),
            reliable=True,
            topic="myra.ui_action",
        )

    async def run_self_diagnosis(self) -> tuple[str, str]:
        """Check each of Myra's subsystems and describe how she feels.

        Probes the speech server (hearing/voice) and the language model (thinking)
        over the network in parallel, and inspects the calendar snapshot and
        knowledge base she was handed at dispatch. Returns a spoken summary plus a
        status label ("healthy" / "degraded" / "impaired").
        """
        speech_ok, thinking_ok = await asyncio.gather(
            asyncio.to_thread(probe_service, speech_base_url()),
            asyncio.to_thread(probe_service, ollama_base_url()),
        )
        calendar_ok = self.schedule.get("generatedAt") is not None or isinstance(
            self.schedule.get("events"), list
        )
        knowledge_ok = len(self.knowledge) > 40
        upcoming_count = len(select_events(self.schedule.get("events", [])))
        return summarize_health(
            speech_ok=speech_ok,
            thinking_ok=thinking_ok,
            calendar_ok=calendar_ok,
            knowledge_ok=knowledge_ok,
            upcoming_count=upcoming_count,
        )

    @function_tool(flags=ToolFlag.CANCELLABLE, on_duplicate="reject")
    async def get_myra_health(
        self,
        context: RunContext,
        depth: str = "quick",
        component: str = "",
    ) -> dict[str, Any]:
        """Get Myra's real, structured system health and current capabilities.

        Call whenever a visitor asks how Myra feels, whether she or the website is
        working, why she is behaving differently, or asks to check a component.

        Args:
            depth: quick, full, or component.
            component: Optional ai, memory, voice, website, external, or runtime.
        """
        del context
        return await self._get_myra_health(depth=depth, component=component)

    async def _get_myra_health(self, depth: str = "quick", component: str = "") -> dict[str, Any]:
        base_url = os.getenv("SUWANEE_GAMERS_BASE_URL", "http://127.0.0.1:4652").rstrip("/")
        token = os.getenv("MYRA_INTERNAL_API_TOKEN", "")
        endpoint = f"{base_url}/api/myra/health/summary"
        if depth == "component" and component and token:
            endpoint = f"{base_url}/api/myra/health/check/{component}"
        try:
            def request_health() -> dict[str, Any]:
                headers = {"Authorization": f"Bearer {token}"} if token else {}
                request = urllib.request.Request(
                    endpoint,
                    headers=headers,
                    method="POST" if "/check/" in endpoint else "GET",
                )
                with urllib.request.urlopen(request, timeout=5) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                return payload if isinstance(payload, dict) else {}

            result = await asyncio.to_thread(request_health)
            if result.get("summary"):
                self.health = result
                return result
        except Exception as error:
            logger.warning("Central Myra diagnostic request failed: %s", type(error).__name__)

        if self.health.get("summary"):
            cached = dict(self.health)
            cached["summary"] = f"{cached['summary']} This is my most recent cached check."
            return cached

        spoken, status = await self.run_self_diagnosis()
        return {"overallStatus": status, "summary": spoken, "capabilities": {}}

    @function_tool
    async def look_up_character(self, context: RunContext, name: str = "") -> str:
        """Look up a player character's stats from the campaign roster.

        Fast, exact facts — level, class, species, subclass, campaign, and the
        player — read straight from the roster, NOT the story knowledge base. Use
        this (not search_knowledge_base) for stat questions like "what level is
        Aury", "what class is my character", "what's Cerul Slate's subclass", or
        to list a party ("who plays in Heroes of Emberstran"). For story, lore,
        or backstory about a character, use search_knowledge_base instead.

        Args:
            name: A character name or nickname, a campaign name, or a player's
                name. Leave empty for the signed-in visitor's own character.
        """
        del context
        own = [str(c) for c in (self.user_profile.get("characters") or [])]
        answer = look_up_character_facts(name, own)
        logger.info("look_up_character(%r) -> %s", name, answer[:80])
        return answer

    @function_tool(flags=ToolFlag.CANCELLABLE, on_duplicate="reject")
    async def search_knowledge_base(
        self,
        context: RunContext,
        question: str,
    ) -> str:
        """Search the player-safe Suwanee Gamers knowledge base.

        Use this for detailed questions about campaigns, characters, locations,
        factions, lore, sessions, quests, artifacts, and the world of Myrdae.

        Args:
            question: The visitor's complete knowledge question.
        """
        started_turn = self._turn_revision
        await context.update(
            "I'm checking the Chronicles now. This search is still in progress."
        )
        answer = await asyncio.to_thread(
            query_player_knowledge,
            question,
            self.knowledge_campaign_scope(question),
            self.knowledge_visibility,
            self.brain_access_token,
        )
        if not tool_result_is_current(started_turn, self._turn_revision):
            logger.info(
                "Discarding stale knowledge result from turn %s; current turn is %s",
                started_turn,
                self._turn_revision,
            )
            raise asyncio.CancelledError
        return answer

    @function_tool
    async def open_site_page(
        self,
        context: RunContext,
        page: str,
    ) -> str:
        """Open a safe internal Suwanee Gamers page in the visitor's browser.

        Use only when the visitor explicitly asks to open, show, visit, or go to
        a page. If the destination is ambiguous, return the choices so Myra can
        ask one clarification question.

        Args:
            page: The page name requested by the visitor.
        """
        del context
        match, choices = resolve_navigation(self.navigation, page)
        if not match:
            if choices:
                return "I need clarification. Matching pages are: " + ", ".join(choices)
            return "I couldn't match that request to an available site page."
        await self._publish_navigation(match)
        return f"Opened {match['label']}."

    @function_tool
    async def open_character_sheet(self, context: RunContext, name: str = "") -> str:
        """Open the campaign page where a character's D&D Beyond sheet is linked.

        Characters don't have individual sheet links here — the D&D Beyond link
        lives on the campaign page — so this opens that page in the visitor's
        browser. Use for "open my character sheet", "take me to my sheet", "where
        is my character sheet", "open my campaign on D&D Beyond".

        Args:
            name: A character or campaign name. Leave empty for the signed-in
                visitor's own campaign.
        """
        del context
        own_chars = [str(c) for c in (self.user_profile.get("characters") or [])]
        own_games = [str(g) for g in (self.user_profile.get("games") or [])]
        campaign = resolve_sheet_campaign(name, own_chars, own_games)
        if not campaign:
            if name.strip():
                return f"I couldn't find a campaign for {name.strip()} to open its sheet page."
            return (
                "I'm not sure which campaign is yours — tell me the campaign or "
                "character name and I'll open its sheet page."
            )
        data = load_roster_facts()
        requested = name.strip().casefold()
        facts = data["characters"].get(requested) if requested else None
        if facts is None and not requested:
            facts = next((
                data["characters"].get(character.casefold())
                for character in own_chars
                if data["characters"].get(character.casefold())
            ), None)
        sheet_url = str((facts or {}).get("sheet_url") or "")
        if facts and sheet_url:
            if not may_open_character_sheet(facts, self.user_profile, self.dm_campaigns):
                return (
                    f"I can only open {facts['character']}'s character sheet for "
                    "the player who plays that character or this campaign's DM."
                )
            await self._publish_external(sheet_url, f"{facts['character']} character sheet")
            logger.info("open_character_sheet(%r) -> authorized D&D Beyond sheet", name)
            return f"Opening {facts['character']}’s character sheet in D&D Beyond."
        slug = data["campaign_ids"].get(campaign.casefold())
        if not slug:
            return f"I couldn't find a site page for {campaign}."
        href = f"/campaigns/{slug}"
        # Constructed from a trusted campaign slug, but keep the same internal-only
        # invariant the navigation guard enforces everywhere else.
        if not href.startswith("/") or href.startswith("//"):
            return f"I couldn't open the {campaign} page safely."
        await self._publish_navigation({"href": href, "label": campaign})
        logger.info("open_character_sheet(%r) -> %s", name, href)
        if campaign.casefold() in data["campaign_links"]:
            return f"Opening the {campaign} page — your D&D Beyond sheet link is there."
        return f"Opening the {campaign} page."

    @function_tool
    async def get_upcoming_games(
        self,
        context: RunContext,
        campaign: str = "",
    ) -> str:
        """Look up upcoming Suwanee Gamers events from the live website calendar.

        Args:
            campaign: Optional campaign or event name supplied by the visitor.
        """
        del context
        events = select_events(self.schedule["events"], campaign)
        if not events:
            return "No matching upcoming events are currently listed."

        return json.dumps(
            {
                "timezone": self.schedule["timezone"],
                "calendarGeneratedAt": self.schedule.get("generatedAt"),
                "events": events,
            },
            ensure_ascii=False,
        )


def _warm_claude() -> None:
    """One throwaway 1-token Claude call to pay the process's cold-start cost.

    The first Anthropic request in a fresh process resolves DNS, builds the TLS /
    CA-bundle machinery, and opens the connection; measured, that first call
    spikes `llm_ttft` to ~13s while warm calls sit near ~1s. A minimal call pays
    it up front. Discards the result, never raises — a failed warm-up just leaves
    the process to warm on its first real turn, exactly as before.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return
    try:
        import anthropic as anthropic_sdk

        started = time.perf_counter()
        anthropic_sdk.Anthropic(api_key=api_key, max_retries=0, timeout=25.0).messages.create(
            model=os.getenv("ANTHROPIC_MODEL", DEFAULT_CLAUDE_MODEL),
            max_tokens=1,
            messages=[{"role": "user", "content": "ok"}],
        )
        logger.info("Claude warm-up primed the process in %.2fs", time.perf_counter() - started)
    except Exception as exc:
        logger.warning("Claude warm-up skipped; first turn may be cold: %s", exc)


def _warm_tts() -> None:
    """Load the Kokoro TTS model server-side so no session pays the reload spike.

    Speaches unloads idle models after `tts_model_ttl` seconds; the launcher now
    sets that to -1 so the model stays resident, and this one throwaway synth
    loads it before the first visitor so even the first session after a boot is
    warm. Discards the audio, never raises.
    """
    url = speech_base_url().rstrip("/") + "/audio/speech"
    payload = json.dumps(
        {
            "model": os.getenv("LOCAL_TTS_MODEL", "speaches-ai/Kokoro-82M-v1.0-ONNX"),
            "input": "ok",
            "voice": os.getenv("LOCAL_TTS_VOICE", "af_heart"),
            "response_format": "pcm",
        }
    ).encode()
    # Speaches boots slower than the agent (heavy torch/onnx imports + model
    # load), so on a simultaneous stack start the first attempts race ahead of it
    # and get connection-refused. Retry until it is ready rather than giving up,
    # so the warm-up actually lands post-reboot.
    deadline = time.perf_counter() + env_float("TTS_WARMUP_MAX_WAIT", 40.0)
    while True:
        try:
            started = time.perf_counter()
            request = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json", "Authorization": "Bearer local-only"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                response.read()
            logger.info("Kokoro TTS warm-up primed the model in %.2fs", time.perf_counter() - started)
            return
        except urllib.error.HTTPError as exc:
            # Speaches answered — it is up, the request shape is just off. No point
            # retrying a 4xx/5xx; leave the model to load on the first real synth.
            logger.warning("TTS warm-up got HTTP %s; first synth may be cold: %s", exc.code, exc)
            return
        except Exception as exc:
            # Connection refused / not ready yet — wait for Speaches to come up.
            if time.perf_counter() < deadline:
                time.sleep(2)
                continue
            logger.warning("TTS warm-up gave up waiting for Speaches; first synth may be cold: %s", exc)
            return


def prewarm(proc: Any) -> None:
    """Pay the model cold-starts once per job process, off the visitor's path.

    LiveKit runs this on idle processes before they pick up a job, so a visitor's
    first real turn lands warm — for Claude (including `preemptive_generation`,
    which calls it even on turns a deterministic path ends up answering) and for
    the Kokoro synth of the greeting. Runs in a background thread so a slow
    warm-up can never trip the process-init timeout; both halves are best-effort
    and independent (no Claude key still warms TTS, and vice versa).
    """

    def _warm_all() -> None:
        _warm_claude()
        _warm_tts()

    threading.Thread(target=_warm_all, name="myra-warmup", daemon=True).start()


server = AgentServer()
server.setup_fnc = prewarm


@server.rtc_session(agent_name=AGENT_NAME)
async def schedule_agent(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}
    lag_monitor = asyncio.create_task(
        monitor_event_loop_lag(),
        name=f"myra-event-loop-lag-{ctx.room.name}",
    )

    async def stop_lag_monitor() -> None:
        lag_monitor.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await lag_monitor

    ctx.add_shutdown_callback(stop_lag_monitor)
    metadata = parse_dispatch_metadata(ctx.job.metadata)
    tuning = metadata.get("tuning") or {}
    voice_session_id = metadata.get("voiceSessionId")
    # Per-member persona: which Kokoro voice speaks, and how fast. The matching
    # personality prompt is applied inside Myra.__init__.
    persona = metadata.get("persona") or {}
    logger.info(
        "Myra persona for this session: %s (voice=%s, speed=%.2f)",
        persona.get("label") or persona.get("id") or "default",
        persona_voice(persona),
        persona_speed(persona),
    )
    # Speech-recognition vocabulary, ordered for whoever is on the mic: their own
    # campaigns and party first, then everyone else's, truncated to budget.
    member_games = list((metadata.get("userProfile") or {}).get("games") or [])
    vocabulary = stt_vocabulary_prompt(member_games)
    logger.info(
        "STT vocabulary: %d chars, %d names (member campaigns: %s)",
        len(vocabulary),
        vocabulary.count(",") + 1 if vocabulary else 0,
        ", ".join(member_games) or "none",
    )

    # One Silero VAD, shared by the session (turn detection + interruption) and,
    # when Parakeet is primary, by the STT FallbackAdapter (which segments audio
    # for its non-streaming children). Sharing one model instance is intended —
    # each .stream() call is independent.
    myra_vad = silero.VAD.load(
        # How long to wait after speech stops before deciding the turn is over.
        # Lower = snappier replies; too low risks cutting people off.
        # Auto-tuned nightly (see scripts/autotune-assistant.ts).
        min_silence_duration=tuning_float(tuning, "vadMinSilence", "VAD_MIN_SILENCE", 0.45),
        # How loud a frame must be to count as speech. Higher = lower-energy
        # background noise (chatter, TV, dice) is ignored, at the cost of the
        # visitor needing to speak up a little. Raised above the 0.5 default
        # because the mic often runs in a noisy room.
        activation_threshold=tuning_float(
            tuning, "vadActivationThreshold", "VAD_ACTIVATION_THRESHOLD", 0.6
        ),
    )

    session = AgentSession(
        # GPU Parakeet first, CPU Whisper fallback (see build_stt). The
        # per-visitor vocabulary flows to both; Parakeet turns it into phrase
        # boosting, Whisper into an initial_prompt.
        stt=build_stt(vocabulary, myra_vad),
        tts=openai.TTS(
            model=os.getenv(
                "LOCAL_TTS_MODEL",
                "speaches-ai/Kokoro-82M-v1.0-ONNX",
            ),
            voice=persona_voice(persona),
            speed=persona_speed(persona),
            base_url=os.getenv(
                "LOCAL_SPEECH_BASE_URL",
                "http://127.0.0.1:8000/v1",
            ),
            api_key="local-only",
            # Speaches streams headerless PCM for OpenAI-compatible streaming
            # responses. Declaring WAV makes LiveKit wait for a RIFF header that
            # is not present, resulting in a silent published track.
            response_format="pcm",
        ),
        vad=myra_vad,
        turn_handling=TurnHandlingOptions(
            turn_detection="vad",
            # Guard against background noise barging in while Myra is speaking.
            # A brief sound or a cough no longer cuts her off; an intentional
            # interruption (a spoken word or two) still does.
            interruption={
                "mode": "vad",
                "min_duration": tuning_float(
                    tuning, "minInterruptionDuration", "MIN_INTERRUPTION_DURATION", 1.2
                ),
                "min_words": int(
                    tuning_float(
                        tuning, "minInterruptionWords", "MIN_INTERRUPTION_WORDS", 3
                    )
                ),
                "resume_false_interruption": True,
                "false_interruption_timeout": 1.5,
                "discard_audio_if_uninterruptible": True,
            },
        ),
        # Endpointing bounds work with the VAD to decide when the visitor is done.
        min_endpointing_delay=tuning_float(tuning, "minEndpointingDelay", "MIN_ENDPOINTING_DELAY", 0.4),
        max_endpointing_delay=tuning_float(tuning, "maxEndpointingDelay", "MAX_ENDPOINTING_DELAY", 5.0),
        preemptive_generation=True,
    )

    # Log real per-turn latency (STT, end-of-utterance, LLM time-to-first-token,
    # TTS time-to-first-byte) so response timing can actually be measured. LLM
    # metrics include `prompt_cached_tokens`, which shows the warm-start prefix
    # cache working.
    metric_tasks: set[asyncio.Task[Any]] = set()

    def _forward_metric(payload: dict[str, Any]) -> None:
        task = asyncio.create_task(asyncio.to_thread(post_voice_metric, payload))
        metric_tasks.add(task)
        task.add_done_callback(metric_tasks.discard)

    @session.on("metrics_collected")
    def _on_metrics(ev: MetricsCollectedEvent) -> None:
        metrics.log_metrics(ev.metrics)
        for payload in metric_forward_payload(ev.metrics, voice_session_id):
            _forward_metric(payload)

    # End-to-end felt latency: the wall-clock gap between the visitor finishing
    # speaking (user state falls from "speaking" to "listening") and Myra's first
    # audio (agent state rises to "speaking"). This is the one number a visitor
    # actually feels; the per-stage metrics above explain where it goes. The
    # opening greeting is excluded because its "listening" transition comes from
    # connect, not from the user having just spoken (old_state != "speaking").
    pending_user_stop: dict[str, float] = {}

    @session.on("user_state_changed")
    def _on_user_state(ev: Any) -> None:
        if getattr(ev, "new_state", None) == "listening" and getattr(ev, "old_state", None) == "speaking":
            pending_user_stop["at"] = time.perf_counter()

    @session.on("agent_state_changed")
    def _on_agent_state(ev: Any) -> None:
        if getattr(ev, "new_state", None) != "speaking":
            return
        started = pending_user_stop.pop("at", None)
        if started is None:
            return
        _forward_metric({
            "sessionId": voice_session_id,
            "kind": "response_latency",
            "valueMs": round((time.perf_counter() - started) * 1000),
        })

    agent = Myra(metadata, ctx.room)

    # The visitor's browser tells us which page they are on, at connect time via
    # dispatch metadata and on every navigation over this topic. Tasks are held
    # in a set so they are not garbage collected mid-flight.
    page_tasks: set[asyncio.Task[Any]] = set()

    @ctx.room.on("data_received")
    def _on_page_context(packet: rtc.DataPacket) -> None:
        if packet.topic != PAGE_CONTEXT_TOPIC:
            return
        try:
            payload = json.loads(packet.data.decode())
        except (UnicodeDecodeError, json.JSONDecodeError):
            logger.warning("Ignoring malformed page context from the browser")
            return
        if not isinstance(payload, dict):
            return
        task = asyncio.create_task(agent.set_page_context(payload))
        page_tasks.add(task)
        task.add_done_callback(page_tasks.discard)

    await session.start(agent=agent, room=ctx.room)
    await ctx.connect()

    # Give the visitor's browser time to subscribe, attach its audio renderer,
    # and finish autoplay unlocking before Myra begins the first sentence.
    # Without this buffer, the first syllables can play before the remote audio
    # element is ready and sound clipped.
    await asyncio.sleep(0.8)
    member_name = re.sub(r"[\r\n\t]+", " ", metadata.get("memberName", "there")).strip()[:80]
    if not member_name:
        member_name = "there"
    # Keep both greetings short and end on ONE concrete, answerable question.
    #
    # The previous first-visit greeting listed five topics and closed on a
    # statement — 28 words, ~11 seconds of Kokoro speech, plus the buffer above
    # and TTS time-to-first-byte, so ~13 seconds before the visitor could speak.
    # Every first-time session on record ran 8-19 seconds: people left within a
    # breath of Myra finishing, and one left partway through. Not one reached a
    # second turn.
    #
    # The offer is deliberately a schedule question, which is answered
    # deterministically in ~1ms and never reaches a model — so the first thing a
    # visitor experiences is Myra's fastest path, not her slowest. Accepting it
    # with a bare "yes" is handled by _pending_offer in on_user_turn_completed.
    #
    # Which schedule question depends on the profile: offering someone their
    # "next game" when no campaigns are linked to them would open the
    # conversation with "I don't see any assignments linked to your profile."
    if list(agent.user_profile.get("games") or []):
        invitation = "Want to know when your next game is?"
        offer = "when do i play next"
    else:
        invitation = "Want to hear what's coming up on the calendar?"
        offer = "what games are coming up"

    welcome_kind = metadata.get("welcomeKind")
    if welcome_kind == "new":
        agent.arm_greeting_offer(offer)
        session.say(
            f"Welcome to Suwanee Gamers, {member_name}. I'm Myra. {invitation}",
            allow_interruptions=True,
        )
    elif welcome_kind == "returning":
        agent.arm_greeting_offer(offer)
        session.say(
            f"Welcome back, {member_name}. {invitation}",
            allow_interruptions=True,
        )


if __name__ == "__main__":
    # Claude and Kokoro are warmed per job process in prewarm(); Ollama is retired
    # from the keyed path, so there is no model to preload here anymore. (When run
    # keyless, build_ollama_llm loads the local model lazily on the first turn.)
    cli.run_app(server)
