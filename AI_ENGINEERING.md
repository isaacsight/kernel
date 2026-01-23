# AI Engineering Standards: Sovereign Laboratory OS

This document defines the technical standards for developing and maintaining the agentic substrate of SL-OS.

## 1. Observability & Telemetry
All agents must use the `StructuredLogger` for all operations. This enables cross-agent tracing and performance monitoring.

### Trace Propagation
When spawning a sub-agent or task, the `trace_id` must be propagated.
```python
with self.logger.trace_context(mission_id="m123"):
    self.logger.info("Executing task")
```

## 2. Reliability: Socratic Repair
Direct failures are unacceptable. Agents should utilize the `socratic_debug_loop` to analyze errors and attempt self-correction before returning a failure to the user.

### Protocol
1. **Hypothesis**: What did the agent think it was doing?
2. **Analysis**: Why did it fail?
3. **Correction**: What is the new strategy?

## 3. Collaboration: Conversation Compounding
Every agent interaction must leave behind **Cognitive Residue**.

### Residue Generation
Standardized residue artifacts are stored in `admin/brain/missions/{mission_id}/`.
Use the `post_run_residue()` hook in `BaseAgent` to automate this.

## 4. Decision Making: Active Inference
Prefer Expected Free Energy (EFE) minimization for complex decision loops. Decisions should be grounded in the current mission state and the agent's internal belief system.

---
**Antigravity Core Kernel**
