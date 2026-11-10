# Troubleshooting

## `huntline doctor` exits 1

It lists the remaining `TODO(huntline):` markers in your data dir. Fill each one, then run it again; it exits 0 with `{"ok":true,...}` when the data dir is valid.

## `cv build` cannot find Typst or `pdftotext`

`huntline setup` downloads a checksum-verified Typst. `pdftotext` comes from poppler: `sudo apt install poppler-utils` or `brew install poppler`.

## The `apply` or `browser-source` skill cannot reach the browser

Both drive your own Chrome through a browser MCP server that speaks CDP, such as chrome-devtools. Install one and start Chrome with remote debugging enabled.

## The `inbox` or `outreach` skill cannot read mail

They need the Gmail MCP server. Without it, `inbox propose` still works on classified emails you supply as a file.

## The Guard denied an action

Submit-like clicks on browser tools and Gmail `send_message`, `reply` and `forward` are denied on purpose. Do those yourself. Malformed hook input is also denied; run `huntline guard --self-test` to check the Guard still agrees with `hooks/hooks.json`. See the [safety model](guide/safety.md).
