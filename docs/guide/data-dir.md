# Data dir layout

All personal data lives in one directory that is never part of this repository.

## Resolution order

1. `--data <dir>` on the command line.
2. The `JOBSHIP_HOME` environment variable.
3. The nearest directory, searching upward from the working directory, that contains `jobship.json`.

If none resolves, commands that need data exit 2 with `data-dir-not-found`.

## Files

| Path                                     | Created by            | Purpose                                                            |
| ---------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| `jobship.json`                           | `init`                | Marks the data dir; holds the schema version.                      |
| `profile.yaml`                           | `init`                | The Profile. See the [Profile reference](../reference/profile.md). |
| `facts.yaml`                             | `init`                | The Fact bank: every claim you may make, each with an id.          |
| `bullets.yaml`                           | `init`                | CV Bullets; each cites the fact ids that back it.                  |
| `never-claim.yaml`                       | `init`                | Terms that must never appear in a CV.                              |
| `answers.json`                           | `apply answer --save` | Answers given by you, with provenance.                             |
| `events.jsonl`                           | any write             | The append-only Event log; Application state is derived from it.   |
| `ledger.jsonl`                           | `sweep`, `ingest`     | Every Posting seen, dismissed or deduplicated.                     |
| `companies.json`                         | `company add`         | Companies with detected ATS and slug.                              |
| `cv/template.typ`                        | you                   | Typst template used by `cv build`.                                 |
| `cv/out/`                                | `cv build`            | Built `<variant>.pdf`, `.txt` and `.json`.                         |
| `inbox/`                                 | `inbox propose`       | Approval batches, named by hash.                                   |
| `prep/`                                  | `interview pack`      | Prep packs, one Markdown file per Lead.                            |
| `tracker/` (or the configured directory) | tracker               | Local tracker projection.                                          |
| `.tracker/`, `.inbox/`, `.migrate/`      | internal              | Lock directories.                                                  |

## Markers

Templates contain `TODO(jobship):` markers. `doctor` exits 1 and lists each file and line until every marker is removed.

## Writes

Writes are atomic (temporary file and rename) and run under locks. Two concurrent `events append` calls both land. The Event log is never rewritten.
