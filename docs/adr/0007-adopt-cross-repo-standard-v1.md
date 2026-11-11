# Adopt the cross-repo standard v1

Status: Accepted
Date: 2026-11-11

jobship follows the cross-repo standard v1 for repository settings, workflows, scripts, linting, docs and ADR form, with the not-applicable rules listed below.

## Context

The maintainer keeps several repositories that share one standard, written in the [aokit](https://github.com/andryorelabs/aokit) standards pages, with brand rules in [andryore-web](https://github.com/andryorelabs/andryore-web). jobship had drifted: no repository settings as code, inconsistent script names, no ADR header or section rules, and no docs index test. Bringing it in line makes the repositories predictable for the maintainer and for agents.

## Decision

- jobship adopts standard v1 as written in the aokit standards pages. Spec #103 lists the concrete requirements.
- Brand work follows the andryore-web brand rules, recorded in [ADR-0004](0004-brand-kit-in-docs-brand.md) and `docs/brand/`.
- Existing ADRs keep their decisions. [ADR-0002](0002-the-guard-fails-closed.md) is untouched by the standard: the Guard still fails closed.
- Rules that do not apply to jobship, with reasons:
  - A product site: the repository README and `docs/` are the only public surface.
  - npm publishing: jobship ships as a Claude Code plugin and compiled release binaries, not as an npm package.
  - `FUNDING.yml`: the project takes no sponsorship.
  - `.node-version`: the runtime is bun, pinned by the lockfile and CI.
  - A separate lint-docs workflow: `lint:docs` already runs inside `check` and the existing CI job.
  - `.git-blame-ignore-revs`: there is no mass-reformat commit to hide.
  - The `$schema` URL in `emet.config.json`: it waits for the emet release that publishes the schema.
  - Changes to any other repository: this adoption touches jobship only.

## Consequences

- The standard's tests fail the build when the repository drifts, so changes to settings, docs and scripts go through code review.
- Updating to a later standard version needs a new ADR that supersedes this one.
- The not-applicable list is the one place to check before adding any of those items.
