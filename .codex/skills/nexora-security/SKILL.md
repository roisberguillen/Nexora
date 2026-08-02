---
name: nexora-security
description: Threat-model and independently review sensitive Nexora authentication, authorization, cryptography, key handling, permissions and data-recovery changes. Use for security reviews or any task that could expose credentials, financial data or user ledgers.
---

# Nexora Security

1. Route as CRITICAL and create a safe checkpoint before editing.
2. Define assets, trust boundaries, attackers, misuse cases and recovery behavior.
3. Use established platform primitives; do not invent cryptography or broaden permissions silently.
4. Keep secrets and financial data out of fixtures, logs, diagnostics and commits.
5. Require negative tests, secret scan, recovery tests and an independent review.
6. Stop for manual escalation when credentials, product trust decisions or review capability are missing.
