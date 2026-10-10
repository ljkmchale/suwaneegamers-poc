"""Behavior and trust-boundary tests for the isolated planning experiment."""

import pytest

from schedule_agent.planning import Evidence, Plan, Step, build_plan, execute_plan


def plan(question="What happened last time and when do we play again?", **overrides):
    args = {
        "named_campaigns": ("Souls of Destiny",),
        "member_campaigns": (),
        "recap_intent": True,
        "schedule_intent": True,
    }
    args.update(overrides)
    return build_plan(question, **args)


def test_compound_request_preserves_both_reads():
    assert [s.operation for s in plan().steps] == ["recap", "schedule"]


def test_existing_helper_adapters_execute_compound_plan():
    from schedule_agent.planning_readers import existing_readers

    readers = existing_readers(
        [{"name": "Souls of Destiny", "summary": "The party returned to town."}],
        {
            "timezone": "America/New_York",
            "events": [{"title": "Souls of Destiny", "start": "2099-10-10T19:00:00-04:00"}],
        },
        lambda *args: Evidence("knowledge", "fixture", "fixture:knowledge"),
    )
    result = execute_plan(plan(), readers, is_current=lambda: True)
    assert "returned to town" in result[0].text
    assert "7:00 PM" in result[1].text
    assert all(item.source.startswith("dispatch:") for item in result)


def test_campaign_name_does_not_add_spurious_schedule():
    assert [s.operation for s in plan("What happened last time in Souls of Destiny?").steps] == [
        "recap"
    ]


def test_scope_explicit_wins_and_ambiguous_recap_clarifies():
    assert plan(member_campaigns=("Heroes of Emberstran",)).campaign == "Souls of Destiny"
    ambiguous = plan(named_campaigns=(), member_campaigns=("A", "B"))
    assert ambiguous.clarification and not ambiguous.steps
    assert plan(named_campaigns=(), member_campaigns=("A",)).campaign == "A"
    assert plan(named_campaigns=("A", "B")).clarification


def test_attendance_requests_need_evidence_not_roster_inference():
    result = plan("What happened last time, who was involved, and when do we play again?")
    assert [s.operation for s in result.steps] == ["recap", "knowledge", "schedule"]
    assert "do not infer attendance" in result.steps[1].question


def test_model_override_is_preserved():
    assert not plan(bypass=True).steps


def test_unknown_operation_is_rejected_before_any_read():
    calls = []
    invalid = Plan("A", (Step("recap", "q"), Step("shell", "q")), ())
    with pytest.raises(ValueError):
        execute_plan(invalid, {"recap": lambda *a: calls.append(a)}, is_current=lambda: True)
    assert not calls


def test_stale_result_is_discarded():
    current = [True]

    def reader(question, campaign):
        current[0] = False
        return Evidence("recap", "summary", "session:1")

    with pytest.raises(RuntimeError, match="Stale"):
        execute_plan(plan(schedule_intent=False), {"recap": reader}, is_current=lambda: current[0])


def test_missing_source_cannot_be_used_as_evidence():
    with pytest.raises(ValueError, match="evidence"):
        execute_plan(
            plan(schedule_intent=False),
            {"recap": lambda *a: Evidence("recap", "unsupported", "")},
            is_current=lambda: True,
        )


def test_execution_passes_resolved_scope_and_keeps_sources():
    calls = []

    def reader(operation):
        def read(question, campaign):
            calls.append(campaign)
            return Evidence(operation, "fixture", "fixture:" + operation)

        return read

    result = execute_plan(
        plan(), {op: reader(op) for op in ("recap", "schedule")}, is_current=lambda: True
    )
    assert calls == ["Souls of Destiny", "Souls of Destiny"]
    assert [item.source for item in result] == ["fixture:recap", "fixture:schedule"]
