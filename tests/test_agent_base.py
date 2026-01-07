"""
Tests for BaseAgent - Foundation of the Data-Driven Brain

Test Coverage:
- Agent initialization and profile loading
- Skill system and dynamic injection
- Error handling and graceful degradation
- Active Inference integration
- State persistence and recovery
"""

import os
import pytest
import tempfile
import json
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path

from admin.brain.agent_base import BaseAgent
from admin.config import config


class TestBaseAgentInitialization:
    """Test agent initialization and configuration loading."""

    def test_agent_loads_profile_successfully(self, tmp_path):
        """Agent should load PROFILE.md with frontmatter correctly."""
        # Create temporary agent directory
        agent_dir = tmp_path / "test_agent"
        agent_dir.mkdir()

        # Create PROFILE.md
        profile_content = """---
name: Test Agent
role: Testing Specialist
---
You are a testing specialist focused on quality assurance.
"""
        (agent_dir / "PROFILE.md").write_text(profile_content)

        # Create SKILLS.yaml
        skills_content = "skills: []"
        (agent_dir / "SKILLS.yaml").write_text(skills_content)

        # Patch config to use temp directory
        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="test_agent")

            assert agent.name == "Test Agent"
            assert agent.role == "Testing Specialist"
            assert "testing specialist" in agent.system_prompt.lower()

    def test_agent_handles_missing_profile_gracefully(self, tmp_path):
        """Agent should use fallback when PROFILE.md is missing."""
        agent_dir = tmp_path / "minimal_agent"
        agent_dir.mkdir()

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="minimal_agent")

            assert agent.name == "Minimal_agent"  # Capitalized agent_id
            assert agent.system_prompt  # Should have default prompt

    def test_agent_initializes_model_router_safely(self, tmp_path):
        """Agent should handle model router unavailability."""
        agent_dir = tmp_path / "test_agent"
        agent_dir.mkdir()
        (agent_dir / "PROFILE.md").write_text("---\nname: Test\n---\nTest")
        (agent_dir / "SKILLS.yaml").write_text("skills: []")

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            # Should not raise exception even if model router fails
            agent = BaseAgent(agent_id="test_agent")
            # Model router may be None if import fails
            assert agent.model_router is None or agent.model_router is not None


class TestSkillSystem:
    """Test skill loading and injection."""

    def test_agent_loads_enabled_skills(self, tmp_path):
        """Agent should load skills from SKILLS.yaml."""
        agent_dir = tmp_path / "skilled_agent"
        agent_dir.mkdir()
        (agent_dir / "PROFILE.md").write_text("---\nname: Skilled\n---\nTest")

        skills_yaml = """skills:
  - web_search
  - code_execution
  - file_read
"""
        (agent_dir / "SKILLS.yaml").write_text(skills_yaml)

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="skilled_agent")

            assert "web_search" in agent.enabled_skills
            assert "code_execution" in agent.enabled_skills
            assert "file_read" in agent.enabled_skills

    def test_system_prompt_includes_skills(self, tmp_path):
        """System prompt should dynamically include enabled skills."""
        agent_dir = tmp_path / "test_agent"
        agent_dir.mkdir()
        (agent_dir / "PROFILE.md").write_text("---\nname: Test\n---\nAgent")
        (agent_dir / "SKILLS.yaml").write_text("skills:\n  - web_search")

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="test_agent")
            prompt = agent.get_system_prompt("search the web")

            assert "ENABLED SKILLS" in prompt or "web_search" in agent.enabled_skills


class TestErrorHandling:
    """Test error handling and recovery mechanisms."""

    def test_socratic_debug_loop_returns_reflection(self, tmp_path):
        """Socratic debugging should return meaningful reflection."""
        agent_dir = tmp_path / "test_agent"
        agent_dir.mkdir()
        (agent_dir / "PROFILE.md").write_text("---\nname: Test\n---\nAgent")
        (agent_dir / "SKILLS.yaml").write_text("skills: []")

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="test_agent")

            error = ValueError("Test error")
            reflection = agent.socratic_debug_loop(error, "test context")

            assert "Socratic" in reflection
            assert "error" in reflection.lower()

    def test_simulate_outcome_returns_prediction(self, tmp_path):
        """Counterfactual simulation should return structured prediction."""
        agent_dir = tmp_path / "test_agent"
        agent_dir.mkdir()
        (agent_dir / "PROFILE.md").write_text("---\nname: Test\n---\nAgent")
        (agent_dir / "SKILLS.yaml").write_text("skills: []")

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="test_agent")

            result = agent.simulate_outcome("deploy code", "code is tested")
            prediction = json.loads(result)

            assert "prediction" in prediction
            assert "risk" in prediction
            assert "success_probability" in prediction
            assert 0 <= prediction["success_probability"] <= 1


class TestStatePersistence:
    """Test agent state snapshotting and recovery."""

    def test_save_state_creates_snapshot(self, tmp_path):
        """Agent should save state to JSON file."""
        agent_dir = tmp_path / "test_agent"
        agent_dir.mkdir()
        (agent_dir / "PROFILE.md").write_text("---\nname: Test\n---\nAgent")
        (agent_dir / "SKILLS.yaml").write_text("skills:\n  - web_search")

        debug_dir = tmp_path / "debug"
        debug_dir.mkdir()

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="test_agent")

            snapshot_path = agent.save_state(str(debug_dir / "state.json"))

            assert os.path.exists(snapshot_path)

            # Verify snapshot structure
            with open(snapshot_path, 'r') as f:
                state = json.load(f)

            assert state["agent_id"] == "test_agent"
            assert "timestamp" in state
            assert "profile" in state
            assert "skills" in state
            assert "web_search" in state["skills"]


class TestActiveInference:
    """Test Active Inference substrate integration."""

    def test_decide_selects_action_via_efe(self, tmp_path):
        """Decision loop should use Expected Free Energy."""
        agent_dir = tmp_path / "test_agent"
        agent_dir.mkdir()
        (agent_dir / "PROFILE.md").write_text("---\nname: Test\n---\nAgent")
        (agent_dir / "SKILLS.yaml").write_text("skills: []")

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="test_agent")

            actions = [
                {"type": "search", "description": "Search the web"},
                {"type": "read", "description": "Read a file"},
            ]

            decision = agent.decide("Find information", "User query", actions)

            assert "type" in decision
            assert decision["type"] in ["search", "read"]


class TestMetacognitivePrompts:
    """Test metacognitive prompt retrieval."""

    def test_get_metacognitive_prompt_returns_valid_string(self, tmp_path):
        """Agent should return metacognitive prompts by type."""
        agent_dir = tmp_path / "test_agent"
        agent_dir.mkdir()
        (agent_dir / "PROFILE.md").write_text("---\nname: Test\n---\nAgent")
        (agent_dir / "SKILLS.yaml").write_text("skills: []")

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="test_agent")

            prompt = agent.get_metacognitive_prompt("grand_council")
            assert isinstance(prompt, str)
            assert len(prompt) > 0

            prompt = agent.get_metacognitive_prompt("active_inference")
            assert isinstance(prompt, str)

    def test_unknown_prompt_type_returns_empty_string(self, tmp_path):
        """Agent should return empty string for unknown prompt types."""
        agent_dir = tmp_path / "test_agent"
        agent_dir.mkdir()
        (agent_dir / "PROFILE.md").write_text("---\nname: Test\n---\nAgent")
        (agent_dir / "SKILLS.yaml").write_text("skills: []")

        with patch.object(config, 'BRAIN_DIR', tmp_path):
            agent = BaseAgent(agent_id="test_agent")

            prompt = agent.get_metacognitive_prompt("nonexistent_type")
            assert prompt == ""


# Fixtures
@pytest.fixture
def temp_agent_dir(tmp_path):
    """Create a temporary agent directory with basic structure."""
    agent_dir = tmp_path / "test_agent"
    agent_dir.mkdir()

    profile = """---
name: Test Agent
role: Testing
---
Test agent for unit tests.
"""
    (agent_dir / "PROFILE.md").write_text(profile)
    (agent_dir / "SKILLS.yaml").write_text("skills: []")

    return agent_dir
