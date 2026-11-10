# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Type-aware lint, formatter, dead-code check, commit hooks and docs link check.
- `AGENTS.md`, contributing guide, security policy and issue and PR templates.
- `PRODUCT.md`, `GOVERNANCE.md`, a labels sync workflow and a bun cache in CI.

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
