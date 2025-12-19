---
title: Agentic Observability Protocol
date: 2025-12-18
status: proposed
---

## RFC 0014: Agentic Observability Protocol (AOP)

**Title:** Agentic Observability Protocol: Standardizing Prompt IO Tracing for Tool-Calling Systems

**Status:** Draft / Request for Comments
**Author:** [Self-Identified as Community Contributor]
**Date:** October 26, 2023
**Context:** AI Agentic Systems, Distributed Tracing, Debugging, Auditing

---

## Abstract

As large language model (LLM) based agents transition from experimental prototypes to mission-critical software components, the need for robust, standardized observability becomes paramount. Existing application performance monitoring (APM) and distributed tracing protocols often fail to capture the critical decision-making context—the LLM's inner monologue—that precedes external actions (Tool Calls).

This Request for Comments (RFC) proposes the **Agentic Observability Protocol (AOP)**, a standardized set of semantic conventions designed to ensure deterministic traceability of *every* Prompt Input/Output (Prompt IO) interaction that leads to an external Tool Call invocation within an agentic workflow. AOP aims to integrate seamlessly with existing distributed tracing frameworks (e.g., OpenTelemetry) by defining the minimum required metadata for complete operational reconstruction, debugging, and auditability of agent behavior.

## 1. Motivation

Agentic systems operate as complex, non-deterministic state machines whose actions are dictated by real-time reasoning derived from prompt context. Traditional observability methods (logging function entry/exit, monitoring API latency) are insufficient because they capture *what* happened, but not *why* the LLM instructed the action.

The current deficiencies and resulting needs include:

1.  **Debugging and Failure Analysis:** When an agent misinterprets a request and calls the wrong tool (or calls the right tool incorrectly), the system requires the exact prompt that led to the erroneous decision. Without standardized Prompt IO logging integrated directly into the execution trace, diagnosing these failures is challenging, often relying on messy custom middleware.
2.  **Auditability and Compliance:** For regulated industries, proving that an agent adhered to safety guidelines, system instructions, or internal compliance policies requires a verifiable, immutable record of the instructions (system prompts) and the resulting LLM rationale (output) preceding external data access or critical operations.
3.  **Optimization and Cost Management:** LLM interactions represent the highest variable cost component of an agentic application. Optimizing prompt compression, reducing unnecessary token usage, or identifying redundant steps requires granular tracking of token usage linked directly to successful (and unsuccessful) tool utilization.
4.  **Standardization Gap:** Current solutions are fragmented. Frameworks implement proprietary logging formats, hindering the development of universal analysis tools, monitoring dashboards, and A/B testing platforms tailored for agentic workflows.

The Agentic Observability Protocol seeks to fill this gap by formalizing the required data structure and capture mechanism.

## 2. Proposed Design: Agentic Observability Protocol (AOP)

The AOP defines mandatory semantic conventions for creating a traceable span around any LLM interaction that influences a Tool Call. This span—termed a **Prompt IO Trace**—must be generated immediately prior to the external tool invocation and include the LLM's reasoning and the technical payload used to inform the action.

### 2.1 Core Principle: Interception and Atomic Trace

The core design mandates that the Prompt IO Trace must be captured at the specific interception layer where the LLM's raw output is parsed into a concrete function signature (tool call). This trace is considered atomic and must precede the span of the actual tool execution.

### 2.2 Standardized Schema for Prompt IO Trace

The AOP proposes the following minimum required metadata fields for any Prompt IO Trace record, intended to be standardized within a tracing envelope (e.g., an OpenTelemetry Span or Event):

| Field Name | Data Type | Description | Mandatory |
| :--- | :--- | :--- | :--- |
| `aop.trace_id` | UUID | Identifier linking the entire user request workflow. | **Yes** |
| `aop.span_id` | UUID | Unique identifier for this specific LLM interaction. | **Yes** |
| `aop.timestamp_utc` | ISO 8601 | Timestamp of LLM response receipt. | **Yes** |
| `aop.agent.id` | String | Identifier for the specific agent instance or configuration. | **Yes** |
| `aop.llm.provider` | String | e.g., `openai`, `anthropic`, `local_hf`. | **Yes** |
| `aop.llm.model_name` | String | Specific model used (e.g., `gpt-4o`, `claude-3-sonnet`). | **Yes** |
| `aop.token.input_count` | Integer | Total tokens sent in the prompt payload. | **Yes** |
| `aop.token.output_count`| Integer | Total tokens received in the LLM response. | **Yes** |
| `aop.prompt.system_context`| Text | The immutable system instructions provided to the LLM. | Recommended |
| `aop.prompt.full_input` | Text | The complete prompt sent, including context and user messages. | **Yes** |
| `aop.llm.raw_output` | Text/JSON | The unprocessed response from the LLM API. | **Yes** |
| `aop.tool.invocation_target`| String | The specific tool/function name the LLM selected. | **Yes** (If tool was called) |
| `aop.tool.invocation_args` | JSON | Parsed arguments passed to the external tool. | **Yes** (If tool was called) |
| `aop.outcome.type` | Enum | Result: `TOOL_INVOCATION`, `FINAL_ANSWER`, `RETRY`, `ERROR`. | **Yes** |

### 2.3 Integration with Distributed Tracing (OpenTelemetry Mapping)

The AOP is designed to augment, not replace, existing tracing standards.

1.  **AOP Span Generation:** Every Prompt IO interaction must generate a unique OpenTelemetry Span. This Span should be annotated with the semantic conventions defined in Section 2.2.
2.  **Context Propagation:** The `aop.span_id` of the LLM interaction must be the parent of the subsequent tool execution Span. This hierarchical link ensures deterministic ordering:
    $$\text{User Request Span} \rightarrow \text{AOP Prompt IO Span} \rightarrow \text{Tool Execution Span}$$
3.  **Handling Multi-Step Reasoning (Chain-of-Thought):** If the LLM generates output that is *not* a final answer or a tool call (e.g., internal scratchpad or iterative reasoning steps), this internal step should still be logged as an AOP Span, but with `aop.outcome.type` set to `INTERNAL_REASONING`, ensuring the entire thought process is recorded, even if no external action results immediately.

## 3. Drawbacks and Alternatives

### 3.1 Drawbacks of AOP Implementation

1.  **Storage and Cost Overhead (The Cardinality Problem):** Logging the full prompt input and output (which can be megabytes in complex RAG workflows) for *every* LLM interaction dramatically increases storage requirements and tracing ingestion costs compared to traditional logging.
2.  **Performance Penalty:** Capturing and serializing large text fields (especially full system contexts) introduces latency, particularly in synchronous agent loops. Implementations must prioritize asynchronous logging or efficient offloading.
3.  **Privacy and PII Exposure:** Since the full prompt is logged, there is a risk of exposing sensitive Personal Identifiable Information (PII) or confidential business logic. Robust PII scrubbing and anonymization must be integrated into the AOP implementation layer *before* the trace data leaves the secure execution environment.

### 3.2 Alternatives Considered

| Alternative Approach | Description | Deficiency |
| :--- | :--- | :--- |
| **Coarse-Grained LLM API Logging** | Log only the API call parameters (model name, timestamp) but skip the full prompt content. | Impossible to reconstruct the reasoning failure path or debug why a tool was selected. |
| **Manual Decorator Placement** | Rely on developers to manually wrap *some* LLM calls with custom logging decorators. | Inconsistent coverage; critical interactions are easily missed; lacks a standardized output schema. |
| **Vendor-Specific Tool Logging** | Rely solely on observability features provided by the LLM vendor (e.g., OpenAI or Anthropic logging). | Leads to vendor lock-in; fails in local or multi-cloud environments; lacks portability for analysis. |

The AOP solution addresses these deficiencies by enforcing a high-fidelity, standardized contract at the *agent framework level*, independent of the underlying LLM provider, ensuring consistency and completeness.

## 4. Unresolved Questions

The adoption and widespread utility of the Agentic Observability Protocol depend on community input regarding several open questions:

1.  **PII Handling Standardization:** What is the recommended semantic convention for marking a trace as having undergone PII scrubbing? Should AOP mandate specific, reversible tokenization/masking algorithms, or simply require a boolean flag indicating successful sanitization?
2.  **Sampling Strategies:** Given the high volume and cost of AOP data, what are the recommended strategies for high-volume production environments? Should sampling prioritize traces containing specific failure types (e.g., low confidence scores, tool errors) or utilize deterministic hashing based on user ID?
3.  **Schema Versioning and Evolution:** As LLM interfaces evolve (e.g., new tool calling paradigms, multi-modal inputs), how should the AOP schema be versioned to maintain backward compatibility while supporting new features?
4.  **Integration with Policy Agents:** How can AOP best support policy enforcement agents (guardrails) that intercept and modify the prompt/response? Should the AOP span track both the pre-policy and post-policy prompt states?

We invite feedback from AI framework developers, observability engineers, and compliance officers on these outstanding questions to finalize the protocol specification.