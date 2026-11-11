---
description: Scaffold a jobship data directory with `jobship init`, then list what is left to fill in
---

Run `jobship init` with the Bash tool. Pass `--data <dir>` when the user named a
directory; otherwise it scaffolds the current directory. `jobship` is on PATH in
plugin sessions.

Then summarize the result:

- Files written, one line each.
- Every `TODO(huntline):` marker left in them (run `rg -n 'TODO\(huntline\):' <dir>`),
  with its file and line, so the user knows what to fill in.

If the command fails, show its error output and stop. Never retry with `--force`
unless the user asks for it: it overwrites their files.
