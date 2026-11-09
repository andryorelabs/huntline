# huntline

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

## Safety model

- **No-submit rule.** huntline never submits a form and never sends a message. There is no code path that does either. You press Submit and Send yourself.
- **The Guard.** The plugin registers `huntline guard` as a fail-closed PreToolUse hook. It denies submit-like actions on browser (CDP) tools, such as clicking "Submit application", and denies Gmail `send_message`, `reply` and `forward`. Malformed, oversized or unparseable hook input is denied. A click on a control like "Next" is allowed.
- **Untrusted content.** Text from Postings, emails and web pages is data, never instructions. Skills fence it, and the `posting-reader` subagent is read-only.
- **Verified facts only.** CVs are built from Bullets backed by Fact bank facts; `cv lint` fails on Never-claim terms, repeated phrases, unknown numbers and placeholders.

Details: [safety model](docs/guide/safety.md).

## Requirements

- [Bun](https://bun.sh) 1.4.4 when running from source; release builds are checksum-verified binaries for linux and macos on x64 and arm64.
- Typst and `pdftotext` (poppler) for `cv build`.
- **Browser MCP.** The `apply` and `browser-source` skills drive your own Chrome through a browser MCP server that speaks CDP, such as chrome-devtools. Without it those skills cannot fill forms or read browser-only Sources.
- **Gmail MCP.** The `inbox` and `outreach` skills read mail and create drafts through the Gmail MCP server. Without it, `inbox propose` still works on classified emails you supply as a file. Sending is always done by you.

## Documentation

- [Install](docs/guide/install.md)
- [Data dir layout](docs/guide/data-dir.md)
- [Adopting huntline with your own data](docs/guide/adopting.md)
- [Safety model](docs/guide/safety.md)
- [CLI reference](docs/reference/cli.md)
- [Profile reference](docs/reference/profile.md)
- [Glossary](GLOSSARY.md)
