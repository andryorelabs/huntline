# Development

How to work on jobship. Terms follow [GLOSSARY.md](../GLOSSARY.md). Contributor rules are in [CONTRIBUTING.md](../CONTRIBUTING.md) and agent rules in [AGENTS.md](../AGENTS.md).

jobship follows the cross-repo standard v1 recorded in [ADR-0007](adr/0007-adopt-cross-repo-standard-v1.md). The standards pages live in the [aokit](https://github.com/andryorelabs/aokit/tree/main/docs/standards) repository, and the brand rules in [andryore-web](https://github.com/andryorelabs/andryore-web/blob/main/docs/brand/README.md).

## Setup

Bun only. From the repo root:

```sh
bun install --frozen-lockfile
```

## Scripts

Every script runs with `bun run <name>`.

| Script                | What it does                                                       |
| --------------------- | ------------------------------------------------------------------ |
| `check`               | Typecheck, lint, format check, knip and docs links. Offline.       |
| `test`                | All tests, with the coverage gate.                                 |
| `fix`                 | Format and autofix lint.                                           |
| `format:check`        | Fail when a file is not formatted.                                 |
| `format:write`        | Format every file.                                                 |
| `lint:docs`           | Check relative Markdown links.                                     |
| `lint:commits`        | Check commit messages against commitlint.                          |
| `repo-settings:check` | Diff the live repository settings against the files in `.github/`. |
| `ci:local`            | Run what CI runs: install, `check`, `test` and commit lint.        |

CI and the git hooks call these scripts, never the tools behind them. Do not run `build` unless a release or a binary smoke test needs it.

## Repository settings

Repository settings live as code, not as clicks:

- `.github/rulesets/main.json`: the `main` ruleset (no deletion, no force push, linear history, pull request required, squash only, thread resolution, the "CI passed" and "Validate PR title" checks, signed commits, no bypass actors).
- `.github/rulesets/tags.json`: the `refs/tags/v*` ruleset (no deletion, update or force push).
- `.github/repo-settings.json`: the repository-level settings (squash-only merges, title and message defaults, branch cleanup, auto-merge, security features, homepage and topics).

`bun run repo-settings:check` reads the live values with `gh api`, diffs them against those files, prints each difference and exits non-zero when there is any. It needs an authenticated `gh`.

To change a setting:

1. Edit the JSON files in a pull request.
2. Run `bun tools/repo-settings/apply.ts`. It needs an admin `gh` login and prints each call it makes. It applies every key and both rulesets through the right endpoints.
3. Run `bun run repo-settings:check`. It must exit 0.

Live settings are never edited in the web UI. Drift is fixed by re-applying the files.

## Releasing

A release is a signed, annotated `v*` tag on `main`. The `release.yml` workflow does the rest.

1. Move the `[Unreleased]` notes in `CHANGELOG.md` under a new `## [X.Y.Z] - YYYY-MM-DD` heading, add its compare-link reference at the bottom, and set `version` in `package.json` and in `.claude-plugin/plugin.json`. Merge that through a pull request titled `chore: 🔖 release X.Y.Z`.
2. Update local `main` to the merged commit.
3. Cut the tag with your signing key:

   ```sh
   git tag -s -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. The workflow verifies the tagged commit is on `main`, waits for a green "CI passed" on it, builds the binaries, attests build provenance for every binary and `SHA256SUMS`, and publishes the release with the body taken from the tag's `CHANGELOG.md` section. If that section is missing or empty, the notes script fails and no release is created.
5. Follow the [dogfooding checklist](guide/dogfooding.md) against the new release.

## Tests

- Tests sit beside the code as `*.test.ts`; tool tests sit in `tools/`.
- Use synthetic fixtures only ([ADR-0003](adr/0003-code-and-personal-data-live-apart.md)).
- A new `src/**/*.ts` module needs a test that imports it or a reasoned entry in the coverage exemptions file.

## Docs

- Every Markdown file under `docs/` is linked from [docs/README.md](README.md), except `docs/agents/`, `docs/adr/` (behind its own index) and `docs/brand/` (behind its README).
- Every `JOBSHIP_*` variable that `src/` reads is named in [configuration.md](configuration.md).
- A new ADR starts from [adr/template.md](adr/template.md) and gets a row in the [index](adr/README.md).
