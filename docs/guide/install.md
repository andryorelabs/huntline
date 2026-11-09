# Install

## As a Claude Code plugin

Add the repository as a plugin marketplace and install `huntline`:

```sh
claude plugin marketplace add AndryOre/huntline
claude plugin install huntline
```

The plugin ships the skills, the two subagents, the `/huntline:init` and `/huntline:doctor` commands, and the Guard hook registration. Its `bin/huntline` shim downloads the release binary for your platform on first use and verifies its checksum. If the checksum does not match, the shim refuses to run.

After installing, run `huntline doctor` and `huntline guard --self-test`, then follow the [dogfooding checklist](dogfooding.md).

## From source

```sh
git clone https://github.com/AndryOre/huntline
cd huntline
bun install
HUNTLINE_FROM_SOURCE=1 bin/huntline doctor
```

`HUNTLINE_FROM_SOURCE=1` makes the shim run `src/cli.ts` with bun instead of downloading a binary. Contributors run `bun run check` and `bun test`.

## External tools

| Tool | Needed for |
| --- | --- |
| `typst` | `cv build`. Installed by `huntline setup` (or on first `cv build`) into the huntline cache, checksum-verified, no sudo. |
| `pdftotext` (poppler) | `cv build` text extraction. Install with `sudo apt install poppler-utils` or `brew install poppler`; `huntline setup` and `doctor` report it. |
| Browser MCP over CDP | `apply`, `browser-source` skills |
| Gmail MCP | `inbox`, `outreach` skills |

## Choosing where your data lives

Keep your data outside the repository. See [data dir layout](data-dir.md) for how huntline finds it.
