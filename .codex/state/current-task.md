# Current task

- Task: FIX.8 — Pipeline Android e APK
- Roadmap phase: FIX.8
- Status: `BLOCKED` — il comando Tauri end-to-end compila Rust ma non può materializzare la `.so`
  tramite symlink su Windows senza Developer Mode/privilegio equivalente; il workaround Gradle
  con `-x rustBuild` non soddisfa il criterio della fase.
- Evidence: `.codex/state/test-evidence.md`; `docs/ROADMAP_STABILIZATION.md`.
- Next task: `FIX.8 — riprendere dopo risoluzione del symlink Windows; poi FIX.9 — firma release`.
