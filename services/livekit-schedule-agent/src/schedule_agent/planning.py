"""Bounded read plans used by Myra's live recap conversation path.

Plans contain allowlisted read operations, never executable model-generated code.
Adapters must retain the authorization enforced by the existing tools and API.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

Operation = Literal["recap", "schedule", "knowledge"]
ALLOWED = frozenset({"recap", "schedule", "knowledge"})


@dataclass(frozen=True)
class Step:
    operation: Operation
    question: str


@dataclass(frozen=True)
class Plan:
    campaign: str
    steps: tuple[Step, ...]
    trace: tuple[str, ...]
    clarification: str | None = None


@dataclass(frozen=True)
class Evidence:
    operation: str
    text: str
    source: str


def build_plan(
    question: str,
    *,
    named_campaigns: tuple[str, ...],
    member_campaigns: tuple[str, ...],
    recap_intent: bool,
    schedule_intent: bool,
    bypass: bool = False,
) -> Plan:
    """Resolve scope and preserve independent requests in a compound question.

    Caller supplies canonical campaign names and existing intent predicates.
    Membership selects a default scope; it never grants DM access.
    """
    explicit = tuple(dict.fromkeys(named_campaigns))
    defaults = tuple(dict.fromkeys(member_campaigns))
    trace = []
    if len(explicit) > 1:
        return Plan(
            "All", (), ("Multiple explicit campaigns",), "Which campaign should I use first?"
        )
    campaign = explicit[0] if explicit else defaults[0] if len(defaults) == 1 else "All"
    trace.append(
        "Explicit campaign"
        if explicit
        else "Single member campaign"
        if campaign != "All"
        else "No unique campaign"
    )
    if bypass:
        return Plan(campaign, (), (*trace, "Preserve existing model routing"))
    if re.search(r"\bsession\s+\d|\b(?:before last|penultimate)\b", question, re.I):
        return Plan(campaign, (), (*trace, "Historical session request goes to the model"))
    if recap_intent and re.search(
        r"\b(?:tell me about|what did (?!we do)|did (?!we (?:play|leave|do))|where was)\b",
        question,
        re.I,
    ):
        return Plan(campaign, (), (*trace, "Specific lore question goes to the model"))
    if re.search(
        r"\bopen\b.{0,35}\b(notes|chronicles|page|sheet)\b|\b(send|delete|record feedback)\b",
        question,
        re.I,
    ):
        return Plan(campaign, (), (*trace, "Additional action goes to existing model tools"))
    # Existing schedule detection also matches campaign names. Require an
    # independent time request when recap intent is present.
    schedule = schedule_intent and (
        not recap_intent
        or bool(
            re.search(
                r"\b(when|what time|next game|next session|play again|play next|playing next|schedule|tonight|this week|coming up)\b",
                question,
                re.I,
            )
        )
    )
    participants = recap_intent and bool(
        re.search(
            r"\b(who (?:was|were|joined|attended|played|showed up|took part)|participants|characters (?:were )?involved|which (?:characters|players).{0,30}(?:involved|present|attended|played|there))\b",
            question,
            re.I,
        )
    )
    participants_only = (
        participants
        and bool(re.match(r"\s*(who|which)\b", question, re.I))
        and not re.search(r"\b(recap|what happened|summarize|summary|catch up)\b", question, re.I)
    )
    if (
        recap_intent
        and not participants
        and re.match(r"\s*(who|why|where)\b", question, re.I)
        and not re.search(r"\b(where did we leave|where we left)\b", question, re.I)
    ):
        return Plan(campaign, (), (*trace, "Specific historical question goes to the model"))
    if campaign == "All" and recap_intent:
        return Plan(
            campaign,
            (),
            (*trace, "Recap requires a unique campaign"),
            "Which campaign would you like me to recap?",
        )
    steps = []
    if recap_intent and not participants_only:
        steps.append(Step("recap", question))
    if participants:
        steps.append(
            Step(
                "knowledge",
                question + " Use documented session evidence. "
                "Use documented session evidence; do not infer attendance from the roster.",
            )
        )
    if schedule:
        steps.append(Step("schedule", question))
    if not steps:
        steps.append(Step("knowledge", question))
    trace.extend(f"Request {step.operation}" for step in steps)
    return Plan(campaign, tuple(steps), tuple(trace))


def execute_plan(
    plan: Plan,
    readers: dict[str, Callable[[str, str], Evidence]],
    *,
    is_current: Callable[[], bool],
) -> tuple[Evidence, ...]:
    """Execute bounded reads; return evidence for composition, not invented prose.

    The live caller runs this off the event loop with a timeout. This executor
    rejects stale results and validates the entire plan before any read.
    """
    if plan.clarification:
        return ()
    if len(plan.steps) > 3 or any(
        step.operation not in ALLOWED or step.operation not in readers or not step.question.strip()
        for step in plan.steps
    ):
        raise ValueError("Invalid or unsupported plan")
    results = []
    for step in plan.steps:
        if not is_current():
            raise RuntimeError("Stale conversation turn")
        result = readers[step.operation](step.question, plan.campaign)
        if not is_current():
            raise RuntimeError("Stale conversation turn")
        if (
            result.operation != step.operation
            or not result.text.strip()
            or not result.source.strip()
        ):
            raise ValueError("Reader must return attributable evidence")
        results.append(result)
    return tuple(results)
