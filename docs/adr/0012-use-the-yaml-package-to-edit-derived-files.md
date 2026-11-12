# Use the yaml package to edit derived files

Status: Accepted
Date: 2026-11-12

`jobship dossier apply` edits each derived YAML file as a Document with the `yaml` package, so comments and key order survive. `yaml` is the first runtime dependency of jobship.

## Context

Apply used to read a derived file with `Bun.YAML.parse` and write it back with `Bun.YAML.stringify`. Parsing drops comments, so every apply erased the guidance comments in `profile.yaml` (`# Valid names: ...`, the `# Linear only, all optional:` block) and any note the human added to `facts.yaml` or `bullets.yaml`.

`Bun.YAML` exposes only `parse` and `stringify`. It has no Document model, so there is nothing to edit in place.

Alternatives ruled out:

- Hand-written text editing of the YAML: fragile for nested sequences, flow collections and quoting, and it would grow into a second YAML parser to maintain.
- Documenting the loss: the files are meant to be read and annotated by the human, and silent data loss on every apply contradicts that.

## Decision

- Apply parses the current file with `parseDocument`, edits the Document (upsert and remove rows by `id`, set Profile keys, append Never-claim terms) and serializes it.
- `yaml` is pinned to an exact version in `dependencies` and installed with bun.
- A new runtime dependency needs all of: a capability the Bun runtime and the standard library do not provide, a concrete user-visible loss without it, a single-purpose package with no transitive runtime dependencies of its own, and an ADR naming it.
- Reads elsewhere keep using `Bun.YAML.parse`.

## Consequences

- Comments and key order in derived YAML files survive an apply; untouched entries keep their text.
- Values written still parse back identically with `Bun.YAML.parse`.
- The compiled binary now bundles `yaml`, and its version is bumped deliberately.
