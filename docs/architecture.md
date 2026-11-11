# Architecture

How jobship is put together. Terms follow [GLOSSARY.md](../GLOSSARY.md). Decisions behind it are in the [ADRs](adr/README.md).

## Shape

jobship is a Claude Code plugin plus a CLI. Skills drive the work in the human's own Chrome and Gmail; the `jobship` CLI does the deterministic parts and prints a JSON envelope on stdout.

- `src/`: the CLI, one folder per area (`core`, `ledger`, `guard`, `cv`, `sweep`, `sources`, `inbox`, `outreach`, `apply`, `interview`, `tracker`, `migrate`, `gates`). The entry point is `src/cli.ts`.
- `bin/jobship`: the launcher. It runs from source or downloads the release binary, checks it against `SHA256SUMS` and caches it.
- `skills/`, `agents/`, `commands/`, `hooks/hooks.json`, `.claude-plugin/`: the plugin surface.
- `schema/`, `templates/`, `examples/`, `fixtures/`: bundled data and synthetic test data.
- `tools/`: build and dev scripts with their tests.

## Data flow

1. A skill finds or reads a Posting and calls the CLI.
2. The CLI appends Events to the Event log in the data directory. Status is a fold over those Events, and the local tracker and Linear are projections of the log ([ADR-0001](adr/0001-event-log-is-the-source-of-truth.md)).
3. CV tailoring uses only Fact bank facts and lints the result.
4. Applying fills a form and verifies it, then stops before Submit.

## The Guard

The Guard is a PreToolUse hook registered in `hooks/hooks.json` and run through `bin/jobship`. It only ever adds a deny, and it fails closed ([ADR-0002](adr/0002-the-guard-fails-closed.md)). Details and limits are in the [safety model](guide/safety.md).

## Code and data

The code ships no personal data. It reads a data directory marked by `jobship.json` ([ADR-0003](adr/0003-code-and-personal-data-live-apart.md), [configuration](configuration.md)).

## Brand

The brand kit lives in `docs/brand/` and its decisions table is the source of truth ([ADR-0004](adr/0004-brand-kit-in-docs-brand.md)).
