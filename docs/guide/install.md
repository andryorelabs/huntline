# Install

## Platform requirements

- Linux or macOS, on x64 or arm64. Windows is unsupported and WSL is untested.
- `curl`, to download the release binary.
- `sha256sum` or `shasum`, to verify it.
- `tar` with xz support, to unpack the Typst download.

## As a Claude Code plugin

Add the repository as a plugin marketplace and install `jobship`:

```sh
claude plugin marketplace add andryorelabs/huntline
claude plugin install jobship@jobship-marketplace
```

The plugin ships the skills, the two subagents, the `/jobship:init` and `/jobship:doctor` commands, and the Guard hook registration. Its `bin/jobship` launcher downloads the release binary for your platform on the first session start (a `SessionStart` hook prefetches it) and verifies its checksum. If the checksum does not match, the launcher refuses to run.

After installing, run `/jobship:init` in an empty directory, then `/jobship:doctor`, and follow the [dogfooding checklist](dogfooding.md).

### Put the binary on your PATH (optional)

The binary is cached at `~/.cache/jobship/<version>/jobship` (or under `$XDG_CACHE_HOME`, or `$JOBSHIP_CACHE_DIR`). To use the CLI from a terminal, link it:

```sh
mkdir -p ~/.local/bin
ln -sf "$(ls -d ~/.cache/jobship/*/jobship | sort -V | tail -n 1)" ~/.local/bin/jobship
jobship --help
```

Re-run the link after an update. `jobship --help` (or `jobship help`) lists every command and the global flags `--data <dir>`, `--version` and `--help`.

## From source

```sh
git clone https://github.com/andryorelabs/huntline
cd huntline
bun install
JOBSHIP_FROM_SOURCE=1 bin/jobship doctor
```

`JOBSHIP_FROM_SOURCE=1` makes the launcher run `src/cli.ts` with bun instead of downloading a binary. Contributors run `bun run check` and `bun test`.

## External tools

| Tool                  | Needed for                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `typst`               | `cv build`. Installed by `jobship setup` (or on first `cv build`) into the jobship cache, checksum-verified, no sudo. |
| `pdftotext` (poppler) | `cv build` text extraction. See [poppler](#poppler); `jobship setup` and `doctor` report it.                          |
| Browser MCP over CDP  | `apply`, `browser-source` skills. See [Browser MCP](#browser-mcp).                                                    |
| Gmail MCP             | `inbox`, `outreach` skills. See [Gmail MCP](#gmail-mcp).                                                              |

### Poppler

| Package manager | Command                          |
| --------------- | -------------------------------- |
| apt             | `sudo apt install poppler-utils` |
| brew            | `brew install poppler`           |
| dnf             | `sudo dnf install poppler-utils` |
| pacman          | `sudo pacman -S poppler`         |

### Browser MCP

The `apply` and `browser-source` skills drive your own Chrome through a browser MCP server that speaks the Chrome DevTools Protocol. The documented server is [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp), which attaches to a Chrome you start with remote debugging.

1. Start Chrome with a dedicated profile and a debugging port:

   ```sh
   google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.config/jobship-chrome"
   ```

   On macOS use `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` instead of `google-chrome`. Log in to the sites you need in that window.

2. Register the server in your Claude Code MCP config (for example `.mcp.json`, or with `claude mcp add`):

   ```json
   {
     "mcpServers": {
       "chrome-devtools": {
         "command": "npx",
         "args": ["-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222"]
       }
     }
   }
   ```

3. Restart Claude Code. The Guard covers any server whose name mentions chrome, browser, devtools, playwright, puppeteer or cdp. See the [safety model](safety.md).

### Gmail MCP

The `inbox` and `outreach` skills use the Gmail connector for Claude Code (tools named `mcp__claude_ai_Gmail__*`, such as `search_threads`, `get_thread` and `create_draft`). Connect it from your claude.ai connector settings. `inbox` only reads; `outreach` only creates drafts. The Guard denies any Gmail tool whose name contains send, reply or forward. Without the connector, `inbox propose` still works on classified emails you supply as a file.

## Sources

`sources` in the Profile lists the Source names that `sweep` runs. Valid names:

| Kind   | Names                                                         | Notes                                                          |
| ------ | ------------------------------------------------------------- | -------------------------------------------------------------- |
| ATS    | `greenhouse`, `lever`, `ashby`, `workable`, `smartrecruiters` | Need companies saved with `jobship company add <careers-url>`. |
| Boards | `getonboard`, `himalayas`, `remoteok`, `hn`                   | Public APIs; no setup.                                         |

An ATS Source with no saved companies is reported as misconfigured, with a hint to run `jobship company add`. An unknown name is reported as `unknown source`. Browser-only Sources (Wellfound, LinkedIn, X) are not `sweep` Sources; the `browser-source` skill collects them and passes the result to `jobship ingest`.

Example: `jobship company add https://jobs.ashbyhq.com/acme` detects the ATS and stores `{ats: "ashby", slug: "acme"}`.

### Terms of service

Browser Sources (LinkedIn, X, Wellfound) are read through your own logged-in session. Automated access can violate their terms of service and can get your account limited or banned. You use them at your own risk: keep volumes low, go slowly and stop at any checkpoint. The `browser-source` skill never submits anything and never stores credentials.

## Changing an Application's state

`jobship status <key> --set <state>` records a `status.changed` Event and projects it to the tracker. Valid states: `lead`, `to-apply`, `applied`, `screening`, `interviewing`, `offer`, `hired`, `rejected`, `withdrawn`, `discarded`. An unknown state exits 2; an unknown key exits 1 with `not-found`.

## Choosing where your data lives

Keep your data outside the repository. See [data dir layout](data-dir.md) for how jobship finds it.
