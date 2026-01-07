"""
Tests for DTFRLoopManager - Core Orchestration

Test Coverage:
- Think → Act → Critique pipeline
- Mission lifecycle management
- Error handling and recovery
- Decision logging and persistence
- WebSocket streaming callbacks
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime

from core.loop_manager import DTFRLoopManager
from core.dtfr_schemas import DTFRPlan, ExecutionResult, DTFRLoopReport, PlanStep


class TestDTFRLoopInitialization:
    """Test loop manager initialization."""

    def test_loop_manager_initializes_successfully(self):
        """Loop manager should initialize with principal and kernel."""
        with patch('core.loop_manager.MetacognitivePrincipal'):
            with patch('core.loop_manager.AntigravityEngineer'):
                manager = DTFRLoopManager()

                assert manager.principal is not None
                assert manager.kernel is not None


class TestThinkActCritiquePipeline:
    """Test the core DTFR loop phases."""

    @pytest.mark.asyncio
    async def test_run_executes_all_three_phases(self):
        """Loop should execute Planning → Execution → Critique."""
        with patch('core.loop_manager.MetacognitivePrincipal') as MockPrincipal:
            with patch('core.loop_manager.AntigravityEngineer') as MockKernel:
                # Setup mocks
                mock_principal = MockPrincipal.return_value
                mock_kernel = MockKernel.return_value

                # Mock plan
                mock_plan = DTFRPlan(
                    mission="Test Mission",
                    context="Test context",
                    steps=[
                        PlanStep(
                            id="step1",
                            tool_name="test_tool",
                            arguments={"key": "value"},
                            rationale="Test rationale",
                            expected_outcome="Success"
                        )
                    ],
                    success_criteria=["Step completes"]
                )
                mock_principal.think_plan = AsyncMock(return_value=mock_plan)

                # Mock execution results
                mock_results = [
                    ExecutionResult(
                        step_id="step1",
                        tool_name="test_tool",
                        status="success",
                        output="Test output",
                        duration=0.5
                    )
                ]
                mock_kernel.execute_plan = AsyncMock(return_value=mock_results)

                # Mock critique
                mock_principal.critique = AsyncMock(return_value="All steps succeeded.")

                manager = DTFRLoopManager()
                report = await manager.run("Test task")

                # Verify all phases executed
                mock_principal.think_plan.assert_called_once_with("Test task")
                mock_kernel.execute_plan.assert_called_once()
                mock_principal.critique.assert_called_once()

                # Verify report structure
                assert report.task == "Test task"
                assert report.status == "COMPLETED"
                assert len(report.actions) == 1

    @pytest.mark.asyncio
    async def test_run_handles_execution_failure(self):
        """Loop should handle execution failures gracefully."""
        with patch('core.loop_manager.MetacognitivePrincipal') as MockPrincipal:
            with patch('core.loop_manager.AntigravityEngineer') as MockKernel:
                mock_principal = MockPrincipal.return_value
                mock_kernel = MockKernel.return_value

                # Mock plan
                mock_plan = DTFRPlan(
                    mission="Test Mission",
                    context="Test context",
                    steps=[
                        PlanStep(
                            id="step1",
                            tool_name="failing_tool",
                            arguments={},
                            rationale="Will fail",
                            expected_outcome="Failure"
                        )
                    ],
                    success_criteria=["Step completes"]
                )
                mock_principal.think_plan = AsyncMock(return_value=mock_plan)

                # Mock failed execution
                mock_results = [
                    ExecutionResult(
                        step_id="step1",
                        tool_name="failing_tool",
                        status="failure",
                        output="Error occurred",
                        duration=0.1
                    )
                ]
                mock_kernel.execute_plan = AsyncMock(return_value=mock_results)
                mock_principal.critique = AsyncMock(return_value="Execution failed.")

                manager = DTFRLoopManager()
                report = await manager.run("Test task")

                assert report.status == "PARTIAL_FAILURE"
                assert report.actions[0].status == "failure"


class TestWebSocketStreaming:
    """Test real-time status updates via callbacks."""

    @pytest.mark.asyncio
    async def test_run_calls_on_step_callback(self):
        """Loop should call on_step callback for each step."""
        with patch('core.loop_manager.MetacognitivePrincipal') as MockPrincipal:
            with patch('core.loop_manager.AntigravityEngineer') as MockKernel:
                mock_principal = MockPrincipal.return_value
                mock_kernel = MockKernel.return_value

                mock_plan = DTFRPlan(
                    mission="Test",
                    context="Test",
                    steps=[
                        PlanStep(
                            id="step1",
                            tool_name="tool1",
                            arguments={},
                            rationale="Test",
                            expected_outcome="Success"
                        ),
                        PlanStep(
                            id="step2",
                            tool_name="tool2",
                            arguments={},
                            rationale="Test",
                            expected_outcome="Success"
                        )
                    ],
                    success_criteria=["All complete"]
                )
                mock_principal.think_plan = AsyncMock(return_value=mock_plan)

                mock_results_1 = [ExecutionResult(
                    step_id="step1",
                    tool_name="tool1",
                    status="success",
                    output="Output 1",
                    duration=0.1
                )]
                mock_results_2 = [ExecutionResult(
                    step_id="step2",
                    tool_name="tool2",
                    status="success",
                    output="Output 2",
                    duration=0.1
                )]

                # Mock execute_plan to return different results based on call
                mock_kernel.execute_plan = AsyncMock(side_effect=[mock_results_1, mock_results_2])
                mock_principal.critique = AsyncMock(return_value="Success")

                # Create callback spy
                callback = AsyncMock()

                manager = DTFRLoopManager()
                await manager.run("Test task", on_step=callback)

                # Verify callback was called for each step (executing + success)
                assert callback.call_count >= 2  # At least executing and success for one step


class TestDecisionLogging:
    """Test decision ledger persistence."""

    @pytest.mark.asyncio
    async def test_cognitive_ledger_records_case_study(self):
        """Loop should log outcomes to cognitive ledger."""
        with patch('core.loop_manager.MetacognitivePrincipal') as MockPrincipal:
            with patch('core.loop_manager.AntigravityEngineer') as MockKernel:
                with patch('core.loop_manager.get_cognitive_ledger') as mock_get_ledger:
                    mock_principal = MockPrincipal.return_value
                    mock_kernel = MockKernel.return_value
                    mock_ledger = Mock()
                    mock_get_ledger.return_value = mock_ledger

                    mock_plan = DTFRPlan(
                        mission="Test Mission",
                        context="Test",
                        steps=[PlanStep(
                            id="step1",
                            tool_name="tool",
                            arguments={},
                            rationale="Test",
                            expected_outcome="Success"
                        )],
                        success_criteria=["Complete"]
                    )
                    mock_principal.think_plan = AsyncMock(return_value=mock_plan)
                    mock_kernel.execute_plan = AsyncMock(return_value=[
                        ExecutionResult(
                            step_id="step1",
                            tool_name="tool",
                            status="success",
                            output="Done",
                            duration=0.2
                        )
                    ])
                    mock_principal.critique = AsyncMock(return_value="Success")

                    manager = DTFRLoopManager()
                    await manager.run("Test task")

                    # Verify cognitive ledger was called
                    mock_ledger.record_case_study.assert_called_once()
                    call_args = mock_ledger.record_case_study.call_args[1]
                    assert call_args["agent_id"] == "dtfr_loop"
                    assert call_args["success"] is True

    @pytest.mark.asyncio
    async def test_decision_ledger_creates_markdown_log(self):
        """Loop should create markdown decision log files."""
        with patch('core.loop_manager.MetacognitivePrincipal') as MockPrincipal:
            with patch('core.loop_manager.AntigravityEngineer') as MockKernel:
                with patch('core.loop_manager.get_cognitive_ledger'):
                    with patch('builtins.open', create=True) as mock_open:
                        with patch('os.makedirs'):
                            mock_principal = MockPrincipal.return_value
                            mock_kernel = MockKernel.return_value

                            mock_plan = DTFRPlan(
                                mission="Test",
                                context="Test",
                                steps=[PlanStep(
                                    id="s1",
                                    tool_name="t",
                                    arguments={},
                                    rationale="r",
                                    expected_outcome="e"
                                )],
                                success_criteria=["c"]
                            )
                            mock_principal.think_plan = AsyncMock(return_value=mock_plan)
                            mock_kernel.execute_plan = AsyncMock(return_value=[
                                ExecutionResult(
                                    step_id="s1",
                                    tool_name="t",
                                    status="success",
                                    output="o",
                                    duration=0.1
                                )
                            ])
                            mock_principal.critique = AsyncMock(return_value="Done")

                            manager = DTFRLoopManager()
                            await manager.run("Test task")

                            # Verify markdown files were opened for writing
                            assert mock_open.call_count >= 1


class TestErrorRecovery:
    """Test error handling and recovery mechanisms."""

    @pytest.mark.asyncio
    async def test_loop_handles_cognitive_ledger_failure(self):
        """Loop should continue even if cognitive ledger fails."""
        with patch('core.loop_manager.MetacognitivePrincipal') as MockPrincipal:
            with patch('core.loop_manager.AntigravityEngineer') as MockKernel:
                with patch('core.loop_manager.get_cognitive_ledger', side_effect=ImportError("No ledger")):
                    mock_principal = MockPrincipal.return_value
                    mock_kernel = MockKernel.return_value

                    mock_plan = DTFRPlan(
                        mission="Test",
                        context="Test",
                        steps=[PlanStep(
                            id="s1",
                            tool_name="t",
                            arguments={},
                            rationale="r",
                            expected_outcome="e"
                        )],
                        success_criteria=["c"]
                    )
                    mock_principal.think_plan = AsyncMock(return_value=mock_plan)
                    mock_kernel.execute_plan = AsyncMock(return_value=[
                        ExecutionResult(
                            step_id="s1",
                            tool_name="t",
                            status="success",
                            output="o",
                            duration=0.1
                        )
                    ])
                    mock_principal.critique = AsyncMock(return_value="Done")

                    manager = DTFRLoopManager()
                    # Should not raise exception
                    report = await manager.run("Test task")
                    assert report.status == "COMPLETED"

    @pytest.mark.asyncio
    async def test_loop_handles_file_write_failure(self):
        """Loop should handle file write failures gracefully."""
        with patch('core.loop_manager.MetacognitivePrincipal') as MockPrincipal:
            with patch('core.loop_manager.AntigravityEngineer') as MockKernel:
                with patch('core.loop_manager.get_cognitive_ledger'):
                    with patch('builtins.open', side_effect=OSError("Disk full")):
                        mock_principal = MockPrincipal.return_value
                        mock_kernel = MockKernel.return_value

                        mock_plan = DTFRPlan(
                            mission="Test",
                            context="Test",
                            steps=[PlanStep(
                                id="s1",
                                tool_name="t",
                                arguments={},
                                rationale="r",
                                expected_outcome="e"
                            )],
                            success_criteria=["c"]
                        )
                        mock_principal.think_plan = AsyncMock(return_value=mock_plan)
                        mock_kernel.execute_plan = AsyncMock(return_value=[
                            ExecutionResult(
                                step_id="s1",
                                tool_name="t",
                                status="success",
                                output="o",
                                duration=0.1
                            )
                        ])
                        mock_principal.critique = AsyncMock(return_value="Done")

                        manager = DTFRLoopManager()
                        # Should not raise exception
                        report = await manager.run("Test task")
                        assert report.status == "COMPLETED"
