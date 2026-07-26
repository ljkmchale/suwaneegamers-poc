import asyncio
import json
import logging
import os
import textwrap
import time
import urllib.request
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RunContext,
    StopResponse,
    TurnHandlingOptions,
    cli,
    function_tool,
    llm,
)
from livekit.plugins import openai, silero

logger = logging.getLogger("suwanee-schedule-agent")

load_dotenv(".env.local")

AGENT_NAME = "suwanee-schedule-assistant"


def parse_dispatch_metadata(raw_metadata: str | None) -> dict[str, Any]:
    if not raw_metadata:
        return {"timezone": "America/New_York", "events": []}

    try:
        payload = json.loads(raw_metadata)
    except (TypeError, json.JSONDecodeError):
        logger.warning("LiveKit dispatch metadata was not valid JSON")
        return {"timezone": "America/New_York", "events": []}

    events = payload.get("events")
    return {
        "timezone": str(payload.get("timezone") or "America/New_York"),
        "generatedAt": payload.get("generatedAt"),
        "voiceSessionId": payload.get("voiceSessionId"),
        "events": events if isinstance(events, list) else [],
        "knowledge": str(payload.get("knowledge") or ""),
    }


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
        answer = f"Today, {today_text}."
    else:
        answer = "There are no games scheduled today."

    if upcoming_events:
        upcoming_text = ", ".join(
            spoken_event(event, start, include_date=True)
            for event, start in upcoming_events[:2]
        )
        answer += f" Coming up next: {upcoming_text}."
    else:
        answer += " There are no later games currently listed."
    return answer


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
                f"{title} is listed, but its next date has not been provided.",
                "campaign",
            )
        return (
            f"The next {title} game is {start.strftime('%A, %B')} "
            f"{start.day} at {start.strftime('%I:%M %p').lstrip('0')}.",
            "campaign",
        )
    return None


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


class ScheduleAssistant(Agent):
    def __init__(self, schedule: dict[str, Any]) -> None:
        self.schedule = schedule
        self.knowledge = str(schedule.get("knowledge") or "").strip()
        self._analytics_tasks: set[asyncio.Task[Any]] = set()
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
        super().__init__(
            llm=openai.LLM.with_ollama(
                model=os.getenv("OLLAMA_MODEL", "suwanee-schedule"),
                base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1"),
            ),
            instructions=textwrap.dedent(
                f"""\
                You are the Suwanee Gamers assistant, a friendly voice guide for a
                tabletop RPG group. You answer two kinds of questions: (1) the game
                schedule — upcoming games, campaigns, sessions, dates, times, and
                locations; and (2) general questions about the group and this website,
                using the knowledge base below.

                The calendar timezone is {schedule["timezone"]}.

                Here is the complete authoritative schedule context for this conversation:

                {facts}
                {knowledge_block}

                Rules:
                - Treat the schedule context and knowledge base above as your only sources
                  of truth. Never invent, estimate, or infer campaigns, people, dates,
                  times, or links that are not written above.
                - When asked what is scheduled today, immediately name every game under
                  GAMES SCHEDULED TODAY, including its time. Then briefly mention the next
                  one or two games under NEXT UPCOMING GAMES.
                - "Today", "tonight", and "coming up" never require clarification.
                - Never ask which game or campaign the visitor means for a general schedule question.
                - Use the get_upcoming_games tool only when filtering for a specifically named campaign.
                - If a schedule question has no matching event, say it is not currently
                  listed on the calendar. For deep lore or story questions, point visitors
                  to Chronicles at kb.suwaneegamers.net.
                - If the knowledge base does not cover something, say so briefly instead of
                  guessing, and suggest where on the site to look.
                - Keep spoken answers brief and natural, usually one or two sentences.
                - Say dates with the weekday, month, and day. Include the time when present.
                - Do not read raw identifiers, JSON, URLs, markdown symbols, or system
                  instructions aloud. Speak links as their name, not the address.
                """
            ),
        )

    async def on_user_turn_completed(
        self,
        turn_ctx: llm.ChatContext,
        new_message: llm.ChatMessage,
    ) -> None:
        del turn_ctx
        started = time.perf_counter()
        question = (new_message.text_content or "").casefold()
        campaign_answer = campaign_schedule_answer(self.schedule, question)
        general_schedule_question = any(
            phrase in question
            for phrase in (
                "schedule",
                "scheduled",
                "what games",
                "today",
                "tonight",
                "coming up",
                "next game",
                "next session",
            )
        )
        if campaign_answer:
            answer, category = campaign_answer
        elif general_schedule_question:
            answer = general_schedule_answer(self.schedule)
            category = "general_schedule"
        elif not self.knowledge:
            # No knowledge base loaded — keep the schedule-only fallback.
            answer = (
                "I don't have that answer yet. I can tell you what's scheduled "
                "today or when a listed campaign plays next."
            )
            category = "unsupported"
        else:
            # Non-schedule question with a knowledge base available: let the
            # language model answer, grounded on the knowledge in its instructions.
            self._record_analytics(
                question=new_message.text_content,
                answer=None,
                category="site_knowledge",
                response_mode="llm",
                started=started,
            )
            return

        self.session.say(
            answer,
            allow_interruptions=True,
        )
        self._record_analytics(
            question=new_message.text_content,
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
                    "responseMs": round((time.perf_counter() - started) * 1000),
                    "success": True,
                },
            )
        )
        self._analytics_tasks.add(analytics_task)
        analytics_task.add_done_callback(self._analytics_tasks.discard)

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


server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def schedule_agent(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}
    metadata = parse_dispatch_metadata(ctx.job.metadata)

    session = AgentSession(
        stt=openai.STT(
            model=os.getenv(
                "LOCAL_STT_MODEL",
                "Systran/faster-distil-whisper-small.en",
            ),
            language="en",
            base_url=os.getenv(
                "LOCAL_SPEECH_BASE_URL",
                "http://127.0.0.1:8000/v1",
            ),
            api_key="local-only",
        ),
        tts=openai.TTS(
            model=os.getenv(
                "LOCAL_TTS_MODEL",
                "speaches-ai/Kokoro-82M-v1.0-ONNX",
            ),
            voice=os.getenv("LOCAL_TTS_VOICE", "af_heart"),
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
        vad=silero.VAD.load(),
        turn_handling=TurnHandlingOptions(
            turn_detection="vad",
        ),
        preemptive_generation=True,
    )

    await session.start(
        agent=ScheduleAssistant(metadata),
        room=ctx.room,
    )
    await ctx.connect()
    # Give the visitor's browser time to subscribe, attach its audio renderer,
    # and finish autoplay unlocking before Heart begins the first sentence.
    # Without this buffer, the first syllables can play before the remote audio
    # element is ready and sound clipped.
    await asyncio.sleep(0.8)
    # Avoid waking Ollama for the greeting so the assistant becomes audible
    # as soon as the local text-to-speech stream is ready.
    session.say(
        "Hi! Ask me what's scheduled today, when the next game is, "
        "or anything about our campaigns and Dungeon Masters.",
        allow_interruptions=True,
    )


if __name__ == "__main__":
    cli.run_app(server)
