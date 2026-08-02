---
name: nexora-sync
description: Design and verify Nexora Local Hub pairing and offline-first operation-log synchronization, including conflicts, replay, idempotency and LAN security. Use for Local Hub, pairing, discovery, synchronization protocol or conflict-resolution tasks.
---

# Nexora Sync

1. Route as CRITICAL and read ADR 0016 plus current sync specifications.
2. Threat-model discovery, pairing, transport, device identity, replay and revocation.
3. Synchronize incremental operations only; never copy or share an open SQLite file.
4. Keep Local Hub separate from backup and require explicit pairing.
5. Specify deterministic conflict and idempotency rules before implementation.
6. Test negative pairing, replay, offline queues, conflicts, partial delivery and recovery.
7. Require independent review and stop when protocol decisions or credentials are missing.
