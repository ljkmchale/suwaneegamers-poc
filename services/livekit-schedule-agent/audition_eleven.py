#!/usr/bin/env python3
"""Audition ElevenLabs voices against Myra's persona lineup.

Synthesizes each persona's OWN words (the "say this" half of its worked examples,
mirroring lib/assistantPersonas.ts previewLine) in a couple of candidate
ElevenLabs voices, so you can pick the winner by ear. Also writes
eleven-voices.json (persona-id -> voice_id) that agent.py reads when
MYRA_TTS=elevenlabs.

- Uses ElevenLabs Flash v2.5 (the low-latency model Myra would actually run).
- Reads ELEVEN_API_KEY from the service .env.local -- the key is never printed.
- Resolves voice ids from YOUR account (GET /v1/voices), so nothing is hardcoded.
- Stdlib only; no pip install needed.

Run (after adding ELEVEN_API_KEY to .env.local):
    python audition_eleven.py
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = SERVICE_ROOT.parents[1]
PERSONAS_JSON = REPO_ROOT / "content" / "assistant-personas.json"
OUT_DIR = SERVICE_ROOT / "eleven-audition"
VOICE_MAP_OUT = SERVICE_ROOT / "eleven-voices.json"
MODEL = os.getenv("ELEVEN_MODEL", "eleven_flash_v2_5")
API = "https://api.elevenlabs.io/v1"


def load_env_key() -> str:
    """ELEVEN_API_KEY from the environment, else parsed from .env.local. Never logged."""
    key = os.getenv("ELEVEN_API_KEY")
    if key:
        return key.strip()
    for env_file in (SERVICE_ROOT / ".env.local", REPO_ROOT / ".env.local"):
        if not env_file.exists():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("ELEVEN_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


# Candidate ElevenLabs voices per persona, by NAME (resolved to ids below against
# your account). Two each so you can compare; edit freely. All are standard
# premade voices available on the free tier.
CANDIDATES = {
    "myra-classic": ["Matilda", "Bella"],        # warm, grounded American female
    "british-cheeky": ["Lily", "Alice"],         # dry, characterful British female
    "spirited-warm": ["Laura", "Jessica"],       # bright, sassy American female
    "sassy-wit": ["Chris", "Will"],              # playful, casual American male
    "storyteller": ["George", "Sarah"],          # cozy narrator (British male / warm female)
    "deadpan-tactician": ["Alice", "Daniel"],    # crisp British (female / formal male)
}

DEFAULT_PREVIEW_LINE = (
    "Right, here's where things stand: the next game is Sunday at one, the party "
    "is still somewhere under the mountain, and I'll be here whenever you need "
    "directions."
)


def preview_line(persona: dict) -> str:
    """The 'say this' phrases from a persona's examples, joined -- as in previewLine()."""
    spoken = []
    for example in persona.get("examples", []):
        m = re.search(r'say "([^"]+)"', str(example))
        if m:
            spoken.append(m.group(1).strip())
    return " ".join(spoken) if spoken else DEFAULT_PREVIEW_LINE


def api_get(path: str, key: str) -> dict:
    req = urllib.request.Request(f"{API}{path}", headers={"xi-api-key": key})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def synth(text: str, voice_id: str, key: str, speed: float, out_path: Path) -> None:
    body = json.dumps({
        "text": text,
        "model_id": MODEL,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "speed": min(1.2, max(0.8, speed)),
        },
    }).encode()
    url = f"{API}/text-to-speech/{voice_id}?output_format=mp3_44100_128"
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"xi-api-key": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        out_path.write_bytes(r.read())


def main() -> int:
    key = load_env_key()
    if not key:
        print("ELEVEN_API_KEY not found. Add it to "
              f"{SERVICE_ROOT / '.env.local'} as ELEVEN_API_KEY=... then re-run.",
              file=sys.stderr)
        return 2

    catalog = json.loads(PERSONAS_JSON.read_text(encoding="utf-8"))
    personas = {p["id"]: p for p in catalog["personas"]}

    print("fetching your account's voices ...", flush=True)
    try:
        voices = api_get("/voices", key).get("voices", [])
    except urllib.error.HTTPError as e:
        print(f"GET /voices failed: HTTP {e.code} {e.read().decode(errors='ignore')[:200]}",
              file=sys.stderr)
        return 1
    # Account voices are named like "Sarah - Mature, Reassuring, Confident"; key
    # the lookup on the first-name token so bare candidate names ("Sarah") match.
    by_name = {v["name"].split(" - ")[0].strip().lower(): v["voice_id"] for v in voices}
    print(f"  {len(voices)} voices available; model = {MODEL}\n", flush=True)

    OUT_DIR.mkdir(exist_ok=True)
    chosen: dict[str, str] = {}
    total_chars = 0

    for pid, cand_names in CANDIDATES.items():
        persona = personas.get(pid)
        if not persona:
            print(f"[skip] persona {pid} not in assistant-personas.json")
            continue
        text = preview_line(persona)
        speed = float(persona.get("speed", 1.0))
        print(f"=== {persona.get('label', pid)}  (speed {speed}) ===")
        print(f'    "{text[:90]}{"..." if len(text) > 90 else ""}"')
        for name in cand_names:
            vid = by_name.get(name.strip().lower())
            if not vid:
                print(f"    [{name:9s}] not in your account -- skipped")
                continue
            out = OUT_DIR / f"{pid}__{name}.mp3"
            try:
                synth(text, vid, key, speed, out)
                total_chars += len(text)
                chosen.setdefault(pid, vid)  # first available candidate becomes the seed pick
                print(f"    [{name:9s}] {vid}  -> {out.name}")
            except urllib.error.HTTPError as e:
                print(f"    [{name:9s}] synth failed: HTTP {e.code} "
                      f"{e.read().decode(errors='ignore')[:160]}")
        print()

    # Seed map keyed by persona id (agent.py falls back to _default, then env).
    chosen["_default"] = chosen.get("myra-classic", next(iter(chosen.values()), ""))
    VOICE_MAP_OUT.write_text(json.dumps(chosen, indent=2) + "\n", encoding="utf-8")

    print(f"~{total_chars} characters synthesized "
          f"(~{round(total_chars * 0.5)} Flash credits).")
    print(f"MP3s: {OUT_DIR}")
    print(f"Seed voice map (edit to swap winners): {VOICE_MAP_OUT}")
    print("\nListen, then set the winning voice_id per persona in eleven-voices.json.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
