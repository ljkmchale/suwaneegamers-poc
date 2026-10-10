"""Offline comparison using actual worker intent predicates; no API calls.

Run from this service: .venv/Scripts/python.exe tests/eval_planning.py
The baseline models recap-before-schedule routing, not full live conversations.
"""

import json
import sys
from pathlib import Path
from statistics import median
from time import perf_counter
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from schedule_agent.agent import Myra, is_recap_question, is_schedule_question
from schedule_agent.planning import build_plan

CASES = [
    ("What happened last time in Souls of Destiny?", ("Souls of Destiny",), (), ("recap",)),
    ("When is the next game for Souls of Destiny?", ("Souls of Destiny",), (), ("schedule",)),
    (
        "What happened last time in Souls of Destiny and when do we play again?",
        ("Souls of Destiny",),
        (),
        ("recap", "schedule"),
    ),
    (
        "What happened last time in Souls of Destiny, who was involved, and when do we play again?",
        ("Souls of Destiny",),
        (),
        ("recap", "knowledge", "schedule"),
    ),
    ("What happened last time?", (), ("Souls of Destiny",), ("recap",)),
    ("What happened last time?", (), ("Souls of Destiny", "Heroes of Emberstran"), ("clarify",)),
    ("Who is Diverra?", (), (), ("knowledge",)),
    (
        "What happened last time in Heroes of Emberstran?",
        ("Heroes of Emberstran",),
        ("Souls of Destiny",),
        ("recap",),
    ),
]


def main():
    rows = []
    for question, named, members, expected in CASES:
        recap, schedule = is_recap_question(question), is_schedule_question(question)
        baseline = (
            ("recap",)
            if recap and named
            else ("clarify",)
            if recap
            else ("schedule",)
            if schedule
            else ("knowledge",)
        )
        started = perf_counter()
        result = build_plan(
            question,
            named_campaigns=named,
            member_campaigns=members,
            recap_intent=recap,
            schedule_intent=schedule,
        )
        elapsed = (perf_counter() - started) * 1000
        actual = ("clarify",) if result.clarification else tuple(s.operation for s in result.steps)
        rows.append(
            {
                "question": question,
                "expected": expected,
                "baseline": baseline,
                "planned": actual,
                "baseline_pass": baseline == expected,
                "planner_pass": actual == expected,
                "planning_ms": round(elapsed, 4),
                "trace": result.trace,
            }
        )
    expanded = []
    for case in json.loads((Path(__file__).parent / "planning_cases.json").read_text()):
        context = SimpleNamespace(recaps=[{"name": "Souls of Destiny"},
            {"name": "Dungeons III - kNight Watch", "aliases": ["night watch"]}],
            dm_default_campaigns=[], knowledge_visibility="players",
            user_profile={"games": case["games"]})
        plan = Myra.recap_plan(context, case["question"], bypass=case.get("bypass", False))
        actual = ["clarify"] if plan.clarification else [step.operation for step in plan.steps] or ["model"]
        expanded.append({"question": case["question"], "pass": actual == case["operations"] and plan.campaign == case["campaign"]})
    report = {
        "cases": len(rows),
        "baseline_pass": sum(r["baseline_pass"] for r in rows),
        "planner_pass": sum(r["planner_pass"] for r in rows),
        "model_calls": 0,
        "api_cost": 0,
        "results": rows,
        "expanded_cases": len(expanded),
        "expanded_pass": sum(row["pass"] for row in expanded),
        "routing_ms": {
            "median": round(median(row["planning_ms"] for row in rows), 4),
            "max": max(row["planning_ms"] for row in rows),
        },
        "expanded_results": expanded,
        "limitation": "Curated offline routing cases; no answer quality, retrieval, live latency, or permission evaluation.",
    }
    print(json.dumps(report, indent=2))
    return 0 if all(r["planner_pass"] for r in rows) and all(r["pass"] for r in expanded) else 1


if __name__ == "__main__":
    raise SystemExit(main())
