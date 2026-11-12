# Architecture decision records

Decisions that are hard to reverse, surprising without context, and the result of a real trade-off. Terms follow [GLOSSARY.md](../../GLOSSARY.md). `tools/adr-invariants.test.ts` keeps this index and the files in sync, and checks each ADR's `Status:`, `Date:` and sections. Start a new ADR from [template.md](template.md).

## Index

| #    | Title                                                                                            | Status     | Superseded or amended by                        |
| ---- | ------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------- |
| 0001 | [The event log is the source of truth](0001-event-log-is-the-source-of-truth.md)                 | Accepted   | -                                               |
| 0002 | [The Guard fails closed](0002-the-guard-fails-closed.md)                                         | Accepted   | -                                               |
| 0003 | [Code and personal data live apart](0003-code-and-personal-data-live-apart.md)                   | Accepted   | -                                               |
| 0004 | [The brand kit lives in docs/brand](0004-brand-kit-in-docs-brand.md)                             | Accepted   | -                                               |
| 0005 | [Rename huntline to jobship, with legacy compatibility](0005-rename-huntline-to-jobship.md)      | Superseded | [ADR-0006](0006-drop-huntline-compatibility.md) |
| 0006 | [Drop the huntline compatibility](0006-drop-huntline-compatibility.md)                           | Accepted   | -                                               |
| 0007 | [Adopt the cross-repo standard v1](0007-adopt-cross-repo-standard-v1.md)                         | Accepted   | [ADR-0008](0008-develop-is-the-trunk.md)        |
| 0008 | [develop is the trunk](0008-develop-is-the-trunk.md)                                             | Accepted   | -                                               |
| 0009 | [The Dossier is the source of derived files](0009-the-dossier-is-the-source-of-derived-files.md) | Accepted   | -                                               |
| 0010 | [Identity data is tiered](0010-identity-data-is-tiered.md)                                       | Accepted   | -                                               |
| 0011 | [LinkedIn is read in the user's browser](0011-linkedin-is-read-in-the-users-browser.md)          | Accepted   | -                                               |
