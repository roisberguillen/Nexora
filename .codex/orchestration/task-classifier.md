# Task classifier

1. Read `.codex/state/current-task.md`, `roadmap-progress.md` and `repository-map.md` first.
2. Match the task text and declared files against `routing-policy.yaml` keywords.
3. Raise the result for data-loss, cryptography, network, migration or multi-package risk.
4. Raise one profile after two consecutive failed attempts or unexpected scope growth.
5. Never lower a route below an explicit risk rule.
6. Print the compact routing header before planning or editing.

The router classifies work profiles; it does not claim to change the runtime model. A manual switch
is requested only when the current runtime cannot provide the required capability.

Required header:

```text
Task:
Fase roadmap:
Categoria:
Profilo:
Rischio dati:
File iniziali:
Test mirati:
Condizioni di escalation:
Modello raccomandato:
Switch necessario: sì/no
```
