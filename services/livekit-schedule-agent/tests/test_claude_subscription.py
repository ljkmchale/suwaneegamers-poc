"""The subscription LLM adapter, against a fake Claude Agent SDK client.

The fake reproduces the parts of the real CLI the adapter depends on: partial
stream events, in-process MCP tool calls that block until a result arrives, an
interrupt that ends the response, and error results. No network, no login.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import time
from typing import Any, ClassVar

import pytest
from claude_agent_sdk import AssistantMessage, ResultMessage, StreamEvent
from livekit.agents import APIStatusError, function_tool, llm
from livekit.agents.types import APIConnectOptions

from schedule_agent import claude_subscription as cs
from schedule_agent.claude_subscription import ClaudeSubscriptionLLM

STABLE = "You are Myra.\n\n" + "\n".join(f"Stable rule {i}: be accurate." for i in range(60))
SYSTEM = f"{STABLE}\n\nWhere the visitor is: /home"


def result(*, error: bool = False, text: str = "", status: int | None = None) -> ResultMessage:
    return ResultMessage(
        subtype="success",
        duration_ms=1,
        duration_api_ms=1,
        is_error=error,
        num_turns=1,
        session_id="s",
        usage={"input_tokens": 10, "output_tokens": 5, "cache_read_input_tokens": 3},
        result=text,
        api_error_status=status,
    )


def text_event(text: str) -> StreamEvent:
    return StreamEvent(
        uuid="u",
        session_id="s",
        event={"type": "content_block_delta", "delta": {"type": "text_delta", "text": text}},
    )


def tool_start() -> StreamEvent:
    return StreamEvent(
        uuid="u",
        session_id="s",
        event={"type": "content_block_start", "content_block": {"type": "tool_use"}},
    )


class FakeClient:
    """Scripted stand-in for ClaudeSDKClient. `script` is a list of turn
    scripts; each is a list of ("text", s) | ("tool", name, args) |
    ("error", s) | ("hang",) steps, ending implicitly in a ResultMessage."""

    instances: ClassVar[list[FakeClient]] = []

    def __init__(self, options: Any, bridge: cs.ToolBridge, script: list[list[tuple]]) -> None:
        self.options = options
        self.bridge = bridge
        self.script = script
        self.prompts: list[str] = []
        self.connected = False
        self.disconnected = False
        self.interrupts = 0
        self.tool_results: list[str] = []
        self._turn: list[tuple] = []
        self._interrupted = asyncio.Event()
        FakeClient.instances.append(self)

    async def connect(self) -> None:
        self.connected = True

    async def query(self, prompt: str) -> None:
        self.prompts.append(prompt)
        self._turn = self.script.pop(0)
        self._interrupted = asyncio.Event()

    async def interrupt(self) -> None:
        self.interrupts += 1
        self._interrupted.set()

    async def disconnect(self) -> None:
        self.disconnected = True

    def receive_response(self):
        return self._stream()

    async def _stream(self):
        for step in self._turn:
            kind = step[0]
            if kind == "text":
                yield text_event(step[1])
                await asyncio.sleep(0)
            elif kind == "tool":
                yield tool_start()
                # The CLI invokes the in-process handler; it blocks until LiveKit
                # has run the tool and the output comes back.
                self.tool_results.append(await self.bridge.invoke(step[1], step[2]))
            elif kind == "error":
                yield AssistantMessage(
                    content=[], model="m", error="authentication_failed"
                )
                yield result(error=True, text=step[1], status=401)
                return
            elif kind == "hang":
                with contextlib.suppress(asyncio.TimeoutError):
                    await asyncio.wait_for(self._interrupted.wait(), 5)
                yield result(text="interrupted")
                return
        yield result()


def make_llm(script: list[list[tuple]], **kwargs: Any) -> ClaudeSubscriptionLLM:
    FakeClient.instances.clear()

    def factory(options: Any, bridge: cs.ToolBridge) -> FakeClient:
        # Each (re)connect consumes the *same* script list, like one conversation.
        return FakeClient(options, bridge, script)

    return ClaudeSubscriptionLLM(
        model="claude-haiku-4-5", client_factory=factory, prompt_suffix="Tools are mcp__voice__*.", **kwargs
    )


def ctx(*messages: tuple[str, str], system: str = SYSTEM) -> llm.ChatContext:
    chat = llm.ChatContext()
    chat.add_message(role="system", content=system)
    for role, content in messages:
        chat.add_message(role=role, content=content)  # type: ignore[arg-type]
    return chat


async def drain(stream: llm.LLMStream) -> tuple[str, list[llm.FunctionToolCall], llm.CompletionUsage | None]:
    text, calls, usage = "", [], None
    async for chunk in stream:
        if chunk.delta:
            text += chunk.delta.content or ""
            calls.extend(chunk.delta.tool_calls)
        if chunk.usage:
            usage = chunk.usage
    await stream.aclose()
    return text, calls, usage


def opts(timeout: float = 5.0) -> APIConnectOptions:
    return APIConnectOptions(timeout=timeout, max_retry=0)


@function_tool
async def lookup_thing(topic: str) -> str:
    """Look something up.

    Args:
        topic: what to look up
    """
    return topic


@pytest.mark.asyncio
async def test_plain_turn_streams_text_and_usage():
    adapter = make_llm([[("text", "Hello"), ("text", " there.")]])
    text, calls, usage = await drain(
        adapter.chat(chat_ctx=ctx(("user", "hi")), conn_options=opts())
    )
    assert text == "Hello there."
    assert calls == []
    assert usage is not None and usage.completion_tokens == 5 and usage.prompt_tokens == 13
    client = FakeClient.instances[0]
    assert client.prompts == ["hi"]
    assert client.options.system_prompt == SYSTEM  # no tools -> suffix not appended


@pytest.mark.asyncio
async def test_builtin_tools_are_disabled_and_cli_env_is_clean():
    adapter = make_llm([[("text", "ok")]])
    await drain(
        adapter.chat(chat_ctx=ctx(("user", "hi")), tools=[lookup_thing], conn_options=opts())
    )
    options = FakeClient.instances[0].options
    assert options.tools == []
    assert options.setting_sources == []
    assert options.strict_mcp_config is True
    assert "Bash" in options.disallowed_tools
    assert options.allowed_tools == ["mcp__voice__lookup_thing"]
    assert options.system_prompt.endswith("Tools are mcp__voice__*.")
    for name in ("ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN"):
        assert options.env[name] == ""


@pytest.mark.asyncio
async def test_second_turn_sends_only_the_new_message_on_the_same_session():
    adapter = make_llm([[("text", "First answer.")], [("text", "Second answer.")]])
    first = ctx(("user", "one"))
    await drain(adapter.chat(chat_ctx=first, conn_options=opts()))

    second = ctx(("user", "one"), ("assistant", "First answer."), ("user", "two"))
    # Re-use the same item ids the first context produced, as LiveKit does.
    second.items[1].id = first.items[1].id
    text, _, _ = await drain(adapter.chat(chat_ctx=second, conn_options=opts()))

    assert text == "Second answer."
    assert len(FakeClient.instances) == 1
    assert FakeClient.instances[0].prompts == ["one", "two"]


@pytest.mark.asyncio
async def test_deterministic_assistant_turns_reach_the_model_as_notes():
    adapter = make_llm([[("text", "Sure.")], [("text", "Yes.")]])
    first = ctx(("user", "hello"))
    await drain(adapter.chat(chat_ctx=first, conn_options=opts()))

    second = ctx(
        ("user", "hello"),
        ("assistant", "Sure."),  # the model's own reply: must not be echoed back
        ("user", "when do we play?"),
        ("assistant", "Friday at 7 PM."),  # said by a deterministic handler
        ("user", "and after that?"),
    )
    second.items[1].id = first.items[1].id
    await drain(adapter.chat(chat_ctx=second, conn_options=opts()))

    prompt = FakeClient.instances[0].prompts[1]
    assert "(You said earlier: Friday at 7 PM.)" in prompt
    assert "Sure." not in prompt
    assert "when do we play?" in prompt and prompt.rstrip().endswith("and after that?")


@pytest.mark.asyncio
async def test_tool_call_round_trip_through_livekit():
    script = [[("text", "Let me check. "), ("tool", "lookup_thing", {"topic": "dragons"}), ("text", "Dragons are big.")]]
    adapter = make_llm(script)
    first = ctx(("user", "tell me about dragons"))

    text1, calls, usage1 = await drain(
        adapter.chat(chat_ctx=first, tools=[lookup_thing], conn_options=opts())
    )
    assert text1 == "Let me check. "
    assert len(calls) == 1 and calls[0].name == "lookup_thing"
    assert json.loads(calls[0].arguments) == {"topic": "dragons"}
    assert usage1 is None  # a tool-call step ends without a usage chunk

    # LiveKit ran the tool and calls back with the output in the context.
    second = ctx(("user", "tell me about dragons"))
    second.items[1].id = first.items[1].id
    second.items.append(
        llm.FunctionCall(call_id=calls[0].call_id, name="lookup_thing", arguments=calls[0].arguments)
    )
    second.items.append(
        llm.FunctionCallOutput(
            call_id=calls[0].call_id, name="lookup_thing", output="Dragons: scaly.", is_error=False
        )
    )
    text2, calls2, usage2 = await drain(
        adapter.chat(chat_ctx=second, tools=[lookup_thing], conn_options=opts())
    )

    assert text2 == "Dragons are big."
    assert calls2 == []
    assert usage2 is not None
    client = FakeClient.instances[0]
    assert client.tool_results == ["Dragons: scaly."]
    assert len(client.prompts) == 1  # the continuation sent no new query


@pytest.mark.asyncio
async def test_page_context_change_is_patched_in_without_reconnecting():
    adapter = make_llm([[("text", "A.")], [("text", "B.")]])
    first = ctx(("user", "one"))
    await drain(adapter.chat(chat_ctx=first, conn_options=opts()))

    moved = ctx(
        ("user", "one"),
        ("assistant", "A."),
        ("user", "what is this page?"),
        system=SYSTEM.replace("/home", "/campaigns"),
    )
    moved.items[1].id = first.items[1].id
    await drain(adapter.chat(chat_ctx=moved, conn_options=opts()))

    assert len(FakeClient.instances) == 1
    prompt = FakeClient.instances[0].prompts[1]
    assert "Context update" in prompt and "/campaigns" in prompt


@pytest.mark.asyncio
async def test_large_instruction_change_rebuilds_with_replay():
    adapter = make_llm([[("text", "A.")], [("text", "B.")]])
    first = ctx(("user", "one"))
    await drain(adapter.chat(chat_ctx=first, conn_options=opts()))

    different = ctx(
        ("user", "one"), ("assistant", "A."), ("user", "two"), system="You are someone else entirely."
    )
    await drain(adapter.chat(chat_ctx=different, conn_options=opts()))

    assert len(FakeClient.instances) == 2
    assert FakeClient.instances[0].disconnected is True
    replay = FakeClient.instances[1].prompts[0]
    assert "Earlier in this conversation" in replay
    assert "You: A." in replay and replay.rstrip().endswith("two")


@pytest.mark.asyncio
async def test_cancelled_turn_is_interrupted_and_session_reused():
    adapter = make_llm([[("text", "partial "), ("hang",)], [("text", "Recovered.")]])
    first = ctx(("user", "slow question"))
    stream = adapter.chat(chat_ctx=first, conn_options=opts())
    got = ""
    async for chunk in stream:
        got += (chunk.delta.content or "") if chunk.delta else ""
        if got:
            break  # barge-in while the response is still streaming
    await stream.aclose()

    second = ctx(("user", "slow question"), ("user", "never mind, hello"))
    text, _, _ = await drain(adapter.chat(chat_ctx=second, conn_options=opts()))

    assert text == "Recovered."
    client = FakeClient.instances[0]
    assert client.interrupts == 1
    assert len(FakeClient.instances) == 1


@pytest.mark.asyncio
async def test_auth_failure_surfaces_as_a_non_retryable_401():
    adapter = make_llm([[("error", "Failed to authenticate. API Error: 401 OAuth token expired")]])
    stream = adapter.chat(chat_ctx=ctx(("user", "hi")), conn_options=opts())
    with pytest.raises(APIStatusError) as caught:
        await drain(stream)
    assert caught.value.status_code == 401
    assert caught.value.retryable is False


class _ApiLLM(llm.LLM):
    """Stands in for the API-key LLM in the fallback chain."""

    def __init__(self) -> None:
        super().__init__()
        self.calls = 0

    def chat(self, *, chat_ctx, tools=None, conn_options=None, **_: Any):
        self.calls += 1
        return _ApiStream(self, chat_ctx=chat_ctx, tools=tools or [], conn_options=conn_options)


class _ApiStream(llm.LLMStream):
    async def _run(self) -> None:
        self._event_ch.send_nowait(
            llm.ChatChunk(id="api", delta=llm.ChoiceDelta(role="assistant", content="from the API"))
        )


@pytest.mark.asyncio
async def test_fallback_adapter_serves_from_api_when_subscription_fails():
    sub = make_llm([[("error", "401 expired")]])
    api = _ApiLLM()
    chain = llm.FallbackAdapter([sub, api], attempt_timeout=5.0, max_retry_per_llm=0)
    text, _, _ = await drain(chain.chat(chat_ctx=ctx(("user", "hi")), conn_options=opts()))
    assert text == "from the API"
    assert api.calls == 1


@pytest.mark.asyncio
async def test_instructionless_ping_does_not_disturb_the_warm_session():
    adapter = make_llm([[("text", "Real.")], [("text", "OK")]])
    await drain(adapter.chat(chat_ctx=ctx(("user", "hi")), conn_options=opts()))
    warm = adapter._session

    ping = llm.ChatContext()
    ping.add_message(role="user", content="hello")
    await drain(adapter.chat(chat_ctx=ping, conn_options=opts()))

    assert adapter._session is warm and warm is not None and not warm.dead
    assert FakeClient.instances[0].disconnected is False


@pytest.mark.asyncio
async def test_timeout_before_first_token_is_reported_and_session_discarded():
    adapter = make_llm([[("hang",)]])
    started = time.monotonic()
    with pytest.raises(Exception) as caught:
        await drain(adapter.chat(chat_ctx=ctx(("user", "hi")), conn_options=opts(timeout=0.3)))
    assert "timed out" in str(caught.value).lower() or caught.type.__name__.startswith("API")
    assert time.monotonic() - started < 3
    assert adapter._session is not None and adapter._session.dead


def test_subscription_credential_detection(tmp_path, monkeypatch):
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(tmp_path))
    assert cs.subscription_credential() is None

    def write(oauth: dict[str, Any]) -> None:
        (tmp_path / ".credentials.json").write_text(json.dumps({"claudeAiOauth": oauth}))

    write({"accessToken": "x", "expiresAt": 1})  # expired, no refresh: dead login
    assert cs.subscription_credential() is None
    write({"accessToken": "x", "expiresAt": (time.time() + 3600) * 1000})
    assert cs.subscription_credential() == "login"
    write({"accessToken": "x", "refreshToken": "r", "expiresAt": 1})
    assert cs.subscription_credential() == "login"
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "tok")
    assert cs.subscription_credential() == "token"


def test_mode_switch_forces_api(monkeypatch):
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "tok")
    monkeypatch.setenv("LLM_AUTH", "api")
    enabled, why = cs.subscription_enabled()
    assert enabled is False and "api" in why.lower()
    monkeypatch.setenv("LLM_AUTH", "subscription")
    assert cs.subscription_enabled()[0] is True
