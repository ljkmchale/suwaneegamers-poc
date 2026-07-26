from datetime import datetime
from zoneinfo import ZoneInfo

from schedule_agent.agent import (
    campaign_schedule_answer,
    general_schedule_answer,
    parse_dispatch_metadata,
    schedule_facts,
    select_events,
)


def test_parse_dispatch_metadata_defaults_safely():
    assert parse_dispatch_metadata("not-json") == {
        "timezone": "America/New_York",
        "events": [],
    }


def test_parse_dispatch_metadata_extracts_knowledge():
    payload = parse_dispatch_metadata(
        '{"timezone": "America/New_York", "events": [], '
        '"knowledge": "# Suwanee Gamers\\nActive campaigns: Mad Mage."}'
    )
    assert payload["knowledge"] == "# Suwanee Gamers\nActive campaigns: Mad Mage."


def test_parse_dispatch_metadata_knowledge_defaults_to_empty():
    payload = parse_dispatch_metadata('{"timezone": "America/New_York", "events": []}')
    assert payload["knowledge"] == ""


def test_select_events_filters_campaign_and_sorts():
    events = [
        {"title": "Souls of Destiny", "start": "2026-08-12T23:00:00Z"},
        {"title": "Heroes of Emberstran", "start": "2026-08-02T23:00:00Z"},
        {"title": "Souls of Destiny", "start": "2026-08-05T23:00:00Z"},
    ]

    assert select_events(events, "souls") == [
        {"title": "Souls of Destiny", "start": "2026-08-05T23:00:00Z"},
        {"title": "Souls of Destiny", "start": "2026-08-12T23:00:00Z"},
    ]


def test_schedule_facts_resolves_today_and_upcoming_in_calendar_timezone():
    schedule = {
        "timezone": "America/New_York",
        "events": [
            {
                "title": "Souls of Destiny",
                "start": "2026-07-26T17:00:00Z",
                "end": "2026-07-26T22:00:00Z",
                "allDay": False,
            },
            {
                "title": "Dungeons III",
                "start": "2026-07-27T22:00:00Z",
                "end": "2026-07-28T02:00:00Z",
                "allDay": False,
            },
        ],
    }
    now = datetime(2026, 7, 26, 10, 0, tzinfo=ZoneInfo("America/New_York"))

    facts = schedule_facts(schedule, now)

    assert "CURRENT LOCAL DATE: Sunday, July 26, 2026" in facts
    assert "Souls of Destiny: Sunday, July 26 at 1:00 PM to 6:00 PM" in facts
    assert "Dungeons III: Monday, July 27 at 6:00 PM to 10:00 PM" in facts


def test_general_schedule_answer_is_immediate_and_specific():
    schedule = {
        "timezone": "America/New_York",
        "events": [
            {"title": "Souls of Destiny", "start": "2026-07-26T17:00:00Z"},
            {"title": "Dungeons III", "start": "2026-07-27T22:00:00Z"},
            {"title": "Heroes of Emberstran", "start": "2026-07-30T22:00:00Z"},
        ],
    }
    now = datetime(2026, 7, 26, 10, 0, tzinfo=ZoneInfo("America/New_York"))

    assert general_schedule_answer(schedule, now) == (
        "Today, Souls of Destiny at 1:00 PM. Coming up next: "
        "Dungeons III on Monday, July 27 at 6:00 PM, "
        "Heroes of Emberstran on Thursday, July 30 at 6:00 PM."
    )


def test_campaign_question_is_answered_without_ollama():
    schedule = {
        "timezone": "America/New_York",
        "events": [
            {"title": "Souls of Destiny", "start": "2026-07-26T17:00:00Z"},
        ],
    }

    assert campaign_schedule_answer(
        schedule,
        "When is Souls of Destiny playing?",
    ) == (
        "The next Souls of Destiny game is Sunday, July 26 at 1:00 PM.",
        "campaign",
    )
