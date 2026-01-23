---
name: trade_executor
description: Specialized skill for high-stakes financial trade execution on the Sovereign Node.
---

# Trade Executor Skill

This skill allows an agent to securely sign and execute trades on decentralized or centralized exchanges via the Sovereign Node's secure vault.

## Capabilities
- **Signature Integrity**: Signs transactions using air-gapped logic.
- **Slippage Protection**: Calculates real-time slippage bounds before execution.
- **The Kill-Switch Hook**: Checks the physical/digital "Handshake" status before releasing a signed payload.
- **Audit Logging**: Records "Cognitive Residue" (the reasoning behind the trade) for every execution.

## Usage
1. Provide the `TradePolicy` calculated via Active Inference.
2. The skill will return a `Wait-for-Handshake` signal if the Kill-Switch is in "Standby."
3. Upon "Engage," the signed transaction is broadcast.

## Safety Constraints
- NEVER execute trades without a validated `ActiveInferenceMixin` precision check.
- DISENGAGE immediately if "Perceptual Surprise" exceeds 20% on the realization scale.
