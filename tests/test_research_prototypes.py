import pytest
import os
import sys
import json
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from admin.engineers.lab_scientist import LabScientist
from admin.engineers.system_monitor import Systemmonitor
from admin.engineers.health_scout import HealthScout

def test_system_monitor_telemetry():
    """Verifies that Systemmonitor outputs cognitive telemetry."""
    monitor = Systemmonitor()
    report = monitor.execute()
    
    assert 'cognitive_fatigue' in report
    assert 'latency_drift_ms' in report
    assert 'token_efficiency' in report
    assert isinstance(report['cognitive_fatigue'], (int, float))

def test_lab_scientist_reasoning_audit():
    """ Verifies the Reasoning Audit experiment. """
    scientist = LabScientist()
    
    # We need to ensure at least one draft exists for the audit to work
    drafts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "admin", "brain", "drafts")
    os.makedirs(drafts_dir, exist_ok=True)
    
    test_draft = os.path.join(drafts_dir, "ESSAY_test_audit.md")
    with open(test_draft, 'w') as f:
        f.write("# Test Audit\n\nAI is becoming more autonomous. This is a claim.")
        
    try:
        result = scientist.run_experiment("9")
        assert result['status'] == "success"
        assert 'felt_alignment_score' in result
        assert os.path.exists(result['report_path'])
    finally:
        # Cleanup
        if os.path.exists(test_draft):
            os.remove(test_draft)

def test_health_scout_coordination():
    """Verifies that HealthScout can run a full audit."""
    scout = HealthScout()
    
    # Mocking a draft for the sub-scientist audit
    drafts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "admin", "brain", "drafts")
    os.makedirs(drafts_dir, exist_ok=True)
    test_draft = os.path.join(drafts_dir, "ESSAY_test_health.md")
    with open(test_draft, 'w') as f:
        f.write("# Health Test\n\nEverything is normal.")
        
    try:
        result = scout.perform_full_audit()
        assert result['status'] in ["HEALTHY", "STRESSED", "DEGRADED"]
        assert 'telemetry' in result
        assert 'reasoning_audit' in result
    finally:
        if os.path.exists(test_draft):
            os.remove(test_draft)

if __name__ == "__main__":
    pytest.main([__file__])
