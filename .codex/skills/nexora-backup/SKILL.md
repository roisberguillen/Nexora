---
name: nexora-backup
description: Implement and review Nexora encrypted manual backup, portable restore and Google Drive backup with integrity verification and recovery checkpoints. Use for .nexora archives, backup engines, restore, Drive providers or backup history.
---

# Nexora Backup

1. Route manual backup as ADVANCED and encryption/key changes as CRITICAL.
2. Treat `.nexora` and user-selected Google Drive folders as the only supported destinations.
3. Encrypt before external storage; never log credentials, passphrases or financial content.
4. Verify manifest, checksum, schema compatibility and archive readability before success.
5. Validate restore in isolation and retain a rollback checkpoint before replacing active data.
6. Test round-trip, tampering, wrong passphrase, interrupted write and rollback.

Local Hub is synchronization infrastructure, not a backup destination.
