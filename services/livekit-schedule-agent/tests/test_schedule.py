import json
from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from livekit.agents.llm import FallbackAdapter

from schedule_agent.agent import (
    about_suwanee_gamers_answer,
    apply_mishearings,
    apply_pronunciations,
    campaign_schedule_answer,
    canonicalize_spoken_entity_question,
    canonicalize_spoken_question,
    diagnostic_request,
    event_loop_lag,
    general_schedule_answer,
    is_about_suwanee_gamers_question,
    is_personal_schedule_question,
    is_recap_question,
    is_schedule_question,
    is_self_diagnosis_question,
    load_full_pantheon_knowledge,
    load_pantheon_knowledge,
    load_voice_entity_catalog,
    metric_forward_payload,
    navigation_request_target,
    pantheon_deity_answer,
    parse_dispatch_metadata,
    persona_speed,
    persona_style_block,
    persona_voice,
    personalized_schedule_answer,
    recap_answer,
    resolve_navigation,
    resolve_spoken_entity,
    schedule_facts,
    select_events,
    summarize_health,
    tool_result_is_current,
    wake_word_command,
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


def test_parse_dispatch_metadata_keeps_about_and_safe_navigation():
    payload = parse_dispatch_metadata(
        '{"events": [], "aboutSuwaneeGamers": "Our Story", "navigation": ['
        '{"label": "Pantheon", "href": "/pantheon"},'
        '{"label": "Unsafe", "href": "https://example.com"}]}'
    )
    assert payload["aboutSuwaneeGamers"] == "Our Story"
    assert payload["navigation"] == [{"label": "Pantheon", "href": "/pantheon"}]


def test_parse_dispatch_metadata_keeps_the_members_persona():
    payload = parse_dispatch_metadata(
        '{"events": [], "persona": {"id": "british-cheeky", "label": "British & cheeky",'
        ' "voice": "bf_emma", "speed": 1.0, "style": ["Dry British wit."],'
        ' "examples": ["Say \\"Right then\\"."]}}'
    )
    assert payload["persona"]["voice"] == "bf_emma"
    assert payload["persona"]["style"] == ["Dry British wit."]
    assert persona_voice(payload["persona"]) == "bf_emma"
    assert persona_speed(payload["persona"]) == 1.0


def test_parse_dispatch_metadata_drops_a_nonsense_voice_id():
    payload = parse_dispatch_metadata(
        '{"events": [], "persona": {"id": "x", "voice": "../../etc/passwd"}}'
    )
    assert "voice" not in payload["persona"]
    # Falls back to the configured default rather than a broken TTS request.
    assert persona_voice(payload["persona"]) == "af_heart"


def test_persona_speed_stays_intelligible():
    assert persona_speed({"speed": 4}) == 1.25
    assert persona_speed({"speed": 0.1}) == 0.7
    assert persona_speed({"speed": "quick"}) == 0.96
    assert persona_speed({}) == 0.96


def test_persona_style_block_falls_back_to_classic_myra():
    block = persona_style_block({})
    assert "knowledgeable gaming friend" in block
    assert "Yeah — I can help with that." in block


def test_persona_style_block_keeps_the_shared_guard_rails():
    block = persona_style_block(
        {"style": ["Be a sharp, quick-witted Brit."], "examples": ["Say \"Right then\"."]}
    )
    assert "quick-witted Brit" in block
    assert "knowledgeable gaming friend" not in block
    # Persona-independent limits survive any personality.
    assert "Personality never outranks accuracy" in block
    assert "No profanity" in block
    assert "Never output SSML" in block


def test_pantheon_reference_keeps_rosters_and_drops_prose():
    pantheon = load_pantheon_knowledge()
    # Both rosters (names, titles, domains) stay for fast god-list/domain answers.
    assert "## The New Order" in pantheon
    assert "Tyvarion" in pantheon
    assert "Master of Masks" in pantheon
    assert "## The Old Gods" in pantheon
    assert "Athuel" in pantheon
    # The heavy per-deity prose is intentionally excluded to keep the prompt small
    # and the prefix cache warm — that detail comes from search_knowledge_base.
    assert "## Deity Entries" not in pantheon
    assert "Commandments:" not in pantheon


def test_spoken_deity_name_resolves_to_canonical_pantheon_entry():
    answer = pantheon_deity_answer(
        "Can you tell me about Aden?",
        load_full_pantheon_knowledge(),
    )
    assert answer is not None
    assert answer.startswith("Addan, the Eternal Guardian.")
    assert "order and protection" in answer


def test_diverra_transcription_variant_resolves_to_full_deity_entry():
    answer = pantheon_deity_answer(
        "Who is Diveria?",
        load_full_pantheon_knowledge(),
    )
    assert answer is not None
    assert answer.startswith("Diverra, the Ardent One.")
    assert "love, beauty, passion, and pleasure" in answer


def test_tell_me_more_about_is_recognized_as_a_deity_intent():
    """"Can you tell me more about X" is as common as "tell me about X" and used
    to fall through to the model even for a known god."""
    pantheon = load_full_pantheon_knowledge()
    for phrasing in (
        "can you tell me more about Diverra",
        "tell me a bit more about Diverra",
        "what can you tell me about Diverra",
    ):
        answer = pantheon_deity_answer(phrasing.casefold(), pantheon)
        assert answer is not None, phrasing
        assert answer.startswith("Diverra, the Ardent One."), phrasing


def test_mispronounced_god_resolves_through_the_full_more_about_pipeline():
    """The reported failure: "can you tell me more about Deveria" -> nothing.
    The canonicalizer fixes Deveria->Diverra only inside a recognized intent
    phrase, and "more about" was not one."""
    catalog = load_voice_entity_catalog()
    pantheon = load_full_pantheon_knowledge()
    canonical = canonicalize_spoken_question("can you tell me more about Deveria", catalog)
    assert "Diverra" in canonical
    answer = pantheon_deity_answer(canonical.casefold(), pantheon)
    assert answer is not None
    assert answer.startswith("Diverra, the Ardent One.")


def test_site_wide_voice_catalog_resolves_common_transcription_variants():
    catalog = load_voice_entity_catalog()
    assert "Addan" in catalog
    assert "Myrdae" in catalog
    assert "Souls of Destiny" in catalog
    assert resolve_spoken_entity("Aden", catalog) == "Addan"
    assert resolve_spoken_entity("Mirdi", catalog) == "Myrdae"
    assert resolve_spoken_entity("Soals of Destiny", catalog) == "Souls of Destiny"
    assert resolve_spoken_entity("ordinary weather", catalog) is None


def test_entity_question_is_rewritten_with_canonical_name():
    catalog = load_voice_entity_catalog()
    assert canonicalize_spoken_entity_question(
        "Can you tell me about Aden?",
        catalog,
    ) == "Can you tell me about Addan?"
    assert canonicalize_spoken_entity_question(
        "When does Soals of Destiny play next?",
        catalog,
    ) == "When does Souls of Destiny play next?"
    assert canonicalize_spoken_entity_question(
        "What do you know about Kenton in Mirdi?",
        catalog,
    ) == "What do you know about Kenton in Myrdae?"
    assert canonicalize_spoken_entity_question(
        "I would like to know about the gods of Mirdi.",
        catalog,
    ) == "I would like to know about the gods of Myrdae."


MISHEARINGS = {
    "Imberstran": "Emberstran",
    "Image Brand": "Emberstran",
    "Swanee Gamers": "Suwanee Gamers",
    "Funny Gamers": "Suwanee Gamers",
    "Dungeons 3": "Dungeons III",
    "K-9 Watch": "kNight Watch",
    "Amira": "Myra",
}


def test_known_mishearings_are_corrected_longest_key_first():
    assert apply_mishearings("It's Heroes of Image Brand.", MISHEARINGS) == (
        "It's Heroes of Emberstran."
    )
    # "Dungeons 3" is a substring of the longer key, which must win.
    assert apply_mishearings("not K-9 Watch", {**MISHEARINGS, "K-9 Watch is": "x"}) == (
        "not kNight Watch"
    )
    assert apply_mishearings("nothing to fix", MISHEARINGS) == "nothing to fix"


def test_free_form_corrections_are_repaired_outside_question_phrasings():
    catalog = load_voice_entity_catalog()

    def repair(text: str) -> str:
        return canonicalize_spoken_question(apply_mishearings(text, MISHEARINGS), catalog)

    # None of these match an intent phrase, so before the free-form pass existed
    # the entity catalog never saw them — these are real turns from voice_questions.
    assert repair("That is not correct. It's Heroes of Image Brand.") == (
        "That is not correct. It's Heroes of Emberstran."
    )
    assert repair("Not funny gamers. Swanee gamers.") == "Not Suwanee Gamers. Suwanee Gamers."
    assert repair("When is my next session of Heroes of Imberstran?") == (
        "When is my next session of Heroes of Emberstran?"
    )


def test_intent_pass_does_not_run_past_the_first_sentence():
    catalog = load_voice_entity_catalog()
    # The intent span used to run to end-of-string, so the permissive matcher got
    # the whole tail of a two-sentence turn and produced "Dungeons III III".
    repaired = canonicalize_spoken_question(
        "When is my next session of Heroes of Imberstran? "
        "And does Myra know about Dungeons III - kNight Watch?",
        catalog,
    )
    assert "III III" not in repaired
    assert "Heroes of Emberstran" in repaired
    # The sentence after the intent phrase is left for the strict free-form pass,
    # which must not disturb an already-canonical name.
    assert "Dungeons III - kNight Watch" in repaired
    # The intent span itself still stops at its own sentence.
    assert canonicalize_spoken_question("Tell me about Aden. I play weekly.", catalog) == (
        "Tell me about Addan. I play weekly."
    )


def test_entity_repair_never_rewrites_ordinary_speech():
    catalog = load_voice_entity_catalog()
    for utterance in (
        "No.",
        "That's not true.",
        "What's next?",
        "So the images are rough.",
        "Can you take me to the whole page?",
        "the gods of the world",
        "not part of that game",
        "I am not in that campaign",
        "tell me a joke about dice",
        "what games are on the schedule",
    ):
        assert canonicalize_spoken_question(utterance, catalog) == utterance


def test_entity_repair_never_swallows_a_negation():
    catalog = load_voice_entity_catalog()
    # "not kNight Watch" scores 0.875 against the catalog entry "The kNight
    # Watch" on whole-string similarity alone; replacing "not" with "The" would
    # invert what the speaker said.
    repaired = canonicalize_spoken_question("it's not kNight Watch", catalog)
    assert "not" in repaired
    assert "The kNight Watch" not in repaired
    # Likewise a stray function word must not be absorbed into a name.
    assert canonicalize_spoken_question("Heroes of Emberstran", catalog) == (
        "Heroes of Emberstran"
    )


def test_myra_is_never_canonicalized_into_myrdae():
    catalog = load_voice_entity_catalog()
    assert canonicalize_spoken_question("Myra?", catalog) == "Myra?"
    assert canonicalize_spoken_question("Can you tell me about Myra?", catalog) == (
        "Can you tell me about Myra?"
    )


def test_parse_dispatch_metadata_extracts_mishearings():
    payload = parse_dispatch_metadata(
        '{"events": [], "mishearings": {"Imberstran": "Emberstran", "bad": ""}}'
    )
    assert payload["mishearings"] == {"Imberstran": "Emberstran"}
    assert parse_dispatch_metadata('{"events": []}')["mishearings"] == {}


def test_parse_dispatch_metadata_extracts_tuning():
    payload = parse_dispatch_metadata(
        '{"events": [], "tuning": {"minEndpointingDelay": 0.35, "minInterruptionDuration": 0.9}}'
    )
    assert payload["tuning"] == {"minEndpointingDelay": 0.35, "minInterruptionDuration": 0.9}


def test_parse_dispatch_metadata_tuning_defaults_to_empty():
    payload = parse_dispatch_metadata('{"events": [], "tuning": "nope"}')
    assert payload["tuning"] == {}


def test_parse_dispatch_metadata_extracts_pronunciations():
    payload = parse_dispatch_metadata(
        '{"events": [], "pronunciations": {"Emberstran": "Em-ber-stran"}}'
    )
    assert payload["pronunciations"] == {"Emberstran": "Em-ber-stran"}


def test_parse_dispatch_metadata_extracts_signed_in_member_name():
    payload = parse_dispatch_metadata(
        '{"events": [], "memberName": "Larry"}'
    )
    assert payload["memberName"] == "Larry"


def test_parse_dispatch_metadata_extracts_welcome_kind():
    assert parse_dispatch_metadata(
        '{"events": [], "welcomeKind": "new"}'
    )["welcomeKind"] == "new"
    assert parse_dispatch_metadata(
        '{"events": [], "welcomeKind": "unexpected"}'
    )["welcomeKind"] == "none"


def test_parse_dispatch_metadata_extracts_current_user_profile():
    profile = parse_dispatch_metadata(
        '{"events":[],"userProfile":{"displayName":"Larry McHale",'
        '"playerName":"Larry McHale","favoriteLocations":["Emberstran"],'
        '"games":["Souls of Destiny"],"characters":["Kenton"]}}'
    )["userProfile"]
    assert profile == {
        "displayName": "Larry McHale",
        "playerName": "Larry McHale",
        "favoriteLocations": ["Emberstran"],
        "games": ["Souls of Destiny"],
        "characters": ["Kenton"],
    }


def test_wake_word_command_requires_opening_hey_myra():
    assert wake_word_command("Hey Myra, take me home") == "take me home"
    assert wake_word_command("Hey, Mira. What games are next?") == "What games are next?"
    assert wake_word_command("Hey Myra") == ""
    assert wake_word_command("Take me home") is None
    assert wake_word_command("Someone said hey Myra yesterday") is None


def test_apply_pronunciations_preserves_written_source_and_handles_case():
    source = "Heroes of Emberstran return to EMBERSTRAN."

    spoken = apply_pronunciations(source, {"Emberstran": "Em-ber-stran"})

    assert source == "Heroes of Emberstran return to EMBERSTRAN."
    assert spoken == "Heroes of Em-ber-stran return to Em-ber-stran."


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
        "Yep — today, Souls of Destiny at 1:00 PM. And coming up next, "
        "Dungeons III on Monday, July 27 at 6:00 PM, "
        "Heroes of Emberstran on Thursday, July 30 at 6:00 PM."
    )


def test_personal_schedule_intent_recognizes_user_focused_questions():
    assert is_personal_schedule_question("What are my games scheduled?")
    assert is_personal_schedule_question("When do I play next?")
    assert is_personal_schedule_question("What games am I in?")
    assert not is_personal_schedule_question("What games are scheduled?")


def test_personalized_schedule_only_includes_the_users_games():
    now = datetime(2026, 7, 28, 9, 0, tzinfo=ZoneInfo("America/New_York"))
    schedule = {
        "timezone": "America/New_York",
        "events": [
            {"title": "Souls of Destiny", "start": "2026-07-29T18:00:00-04:00"},
            {"title": "Mad Mage", "start": "2026-07-30T19:00:00-04:00"},
            {"title": "Souls of Destiny", "start": "2026-08-05T18:00:00-04:00"},
        ],
    }
    answer = personalized_schedule_answer(schedule, ["Souls of Destiny"], now)
    assert "Souls of Destiny" in answer
    assert "Mad Mage" not in answer


def test_personalized_schedule_explains_when_profile_has_no_games():
    assert personalized_schedule_answer(
        {"timezone": "America/New_York", "events": []},
        [],
    ) == "Hmm, I don't see any active campaign assignments linked to your profile yet."


def test_is_self_diagnosis_question_detects_feeling_and_status_intents():
    assert is_self_diagnosis_question("How do you feel?")
    assert is_self_diagnosis_question("Hey, are you okay today?")
    assert is_self_diagnosis_question("Run a diagnostic on yourself")
    assert is_self_diagnosis_question("Is everything working?")
    assert is_self_diagnosis_question("You seem slow today.")
    assert is_self_diagnosis_question("Check your brain.")


def test_diagnostic_request_infers_depth_and_component():
    assert diagnostic_request("Run a full diagnostic") == ("full", None)
    assert diagnostic_request("Can you check your memory?") == ("component", "memory")
    assert diagnostic_request("Why can't you hear me?") == ("component", "voice")
    assert diagnostic_request("Is the website okay?") == ("component", "website")


def test_is_self_diagnosis_question_ignores_schedule_questions():
    assert not is_self_diagnosis_question("What is scheduled today?")
    assert not is_self_diagnosis_question("When does Mad Mage play next?")


def test_summarize_health_reports_all_clear():
    spoken, status = summarize_health(
        speech_ok=True,
        thinking_ok=True,
        calendar_ok=True,
        knowledge_ok=True,
        upcoming_count=3,
    )
    assert status == "healthy"
    assert "3 games coming up" in spoken
    assert "No problems to report" in spoken


def test_summarize_health_flags_thinking_engine_down_as_impaired():
    spoken, status = summarize_health(
        speech_ok=True,
        thinking_ok=False,
        calendar_ok=True,
        knowledge_ok=True,
        upcoming_count=1,
    )
    assert status == "impaired"
    assert "thinking engine" in spoken


def test_summarize_health_flags_missing_knowledge_as_degraded():
    spoken, status = summarize_health(
        speech_ok=True,
        thinking_ok=True,
        calendar_ok=True,
        knowledge_ok=False,
        upcoming_count=0,
    )
    assert status == "degraded"
    assert "notes about the group" in spoken


def test_is_recap_question_detects_recap_intent_not_schedule():
    assert is_recap_question("What happened last time in Souls of Destiny?")
    assert is_recap_question("Give me a recap of Mad Mage")
    assert is_recap_question("Where did we leave off?")
    assert not is_recap_question("When is Souls of Destiny playing?")
    assert not is_recap_question("What's scheduled today?")


def test_recap_answer_returns_latest_summary_for_named_campaign():
    recaps = [
        {
            "name": "Souls of Destiny",
            "aliases": [],
            "title": "Session 5 - The Reckoning",
            "summary": "The party stormed the cult's inner sanctum and freed the captives.",
        },
    ]

    answer, category = recap_answer(recaps, "what happened last time in souls of destiny")
    assert category == "recap"
    assert "Souls of Destiny" in answer
    assert "cult's inner sanctum" in answer


def test_recap_answer_matches_aliases_and_reports_missing_summaries():
    recaps = [
        {"name": "Dungeons III - kNight Watch", "aliases": ["Dungeons III"], "title": "", "summary": ""},
    ]

    answer, category = recap_answer(recaps, "recap dungeons iii for me")
    assert category == "recap"
    assert "don't have a session recap" in answer


def test_recap_answer_returns_none_when_no_campaign_named():
    recaps = [{"name": "Mad Mage", "aliases": [], "title": "S1", "summary": "Stuff happened."}]
    assert recap_answer(recaps, "what happened last time") is None


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
        "Yep — the next Souls of Destiny game is Sunday, July 26 at 1:00 PM.",
        "campaign",
    )


def test_campaign_name_alone_is_not_a_schedule_intent():
    assert not is_schedule_question("Tell me about Souls of Destiny")
    assert is_schedule_question("When does Souls of Destiny play next?")


def test_navigation_resolves_exact_pages_and_surfaces_ambiguity():
    navigation = [
        {"label": "Home", "href": "/"},
        {"label": "Campaigns", "href": "/campaigns"},
        {"label": "Campaign Journeys", "href": "/campaign-journeys"},
        {"label": "Our Story", "href": "/ourstory"},
        {"label": "Pantheon", "href": "/pantheon"},
        {"label": "My Profile", "href": "/profile"},
    ]
    assert resolve_navigation(navigation, "our story") == (
        {"label": "Our Story", "href": "/ourstory"},
        [],
    )
    assert resolve_navigation(navigation, "home page") == (
        {"label": "Home", "href": "/"},
        [],
    )
    assert resolve_navigation(navigation, "the gods section of the site") == (
        {"label": "Pantheon", "href": "/pantheon"},
        [],
    )
    assert resolve_navigation(navigation, "panthy on") == (
        {"label": "Pantheon", "href": "/pantheon"},
        [],
    )
    for profile_request in (
        "profile",
        "my profile",
        "user profile",
        "my account",
        "settings",
    ):
        assert resolve_navigation(navigation, profile_request) == (
            {"label": "My Profile", "href": "/profile"},
            [],
        )
    match, choices = resolve_navigation(navigation, "campaign")
    assert match is None
    assert choices == ["Campaigns", "Campaign Journeys"]
    assert navigation_request_target("Please open the Our Story page") == "Our Story"
    assert navigation_request_target(
        "I want you to navigate me back to the home page."
    ) == "home"
    assert navigation_request_target(
        "Can you take me back to the home page?"
    ) == "home"
    assert (
        navigation_request_target("Take me to the gods section of the site")
        == "gods section of the site"
    )
    natural_request = navigation_request_target(
        "Can you take me to the page where the gods are?"
    )
    assert natural_request == "page where the gods are"
    assert resolve_navigation(navigation, natural_request) == (
        {"label": "Pantheon", "href": "/pantheon"},
        [],
    )
    assert navigation_request_target("Who is Kenton?") is None


def test_about_suwanee_gamers_intent_does_not_match_schedule():
    assert is_about_suwanee_gamers_question(
        "I want to know about Suwanee Gamers"
    )
    assert is_about_suwanee_gamers_question("Tell me about the group")
    assert not is_about_suwanee_gamers_question(
        "What is scheduled for Suwanee Gamers tonight?"
    )


def test_about_suwanee_gamers_answer_uses_our_story_content():
    answer = about_suwanee_gamers_answer(
        "Suwanee Gamers began in 2012. It grew from family game nights. "
        "This third sentence is intentionally omitted."
    )
    assert answer == (
        "Suwanee Gamers began in 2012. It grew from family game nights. "
        "And if you'd like the full story, it's on the Our Story page."
    )


def test_about_suwanee_gamers_answer_falls_back_to_brain_section():
    answer = about_suwanee_gamers_answer(
        "",
        "# Brain\n\n## What Suwanee Gamers is\n\n"
        "Suwanee Gamers is a local tabletop RPG group. "
        "The group plays in Myrdae.\n\n## How to help\n\nIgnore this.",
    )
    assert answer == (
        "Suwanee Gamers is a local tabletop RPG group. "
        "The group plays in Myrdae. "
        "And if you'd like the full story, it's on the Our Story page."
    )


def test_knowledge_search_is_cancellable_and_rejects_duplicates():
    from livekit.agents.llm import ToolFlag

    from schedule_agent.agent import Myra

    tool_info = Myra.search_knowledge_base.info
    assert tool_info.flags & ToolFlag.CANCELLABLE
    assert tool_info.on_duplicate == "reject"


def test_background_tool_result_only_belongs_to_the_turn_that_started_it():
    assert tool_result_is_current(7, 7)
    assert not tool_result_is_current(7, 8)


def test_event_loop_lag_never_reports_early_wakeup_as_blocking():
    assert round(event_loop_lag(10.0, 10.35), 2) == 0.35
    assert event_loop_lag(10.0, 9.95) == 0.0


def test_llm_metric_forwards_claude_tokens_and_model_for_cost_accounting():
    metric = type(
        "LLMMetrics",
        (),
        {
            "cancelled": False,
            "ttft": 0.42,
            "prompt_tokens": 12_000,
            "completion_tokens": 800,
            "prompt_cached_tokens": 2_000,
            "metadata": SimpleNamespace(
                model_provider="anthropic",
                model_name="claude-haiku-4-5",
            ),
        },
    )()

    assert metric_forward_payload(metric, "session-1") == {
        "sessionId": "session-1",
        "kind": "llm_ttft",
        "valueMs": 420,
        "cachedTokens": 2_000,
        "provider": "anthropic",
        "model": "claude-haiku-4-5",
        "inputTokens": 12_000,
        "outputTokens": 800,
        "cacheReadTokens": 2_000,
        "cacheCreationTokens": 0,
    }


def test_llm_is_local_only_when_no_anthropic_key_is_configured(monkeypatch):
    from schedule_agent.agent import build_llm

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    built = build_llm({})
    assert not isinstance(built, FallbackAdapter)
    assert built.model == "suwanee-schedule"


def test_llm_falls_back_from_claude_to_local_ollama(monkeypatch):
    from schedule_agent.agent import build_llm

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    built = build_llm({})
    assert isinstance(built, FallbackAdapter)
    primary, secondary = built._llm_instances
    assert primary.model == "claude-haiku-4-5"
    assert secondary.model == "suwanee-schedule"


def test_claude_temperature_ignores_the_ollama_autotuner(monkeypatch):
    """The nightly tuner calibrates against Qwen; it must not steer Claude too."""
    from schedule_agent.agent import build_llm

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.delenv("ANTHROPIC_TEMPERATURE", raising=False)
    claude, ollama = build_llm({"ollamaTemperature": 0.95})._llm_instances
    assert ollama._opts.temperature == 0.95
    assert claude._opts.temperature == 0.3


def _fake_vad():
    # build_stt only needs *something* to hand the FallbackAdapter as its VAD;
    # the adapter stores it without touching it at construction time.
    class _VAD:
        pass

    return _VAD()


def test_stt_uses_parakeet_primary_with_whisper_fallback(monkeypatch):
    from livekit.agents.stt import FallbackAdapter as STTFallbackAdapter

    from schedule_agent.agent import build_stt

    monkeypatch.setenv("PARAKEET_BASE_URL", "http://127.0.0.1:8767/v1")
    monkeypatch.delenv("STT_ENGINE", raising=False)
    built = build_stt("Names: Aurelius Valeheart.", _fake_vad())
    assert isinstance(built, STTFallbackAdapter)
    # Non-streaming children get wrapped in a StreamAdapter by the FallbackAdapter.
    primary, secondary = (getattr(t, "wrapped_stt", t) for t in built._stt_instances)
    assert primary._opts.model == "nvidia/parakeet-tdt-0.6b-v2"
    assert secondary._opts.model == "Systran/faster-whisper-small.en"
    # The vocabulary reaches BOTH engines.
    assert primary._opts.prompt == "Names: Aurelius Valeheart."
    assert secondary._opts.prompt == "Names: Aurelius Valeheart."


def test_stt_falls_back_to_whisper_only_when_parakeet_disabled(monkeypatch):
    from schedule_agent.agent import build_stt

    # Either switch turns Parakeet off and drops the fallback layer entirely.
    for key, val in (("STT_ENGINE", "whisper"), ("PARAKEET_BASE_URL", "off")):
        monkeypatch.delenv("STT_ENGINE", raising=False)
        monkeypatch.setenv("PARAKEET_BASE_URL", "http://127.0.0.1:8767/v1")
        monkeypatch.setenv(key, val)
        built = build_stt("Names: X.", _fake_vad())
        assert type(built).__name__ != "FallbackAdapter", (key, val)
        assert built._opts.model == "Systran/faster-whisper-small.en"


def test_parakeet_phrase_parsing_matches_the_vocabulary_prompt_format():
    """The service must recover the exact names build_stt's prompt encodes."""
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "parakeet-stt"))
    # server.py imports torch/nemo at module load; only the pure parser is under
    # test, so pull it in isolation.
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "_pk_server",
        Path(__file__).resolve().parents[2] / "parakeet-stt" / "server.py",
    )
    # Guard: if torch isn't importable in this env, skip rather than fail.
    import pytest

    try:
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
    except Exception:
        pytest.skip("parakeet server deps not installed in this venv")

    from schedule_agent.agent import stt_vocabulary_prompt

    prompt = stt_vocabulary_prompt(["Heroes of Emberstran"])
    phrases = mod.parse_phrases(prompt)
    assert "Aurelius Valeheart" in phrases
    assert "Myrdae" in phrases
    # No prefix leakage, no empty entries, no trailing-dot artifacts.
    assert all(p and not p.endswith(".") and ":" not in p for p in phrases)
    assert mod.parse_phrases("") == ()
    assert mod.parse_phrases(None) == ()


def test_claude_prompt_caching_is_on_by_default(monkeypatch):
    """Myra's ~6.4k-token prefix was reprocessed cold on every turn."""
    from schedule_agent.agent import build_llm

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.delenv("ANTHROPIC_CACHING", raising=False)
    claude, _ = build_llm({})._llm_instances
    assert claude._opts.caching == "ephemeral"


def test_claude_prompt_caching_can_be_switched_off_without_a_redeploy(monkeypatch):
    from schedule_agent.agent import build_llm

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    for value in ("off", "none", "0", "false", "OFF"):
        monkeypatch.setenv("ANTHROPIC_CACHING", value)
        claude, _ = build_llm({})._llm_instances
        # NOT_GIVEN, never the string "off" — the plugin only checks == "ephemeral".
        assert claude._opts.caching != "ephemeral"


def test_spoken_name_variants_splits_roster_nicknames():
    from schedule_agent.agent import _spoken_name_variants

    assert _spoken_name_variants('Az\'efal (Affy) Fairhand') == ["Az'efal Fairhand", "Affy"]
    assert _spoken_name_variants('Teldo "Fungus Roundbelly"') == ["Teldo", "Fungus Roundbelly"]
    assert _spoken_name_variants('Melessekoviendarre "Meles"') == [
        "Melessekoviendarre",
        "Meles",
    ]
    # A plain name is returned unchanged, and an apostrophe is not a nickname.
    assert _spoken_name_variants("Cerul Slate") == ["Cerul Slate"]
    assert _spoken_name_variants("Draelith al'Varren") == ["Draelith al'Varren"]
    assert _spoken_name_variants("") == []
    assert _spoken_name_variants(None) == []


def test_active_player_characters_are_in_the_entity_catalog():
    """Whisper returned "Valehart"; with no "Valeheart" to match, it was dropped."""
    from schedule_agent.agent import load_active_character_names, load_voice_entity_catalog

    active = load_active_character_names()
    assert "Aurelius Valeheart" in active
    # Only Active rows — a retired character must not widen the fuzzy surface.
    assert "Aria Windrunner" not in active
    # Nicknames too short to match safely against ordinary speech are excluded.
    assert all(len(name) >= 5 for name in active)
    assert "Ains" not in active

    catalog = load_voice_entity_catalog()
    assert "Aurelius Valeheart" in catalog


def test_canonicalizer_repairs_the_mangled_name_instead_of_deleting_it():
    """The exact string Speaches returned for this audio on 2026-08-01."""
    from schedule_agent.agent import canonicalize_spoken_question, load_voice_entity_catalog

    catalog = load_voice_entity_catalog()
    fixed = canonicalize_spoken_question(
        "Tell me about Aurelius Valehart from Heroes of Imberstran.",
        catalog,
    )
    assert "Aurelius Valeheart" in fixed
    assert "Heroes of Emberstran" in fixed
    assert "Valehart" not in fixed


def test_stt_vocabulary_puts_the_speakers_own_campaign_and_party_first(monkeypatch):
    """Biasing cost scales with length, so the visitor's own names come first."""
    from schedule_agent.agent import stt_vocabulary_prompt

    monkeypatch.delenv("STT_VOCABULARY", raising=False)
    monkeypatch.delenv("STT_VOCABULARY_MAX_CHARS", raising=False)
    prompt = stt_vocabulary_prompt(["Heroes of Emberstran"])
    names = prompt.removeprefix("Names: ").rstrip(".").split(", ")

    assert names[0] == "Myra"
    assert names[1] == "Myrdae"
    assert names[2] == "Suwanee Gamers"
    assert names[3] == "Heroes of Emberstran"
    # That campaign's party follows immediately, before any other campaign.
    assert "Aurelius Valeheart" in names[4:10]
    assert names.index("Aurelius Valeheart") < names.index("A New Adventure")


def test_stt_vocabulary_excludes_archived_campaigns():
    """15 of 22 roster rows are archived and sorted to the front of the budget."""
    from schedule_agent.agent import load_campaign_roster_index, stt_vocabulary_prompt

    live = {name for name, _ in load_campaign_roster_index()}
    assert "Heroes of Emberstran" in live
    assert "Beer & Dice I" not in live
    assert "Crystal Bottle" not in live

    prompt = stt_vocabulary_prompt([])
    assert "Beer & Dice" not in prompt
    assert "Heroes of Emberstran" in prompt


def test_stt_vocabulary_respects_its_budget(monkeypatch):
    from schedule_agent.agent import stt_vocabulary_prompt

    monkeypatch.delenv("STT_VOCABULARY", raising=False)
    monkeypatch.delenv("STT_VOCABULARY_MAX_CHARS", raising=False)
    for budget in (350, 240, 120, 60, 8, 0):
        assert len(stt_vocabulary_prompt([], max_chars=budget)) <= budget, budget
    assert len(stt_vocabulary_prompt([])) <= 350
    # Myrdae is first, so it survives any budget that fits a single name.
    assert "Myrdae" in stt_vocabulary_prompt([], max_chars=120)


def test_stt_vocabulary_can_be_switched_off_without_a_redeploy(monkeypatch):
    from schedule_agent.agent import stt_vocabulary_prompt

    for value in ("off", "none", "0", "false", "OFF"):
        monkeypatch.setenv("STT_VOCABULARY", value)
        assert stt_vocabulary_prompt(["Heroes of Emberstran"]) == ""


def test_dungeon_master_is_not_mistaken_for_a_campaign_name():
    """"who is the dungeon master" became "who is the Dungeons III Master Thorne"."""
    from schedule_agent.agent import canonicalize_spoken_question, load_voice_entity_catalog

    catalog = load_voice_entity_catalog()
    for phrase in (
        "who is the dungeon master",
        "who are the dungeon masters",
        "who is the dm",
        "what characters are in the party",
        "who are the players",
    ):
        assert canonicalize_spoken_question(phrase, catalog) == phrase, phrase


def test_adding_player_characters_does_not_corrupt_ordinary_speech():
    """The fuzzy matcher must never rewrite words that are not names.

    Adding 29 character names widens its surface; these are the everyday
    utterances that must survive it untouched.
    """
    from schedule_agent.agent import canonicalize_spoken_question, load_voice_entity_catalog

    catalog = load_voice_entity_catalog()
    for phrase in (
        "what is my next game",
        "no thanks, not right now",
        "can you open the calendar for me",
        "yes please",
        "who is playing tonight",
        "tell me about the gods",
        "i do not want a recap",
        "what time does it start",
    ):
        assert canonicalize_spoken_question(phrase, catalog) == phrase, phrase


def test_bare_affirmation_accepts_agreement_only():
    from schedule_agent.agent import is_bare_affirmation

    for yes in ("yes", "Yeah.", "Sure!", "yes please", "OK", "go ahead", "  yep  "):
        assert is_bare_affirmation(yes), yes
    # A "yes" carrying its own question must keep the visitor's actual words —
    # this decides whether to substitute a question they never asked.
    for no in (
        "yeah, what about the gods?",
        "yes tell me about Aurelius",
        "no",
        "no thanks",
        "",
        "what's my next game?",
    ):
        assert not is_bare_affirmation(no), no


def test_greeting_offers_route_to_the_deterministic_schedule_path():
    """The greeting promises a fast answer; both offers must avoid the model."""
    from schedule_agent.agent import (
        is_personal_schedule_question,
        is_schedule_question,
    )

    assert is_personal_schedule_question("when do i play next")
    # The no-linked-campaigns variant must NOT hit the personal branch, which
    # would answer "I don't see any assignments linked to your profile".
    assert not is_personal_schedule_question("what games are coming up")
    assert is_schedule_question("what games are coming up")


def test_page_context_block_rejects_anything_but_an_internal_path():
    from schedule_agent.agent import page_context_block

    assert page_context_block({"path": "/pantheon"})
    # Protocol-relative and absolute URLs must never reach the prompt.
    assert page_context_block({"path": "//evil.example"}) == ""
    assert page_context_block({"path": "https://evil.example"}) == ""
    assert page_context_block({"path": ""}) == ""
    assert page_context_block("not a dict") == ""
    assert page_context_block(None) == ""


def test_page_context_block_bounds_browser_supplied_text():
    from schedule_agent.agent import page_context_block

    block = page_context_block(
        {"path": "/campaigns/x", "title": "T" * 500, "subject": "S" * 500}
    )
    assert "T" * 120 in block
    assert "T" * 121 not in block
    assert "S" * 121 not in block


def test_page_context_block_never_claims_to_see_the_screen():
    from schedule_agent.agent import page_context_block

    block = page_context_block({"path": "/pantheon", "title": "Pantheon"}).casefold()
    assert "cannot see their screen" in block


def test_dispatch_metadata_defaults_page_to_empty_when_malformed():
    from schedule_agent.agent import parse_dispatch_metadata

    assert parse_dispatch_metadata(json.dumps({"page": "nope"}))["page"] == {}
    assert parse_dispatch_metadata(json.dumps({}))["page"] == {}
    assert parse_dispatch_metadata(
        json.dumps({"page": {"path": "/lore"}})
    )["page"] == {"path": "/lore"}


def test_llm_short_name_distinguishes_claude_from_the_local_model():
    from schedule_agent.agent import llm_short_name

    assert llm_short_name("livekit.plugins.anthropic.llm.LLM") == "claude"
    # The openai plugin is pointed at Ollama, so it means "local" here.
    assert llm_short_name("livekit.plugins.openai.llm.LLM") == "ollama"
    assert llm_short_name("") == "unknown"
