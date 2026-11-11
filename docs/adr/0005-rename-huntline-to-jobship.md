# Rename huntline to jobship, with legacy compatibility

The code is named `jobship`: the launcher, the plugin, the package, the env vars, the data dir marker and the cache dir. Every `huntline` name an existing install depends on keeps working as a fallback until the removal rule below is met.

## Context

The maintainer picked `jobship` on 2026-11-11 (decisions table in [docs/brand/README.md](../brand/README.md), [ADR-0004](0004-brand-kit-in-docs-brand.md)). Installs already exist: data dirs marked by `huntline.json`, shells exporting `HUNTLINE_HOME`, typst cached under `~/.cache/huntline`, a `huntline` launcher on PATH, published releases whose assets are named `huntline-<os>-<arch>`, and Linear issues carrying `[huntline-key: …]` markers. A hard rename would strand all of them, and the event log ([ADR-0001](0001-event-log-is-the-source-of-truth.md)) must stay readable in place.

## Decision

- The current name wins, the legacy name is read as a fallback:
  - Every `JOBSHIP_*` env var has a `HUNTLINE_*` twin (`HOME`, `CACHE_DIR`, `CLAUDE_PLUGINS_FILE`, `FROM_SOURCE`, `PREFETCH`, `RELEASE_BASE_URL`, and the `BUILD_VERSION` build define). `JOBSHIP_*` wins; an empty value counts as unset. `src/core/env.ts` is the one place the CLI reads them; `bin/jobship` mirrors the rule in shell.
  - `jobship init` writes `jobship.json`. The upward search and `--data` still accept a dir marked only by `huntline.json` and read it in place, without moving or rewriting anything. When both files exist, `jobship.json` is read.
  - The cache dir is `~/.cache/jobship`; typst cached under `~/.cache/huntline` is still found.
  - `bin/jobship` downloads `jobship-<os>-<arch>` and falls back to `huntline-<os>-<arch>` when a release only lists that name in `SHA256SUMS`.
  - `doctor` treats a `jobship@` or a `huntline@` plugin entry as installed.
- `bin/huntline` is a shim: it writes one deprecation line to stderr, never to stdout, and execs `bin/jobship` with the same arguments, so the stdout JSON envelope and the Guard's hook output are unchanged. If `bin/jobship` is missing, `huntline guard` prints a deny ([ADR-0002](0002-the-guard-fails-closed.md)).
- The Guard is registered through `bin/jobship` in `hooks/hooks.json`.
- Persisted formats keep their spelling: the `[huntline-key: …]` marker in Linear issues and the `TODO(huntline):` marker in the bundled templates. Changing them would duplicate tracker issues or miss unfilled markers in existing data dirs.
- GitHub URLs (release downloads, the marketplace source, the schema `$id`, package metadata) named `andryorelabs/huntline` until the repository was renamed to `andryorelabs/jobship` on 2026-11-11; GitHub redirects the old path, so links and installs that still use it keep working.

## Consequences

- Nothing breaks for an existing install, and the stdout envelope is byte-for-byte the same.
- Two names live in code for a while; `src/core/env.ts` and `bin/huntline` hold most of that cost.
- The shim and the `HUNTLINE_*` fallbacks may be removed in the first minor release after a release whose assets are named `jobship-*` has been out for 90 days, once `doctor` has warned about the legacy names for that period. Removing them is a breaking change and needs a release note. The `huntline.json` fallback and the persisted markers stay until a migration rewrites them.
