# Configuration

jobship is configured by the data directory and by a few environment variables. An empty value counts as unset. Terms follow [GLOSSARY.md](../GLOSSARY.md).

## Environment variables

`src/core/env.ts` is the one place the CLI reads the `JOBSHIP_` prefix. `bin/jobship` reads the launcher variables in shell.

| Variable                      | Read by            | Meaning                                                                                        |
| ----------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `JOBSHIP_HOME`                | CLI                | The data directory to use. An explicit `--data` flag or this variable skips the upward search. |
| `JOBSHIP_CACHE_DIR`           | CLI                | Where downloaded tools such as typst are cached. Default `~/.cache/jobship`.                   |
| `JOBSHIP_CLAUDE_PLUGINS_FILE` | CLI (`doctor`)     | Path to the Claude Code installed-plugins file that `doctor` inspects.                         |
| `JOBSHIP_BUILD_VERSION`       | CLI (build define) | The version string compiled into a release binary. Not set at run time.                        |
| `JOBSHIP_FROM_SOURCE`         | `bin/jobship`      | Set to `1` to run the CLI from source with bun instead of a downloaded binary.                 |
| `JOBSHIP_PREFETCH`            | `bin/jobship`      | Set to `1` to download the release binary at session start without running a command.          |
| `JOBSHIP_RELEASE_BASE_URL`    | `bin/jobship`      | Base URL for release downloads. Default is the GitHub releases of `andryorelabs/jobship`.      |

## The data directory

The data directory holds the Profile, Fact bank, Answer bank and Event log, marked by `jobship.json`. The tool ships none of it ([ADR-0003](adr/0003-code-and-personal-data-live-apart.md)). See [Data dir layout](guide/data-dir.md) and the [Profile reference](reference/profile.md).
