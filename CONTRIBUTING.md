# Contributing

Thanks for your interest in contributing to jobship! By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

This repository uses [bun](https://bun.sh) only. Run `bun install --frozen-lockfile`, then check the `package.json` scripts before running anything. Do not run the build unless asked. See [AGENTS.md](AGENTS.md) for the repo layout and rules.

## Branches and commits

Work happens on feature branches that target `develop`; never push directly to `main` or `develop`. `main` holds released history only. Commits and PR titles use Conventional Commits in English with a bullet-point body. The title format is `type: <gitmoji> lowercase subject`, for example `feat: ✨ add user authentication`. Hooks run formatting, lint and commitlint locally.

Default gitmoji per type:

| Type       | Gitmoji |
| ---------- | ------- |
| `feat`     | ✨      |
| `fix`      | 🐛      |
| `docs`     | 📝      |
| `refactor` | ♻️      |
| `perf`     | ⚡️      |
| `test`     | ✅      |
| `build`    | 📦      |
| `ci`       | 👷      |
| `chore`    | 🔧      |
| `deps`     | ⬆️      |
| `release`  | 🔖      |
| `revert`   | ⏪      |

## Merging

Pull requests are squash-merged, so the PR title becomes the commit message. The `CI passed` check must be green first. Run `bun run check` and `bun test` locally before opening a PR.

## Tests

New functionality and bug fixes must add or update tests in the same PR. Use synthetic fixtures; never commit your own Profile, Fact bank or CV.

## Safety rules

jobship never submits a form or sends a message, and the Guard fails closed. A change that weakens either will not be merged. See the [safety model](docs/guide/safety.md).

## Reporting security issues

Do not open a public issue for a vulnerability. Report it privately as described in [SECURITY.md](.github/SECURITY.md).
