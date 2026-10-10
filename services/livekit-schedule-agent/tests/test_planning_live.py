import asyncio
import json
from pathlib import Path
from types import MethodType, SimpleNamespace
from unittest.mock import Mock

import pytest
from livekit.agents import StopResponse, llm

from schedule_agent import agent
from schedule_agent.planning import Evidence

read_freshness = agent.latest_indexed_session


@pytest.fixture(autouse=True)
def isolate_machine_freshness(monkeypatch):
    monkeypatch.setattr(agent, "latest_indexed_session", lambda campaign: None)


def visitor(games=("Souls of Destiny",)):
    myra = SimpleNamespace(
        recaps=[
            {
                "name": "Souls of Destiny",
                "title": "Session 17 - Homecoming",
                "summary": "The party returned to town.",
            },
            {
                "name": "Dungeons III - kNight Watch",
                "aliases": ["night watch"],
                "summary": "The Watch secured the gate.",
            },
        ],
        schedule={
            "timezone": "America/New_York",
            "events": [
                {"title": "Souls of Destiny", "start": "2099-10-10T19:00:00-04:00"},
                {"title": "Dungeons III - kNight Watch", "start": "2099-10-11T18:00:00-04:00"},
            ],
        },
        user_profile={"games": list(games)},
        dm_default_campaigns=[],
        knowledge_visibility="players",
        brain_access_token="",
        _turn_revision=0,
        _pending_offer=None,
        _conversation_subject=None,
        mishearings={},
        voice_entities=(),
        full_pantheon_knowledge="",
        routing_overrides=set(),
        session=SimpleNamespace(say=Mock()),
        _record_analytics=Mock(),
    )
    myra.recap_plan = MethodType(agent.Myra.recap_plan, myra)
    myra.answer_recap_plan = MethodType(agent.Myra.answer_recap_plan, myra)
    return myra


@pytest.mark.asyncio
async def test_actual_conversation_hook_speaks_recap_and_schedule():
    myra = visitor()
    message = llm.ChatMessage(
        role="user",
        content=["What happened last time in Souls of Destiny and when do we play again?"],
    )
    with pytest.raises(StopResponse):
        await agent.Myra.on_user_turn_completed(myra, llm.ChatContext(), message)
    answer = myra.session.say.call_args.args[0]
    assert "returned to town" in answer and "7:00 PM" in answer
    assert myra._record_analytics.call_args.kwargs["category"] == "recap"


@pytest.mark.asyncio
async def test_aliases_resolve_both_snapshot_and_vault_names():
    myra = visitor()
    plan = myra.recap_plan("What happened last time in night watch and when do we play again?")
    assert plan.campaign == "Dungeons III"
    answer = await myra.answer_recap_plan(plan)
    assert "secured the gate" in answer and "6:00 PM" in answer
    assert "returned to town" not in answer


@pytest.mark.asyncio
async def test_missing_campaign_clarifies_without_network(monkeypatch):
    lookup = Mock(side_effect=AssertionError("Must not query ambiguous campaign"))
    monkeypatch.setattr(agent, "query_player_knowledge_evidence", lookup)
    myra = visitor(("Souls of Destiny", "Dungeons III"))
    plan = myra.recap_plan("What happened last session and who was involved?")
    assert "Which campaign" in await myra.answer_recap_plan(plan)
    lookup.assert_not_called()


@pytest.mark.asyncio
async def test_participant_query_retains_authenticated_context(monkeypatch):
    lookup = Mock(
        return_value=Evidence(
            "knowledge",
            "**Aury** was documented there. Sources used: [[Session 17]]",
            "wiki/sessions/SoD/SoD Session 17 - Homecoming.md",
        )
    )
    monkeypatch.setattr(agent, "query_player_knowledge_evidence", lookup)
    myra = visitor()
    myra.knowledge_visibility = "dm"
    myra.brain_access_token = "signed-test-capability"
    result = await myra.answer_recap_plan(
        myra.recap_plan(
            "What happened last session in Souls of Destiny, who was involved, and when do we play again?"
        )
    )
    assert "Aury" in result and "7:00 PM" in result
    assert "**" not in result and "Sources used" not in result
    assert "Session 17 - Homecoming" in lookup.call_args.args[0]
    assert lookup.call_args.args[1:] == ("Souls of Destiny", "dm", "signed-test-capability")


@pytest.mark.asyncio
async def test_failed_retrieval_preserves_other_parts(monkeypatch):
    monkeypatch.setattr(
        agent, "query_player_knowledge_evidence", Mock(side_effect=ValueError("No source"))
    )
    myra = visitor()
    result = await myra.answer_recap_plan(
        myra.recap_plan("What happened last session, who was involved, and when do we play again?")
    )
    assert "returned to town" in result and "7:00 PM" in result
    assert "couldn't verify" in result


@pytest.mark.asyncio
async def test_new_turn_discards_old_answer(monkeypatch):
    myra = visitor()

    def lookup(*args, **kwargs):
        myra._turn_revision += 1
        return Evidence("knowledge", "Old answer", "session:17")

    monkeypatch.setattr(agent, "query_player_knowledge_evidence", lookup)
    with pytest.raises(asyncio.CancelledError):
        await myra.answer_recap_plan(
            myra.recap_plan("What happened last session and who was involved?")
        )
    myra.session.say.assert_not_called()


def test_multiple_explicit_campaigns_do_not_pick_first():
    myra = visitor()
    assert myra.recap_plan(
        "What happened last time in Souls of Destiny and night watch?"
    ).clarification


def test_override_bypasses_plan():
    assert not visitor().recap_plan("What happened last session?", bypass=True).steps


CASES = json.loads((Path(__file__).parent / "planning_cases.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=[case["question"] for case in CASES])
def test_expanded_real_campaign_resolver_cases(case):
    myra = visitor(case["games"])
    plan = myra.recap_plan(case["question"], bypass=case.get("bypass", False))
    actual = (
        ["clarify"] if plan.clarification else [step.operation for step in plan.steps] or ["model"]
    )
    assert actual == case["operations"]
    assert plan.campaign == case["campaign"]


@pytest.mark.asyncio
async def test_specific_historical_question_reaches_model_without_speaking_recap():
    myra = visitor()
    message = llm.ChatMessage(role="user", content=["Who killed the dragon last session?"])
    await agent.Myra.on_user_turn_completed(myra, llm.ChatContext(), message)
    myra.session.say.assert_not_called()
    assert myra._pending_llm_analytics["question"] == message.text_content


@pytest.mark.asyncio
async def test_newer_indexed_session_supersedes_stale_dispatch(monkeypatch):
    myra = visitor()
    myra.recaps[0]["title"] = "Session 14 - Everybody Duck!"
    monkeypatch.setattr(
        agent,
        "latest_indexed_session",
        lambda campaign: {
            "title": "Session 15 - Aunts & Necromancers",
            "number": 15,
        },
    )
    lookup = Mock(
        return_value=Evidence(
            "knowledge",
            "Esylla met her aunt.",
            "wiki/sessions/SoD/SoD Session 15 - Aunts & Necromancers.md",
        )
    )
    monkeypatch.setattr(agent, "query_player_knowledge_evidence", lookup)
    answer = await myra.answer_recap_plan(
        myra.recap_plan("What happened last session and who was involved?")
    )
    assert "Session 15" in answer and "returned to town" not in answer
    assert all("Session 15" in call.args[0] for call in lookup.call_args_list)
    assert myra.recaps[0]["title"] == "Session 14 - Everybody Duck!"


@pytest.mark.asyncio
async def test_failed_newer_recap_never_presents_old_summary_as_current(monkeypatch):
    myra = visitor()
    monkeypatch.setattr(
        agent,
        "latest_indexed_session",
        lambda campaign: {"title": "Session 18 - New", "number": 18},
    )
    monkeypatch.setattr(
        agent, "query_player_knowledge_evidence", Mock(side_effect=OSError("offline"))
    )
    answer = await myra.answer_recap_plan(
        myra.recap_plan("What happened last session and when do we play again?")
    )
    assert "Session 18" in answer and "couldn't verify" in answer and "7:00 PM" in answer
    assert "returned to town" not in answer


@pytest.mark.asyncio
async def test_api_long_recap_form_keeps_short_summary_and_calendar(monkeypatch):
    monkeypatch.setattr(agent, "latest_indexed_session",
                        lambda campaign: {"title": "Session 18 - New", "number": 18})
    monkeypatch.setattr(agent, "query_player_knowledge_evidence", Mock(return_value=Evidence(
        "knowledge", "Short version: The party found the gate.\n\nStory recap: Long narrative omitted.",
        "wiki/Session 18 - New.md")))
    myra = visitor()
    answer = await myra.answer_recap_plan(myra.recap_plan(
        "What happened last session and when do we play again?"))
    assert "found the gate" in answer and "7:00 PM" in answer
    assert "Long narrative" not in answer and "Story recap" not in answer


@pytest.mark.asyncio
async def test_participant_api_biographies_are_not_read_aloud(monkeypatch):
    monkeypatch.setattr(agent, "query_player_knowledge_evidence", Mock(return_value=Evidence(
        "knowledge", "# Session Participants\n\nLila and Kenton were involved.\n\n---\n## Kenton\nA long biography follows.",
        "wiki/Session 17 - Homecoming.md")))
    myra = visitor()
    answer = await myra.answer_recap_plan(myra.recap_plan("Who was involved last session?"))
    assert answer == "Lila and Kenton were involved."


@pytest.mark.parametrize(
    "indexed,visibility,allowed",
    [(None, "players", False), ("now", "dm", False), ("now", "players", True)],
)
def test_only_indexed_player_safe_freshness_is_accepted(
    tmp_path, monkeypatch, indexed, visibility, allowed
):
    monkeypatch.setenv("BRAIN_DATA_DIR", str(tmp_path))
    (tmp_path / "session-freshness.json").write_text(
        json.dumps(
            {
                "campaigns": [
                    {
                        "campaign": "Souls of Destiny",
                        "latestPublished": 15,
                        "latestSession": {
                            "title": "Session 15",
                            "visibility": visibility,
                            "indexedAt": indexed,
                        },
                    }
                ]
            }
        )
    )
    assert bool(read_freshness("Souls of Destiny")) == allowed


@pytest.mark.asyncio
async def test_older_session_cannot_substantiate_participants(monkeypatch):
    lookup = Mock(
        return_value=Evidence("knowledge", "Wrong old participants", "wiki/SoD Session 08.md")
    )
    monkeypatch.setattr(agent, "query_player_knowledge_evidence", lookup)
    myra = visitor()
    answer = await myra.answer_recap_plan(
        myra.recap_plan("What happened last session and who was involved?")
    )
    assert "Wrong old participants" not in answer
    assert "couldn't verify" in answer


@pytest.mark.parametrize("token,visibility", [("", "players"), ("signed", "dm")])
def test_http_knowledge_transport_retains_access_boundary(monkeypatch, token, visibility):
    response = Mock()
    response.__enter__ = Mock(return_value=response)
    response.__exit__ = Mock(return_value=False)
    response.read.return_value = json.dumps(
        {
            "answer": "Documented answer",
            "sources": [{"title": "Session 17", "path": "sessions/17.md"}],
        }
    ).encode()
    request = Mock(return_value=response)
    monkeypatch.setattr(agent.urllib.request, "urlopen", request)
    evidence = agent.query_player_knowledge_evidence(
        "who attended", "Souls of Destiny", "dm", token
    )
    sent = request.call_args.args[0]
    assert json.loads(sent.data)["visibility"] == visibility
    assert json.loads(sent.data)["campaign"] == "Souls of Destiny"
    assert sent.get_header("X-sg-myra-brain-access") == (token or None)
    assert evidence.source == "sessions/17.md"


def test_existing_search_keeps_unsourced_clarification(monkeypatch):
    response = Mock()
    response.__enter__ = Mock(return_value=response)
    response.__exit__ = Mock(return_value=False)
    response.read.return_value = b'{"answer":"Which campaign?", "sources":[]}'
    monkeypatch.setattr(agent.urllib.request, "urlopen", Mock(return_value=response))
    assert agent.query_player_knowledge("who attended") == "Which campaign?"
    with pytest.raises(ValueError, match="attributable"):
        agent.query_player_knowledge_evidence("who attended")
