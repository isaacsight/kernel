import pytest
from admin.engineers.copilot import Copilot
from admin.brain.agents.copilot.schemas import Question, Triggers, Scoring, EssayHint


@pytest.fixture
def copilot_instance(monkeypatch):
    # Mock Librarian and configure_gemini to avoid IO/API calls
    monkeypatch.setattr("admin.engineers.copilot.Librarian", lambda: None)
    monkeypatch.setattr("admin.engineers.copilot.Copilot._configure_gemini", lambda x: None)

    # Mock engine config loading
    def mock_init(self):
        self.engine_config = None  # Will be set in tests

    monkeypatch.setattr("admin.engineers.copilot.Copilot.__init__", mock_init)

    cp = Copilot()
    return cp


def test_deterministic_scoring(copilot_instance):
    # Setup a mock question
    q = Question(
        id="Q_TRUST",
        mode=["read"],
        stage="diagnostic",
        text="How do you handle trust?",
        slot_targets=["risk_tolerance"],
        triggers=Triggers(any=["trust", "safety"]),
        essay_hints_pinned=[EssayHint(essay_id="E_ALIGNMENT", weight=1.0)],
        scoring=Scoring(base=0.5, slot_bonus={"risk_tolerance": 0.3}, trigger_bonus=0.1),
    )

    # 1. Base Score (no tags, slots filled)
    slots = {"risk_tolerance": "high"}
    tags = set()
    score, hit = copilot_instance.calculate_question_score(q, slots, tags)
    assert score == pytest.approx(0.5)
    assert hit is False

    # 2. Trigger Match (+0.1)
    tags = {"trust"}
    score, hit = copilot_instance.calculate_question_score(q, slots, tags)
    assert score == pytest.approx(0.6)
    assert hit is True

    # 3. Missing Slot Bonus (+0.3)
    slots = {}
    tags = set()
    score, hit = copilot_instance.calculate_question_score(q, slots, tags)
    assert score == pytest.approx(0.8)  # 0.5 base + 0.3 slot_bonus
    assert hit is False

    # 4. Hybrid (Trigger + Missing Slot)
    tags = {"safety"}
    score, hit = copilot_instance.calculate_question_score(q, slots, tags)
    assert score == pytest.approx(0.9)  # 0.5 + 0.1 + 0.3
    assert hit is True


def test_stop_conditions_logic(copilot_instance, monkeypatch):
    # Mock config
    from admin.brain.agents.copilot.schemas import EngineConfig, Routing

    mock_conf = EngineConfig(
        engine_version="0.1.0",
        brand="Studio",
        modes=["read"],
        routing=Routing(
            max_questions_per_turn=3,
            default_question_count=3,
            stop_conditions=["slots.intent.filled && slots.context.filled", "turn_count >= 3"],
        ),
        slots_schema={},
        essay_index=[],
        mapping_rules=[],
        question_bank=[],
    )
    copilot_instance.engine_config = mock_conf

    # 1. Slot check
    assert (
        copilot_instance.check_stop_conditions({"intent": "foo", "context": "bar"}, "", 0) is True
    )
    assert copilot_instance.check_stop_conditions({"intent": "foo"}, "", 0) is False

    # 2. Turn count check (history_len=4 means turn 3: (4//2)+1 = 3)
    assert copilot_instance.check_stop_conditions({}, "", 4) is True
    assert copilot_instance.check_stop_conditions({}, "", 2) is False
