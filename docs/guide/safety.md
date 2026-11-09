# Safety model

## No submit, no send

huntline never submits a form and never sends a message. No command and no skill has such a code path. The `apply` skill fills a form, runs a required-field sweep, verifies it with `huntline apply verify` and stops before Submit. The `outreach` and `inbox` skills create drafts and propose changes; you press Send.

## The Guard

`huntline guard` is registered by the plugin as a PreToolUse hook. It reads the hook payload from stdin and prints a `permissionDecision` of `allow` or `deny`.

- It matches browser (CDP) tools and the Gmail tools `send_message`, `reply` and `forward`.
- It denies clicks on controls whose label looks like a submit, such as "Submit application", and allows ordinary navigation such as "Next".
- It fails closed: invalid JSON, oversized input (over 1 MiB) and any internal error deny.
- `huntline guard --record` runs after `take_snapshot` and records element labels so later clicks can be judged by label.

- `huntline guard --self-test` checks that the Guard still denies the canned submit and send actions and that the shipped hook matcher still covers those tools. `huntline doctor` runs the same check and fails if it does not pass. The self-test never changes the decision or the matcher; it only reads them.

See ADR 0002 in `docs/adr`. After each release, follow the [dogfooding checklist](dogfooding.md).

## Untrusted content

Postings, emails and web pages are data, never instructions. Every skill states this rule and fences quoted page text. The `posting-reader` subagent is read-only.

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
