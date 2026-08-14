# Checkpoint for real-data validation

This procedure prepares the **Phase 12.5.0** checkpoint only. It does not
authorize importing real data, changing the user's definitive ledger or starting
Phase 12.5.1.

## Boundary

- Keep all real statements, exports, screenshots, browser profiles and encrypted
  trial archives under `validation/real-data/`. The directory is ignored by Git.
- Do not place a real file in `examples/`, `test/`, `apps/`, `packages/` or
  `docs/`.
- Never put a passphrase, IBAN, account identifier, token or financial amount in
  a command, a committed log, a fixture or an issue/PR description.

## Isolated ledger mode

The browser ledger uses IndexedDB/OPFS scoped to its origin. A different local
port is therefore a separate ledger namespace; it cannot open or mutate the
default ledger already used at `http://127.0.0.1:5173`.

1. Build the verified revision, then start the preview on the validation origin:

   ```powershell
   pnpm --filter @nexora/web preview -- --host 127.0.0.1 --port 4174 --strictPort
   ```

2. Open it only with a dedicated browser profile located below
   `validation/real-data/browser-profile/`. Do not reuse the normal Nexora
   profile. The profile directory remains untracked.
3. Use `http://127.0.0.1:4174` only for the trial ledger. Keep the normal user
   ledger closed for the duration of the drill.
4. For a restore proof, start a second preview on `http://127.0.0.1:4175` with a
   different dedicated profile. Restore the validation archive there, not into
   the 4174 trial ledger and never into the definitive user origin.

This isolation is based on browser origin partitioning, not an application
feature flag. It does not alter the default `nexora-ledger` database name or any
existing OPFS/IndexedDB data.

## Backup and recovery sequence

Before entering real data, record the published commit and confirm all quality
gates for it. During the later user-operated drill:

1. Create an encrypted manual `.nexora` backup from the isolated 4174 ledger.
2. Store it only in `validation/real-data/backups/`; retain its passphrase outside
   the repository and outside shell history.
3. Verify the archive's checksum/schema and restore it only to the disposable
   4175 origin/profile.
4. Compare counts and balances in the disposable restore with the isolated
   source. Do not capture financial details in logs or committed evidence.
5. Keep the archive until the user has accepted the validation result; then use
   an explicit, user-controlled deletion process. Do not run an automated delete.

Automated evidence for this checkpoint uses only synthetic accounts and amounts:
the portable backup engine exercises encrypted creation, verification, restore,
invalid-archive rejection and rollback using temporary IndexedDB/SQLite stores.
The startup recovery verifier also creates and removes only a temporary
`nexora-recovery-*` IndexedDB database.

## Stop conditions

Stop the real-data drill immediately if the browser opens the normal origin,
the backup cannot be verified, a restore changes the source ledger, an unexpected
network upload is requested, or any personal datum appears in a log. Preserve the
encrypted isolated backup and report the condition without retrying destructive
operations.
