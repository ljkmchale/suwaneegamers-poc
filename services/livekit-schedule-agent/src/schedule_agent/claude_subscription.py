"""Claude through the owner's Claude subscription, exposed as a LiveKit LLM.

This follows the pattern of jaredrhod/backtalk: instead of calling the Messages
API with an API key, the worker drives the Claude Code CLI through the Claude
Agent SDK. The CLI authenticates with the subscription login (or a long-lived
``CLAUDE_CODE_OAUTH_TOKEN`` made by ``claude setup-token``), so the usage counts
against the plan and no per-token API bill accrues.

How it fits LiveKit
-------------------
LiveKit's voice loop expects an ``llm.LLM`` whose ``chat()`` is stateless: it is
handed the whole chat context each step, streams text, and *returns tool calls
for LiveKit to execute*. The SDK is the opposite: a long-lived stateful session
that runs its own tool loop. This adapter bridges the two:

* One warm ``ClaudeSDKClient`` per voice session (no per-turn process spawn).
  Each ``chat()`` sends only the items the SDK has not seen yet.
* LiveKit's function tools are offered to the model as in-process MCP tools.
  When the model calls one, the handler parks on a future, the stream emits a
  ``FunctionToolCall`` to LiveKit and ends, and LiveKit runs the tool (so its
  RunContext, cancellation, and metrics all behave normally). The next
  ``chat()`` carries the tool output; the future resolves and the SDK carries
  on, streaming the rest of the answer into the new stream.
* Claude Code's built-in tools (Bash, Edit, ...) are disabled outright. A
  member's spoken sentence must never be able to reach a shell.

If the subscription is unavailable (no login, expired, rate limited) the caller
wraps this in ``llm.FallbackAdapter`` with the API-key LLM, so a turn is never
lost to an auth problem.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import tempfile
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from livekit.agents import APIConnectionError, APIStatusError, APITimeoutError, llm
from livekit.agents.llm.tool_context import Tool
from livekit.agents.types import (
    DEFAULT_API_CONNECT_OPTIONS,
    NOT_GIVEN,
    APIConnectOptions,
    NotGivenOr,
)

logger = logging.getLogger("claude-subscription")

MCP_SERVER_NAME = "voice"
LABEL = "claude_code.subscription"

# Variables that would make the CLI bill an API account, or send the subscription
# token somewhere other than Anthropic. They are blanked in the CLI's environment
# (an empty value is "unset" to the CLI; verified with apiKeySource == "none").
_STRIP_FROM_CLI_ENV = (
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
)

# How long to wait for an interrupted response to drain before giving up on the
# session and building a fresh one.
_DRAIN_TIMEOUT = 4.0
# After one tool call arrives, how long to wait for siblings the same assistant
# message asked for (parallel tool use) when the stream gives no count.
_TOOL_BATCH_GRACE = 0.25
_MAX_EMITTED_MEMORY = 64


# --------------------------------------------------------------------------- #
# Credentials / mode
# --------------------------------------------------------------------------- #


def _neutral_cwd() -> str:
    """An empty directory for the CLI to run in, so no project CLAUDE.md,
    settings, or git context can leak into a voice session."""
    path = Path(tempfile.gettempdir()) / "claude-voice-cwd"
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


def subscription_mode() -> str:
    """``subscription`` (default) or ``api``, from ``LLM_AUTH`` / ``<X>_LLM_AUTH``."""
    return os.getenv("LLM_AUTH", "subscription").strip().lower() or "subscription"


def claude_config_dir() -> Path:
    configured = os.getenv("CLAUDE_CONFIG_DIR", "").strip()
    return Path(configured) if configured else Path.home() / ".claude"


def subscription_credential() -> str | None:
    """How the CLI could authenticate right now, without making a request.

    Returns ``"token"`` (CLAUDE_CODE_OAUTH_TOKEN set), ``"login"`` (a stored
    login that is unexpired or refreshable), or ``None``. Deliberately cheap and
    side-effect free: it only reads the credentials file, never prints it.
    """
    if os.getenv("CLAUDE_CODE_OAUTH_TOKEN", "").strip():
        return "token"
    try:
        raw = json.loads((claude_config_dir() / ".credentials.json").read_text("utf-8"))
        oauth = raw.get("claudeAiOauth") or {}
    except (OSError, ValueError, AttributeError):
        return None
    if oauth.get("refreshToken"):
        return "login"
    expires = oauth.get("expiresAt")
    if (
        oauth.get("accessToken")
        and isinstance(expires, (int, float))
        and expires / 1000.0 > time.time() + 60
    ):
        return "login"
    return None


def sdk_available() -> bool:
    try:
        import claude_agent_sdk  # noqa: F401
    except ImportError:
        return False
    return True


def subscription_enabled() -> tuple[bool, str]:
    """Whether the subscription path should be used, and why/why not."""
    mode = subscription_mode()
    if mode in {"api", "off", "false", "0"}:
        return False, "LLM_AUTH=api"
    if not sdk_available():
        return False, "claude-agent-sdk is not installed"
    credential = subscription_credential()
    if credential is None:
        return False, (
            "no subscription login found (run `claude auth login`, or "
            "`claude setup-token` and set CLAUDE_CODE_OAUTH_TOKEN)"
        )
    return True, f"subscription via {credential}"


def cli_environment(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = dict.fromkeys(_STRIP_FROM_CLI_ENV, "")
    if extra:
        env.update(extra)
    return env


# --------------------------------------------------------------------------- #
# Plan usage: read how much of the subscription window is spent, and back off
# --------------------------------------------------------------------------- #
#
# Everyone shares one plan, so exhausting it is the failure mode that subscription
# auth adds. The CLI answers a `get_usage` control request with the five-hour and
# weekly utilisation. That request is not part of the SDK's public surface (the
# same trade backtalk makes), so every failure is swallowed and the readout simply
# goes quiet: it must never cost a turn.

_USAGE_MAX_AGE = 15 * 60.0  # a reading older than this is ignored
_USAGE_MIN_INTERVAL = 45.0  # at most one get_usage round trip per this many seconds


@dataclass(frozen=True)
class PlanWindow:
    utilization: float  # percent of the window used, 0-100
    resets_at: str | None = None


@dataclass(frozen=True)
class PlanUsage:
    five_hour: PlanWindow | None
    seven_day: PlanWindow | None
    fetched_at: float

    @property
    def peak(self) -> float:
        values = [w.utilization for w in (self.five_hour, self.seven_day) if w is not None]
        return max(values) if values else 0.0


_USAGE: PlanUsage | None = None
_REJECTED_UNTIL = 0.0


def plan_usage() -> PlanUsage | None:
    """The latest reading, or None when there is none or it is stale."""
    if _USAGE is None or time.time() - _USAGE.fetched_at > _USAGE_MAX_AGE:
        return None
    return _USAGE


def _set_usage(usage: PlanUsage) -> None:
    global _USAGE
    _USAGE = usage


def reset_plan_state() -> None:
    """Forget readings and rejections (tests, and a manual operator reset)."""
    global _USAGE, _REJECTED_UNTIL
    _USAGE = None
    _REJECTED_UNTIL = 0.0


def _threshold(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, "") or default)
    except ValueError:
        return default


def plan_pressure(now: float | None = None) -> str:
    """``ok``, ``high`` (prefer the fast model) or ``critical`` (stop using the plan)."""
    now = time.time() if now is None else now
    if now < _REJECTED_UNTIL:
        return "critical"
    usage = plan_usage()
    if usage is None:
        return "ok"
    if usage.peak >= _threshold("CLAUDE_PLAN_FALLBACK_PCT", 95.0):
        return "critical"
    if usage.peak >= _threshold("CLAUDE_PLAN_DEGRADE_PCT", 80.0):
        return "high"
    return "ok"


def note_rate_limit_event(info: Any) -> None:
    """React to the CLI's rate-limit event: a rejection blocks until the reset."""
    global _REJECTED_UNTIL
    if getattr(info, "status", None) != "rejected":
        return
    resets = getattr(info, "resets_at", None)
    until = float(resets) if isinstance(resets, (int, float)) else time.time() + 300.0
    _REJECTED_UNTIL = max(_REJECTED_UNTIL, until)


def _parse_usage(raw: Any) -> PlanUsage | None:
    limits = (raw or {}).get("rate_limits") if isinstance(raw, dict) else None
    if not isinstance(limits, dict):
        return None

    def window(name: str) -> PlanWindow | None:
        item = limits.get(name)
        if not isinstance(item, dict):
            return None
        pct = item.get("utilization")
        if pct is None:
            pct = item.get("used_percentage")
        if not isinstance(pct, (int, float)):
            return None
        resets = item.get("resets_at")
        return PlanWindow(float(pct), str(resets) if resets else None)

    five, seven = window("five_hour"), window("seven_day")
    if five is None and seven is None:
        return None
    return PlanUsage(five_hour=five, seven_day=seven, fetched_at=time.time())


# --------------------------------------------------------------------------- #
# Tool bridge: SDK in-process MCP handlers <-> LiveKit function tools
# --------------------------------------------------------------------------- #


@dataclass
class _PendingCall:
    call_id: str
    name: str
    arguments: str
    future: asyncio.Future[str]


class ToolBridge:
    """Parks SDK tool handlers until LiveKit has run the tool."""

    def __init__(self) -> None:
        self.arrivals: asyncio.Queue[_PendingCall] = asyncio.Queue()
        self.pending: dict[str, _PendingCall] = {}

    async def invoke(self, name: str, arguments: dict[str, Any]) -> str:
        loop = asyncio.get_running_loop()
        call = _PendingCall(
            call_id=f"cc_{uuid.uuid4().hex[:16]}",
            name=name,
            arguments=json.dumps(arguments, ensure_ascii=False),
            future=loop.create_future(),
        )
        self.pending[call.call_id] = call
        self.arrivals.put_nowait(call)
        try:
            return await call.future
        finally:
            self.pending.pop(call.call_id, None)

    def resolve(self, call_id: str, output: str) -> bool:
        call = self.pending.get(call_id)
        if call is None or call.future.done():
            return False
        call.future.set_result(output)
        return True

    def cancel_all(self, reason: str) -> None:
        for call in list(self.pending.values()):
            if not call.future.done():
                call.future.set_result(reason)
        while not self.arrivals.empty():
            self.arrivals.get_nowait()


def _tool_schemas(tools: list[Tool]) -> list[dict[str, Any]]:
    """LiveKit function tools -> {name, description, input_schema} dicts."""
    if not tools:
        return []
    context = llm.ToolContext(tools)
    return [dict(schema) for schema in context.parse_function_tools("anthropic", strict=False)]


def _mcp_tool_name(name: str) -> str:
    return f"mcp__{MCP_SERVER_NAME}__{name}"


# --------------------------------------------------------------------------- #
# Chat-context helpers
# --------------------------------------------------------------------------- #


def _text_of(item: Any) -> str:
    getter = getattr(item, "text_content", None)
    text = getter if isinstance(getter, str) else None
    if text is None:
        parts = [c for c in (getattr(item, "content", None) or []) if isinstance(c, str)]
        text = "\n".join(parts)
    return (text or "").strip()


def _norm(text: str) -> str:
    return " ".join(text.split()).casefold()


def _split_ctx(chat_ctx: llm.ChatContext) -> tuple[str, list[Any]]:
    """(instructions, conversation items). Leading system/developer messages are
    the instructions; a system message later in the stream is an in-line note
    (``generate_reply(instructions=...)``) and stays in the item list."""
    instructions: list[str] = []
    rest: list[Any] = []
    started = False
    for item in chat_ctx.items:
        kind = getattr(item, "type", "")
        role = getattr(item, "role", "")
        if kind == "message" and role in {"system", "developer"} and not started:
            text = _text_of(item)
            if text:
                instructions.append(text)
            continue
        if kind in {"message", "function_call", "function_call_output"}:
            started = True
            rest.append(item)
    return "\n\n".join(instructions), rest


# --------------------------------------------------------------------------- #
# The session: one warm SDK client + the shadow state needed to feed it deltas
# --------------------------------------------------------------------------- #


ClientFactory = Callable[[Any, ToolBridge], Any]


@dataclass
class _Session:
    client: Any
    bridge: ToolBridge
    system_text: str
    tool_names: frozenset[str]
    seen_ids: set[str] = field(default_factory=set)
    emitted: list[str] = field(default_factory=list)
    # The in-flight response (None when idle). ``next_task`` is the outstanding
    # ``__anext__`` on it: it must survive across LiveKit steps, because
    # cancelling an async generator's __anext__ closes the generator.
    response: Any | None = None
    next_task: asyncio.Task[Any] | None = None
    awaiting: set[str] = field(default_factory=set)
    expected_tools: int = 0
    dead: bool = False
    model: str = ""

    def remember_emitted(self, text: str) -> None:
        text = _norm(text)
        if text:
            self.emitted.append(text)
            del self.emitted[:-_MAX_EMITTED_MEMORY]

    def was_emitted(self, text: str) -> bool:
        text = _norm(text)
        if not text:
            return True
        # An interrupted reply is stored truncated, so accept a prefix match.
        return any(e == text or e.startswith(text) for e in self.emitted)


class ClaudeSubscriptionLLM(llm.LLM):
    """A LiveKit LLM backed by the Claude Code subscription (Agent SDK)."""

    def __init__(
        self,
        *,
        model: str,
        effort: str | None = None,
        thinking: bool = False,
        prompt_suffix: str = "",
        max_turns: int = 8,
        cwd: str | None = None,
        speaker_label: str = "the user",
        client_factory: ClientFactory | None = None,
        fast_model: str | None = None,
        stop_at_critical: bool = False,
        on_usage: Callable[[PlanUsage], None] | None = None,
    ) -> None:
        super().__init__()
        self._label = LABEL
        self._model = model
        # Used instead of `model` while the plan is under pressure.
        self._fast_model = fast_model or os.getenv("CLAUDE_FAST_MODEL", "claude-haiku-4-5")
        # With an API-key fallback available, refuse (429) once the plan is
        # critical so the FallbackAdapter serves the turn from the API instead.
        self._stop_at_critical = stop_at_critical
        self._on_usage = on_usage
        self._last_usage_pull = 0.0
        self._background: set[asyncio.Task[None]] = set()
        self._effort = effort or None
        self._thinking = thinking
        self._suffix = prompt_suffix.strip()
        self._max_turns = max_turns
        self._cwd = cwd or _neutral_cwd()
        self._speaker = speaker_label
        self._client_factory = client_factory
        self._session: _Session | None = None
        self._lock = asyncio.Lock()

    # -- LiveKit surface ---------------------------------------------------- #

    @property
    def model(self) -> str:
        return self._effective_model()

    def _effective_model(self) -> str:
        if self._fast_model and plan_pressure() != "ok":
            return self._fast_model
        return self._model

    @property
    def provider(self) -> str:
        return "claude-code-subscription"

    def chat(
        self,
        *,
        chat_ctx: llm.ChatContext,
        tools: list[Tool] | None = None,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
        parallel_tool_calls: NotGivenOr[bool] = NOT_GIVEN,
        tool_choice: NotGivenOr[Any] = NOT_GIVEN,
        extra_kwargs: NotGivenOr[dict[str, Any]] = NOT_GIVEN,
    ) -> _Stream:
        return _Stream(self, chat_ctx=chat_ctx, tools=tools or [], conn_options=conn_options)

    async def aclose(self) -> None:
        await super().aclose()
        session, self._session = self._session, None
        if session is not None:
            await self._discard(session)

    # -- warm start ---------------------------------------------------------- #

    async def warmup(self, instructions: str, tools: list[Tool] | None = None) -> None:
        """Spawn the CLI and prime the prompt cache before the first real turn.

        Connecting alone removes the process spawn. A hidden one-word turn also
        makes the model read the system prompt and tool schemas once, so the first
        real reply hits a hot prompt cache (measured ~0.2-0.35 s faster to first
        token). The hidden exchange stays inside the SDK session only; LiveKit
        never sees it and it is never spoken. Any failure just leaves a connected,
        unprimed session.
        """
        async with self._lock:
            try:
                if self._session is None or self._session.dead:
                    self._session = await self._open(instructions, _tool_schemas(tools or []))
                    await self._prime(self._session)
            except Exception as exc:
                logger.warning("subscription warm-up failed: %s", exc)

    async def _prime(self, session: _Session) -> None:
        async def run() -> None:
            await session.client.query("(Voice line check. Reply with the single word: ready.)")
            async for message in session.client.receive_response():
                if type(message).__name__ == "ResultMessage":
                    return

        try:
            await asyncio.wait_for(run(), 20)
        except Exception as exc:
            # A half-consumed hidden turn must never leak into the first real
            # one; rebuild the session on the next chat() instead.
            session.dead = True
            logger.warning("subscription prime failed: %s", exc)

    # -- plan usage ----------------------------------------------------------- #

    def _schedule_usage_refresh(self, session: _Session) -> None:
        task = asyncio.ensure_future(self._refresh_usage(session))
        self._background.add(task)
        task.add_done_callback(self._background.discard)

    async def _refresh_usage(self, session: _Session) -> None:
        if time.monotonic() - self._last_usage_pull < _USAGE_MIN_INTERVAL:
            return
        self._last_usage_pull = time.monotonic()
        try:
            raw = await asyncio.wait_for(
                session.client._query._send_control_request({"subtype": "get_usage"}), 5
            )
            usage = _parse_usage(raw)
        except Exception:
            return  # unsupported or unanswered: the readout just goes quiet
        if usage is None:
            return
        _set_usage(usage)
        if self._on_usage is not None:
            try:
                self._on_usage(usage)
            except Exception:
                logger.debug("plan usage callback failed", exc_info=True)

    # -- session lifecycle --------------------------------------------------- #

    def _options(self, system_text: str, schemas: list[dict[str, Any]], bridge: ToolBridge) -> Any:
        from claude_agent_sdk import ClaudeAgentOptions, SdkMcpTool, create_sdk_mcp_server

        mcp_servers: dict[str, Any] = {}
        allowed: list[str] = []
        if schemas:
            tool_defs = []
            for schema in schemas:
                name = schema["name"]

                async def handler(args: dict[str, Any], _name: str = name) -> dict[str, Any]:
                    output = await bridge.invoke(_name, args or {})
                    return {"content": [{"type": "text", "text": output}]}

                # The CLI's validator is draft-07; a 2020-12 "$schema" URL is rejected.
                input_schema = dict(schema.get("input_schema") or {"type": "object"})
                input_schema.pop("$schema", None)
                tool_defs.append(
                    SdkMcpTool(
                        name=name,
                        description=schema.get("description") or name,
                        input_schema=input_schema,
                        handler=handler,
                    )
                )
                allowed.append(_mcp_tool_name(name))
            mcp_servers[MCP_SERVER_NAME] = create_sdk_mcp_server(
                name=MCP_SERVER_NAME, tools=tool_defs
            )

        prompt = system_text
        if schemas and self._suffix:
            prompt = f"{prompt}\n\n{self._suffix}"
        kwargs: dict[str, Any] = {
            "model": self._effective_model(),
            "system_prompt": prompt,
            # [] disables every built-in tool; only the bridged tools exist.
            "tools": [],
            "allowed_tools": allowed,
            "disallowed_tools": ["Bash", "Read", "Write", "Edit", "WebFetch", "WebSearch"],
            "mcp_servers": mcp_servers,
            "strict_mcp_config": True,
            "setting_sources": [],
            "include_partial_messages": True,
            "permission_mode": "default",
            "cwd": self._cwd,
            "env": cli_environment(),
            "max_turns": self._max_turns,
        }
        if not self._thinking:
            kwargs["thinking"] = {"type": "disabled"}
        if self._effort:
            kwargs["effort"] = self._effort
        return ClaudeAgentOptions(**kwargs)

    async def _open(self, system_text: str, schemas: list[dict[str, Any]]) -> _Session:
        bridge = ToolBridge()
        options = self._options(system_text, schemas, bridge)
        if self._client_factory is not None:
            client = self._client_factory(options, bridge)
        else:
            from claude_agent_sdk import ClaudeSDKClient

            client = ClaudeSDKClient(options=options)
        await client.connect()
        return _Session(
            client=client,
            bridge=bridge,
            system_text=system_text,
            tool_names=frozenset(s["name"] for s in schemas),
            model=self._effective_model(),
        )

    async def _discard(self, session: _Session) -> None:
        session.dead = True
        session.bridge.cancel_all("That tool call was cancelled.")
        if session.next_task is not None and not session.next_task.done():
            session.next_task.cancel()
            with contextlib.suppress(BaseException):
                await session.next_task
        with contextlib.suppress(BaseException):
            await asyncio.wait_for(session.client.disconnect(), 5)

    async def _quiesce(self, session: _Session) -> bool:
        """Bring an interrupted session back to idle. False -> rebuild it."""
        if session.response is None:
            return True
        session.bridge.cancel_all("That tool call was cancelled.")
        session.awaiting.clear()
        with contextlib.suppress(Exception):
            await asyncio.wait_for(session.client.interrupt(), 3)

        async def drain() -> None:
            while True:
                task = session.next_task
                if task is None:
                    task = asyncio.ensure_future(session.response.__anext__())
                    session.next_task = task
                try:
                    message = await task
                except StopAsyncIteration:
                    return
                finally:
                    session.next_task = None
                if type(message).__name__ == "ResultMessage":
                    return

        try:
            await asyncio.wait_for(drain(), _DRAIN_TIMEOUT)
        except Exception:
            return False
        session.response = None
        return True

    # -- prompt building ------------------------------------------------------ #

    def _delta_prompt(self, session: _Session, items: list[Any]) -> str:
        """Text for the items the SDK session has not seen yet."""
        notes: list[str] = []
        users: list[str] = []
        for item in items:
            item_id = getattr(item, "id", None)
            if item_id in session.seen_ids:
                continue
            kind = getattr(item, "type", "")
            if kind == "function_call_output":
                call_id = getattr(item, "call_id", "")
                if call_id in session.bridge.pending:
                    continue  # resolved separately; not text
                if item_id:
                    session.seen_ids.add(item_id)
                continue
            if kind == "function_call":
                call_id = getattr(item, "call_id", "")
                if item_id:
                    session.seen_ids.add(item_id)
                if call_id not in session.bridge.pending and call_id not in session.awaiting:
                    notes.append(
                        f"(Earlier, a tool call to {getattr(item, 'name', 'a tool')} was made.)"
                    )
                continue
            text = _text_of(item)
            if item_id:
                session.seen_ids.add(item_id)
            if not text:
                continue
            role = getattr(item, "role", "")
            if role == "assistant":
                if not session.was_emitted(text):
                    notes.append(f"(You said earlier: {text})")
            elif role in {"system", "developer"}:
                notes.append(f"(Instruction for this reply: {text})")
            else:
                users.append(text)
        parts: list[str] = []
        if notes:
            parts.append("\n".join(notes))
        if users:
            parts.append("\n".join(users))
        return "\n\n".join(parts)

    def _replay_prompt(self, items: list[Any]) -> str:
        """First message of a fresh session: prior turns as context, then the ask."""
        lines: list[str] = []
        last_user: str | None = None
        for item in items:
            kind = getattr(item, "type", "")
            if kind != "message":
                continue
            text = _text_of(item)
            if not text:
                continue
            role = getattr(item, "role", "")
            if role == "user":
                if last_user is not None:
                    lines.append(f"{self._speaker}: {last_user}")
                last_user = text
            elif role == "assistant":
                if last_user is not None:
                    lines.append(f"{self._speaker}: {last_user}")
                    last_user = None
                lines.append(f"You: {text}")
            elif role in {"system", "developer"}:
                lines.append(f"(Instruction: {text})")
        head = ""
        if lines:
            head = "Earlier in this conversation (context only; do not repeat it):\n" + "\n".join(
                lines
            )
        tail = last_user if last_user is not None else ""
        return "\n\n".join(p for p in (head, tail) if p)

    def _mark_all_seen(self, session: _Session, items: list[Any]) -> None:
        for item in items:
            item_id = getattr(item, "id", None)
            if item_id:
                session.seen_ids.add(item_id)


# --------------------------------------------------------------------------- #
# The stream
# --------------------------------------------------------------------------- #


def _system_delta(old: str, new: str) -> str | None:
    """None -> compatible, no note; "" never; text -> a context-update note;
    raises LookupError when the change is too large to patch in-line."""
    if old == new or " ".join(old.split()) == " ".join(new.split()):
        return None
    common = os.path.commonprefix([old, new])
    cut = common.rfind("\n") + 1
    if len(old) == 0 or cut < 0.6 * len(old) or len(new) - cut > 6000:
        raise LookupError("system prompt changed too much")
    return new[cut:].strip()


class _Stream(llm.LLMStream):
    def __init__(
        self,
        owner: ClaudeSubscriptionLLM,
        *,
        chat_ctx: llm.ChatContext,
        tools: list[Tool],
        conn_options: APIConnectOptions,
    ) -> None:
        super().__init__(owner, chat_ctx=chat_ctx, tools=tools, conn_options=conn_options)
        self._owner = owner
        self._request_id = f"cc-{uuid.uuid4().hex[:12]}"

    async def _run(self) -> None:
        owner = self._owner
        started = time.monotonic()
        timeout = max(float(self._conn_options.timeout or 10.0), 1.0)
        try:
            async with owner._lock:
                await self._run_locked(started, timeout)
        except asyncio.CancelledError:
            # Interrupted mid-flight (barge-in, or a preemptive generation that
            # was superseded). The response is still streaming inside the CLI;
            # the next step quiesces it before reusing the session.
            raise
        except (APIConnectionError, APIStatusError, APITimeoutError):
            raise
        except Exception as exc:
            if owner._session is not None:
                owner._session.dead = True
            raise APIConnectionError(f"claude subscription call failed: {exc}") from exc

    async def _run_locked(self, started: float, timeout: float) -> None:
        owner = self._owner
        instructions, items = _split_ctx(self._chat_ctx)
        schemas = _tool_schemas(self._tools)
        names = frozenset(s["name"] for s in schemas)
        probe = not instructions and not schemas  # e.g. FallbackAdapter recovery ping

        if owner._stop_at_critical and plan_pressure() == "critical":
            raise APIStatusError(
                "Claude plan limit reached; falling back to the API key",
                status_code=429,
                retryable=False,
            )

        if probe:
            await self._run_ephemeral(items, started, timeout)
            return

        session = owner._session
        context_note = ""

        if session is not None and not session.dead:
            if session.tool_names != names:
                await owner._discard(session)
                session = None
            else:
                try:
                    delta = _system_delta(session.system_text, instructions)
                except LookupError:
                    await owner._discard(session)
                    session = None
                else:
                    if delta is not None:
                        context_note = (
                            "[Context update — this replaces the closing section of your "
                            f"instructions:]\n{delta}"
                        )
                        session.system_text = instructions
        elif session is not None:
            await owner._discard(session)
            session = None

        # Tool outputs this step carries (a continuation) vs. a brand-new turn.
        if session is not None and session.response is not None:
            outputs = {
                getattr(i, "call_id", ""): i
                for i in items
                if getattr(i, "type", "") == "function_call_output"
            }
            resumable = bool(session.awaiting) and all(c in outputs for c in session.awaiting)
            if resumable:
                for call_id in list(session.awaiting):
                    item = outputs[call_id]
                    session.seen_ids.add(getattr(item, "id", call_id))
                    text = getattr(item, "output", "") or ""
                    if getattr(item, "is_error", False):
                        text = f"Error: {text}" if text else "Error: the tool failed."
                    session.bridge.resolve(call_id, text)
                session.awaiting.clear()
                self._mark_calls_seen(session, items)
                await self._consume(session, started, timeout)
                return
            if not await owner._quiesce(session):
                await owner._discard(session)
                session = None

        fresh = False
        if session is None:
            session = await owner._open(instructions, schemas)
            owner._session = session
            fresh = True

        if fresh:
            prompt = owner._replay_prompt(items)
            owner._mark_all_seen(session, items)
        else:
            prompt = owner._delta_prompt(session, items)
            if context_note:
                prompt = f"{context_note}\n\n{prompt}" if prompt else context_note
        if not prompt:
            prompt = "Please continue."
        self._mark_calls_seen(session, items)

        target_model = owner._effective_model()
        if session.model and session.model != target_model:
            # The plan is under pressure (or has recovered): switch live.
            with contextlib.suppress(Exception):
                await asyncio.wait_for(session.client.set_model(target_model), 5)
                session.model = target_model

        await session.client.query(prompt)
        session.response = session.client.receive_response().__aiter__()
        session.next_task = None
        await self._consume(session, started, timeout)

    def _mark_calls_seen(self, session: _Session, items: list[Any]) -> None:
        for item in items:
            if getattr(item, "type", "") in {"function_call", "function_call_output"}:
                item_id = getattr(item, "id", None)
                if item_id:
                    session.seen_ids.add(item_id)

    # -- one-off (recovery pings etc.), never touches the warm session -------- #

    async def _run_ephemeral(self, items: list[Any], started: float, timeout: float) -> None:
        owner = self._owner
        temp = ClaudeSubscriptionLLM(
            model=owner._model,
            cwd=owner._cwd,
            client_factory=owner._client_factory,
            thinking=False,
        )
        prompt = temp._replay_prompt(items) or "Say OK."
        session = await temp._open("Reply with one short word.", [])
        try:
            await session.client.query(prompt)
            session.response = session.client.receive_response().__aiter__()
            await self._consume(session, started, timeout)
        finally:
            await temp._discard(session)

    # -- the read loop -------------------------------------------------------- #

    async def _consume(self, session: _Session, started: float, timeout: float) -> None:
        sent_first = False
        usage: dict[str, Any] = {}
        text_emitted = ""

        def remaining_first() -> float:
            return max(timeout - (time.monotonic() - started), 0.05)

        while True:
            if session.next_task is None:
                session.next_task = asyncio.ensure_future(session.response.__anext__())
            call_task = asyncio.ensure_future(session.bridge.arrivals.get())
            wait_for = (remaining_first() if not sent_first else max(timeout, 30.0))
            try:
                done, _ = await asyncio.wait(
                    {session.next_task, call_task},
                    timeout=wait_for,
                    return_when=asyncio.FIRST_COMPLETED,
                )
            except asyncio.CancelledError:
                call_task.cancel()
                raise
            if call_task not in done:
                call_task.cancel()
            if not done:
                session.dead = True
                raise APITimeoutError("claude subscription timed out", retryable=True)

            if call_task in done:
                first_call = call_task.result()
                calls = [first_call]
                deadline = time.monotonic() + _TOOL_BATCH_GRACE
                while len(calls) < max(session.expected_tools, 1):
                    left = deadline - time.monotonic()
                    if left <= 0:
                        break
                    try:
                        calls.append(await asyncio.wait_for(session.bridge.arrivals.get(), left))
                    except asyncio.TimeoutError:
                        break
                session.expected_tools = 0
                session.awaiting = {c.call_id for c in calls}
                self._event_ch.send_nowait(
                    llm.ChatChunk(
                        id=self._request_id,
                        delta=llm.ChoiceDelta(
                            role="assistant",
                            tool_calls=[
                                llm.FunctionToolCall(
                                    arguments=c.arguments, name=c.name, call_id=c.call_id
                                )
                                for c in calls
                            ],
                        ),
                    )
                )
                if text_emitted:
                    session.remember_emitted(text_emitted)
                return  # LiveKit runs the tools, then calls chat() again

            task = session.next_task
            session.next_task = None
            try:
                message = task.result()
            except StopAsyncIteration:
                session.response = None
                break
            kind = type(message).__name__

            if kind == "StreamEvent":
                event = getattr(message, "event", {}) or {}
                etype = event.get("type")
                if etype == "message_start":
                    session.expected_tools = 0
                elif etype == "content_block_start":
                    block = event.get("content_block", {}) or {}
                    if block.get("type") == "tool_use":
                        session.expected_tools += 1
                elif etype == "content_block_delta":
                    delta = event.get("delta", {}) or {}
                    if delta.get("type") == "text_delta" and delta.get("text"):
                        sent_first = True
                        text_emitted += delta["text"]
                        self._event_ch.send_nowait(
                            llm.ChatChunk(
                                id=self._request_id,
                                delta=llm.ChoiceDelta(role="assistant", content=delta["text"]),
                            )
                        )
            elif kind == "AssistantMessage":
                error = getattr(message, "error", None)
                if error:
                    session.dead = True
                    raise _error_for(str(error))
            elif kind == "RateLimitEvent":
                note_rate_limit_event(getattr(message, "rate_limit_info", None))
            elif kind == "ResultMessage":
                session.response = None
                self._owner._schedule_usage_refresh(session)
                usage = getattr(message, "usage", None) or {}
                if getattr(message, "is_error", False):
                    session.dead = True
                    status = getattr(message, "api_error_status", None)
                    detail = str(getattr(message, "result", "") or "claude returned an error")
                    if status is not None:
                        raise APIStatusError(detail, status_code=int(status), retryable=status >= 500)
                    raise _error_for(detail)
                break

        if text_emitted:
            session.remember_emitted(text_emitted)
        prompt_tokens = (
            int(usage.get("input_tokens") or 0)
            + int(usage.get("cache_read_input_tokens") or 0)
            + int(usage.get("cache_creation_input_tokens") or 0)
        )
        completion = int(usage.get("output_tokens") or 0)
        self._event_ch.send_nowait(
            llm.ChatChunk(
                id=self._request_id,
                usage=llm.CompletionUsage(
                    completion_tokens=completion,
                    prompt_tokens=prompt_tokens,
                    prompt_cached_tokens=int(usage.get("cache_read_input_tokens") or 0),
                    cache_creation_tokens=int(usage.get("cache_creation_input_tokens") or 0),
                    cache_read_tokens=int(usage.get("cache_read_input_tokens") or 0),
                    total_tokens=prompt_tokens + completion,
                ),
            )
        )


def _error_for(detail: str) -> Exception:
    lowered = detail.lower()
    if "authentication" in lowered or "401" in lowered or "expired" in lowered or "log in" in lowered:
        return APIStatusError(detail, status_code=401, retryable=False)
    if ("rate" in lowered and "limit" in lowered) or "429" in lowered or "usage limit" in lowered:
        return APIStatusError(detail, status_code=429, retryable=False)
    return APIConnectionError(detail)


# --------------------------------------------------------------------------- #
# One-shot helper (health checks, warm-up)
# --------------------------------------------------------------------------- #


async def probe_subscription(model: str, timeout: float = 20.0) -> tuple[bool, str]:
    """A real one-token round trip. Used by startup health checks and warm-up."""
    enabled, why = subscription_enabled()
    if not enabled:
        return False, why
    from claude_agent_sdk import ClaudeAgentOptions, query

    options = ClaudeAgentOptions(
        model=model,
        system_prompt="Reply with the single word OK.",
        tools=[],
        setting_sources=[],
        strict_mcp_config=True,
        env=cli_environment(),
        max_turns=1,
        cwd=tempfile.gettempdir(),
    )

    async def run() -> tuple[bool, str]:
        outcome: tuple[bool, str] = (False, "no result")
        # Consume the stream to its end: returning early would abandon the
        # generator mid-flight and log a spurious close error.
        async for message in query(prompt="ping", options=options):
            if type(message).__name__ == "ResultMessage":
                if getattr(message, "is_error", False):
                    outcome = (False, str(getattr(message, "result", "") or "error"))
                else:
                    outcome = (True, "ok")
        return outcome

    try:
        return await asyncio.wait_for(run(), timeout)
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"[:200]


__all__ = [
    "ClaudeSubscriptionLLM",
    "PlanUsage",
    "PlanWindow",
    "ToolBridge",
    "cli_environment",
    "plan_pressure",
    "plan_usage",
    "probe_subscription",
    "reset_plan_state",
    "subscription_credential",
    "subscription_enabled",
    "subscription_mode",
]
