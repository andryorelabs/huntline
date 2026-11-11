# CLI reference

Every command prints exactly one JSON envelope on stdout.

```json
{"ok":true,"data":{}}
{"ok":false,"error":{"code":"usage","message":"...","recoverable":false,"recoveryAction":"..."}}
```

`--data <dir>` selects the data dir; otherwise `JOBSHIP_HOME`, then the nearest `jobship.json` upward from the working directory. The legacy `HUNTLINE_HOME` and `huntline.json` are still accepted; see [ADR-0005](../adr/0005-rename-huntline-to-jobship.md). `jobship --version` prints the version.

## Exit codes

| Code | Meaning                                                                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Success (`ok: true`).                                                                                                                                                            |
| 1    | The command ran and found a problem to fix: `todo-markers`, `lint-failed`, `verify-mismatch`, `batch-changed`, `bullet-fact-missing`, `not-found`, `already-exists` and similar. |
| 2    | Usage or configuration error: `usage`, `unknown-command`, `data-dir-not-found`, `profile-missing`, `profile-malformed`.                                                          |
| 3    | Internal error (`internal`).                                                                                                                                                     |

## Commands

### `jobship init`

Scaffolds `jobship.json`, `profile.yaml`, `facts.yaml`, `bullets.yaml` and `never-claim.yaml` in the working directory with `TODO(huntline):` markers. Refuses to overwrite (`already-exists`, exit 1).

### `jobship doctor`

Validates the Profile, scans for markers and validates `facts.yaml`, `bullets.yaml` and `never-claim.yaml` when present. Valid: exit 0 with `guard`, `warnings`, `dataDir`, `tracker`, `sources`, `markers`, `tools`. `guard` is `{ selfTest: "pass" | "fail", pluginInstalled: boolean }`: a failing Guard self-test exits 1 `guard-self-test-failed`; `pluginInstalled` is true when `~/.claude/plugins/installed_plugins.json` (or the file named by `JOBSHIP_CLAUDE_PLUGINS_FILE`) has a `jobship@…` entry. A missing, unreadable or malformed plugins file, or a missing plugin, never fails doctor: it adds a `guard-plugin-missing` entry to `warnings` whose `recoveryAction` is `claude plugin marketplace add andryorelabs/jobship && claude plugin install jobship@jobship-marketplace`. When the Profile's tracker kind is `linear`, doctor checks the Linear connection (read-only) and exits 1 `linear-not-ready` listing every problem: missing `LINEAR_API_KEY`, a rejected key, an unknown team key or a mapped state missing from the team; with kind `local` it never touches the network. Markers remain: exit 1 `todo-markers` listing file and line. A CV data file that does not parse, or a Bullet citing a fact id missing from the Fact bank: exit 1 `cv-data-invalid`. A data dir without those files still passes. Malformed or missing Profile: exit 2.

### `jobship setup`

Prepares the tools `cv build` needs. Downloads the pinned Typst release (checksum-verified, no sudo) into the jobship cache unless `typst` is already on `PATH`, then checks `pdftotext`. Success: exit 0 with the status of both tools. `pdftotext` missing or Typst unavailable: exit 1 `cv-tool-missing` with the install command in `recoveryAction`. `cv build` installs Typst the same way on first use. `doctor` reports the same status under `tools`.

### `jobship sweep`

`sweep [--source <name>]... [--keyword <text>]...` runs the Profile's Sources, dedups, gates and creates Leads. Returns per-Source `seen/known/new` counts and separates `failed` from `empty`.

### `jobship ingest`

`ingest --source <label> (--file <postings.json> | --json <postings>)` applies the same dedup and Gates to Posting JSON from browser Sources or JobSpy. A Posting needs `id`, `url`, `company` and `title`; `location`, `remote`, `contract`, `salary`, `stack`, `description` and `postedAt` are optional.

### `jobship score`

`score <key> --score <0-100> [--reason <text>]... [--liveness live|closed|unknown] [--liveness-error <message>]` records a Fit score and liveness as an Event. A liveness error is stored as `unknown`.

### `jobship ledger`

`ledger list` lists every Posting seen, dismissed or duplicate. `ledger check --json <posting>` reports whether a Posting is a duplicate.

### `jobship events`

`events append --json <event>` appends an Event under a lock. `events list [--key <key>]` lists Events.

### `jobship status`

`status <key>` prints the Application state derived from the Events, or `not-found` (exit 1). `status <key> --set <state>` appends a `status.changed` Event and projects it to the tracker; valid states are `lead`, `to-apply`, `applied`, `screening`, `interviewing`, `offer`, `hired`, `rejected`, `withdrawn` and `discarded`, and anything else exits 2.

### `jobship company`

ATS Sources (`greenhouse`, `lever`, `ashby`, `workable`, `smartrecruiters`) only sweep companies saved here. `company add <careers-url>` detects the ATS and slug (Greenhouse, Lever, Ashby, Workable, SmartRecruiters) and stores it. `company list` lists stored companies.

### `jobship cv`

- `cv build [--variant <name>] [--tag <tag>]... [--requirement <text>]... [--template <file>]` builds a CV from Bullets backed by Fact bank facts, renders it with Typst and extracts text.
- `cv lint [--variant <name> | --file <text>]` fails with `lint-failed` on Never-claim terms, repeated phrases, unknown numbers and placeholders. Numbers compare independent of locale (`75.000` equals `75,000`, `4,8` equals `4.8`), and only `TODO(...)` and `TODO:` markers count as placeholders, never the Spanish word "todo".
- `cv coverage <key> --requirement <text>...` lists requirements as `covered` (with fact ids) or `missing`.

### `jobship apply`

- `apply answer <question> --key <key> [--scope <scope>]` returns an Answer bank answer with provenance or `abstain` and records a field Blocker.
- `apply answer <question> --scope <scope> --save <text> --provenance <source>` saves an answer and closes every open field Blocker whose question normalizes equal.
- `apply answer --list` prints every saved answer with scope and provenance.
- `apply verify --intended <file> --dump <file>` compares intended field values with a field dump; mismatches exit 1 with `verify-mismatch`.
- `apply block <key> --detail <text> [--scope field|section|application]` records a Blocker.

### `jobship needs`

Lists open Blockers grouped by Application and scope.

### `jobship inbox`

- `inbox propose --emails <classified.json>` matches classified emails (`rejection`, `interview`, `info-request`, `offer`, `other`) to Applications and writes an Approval batch.
- `inbox apply <batch>` writes Events and tracker changes only if the batch hash is unchanged; otherwise exit 1 `batch-changed`. Re-running is a no-op.

### `jobship inbox eval`

`inbox eval <classifications.json> [--labels <dir>]` scores classifications against the labelled EN/ES fixture emails and reports per-class precision and recall.

### `jobship outreach`

- `outreach lint --channel linkedin|email --recipient <name> --company <company> --file <draft> [--addressee <name>] [--draft-company <company>]` checks length caps (LinkedIn 300 characters, email 160 words), placeholders, stock phrases and name/company consistency.
- `outreach log --channel linkedin|email --recipient <name> [--key <key>]` records an outreach and enforces `outreachDailyCap`.

### `jobship interview`

`interview pack <key>` scaffolds a Prep pack with Stories linked to fact ids. `interview check <key>` validates it.

### `jobship migrate`

`migrate legacy <dir>` is an importer for one specific legacy Markdown format (sweeps, reviews and applications tables); most users never need it. `migrate linear --team <key> [--project <name>]` imports Linear issues. Both write Events and are idempotent.

### `jobship guard`

PreToolUse hook. Reads the hook payload from stdin and prints a `permissionDecision` of `allow` or `deny`; it fails closed on malformed or oversized input. `guard --record` records snapshot labels after `take_snapshot`. `guard --self-test` runs canned payloads (a click on a "Submit application" uid for `mcp__chrome-devtools__click`, `press_key` Enter, `evaluate_script`, Gmail `send_message`, and an allowed `take_snapshot`) through the Guard decision and checks each denied tool name against the PreToolUse matcher in the shipped `hooks/hooks.json`. It prints an envelope listing each case with `expected`, `actual` and `matcherCovers`, and exits 0 only if every case matches; otherwise exit 1 `guard-self-test-failed` naming the failing cases.
