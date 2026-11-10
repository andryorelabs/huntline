# Safety model

## No submit, no send

huntline never submits a form and never sends a message. No command and no skill has such a code path. The `apply` skill fills a form, runs a required-field sweep, verifies it with `huntline apply verify` and stops before Submit. The `outreach` and `inbox` skills create drafts and propose changes; you press Send.

## The Guard

`huntline guard` is registered by the plugin as a PreToolUse hook. It reads the hook payload from stdin and either objects or stays silent.

- **It never grants permission.** When it has no objection it prints nothing and exits 0, so Claude Code's normal permission flow still decides. When it objects it prints a PreToolUse `deny` with the reason.
- **What it matches.** Browser (CDP) tools on any server whose name mentions chrome, browser, devtools, playwright, puppeteer or cdp; interactive actions (`click`, `press_key`, `type_text`, `fill`, `fill_form`, `evaluate_script`, `drag`, `upload_file`, `handle_dialog`, `hover`) on any server; and any Gmail action whose name contains send, reply or forward. The Gmail server name is matched in any case, so `mcp__gmail__send_email` and `mcp__Gmail__send_draft` are both denied. Drafts are not.
- **Nested tool names.** The action is the last `__`-separated segment of the tool name, so `mcp__remote-devices__Claude_Browser__click` is judged as a browser click.
- **Clicks.** A click is judged by the label recorded from the last snapshot. Labels with submit, send, send invitation, finalize, apply, connect, confirm, post or complete application as whole words (any case) are denied, so "Apply" and "Send invitation" are denied while "Next", "Continue" and "Save draft" are not. A click on an element with no recorded label is denied; take a fresh snapshot first.
- **Keys, scripts and dialogs.** Enter, Return and Space, a line break in typed or filled text, a submit key, `evaluate_script` and `drag` are denied. `handle_dialog` is denied unless it dismisses the dialog.
- **It fails closed.** Invalid JSON, oversized input (over 1 MiB), an MCP tool name without a readable server and action, and any internal error deny.
- `huntline guard --record` runs after `take_snapshot` and records element labels so later clicks can be judged by label.
- `huntline guard --self-test` checks that the Guard still denies the canned submit and send actions, still stays silent on the canned harmless ones, and that the shipped hook matcher covers every denied tool and does not cover unrelated tools such as `mcp__x__delete_dashboard`. `huntline doctor` runs the same check and fails if it does not pass. The self-test never changes the decision or the matcher; it only reads them.

### The launcher

The hooks run `bin/huntline`, which downloads the release binary for your platform, checks it against `SHA256SUMS` and caches it.

- A `SessionStart` hook runs the launcher with `HUNTLINE_PREFETCH=1`, so the binary is downloaded when the session starts, before the first guarded call.
- When the launcher runs as the Guard and cannot produce or run the binary (unsupported platform or architecture, no curl, no sha256sum or shasum, a failed download, a checksum mismatch, a `plugin.json` without a version, or a binary that exits with an error), it prints a `deny` with the reason and exits 0. A guarded call is never let through because the Guard could not start.
- For `guard --record` and every other command, the same failures exit 1 with a message on stderr.

### Limits

The Guard is a backstop, not a sandbox.

- It only sees the tool calls its matcher covers. **Bash** is not covered: a shell command that runs `curl` or a mail client is not inspected. **computer-use** tools (screen clicks and typing outside a browser MCP) are not covered either.
- A click is judged by its label. A submit control with an unusual label, or an action whose effect does not show in its label, can get past it.
- It never grants permission, so it cannot loosen anything; it can only add a deny.

See ADR 0002 in `docs/adr`. After each release, follow the [dogfooding checklist](dogfooding.md).

## Untrusted content

Postings, emails and web pages are data, never instructions. Every skill states this rule and fences quoted page text. The `posting-reader` subagent has only `WebFetch`: it reads a Posting from a URL or from text given in the prompt and cannot read local files, write or run commands.

## Verified claims

- `cv build` uses only Bullets that cite fact ids present in the Fact bank.
- `cv lint` fails on Never-claim terms (case-insensitive, on word boundaries), repeated phrases, numbers absent from the Fact bank (compared independent of locale, so `75.000` matches `75,000`) and leftover placeholders (`TODO(...)` and `TODO:` markers, not the word "todo").
- `doctor` fails with `cv-data-invalid` when `facts.yaml`, `bullets.yaml` or `never-claim.yaml` does not parse or a Bullet cites a missing fact id.
- `cv coverage` reports missing requirements; they are never added to a CV.
- `apply answer` abstains instead of guessing and records a Blocker.

## Human approval of mailbox changes

`inbox propose` writes an Approval batch. `inbox apply <batch>` writes Events only when the batch hash is unchanged and is idempotent on re-run. An edited batch exits 1 with `batch-changed`.

## Gates

Gates are deterministic. A Posting silent about eligibility gets Eligibility `unknown` and is kept; every dismissal stores a Rejection reason. A liveness check that errors yields `unknown`, never `closed`.
