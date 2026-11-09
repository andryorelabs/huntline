# CLI reference

Every command prints exactly one JSON envelope on stdout.

```json
{"ok":true,"data":{}}
{"ok":false,"error":{"code":"usage","message":"...","recoverable":false,"recoveryAction":"..."}}
```

`--data <dir>` selects the data dir; otherwise `HUNTLINE_HOME`, then the nearest `huntline.json` upward from the working directory. `huntline --version` prints the version.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success (`ok: true`). |
| 1 | The command ran and found a problem to fix: `todo-markers`, `lint-failed`, `verify-mismatch`, `batch-changed`, `bullet-fact-missing`, `not-found`, `already-exists` and similar. |
| 2 | Usage or configuration error: `usage`, `unknown-command`, `data-dir-not-found`, `profile-missing`, `profile-malformed`. |
| 3 | Internal error (`internal`). |

## Commands

### `huntline init`

Scaffolds `huntline.json`, `profile.yaml`, `facts.yaml`, `bullets.yaml` and `never-claim.yaml` in the working directory with `TODO(huntline):` markers. Refuses to overwrite (`already-exists`, exit 1).

### `huntline doctor`

Validates the Profile and scans for markers. Valid: exit 0 with `dataDir`, `tracker`, `sources`, `markers`. Markers remain: exit 1 `todo-markers` listing file and line. Malformed or missing Profile: exit 2.

### `huntline sweep`

`sweep [--source <name>]... [--keyword <text>]...` runs the Profile's Sources, dedups, gates and creates Leads. Returns per-Source `seen/known/new` counts and separates `failed` from `empty`.

### `huntline ingest`

`ingest --source <label> (--file <postings.json> | --json <postings>)` applies the same dedup and Gates to Posting JSON from browser Sources or JobSpy. A Posting needs `id`, `url`, `company` and `title`; `location`, `remote`, `contract`, `salary`, `stack`, `description` and `postedAt` are optional.

### `huntline score`

`score <key> --score <0-100> [--reason <text>]... [--liveness live|closed|unknown] [--liveness-error <message>]` records a Fit score and liveness as an Event. A liveness error is stored as `unknown`.

### `huntline ledger`

`ledger list` lists every Posting seen, dismissed or duplicate. `ledger check --json <posting>` reports whether a Posting is a duplicate.

### `huntline events`

`events append --json <event>` appends an Event under a lock. `events list [--key <key>]` lists Events.

### `huntline status`

`status <key>` prints the Application state derived from the Events, or `not-found` (exit 1).

### `huntline company`

`company add <careers-url>` detects the ATS and slug (Greenhouse, Lever, Ashby, Workable, SmartRecruiters) and stores it. `company list` lists stored companies.

### `huntline cv`

- `cv build [--variant <name>] [--tag <tag>]... [--requirement <text>]... [--template <file>]` builds a CV from Bullets backed by Fact bank facts, renders it with Typst and extracts text.
- `cv lint [--variant <name> | --file <text>]` fails with `lint-failed` on Never-claim terms, repeated phrases, unknown numbers and placeholders.
- `cv coverage <key> --requirement <text>...` lists requirements as `covered` (with fact ids) or `missing`.

### `huntline apply`

- `apply answer <question> --key <key> [--scope <scope>]` returns an Answer bank answer with provenance or `abstain` and records a field Blocker.
- `apply answer <question> --scope <scope> --save <text> --provenance <source>` saves an answer.
- `apply verify --intended <file> --dump <file>` compares intended field values with a field dump; mismatches exit 1 with `verify-mismatch`.
- `apply block <key> --detail <text> [--scope field|section|application]` records a Blocker.

### `huntline needs`

Lists open Blockers grouped by Application and scope.

### `huntline inbox`

- `inbox propose --emails <classified.json>` matches classified emails (`rejection`, `interview`, `info-request`, `offer`, `other`) to Applications and writes an Approval batch.
- `inbox apply <batch>` writes Events and tracker changes only if the batch hash is unchanged; otherwise exit 1 `batch-changed`. Re-running is a no-op.

### `huntline inbox eval`

`inbox eval <classifications.json> [--labels <dir>]` scores classifications against the labelled EN/ES fixture emails and reports per-class precision and recall.

### `huntline outreach`

- `outreach lint --channel linkedin|email --recipient <name> --company <company> --file <draft> [--addressee <name>] [--draft-company <company>]` checks length caps (LinkedIn 300 characters, email 160 words), placeholders, stock phrases and name/company consistency.
- `outreach log --channel linkedin|email --recipient <name> [--key <key>]` records an outreach and enforces `outreachDailyCap`.

### `huntline interview`

`interview pack <key>` scaffolds a Prep pack with Stories linked to fact ids. `interview check <key>` validates it.

### `huntline migrate`

`migrate legacy <dir>` imports legacy Markdown sweeps, reviews and applications. `migrate linear --team <key> [--project <name>]` imports Linear issues. Both write Events and are idempotent.

### `huntline guard`

PreToolUse hook. Reads the hook payload from stdin and prints a `permissionDecision` of `allow` or `deny`; it fails closed on malformed or oversized input. `guard --record` records snapshot labels after `take_snapshot`.
