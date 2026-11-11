# Brand kit

Source of truth for the name, slogan, palette, typography, mark and cover style. Every later brand file reads its picks from the table below and never invents or changes one. Terms follow [GLOSSARY.md](../../GLOSSARY.md). The decision to keep the kit here is [ADR-0004](../adr/0004-brand-kit-in-docs-brand.md).

## Decisions

Picked by the maintainer, one round at a time, in a private picker canvas (see [docs/design/README.md](../design/README.md)). Each row is dated.

| Date       | Round            | Pick                                                                                                        | Why                                                                                                                                   |
| ---------- | ---------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-10 | Direction        | **D, the craft of getting hired**                                                                           | Names inside this territory can say "job" and still sound friendly ([naming-research.md](naming-research.md)).                        |
| 2026-11-10 | Name             | `jobhood`, superseded on 2026-11-11 (see below)                                                             | "hood" reads as Robin Hood, which is not the message.                                                                                 |
| 2026-11-11 | Name             | **jobship**                                                                                                 | One English word with a job cue; "ship" also reads as "ship it" and echoes apprenticeship. See [naming.md](naming.md).                |
| 2026-11-10 | Slogan           | **Search less. Decide better.**                                                                             | States the hand-off in [Core message](brief.md#core-message): the tool does the sifting, the human decides.                           |
| 2026-11-11 | Palette          | **Cobalt** (accent `#297cef` on dark, `#145ec1` text on light)                                              | Ranked third in [color-research.md](color-research.md) and the only candidate with its own ANSI slots.                                |
| 2026-11-10 | Typography       | **IBM Plex Sans and IBM Plex Mono**                                                                         | One family for prose and for the terminal.                                                                                            |
| 2026-11-11 | Mark             | **Sail in a tile**, with a two-weight wordmark ("job" light, "ship" bold cobalt)                            | A solid, soft-cornered single-accent shape like the sibling marks. The favicon is the tile alone, with a simplified variant at 16 px. |
| 2026-11-11 | Cover and banner | **Slogan and terminal**: the slogan large beside a `jobship sweep` terminal; a three-line ASCII sail banner | Shows what the tool does and works with no colour.                                                                                    |

## Name change

`jobhood` was picked on 2026-11-10 and replaced by `jobship` on 2026-11-11, before any file used it. The maintainer found that "hood" reads as Robin Hood. `jobship` was round 6's third finalist (58 of 80). Checked on 2026-11-11: npm package free, GitHub repository and account free, `.dev` free, `.com` taken. The trademark check is web search only; USPTO and TMview were not queried, and Jobshift is the nearest neighbour. Renaming the code, docs and repository is tracked in its own tickets and recorded in ADR-0005.

## Files

- [brief.md](brief.md): audience, promise, personality, what to avoid.
- [competitors.md](competitors.md): the field.
- [naming-research.md](naming-research.md), [naming-candidates.md](naming-candidates.md), [naming.md](naming.md): how the name was found and picked.
- [color-research.md](color-research.md): the colour audit and the six palettes.
- [explorations/](explorations/picks.html): the options shown and the pick in each round.
