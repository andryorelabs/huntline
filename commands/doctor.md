---
description: Check the jobship data directory with `jobship doctor`, failures first
---

Run `jobship doctor` with the Bash tool. Pass `--data <dir>` when the user named a
directory. `jobship` is on PATH in plugin sessions.

Then summarize the result:

- Failures first, each with the fix the output suggests (`dossier-incomplete` or
  `derived-empty` mean Onboarding is not finished, exit 2 means a missing or malformed
  Profile).
- If it printed `"ok":true`, say the setup is healthy.

Doctor is read-only. Never edit the user's data files to make it pass; print the
needed change for the user to make.
