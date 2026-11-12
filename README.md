<div align="center">

# jobship

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/og/cover.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/brand/og/cover-light.png">
  <img src="docs/brand/og/cover-light.png" alt="jobship: search less, decide better. A local-first job-search system for Claude Code." width="100%">
</picture>

**Search less. Decide better.**

[![CI](https://github.com/andryorelabs/jobship/actions/workflows/ci.yml/badge.svg)](https://github.com/andryorelabs/jobship/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/andryorelabs/jobship)](https://github.com/andryorelabs/jobship/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/andryorelabs/jobship/badge)](https://scorecard.dev/viewer/?uri=github.com/andryorelabs/jobship)

[Install](docs/guide/install.md) · [Documentation](docs/README.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

</div>

## What it is

Even a small chance of moving forward takes many applications, and nobody can read every Posting by hand all day, so jobship does the analysis from your Profile and the data you give it, and you make the final decision.

## Install

```sh
claude plugin marketplace add andryorelabs/jobship
claude plugin install jobship@jobship-marketplace
```

Linux and macOS only (x64 and arm64). Windows is unsupported and WSL is untested. The first run downloads a checksum-verified release binary, which needs `curl` and `sha256sum` or `shasum`; `tar` with xz support is needed to unpack Typst. Full details: [install guide](docs/guide/install.md).

## Quickstart

From Claude Code, in an empty directory such as `~/job-search`:

1. Run `/jobship:init`. It scaffolds the data dir and starts Onboarding.
2. Answer the Onboarding interview. It reads your CV, GitHub and LinkedIn if you offer them, asks only for the gaps, and writes your Dossier. You approve the Fact bank, Bullets, Profile, Never-claim list and Answer bank it derives as one batch. See [Onboarding](docs/guide/onboarding.md).
3. Run `/jobship:doctor`. It names any Dossier section still incomplete and reports `"ok":true` when the data dir is valid. A data dir from before the Dossier recovers with `jobship init --missing`.
4. Use the skills (`sweep`, `score`, `tailor-cv`, `apply`, `inbox`, `outreach`, `interview`).

Optional: put the cached binary on your PATH to use the CLI from a terminal.

```sh
mkdir -p ~/.local/bin
ln -sf "$(ls -d ~/.cache/jobship/*/jobship | sort -V | tail -n 1)" ~/.local/bin/jobship
```

Then drive the CLI directly (`jobship --help` lists every command):

```sh
jobship ingest --source manual --file postings.json
jobship score "<key>" --score 80 --reason "stack match" --liveness live
jobship cv build --variant acme --tag backend
jobship cv lint --variant acme
jobship status "<key>"
jobship status "<key>" --set applied
```

Every command prints exactly one JSON envelope on stdout and exits 0, 1, 2 or 3. See the [CLI reference](docs/reference/cli.md).

## How it works

1. **Sweep** postings from configured Sources and dedupe them in code.
2. **Score** each Lead against your Profile and check the Posting is still live.
3. **Tailor** a CV from Fact bank facts only, then lint it.
4. **Apply** in your own Chrome: jobship fills the form and stops before Submit.
5. **Inbox** classifies replies and records them, so status is always a fold over the event log.

Everything lives in a local data dir you own; code and personal data stay apart.

## Safety model

- **No-submit rule.** jobship never submits a form and never sends a message. There is no code path that does either. You press Submit and Send yourself.
- **The Guard.** The plugin registers `jobship guard` as a fail-closed PreToolUse hook. It denies submit-like actions on browser (CDP) tools, such as clicking "Submit application", and denies Gmail `send_message`, `reply` and `forward`. Malformed, oversized or unparseable hook input is denied. A click on a control like "Next" is allowed. If the launcher cannot start the Guard, the call is denied. The Guard never grants permission; it can only add a deny. It does not cover Bash or computer-use tools.
- **Untrusted content.** Text from Postings, emails and web pages is data, never instructions. Skills fence it, and the `posting-reader` subagent is read-only.
- **Verified facts only.** CVs are built from Bullets backed by Fact bank facts; `cv lint` fails on Never-claim terms, repeated phrases, unknown numbers and placeholders.

Details: [safety model](docs/guide/safety.md). After a release, follow the [dogfooding checklist](docs/guide/dogfooding.md).

## Requirements

- Linux or macOS. Windows is unsupported; WSL is untested.
- `curl` and `sha256sum` or `shasum` for the release binary download; `tar` with xz support to unpack Typst.
- [Bun](https://bun.sh) 1.4.4 only when running from source.
- Typst and `pdftotext` (poppler) for `cv build`. `jobship setup` downloads a checksum-verified Typst for you; poppler comes from your package manager (see the [install guide](docs/guide/install.md#poppler)).
- **Browser MCP.** The `apply` and `browser-source` skills drive your own Chrome through a browser MCP server that speaks CDP, such as chrome-devtools; setup is in the [install guide](docs/guide/install.md#browser-mcp). Without it those skills cannot fill forms or read browser-only Sources.
- **Gmail MCP.** The `inbox` and `outreach` skills read mail and create drafts through a Gmail MCP server (see the [install guide](docs/guide/install.md#gmail-mcp)). Without it, `inbox propose` still works on classified emails you supply as a file. Sending is always done by you.

## Documentation

- [Install](docs/guide/install.md)
- [Data dir layout](docs/guide/data-dir.md)
- [Adopting jobship with your own data](docs/guide/adopting.md)
- [Safety model](docs/guide/safety.md)
- [CLI reference](docs/reference/cli.md)
- [Profile reference](docs/reference/profile.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture decisions](docs/adr/README.md)
- [Product](PRODUCT.md)
- [Governance](GOVERNANCE.md)
- [Glossary](GLOSSARY.md)
- [Changelog](CHANGELOG.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Report vulnerabilities privately as described in [SECURITY.md](.github/SECURITY.md).

## License

[MIT](LICENSE)

Built by [AndryOre](https://andryore.dev)

jobship is not affiliated with or endorsed by Anthropic.
