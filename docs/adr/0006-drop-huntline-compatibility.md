# Drop the huntline compatibility

Supersedes [ADR-0005](0005-rename-huntline-to-jobship.md). The code knows one name, `jobship`: no `HUNTLINE_*` fallbacks, no `huntline.json` marker, no `bin/huntline` shim.

## Context

ADR-0005 kept every `huntline` name working because installs might exist. On 2026-11-11 the maintainer confirmed there are none: nobody runs a released build, and the only `huntline` data on any machine is the maintainer's own plugin entry and cache. The fallbacks cost a second name in `src/core/env.ts`, `bin/jobship`, the doctor, the cache lookup and their tests, for no user.

## Decision

- Env vars are `JOBSHIP_*` only. The data dir marker is `jobship.json` only. The cache dir is `~/.cache/jobship` only. `doctor` recognises only a `jobship@` plugin entry.
- Persisted spellings are renamed too: the lock directory is `.jobship.lock`, the template marker is `TODO(jobship):`, and the Linear issue marker is `[jobship-key: …]`.
- `bin/huntline` and its `package.json` bin entry are deleted. `bin/jobship` downloads only `jobship-<os>-<arch>`.
- `git grep -i huntline` over code, templates, skills, commands and hooks returns nothing; `src/e2e/docs.test.ts` enforces it.

## Consequences

- Releases v0.1.1 and v0.2.0 publish only `huntline-<os>-<arch>` assets, so the launcher cannot download a binary for them. v0.3.0 is the first release with `jobship-*` assets.
- A Linear issue carrying a `[huntline-key: …]` marker is no longer matched, so `migrate linear` would treat it as new. Acceptable because no such data exists outside the maintainer's own tracker.
- Reintroducing a legacy name needs a new ADR.
