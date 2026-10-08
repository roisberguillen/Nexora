# Checkpoint — Android signed CI gate

- Date: 2026-10-08
- Branch: codex/pc-manager-local-browser
- Base SHA: 96e7d8f30571aa6e43fd0c8675716fe54cd04a58
- Scope: inspect and harden the Android arm64 signed workflow and document stable user-owned keystore setup.
- Constraints: do not modify main, ledger, sync protocol or TLS; do not generate or commit signing keys; signed gate remains incomplete until a real stable release keystore is configured and CI passes.
- Files expected: .github/workflows/ci.yml, package scripts/config related to Android signing, signing documentation, manifest/evidence/changelog if required.
- Required verification: workflow fail-closed behavior, no secret logs/artifacts, stable signed artifact, apksigner verification, local quality gates and CI.