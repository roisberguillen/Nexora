---
name: nexora-database
description: Plan, implement and verify Nexora ledger repositories, SQLite or IndexedDB queries, migrations and native adapters while protecting existing data and accounting invariants. Use for database queries, schema changes, OPFS, IndexedDB or native SQLite work.
---

# Nexora Database

1. Route as STANDARD for a localized query or ADVANCED/CRITICAL for migrations and real data risk.
2. Read `DATA_MODEL.md`, the relevant ADR, repository map entry and only affected adapters.
3. Keep money as canonical minor-unit strings and transfers neutral in income/expense reports.
4. Reuse one migration catalog across SQLite runtimes; preserve adapter parity.
5. Create a checkpoint before schema or real-ledger work. Never delete or reset user data.
6. Test migration from prior schema, rollback/atomic failure, foreign keys and reopened persistence.

Stop and escalate if rollback is unavailable or a destructive transformation is proposed.
