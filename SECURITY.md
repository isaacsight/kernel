# Security Policy: The Sovereign Laboratory OS

This document outlines the security architecture and guidelines for the SL-OS and the Antigravity agentic swarm.

## 1. Secrets & Credentials
- **Strict Isolation**: No API keys or secrets should ever be hardcoded in the source or cognitive residue.
- **Sovereignty Vault**: Secrets are managed via the `MissionManager` (SQLite) or strictly loaded from `.env`.
- **Environment Parity**: The system detects if it is running in a 'Controller' (Secure local) or 'Node' (Remote) environment and adjusts permissions accordingly.

## 2. Agentic Safety (Command Execution)
Agents are powerful but must be governed.
- **Blocklist & Sanitization**: The `AntigravityEngineer` and `BaseAgent` use a multi-stage blocklist to prevent global system destruction (e.g., `rm -rf /`) and shell injection (e.g., `;`, `&&`).
- **Socratic Intervention**: If an agent attempts a high-risk action, the system enters a Socratic loop to verify the agent's intent and hypothesis.

## 3. Network & Hardware Signaling
Physical devices linked to SL-OS communicate via signed channels.
- **HMAC-SHA256 Signing**: All UDP broadcasts from the `HardwareBridge` are signed with a shared-secret (HMAC).
- **Integrity Check**: Receivers (Consoles, Mirrors) must verify the signature before acting on haptic alerts or display updates.

## 4. Reporting Vulnerabilities
If you discover a vulnerability in the Antigravity kernel, report it via the `Intelligence Delta` agent or directly to the core maintainer.

---
*Secured by Antigravity Defense Systems*
