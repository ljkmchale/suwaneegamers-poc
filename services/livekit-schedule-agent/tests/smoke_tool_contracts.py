"""Verify Ollama returns structured calls for every tool exposed by Myra."""

import json
import os
import urllib.request

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search the player-safe Suwanee Gamers knowledge base.",
            "parameters": {
                "type": "object",
                "properties": {"question": {"type": "string"}},
                "required": ["question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_site_page",
            "description": "Open a safe internal Suwanee Gamers page.",
            "parameters": {
                "type": "object",
                "properties": {"page": {"type": "string"}},
                "required": ["page"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_upcoming_games",
            "description": "Look up upcoming games for a specifically named campaign.",
            "parameters": {
                "type": "object",
                "properties": {"campaign": {"type": "string"}},
            },
        },
    },
]

CASES = [
    ("Tell me about the rites of Addan.", "search_knowledge_base"),
    ("Take me to the Pantheon page.", "open_site_page"),
    ("When does Souls of Destiny play next?", "get_upcoming_games"),
]


def request_tool_call(prompt: str) -> dict:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1").rstrip("/")
    payload = json.dumps(
        {
            "model": os.getenv("OLLAMA_MODEL", "suwanee-schedule"),
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are Myra. Use the appropriate tool for the visitor's request. "
                        "Do not answer before calling the tool."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "tools": TOOLS,
            "keep_alive": -1,
            "reasoning_effort": "none",
        }
    ).encode()
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def main() -> None:
    for prompt, expected in CASES:
        response = request_tool_call(prompt)
        message = response["choices"][0]["message"]
        calls = message.get("tool_calls") or []
        if not calls:
            raise AssertionError(
                f"{expected}: Ollama returned text instead of a structured tool call: "
                f"{message.get('content')!r}"
            )
        actual = calls[0]["function"]["name"]
        if actual != expected:
            raise AssertionError(f"{prompt!r}: expected {expected}, received {actual}")
        json.loads(calls[0]["function"]["arguments"])
        print(f"PASS {expected}")


if __name__ == "__main__":
    main()
