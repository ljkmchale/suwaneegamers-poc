"""Adapters to existing Myra helpers, loaded only by the offline experiment."""

from collections.abc import Callable
from typing import Any

from .agent import campaign_schedule_answer, recap_answer
from .planning import Evidence


def existing_readers(
    recaps: list[dict[str, Any]],
    schedule: dict[str, Any],
    authorized_knowledge: Callable[[str, str], Evidence],
) -> dict[str, Callable[[str, str], Evidence]]:
    """Knowledge callback must use the existing API authorization and source metadata.

    No visibility flag or access token is accepted from a plan. The caller owns
    authenticated context. Calendar and recap inputs are the existing approved
    dispatch snapshots, not newly read admin data.
    """

    def recap(question: str, campaign: str) -> Evidence:
        answer = recap_answer(recaps, f"{question} {campaign}")
        if answer is None:
            raise ValueError("No recap evidence for resolved campaign")
        return Evidence("recap", answer[0], f"dispatch:recaps:{campaign}")

    def games(question: str, campaign: str) -> Evidence:
        answer = campaign_schedule_answer(schedule, campaign)
        if answer is None:
            raise ValueError("No schedule evidence for resolved campaign")
        return Evidence("schedule", answer[0], f"dispatch:calendar:{campaign}")

    return {"recap": recap, "schedule": games, "knowledge": authorized_knowledge}
