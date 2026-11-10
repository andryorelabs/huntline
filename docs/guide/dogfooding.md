# Dogfooding checklist

Follow this after each release, in order, with your own data dir. Stop at the first step that does not pass.

## 1. Install the plugin

```sh
claude plugin marketplace add andryorelabs/huntline
claude plugin install huntline@huntline-marketplace
```

Pass: `claude plugin list` shows `huntline`.

## 2. Doctor is green

Run `huntline doctor`.

Pass: exit 0 with `"ok":true`, `guard.selfTest` is `"pass"`, `guard.pluginInstalled` is `true` and `warnings` is empty. With `tracker.kind: linear`, a green doctor also means the Linear check passed; `linear-not-ready` lists what is missing (`LINEAR_API_KEY`, the team key or a mapped state).

## 3. Guard self-test

Run `huntline guard --self-test`.

Pass: exit 0, and every case in the envelope has `expected` equal to `actual`. A failing run exits 1 with `guard-self-test-failed` naming each failing case.

## 4. One real sweep

Run `huntline sweep` against your configured Sources.

Pass: exit 0 and per-Source `seen/known/new` counts. A Source listed under `failed` is a problem; one under `empty` is fine.

## 5. One apply, stopped at the Submit

Run the `apply` skill on one real Lead in your own Chrome, through the browser MCP. It fills the form and runs `huntline apply verify`.

Pass: the form is filled, `huntline apply verify` reports no mismatch, and the run stops before Submit. Trying to click "Submit application" is denied by the Guard. You press Submit yourself, or close the tab.

## 6. One inbox run against Gmail

Run the `inbox` skill against your mailbox with the Gmail MCP connected, using `huntline inbox` for batches.

Pass: it classifies mail and proposes changes without applying them. Nothing changes in Gmail until you approve.

## 7. Outreach draft, no send

Run the `outreach` skill for one Lead.

Pass: a Gmail draft exists and `huntline outreach` logs it. No message is sent; the Guard denies Gmail `send_message`, `reply` and `forward`.

Command details are in the [CLI reference](../reference/cli.md). Safety rules are in the [safety model](safety.md).
