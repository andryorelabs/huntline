# develop is the trunk

Status: Accepted
Date: 2026-11-11

`develop` is the development branch and the `/emet` trunk; `main` holds released history only.

## Context

All work landed on `main`, which is also the branch releases are tagged on. A release candidate had no place to accumulate and be verified before it reached the branch users install from. The sibling repositories emet and andryore-web already work on a `develop` trunk, and the cross-repo standard allows a `develop` ruleset next to `main` and `tags` (rule A4) and merge commits for a repository that promotes `develop` to `main` (rule A1).

Ruled out:

- Keep `main` as the trunk: there is no verification point before a release.
- Squash `develop` into `main`: squashing rewrites the relationship between the two branches and causes repeated conflicts.

## Decision

- Feature branches, `/emet` wave pull requests and Renovate pull requests target `develop` and are squash-merged, so `develop` stays linear.
- A release is a pull request from `develop` to `main`, merged with a merge commit. The release tag is still cut on `main`, and `release.yml` still requires the tagged commit to be on `main`.
- `main` stays the default branch, so installs and the README read released history.
- Rulesets live as code in `.github/rulesets/`: `develop` (squash only, linear history, required checks with the up to date policy, signed commits), `main` (merge commits only, required checks, signed commits) and `tags`. `main` drops linear history and the up to date policy, because a merge commit on `main` is never on `develop`.
- `ci.yml`, `codeql.yml` and `labels.yml` run on pushes to `main` and `develop`. `lint:commits` reads the commits since `origin/develop`.
- The `pre-push` hook refuses a push to `main` or `develop`.
- `emet.config.json` sets `repo.trunk` to `develop` and `tracker.transitions.onPrMerge` to `coordinator`.

This amends [ADR-0007](0007-adopt-cross-repo-standard-v1.md) only in its trunk: every rule it adopted for the trunk now applies to `develop`.

## Consequences

- A `Closes #N` line no longer closes an issue on merge, because `develop` is not the default branch. The `/emet` coordinator closes each ticket after the merge.
- Two long-lived branches need the release pull request to keep them in sync. `main` carries merge commits that `develop` lacks.
- Repository-level settings allow merge commits again; the rulesets decide which method each branch accepts.
- Renaming a required job in a workflow requires updating both branch rulesets in the same change, or `bun run test` fails.
