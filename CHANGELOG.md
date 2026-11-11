# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-11-11

### Changed

- The product is now named jobship: the launcher, plugin, package, env vars (`JOBSHIP_*`), data dir marker (`jobship.json`), cache dir and release assets (`jobship-<os>-<arch>`).
- Renamed the lock directory to `.jobship.lock`, the template marker to `TODO(jobship):` and the Linear issue marker to `[jobship-key: ...]`.
- Added the brand kit under `docs/brand/` and a terminal banner on `jobship --help`, written to stderr on a TTY only.

### Removed

- Every `huntline` name: the `huntline` launcher, the `HUNTLINE_*` env vars and the `huntline.json` marker. No installs existed, so there is no compatibility layer ([ADR-0006](docs/adr/0006-drop-huntline-compatibility.md)).

## [0.2.0] - 2026-11-10

### Added

- `huntline status <key> --set <state>` to mark an Application, such as applied.
- `huntline --help` and per-command flag validation.
- Versioned data dir, fuller `init` and `doctor` checks, and a SessionStart prefetch of the binary.
- Onboarding docs for a stranger: install-first README, Source names, browser and Gmail MCP setup, poppler per distro and a terms-of-service warning.
- Type-aware lint, formatter, dead-code check, commit hooks and docs link check.
- `AGENTS.md`, contributing guide, security policy, `PRODUCT.md`, `GOVERNANCE.md` and issue and PR templates.
- A labels sync workflow and a bun cache in CI.

### Changed

- The Guard fails closed when its launcher cannot run and never grants permission itself.
- The region Gate is region-neutral, and short tokens such as `go` count in CV coverage.
- Answers are scoped per company, and sweep reports misconfigured Sources.

### Fixed

- Gmail and nested browser MCP tool names are matched case-insensitively.

## [0.1.1] - 2026-11-10

First tagged release.

### Added

- The CLI core, event ledger, Guard, CV pipeline, sources, sweep, inbox, outreach, apply and interview modules, and the Claude Code plugin.
- Answer bank list and auto-close, and word-based CV coverage.
- Guard self-test, doctor readiness checks and a dogfooding checklist.
- Linear connection check and completed legacy migration.
- Automatic Typst install and a poppler report.
- CV variants, tracker config and legacy importers.
- End-to-end flow test and user docs.

### Fixed

- `cv lint` is Spanish-safe, and doctor validates CV data.

[Unreleased]: https://github.com/andryorelabs/jobship/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/andryorelabs/jobship/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/andryorelabs/jobship/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/andryorelabs/jobship/releases/tag/v0.1.1
