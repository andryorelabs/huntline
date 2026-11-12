---
description: Scaffold a jobship data directory with `jobship init`, then run Onboarding to fill the Dossier and derive your data
---

Run `jobship init` with the Bash tool. Pass `--data <dir>` when the user named a
directory; otherwise it scaffolds the current directory. `jobship` is on PATH in
plugin sessions.

If the data dir already exists, do not fail: run `jobship dossier check` and
continue. For a data dir created before the Dossier, run `jobship init --missing`,
which writes only the absent files.

Then load the `onboard` skill and follow it: it gathers a CV, GitHub and LinkedIn
when offered, interviews for the gaps, writes the Dossier, derives the Fact bank,
Bullets, Profile, Never-claim list and Answer bank as an Approval batch for the user
to approve, builds a first CV, and ends with `jobship doctor`.

If a command fails, show its error output and stop. Never retry with `--force`
unless the user asks for it: it overwrites their files.
