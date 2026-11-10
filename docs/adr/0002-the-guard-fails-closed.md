# The Guard fails closed

The Guard denies Submit and Send actions, and also denies whenever it cannot parse its input or hits an internal error. emet's own guard fails open because its mistakes are recoverable; a wrong submission or a sent message is not.

Fail closed covers the whole path from the hook to the decision:

- When the launcher cannot produce or run the Guard binary (unsupported platform, missing tools, failed download, checksum mismatch), it denies the guarded call. A hook that merely exits non-zero is non-blocking in Claude Code, so the launcher prints a deny decision instead.
- The Guard never grants permission. When it has no objection it prints nothing, and Claude Code's own permission prompts stay in force.
- The Guard covers the tool patterns listed in `hooks/hooks.json`: browser MCP servers and Gmail send actions. It does not cover Bash or desktop-control tools. This is a documented limit, not a guarantee about every route to a Submit.
