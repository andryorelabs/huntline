# The Dossier is the source of derived files

Status: Accepted
Date: 2026-11-12

The Fact bank, Bullets, Profile, Never-claim list and Answer bank are derived from the Dossier and change only through an Approval batch.

## Context

Onboarding asked the user to hand-write `facts.yaml`, `bullets.yaml`, `profile.yaml` and `never-claim.yaml` from templates carrying `TODO(jobship):` markers. People without a CV, juniors and career changers had no path in, and nothing tied a fact back to where it came from.

Ruled out:

- Let the agent write the YAML files directly: a fabricated fact reaches a CV with no record of its origin and no human checkpoint.
- Make the Dossier itself machine-only YAML: the user must be able to read and correct it in their own words.

## Decision

- The Dossier lives in the data dir as `dossier/career.md`, `dossier/search.md`, `dossier/presence.md` and `dossier/identity.md`, Markdown with YAML front matter holding `status` and `sources`.
- `jobship dossier derive` turns a proposal into an Approval batch holding only differences from the current derived files; `jobship dossier apply` writes it atomically.
- Every fact cites a Dossier line (`dossier/<section>.md:<line>`) and a source: `cv`, `github`, `linkedin`, `interview` or `export`. A proposal without them is refused.
- `jobship init` no longer writes `TODO(jobship):` markers; `jobship doctor` checks Dossier completeness and non-empty derived files instead.

## Consequences

- A fact always traces to a line the user wrote or approved.
- Editing `facts.yaml` by hand still works, but the next derive proposes the difference against the Dossier.
- The CLI validates proposals; the agent that writes them is untrusted for content.
