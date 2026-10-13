"""Hermetic test environment.

The worker loads the developer's .env.local at import time, which can carry a
real CLAUDE_CODE_OAUTH_TOKEN. Tests must not pick the subscription path (and its
live credential) by accident, so every test starts on the API-key path with no
token. Tests that exercise the subscription logic set the variables themselves.
"""

import pytest


@pytest.fixture(autouse=True)
def _hermetic_claude_auth(monkeypatch):
    monkeypatch.setenv("LLM_AUTH", "api")
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(__import__("tempfile").gettempdir() + "/no-claude-config"))
