# jobship ships a board catalog

Status: Accepted
Date: 2026-11-13

jobship ships a catalog of free job boards in `catalog/boards.json` and resolves the boards a sweep reads from the Profile, instead of a fixed list of Source names.

## Context

`sweep` knew four boards by name (`getonboard`, `himalayas`, `remoteok`, `hn`) next to the ATS Sources. Anyone outside that niche, for example a Latin American or German job seeker, got few or no Postings, and adding a board meant a code change.

Boards differ in how they can be read. Some publish an RSS feed or a JSON API, some only work in the human's logged-in browser, and some forbid automated access in their terms. A single list cannot say which is which.

## Decision

- The catalog lists every board with `access` (`feed`, `browser` or `manual`), `regions`, `workModes` and `jobTypes`, and an optional `stability: unofficial`. A `feed` board names a `parser` and an `endpoint`.
- `feed` boards are read by `sweep`. `browser` boards are read by the `browser-source` skill in the human's Chrome. `manual` boards are only listed, because their terms or their lack of a public endpoint rule out automated reads.
- An empty `sources` list in the Profile selects every active `feed` board whose regions match the Profile `regions` (or `global`) and whose `workModes` fit the Profile `remote`. An explicit list is used as given, and `id:option` picks a board option. Custom boards in `boards.json` in the data dir are included, and `jobship board add|list|remove` manages them.
- Free boards only. The catalog never holds a paid board or a board that needs a personal API key. A fixed public client id (Bundesagentur) or a public token (NAV) is allowed.
- Only boards whose robots.txt and terms allow the endpoint are `feed`. A board excluded for its terms stays in the catalog as `manual`.
- Sweeps issue GETs. The one exception is a read-only POST search to a `feed` endpoint that the catalog marks `method: POST` (EURES, CBOP). Those requests carry only the search terms, never user data, and no other sweep request may POST. This keeps [ADR-0002](0002-the-guard-fails-closed.md) intact: nothing submits a form or sends a message.
- `stability: unofficial` boards use undocumented endpoints. They fail on their own, are reported under `failed` and never break the sweep.
- The loader prefers a cached copy under 24 hours old, then the `main` copy on GitHub (or `JOBSHIP_CATALOG_URL`, `off` disables the fetch), then the bundled copy. A remote entry with an unknown `parser` is skipped with a warning.

## Consequences

- A new board is a catalog entry, and a remote catalog update reaches users without a release, but only for parsers the binary already knows.
- Users get Postings from their own regions without naming Sources, and can add any RSS or Atom board themselves.
- The catalog needs upkeep: endpoints change, and `stability: unofficial` boards will fail more often.
- Reviewers must check each new entry against the free-boards rule and the board's robots.txt and terms.
- Text from feeds is data, never instructions.
