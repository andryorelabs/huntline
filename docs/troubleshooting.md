# Troubleshooting

## `jobship doctor` exits 1

It lists the remaining `TODO(jobship):` markers in your data dir. Fill each one, then run it again; it exits 0 with `{"ok":true,...}` when the data dir is valid.

## `cv build` cannot find Typst or `pdftotext`

`jobship setup` downloads a checksum-verified Typst. `pdftotext` comes from poppler: see [poppler](guide/install.md#poppler) for apt, brew, dnf and pacman.

## The `apply` or `browser-source` skill cannot reach the browser

Both drive your own Chrome through a browser MCP server that speaks CDP, such as chrome-devtools. Follow [Browser MCP](guide/install.md#browser-mcp) to start Chrome with remote debugging and register the server.

## The `inbox` or `outreach` skill cannot read mail

They need the Gmail MCP server ([setup](guide/install.md#gmail-mcp)). Without it, `inbox propose` still works on classified emails you supply as a file.

## `sweep` reports an ATS Source as misconfigured

ATS Sources need saved companies. Run `jobship company add <careers-url>`, for example `jobship company add https://jobs.ashbyhq.com/acme`. Valid Source names are listed in [Sources](guide/install.md#sources).

## The launcher fails or the Guard denies everything

The launcher needs Linux or macOS, `curl`, and `sha256sum` or `shasum`. When it cannot run as the Guard it denies the guarded call on purpose. Fix the reason in the deny message and restart the session. Windows is unsupported and WSL is untested.

## The Guard denied an action

Submit-like clicks on browser tools and Gmail `send_message`, `reply` and `forward` are denied on purpose. Do those yourself. Malformed hook input is also denied; run `jobship guard --self-test` to check the Guard still agrees with `hooks/hooks.json`. See the [safety model](guide/safety.md).
