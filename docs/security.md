# Security

How jobship protects you and your data. Report vulnerabilities as described in [SECURITY.md](../.github/SECURITY.md).

## Boundaries

- **No submit, no send.** No code path submits a form or sends a message ([ADR-0002](adr/0002-the-guard-fails-closed.md)). Skills fill forms and create drafts; you press Submit and Send.
- **The Guard fails closed.** It denies Submit and Send actions, and denies when it cannot parse its input or hits an error. The launcher prints a deny when it cannot produce or run the Guard binary. See the [safety model](guide/safety.md) for what it matches and its limits.
- **Personal data stays out of the repository.** The Profile, Fact bank, Answer bank and Event log live in your data directory ([ADR-0003](adr/0003-code-and-personal-data-live-apart.md)). Tests use synthetic fixtures.
- **Untrusted content is data.** Text from Postings, emails and web pages is never treated as instructions.

## Supply chain

- Releases are cut from a signed, annotated tag on `main` ([releasing](development.md#releasing)).
- Every release binary and `SHA256SUMS` carries build provenance, and the launcher checks each download against `SHA256SUMS`.
- Repository rules are kept as code and checked against the live settings ([repository settings](development.md#repository-settings)).

## Reporting

Use the [private advisory form](https://github.com/andryorelabs/jobship/security/advisories/new) or email as listed in [SECURITY.md](../.github/SECURITY.md). Do not open a public issue.
