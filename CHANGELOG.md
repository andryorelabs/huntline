# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.3] - 2026-11-14

### Fixed

- `jobship doctor` no longer warns when an ATS Source has no saved company; those Sources sweep nothing until `jobship company add` saves one.

## [0.5.2] - 2026-11-14

### Fixed

- Approval batches are keyed by their path relative to the data dir, so a moved or cloned data dir still applies its derived batches; maps with absolute keys keep working.

## [0.5.1] - 2026-11-13

### Fixed

- Feed requests also accept `*/*` at low priority, so boards that answer 500 to XML-only requests (elixirjobs) sweep again.
- `devitjobs-us` is now a `manual` board: its feed is over 10 MB, past the response cap, so every sweep failed it.

## [0.5.0] - 2026-11-13

### Added

- A catalog of free job boards (`catalog/boards.json`) with `feed`, `browser` and `manual` access, feed adapters for RSS, Atom, XML and JSON boards, and `jobship board add|list|remove` for custom boards ([ADR-0013](docs/adr/0013-jobship-ships-a-board-catalog.md)).
- The catalog refreshes from the repository at most once a day, with a 24-hour cache and a fallback to the bundled copy; `JOBSHIP_CATALOG_URL` points it elsewhere, and `off` skips the fetch.
- The `nav` feed adapter for NAV Arbeidsplassen (Norway), with a stored cursor in `board-cursors.json` so each sweep reads only entries published since the previous one. Postings arrive from the second sweep on.

### Changed

- `sweep` resolves its boards from the Profile `regions` and `remote` when `sources` is empty, and `jobship doctor` warns `no-boards` when none resolve.

## [0.4.0] - 2026-11-12

### Added

- The Dossier: four Markdown sections under `dossier/` that hold what you tell jobship about yourself, with `jobship dossier check|derive|apply` to derive the Fact bank, Bullets, Profile, Never-claim list and Answer bank through an Approval batch ([ADR-0009](docs/adr/0009-the-dossier-is-the-source-of-derived-files.md)).
- The Onboarding skill and guide: `/jobship:init` now scaffolds the data dir and runs Onboarding, from the optional CV, GitHub and LinkedIn sources to a built and linted CV.
- Identity tiers and the `identity-leak` finding in `cv lint`, which flags tier B, C and D values in CV text ([ADR-0010](docs/adr/0010-identity-data-is-tiered.md)).
- Answer keys for the Answer bank.
- `jobship init --missing` to add only the absent files to a pre-Dossier data dir.
- A coverage gate with a coverage manifest and a pre-push hook.

### Changed

- `doctor` checks Dossier completeness and derived data instead of `TODO(jobship):` markers.
- `dossier apply` keeps comments in derived YAML files, using the `yaml` package, the first runtime dependency ([ADR-0012](docs/adr/0012-use-the-yaml-package-to-edit-derived-files.md)).
- `develop` is the trunk; releases merge `develop` into `main` ([ADR-0008](docs/adr/0008-develop-is-the-trunk.md)).
- The repository follows the cross-repo standard v1 ([ADR-0007](docs/adr/0007-adopt-cross-repo-standard-v1.md)).

### Removed

- The `TODO(jobship):` markers in templates and doctor's `todo-markers` check.

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

[Unreleased]: https://github.com/andryorelabs/jobship/compare/v0.5.3...HEAD
[0.5.3]: https://github.com/andryorelabs/jobship/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/andryorelabs/jobship/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/andryorelabs/jobship/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/andryorelabs/jobship/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/andryorelabs/jobship/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/andryorelabs/jobship/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/andryorelabs/jobship/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/andryorelabs/jobship/releases/tag/v0.1.1
