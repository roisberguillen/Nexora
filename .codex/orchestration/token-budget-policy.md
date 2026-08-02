# Context and token budget policy

- Consult persistent state before source files.
- Respect the route's `initial_file_limit`; read extra files in batches of at most five and record why.
- Reuse summaries until their source files change.
- Keep checkpoints, decisions and test evidence factual and short.
- Do not paste the PRD, architecture or large code blocks into task state.
- Use targeted search paths; do not rescan the repository for a localized task.
- Run progressive tests and reserve complete E2E, performance and platform matrices for their
  configured gate.
- Do not delegate mechanical work. Count coordination cost before using any sub-agent.
- Stop after the configured attempt limit and escalate from a safe checkpoint.
