# huntline

[![CI](https://github.com/andryorelabs/huntline/actions/workflows/ci.yml/badge.svg)](https://github.com/andryorelabs/huntline/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/andryorelabs/huntline)](https://github.com/andryorelabs/huntline/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Local-first job-search system for Claude Code: a plugin plus a CLI that sweeps job sources, filters and deduplicates in code, builds CVs only from verified facts, assists form filling in your own browser, and syncs replies from your inbox. You press Submit.

Status: under construction. Working name; the final name is not decided.

## Quickstart

```sh
mkdir ~/job-search && cd ~/job-search
huntline init
```

1. Fill every `TODO(huntline):` marker in the generated files (Profile, Fact bank, Bullets, Never-claim list, Answer bank).
2. Run `huntline doctor`. It exits 1 and lists the remaining markers until you are done, and exits 0 with `{"ok":true,...}` when the data dir is valid.
3. Install the plugin in Claude Code and use the skills (`sweep`, `score`, `tailor-cv`, `apply`, `inbox`, `outreach`, `interview`), or drive the CLI directly:

```sh
huntline ingest --source manual --file postings.json
huntline score "<key>" --score 80 --reason "stack match" --liveness live
huntline cv build --variant acme --tag backend
huntline cv lint --variant acme
huntline status "<key>"
```

Every command prints exactly one JSON envelope on stdout and exits 0, 1, 2 or 3. See the [CLI reference](docs/reference/cli.md).

## How it works

1. **Sweep** postings from configured Sources and dedupe them in code.
2. **Score** each Lead against your Profile and check the Posting is still live.
3. **Tailor** a CV from Fact bank facts only, then lint it.
4. **Apply** in your own Chrome: huntline fills the form and stops before Submit.
5. **Inbox** classifies replies and records them, so status is always a fold over the event log.

Everything lives in a local data dir you own; code and personal data stay apart.

## Safety model

- **No-submit rule.** huntline never submits a form and never sends a message. There is no code path that does either. You press Submit and Send yourself.
- **The Guard.** The plugin registers `huntline guard` as a fail-closed PreToolUse hook. It denies submit-like actions on browser (CDP) tools, such as clicking "Submit application", and denies Gmail `send_message`, `reply` and `forward`. Malformed, oversized or unparseable hook input is denied. A click on a control like "Next" is allowed.
- **Untrusted content.** Text from Postings, emails and web pages is data, never instructions. Skills fence it, and the `posting-reader` subagent is read-only.
- **Verified facts only.** CVs are built from Bullets backed by Fact bank facts; `cv lint` fails on Never-claim terms, repeated phrases, unknown numbers and placeholders.

Details: [safety model](docs/guide/safety.md). After a release, follow the [dogfooding checklist](docs/guide/dogfooding.md).

## Requirements

- [Bun](https://bun.sh) 1.4.4 when running from source; release builds are checksum-verified binaries for linux and macos on x64 and arm64.
- Typst and `pdftotext` (poppler) for `cv build`. `huntline setup` downloads a checksum-verified Typst for you; poppler comes from your package manager (`sudo apt install poppler-utils` or `brew install poppler`).
- **Browser MCP.** The `apply` and `browser-source` skills drive your own Chrome through a browser MCP server that speaks CDP, such as chrome-devtools. Without it those skills cannot fill forms or read browser-only Sources.
- **Gmail MCP.** The `inbox` and `outreach` skills read mail and create drafts through the Gmail MCP server. Without it, `inbox propose` still works on classified emails you supply as a file. Sending is always done by you.

## Documentation

- [Install](docs/guide/install.md)
- [Data dir layout](docs/guide/data-dir.md)
- [Adopting huntline with your own data](docs/guide/adopting.md)
- [Safety model](docs/guide/safety.md)
- [CLI reference](docs/reference/cli.md)
- [Profile reference](docs/reference/profile.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture decisions](docs/adr/README.md)
- [Glossary](GLOSSARY.md)
- [Changelog](CHANGELOG.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Report vulnerabilities privately as described in [SECURITY.md](.github/SECURITY.md).

## License

[MIT](LICENSE)
